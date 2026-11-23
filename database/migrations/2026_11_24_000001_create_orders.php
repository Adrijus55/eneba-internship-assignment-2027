<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained();
            $table->uuid('request_id');
            $table->char('request_hash', 64);
            $table->timestampTz('created_at')->useCurrent();
            $table->unique(['user_id', 'request_id']);
        });
        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained();
            $table->foreignId('digital_key_id')->unique()->constrained();
            $table->string('product_name');
            $table->string('seller_name');
            $table->integer('price_cents');
        });

        // Day 2 used predictable placeholders. Only unused demo inventory is reissued.
        foreach (DB::table('digital_keys')->whereNull('sold_at')->pluck('id') as $id) {
            DB::table('digital_keys')->where('id', $id)->update(['code' => 'DEMO-'.bin2hex(random_bytes(16))]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
    }
};
