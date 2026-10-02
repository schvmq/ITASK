<?php

namespace Tests\Feature;

use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CommitteeMemberAssignmentTest extends TestCase
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
    // 1. Project Member Assignment & Persistence
    // ─────────────────────────────────────────────────────────────────────────────

    public function test_project_leader_can_assign_a_project_member_to_a_committee(): void
    {
        $leader = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);

        $committee = $this->createCommittee($project, ['name' => 'Logistics Committee']);

        $response = $this->actingAs($leader)->post(route('projects.committees.members.store', [$project, $committee]), [
            'user_id' => $member->id,
        ]);

        $response->assertSessionHasNoErrors();
        $response->assertSessionHas('status', 'Member assigned to committee successfully.');

        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $member->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
            'committee_id' => $committee->id,
        ]);
    }

    public function test_the_membership_persists_correctly(): void
    {
        $leader = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);

        $committee = $this->createCommittee($project, ['name' => 'Technical Committee']);

        $this->actingAs($leader)->post(route('projects.committees.members.store', [$project, $committee]), [
            'user_id' => $member->id,
        ])->assertSessionHasNoErrors();

        $fresh = $committee->fresh(['memberAssignments.user']);
        $this->assertCount(1, $fresh->memberAssignments);
        $this->assertEquals($member->id, $fresh->memberAssignments->first()->user_id);
        $this->assertEquals($member->name, $fresh->memberAssignments->first()->user->name);
    }

    public function test_multiple_project_members_can_belong_to_the_same_committee(): void
    {
        $leader = $this->createVerifiedUser();
        $member1 = $this->createVerifiedUser();
        $member2 = $this->createVerifiedUser();
        $member3 = $this->createVerifiedUser();

        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $member1, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);
        $this->assignProjectRole($project, $member2, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);
        $this->assignProjectRole($project, $member3, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);

        $committee = $this->createCommittee($project, ['name' => 'Multi-Member Committee']);

        // Assign Member 1
        $this->actingAs($leader)->post(route('projects.committees.members.store', [$project, $committee]), [
            'user_id' => $member1->id,
        ])->assertSessionHasNoErrors();

        // Assign Member 2
        $this->actingAs($leader)->post(route('projects.committees.members.store', [$project, $committee]), [
            'user_id' => $member2->id,
        ])->assertSessionHasNoErrors();

        // Assign Member 3
        $this->actingAs($leader)->post(route('projects.committees.members.store', [$project, $committee]), [
            'user_id' => $member3->id,
        ])->assertSessionHasNoErrors();

        // Verify all 3 members belong to the same committee
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $member1->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
            'committee_id' => $committee->id,
        ]);
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $member2->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
            'committee_id' => $committee->id,
        ]);
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $member3->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
            'committee_id' => $committee->id,
        ]);

        $this->assertEquals(3, $committee->fresh()->memberAssignments->count());
    }

    public function test_project_leader_can_add_another_member_without_removing_existing_members(): void
    {
        $leader = $this->createVerifiedUser();
        $memberA = $this->createVerifiedUser();
        $memberB = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $this->assignProjectRole($project, $memberA, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);
        $this->assignProjectRole($project, $memberB, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);

        $committee = $this->createCommittee($project, ['name' => 'Program Committee']);

        // First assign Member A
        $this->actingAs($leader)->post(route('projects.committees.members.store', [$project, $committee]), [
            'user_id' => $memberA->id,
        ])->assertSessionHasNoErrors();

        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $memberA->id,
            'committee_id' => $committee->id,
        ]);

        // Next assign Member B
        $this->actingAs($leader)->post(route('projects.committees.members.store', [$project, $committee]), [
            'user_id' => $memberB->id,
        ])->assertSessionHasNoErrors();

        // Member A remains in the committee
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $memberA->id,
            'committee_id' => $committee->id,
        ]);

        // Member B is also in the committee
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $memberB->id,
            'committee_id' => $committee->id,
        ]);

        $this->assertEquals(2, $committee->fresh()->memberAssignments->count());
    }

    public function test_project_leader_can_assign_multiple_members_at_once(): void
    {
        $leader = $this->createVerifiedUser();
        $member1 = $this->createVerifiedUser();
        $member2 = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $this->assignProjectRole($project, $member1, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);
        $this->assignProjectRole($project, $member2, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);

        $committee = $this->createCommittee($project, ['name' => 'Batch Committee']);

        $response = $this->actingAs($leader)->post(route('projects.committees.members.store', [$project, $committee]), [
            'user_ids' => [$member1->id, $member2->id],
        ]);

        $response->assertSessionHasNoErrors();
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $member1->id,
            'committee_id' => $committee->id,
        ]);
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $member2->id,
            'committee_id' => $committee->id,
        ]);
        $this->assertEquals(2, $committee->fresh()->memberAssignments->count());
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. Member Removal Tests
    // ─────────────────────────────────────────────────────────────────────────────

    public function test_project_leader_can_remove_a_member_from_a_committee(): void
    {
        $leader = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $committee = $this->createCommittee($project, ['name' => 'Staging Committee']);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);

        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $member->id,
            'committee_id' => $committee->id,
        ]);

        $response = $this->actingAs($leader)->delete(route('projects.committees.members.destroy', [$project, $committee, $member]));

        $response->assertSessionHasNoErrors();
        $response->assertSessionHas('status', 'Member removed from committee.');

        // Member's committee_id is set to null
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $member->id,
            'committee_id' => null,
        ]);

        $this->assertEquals(0, $committee->fresh()->memberAssignments->count());
    }

    public function test_removing_a_member_does_not_remove_their_project_member_role_from_the_project(): void
    {
        $leader = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $committee = $this->createCommittee($project, ['name' => 'Audio Committee']);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);

        $this->actingAs($leader)->delete(route('projects.committees.members.destroy', [$project, $committee, $member]));

        // The user STILL has their project role assignment on this project
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $member->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
        ]);

        // The user record is not deleted
        $this->assertDatabaseHas('users', [
            'id' => $member->id,
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. Duplicate Prevention
    // ─────────────────────────────────────────────────────────────────────────────

    public function test_duplicate_committee_membership_is_prevented(): void
    {
        $leader = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);

        $committee = $this->createCommittee($project, ['name' => 'Duplicate Prevention Committee']);

        // First assignment succeeds
        $this->actingAs($leader)->post(route('projects.committees.members.store', [$project, $committee]), [
            'user_id' => $member->id,
        ])->assertSessionHasNoErrors();

        // Second assignment to the same committee must fail validation
        $duplicateResponse = $this->actingAs($leader)->post(route('projects.committees.members.store', [$project, $committee]), [
            'user_id' => $member->id,
        ]);

        $duplicateResponse->assertSessionHasErrors(['user_id']);
        $this->assertEquals(1, $committee->fresh()->memberAssignments->count());
    }

    public function test_duplicate_ids_in_batch_assignment_are_prevented_or_deduplicated(): void
    {
        $leader = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);

        $committee = $this->createCommittee($project, ['name' => 'Batch Duplicate Committee']);

        // Submitting duplicate IDs in array
        $response = $this->actingAs($leader)->post(route('projects.committees.members.store', [$project, $committee]), [
            'user_ids' => [$member->id, $member->id],
        ]);

        // Either caught with distinct error or cleanly assigned once
        if ($response->isRedirect() && ! $response->getSession()->has('errors')) {
            $this->assertEquals(1, $committee->fresh()->memberAssignments->count());
        } else {
            $response->assertSessionHasErrors();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 4. Role Scoping & Invalid Assignments
    // ─────────────────────────────────────────────────────────────────────────────

    public function test_a_project_staff_cannot_be_assigned_as_a_project_member(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);

        $committee = $this->createCommittee($project, ['name' => 'Staff Ineligible Committee']);

        $response = $this->actingAs($leader)->post(route('projects.committees.members.store', [$project, $committee]), [
            'user_id' => $staff->id,
        ]);

        $response->assertSessionHasErrors(['user_id']);
        $this->assertEquals(0, $committee->fresh()->memberAssignments->count());
    }

    public function test_a_project_leader_cannot_assign_themselves_as_a_project_member(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommittee($project, ['name' => 'Leader Self Assignment Committee']);

        $response = $this->actingAs($leader)->post(route('projects.committees.members.store', [$project, $committee]), [
            'user_id' => $leader->id,
        ]);

        $response->assertSessionHasErrors(['user_id']);
        $this->assertEquals(0, $committee->fresh()->memberAssignments->count());
    }

    public function test_a_project_member_from_another_project_cannot_be_assigned(): void
    {
        $leaderA = $this->createVerifiedUser();
        $projectA = $this->createProjectWithLeader($leaderA);
        $committeeA = $this->createCommittee($projectA, ['name' => 'Committee In Project A']);

        $leaderB = $this->createVerifiedUser();
        $memberB = $this->createVerifiedUser();
        $projectB = $this->createProjectWithLeader($leaderB);
        $this->assignProjectRole($projectB, $memberB, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);

        $response = $this->actingAs($leaderA)->post(route('projects.committees.members.store', [$projectA, $committeeA]), [
            'user_id' => $memberB->id,
        ]);

        $response->assertSessionHasErrors(['user_id']);
        $this->assertEquals(0, $committeeA->fresh()->memberAssignments->count());
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 5. Authorization Restrictions
    // ─────────────────────────────────────────────────────────────────────────────

    public function test_project_staff_cannot_assign_or_remove_project_members(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $member1 = $this->createVerifiedUser();
        $member2 = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);
        $this->assignProjectRole($project, $member1, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);
        $committee = $this->createCommittee($project, ['name' => 'Restricted Member Committee']);
        $this->assignProjectRole($project, $member2, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);

        // Staff attempts to assign Member 1
        $assignResponse = $this->actingAs($staff)->post(route('projects.committees.members.store', [$project, $committee]), [
            'user_id' => $member1->id,
        ]);
        $assignResponse->assertForbidden();

        // Staff attempts to remove Member 2
        $removeResponse = $this->actingAs($staff)->delete(route('projects.committees.members.destroy', [$project, $committee, $member2]));
        $removeResponse->assertForbidden();

        // Membership remains unchanged
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $member2->id,
            'committee_id' => $committee->id,
        ]);
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $member1->id,
            'committee_id' => null,
        ]);
    }

    public function test_project_members_cannot_assign_or_remove_other_project_members(): void
    {
        $leader = $this->createVerifiedUser();
        $member1 = $this->createVerifiedUser();
        $member2 = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $this->assignProjectRole($project, $member1, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);
        $committee = $this->createCommittee($project, ['name' => 'Member Restricted Committee']);
        $this->assignProjectRole($project, $member2, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);

        // Member 1 attempts to assign another member
        $assignResponse = $this->actingAs($member1)->post(route('projects.committees.members.store', [$project, $committee]), [
            'user_id' => $member1->id,
        ]);
        $assignResponse->assertForbidden();

        // Member 1 attempts to remove Member 2
        $removeResponse = $this->actingAs($member1)->delete(route('projects.committees.members.destroy', [$project, $committee, $member2]));
        $removeResponse->assertForbidden();
    }

    public function test_users_from_another_project_cannot_modify_the_committee_membership(): void
    {
        $leaderA = $this->createVerifiedUser();
        $memberA = $this->createVerifiedUser();
        $projectA = $this->createProjectWithLeader($leaderA);
        $this->assignProjectRole($projectA, $memberA, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);
        $committeeA = $this->createCommittee($projectA, ['name' => 'Project A Committee']);

        $leaderB = $this->createVerifiedUser();
        $projectB = $this->createProjectWithLeader($leaderB);

        $assignResponse = $this->actingAs($leaderB)->post(route('projects.committees.members.store', [$projectA, $committeeA]), [
            'user_id' => $memberA->id,
        ]);
        $assignResponse->assertForbidden();

        // Set memberA in committeeA
        ProjectRoleAssignment::where('project_id', $projectA->id)
            ->where('user_id', $memberA->id)
            ->update(['committee_id' => $committeeA->id]);

        $removeResponse = $this->actingAs($leaderB)->delete(route('projects.committees.members.destroy', [$projectA, $committeeA, $memberA]));
        $removeResponse->assertForbidden();
    }

    public function test_unassigned_users_cannot_perform_member_assignment(): void
    {
        $leader = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $unassigned = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);
        $committee = $this->createCommittee($project, ['name' => 'Unassigned Protected Committee']);

        $assignResponse = $this->actingAs($unassigned)->post(route('projects.committees.members.store', [$project, $committee]), [
            'user_id' => $member->id,
        ]);
        $assignResponse->assertForbidden();
    }

    public function test_guest_cannot_assign_or_remove_members(): void
    {
        $leader = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);
        $committee = $this->createCommittee($project, ['name' => 'Guest Protected Committee']);

        $assignResponse = $this->post(route('projects.committees.members.store', [$project, $committee]), [
            'user_id' => $member->id,
        ]);
        $assignResponse->assertRedirect(route('login'));

        $removeResponse = $this->delete(route('projects.committees.members.destroy', [$project, $committee, $member]));
        $removeResponse->assertRedirect(route('login'));
    }

    public function test_unverified_user_cannot_assign_or_remove_members(): void
    {
        $unverifiedLeader = $this->createUnverifiedUser();
        $member = $this->createVerifiedUser();
        $project = Project::create([
            'title' => 'Unverified Project',
            'status' => Project::STATUS_PLANNING,
            'created_by' => $unverifiedLeader->id,
        ]);
        $this->assignProjectRole($project, $unverifiedLeader, ProjectRoleAssignment::ROLE_PROJECT_LEADER);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);

        $committee = $this->createCommittee($project, ['name' => 'Unverified Committee']);

        $assignResponse = $this->actingAs($unverifiedLeader)->post(route('projects.committees.members.store', [$project, $committee]), [
            'user_id' => $member->id,
        ]);
        $assignResponse->assertRedirect(route('verification.notice'));

        $removeResponse = $this->actingAs($unverifiedLeader)->delete(route('projects.committees.members.destroy', [$project, $committee, $member]));
        $removeResponse->assertRedirect(route('verification.notice'));
    }

    public function test_invalid_requests_do_not_partially_modify_committee_membership(): void
    {
        $leader = $this->createVerifiedUser();
        $validMember = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $validMember, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);
        $committee = $this->createCommittee($project, ['name' => 'Integrity Committee']);

        // Attempting to post an invalid user ID alongside valid user ID in batch
        $response = $this->actingAs($leader)->post(route('projects.committees.members.store', [$project, $committee]), [
            'user_ids' => [$validMember->id, 99999999],
        ]);

        $response->assertSessionHasErrors();

        // Valid member must NOT have been assigned because transaction and validation prevented it
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $validMember->id,
            'committee_id' => null,
        ]);
        $this->assertEquals(0, $committee->fresh()->memberAssignments->count());
    }

    public function test_project_member_can_belong_to_multiple_committees_within_same_project(): void
    {
        $leader = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        // Assign member to project
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);

        $committee1 = $this->createCommittee($project, ['name' => 'Logistics Committee']);
        $committee2 = $this->createCommittee($project, ['name' => 'Marketing Committee']);

        // 1. Assign to Committee 1
        $response1 = $this->actingAs($leader)->post(route('projects.committees.members.store', [$project, $committee1]), [
            'user_id' => $member->id,
        ]);
        $response1->assertRedirect();

        // 2. Assign to Committee 2
        $response2 = $this->actingAs($leader)->post(route('projects.committees.members.store', [$project, $committee2]), [
            'user_id' => $member->id,
        ]);
        $response2->assertRedirect();

        // Verify member belongs to both committees
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $member->id,
            'committee_id' => $committee1->id,
        ]);
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $member->id,
            'committee_id' => $committee2->id,
        ]);

        $this->assertEquals(1, $committee1->fresh()->memberAssignments->count());
        $this->assertEquals(1, $committee2->fresh()->memberAssignments->count());
    }

    public function test_contextual_indicators_appear_for_members_assigned_to_other_committees(): void
    {
        $leader = $this->createVerifiedUser();
        $memberSingle = $this->createVerifiedUser();
        $memberMulti = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $this->assignProjectRole($project, $memberSingle, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);
        $this->assignProjectRole($project, $memberMulti, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);

        $logistics = $this->createCommittee($project, ['name' => 'Logistics']);
        $marketing = $this->createCommittee($project, ['name' => 'Marketing']);
        $finance = $this->createCommittee($project, ['name' => 'Finance']);

        // Assign memberSingle to Logistics
        $this->actingAs($leader)->post(route('projects.committees.members.store', [$project, $logistics]), [
            'user_id' => $memberSingle->id,
        ]);

        // Assign memberMulti to Logistics and Marketing
        $this->actingAs($leader)->post(route('projects.committees.members.store', [$project, $logistics]), [
            'user_id' => $memberMulti->id,
        ]);
        $this->actingAs($leader)->post(route('projects.committees.members.store', [$project, $marketing]), [
            'user_id' => $memberMulti->id,
        ]);

        // View Finance committee
        $response = $this->actingAs($leader)->get(route('projects.committees.show', [$project, $finance]));
        $response->assertStatus(200);

        $response->assertInertia(fn (Assert $page) => $page
            ->component('Committees/Show')
            ->has('availableMembers', 2)
            ->where('availableMembers', function ($members) use ($memberSingle, $memberMulti) {
                $single = collect($members)->firstWhere('id', $memberSingle->id);
                $multi = collect($members)->firstWhere('id', $memberMulti->id);

                return $single['context'] === 'Already assigned to Logistics'
                    && $multi['context'] === 'Currently assigned to 2 other committees';
            })
        );
    }

    public function test_removing_member_from_one_committee_preserves_membership_in_other_committees(): void
    {
        $leader = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);

        $committee1 = $this->createCommittee($project, ['name' => 'Logistics']);
        $committee2 = $this->createCommittee($project, ['name' => 'Marketing']);

        // Assign to both
        $this->actingAs($leader)->post(route('projects.committees.members.store', [$project, $committee1]), [
            'user_id' => $member->id,
        ]);
        $this->actingAs($leader)->post(route('projects.committees.members.store', [$project, $committee2]), [
            'user_id' => $member->id,
        ]);

        // Remove from committee1
        $removeResponse = $this->actingAs($leader)->delete(route('projects.committees.members.destroy', [$project, $committee1, $member]));
        $removeResponse->assertRedirect();

        // Committee 1 membership removed
        $this->assertDatabaseMissing('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $member->id,
            'committee_id' => $committee1->id,
        ]);

        // Committee 2 membership strictly preserved!
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $member->id,
            'committee_id' => $committee2->id,
        ]);
    }
}
