<?php

namespace Tests\Feature;

use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommitteeStaffAssignmentTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Helper to create a verified user.
     */
    protected function createVerifiedUser(array $attributes = []): User
    {
        $user = User::create(array_merge([
            'name' => 'Verified User ' . uniqid(),
            'email' => 'user_' . uniqid() . '@carsu.edu.ph',
            'password' => 'SecurePass123!',
        ], $attributes));

        $user->forceFill(['email_verified_at' => now()])->save();

        return $user;
    }

    /**
     * Helper to create an unverified user.
     */
    protected function createUnverifiedUser(array $attributes = []): User
    {
        return User::create(array_merge([
            'name' => 'Unverified User ' . uniqid(),
            'email' => 'unverified_' . uniqid() . '@carsu.edu.ph',
            'password' => 'SecurePass123!',
        ], $attributes));
    }

    /**
     * Helper to create a project with its initial Project Leader assignment.
     */
    protected function createProjectWithLeader(User $leader, array $attributes = []): Project
    {
        $project = Project::create(array_merge([
            'title' => 'Project ' . uniqid(),
            'description' => 'Test project description.',
            'status' => Project::STATUS_PLANNING,
            'created_by' => $leader->id,
        ], $attributes));

        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $leader->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
            'committee_id' => null,
        ]);

        return $project;
    }

    /**
     * Helper to assign a role to a user on a project.
     */
    protected function assignProjectRole(Project $project, User $user, string $role, ?int $committeeId = null): ProjectRoleAssignment
    {
        return ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $user->id,
            'role' => $role,
            'committee_id' => $committeeId,
        ]);
    }

    /**
     * Helper to create a committee within a project.
     */
    protected function createCommittee(Project $project, array $attributes = []): Committee
    {
        return Committee::create(array_merge([
            'project_id' => $project->id,
            'name' => 'Test Committee ' . uniqid(),
            'description' => 'A test committee description.',
        ], $attributes));
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 1. Staff Assignment & Persistence Tests
    // ─────────────────────────────────────────────────────────────────────────────

    public function test_project_leader_can_assign_an_eligible_project_staff_to_a_committee(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);

        $committee = $this->createCommittee($project, ['name' => 'Logistics Committee']);

        $response = $this->actingAs($leader)->patch(route('projects.committees.update', [$project, $committee]), [
            'name' => 'Logistics Committee',
            'user_id' => $staff->id,
        ]);

        $response->assertSessionHasNoErrors();
        $response->assertSessionHas('status', 'Committee updated successfully.');

        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $staff->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
            'committee_id' => $committee->id,
        ]);
    }

    public function test_the_assignment_persists_correctly(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);

        $committee = $this->createCommittee($project, ['name' => 'Technical Committee']);

        $this->actingAs($leader)->patch(route('projects.committees.update', [$project, $committee]), [
            'user_id' => $staff->id,
        ])->assertSessionHasNoErrors();

        // Fresh model check
        $freshCommittee = $committee->fresh(['staffAssignment.user']);
        $this->assertNotNull($freshCommittee->staffAssignment);
        $this->assertEquals($staff->id, $freshCommittee->staffAssignment->user_id);
        $this->assertEquals($staff->name, $freshCommittee->staffAssignment->user->name);
    }

    public function test_the_assigned_staff_is_associated_with_the_correct_committee_and_project(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);

        $committee = $this->createCommittee($project, ['name' => 'Finance Committee']);

        $this->actingAs($leader)->patch(route('projects.committees.update', [$project, $committee]), [
            'user_id' => $staff->id,
        ])->assertSessionHasNoErrors();

        $assignment = ProjectRoleAssignment::where('project_id', $project->id)
            ->where('user_id', $staff->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
            ->first();

        $this->assertNotNull($assignment);
        $this->assertEquals($project->id, $assignment->project_id);
        $this->assertEquals($committee->id, $assignment->committee_id);
        $this->assertEquals($committee->project_id, $assignment->project_id);
    }

    public function test_project_leader_can_change_the_assigned_staff(): void
    {
        $leader = $this->createVerifiedUser();
        $staffA = $this->createVerifiedUser();
        $staffB = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        // Assign Staff A initially
        $this->assignProjectRole($project, $staffA, ProjectRoleAssignment::ROLE_PROJECT_STAFF);
        $this->assignProjectRole($project, $staffB, ProjectRoleAssignment::ROLE_PROJECT_STAFF);

        $committee = $this->createCommittee($project, ['name' => 'Program Committee']);

        // First assignment: Staff A
        $this->actingAs($leader)->patch(route('projects.committees.update', [$project, $committee]), [
            'user_id' => $staffA->id,
        ])->assertSessionHasNoErrors();

        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $staffA->id,
            'committee_id' => $committee->id,
        ]);

        // Second assignment: Change to Staff B
        $this->actingAs($leader)->patch(route('projects.committees.update', [$project, $committee]), [
            'user_id' => $staffB->id,
        ])->assertSessionHasNoErrors();

        // Staff B is now head of committee
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $staffB->id,
            'committee_id' => $committee->id,
        ]);

        // Staff A is unlinked from the committee head
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $staffA->id,
            'committee_id' => null,
        ]);
    }

    public function test_project_leader_can_leave_a_committee_unassigned(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommittee($project, ['name' => 'Decorations Committee']);

        // Initially assign staff head
        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF, $committee->id);

        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $staff->id,
            'committee_id' => $committee->id,
        ]);

        // Unassign staff head by passing null / empty user_id
        $response = $this->actingAs($leader)->patch(route('projects.committees.update', [$project, $committee]), [
            'user_id' => null,
        ]);

        $response->assertSessionHasNoErrors();

        // Staff member's committee_id is set to null
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $staff->id,
            'committee_id' => null,
        ]);

        // Committee has no staff assignment
        $this->assertNull($committee->fresh()->staffAssignment);
    }

    public function test_dedicated_staff_assignment_route_works(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);

        $committee = $this->createCommittee($project, ['name' => 'Audio Visual Committee']);

        $response = $this->actingAs($leader)->post(route('projects.committees.staff.store', [$project, $committee]), [
            'user_id' => $staff->id,
        ]);

        $response->assertSessionHasNoErrors();
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $staff->id,
            'committee_id' => $committee->id,
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. Authorization Restrictions
    // ─────────────────────────────────────────────────────────────────────────────

    public function test_project_staff_cannot_assign_or_change_committee_staff(): void
    {
        $leader = $this->createVerifiedUser();
        $staff1 = $this->createVerifiedUser();
        $staff2 = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $this->assignProjectRole($project, $staff1, ProjectRoleAssignment::ROLE_PROJECT_STAFF);
        $this->assignProjectRole($project, $staff2, ProjectRoleAssignment::ROLE_PROJECT_STAFF);

        $committee = $this->createCommittee($project, ['name' => 'Restricted Committee']);

        $response = $this->actingAs($staff1)->patch(route('projects.committees.update', [$project, $committee]), [
            'user_id' => $staff2->id,
        ]);

        $response->assertForbidden();
        $this->assertDatabaseMissing('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $staff2->id,
            'committee_id' => $committee->id,
        ]);
    }

    public function test_project_member_cannot_assign_or_change_committee_staff(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);

        $committee = $this->createCommittee($project, ['name' => 'Member Restricted Committee']);

        $response = $this->actingAs($member)->patch(route('projects.committees.update', [$project, $committee]), [
            'user_id' => $staff->id,
        ]);

        $response->assertForbidden();
        $this->assertDatabaseMissing('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $staff->id,
            'committee_id' => $committee->id,
        ]);
    }

    public function test_user_from_another_project_cannot_assign_staff_to_the_committee(): void
    {
        $leaderA = $this->createVerifiedUser();
        $staffA = $this->createVerifiedUser();
        $projectA = $this->createProjectWithLeader($leaderA);
        $this->assignProjectRole($projectA, $staffA, ProjectRoleAssignment::ROLE_PROJECT_STAFF);
        $committeeA = $this->createCommittee($projectA, ['name' => 'Project A Committee']);

        $leaderB = $this->createVerifiedUser();
        $projectB = $this->createProjectWithLeader($leaderB);

        $response = $this->actingAs($leaderB)->patch(route('projects.committees.update', [$projectA, $committeeA]), [
            'user_id' => $staffA->id,
        ]);

        $response->assertForbidden();
        $this->assertDatabaseMissing('project_role_assignments', [
            'project_id' => $projectA->id,
            'user_id' => $staffA->id,
            'committee_id' => $committeeA->id,
        ]);
    }

    public function test_unassigned_user_cannot_assign_or_change_committee_staff(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $unassigned = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);
        $committee = $this->createCommittee($project, ['name' => 'Unassigned Restricted Committee']);

        $response = $this->actingAs($unassigned)->patch(route('projects.committees.update', [$project, $committee]), [
            'user_id' => $staff->id,
        ]);

        $response->assertForbidden();
    }

    public function test_guest_cannot_assign_or_change_committee_staff(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);
        $committee = $this->createCommittee($project, ['name' => 'Guest Restricted Committee']);

        $response = $this->patch(route('projects.committees.update', [$project, $committee]), [
            'user_id' => $staff->id,
        ]);

        $response->assertRedirect(route('login'));
    }

    public function test_unverified_user_cannot_assign_or_change_committee_staff(): void
    {
        $unverifiedLeader = $this->createUnverifiedUser();
        $staff = $this->createVerifiedUser();
        $project = Project::create([
            'title' => 'Unverified Project',
            'status' => Project::STATUS_PLANNING,
            'created_by' => $unverifiedLeader->id,
        ]);
        $this->assignProjectRole($project, $unverifiedLeader, ProjectRoleAssignment::ROLE_PROJECT_LEADER);
        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);

        $committee = $this->createCommittee($project, ['name' => 'Unverified Test Committee']);

        $response = $this->actingAs($unverifiedLeader)->patch(route('projects.committees.update', [$project, $committee]), [
            'user_id' => $staff->id,
        ]);

        $response->assertRedirect(route('verification.notice'));
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. Project Scoping & Invalid Role Assignment Restrictions
    // ─────────────────────────────────────────────────────────────────────────────

    public function test_project_staff_from_another_project_cannot_be_assigned(): void
    {
        $leaderA = $this->createVerifiedUser();
        $projectA = $this->createProjectWithLeader($leaderA);
        $committeeA = $this->createCommittee($projectA, ['name' => 'Committee In Project A']);

        $leaderB = $this->createVerifiedUser();
        $staffB = $this->createVerifiedUser();
        $projectB = $this->createProjectWithLeader($leaderB);
        $this->assignProjectRole($projectB, $staffB, ProjectRoleAssignment::ROLE_PROJECT_STAFF);

        // Leader of Project A attempts to assign Staff B (who belongs to Project B) to Committee A
        $response = $this->actingAs($leaderA)->patch(route('projects.committees.update', [$projectA, $committeeA]), [
            'user_id' => $staffB->id,
        ]);

        $response->assertSessionHasErrors(['user_id']);
        $this->assertDatabaseMissing('project_role_assignments', [
            'project_id' => $projectA->id,
            'user_id' => $staffB->id,
        ]);
        $this->assertNull($committeeA->fresh()->staffAssignment);
    }

    public function test_project_member_cannot_be_assigned_as_committee_staff(): void
    {
        $leader = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);

        $committee = $this->createCommittee($project, ['name' => 'Member Test Committee']);

        // Leader attempts to assign a Project Member as Committee Staff head
        $response = $this->actingAs($leader)->patch(route('projects.committees.update', [$project, $committee]), [
            'user_id' => $member->id,
        ]);

        $response->assertSessionHasErrors(['user_id']);
        $this->assertDatabaseMissing('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $member->id,
            'committee_id' => $committee->id,
        ]);
        $this->assertNull($committee->fresh()->staffAssignment);
    }

    public function test_validation_errors_do_not_corrupt_or_partially_modify_the_assignment(): void
    {
        $leader = $this->createVerifiedUser();
        $staffValid = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommittee($project, ['name' => 'Intact Committee']);

        // Establish initial valid assignment
        $this->assignProjectRole($project, $staffValid, ProjectRoleAssignment::ROLE_PROJECT_STAFF, $committee->id);

        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $staffValid->id,
            'committee_id' => $committee->id,
        ]);

        // Attempt invalid update with non-existent user_id and empty name
        $response = $this->actingAs($leader)->patch(route('projects.committees.update', [$project, $committee]), [
            'name' => '',
            'user_id' => 9999999,
        ]);

        $response->assertSessionHasErrors(['name', 'user_id']);

        // Verify original assignment remains intact
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $staffValid->id,
            'committee_id' => $committee->id,
        ]);

        $fresh = $committee->fresh();
        $this->assertEquals('Intact Committee', $fresh->name);
        $this->assertEquals($staffValid->id, $fresh->staffAssignment->user_id);
    }
}
