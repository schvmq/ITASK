<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ApiAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_api_login_authenticates_valid_user(): void
    {
        $user = User::factory()->create([
            'email' => 'test.user@carsu.edu.ph',
            'password' => Hash::make('password123'),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'test.user@carsu.edu.ph',
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'user' => [
                    'id',
                    'name',
                    'email',
                    'is_admin',
                    'primaryRole',
                    'userRoles',
                ],
                'redirect',
            ])
            ->assertJsonPath('user.email', 'test.user@carsu.edu.ph')
            ->assertJsonPath('redirect', '/dashboard');

        $this->assertAuthenticatedAs($user);
    }

    public function test_api_login_redirects_admin_to_admin_dashboard(): void
    {
        $admin = User::factory()->create([
            'email' => 'admin.test@carsu.edu.ph',
            'password' => Hash::make('password123'),
            'is_admin' => true,
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'admin.test@carsu.edu.ph',
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('user.is_admin', true)
            ->assertJsonPath('redirect', '/admin/dashboard');
    }

    public function test_api_login_rejects_invalid_credentials(): void
    {
        User::factory()->create([
            'email' => 'valid@carsu.edu.ph',
            'password' => Hash::make('password123'),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'valid@carsu.edu.ph',
            'password' => 'wrongpassword',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);

        $this->assertGuest();
    }

    public function test_api_register_creates_new_user(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'Jane CarSU',
            'email' => 'jane.carsu@carsu.edu.ph',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('user.email', 'jane.carsu@carsu.edu.ph')
            ->assertJsonPath('redirect', '/verify-email');

        $this->assertDatabaseHas('users', [
            'email' => 'jane.carsu@carsu.edu.ph',
        ]);

        $this->assertAuthenticated();
    }

    public function test_api_register_rejects_non_carsu_email(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'Non CarSU',
            'email' => 'outsider@gmail.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);

        $this->assertGuest();
    }

    public function test_api_me_returns_profile_when_authenticated(): void
    {
        $user = User::factory()->create([
            'email' => 'me.test@carsu.edu.ph',
        ]);

        $response = $this->actingAs($user)->getJson('/api/auth/me');

        $response->assertStatus(200)
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.email', 'me.test@carsu.edu.ph');
    }

    public function test_api_me_returns_unauthorized_for_guest(): void
    {
        $response = $this->getJson('/api/auth/me');

        $response->assertStatus(401);
    }

    public function test_api_logout_clears_session(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/auth/logout');

        $response->assertStatus(200)
            ->assertJsonPath('message', 'Logged out successfully.');

        $this->assertGuest();
    }
}
