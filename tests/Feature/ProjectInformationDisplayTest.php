<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectApprovalDocument;
use App\Models\ProjectRoleAssignment;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ProjectInformationDisplayTest extends TestCase
{
    protected function createVerifiedUser(array $attributes = []): User
    {
        $user = User::create(array_merge([
            'name' => 'Dr. Maria Santos',
            'email' => 'maria.santos_' . uniqid() . '@carsu.edu.ph',
            'password' => 'SecurePass123!',
        ], $attributes));

        $user->forceFill(['email_verified_at' => now()])->save();

        return $user;
    }

    /**
     * 1. Project Detail response contains correct Project Leader and essential project information.
     */
    public function test_project_detail_displays_leader_and_essential_information(): void
    {
        $leader = $this->createVerifiedUser([
            'name' => 'Prof. Juan Dela Cruz',
            'email' => 'juan.delacruz@carsu.edu.ph',
        ]);

        $project = Project::create([
            'title' => 'CCIS Artificial Intelligence Laboratory Setup',
            'description' => 'Comprehensive procurement, setup, and curriculum integration of computing hardware.',
            'status' => Project::STATUS_ACTIVE,
            'start_date' => '2026-10-01',
            'end_date' => '2026-12-15',
            'created_by' => $leader->id,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $leader->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
        ]);

        $response = $this->actingAs($leader)->get("/projects/{$project->id}");

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Projects/Show')
            ->where('project.id', (string) $project->id)
            ->where('project.title', 'CCIS Artificial Intelligence Laboratory Setup')
            ->where('project.description', 'Comprehensive procurement, setup, and curriculum integration of computing hardware.')
            ->where('project.status', Project::STATUS_ACTIVE)
            ->where('project.start_date', 'October 01, 2026')
            ->where('project.end_date', 'December 15, 2026')
            ->where('project.leader.id', $leader->id)
            ->where('project.leader.name', 'Prof. Juan Dela Cruz')
            ->where('project.leader.email', 'juan.delacruz@carsu.edu.ph')
        );
    }

    /**
     * 2. Project Detail handles unassigned Project Leader gracefully without error.
     */
    public function test_project_detail_handles_unassigned_leader_gracefully(): void
    {
        $creator = $this->createVerifiedUser();
        $viewer = $this->createVerifiedUser();

        $project = Project::create([
            'title' => 'Project Without Leader',
            'description' => 'Testing edge case where no leader is assigned.',
            'status' => Project::STATUS_PLANNING,
            'created_by' => $creator->id,
        ]);

        // Assign viewer as staff so they have view permission
        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $viewer->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
        ]);

        $response = $this->actingAs($viewer)->get("/projects/{$project->id}");

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Projects/Show')
            ->where('project.id', (string) $project->id)
            ->where('project.leader', null)
        );
    }

    /**
     * 3. Project Detail handles missing optional dates and description gracefully.
     */
    public function test_project_detail_handles_missing_optional_metadata(): void
    {
        $leader = $this->createVerifiedUser();

        $project = Project::create([
            'title' => 'Minimal Project Without Dates or Description',
            'description' => null,
            'status' => Project::STATUS_PLANNING,
            'start_date' => null,
            'end_date' => null,
            'created_by' => $leader->id,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $leader->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
        ]);

        $response = $this->actingAs($leader)->get("/projects/{$project->id}");

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Projects/Show')
            ->where('project.id', (string) $project->id)
            ->where('project.description', null)
            ->where('project.start_date', null)
            ->where('project.end_date', null)
            ->where('project.leader.name', $leader->name)
        );
    }
}
