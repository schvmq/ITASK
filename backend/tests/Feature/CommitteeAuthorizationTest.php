<?php

namespace Tests\Feature;

use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommitteeAuthorizationTest extends TestCase
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
     * Helper to create a committee under a project.
     */
    protected function createCommittee(Project $project, array $attributes = []): Committee
    {
        return $project->committees()->create(array_merge([
            'name' => 'Committee ' . uniqid(),
            'description' => 'Committee description.',
        ], $attributes));
    }

    // ─── 1. Project Leader Access ──────────────────────────────────────────

    public function test_project_leader_can_access_their_projects_committees(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommittee($project);

        $response = $this->actingAs($leader)->get("/projects/{$project->id}/committees/{$committee->id}");

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page
            ->component('Committees/Show')
            ->where('committee.id', (string) $committee->id)
            ->where('committee.can.update', true)
            ->where('committee.can.delete', true)
            ->where('committee.can.manageMembers', true)
        );
    }

    public function test_project_leader_can_manage_committees_in_their_own_project(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);

        // 1. Create committee
        $createResponse = $this->actingAs($leader)->post("/projects/{$project->id}/committees", [
            'name' => 'Logistics Committee',
            'description' => 'Handles logistics.',
        ]);
        $createResponse->assertRedirect();
        $committee = Committee::where('name', 'Logistics Committee')->firstOrFail();

        // 2. Edit committee & assign staff
        $editResponse = $this->actingAs($leader)->patch("/projects/{$project->id}/committees/{$committee->id}", [
            'name' => 'Logistics & Operations Committee',
            'description' => 'Updated description.',
            'user_id' => $staff->id,
        ]);
        $editResponse->assertRedirect();
        $this->assertDatabaseHas('committees', [
            'id' => $committee->id,
            'name' => 'Logistics & Operations Committee',
        ]);
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $staff->id,
            'committee_id' => $committee->id,
        ]);

        // 3. Assign member
        $assignMemberResponse = $this->actingAs($leader)->post("/projects/{$project->id}/committees/{$committee->id}/members", [
            'user_id' => $member->id,
        ]);
        $assignMemberResponse->assertRedirect();
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $member->id,
            'committee_id' => $committee->id,
        ]);

        // 4. Remove member
        $removeMemberResponse = $this->actingAs($leader)->delete("/projects/{$project->id}/committees/{$committee->id}/members/{$member->id}");
        $removeMemberResponse->assertRedirect();
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $member->id,
            'committee_id' => null,
        ]);

        // 5. Delete committee
        $deleteResponse = $this->actingAs($leader)->delete("/projects/{$project->id}/committees/{$committee->id}");
        $deleteResponse->assertRedirect();
        $this->assertDatabaseMissing('committees', ['id' => $committee->id]);
    }

    public function test_project_leader_cannot_manage_committees_in_another_project(): void
    {
        $leaderA = $this->createVerifiedUser();
        $projectA = $this->createProjectWithLeader($leaderA);

        $leaderB = $this->createVerifiedUser();
        $projectB = $this->createProjectWithLeader($leaderB);
        $committeeB = $this->createCommittee($projectB);

        // Leader A attempts to access Committee B
        $viewResponse = $this->actingAs($leaderA)->get("/projects/{$projectB->id}/committees/{$committeeB->id}");
        $viewResponse->assertStatus(403);

        // Leader A attempts to update Committee B
        $updateResponse = $this->actingAs($leaderA)->patch("/projects/{$projectB->id}/committees/{$committeeB->id}", [
            'name' => 'Hacked Name',
        ]);
        $updateResponse->assertStatus(403);

        // Leader A attempts to delete Committee B
        $deleteResponse = $this->actingAs($leaderA)->delete("/projects/{$projectB->id}/committees/{$committeeB->id}");
        $deleteResponse->assertStatus(403);

        // Leader A attempts to create committee in Project B
        $createResponse = $this->actingAs($leaderA)->post("/projects/{$projectB->id}/committees", [
            'name' => 'Unauthorized Committee',
        ]);
        $createResponse->assertStatus(403);
    }

    // ─── 2. Project Staff Access ───────────────────────────────────────────

    public function test_assigned_committee_staff_can_access_their_assigned_committee(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommittee($project);
        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF, $committee->id);

        $response = $this->actingAs($staff)->get("/projects/{$project->id}/committees/{$committee->id}");

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page
            ->component('Committees/Show')
            ->where('committee.id', (string) $committee->id)
            ->where('committee.can.update', false)
            ->where('committee.can.delete', false)
            ->where('committee.can.manageMembers', false)
        );
    }

    public function test_staff_cannot_access_another_committee_as_staff(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committeeA = $this->createCommittee($project, ['name' => 'Committee A']);
        $committeeB = $this->createCommittee($project, ['name' => 'Committee B']);

        // Staff is assigned only to Committee A
        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF, $committeeA->id);

        // Accessing Committee B must return 403 Forbidden
        $response = $this->actingAs($staff)->get("/projects/{$project->id}/committees/{$committeeB->id}");
        $response->assertStatus(403);
    }

    public function test_staff_cannot_manage_committee_membership(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommittee($project);
        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF, $committee->id);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);

        // Staff attempts to assign a member to their committee
        $assignResponse = $this->actingAs($staff)->post("/projects/{$project->id}/committees/{$committee->id}/members", [
            'user_id' => $member->id,
        ]);
        $assignResponse->assertStatus(403);

        // Leader assigns the member
        ProjectRoleAssignment::where('project_id', $project->id)
            ->where('user_id', $member->id)
            ->update(['committee_id' => $committee->id]);

        // Staff attempts to remove the member
        $removeResponse = $this->actingAs($staff)->delete("/projects/{$project->id}/committees/{$committee->id}/members/{$member->id}");
        $removeResponse->assertStatus(403);
    }

    public function test_staff_cannot_assign_or_change_committee_staff(): void
    {
        $leader = $this->createVerifiedUser();
        $staff1 = $this->createVerifiedUser();
        $staff2 = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommittee($project);
        $this->assignProjectRole($project, $staff1, ProjectRoleAssignment::ROLE_PROJECT_STAFF, $committee->id);
        $this->assignProjectRole($project, $staff2, ProjectRoleAssignment::ROLE_PROJECT_STAFF);

        $response = $this->actingAs($staff1)->post("/projects/{$project->id}/committees/{$committee->id}/staff", [
            'user_id' => $staff2->id,
        ]);

        $response->assertStatus(403);
    }

    public function test_staff_cannot_create_or_edit_committees(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommittee($project);
        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF, $committee->id);

        // Create attempt
        $createResponse = $this->actingAs($staff)->post("/projects/{$project->id}/committees", [
            'name' => 'Staff Created Committee',
        ]);
        $createResponse->assertStatus(403);

        // Edit attempt
        $editResponse = $this->actingAs($staff)->patch("/projects/{$project->id}/committees/{$committee->id}", [
            'name' => 'Staff Edited Name',
        ]);
        $editResponse->assertStatus(403);

        // Delete attempt
        $deleteResponse = $this->actingAs($staff)->delete("/projects/{$project->id}/committees/{$committee->id}");
        $deleteResponse->assertStatus(403);
    }

    // ─── 3. Project Member Access ──────────────────────────────────────────

    public function test_assigned_project_member_can_access_their_assigned_committee(): void
    {
        $leader = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommittee($project);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);

        $response = $this->actingAs($member)->get("/projects/{$project->id}/committees/{$committee->id}");

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page
            ->component('Committees/Show')
            ->where('committee.id', (string) $committee->id)
            ->where('committee.can.update', false)
            ->where('committee.can.delete', false)
            ->where('committee.can.manageMembers', false)
        );
    }

    public function test_member_cannot_access_an_unassigned_committee(): void
    {
        $leader = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committeeA = $this->createCommittee($project, ['name' => 'Assigned Committee']);
        $committeeB = $this->createCommittee($project, ['name' => 'Unassigned Committee']);

        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committeeA->id);

        // Attempting to access unassigned Committee B must fail with 403
        $response = $this->actingAs($member)->get("/projects/{$project->id}/committees/{$committeeB->id}");
        $response->assertStatus(403);
    }

    public function test_unassigned_project_member_cannot_access_any_committee(): void
    {
        $leader = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommittee($project);

        // Assigned to project as member, but committee_id is null
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, null);

        $response = $this->actingAs($member)->get("/projects/{$project->id}/committees/{$committee->id}");
        $response->assertStatus(403);
    }

    public function test_member_cannot_manage_committee_membership(): void
    {
        $leader = $this->createVerifiedUser();
        $member1 = $this->createVerifiedUser();
        $member2 = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommittee($project);
        $this->assignProjectRole($project, $member1, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);
        $this->assignProjectRole($project, $member2, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);

        // Member 1 attempts to add a member
        $assignResponse = $this->actingAs($member1)->post("/projects/{$project->id}/committees/{$committee->id}/members", [
            'user_id' => $member2->id,
        ]);
        $assignResponse->assertStatus(403);

        // Member 1 attempts to remove Member 2
        $removeResponse = $this->actingAs($member1)->delete("/projects/{$project->id}/committees/{$committee->id}/members/{$member2->id}");
        $removeResponse->assertStatus(403);
    }

    public function test_member_cannot_assign_or_change_committee_staff(): void
    {
        $leader = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommittee($project);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);
        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);

        $response = $this->actingAs($member)->post("/projects/{$project->id}/committees/{$committee->id}/staff", [
            'user_id' => $staff->id,
        ]);

        $response->assertStatus(403);
    }

    public function test_member_cannot_create_or_edit_committees(): void
    {
        $leader = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommittee($project);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);

        $createResponse = $this->actingAs($member)->post("/projects/{$project->id}/committees", [
            'name' => 'Member Created Committee',
        ]);
        $createResponse->assertStatus(403);

        $editResponse = $this->actingAs($member)->patch("/projects/{$project->id}/committees/{$committee->id}", [
            'name' => 'Member Edited Name',
        ]);
        $editResponse->assertStatus(403);

        $deleteResponse = $this->actingAs($member)->delete("/projects/{$project->id}/committees/{$committee->id}");
        $deleteResponse->assertStatus(403);
    }

    // ─── 4. Cross-Project Protection ───────────────────────────────────────

    public function test_a_staff_member_from_project_a_cannot_access_committee_b_from_project_b(): void
    {
        $leaderA = $this->createVerifiedUser();
        $staffA = $this->createVerifiedUser();
        $projectA = $this->createProjectWithLeader($leaderA);
        $committeeA = $this->createCommittee($projectA);
        $this->assignProjectRole($projectA, $staffA, ProjectRoleAssignment::ROLE_PROJECT_STAFF, $committeeA->id);

        $leaderB = $this->createVerifiedUser();
        $projectB = $this->createProjectWithLeader($leaderB);
        $committeeB = $this->createCommittee($projectB);

        $response = $this->actingAs($staffA)->get("/projects/{$projectB->id}/committees/{$committeeB->id}");
        $response->assertStatus(403);
    }

    public function test_a_member_from_project_a_cannot_access_committee_b_from_project_b(): void
    {
        $leaderA = $this->createVerifiedUser();
        $memberA = $this->createVerifiedUser();
        $projectA = $this->createProjectWithLeader($leaderA);
        $committeeA = $this->createCommittee($projectA);
        $this->assignProjectRole($projectA, $memberA, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committeeA->id);

        $leaderB = $this->createVerifiedUser();
        $projectB = $this->createProjectWithLeader($leaderB);
        $committeeB = $this->createCommittee($projectB);

        $response = $this->actingAs($memberA)->get("/projects/{$projectB->id}/committees/{$committeeB->id}");
        $response->assertStatus(403);
    }

    public function test_a_project_leader_from_project_a_cannot_manage_project_bs_committees(): void
    {
        $leaderA = $this->createVerifiedUser();
        $projectA = $this->createProjectWithLeader($leaderA);

        $leaderB = $this->createVerifiedUser();
        $projectB = $this->createProjectWithLeader($leaderB);
        $committeeB = $this->createCommittee($projectB);

        // Leader A cannot update, delete, assign staff, or assign members in Project B
        $this->actingAs($leaderA)
            ->patch("/projects/{$projectB->id}/committees/{$committeeB->id}", ['name' => 'New Name'])
            ->assertStatus(403);

        $this->actingAs($leaderA)
            ->delete("/projects/{$projectB->id}/committees/{$committeeB->id}")
            ->assertStatus(403);

        $this->actingAs($leaderA)
            ->post("/projects/{$projectB->id}/committees/{$committeeB->id}/staff", ['user_id' => $leaderA->id])
            ->assertStatus(403);

        $this->actingAs($leaderA)
            ->post("/projects/{$projectB->id}/committees/{$committeeB->id}/members", ['user_id' => $leaderA->id])
            ->assertStatus(403);
    }

    // ─── 5. Route / Request Tampering Protection ───────────────────────────

    public function test_direct_url_access_to_unauthorized_committees_is_rejected(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommittee($project);

        $unassignedUser = $this->createVerifiedUser();

        // 1. Direct URL by unassigned verified user -> 403 Forbidden
        $response = $this->actingAs($unassignedUser)->get("/projects/{$project->id}/committees/{$committee->id}");
        $response->assertStatus(403);

        // 2. Direct URL by unverified user -> Redirect to verify email
        $unverifiedUser = $this->createUnverifiedUser();
        $unverifiedResponse = $this->actingAs($unverifiedUser)->get("/projects/{$project->id}/committees/{$committee->id}");
        $unverifiedResponse->assertRedirect('/verify-email');

        // 3. Direct URL by guest -> Redirect to login
        auth()->logout();
        $guestResponse = $this->get("/projects/{$project->id}/committees/{$committee->id}");
        $guestResponse->assertRedirect('/login');
    }

    public function test_direct_post_patch_delete_requests_against_unauthorized_committees_are_rejected(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommittee($project);

        $unauthorized = $this->createVerifiedUser();

        // Unauthorized POST create
        $this->actingAs($unauthorized)
            ->post("/projects/{$project->id}/committees", ['name' => 'Bad Committee'])
            ->assertStatus(403);

        // Unauthorized PATCH update
        $this->actingAs($unauthorized)
            ->patch("/projects/{$project->id}/committees/{$committee->id}", ['name' => 'Bad Update'])
            ->assertStatus(403);

        // Unauthorized DELETE
        $this->actingAs($unauthorized)
            ->delete("/projects/{$project->id}/committees/{$committee->id}")
            ->assertStatus(403);

        // Unauthorized POST assign staff
        $this->actingAs($unauthorized)
            ->post("/projects/{$project->id}/committees/{$committee->id}/staff", ['user_id' => $unauthorized->id])
            ->assertStatus(403);

        // Unauthorized POST assign members
        $this->actingAs($unauthorized)
            ->post("/projects/{$project->id}/committees/{$committee->id}/members", ['user_id' => $unauthorized->id])
            ->assertStatus(403);
    }

    public function test_manipulated_project_committee_ids_cannot_bypass_authorization(): void
    {
        $leaderA = $this->createVerifiedUser();
        $projectA = $this->createProjectWithLeader($leaderA);
        $committeeA = $this->createCommittee($projectA);

        $leaderB = $this->createVerifiedUser();
        $projectB = $this->createProjectWithLeader($leaderB);
        $committeeB = $this->createCommittee($projectB);

        // 1. Mismatched project/committee pair where user is authorized for committee but routes under another project
        $getResponse = $this->actingAs($leaderA)->get("/projects/{$projectB->id}/committees/{$committeeA->id}");
        $getResponse->assertNotFound();

        $patchResponse = $this->actingAs($leaderA)->patch("/projects/{$projectB->id}/committees/{$committeeA->id}", [
            'name' => 'Manipulated Name',
        ]);
        $patchResponse->assertNotFound();

        $deleteResponse = $this->actingAs($leaderA)->delete("/projects/{$projectB->id}/committees/{$committeeA->id}");
        $deleteResponse->assertNotFound();

        // 2. Mismatched project/committee pair targeting a committee from another project
        $this->actingAs($leaderA)
            ->get("/projects/{$projectA->id}/committees/{$committeeB->id}")
            ->assertNotFound();

        $this->actingAs($leaderA)
            ->delete("/projects/{$projectA->id}/committees/{$committeeB->id}")
            ->assertNotFound();

        // 3. Cross-project manipulation attempts must never succeed (either 404 or 403)
        $manipulatedStaff = $this->actingAs($leaderA)->post("/projects/{$projectA->id}/committees/{$committeeB->id}/staff", [
            'user_id' => $leaderA->id,
        ]);
        $this->assertTrue(in_array($manipulatedStaff->status(), [403, 404], true));

        $manipulatedMember = $this->actingAs($leaderA)->post("/projects/{$projectA->id}/committees/{$committeeB->id}/members", [
            'user_id' => $leaderA->id,
        ]);
        $this->assertTrue(in_array($manipulatedMember->status(), [403, 404], true));
    }
}
