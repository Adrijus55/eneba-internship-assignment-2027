<?php

namespace App\Http\Controllers;

use App\Queries\Catalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class StorefrontController
{
    public function banner(): JsonResponse
    {
        return response()->json(DB::table('promotions')->orderByDesc('id')
            ->first(['label', 'title', 'description', 'button_label']));
    }

    public function bestSellers(): JsonResponse
    {
        $sales = DB::table('order_items')
            ->join('digital_keys', 'digital_keys.id', '=', 'order_items.digital_key_id')
            ->join('offers', 'offers.id', '=', 'digital_keys.offer_id')
            ->whereColumn('offers.product_id', 'catalog.id')->selectRaw('count(*)');

        return response()->json(Catalog::products()->whereNotNull('price_cents')
            ->orderByDesc($sales)->orderBy('id')->limit(4)->get())->header('Cache-Control', 'no-store');
    }

    public function deals(): JsonResponse
    {
        return response()->json(Catalog::products()->whereColumn('price_cents', '<', 'list_price_cents')
            ->orderByRaw('list_price_cents - price_cents DESC')->orderBy('id')->limit(4)->get())
            ->header('Cache-Control', 'no-store');
    }
}
