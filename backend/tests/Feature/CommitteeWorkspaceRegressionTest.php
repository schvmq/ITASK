<?php

namespace Tests\Feature;

use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommitteeWorkspaceRegressionTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_open_committee_workspace_without_relation_error(): void
    {
        $leader = User::factory()->create(['email_verified_at' => now()]);
        $project = Project::create([
            'title' => 'Test Project',
            'description' => 'Test Project Desc',
            'status' => Project::STATUS_PLANNING,
            'created_by' => $leader->id,
        ]);
        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $leader->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
        ]);

        $committee = Committee::create([
            'project_id' => $project->id,
            'name' => 'Test Committee',
            'description' => 'A test committee',
        ]);

        // Add an available member in project who is not yet in committee
        $member = User::factory()->create(['email_verified_at' => now()]);
        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $member->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
        ]);

        $response = $this->actingAs($leader)->get("/projects/{$project->id}/committees/{$committee->id}");

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Committees/Show')
            ->has('committee')
            ->where('committee.id', (string) $committee->id)
            ->where('committee.name', 'Test Committee')
            ->has('availableMembers', 1)
            ->where('availableMembers.0.id', $member->id)
            ->where('availableMembers.0.has_resume', false)
        );
    }

    public function test_committee_workspace_with_existing_members(): void
    {
        $leader = User::factory()->create(['email_verified_at' => now()]);
        $project = Project::create([
            'title' => 'Test Project',
            'created_by' => $leader->id,
        ]);
        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $leader->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
        ]);

        $committee = Committee::create([
            'project_id' => $project->id,
            'name' => 'Food Committee',
        ]);

        $staff = User::factory()->create(['email_verified_at' => now()]);
        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $staff->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
            'committee_id' => $committee->id,
        ]);

        $member = User::factory()->create(['email_verified_at' => now()]);
        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $member->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
            'committee_id' => $committee->id,
        ]);

        $response = $this->actingAs($leader)->get("/projects/{$project->id}/committees/{$committee->id}");

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Committees/Show')
            ->where('committee.name', 'Food Committee')
            ->has('committee.members', 1)
        );
    }
}
