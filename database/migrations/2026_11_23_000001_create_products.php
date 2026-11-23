<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('name');
        });

        // Day-one demo data is inserted once, so a redeploy preserves edits.
        DB::table('products')->insert(['name' => 'Orbit Courier']);
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
