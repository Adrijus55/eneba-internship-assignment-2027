<?php

use Illuminate\Support\Facades\Route;

$store = fn () => response()->file(public_path('build/index.html'));

Route::get('/', $store);
Route::get('/products/{product}', $store)->where('product', '[0-9]{1,18}');
Route::get('/cart', $store);
