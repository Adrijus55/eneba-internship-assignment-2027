<?php

use App\Http\Controllers\ProductController;
use App\Http\Controllers\StorefrontController;
use Illuminate\Support\Facades\Route;

Route::get('/products', [ProductController::class, 'index']);
Route::get('/products/filters', [ProductController::class, 'filters']);
Route::get('/home/banner', [StorefrontController::class, 'banner']);
Route::get('/home/best-sellers', [StorefrontController::class, 'bestSellers']);
Route::get('/home/deals', [StorefrontController::class, 'deals']);
Route::get('/products/{product}', [ProductController::class, 'show'])->where('product', '[0-9]{1,18}');
Route::get('/offers/{offer}', [ProductController::class, 'offer'])->where('offer', '[0-9]{1,18}');
