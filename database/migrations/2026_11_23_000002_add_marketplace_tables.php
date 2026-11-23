<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->text('description')->default('');
        });

        Schema::create('sellers', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
        });

        Schema::create('offers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained();
            $table->foreignId('seller_id')->constrained();
            $table->integer('price_cents');
            $table->unique(['product_id', 'seller_id']);
        });
        DB::statement('ALTER TABLE offers ADD CONSTRAINT offers_positive_price CHECK (price_cents > 0)');

        Schema::create('digital_keys', function (Blueprint $table) {
            $table->id();
            $table->foreignId('offer_id')->constrained()->index();
            $table->string('code')->unique();
            $table->timestampTz('sold_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('digital_keys');
        Schema::dropIfExists('offers');
        Schema::dropIfExists('sellers');
        Schema::table('products', fn (Blueprint $table) => $table->dropColumn('description'));
    }
};
