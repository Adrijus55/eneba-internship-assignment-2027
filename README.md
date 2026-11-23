# Eneba Internship Assignment 2027

A game-key marketplace built in stages. The first page reads a product name from PostgreSQL through a Laravel JSON endpoint and displays it in React.

## Run the first page

Use PHP 8.4 with PDO PostgreSQL and the Laravel-required extensions, Composer 2, PostgreSQL, Node 24, and pnpm 11.25.0.

1. Run `composer install` in the repository root. Copy `.env.example` to `.env`, configure a dedicated PostgreSQL database, and run `php artisan key:generate`.
2. Run `php artisan migrate`. The first migration creates the products table and inserts one demo game.
3. Run `pnpm --dir frontend install --frozen-lockfile` and `pnpm --dir frontend run build`.
4. Run `php artisan serve` and open the displayed local address. Compare the product shown there with the JSON at `/api/products`.

## Deploy and verify

Use the repository's Render Blueprint with the free plan. In Render's secret settings, enter a fresh Laravel `APP_KEY` and the Neon PostgreSQL connection string as `DB_URL`, including its TLS query parameters. The container runs pending migrations at startup.

Open the public address in a private window. Change the seeded product's name in the dedicated Neon database, refresh the browser and check the displayed name. Restore the demo name after the check.

## Export this assignment chat

From the repository root, run `node scripts/export-chat.mjs "path/to/assignment-session.jsonl"` with Node 22 or later. Use `--finish-turn` as the last argument during an active turn to refresh the export when that turn ends. The script checks the source chat ID and saves `AI_CHAT_HISTORY.md` locally. An unknown completed item stops the export for review. Review the full private file for sensitive content before providing the transcript to the evaluator.
