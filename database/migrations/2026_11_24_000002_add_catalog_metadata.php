<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('platform')->default('Steam');
            $table->string('region')->default('Global');
            $table->integer('list_price_cents')->nullable();
            $table->string('artwork')->default('orbit');
        });
        $products = [
            1 => ['Steam', 'Global', 699, 'orbit'],
            2 => ['Steam', 'Europe', null, 'harbor'],
            3 => ['Xbox', 'Global', 949, 'lantern'],
            4 => ['Nintendo Switch', 'Europe', null, 'rally'],
            5 => ['Steam', 'North America', 1199, 'glass'],
            6 => ['Nintendo Switch', 'Global', 1299, 'moss'],
            7 => ['Xbox', 'Europe', null, 'frost'],
            8 => ['Steam', 'Global', 1399, 'dune'],
        ];
        foreach ($products as $id => [$platform, $region, $listPrice, $artwork]) {
            DB::table('products')->where('id', $id)->update([
                'platform' => $platform,
                'region' => $region,
                'list_price_cents' => $listPrice,
                'artwork' => $artwork,
            ]);
        }

        Schema::create('promotions', function (Blueprint $table) {
            $table->id();
            $table->string('label');
            $table->string('title');
            $table->text('description');
            $table->string('button_label');
        });
        DB::table('promotions')->insert([
            'label' => 'The indie collection',
            'title' => 'Discover your next game',
            'description' => 'Explore indie worlds, compare offers from different sellers, and get a demo key instantly.',
            'button_label' => 'Explore the catalog',
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('promotions');
        Schema::table('products', fn (Blueprint $table) =>
            $table->dropColumn(['platform', 'region', 'list_price_cents', 'artwork'])
        );
    }
};
