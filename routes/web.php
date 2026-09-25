<?php

use App\Http\Controllers\AuthController;
use App\Models\User;
use Illuminate\Foundation\Auth\EmailVerificationRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// Application entry point redirects to login
Route::redirect('/', '/login');

// Login
Route::get('/login', function () {
    return Inertia::render('Auth/Login');
})->name('login');

Route::post('/login', [AuthController::class, 'login']);

// Registration
Route::get('/register', function () {
    return Inertia::render('Auth/Register');
})->name('register.form');

Route::post('/register', [AuthController::class, 'register'])->name('register');

// Email Verification Notice
Route::get('/verify-email', function (Request $request) {
    return Inertia::render('Auth/VerifyEmail', [
        'email' => Auth::user()?->email,
        'status' => $request->session()->get('status'),
    ]);
})->middleware('auth')->name('verification.notice');

// Email Verification Handler
Route::get('/verify-email/{id}/{hash}', function (
    EmailVerificationRequest $request
) {
    $request->fulfill();

    return redirect()->route('dashboard');
})->middleware(['auth', 'signed'])->name('verification.verify');

// Resend Verification Email
Route::post('/email/verification-notification', function (Request $request) {
    $request->user()->sendEmailVerificationNotification();

    return back()->with(
        'status',
        'A fresh verification link has been sent to your institutional email address.'
    );
})->middleware(['auth', 'throttle:6,1'])->name('verification.send');

// Authenticated Application / Dashboard Route
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/dashboard', function () {
        return Inertia::render('Welcome');
    })->name('dashboard');

    Route::get('/projects', function () {
        return Inertia::render('Projects/Index');
    })->name('projects.index');

    Route::get('/projects/{project}', function ($project) {
        return Inertia::render('Projects/Show', [
            'projectId' => $project,
        ]);
    })->name('projects.show');
});

// Logout
Route::match(['get', 'post'], '/logout', function (Request $request) {
    Auth::logout();

    $request->session()->invalidate();
    $request->session()->regenerateToken();

    return redirect('/login');
})->name('logout');

// Development-Only Preview Shortcut
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
        $user->forceFill([
            'email_verified_at' => now(),
        ])->save();
    }

    Auth::login($user);
    $request->session()->regenerate();

    return redirect()->route('dashboard');
})->name('dev.login');

// Development-Only UI Showcase
Route::get('/dev/showcase', function () {
    return Inertia::render('Welcome');
})->name('dev.showcase');