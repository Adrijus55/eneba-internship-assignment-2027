<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ProductController
{
    public function index(): JsonResponse
    {
        $products = DB::table('products')->orderBy('id')->get(['id', 'name']);

        return response()->json($products)->header('Cache-Control', 'no-store');
    }
}
