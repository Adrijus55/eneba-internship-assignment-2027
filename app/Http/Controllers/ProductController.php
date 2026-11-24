<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use App\Queries\Catalog;

class ProductController
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'q' => 'nullable|string|max:100',
            'platform' => 'nullable|string|max:60',
            'region' => 'nullable|string|max:60',
            'min_price' => 'nullable|integer|min:0|max:100000000',
            'max_price' => 'nullable|integer|min:0|max:100000000',
            'sort' => 'nullable|in:price_asc,price_desc',
        ]);
        if (isset($filters['min_price'], $filters['max_price']) && $filters['min_price'] > $filters['max_price']) {
            abort(422, 'The minimum price must be at most the maximum price.');
        }

        $catalog = Catalog::products();
        foreach (['platform', 'region'] as $field) {
            if (isset($filters[$field])) {
                $catalog->where($field, $filters[$field]);
            }
        }
        foreach (['min_price' => '>=', 'max_price' => '<='] as $field => $operator) {
            if (isset($filters[$field])) {
                $catalog->where('price_cents', $operator, $filters[$field]);
            }
        }
        if (isset($filters['sort'])) {
            $catalog->orderByRaw($filters['sort'] === 'price_asc' ? 'price_cents ASC NULLS LAST' : 'price_cents DESC NULLS LAST');
        }
        $products = $catalog->orderBy('id')->get();
        if (isset($filters['q'])) {
            $scores = $products->mapWithKeys(fn ($product) => [$product->id => Catalog::matchScore($filters['q'], $product->name)]);
            $products = $products->filter(fn ($product) => $scores[$product->id] !== null);
            if (!isset($filters['sort'])) {
                $products = $products->sortBy(fn ($product) => $scores[$product->id]);
            }
        }

        return response()->json($products->values())->header('Cache-Control', 'no-store');
    }

    public function filters(): JsonResponse
    {
        return response()->json([
            'platforms' => DB::table('products')->distinct()->orderBy('platform')->pluck('platform'),
            'regions' => DB::table('products')->distinct()->orderBy('region')->pluck('region'),
        ]);
    }

    public function show(string $product): JsonResponse
    {
        $game = DB::table('products')->where('id', $product)
            ->first(['id', 'name', 'description', 'artwork', 'platform', 'region']);
        abort_if($game === null, 404);

        $game->offers = $this->offers()->where('offers.product_id', $product)
            ->orderBy('offers.price_cents')->orderBy('offers.id')->get();

        return response()->json($game)->header('Cache-Control', 'no-store');
    }

    public function offer(string $offer): JsonResponse
    {
        $selection = $this->offers()->where('offers.id', $offer)->first();
        abort_if($selection === null, 404);

        return response()->json($selection)->header('Cache-Control', 'no-store');
    }

    private function offers(): Builder
    {
        return DB::table('offers')
            ->join('sellers', 'sellers.id', '=', 'offers.seller_id')
            ->join('products', 'products.id', '=', 'offers.product_id')
            ->select('offers.id', 'offers.product_id', 'products.name as product_name',
                'sellers.name as seller_name', 'offers.price_cents')
            ->selectSub(
                DB::table('digital_keys')->selectRaw('count(*)')
                    ->whereColumn('offer_id', 'offers.id')->whereNull('sold_at'),
                'available_keys',
            );
    }
}
