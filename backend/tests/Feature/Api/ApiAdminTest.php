<?php

namespace Tests\Feature\Api;

use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_non_admin_cannot_access_api_admin_dashboard(): void
    {
        $user = User::factory()->create(['is_admin' => false]);

        $response = $this->actingAs($user)->getJson('/api/admin/dashboard');

        $response->assertStatus(403);
    }

    public function test_guest_cannot_access_api_admin_dashboard(): void
    {
        $response = $this->getJson('/api/admin/dashboard');

        $response->assertStatus(401);
    }

    public function test_admin_can_retrieve_dashboard_overview(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        User::factory()->count(3)->create();

        $response = $this->actingAs($admin)->getJson('/api/admin/dashboard');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'users',
                'projects',
                'metrics' => [
                    'total_users',
                    'pending_verifications',
                    'verified_users',
                    'total_admins',
                    'total_projects',
                ],
                'settings',
            ]);
    }

    public function test_admin_can_verify_user_account(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $unverified = User::factory()->create(['email_verified_at' => null]);

        $response = $this->actingAs($admin)->postJson("/api/admin/users/{$unverified->id}/verify");

        $response->assertStatus(200)
            ->assertJsonPath('user.id', $unverified->id);

        $this->assertNotNull($unverified->fresh()->email_verified_at);
    }

    public function test_admin_can_toggle_admin_status(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $targetUser = User::factory()->create(['is_admin' => false]);

        $response = $this->actingAs($admin)->postJson("/api/admin/users/{$targetUser->id}/toggle-admin");

        $response->assertStatus(200)
            ->assertJsonPath('is_admin', true);

        $this->assertTrue((bool) $targetUser->fresh()->is_admin);
    }

    public function test_admin_cannot_toggle_own_admin_status(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);

        $response = $this->actingAs($admin)->postJson("/api/admin/users/{$admin->id}/toggle-admin");

        $response->assertStatus(403);
    }

    public function test_admin_can_toggle_project_archive(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $creator = User::factory()->create();
        $project = Project::create([
            'title' => 'API Archival Project',
            'created_by' => $creator->id,
            'status' => Project::STATUS_ACTIVE,
        ]);

        $response = $this->actingAs($admin)->postJson("/api/admin/projects/{$project->id}/toggle-archive");

        $response->assertStatus(200)
            ->assertJsonPath('status', Project::STATUS_ARCHIVED)
            ->assertJsonPath('is_archived', true);

        $this->assertEquals(Project::STATUS_ARCHIVED, $project->fresh()->status);
    }

    public function test_admin_can_update_system_settings(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);

        $response = $this->actingAs($admin)->postJson('/api/admin/settings', [
            'announcement' => 'Midterm defense schedules finalized.',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('announcement', 'Midterm defense schedules finalized.');
    }
}
