<?php

namespace App\Queries;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

class Catalog
{
    public static function products(): Builder
    {
        $price = DB::table('offers')->whereColumn('offers.product_id', 'products.id')
            ->whereExists(function (Builder $keys) {
                $keys->selectRaw('1')->from('digital_keys')
                    ->whereColumn('digital_keys.offer_id', 'offers.id')->whereNull('sold_at');
            })->selectRaw('MIN(price_cents)');

        $products = DB::table('products')
            ->select(['id', 'name', 'artwork', 'platform', 'region', 'list_price_cents'])
            ->selectSub($price, 'price_cents');

        return DB::query()->fromSub($products, 'catalog');
    }

    // Only the small, filtered demo catalog is scored in PHP.
    public static function matchScore(string $query, string $name): ?int
    {
        $words = self::words($name);
        $terms = self::words($query);
        if (!$terms) {
            return null;
        }
        if ($terms === $words) {
            return 0;
        }

        $score = 0;
        foreach ($terms as $term) {
            $best = null;
            foreach ($words as $word) {
                if ($term === $word) {
                    $best = 0;
                    break;
                }
                if (str_contains($word, $term)) {
                    $best = 1;
                } elseif ($best === null && strlen($term) >= 4 && self::oneEditAway($term, $word)) {
                    $best = 2;
                }
            }
            if ($best === null) {
                return null;
            }
            $score += $best;
        }

        return 1 + $score;
    }

    private static function words(string $value): array
    {
        return preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower($value), -1, PREG_SPLIT_NO_EMPTY);
    }

    private static function oneEditAway(string $term, string $word): bool
    {
        if (levenshtein($term, $word) <= 1) {
            return true;
        }
        if (strlen($term) !== strlen($word)) {
            return false;
        }
        for ($i = 0; $i < strlen($term) - 1; $i++) {
            if ($term[$i] !== $word[$i]) {
                $swapped = substr_replace($term, $term[$i + 1].$term[$i], $i, 2);
                return $swapped === $word;
            }
        }

        return false;
    }
}
