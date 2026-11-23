<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class SessionController
{
    public function current(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $request->user()?->only(['id', 'email']),
            'csrfToken' => $request->session()->token(),
        ])->header('Cache-Control', 'private, no-store');
    }

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:254'],
            'password' => ['bail', 'required', 'string', 'min:12', 'confirmed',
                function ($attribute, $value, $fail) {
                    if (strlen($value) > 72 || str_contains($value, "\0")) {
                        $fail('Use a password of up to 72 bytes without null characters.');
                    }
                }],
        ]);
        try {
            $user = User::create(['email' => strtolower($data['email']), 'password' => Hash::make($data['password'])]);
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['email' => 'This email is already registered.']);
        }
        Auth::login($user);
        $request->session()->regenerate();

        return $this->current($request)->setStatusCode(201);
    }

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate(['email' => ['required', 'email', 'max:254'], 'password' => ['required', 'string']]);
        $credentials['email'] = strtolower(trim($credentials['email']));
        if (strlen($credentials['password']) > 72 || str_contains($credentials['password'], "\0") || !Auth::attempt($credentials)) {
            throw ValidationException::withMessages(['email' => 'The email or password is incorrect.']);
        }
        $request->session()->regenerate();

        return $this->current($request);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return $this->current($request);
    }
}
