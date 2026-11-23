FROM node:24-bookworm-slim AS frontend
WORKDIR /app/frontend
RUN npm install --global pnpm@11.25.0
COPY frontend/ ./
RUN pnpm install --frozen-lockfile && pnpm run build

FROM php:8.4-apache
RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev libonig-dev unzip \
    && docker-php-ext-install pdo_pgsql mbstring \
    && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
WORKDIR /var/www/html
COPY composer.json composer.lock ./
RUN composer install --no-dev --prefer-dist --no-interaction --no-autoloader
COPY . .
RUN composer dump-autoload --no-dev --optimize
COPY --from=frontend /app/public/build public/build
COPY deploy/apache.conf /etc/apache2/sites-available/000-default.conf
RUN chown -R www-data:www-data storage bootstrap/cache
EXPOSE 80
CMD ["sh", "-c", "php artisan migrate --force && exec apache2-foreground"]
