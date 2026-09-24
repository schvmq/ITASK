<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Auth;
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
     * Test that public registration route redirects to login.
     */
    public function test_registration_route_redirects_to_login(): void
    {
        $response = $this->get('/register');

        $response->assertRedirect('/login');
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
     * Test the email verification page renders successfully.
     */
    public function test_the_verification_page_returns_a_successful_response(): void
    {
        $response = $this->get('/verify-email');

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Auth/VerifyEmail')
        );
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
     * Test that logging out clears session and redirects to login.
     */
    public function test_logging_out_clears_session(): void
    {
        $user = User::firstOrCreate(
            ['email' => 'dev@carsu.edu.ph'],
            ['name' => 'ITASK Development User', 'password' => 'secret', 'email_verified_at' => now()]
        );

        $this->actingAs($user);
        $this->assertAuthenticated();

        $response = $this->post('/logout');

        $response->assertRedirect('/login');
        $this->assertGuest();
    }
}
