<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// Home / Component & Dashboard Showcase
Route::get('/', function () {
    return Inertia::render('Welcome');
})->name('home');

// Authentication UI Pages (Day 2 Frontend Foundation)
Route::get('/login', function () {
    return Inertia::render('Auth/Login');
})->name('login');

Route::get('/register', function () {
    return Inertia::render('Auth/Register');
})->name('register');

Route::get('/verify-email', function () {
    return Inertia::render('Auth/VerifyEmail');
})->name('verification.notice');
