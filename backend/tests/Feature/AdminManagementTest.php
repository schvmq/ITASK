<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_unauthenticated_user_is_redirected_from_admin_dashboard(): void
    {
        $response = $this->get('/admin/dashboard');

        $response->assertRedirect('/login');
    }

    public function test_non_admin_user_cannot_access_admin_dashboard(): void
    {
        $user = User::factory()->create(['is_admin' => false]);

        $response = $this->actingAs($user)->get('/admin/dashboard');

        $response->assertStatus(403);
    }

    public function test_admin_user_can_access_admin_dashboard(): void
    {
        $admin = User::factory()->admin()->create();
        $regularUser = User::factory()->create(['name' => 'Student Member']);

        $response = $this->actingAs($admin)->get('/admin/dashboard');

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page
            ->component('Admin/Dashboard')
            ->has('users')
            ->has('stats')
            ->has('projects')
        );
    }

    public function test_admin_can_toggle_admin_privilege_of_another_user(): void
    {
        $admin = User::factory()->admin()->create();
        $targetUser = User::factory()->create(['is_admin' => false]);

        $response = $this->actingAs($admin)->post("/admin/users/{$targetUser->id}/toggle-admin");

        $response->assertRedirect();
        $this->assertTrue($targetUser->fresh()->isAdmin());

        // Toggle back
        $response2 = $this->actingAs($admin)->post("/admin/users/{$targetUser->id}/toggle-admin");
        $response2->assertRedirect();
        $this->assertFalse($targetUser->fresh()->isAdmin());
    }

    public function test_admin_cannot_alter_their_own_admin_privilege(): void
    {
        $admin = User::factory()->admin()->create();

        $response = $this->actingAs($admin)->post("/admin/users/{$admin->id}/toggle-admin");

        $response->assertRedirect();
        $response->assertSessionHas('error');
        $this->assertTrue($admin->fresh()->isAdmin());
    }

    public function test_admin_can_assign_project_role_to_user(): void
    {
        $admin = User::factory()->admin()->create();
        $targetUser = User::factory()->create();
        $project = Project::create([
            'title' => 'Capstone Project Alpha',
            'created_by' => $admin->id,
            'status' => Project::STATUS_PLANNING,
        ]);

        $response = $this->actingAs($admin)->post("/admin/users/{$targetUser->id}/role", [
            'project_id' => $project->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
        ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');

        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $targetUser->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
        ]);
    }

    public function test_admin_can_remove_project_role_assignment(): void
    {
        $admin = User::factory()->admin()->create();
        $targetUser = User::factory()->create();
        $project = Project::create([
            'title' => 'Capstone Project Beta',
            'created_by' => $admin->id,
            'status' => Project::STATUS_PLANNING,
        ]);

        $assignment = ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $targetUser->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
        ]);

        $response = $this->actingAs($admin)->post("/admin/users/{$targetUser->id}/role", [
            'remove_assignment_id' => $assignment->id,
        ]);

        $response->assertRedirect();
        $this->assertDatabaseMissing('project_role_assignments', [
            'id' => $assignment->id,
        ]);
    }

    public function test_admin_can_delete_user_account(): void
    {
        $admin = User::factory()->admin()->create();
        $targetUser = User::factory()->create(['name' => 'To Be Removed']);

        $response = $this->actingAs($admin)->delete("/admin/users/{$targetUser->id}");

        $response->assertRedirect();
        $response->assertSessionHas('success');
        $this->assertDatabaseMissing('users', [
            'id' => $targetUser->id,
        ]);
    }

    public function test_admin_cannot_delete_their_own_account(): void
    {
        $admin = User::factory()->admin()->create();

        $response = $this->actingAs($admin)->delete("/admin/users/{$admin->id}");

        $response->assertRedirect();
        $response->assertSessionHas('error');
        $this->assertDatabaseHas('users', [
            'id' => $admin->id,
        ]);
    }

    public function test_is_admin_is_shared_in_inertia_props(): void
    {
        $admin = User::factory()->admin()->create();

        $response = $this->actingAs($admin)->get('/dashboard');

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page
            ->where('auth.user.is_admin', true)
        );
    }

    public function test_admin_cannot_create_projects(): void
    {
        $admin = User::factory()->admin()->create();

        $response = $this->actingAs($admin)->post('/projects', [
            'title' => 'Admin Unauthorized Project',
            'description' => 'Should fail because admins cannot create projects.',
            'start_date' => '2026-10-01',
            'end_date' => '2026-12-31',
        ]);

        $response->assertForbidden();
        $this->assertDatabaseMissing('projects', [
            'title' => 'Admin Unauthorized Project',
        ]);
    }

    public function test_admin_can_toggle_project_archive(): void
    {
        $admin = User::factory()->admin()->create();
        $user = User::factory()->create();
        $project = Project::create([
            'title' => 'Institutional Archival Project',
            'created_by' => $user->id,
            'status' => Project::STATUS_ACTIVE,
        ]);

        $response = $this->actingAs($admin)->post("/admin/projects/{$project->id}/toggle-archive");

        $response->assertRedirect();
        $this->assertEquals(Project::STATUS_ARCHIVED, $project->fresh()->status);
    }

    public function test_admin_can_verify_new_user_registration(): void
    {
        $admin = User::factory()->admin()->create();
        $pendingUser = User::factory()->unverified()->create([
            'email' => 'newstudent@carsu.edu.ph',
        ]);

        $this->assertNull($pendingUser->email_verified_at);

        $response = $this->actingAs($admin)->post("/admin/users/{$pendingUser->id}/verify");

        $response->assertRedirect();
        $response->assertSessionHas('success');
        $this->assertNotNull($pendingUser->fresh()->email_verified_at);
    }

    public function test_admin_can_deny_new_user_registration(): void
    {
        $admin = User::factory()->admin()->create();
        $pendingUser = User::factory()->unverified()->create([
            'email' => 'fakeaccount@carsu.edu.ph',
        ]);

        $response = $this->actingAs($admin)->post("/admin/users/{$pendingUser->id}/deny");

        $response->assertRedirect();
        $response->assertSessionHas('success');
        $this->assertDatabaseMissing('users', [
            'id' => $pendingUser->id,
        ]);
    }

    public function test_non_admin_cannot_verify_or_deny_user_registration(): void
    {
        $member = User::factory()->create(['is_admin' => false]);
        $pendingUser = User::factory()->unverified()->create();

        $responseVerify = $this->actingAs($member)->post("/admin/users/{$pendingUser->id}/verify");
        $responseVerify->assertForbidden();

        $responseDeny = $this->actingAs($member)->post("/admin/users/{$pendingUser->id}/deny");
        $responseDeny->assertForbidden();

        $this->assertNull($pendingUser->fresh()->email_verified_at);
        $this->assertDatabaseHas('users', ['id' => $pendingUser->id]);
    }
}
