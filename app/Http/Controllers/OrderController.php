<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OrderController
{
    public function purchase(Request $request): JsonResponse
    {
        $data = $request->validate([
            'request_id' => 'required|uuid',
            'items' => 'required|array|list|min:1|max:100',
            'items.*' => 'required|array:offer_id,price_cents',
            'items.*.offer_id' => 'required|integer|min:1|distinct',
            'items.*.price_cents' => 'required|integer|min:1',
        ]);
        $buyer = $request->user()->getAuthIdentifier();
        $prices = [];
        foreach ($data['items'] as $item) {
            $prices[(int) $item['offer_id']] = (int) $item['price_cents'];
        }
        ksort($prices, SORT_NUMERIC);
        $hash = hash('sha256', json_encode($prices, JSON_THROW_ON_ERROR));

        [$id, $created] = DB::transaction(function () use ($buyer, $data, $prices, $hash) {
            // Repeated submissions for this buyer must see any previously committed receipt.
            DB::table('users')->where('id', $buyer)->lockForUpdate()->firstOrFail();
            $prior = DB::table('orders')->where('user_id', $buyer)->where('request_id', $data['request_id'])->first();
            if ($prior) {
                abort_unless($prior->request_hash === $hash, 409, 'This request was already used for a different purchase.');
                return [$prior->id, false];
            }

            $lines = [];
            foreach ($prices as $offerId => $expectedPrice) {
                // Every cart acquires offer locks in the same order.
                $offer = DB::table('offers')->where('id', $offerId)->lockForUpdate()->first();
                abort_if(!$offer || $offer->price_cents !== $expectedPrice, 409, 'An offer changed. Review your cart.');
                $key = DB::table('digital_keys')->where('offer_id', $offerId)->whereNull('sold_at')
                    ->orderBy('id')->lockForUpdate()->first();
                abort_unless($key, 409, 'An offer sold out. Review your cart.');
                $lines[] = [
                    'digital_key_id' => $key->id,
                    'product_name' => DB::table('products')->where('id', $offer->product_id)->value('name'),
                    'seller_name' => DB::table('sellers')->where('id', $offer->seller_id)->value('name'),
                    'price_cents' => $offer->price_cents,
                ];
            }

            // Simulated payment succeeds once all lines pass the price and stock checks.
            $id = DB::table('orders')->insertGetId([
                'user_id' => $buyer, 'request_id' => $data['request_id'], 'request_hash' => $hash,
            ]);
            foreach ($lines as $line) {
                DB::table('digital_keys')->where('id', $line['digital_key_id'])->update(['sold_at' => now()]);
                DB::table('order_items')->insert(['order_id' => $id] + $line);
            }
            return [$id, true];
        }, 3);

        return response()->json(['order_id' => $id], $created ? 201 : 200)->header('Cache-Control', 'private, no-store');
    }

    public function history(Request $request): JsonResponse
    {
        $orders = DB::table('orders')->join('order_items', 'order_items.order_id', '=', 'orders.id')
            ->where('orders.user_id', $request->user()->id)->groupBy('orders.id')->orderByDesc('orders.id')
            ->get(['orders.id', 'orders.created_at', DB::raw('SUM(price_cents)::bigint AS total_cents')]);
        return response()->json($orders)->header('Cache-Control', 'private, no-store');
    }

    public function receipt(Request $request, string $order): JsonResponse
    {
        $receipt = DB::table('orders')->where('user_id', $request->user()->id)->where('id', $order)
            ->firstOrFail(['id', 'created_at']);
        $receipt->items = DB::table('order_items')->join('digital_keys', 'digital_keys.id', '=', 'order_items.digital_key_id')
            ->where('order_id', $receipt->id)->orderBy('order_items.id')
            ->get(['product_name', 'seller_name', 'price_cents', 'code']);
        return response()->json($receipt)->header('Cache-Control', 'private, no-store');
    }
}
