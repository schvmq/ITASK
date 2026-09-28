<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ChecklistItemController;
use App\Http\Controllers\CommitteeController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\ProjectPersonnelController;
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

    Route::get('/projects', [ProjectController::class, 'index'])->name('projects.index');
    Route::post('/projects', [ProjectController::class, 'store'])->name('projects.store');
    Route::get('/projects/{project}', [ProjectController::class, 'show'])->name('projects.show');
    Route::match(['put', 'patch'], '/projects/{project}', [ProjectController::class, 'update'])->name('projects.update');
    Route::post('/projects/{project}/archive', [ProjectController::class, 'archive'])->name('projects.archive');
    Route::get('/projects/{project}/documents/{document}', [ProjectController::class, 'downloadApprovalDocument'])->name('projects.documents.download');
    Route::post('/projects/{project}/documents', [ProjectController::class, 'uploadDocument'])->name('projects.documents.store');

    // Project Personnel / Roles
    Route::post('/projects/{project}/personnel', [ProjectPersonnelController::class, 'store'])->name('projects.personnel.store');
    Route::delete('/projects/{project}/personnel/{user}', [ProjectPersonnelController::class, 'destroy'])->name('projects.personnel.destroy');

    // Committees
    Route::post('/projects/{project}/committees', [CommitteeController::class, 'store'])->name('projects.committees.store');
    Route::get('/projects/{project}/committees/{committee}', [CommitteeController::class, 'show'])->name('projects.committees.show');
    Route::match(['put', 'patch'], '/projects/{project}/committees/{committee}', [CommitteeController::class, 'update'])->name('projects.committees.update');
    Route::post('/projects/{project}/committees/{committee}/staff', [CommitteeController::class, 'assignStaff'])->name('projects.committees.staff.store');
    Route::delete('/projects/{project}/committees/{committee}', [CommitteeController::class, 'destroy'])->name('projects.committees.destroy');

    // Committee Members
    Route::post('/projects/{project}/committees/{committee}/members', [CommitteeController::class, 'assignMember'])->name('projects.committees.members.store');
    Route::delete('/projects/{project}/committees/{committee}/members/{user}', [CommitteeController::class, 'removeMember'])->name('projects.committees.members.destroy');

    // Activities
    Route::post('/projects/{project}/committees/{committee}/activities', [\App\Http\Controllers\ActivityController::class, 'store'])->name('projects.committees.activities.store');
    Route::get('/projects/{project}/committees/{committee}/activities/{activity}', [\App\Http\Controllers\ActivityController::class, 'show'])->name('projects.committees.activities.show');
    Route::match(['put', 'patch'], '/projects/{project}/committees/{committee}/activities/{activity}', [\App\Http\Controllers\ActivityController::class, 'update'])->name('projects.committees.activities.update');
    Route::delete('/projects/{project}/committees/{committee}/activities/{activity}', [\App\Http\Controllers\ActivityController::class, 'destroy'])->name('projects.committees.activities.destroy');
    Route::post('/projects/{project}/committees/{committee}/activities/{activity}/submit', [\App\Http\Controllers\ActivityController::class, 'submit'])->name('projects.committees.activities.submit');
    Route::post('/projects/{project}/committees/{committee}/activities/{activity}/review', [\App\Http\Controllers\ActivityController::class, 'review'])->name('projects.committees.activities.review');
    Route::post('/projects/{project}/committees/{committee}/activities/{activity}/complete', [\App\Http\Controllers\ActivityController::class, 'markCompleted'])->name('projects.committees.activities.complete');
    Route::post('/projects/{project}/committees/{committee}/activities/{activity}/return', [\App\Http\Controllers\ActivityController::class, 'returnForRevision'])->name('projects.committees.activities.return');

    // Tasks
    Route::post('/projects/{project}/committees/{committee}/activities/{activity}/tasks', [\App\Http\Controllers\TaskController::class, 'store'])->name('projects.committees.activities.tasks.store');
    Route::match(['put', 'patch'], '/projects/{project}/committees/{committee}/activities/{activity}/tasks/{task}', [\App\Http\Controllers\TaskController::class, 'update'])->name('projects.committees.activities.tasks.update');
    Route::delete('/projects/{project}/committees/{committee}/activities/{activity}/tasks/{task}', [\App\Http\Controllers\TaskController::class, 'destroy'])->name('projects.committees.activities.tasks.destroy');

    // Checklist Items
    Route::post('/projects/{project}/committees/{committee}/activities/{activity}/tasks/{task}/checklist', [ChecklistItemController::class, 'store'])->name('projects.committees.activities.tasks.checklist.store');
    Route::match(['put', 'patch'], '/projects/{project}/committees/{committee}/activities/{activity}/tasks/{task}/checklist/{checklist_item}', [ChecklistItemController::class, 'update'])->name('projects.committees.activities.tasks.checklist.update');
    Route::delete('/projects/{project}/committees/{committee}/activities/{activity}/tasks/{task}/checklist/{checklist_item}', [ChecklistItemController::class, 'destroy'])->name('projects.committees.activities.tasks.checklist.destroy');
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