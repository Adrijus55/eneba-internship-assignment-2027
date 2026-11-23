<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

class ProductController
{
    public function index(): JsonResponse
    {
        $products = DB::table('products')->orderBy('id')->get(['id', 'name']);

        return response()->json($products)->header('Cache-Control', 'no-store');
    }

    public function show(string $product): JsonResponse
    {
        $game = DB::table('products')->where('id', $product)->first(['id', 'name', 'description']);
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
