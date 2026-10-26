<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Authorization\AuthorizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class ApiAuthController extends Controller
{
    public function __construct(
        protected AuthorizationService $authService = new AuthorizationService()
    ) {}

    /**
     * Authenticate user via JSON request.
     */
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $remember = $request->boolean('remember');

        if (! Auth::attempt($credentials, $remember)) {
            throw ValidationException::withMessages([
                'email' => ["The email or password is incorrect. Please check your credentials or register if you don't have an account yet."],
            ]);
        }

        $request->session()->regenerate();

        /** @var User $user */
        $user = Auth::user();

        $redirect = $this->authService->isAdmin($user) ? '/admin/dashboard' : '/dashboard';

        return response()->json([
            'message' => 'Authenticated successfully.',
            'user' => $this->formatUserPayload($user),
            'redirect' => $redirect,
        ]);
    }

    /**
     * Register a new user via JSON request.
     */
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'email',
                'ends_with:@carsu.edu.ph',
                'unique:users,email',
            ],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => $validated['password'],
        ]);

        Auth::login($user);

        $request->session()->regenerate();

        try {
            $user->sendEmailVerificationNotification();
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json([
            'message' => 'Registration successful. A verification email has been sent.',
            'user' => $this->formatUserPayload($user),
            'redirect' => '/verify-email',
        ], 201);
    }

    /**
     * Terminate the authenticated session.
     */
    public function logout(Request $request): JsonResponse
    {
        Auth::logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json([
            'message' => 'Logged out successfully.',
        ]);
    }

    /**
     * Return current authenticated user profile and roles.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        return response()->json([
            'user' => $this->formatUserPayload($user),
        ]);
    }

    /**
     * Resend email verification notification.
     */
    public function resendVerification(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if ($user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Email address is already verified.',
            ], 400);
        }

        $user->sendEmailVerificationNotification();

        return response()->json([
            'message' => 'A fresh verification link has been sent to your institutional email address.',
        ]);
    }

    /**
     * Format consistent user payload including roles and privileges.
     */
    protected function formatUserPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'is_admin' => $this->authService->isAdmin($user),
            'email_verified_at' => $user->email_verified_at?->toISOString(),
            'primaryRole' => $this->authService->getPrimaryRole($user),
            'userRoles' => $this->authService->getUserRoles($user),
        ];
    }
}
