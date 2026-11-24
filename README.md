# Indie Relay

Indie Relay is a game-key marketplace built for the Eneba 2027 Software Engineer Internship assignment. Choose a game, compare two sellers, and buy a demo key with a simulated payment. You can sign out, return later, and open the same key in your order history.

[Open the live store](https://eneba-internship-assignment-2027.onrender.com/) · [Browse the catalog](https://eneba-internship-assignment-2027.onrender.com/catalog)

## Try the buyer journey

1. Search for `oribt cour` from any page to find **Orbit Courier**. Filter by platform, region, or price and sort by price.
2. Open a game and choose an in-stock seller. The cart remembers the specific offer and its seller when you refresh.
3. Proceed to checkout. As a guest, you can create an account or sign in and keep your cart.
4. Select **Confirm simulated purchase**. The receipt shows the game, seller, price, and demo key. Sign back in and open **Order history** to retrieve it again.

The catalog starts with eight fictional games, two offers per game, and three keys per offer. Every completed purchase uses one key per selected offer. The public demo has a finite stock of keys and uses no real payment details.

## Architecture

React 19 and TypeScript render the storefront. Vite builds it into `public/build`. Laravel 13 serves the frontend and the JSON REST API from one origin, so the browser can use Laravel session cookies for account and order requests. PostgreSQL stores the catalog, inventory, users, and purchases.

| Area | How it works | Source |
| --- | --- | --- |
| Homepage | Three separate endpoints supply the promotion, best sellers ranked by completed sales, and deals ranked by savings against a reference price. | [StorefrontController](app/Http/Controllers/StorefrontController.php) |
| Catalog and search | The “From” price is the lowest offer with an unsold key. Sold-out games stay browsable and sort last. Search matches partial words and tolerates a single edit or adjacent letter swap in longer terms. | [Catalog queries](app/Queries/Catalog.php) · [ProductController](app/Http/Controllers/ProductController.php) |
| Seller selection | A product identifies the game. An offer links that game to a seller, a price in integer cents, and its own keys. The cart stores offer IDs in browser local storage and reloads the offers from Laravel. | [Migrations](database/migrations) · [Cart and product views](frontend/src/main.tsx) |
| Accounts | Laravel hashes passwords, regenerates the session on sign-in, checks CSRF tokens for state changes, and requires a signed-in user for checkout and order history. | [SessionController](app/Http/Controllers/SessionController.php) · [Web routes](routes/web.php) |
| Checkout and delivery | Laravel takes the buyer from the session, checks the current price, locks offers and available keys, then writes the order and marks the keys sold in one transaction. A failed cart leaves inventory intact. Receipt queries include the buyer’s ID. | [OrderController](app/Http/Controllers/OrderController.php) |

For example, if the server sells the last key and the browser loses the confirmation response, the browser can retry with the same request ID. Laravel first checks for that buyer’s committed order and returns the original receipt. PostgreSQL locks protect the last key when different buyers compete for it. [Browser purchase flow](frontend/src/orders.tsx)

## Run locally

Use PHP 8.4 with Laravel’s required extensions and PDO PostgreSQL, Composer 2, PostgreSQL (tested with 17), Node.js 24, and pnpm 11.25.0. Run the commands from the repository root.

1. Create an empty PostgreSQL database owned by your local application user. Copy `.env.example` to `.env` and set `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, and `DB_PASSWORD` for that database.
2. Install dependencies, generate the local application key, and run the migrations. The migrations also populate the demo catalog and inventory.

   ```sh
   composer install
   php artisan key:generate
   php artisan migrate
   ```

3. Build the frontend and start Laravel.

   ```sh
   pnpm --dir frontend install --frozen-lockfile
   pnpm --dir frontend run build
   php artisan serve
   ```

4. Open the local address printed by Laravel. The homepage should show a promotion and two product sections. Rebuild the frontend after editing its source.

## Deployment

The public store runs on a free Render Docker web service backed by Neon PostgreSQL. The Docker build compiles the React frontend, installs PHP dependencies, and serves the result with Apache. On startup it applies pending migrations to the configured database. The health endpoint is `/up`. [Dockerfile](Dockerfile) · [Render Blueprint](render.yaml)

To deploy your own copy, create a Neon PostgreSQL database and a Render service from the Blueprint. Set `DB_URL` in Render’s secret settings to the database connection string with TLS enabled. Generate a separate production `APP_KEY` with `php artisan key:generate --show` and enter it directly in Render’s settings. Keep that value stable across deployments. The production configuration uses HTTPS, secure cookies, and disabled debug output. File-backed sessions can expire on a service restart. Purchases persist in PostgreSQL.

## Automated tests

The suite uses Node’s test runner, two local PHP workers for concurrent requests, and Playwright with Google Chrome for the browser journey. Use a **fresh, disposable local PostgreSQL database** for each complete run because the tests buy keys until offers sell out.

1. Build the frontend as above. Point both local workers at the same empty test database and application key. In PowerShell, set `$env:DB_DATABASE` to the name of that database in **each** worker terminal. Keep the other local connection settings from `.env`.
2. Run `php artisan migrate` once against the test database. In separate terminals run `php artisan serve --no-reload --host=127.0.0.1 --port=8001` and `php artisan serve --no-reload --host=127.0.0.1 --port=8002`. The `--no-reload` option passes each terminal’s test database setting through to the PHP worker.
3. Install Google Chrome and make Playwright available to Node. For an isolated test-only installation, run `npm install --prefix .local/browser-tools --no-save playwright`.
4. In a third terminal run the following PowerShell commands. All six tests should execute, with zero skipped.

   ```powershell
   $env:NODE_PATH = (Resolve-Path .local/browser-tools/node_modules).Path
   $env:STORE_TEST_URL = 'http://127.0.0.1:8001'
   $env:CHECKOUT_TEST_URL = $env:STORE_TEST_URL
   $env:CHECKOUT_TEST_SECOND_URL = 'http://127.0.0.1:8002'
   $env:BROWSER_TEST_URL = $env:STORE_TEST_URL
   node --test --test-concurrency=1 scripts/auth.test.mjs scripts/catalog.test.mjs scripts/checkout.test.mjs scripts/export-chat.test.mjs scripts/storefront-browser.test.cjs
   ```

The tests cover registration, sessions and CSRF, homepage feeds, search and filters, seller-specific stock, concurrent purchases, retries, rollback, receipt privacy, and transcript export. The Chrome test also exercises guest cart persistence, two checkout tabs, a lost confirmation response, and receipt recovery after a fresh sign-in.

## Assignment conversation

The full Markdown transcript accompanies the submission as a separate attachment. To refresh the private export from the original assignment chat, run `node scripts/export-chat.mjs "<assignment-session.jsonl>"`. During an active turn, append `--finish-turn` to capture its final reply. The exporter checks the chat ID and reports unfamiliar message types. The transcript, raw session log, and local environment settings are excluded from Git.
