<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\SessionController;
use App\Http\Controllers\OrderController;

$store = fn () => response()->file(public_path('build/index.html'));

Route::get('/', $store);
Route::get('/products/{product}', $store)->where('product', '[0-9]{1,18}');
Route::get('/cart', $store);
Route::get('/login', $store)->name('login');
Route::get('/register', $store);
Route::get('/checkout', $store)->middleware('auth');

// These JSON routes need the web group's session and CSRF middleware.
Route::get('/api/session', [SessionController::class, 'current']);
Route::post('/api/register', [SessionController::class, 'register'])->middleware('throttle:10,1');
Route::post('/api/login', [SessionController::class, 'login'])->middleware('throttle:10,1');
Route::post('/api/logout', [SessionController::class, 'logout'])->middleware('auth');
Route::middleware('auth')->group(function () use ($store) {
    Route::get('/orders', $store);
    Route::get('/orders/{order}', $store)->where('order', '[0-9]{1,18}');
    Route::get('/api/checkout', [SessionController::class, 'current']);
    Route::post('/api/checkout', [OrderController::class, 'purchase']);
    Route::get('/api/orders', [OrderController::class, 'history']);
    Route::get('/api/orders/{order}', [OrderController::class, 'receipt'])->where('order', '[0-9]{1,18}');
});
