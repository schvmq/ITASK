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

    /**
     * 4. Project Detail displays accurate role for Project Leader, Staff, and Member.
     */
    public function test_project_detail_displays_accurate_roles(): void
    {
        $leader = $this->createVerifiedUser(['name' => 'Leader User']);
        $staff = $this->createVerifiedUser(['name' => 'Staff User']);
        $member = $this->createVerifiedUser(['name' => 'Member User']);

        $project = Project::create([
            'title' => 'Multi-Role Test Project',
            'status' => Project::STATUS_PLANNING,
            'created_by' => $leader->id,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $leader->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $staff->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $member->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
        ]);

        // Leader sees 'Project Leader'
        $this->actingAs($leader)->get("/projects/{$project->id}")
            ->assertStatus(200)
            ->assertInertia(fn (Assert $page) => $page
                ->component('Projects/Show')
                ->where('project.role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            );

        // Staff sees 'Project Staff'
        $this->actingAs($staff)->get("/projects/{$project->id}")
            ->assertStatus(200)
            ->assertInertia(fn (Assert $page) => $page
                ->component('Projects/Show')
                ->where('project.role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
            );

        // Member sees 'Project Member'
        $this->actingAs($member)->get("/projects/{$project->id}")
            ->assertStatus(200)
            ->assertInertia(fn (Assert $page) => $page
                ->component('Projects/Show')
                ->where('project.role', ProjectRoleAssignment::ROLE_PROJECT_MEMBER)
            );
    }

    /**
     * 5. User with different roles in different projects sees the correct project-scoped role.
     */
    public function test_user_with_different_roles_in_different_projects_sees_correct_project_scoped_role(): void
    {
        $user = $this->createVerifiedUser(['name' => 'Multi-Project User']);
        $otherUser = $this->createVerifiedUser();

        // Project A: user is Project Leader
        $projectA = Project::create([
            'title' => 'Project Alpha',
            'status' => Project::STATUS_PLANNING,
            'created_by' => $user->id,
        ]);
        ProjectRoleAssignment::create([
            'project_id' => $projectA->id,
            'user_id' => $user->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
        ]);

        // Project B: user is Project Staff
        $projectB = Project::create([
            'title' => 'Project Beta',
            'status' => Project::STATUS_PLANNING,
            'created_by' => $otherUser->id,
        ]);
        ProjectRoleAssignment::create([
            'project_id' => $projectB->id,
            'user_id' => $otherUser->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
        ]);
        ProjectRoleAssignment::create([
            'project_id' => $projectB->id,
            'user_id' => $user->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
        ]);

        // Project C: user is Project Member
        $projectC = Project::create([
            'title' => 'Project Gamma',
            'status' => Project::STATUS_PLANNING,
            'created_by' => $otherUser->id,
        ]);
        ProjectRoleAssignment::create([
            'project_id' => $projectC->id,
            'user_id' => $otherUser->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
        ]);
        ProjectRoleAssignment::create([
            'project_id' => $projectC->id,
            'user_id' => $user->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
        ]);

        // In Project A, user sees 'Project Leader' and has leader management permissions
        $this->actingAs($user)->get("/projects/{$projectA->id}")
            ->assertStatus(200)
            ->assertInertia(fn (Assert $page) => $page
                ->component('Projects/Show')
                ->where('project.role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
                ->where('project.can.createCommittee', true)
                ->where('project.can.update', true)
            );

        // In Project B, user sees 'Project Staff' without leader management permissions
        $this->actingAs($user)->get("/projects/{$projectB->id}")
            ->assertStatus(200)
            ->assertInertia(fn (Assert $page) => $page
                ->component('Projects/Show')
                ->where('project.role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
                ->where('project.can.createCommittee', false)
                ->where('project.can.update', false)
            );

        // In Project C, user sees 'Project Member' without leader management permissions
        $this->actingAs($user)->get("/projects/{$projectC->id}")
            ->assertStatus(200)
            ->assertInertia(fn (Assert $page) => $page
                ->component('Projects/Show')
                ->where('project.role', ProjectRoleAssignment::ROLE_PROJECT_MEMBER)
                ->where('project.can.createCommittee', false)
                ->where('project.can.update', false)
            );
    }

    /**
     * 6. Restricted committee does not expose member roster, head email, or lead name to unassigned members.
     */
    public function test_restricted_committee_does_not_expose_roster_or_lead_to_unassigned_project_member(): void
    {
        $leader = $this->createVerifiedUser();
        $staffMember = $this->createVerifiedUser(['name' => 'Secret Staff Lead']);
        $assignedMember = $this->createVerifiedUser(['name' => 'Assigned Member']);
        $viewerMember = $this->createVerifiedUser(['name' => 'Viewer Member']);

        $project = Project::create([
            'title' => 'Project with Multiple Committees',
            'status' => Project::STATUS_PLANNING,
            'created_by' => $leader->id,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $leader->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
        ]);

        // Committee 1 (Viewer belongs to this)
        $committee1 = $project->committees()->create([
            'name' => 'Viewer Committee',
            'description' => 'Open to viewer.',
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $viewerMember->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
            'committee_id' => $committee1->id,
        ]);

        // Committee 2 (Restricted: viewer does NOT belong to this)
        $committee2 = $project->committees()->create([
            'name' => 'Restricted Committee',
            'description' => 'Closed to viewer.',
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $staffMember->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
            'committee_id' => $committee2->id,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $assignedMember->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
            'committee_id' => $committee2->id,
        ]);

        $response = $this->actingAs($viewerMember)->get("/projects/{$project->id}");

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Projects/Show')
            // Committee 1 is viewable
            ->where('project.committees.0.name', 'Viewer Committee')
            ->where('project.committees.0.can.view', true)
            // Committee 2 is restricted
            ->where('project.committees.1.name', 'Restricted Committee')
            ->where('project.committees.1.can.view', false)
            ->where('project.committees.1.members', [])
            ->where('project.committees.1.head', null)
            ->where('project.committees.1.leadName', null)
        );
    }

    /**
     * 7. Unauthorized user outside project cannot view project details.
     */
    public function test_unauthorized_user_cannot_access_project_details(): void
    {
        $leader = $this->createVerifiedUser();
        $outsider = $this->createVerifiedUser();

        $project = Project::create([
            'title' => 'Confidential Project',
            'status' => Project::STATUS_PLANNING,
            'created_by' => $leader->id,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $leader->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
        ]);

        $response = $this->actingAs($outsider)->get("/projects/{$project->id}");

        $response->assertStatus(403);
    }

    /**
     * 8. Cross-project personnel eligibility remains strictly project-scoped.
     */
    public function test_cross_project_personnel_eligibility_remains_strictly_project_scoped(): void
    {
        $leader = $this->createVerifiedUser(['name' => 'Leader']);
        $staffA = $this->createVerifiedUser(['name' => 'Staff Project A']);
        $memberA = $this->createVerifiedUser(['name' => 'Member Project A']);
        $staffB = $this->createVerifiedUser(['name' => 'Staff Project B']);
        $memberB = $this->createVerifiedUser(['name' => 'Member Project B']);

        // Project A
        $projectA = Project::create([
            'title' => 'Project A',
            'status' => Project::STATUS_PLANNING,
            'created_by' => $leader->id,
        ]);
        ProjectRoleAssignment::create([
            'project_id' => $projectA->id,
            'user_id' => $leader->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
        ]);
        ProjectRoleAssignment::create([
            'project_id' => $projectA->id,
            'user_id' => $staffA->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
        ]);
        ProjectRoleAssignment::create([
            'project_id' => $projectA->id,
            'user_id' => $memberA->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
        ]);

        // Project B
        $projectB = Project::create([
            'title' => 'Project B',
            'status' => Project::STATUS_PLANNING,
            'created_by' => $leader->id,
        ]);
        ProjectRoleAssignment::create([
            'project_id' => $projectB->id,
            'user_id' => $leader->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
        ]);
        ProjectRoleAssignment::create([
            'project_id' => $projectB->id,
            'user_id' => $staffB->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
        ]);
        ProjectRoleAssignment::create([
            'project_id' => $projectB->id,
            'user_id' => $memberB->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
        ]);

        $committeeB = $projectB->committees()->create([
            'name' => 'Committee In Project B',
        ]);

        // View Committee B in Project B
        $response = $this->actingAs($leader)->get("/projects/{$projectB->id}/committees/{$committeeB->id}");

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Committees/Show')
            // Available staff must contain Project B staff and NOT Project A staff
            ->has('availableStaff', 1)
            ->where('availableStaff.0.id', $staffB->id)
            // Available members must contain Project B member and NOT Project A member
            ->has('availableMembers', 1)
            ->where('availableMembers.0.id', $memberB->id)
        );
    }
}


