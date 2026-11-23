<?php

use Illuminate\Foundation\Application;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        health: '/up',
    )
    ->withMiddleware()
    ->withExceptions(function (Illuminate\Foundation\Configuration\Exceptions $exceptions) {
        $exceptions->shouldRenderJsonWhen(fn ($request) =>
            $request->is('api/*') || $request->expectsJson()
        );
    })
    ->create();
