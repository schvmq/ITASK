<?php

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// Application entry point redirects to login
Route::redirect('/', '/login');
Route::redirect('/register', '/login');

// Authentication UI Pages (Day 2 Frontend Foundation)
Route::get('/login', function () {
    return Inertia::render('Auth/Login');
})->name('login');

Route::get('/verify-email', function () {
    return Inertia::render('Auth/VerifyEmail');
})->name('verification.notice');

// Authenticated Application / Dashboard Route
Route::middleware(['auth'])->group(function () {
    Route::get('/dashboard', function () {
        return Inertia::render('Welcome');
    })->name('dashboard');
});

// Logout Route
Route::match(['get', 'post'], '/logout', function (Request $request) {
    Auth::logout();
    $request->session()->invalidate();
    $request->session()->regenerateToken();

    return redirect('/login');
})->name('logout');

// Development-Only Preview Shortcut (Local Environment Only)
Route::get('/dev/login', function (Request $request) {
    if (! App::environment('local')) {
        abort(404);
    }

    $user = User::firstOrCreate(
        ['email' => 'dev@carsu.edu.ph'],
        [
            'name' => 'ITASK Development User',
            'password' => Hash::make('dev_password_2026'),
            'email_verified_at' => now(),
        ]
    );

    if (! $user->email_verified_at) {
        $user->forceFill(['email_verified_at' => now()])->save();
    }

    Auth::login($user);
    $request->session()->regenerate();

    return redirect()->route('dashboard');
})->name('dev.login');

// Retained UI Component & Layout Showcase (Development Reference)
Route::get('/dev/showcase', function () {
    return Inertia::render('Welcome');
})->name('dev.showcase');
