<?php

namespace Tests\Feature;

use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommitteeManagementTest extends TestCase
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
     * Helper to create a committee within a project with an assigned Project Staff head.
     */
    protected function createCommitteeWithHead(Project $project, User $staffHead, array $attributes = []): Committee
    {
        $committee = Committee::create(array_merge([
            'project_id' => $project->id,
            'name' => 'Test Committee ' . uniqid(),
            'description' => 'A test committee description.',
        ], $attributes));

        // Ensure the staff member has a role assignment pointing to this committee
        $assignment = ProjectRoleAssignment::where('project_id', $project->id)
            ->where('user_id', $staffHead->id)
            ->first();

        if ($assignment) {
            $assignment->update([
                'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
                'committee_id' => $committee->id,
            ]);
        } else {
            ProjectRoleAssignment::create([
                'project_id' => $project->id,
                'user_id' => $staffHead->id,
                'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
                'committee_id' => $committee->id,
            ]);
        }

        return $committee;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // PROJECT STAFF ELIGIBILITY (Tests 1–3)
    // ─────────────────────────────────────────────────────────────────────────────

    public function test_project_leader_can_select_an_assigned_project_staff_member_as_committee_head(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);

        $response = $this->actingAs($leader)->post(route('projects.committees.store', $project), [
            'name' => 'Logistics Committee',
            'description' => 'Handles logistics and physical equipment.',
            'user_id' => $staff->id,
        ]);

        $response->assertSessionHasNoErrors();
        $this->assertDatabaseHas('committees', [
            'project_id' => $project->id,
            'name' => 'Logistics Committee',
        ]);

        $committee = Committee::where('project_id', $project->id)->where('name', 'Logistics Committee')->first();
        $this->assertNotNull($committee);

        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $staff->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
            'committee_id' => $committee->id,
        ]);
    }

    public function test_user_from_another_project_cannot_be_selected_as_committee_head(): void
    {
        $leader = $this->createVerifiedUser();
        $projectA = $this->createProjectWithLeader($leader);

        $otherLeader = $this->createVerifiedUser();
        $projectB = $this->createProjectWithLeader($otherLeader);
        $staffProjectB = $this->createVerifiedUser();
        $this->assignProjectRole($projectB, $staffProjectB, ProjectRoleAssignment::ROLE_PROJECT_STAFF);

        $response = $this->actingAs($leader)->post(route('projects.committees.store', $projectA), [
            'name' => 'Invalid Head Committee',
            'description' => 'Attempting to assign staff from another project.',
            'user_id' => $staffProjectB->id,
        ]);

        $response->assertSessionHasErrors(['user_id']);
        $this->assertDatabaseMissing('committees', [
            'project_id' => $projectA->id,
            'name' => 'Invalid Head Committee',
        ]);
    }

    public function test_project_member_cannot_be_selected_as_committee_head_unless_project_role_is_explicitly_changed(): void
    {
        $leader = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);

        // Attempting to select Project Member as committee head must fail validation
        $response = $this->actingAs($leader)->post(route('projects.committees.store', $project), [
            'name' => 'Member As Head Committee',
            'user_id' => $member->id,
        ]);

        $response->assertSessionHasErrors(['user_id']);
        $this->assertDatabaseMissing('committees', [
            'project_id' => $project->id,
            'name' => 'Member As Head Committee',
        ]);

        // Explicitly promote the user to Project Staff on the project
        ProjectRoleAssignment::where('project_id', $project->id)
            ->where('user_id', $member->id)
            ->update(['role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF]);

        // Now creating committee with this promoted staff should succeed
        $validResponse = $this->actingAs($leader)->post(route('projects.committees.store', $project), [
            'name' => 'Member As Head Committee',
            'user_id' => $member->id,
        ]);

        $validResponse->assertSessionHasNoErrors();
        $this->assertDatabaseHas('committees', [
            'project_id' => $project->id,
            'name' => 'Member As Head Committee',
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // COMMITTEE CREATION & AUTHORIZATION (Tests 4–10)
    // ─────────────────────────────────────────────────────────────────────────────

    public function test_project_leader_can_create_a_committee(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);

        $response = $this->actingAs($leader)->post(route('projects.committees.store', $project), [
            'name' => 'Technical Committee',
            'description' => 'Oversees audio/visual setup.',
            'user_id' => $staff->id,
        ]);

        $response->assertRedirect(route('projects.show', $project));
        $this->assertDatabaseHas('committees', [
            'project_id' => $project->id,
            'name' => 'Technical Committee',
            'description' => 'Oversees audio/visual setup.',
        ]);
    }

    public function test_project_staff_cannot_create_a_committee(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);

        $response = $this->actingAs($staff)->post(route('projects.committees.store', $project), [
            'name' => 'Unauthorized Staff Committee',
            'user_id' => $staff->id,
        ]);

        $response->assertForbidden();
        $this->assertDatabaseMissing('committees', [
            'name' => 'Unauthorized Staff Committee',
        ]);
    }

    public function test_project_member_cannot_create_a_committee(): void
    {
        $leader = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);

        $response = $this->actingAs($member)->post(route('projects.committees.store', $project), [
            'name' => 'Unauthorized Member Committee',
            'user_id' => $member->id,
        ]);

        $response->assertForbidden();
        $this->assertDatabaseMissing('committees', [
            'name' => 'Unauthorized Member Committee',
        ]);
    }

    public function test_unassigned_user_cannot_create_a_committee(): void
    {
        $leader = $this->createVerifiedUser();
        $unassigned = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);

        $response = $this->actingAs($unassigned)->post(route('projects.committees.store', $project), [
            'name' => 'Unassigned User Committee',
            'user_id' => $staff->id,
        ]);

        $response->assertForbidden();
        $this->assertDatabaseMissing('committees', [
            'name' => 'Unassigned User Committee',
        ]);
    }

    public function test_guest_cannot_create_a_committee(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);

        $response = $this->post(route('projects.committees.store', $project), [
            'name' => 'Guest Committee',
            'user_id' => $staff->id,
        ]);

        $response->assertRedirect(route('login'));
        $this->assertDatabaseMissing('committees', [
            'name' => 'Guest Committee',
        ]);
    }

    public function test_unverified_user_cannot_create_a_committee(): void
    {
        $unverifiedLeader = $this->createUnverifiedUser();
        $project = Project::create([
            'title' => 'Unverified Project',
            'status' => Project::STATUS_PLANNING,
            'created_by' => $unverifiedLeader->id,
        ]);
        $this->assignProjectRole($project, $unverifiedLeader, ProjectRoleAssignment::ROLE_PROJECT_LEADER);

        $staff = $this->createVerifiedUser();
        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);

        $response = $this->actingAs($unverifiedLeader)->post(route('projects.committees.store', $project), [
            'name' => 'Unverified Committee',
            'user_id' => $staff->id,
        ]);

        $response->assertRedirect(route('verification.notice'));
        $this->assertDatabaseMissing('committees', [
            'name' => 'Unverified Committee',
        ]);
    }

    public function test_committee_must_belong_to_the_requested_project(): void
    {
        $leaderA = $this->createVerifiedUser();
        $projectA = $this->createProjectWithLeader($leaderA);
        $staffA = $this->createVerifiedUser();
        $this->assignProjectRole($projectA, $staffA, ProjectRoleAssignment::ROLE_PROJECT_STAFF);

        $response = $this->actingAs($leaderA)->post(route('projects.committees.store', $projectA), [
            'name' => 'Project A Committee',
            'user_id' => $staffA->id,
        ]);

        $response->assertSessionHasNoErrors();
        $committee = Committee::where('name', 'Project A Committee')->first();
        $this->assertNotNull($committee);
        $this->assertEquals($projectA->id, $committee->project_id);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // MEMBERS ASSIGNMENT & SCOPING (Tests 11–14)
    // ─────────────────────────────────────────────────────────────────────────────

    public function test_project_leader_can_assign_an_assigned_project_member_to_a_committee(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);

        $committee = $this->createCommitteeWithHead($project, $staff, ['name' => 'Logistics']);

        $response = $this->actingAs($leader)->post(route('projects.committees.members.store', [$project, $committee]), [
            'user_id' => $member->id,
        ]);

        $response->assertSessionHasNoErrors();
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $member->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
            'committee_id' => $committee->id,
        ]);
    }

    public function test_user_from_another_project_cannot_be_assigned_as_a_committee_member(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $projectA = $this->createProjectWithLeader($leader);
        $committeeA = $this->createCommitteeWithHead($projectA, $staff);

        $otherLeader = $this->createVerifiedUser();
        $projectB = $this->createProjectWithLeader($otherLeader);
        $memberProjectB = $this->createVerifiedUser();
        $this->assignProjectRole($projectB, $memberProjectB, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);

        $response = $this->actingAs($leader)->post(route('projects.committees.members.store', [$projectA, $committeeA]), [
            'user_id' => $memberProjectB->id,
        ]);

        $response->assertSessionHasErrors(['user_id']);
    }

    public function test_unassigned_user_cannot_be_assigned_as_a_committee_member(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommitteeWithHead($project, $staff);

        $unassignedUser = $this->createVerifiedUser();

        $response = $this->actingAs($leader)->post(route('projects.committees.members.store', [$project, $committee]), [
            'user_id' => $unassignedUser->id,
        ]);

        $response->assertSessionHasErrors(['user_id']);
    }

    public function test_duplicate_committee_membership_is_rejected_or_prevented(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);

        $committee = $this->createCommitteeWithHead($project, $staff);

        // First assignment succeeds
        $this->actingAs($leader)->post(route('projects.committees.members.store', [$project, $committee]), [
            'user_id' => $member->id,
        ])->assertSessionHasNoErrors();

        // Second assignment to the same committee must fail validation
        $duplicateResponse = $this->actingAs($leader)->post(route('projects.committees.members.store', [$project, $committee]), [
            'user_id' => $member->id,
        ]);

        $duplicateResponse->assertSessionHasErrors(['user_id']);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // COMMITTEE VIEWING & ACCESS (Tests 15–18)
    // ─────────────────────────────────────────────────────────────────────────────

    public function test_project_staff_assigned_to_the_committee_can_view_the_committee(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommitteeWithHead($project, $staff);

        $response = $this->actingAs($staff)->get(route('projects.committees.show', [$project, $committee]));
        $response->assertOk();
    }

    public function test_project_member_assigned_to_the_committee_can_view_the_committee(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);
        $committee = $this->createCommitteeWithHead($project, $staff);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);

        $response = $this->actingAs($member)->get(route('projects.committees.show', [$project, $committee]));
        $response->assertOk();
    }

    public function test_project_member_assigned_to_another_committee_cannot_access_unauthorized_committee_data(): void
    {
        $leader = $this->createVerifiedUser();
        $staff1 = $this->createVerifiedUser();
        $staff2 = $this->createVerifiedUser();
        $memberCommittee1 = $this->createVerifiedUser();

        $project = $this->createProjectWithLeader($leader);
        $committee1 = $this->createCommitteeWithHead($project, $staff1, ['name' => 'Committee 1']);
        $committee2 = $this->createCommitteeWithHead($project, $staff2, ['name' => 'Committee 2']);

        $this->assignProjectRole($project, $memberCommittee1, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee1->id);

        $response = $this->actingAs($memberCommittee1)->get(route('projects.committees.show', [$project, $committee2]));
        $response->assertForbidden();
    }

    public function test_unassigned_project_user_cannot_access_committee_data(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $unassignedUser = $this->createVerifiedUser();

        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommitteeWithHead($project, $staff);

        $response = $this->actingAs($unassignedUser)->get(route('projects.committees.show', [$project, $committee]));
        $response->assertForbidden();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // SECURITY CHECKS & ID MANIPULATION (Step 15)
    // ─────────────────────────────────────────────────────────────────────────────

    public function test_leader_of_project_a_cannot_create_committee_in_project_b_via_id_manipulation(): void
    {
        $leaderA = $this->createVerifiedUser();
        $projectA = $this->createProjectWithLeader($leaderA);

        $leaderB = $this->createVerifiedUser();
        $projectB = $this->createProjectWithLeader($leaderB);
        $staffB = $this->createVerifiedUser();
        $this->assignProjectRole($projectB, $staffB, ProjectRoleAssignment::ROLE_PROJECT_STAFF);

        // Leader of Project A attempts to post committee creation to Project B
        $response = $this->actingAs($leaderA)->post(route('projects.committees.store', $projectB), [
            'name' => 'Hijacked Committee',
            'user_id' => $staffB->id,
        ]);

        $response->assertForbidden();
        $this->assertDatabaseMissing('committees', [
            'project_id' => $projectB->id,
            'name' => 'Hijacked Committee',
        ]);
    }

    public function test_user_cannot_assign_themselves_or_others_to_committee_in_project_b_via_id_manipulation(): void
    {
        $leaderA = $this->createVerifiedUser();
        $projectA = $this->createProjectWithLeader($leaderA);

        $leaderB = $this->createVerifiedUser();
        $staffB = $this->createVerifiedUser();
        $projectB = $this->createProjectWithLeader($leaderB);
        $committeeB = $this->createCommitteeWithHead($projectB, $staffB);

        // Leader of Project A attempts to assign someone to Committee B
        $response = $this->actingAs($leaderA)->post(route('projects.committees.members.store', [$projectB, $committeeB]), [
            'user_id' => $leaderA->id,
        ]);

        $response->assertForbidden();
    }

    public function test_project_leader_cannot_be_overwritten_or_removed_via_personnel_assignment(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        // Attempting to demote or reassign Project Leader via personnel store
        $response = $this->actingAs($leader)->post(route('projects.personnel.store', $project), [
            'user_id' => $leader->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
        ]);

        $response->assertSessionHasErrors(['user_id']);

        // Attempting to delete Project Leader via personnel destroy
        $deleteResponse = $this->actingAs($leader)->delete(route('projects.personnel.destroy', [$project, $leader]));
        $deleteResponse->assertForbidden();

        // Project Leader assignment must remain intact
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $leader->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
        ]);
    }

    public function test_project_leader_can_remove_a_committee_member(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);
        $committee = $this->createCommitteeWithHead($project, $staff);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);

        $response = $this->actingAs($leader)->delete(route('projects.committees.members.destroy', [$project, $committee, $member]));

        $response->assertSessionHasNoErrors();
        // Member remains on the project, but committee_id is set to null
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $member->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
            'committee_id' => null,
        ]);
    }

    public function test_project_leader_can_delete_a_committee_preserving_project_roles(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);
        $committee = $this->createCommitteeWithHead($project, $staff);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);

        $response = $this->actingAs($leader)->delete(route('projects.committees.destroy', [$project, $committee]));

        $response->assertRedirect(route('projects.show', $project));
        $this->assertDatabaseMissing('committees', [
            'id' => $committee->id,
        ]);

        // Staff and member remain on project with null committee_id
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $staff->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
            'committee_id' => null,
        ]);

        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $member->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
            'committee_id' => null,
        ]);
    }
}
