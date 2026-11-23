<?php

use App\Http\Controllers\ProductController;
use Illuminate\Support\Facades\Route;

Route::get('/products', [ProductController::class, 'index']);
Route::get('/products/{product}', [ProductController::class, 'show'])->where('product', '[0-9]{1,18}');
Route::get('/offers/{offer}', [ProductController::class, 'offer'])->where('offer', '[0-9]{1,18}');
