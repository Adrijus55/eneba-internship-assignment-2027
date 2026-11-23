<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        $products = [
            ['Orbit Courier', 'Deliver cargo between remote orbital stations.'],
            ['Harbor Foundry', 'Build a working shipyard on a quiet coastline.'],
            ['Lantern Vale', 'Explore a valley where trails light up after dark.'],
            ['Paper Rally', 'Race across folding tracks in a miniature world.'],
            ['Glass Circuit', 'Solve puzzles by rerouting power through glass tiles.'],
            ['Moss & Meteor', 'Restore a garden around a fallen meteor.'],
            ['Frost Signal', 'Repair mountain radio towers before the storm arrives.'],
            ['Dune Dispatch', 'Plan supply routes between desert outposts.'],
        ];
        $sellers = [
            DB::table('sellers')->insertGetId(['name' => 'Pixel Harbor']),
            DB::table('sellers')->insertGetId(['name' => 'Key Lantern']),
        ];

        foreach ($products as $index => [$name, $description]) {
            if ($index === 0) {
                // Keep the original demo row and any edits to its name.
                $productId = DB::table('products')->min('id');
                if ($productId !== null) {
                    DB::table('products')->where('id', $productId)->update(['description' => $description]);
                }
            }
            if ($index !== 0 || $productId === null) {
                $productId = DB::table('products')->insertGetId(compact('name', 'description'));
            }

            foreach ($sellers as $sellerIndex => $sellerId) {
                $offerId = DB::table('offers')->insertGetId([
                    'product_id' => $productId,
                    'seller_id' => $sellerId,
                    'price_cents' => 399 + $index * 100 + $sellerIndex * 150,
                ]);
                for ($number = 1; $number <= 3; $number++) {
                    DB::table('digital_keys')->insert([
                        'offer_id' => $offerId,
                        'code' => "DEMO-{$offerId}-{$number}",
                    ]);
                }
            }
        }
    }

    public function down(): void
    {
        throw new LogicException('Demo catalog data may have been used. Keep the data and use a forward migration.');
    }
};
