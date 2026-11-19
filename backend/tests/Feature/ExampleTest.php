<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    /**
     * Test application entry point redirects to login.
     */
    public function test_the_application_entry_redirects_to_login(): void
    {
        $response = $this->get('/');

        $response->assertRedirect('/login');
    }

    /**
     * Test that public registration route renders successfully.
     */
    public function test_registration_route_renders_successfully(): void
    {
        $response = $this->get('/register');

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Auth/Register')
        );
    }

    /**
     * Test the login page renders successfully with Inertia.
     */
    public function test_the_login_page_returns_a_successful_response(): void
    {
        $response = $this->get('/login');

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Auth/Login')
        );
    }

    /**
     * Test the email verification page renders successfully for authenticated user.
     */
    public function test_the_verification_page_returns_a_successful_response(): void
    {
        $user = User::firstOrCreate(
            ['email' => 'dev@carsu.edu.ph'],
            ['name' => 'ITASK Development User', 'password' => 'secret']
        );

        $response = $this->actingAs($user)->get('/verify-email');

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Auth/VerifyEmail')
        );
    }

    /**
     * Test A, D, E: Registration with valid @carsu.edu.ph email succeeds,
     * creates unverified user, and authenticates the newly created user.
     */
    public function test_registration_with_valid_carsu_email_succeeds_and_creates_unverified_authenticated_user(): void
    {
        Notification::fake();

        $email = 'new_faculty_' . uniqid() . '@carsu.edu.ph';

        $response = $this->post('/register', [
            'name' => 'Dr. Maria Santos',
            'email' => $email,
            'password' => 'FacultyPassword2026!',
            'password_confirmation' => 'FacultyPassword2026!',
        ]);

        $response->assertRedirect('/verify-email');
        $this->assertAuthenticated();

        $user = User::where('email', $email)->first();
        $this->assertNotNull($user);
        $this->assertEquals('Dr. Maria Santos', $user->name);
        $this->assertNull($user->email_verified_at);
        $this->assertFalse($user->hasVerifiedEmail());
        $this->assertEquals($user->id, Auth::id());

        Notification::assertSentTo($user, VerifyEmail::class);
    }

    /**
     * Test B: Registration with non-@carsu.edu.ph email fails validation.
     */
    public function test_registration_with_non_carsu_email_fails_validation(): void
    {
        $email = 'outsider_' . uniqid() . '@gmail.com';

        $response = $this->post('/register', [
            'name' => 'External User',
            'email' => $email,
            'password' => 'SecurePassword2026!',
            'password_confirmation' => 'SecurePassword2026!',
        ]);

        $response->assertSessionHasErrors(['email']);
        $this->assertGuest();
        $this->assertDatabaseMissing('users', ['email' => $email]);
    }

    /**
     * Test C: Duplicate email registration fails.
     */
    public function test_duplicate_email_registration_fails(): void
    {
        $existingEmail = 'existing_reg_' . uniqid() . '@carsu.edu.ph';
        User::create([
            'name' => 'Initial User',
            'email' => $existingEmail,
            'password' => 'InitialPassword123!',
        ]);

        $response = $this->post('/register', [
            'name' => 'Duplicate Attempt',
            'email' => $existingEmail,
            'password' => 'NewPassword123!',
            'password_confirmation' => 'NewPassword123!',
        ]);

        $response->assertSessionHasErrors(['email']);
    }

    /**
     * Test F: Unverified authenticated users cannot access the dashboard and are redirected to the verification notice.
     */
    public function test_unverified_authenticated_user_cannot_access_dashboard_and_is_redirected_to_verify_email(): void
    {
        $user = User::create([
            'name' => 'Unverified Faculty',
            'email' => 'unverified_' . uniqid() . '@carsu.edu.ph',
            'password' => 'ValidPassword123!',
        ]);

        $response = $this->actingAs($user)->get('/dashboard');

        $response->assertRedirect('/verify-email');
    }

    /**
     * Test G: Verified users can access the dashboard.
     */
    public function test_verified_user_can_access_dashboard(): void
    {
        $user = User::create([
            'name' => 'Verified Faculty',
            'email' => 'verified_' . uniqid() . '@carsu.edu.ph',
            'password' => 'ValidPassword123!',
        ]);
        $user->forceFill(['email_verified_at' => now()])->save();

        $response = $this->actingAs($user)->get('/dashboard');

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Welcome')
        );
    }

    /**
     * Test H: Invalid login credentials are rejected with generic error (no account enumeration).
     */
    public function test_invalid_login_credentials_are_rejected_with_generic_error(): void
    {
        // 1. Nonexistent account
        $responseNonexistent = $this->post('/login', [
            'email' => 'nonexistent_account_' . uniqid() . '@carsu.edu.ph',
            'password' => 'AnyPassword123!',
        ]);
        $responseNonexistent->assertSessionHasErrors([
            'email' => "The email or password is incorrect. Please check your credentials or register if you don't have an account yet.",
        ]);
        $this->assertGuest();

        // 2. Existing account with wrong password
        $user = User::create([
            'name' => 'Existing Faculty',
            'email' => 'known_faculty_' . uniqid() . '@carsu.edu.ph',
            'password' => 'RealSecretPassword123!',
        ]);

        $responseWrongPassword = $this->post('/login', [
            'email' => $user->email,
            'password' => 'WrongPassword123!',
        ]);
        $responseWrongPassword->assertSessionHasErrors([
            'email' => "The email or password is incorrect. Please check your credentials or register if you don't have an account yet.",
        ]);
        $this->assertGuest();

        // 3. Malformed email input fails validation
        $responseMalformed = $this->post('/login', [
            'email' => 'not-an-email',
            'password' => 'AnyPassword123!',
        ]);
        $responseMalformed->assertSessionHasErrors(['email']);
        $this->assertGuest();

        // 4. Missing required credentials fail validation
        $responseMissing = $this->post('/login', [
            'email' => '',
            'password' => '',
        ]);
        $responseMissing->assertSessionHasErrors(['email', 'password']);
        $this->assertGuest();
    }

    /**
     * Test I: Successful login regenerates the session.
     */
    public function test_successful_login_regenerates_the_session(): void
    {
        $user = User::create([
            'name' => 'Faculty Session Test',
            'email' => 'session_user_' . uniqid() . '@carsu.edu.ph',
            'password' => 'SessionPassword123!',
        ]);
        $user->forceFill(['email_verified_at' => now()])->save();

        $this->get('/login');
        $initialSessionId = session()->getId();

        $response = $this->post('/login', [
            'email' => $user->email,
            'password' => 'SessionPassword123!',
            'remember' => true,
        ]);

        $response->assertRedirect('/dashboard');
        $this->assertAuthenticatedAs($user);
        $this->assertNotEquals($initialSessionId, session()->getId());
    }

    /**
     * Test J & K: Logout invalidates the authenticated session and logged-out user cannot access protected dashboard.
     */
    public function test_logout_invalidates_authenticated_session_and_blocks_dashboard(): void
    {
        $user = User::create([
            'name' => 'Logout Test User',
            'email' => 'logout_user_' . uniqid() . '@carsu.edu.ph',
            'password' => 'LogoutPassword123!',
        ]);
        $user->forceFill(['email_verified_at' => now()])->save();

        $this->actingAs($user);
        $this->assertAuthenticated();

        $response = $this->post('/logout');

        $response->assertRedirect('/login');
        $this->assertGuest();

        // Logged out user cannot access protected dashboard
        $dashboardResponse = $this->get('/dashboard');
        $dashboardResponse->assertRedirect('/login');
    }

    /**
     * Test L: Verification route remains protected by expected authentication and signature requirements.
     */
    public function test_verification_route_requires_auth_and_valid_signed_url(): void
    {
        $user = User::create([
            'name' => 'Verify Route Test',
            'email' => 'verify_route_' . uniqid() . '@carsu.edu.ph',
            'password' => 'SecretPassword123!',
        ]);

        $validSignedUrl = URL::temporarySignedRoute(
            'verification.verify',
            now()->addMinutes(60),
            ['id' => $user->id, 'hash' => sha1($user->getEmailForVerification())]
        );

        // 1. Unauthenticated guest accessing signed URL is redirected to login
        $guestResponse = $this->get($validSignedUrl);
        $guestResponse->assertRedirect('/login');
        $this->assertFalse($user->fresh()->hasVerifiedEmail());

        // 2. Authenticated user accessing tampered/invalid signature returns 403
        $invalidSignedUrl = $validSignedUrl . '&tampered=true';
        $tamperedResponse = $this->actingAs($user)->get($invalidSignedUrl);
        $tamperedResponse->assertStatus(403);
        $this->assertFalse($user->fresh()->hasVerifiedEmail());

        // 3. Authenticated user accessing valid signed URL succeeds and marks email verified
        $successResponse = $this->actingAs($user)->get($validSignedUrl);
        $successResponse->assertRedirect('/dashboard');
        $this->assertTrue($user->fresh()->hasVerifiedEmail());
    }

    /**
     * Test that unauthenticated guests cannot access the dashboard.
     */
    public function test_guests_cannot_access_dashboard(): void
    {
        $response = $this->get('/dashboard');

        $response->assertRedirect('/login');
    }

    /**
     * Test that /dev/login authenticates the test user and redirects to dashboard in local environment.
     */
    public function test_dev_login_authenticates_test_user_in_local_environment(): void
    {
        App::detectEnvironment(fn () => 'local');

        $response = $this->get('/dev/login');

        $response->assertRedirect('/dashboard');
        $this->assertAuthenticated();

        /** @var User $user */
        $user = Auth::user();
        $this->assertEquals('dev@carsu.edu.ph', $user->email);
        $this->assertEquals('ITASK Development User', $user->name);
        $this->assertNotNull($user->email_verified_at);

        // Test that the authenticated user can access the dashboard
        $dashboardResponse = $this->get('/dashboard');
        $dashboardResponse->assertStatus(200);
        $dashboardResponse->assertInertia(fn (Assert $page) => $page
            ->component('Welcome')
            ->where('auth.user.email', 'dev@carsu.edu.ph')
        );

        App::detectEnvironment(fn () => 'testing');
    }

    /**
     * Test that /dev/login is forbidden (returns 404) in production environment.
     */
    public function test_dev_login_returns_404_outside_local_environment(): void
    {
        App::detectEnvironment(fn () => 'production');

        $response = $this->get('/dev/login');

        $response->assertStatus(404);

        // Restore testing environment
        App::detectEnvironment(fn () => 'testing');
    }

    /**
     * Test that guests cannot access the projects page and are redirected to login.
     */
    public function test_guests_cannot_access_projects_page(): void
    {
        $response = $this->get('/projects');

        $response->assertRedirect('/login');
    }

    /**
     * Test that unverified authenticated users cannot access the projects page.
     */
    public function test_unverified_user_cannot_access_projects_page(): void
    {
        $user = User::create([
            'name' => 'Unverified Member',
            'email' => 'unverified_proj_' . uniqid() . '@carsu.edu.ph',
            'password' => 'ValidPassword123!',
        ]);

        $response = $this->actingAs($user)->get('/projects');

        $response->assertRedirect('/verify-email');
    }

    /**
     * Test that verified users can access the projects page.
     */
    public function test_verified_user_can_access_projects_page(): void
    {
        $user = User::create([
            'name' => 'Verified Member',
            'email' => 'verified_proj_' . uniqid() . '@carsu.edu.ph',
            'password' => 'ValidPassword123!',
        ]);
        $user->forceFill(['email_verified_at' => now()])->save();

        $response = $this->actingAs($user)->get('/projects');

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Projects/Index')
        );
    }

    /**
     * Test that guests cannot access the project detail page.
     */
    public function test_guests_cannot_access_project_detail_page(): void
    {
        $response = $this->get('/projects/proj-1');

        $response->assertRedirect('/login');
    }

    /**
     * Test that unverified users cannot access the project detail page.
     */
    public function test_unverified_user_cannot_access_project_detail_page(): void
    {
        $user = User::create([
            'name' => 'Unverified Staff',
            'email' => 'unverified_detail_' . uniqid() . '@carsu.edu.ph',
            'password' => 'ValidPassword123!',
        ]);

        $response = $this->actingAs($user)->get('/projects/proj-1');

        $response->assertRedirect('/verify-email');
    }

    /**
     * Test that verified users can access the project detail page.
     */
    public function test_verified_user_can_access_project_detail_page(): void
    {
        $user = User::create([
            'name' => 'Verified Leader',
            'email' => 'verified_detail_' . uniqid() . '@carsu.edu.ph',
            'password' => 'ValidPassword123!',
        ]);
        $user->forceFill(['email_verified_at' => now()])->save();

        $response = $this->actingAs($user)->get('/projects/proj-1');

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Projects/Show')
            ->where('projectId', 'proj-1')
        );
    }
}
