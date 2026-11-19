<?php

namespace Tests\Feature\Api;

use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\User;
use App\Services\Authorization\RoleRegistry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ApiProjectTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_access_projects_api(): void
    {
        $response = $this->getJson('/api/projects');

        $response->assertStatus(401);
    }

    public function test_authenticated_user_can_list_assigned_projects(): void
    {
        $user = User::factory()->create();
        $project = Project::create([
            'title' => 'Assigned Project',
            'created_by' => $user->id,
            'status' => Project::STATUS_ACTIVE,
        ]);
        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $user->id,
            'role' => RoleRegistry::ROLE_PROJECT_LEADER,
        ]);

        $response = $this->actingAs($user)->getJson('/api/projects');

        $response->assertStatus(200)
            ->assertJsonStructure(['projects', 'availableUsers'])
            ->assertJsonPath('projects.0.title', 'Assigned Project');
    }

    public function test_authorized_user_can_create_project_with_document(): void
    {
        Storage::fake('local');
        $user = User::factory()->create();
        $file = UploadedFile::fake()->create('approval.pdf', 500, 'application/pdf');

        $response = $this->actingAs($user)->postJson('/api/projects', [
            'title' => 'New API Project',
            'description' => 'Created via JSON API',
            'start_date' => '2026-10-01',
            'end_date' => '2026-12-31',
            'approval_document' => $file,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('project.title', 'New API Project');

        $this->assertDatabaseHas('projects', ['title' => 'New API Project']);
    }

    public function test_admin_cannot_create_project_via_api(): void
    {
        Storage::fake('local');
        $admin = User::factory()->create(['is_admin' => true]);
        $file = UploadedFile::fake()->create('approval.pdf', 500, 'application/pdf');

        $response = $this->actingAs($admin)->postJson('/api/projects', [
            'title' => 'Admin Unauthorized Project',
            'description' => 'Should fail',
            'start_date' => '2026-10-01',
            'end_date' => '2026-12-31',
            'approval_document' => $file,
        ]);

        $response->assertStatus(403);
    }

    public function test_assigned_member_can_view_project_details(): void
    {
        $creator = User::factory()->create();
        $member = User::factory()->create();

        $project = Project::create([
            'title' => 'Team Collaboration Project',
            'created_by' => $creator->id,
            'status' => Project::STATUS_ACTIVE,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $creator->id,
            'role' => RoleRegistry::ROLE_PROJECT_LEADER,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $member->id,
            'role' => RoleRegistry::ROLE_PROJECT_MEMBER,
        ]);

        $response = $this->actingAs($member)->getJson("/api/projects/{$project->id}");

        $response->assertStatus(200)
            ->assertJsonPath('project.title', 'Team Collaboration Project')
            ->assertJsonPath('project.role', RoleRegistry::ROLE_PROJECT_MEMBER);
    }

    public function test_unassigned_user_is_forbidden_from_viewing_project(): void
    {
        $creator = User::factory()->create();
        $outsider = User::factory()->create();

        $project = Project::create([
            'title' => 'Confidential Project',
            'created_by' => $creator->id,
            'status' => Project::STATUS_ACTIVE,
        ]);

        $response = $this->actingAs($outsider)->getJson("/api/projects/{$project->id}");

        $response->assertStatus(403);
    }

    public function test_project_leader_can_update_project(): void
    {
        $leader = User::factory()->create();
        $project = Project::create([
            'title' => 'Original Title',
            'created_by' => $leader->id,
            'status' => Project::STATUS_PLANNING,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $leader->id,
            'role' => RoleRegistry::ROLE_PROJECT_LEADER,
        ]);

        $response = $this->actingAs($leader)->putJson("/api/projects/{$project->id}", [
            'title' => 'Updated Project Title',
            'description' => 'Updated description',
            'status' => Project::STATUS_ACTIVE,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('project.title', 'Updated Project Title');

        $this->assertEquals('Updated Project Title', $project->fresh()->title);
    }

    public function test_project_leader_can_assign_personnel(): void
    {
        $leader = User::factory()->create();
        $staffMember = User::factory()->create();

        $project = Project::create([
            'title' => 'Staffing Project',
            'created_by' => $leader->id,
            'status' => Project::STATUS_ACTIVE,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $leader->id,
            'role' => RoleRegistry::ROLE_PROJECT_LEADER,
        ]);

        $response = $this->actingAs($leader)->postJson("/api/projects/{$project->id}/personnel", [
            'user_id' => $staffMember->id,
            'role' => RoleRegistry::ROLE_PROJECT_STAFF,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('assignment.role', RoleRegistry::ROLE_PROJECT_STAFF);

        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $staffMember->id,
            'role' => RoleRegistry::ROLE_PROJECT_STAFF,
        ]);
    }

    public function test_project_leader_assignment_cannot_be_altered_or_removed(): void
    {
        $leader = User::factory()->create();

        $project = Project::create([
            'title' => 'Immutable Leadership Project',
            'created_by' => $leader->id,
            'status' => Project::STATUS_ACTIVE,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $leader->id,
            'role' => RoleRegistry::ROLE_PROJECT_LEADER,
        ]);

        $response = $this->actingAs($leader)->deleteJson("/api/projects/{$project->id}/personnel/{$leader->id}");

        $response->assertStatus(403);
    }
}
