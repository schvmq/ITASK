<?php

namespace Tests\Feature;

use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommitteeCreationAndEditingTest extends TestCase
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
    // 1. Committee Creation Tests
    // ─────────────────────────────────────────────────────────────────────────────

    public function test_project_leader_can_create_a_committee_with_name_and_optional_description(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $response = $this->actingAs($leader)->post(route('projects.committees.store', $project), [
            'name' => 'Logistics Committee',
            'description' => 'Responsible for procurement and equipment logistics.',
        ]);

        $response->assertRedirect(route('projects.show', $project));
        $response->assertSessionHas('status', 'Committee created successfully.');

        $this->assertDatabaseHas('committees', [
            'project_id' => $project->id,
            'name' => 'Logistics Committee',
            'description' => 'Responsible for procurement and equipment logistics.',
        ]);
    }

    public function test_project_leader_can_create_a_committee_without_description(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $response = $this->actingAs($leader)->post(route('projects.committees.store', $project), [
            'name' => 'Program Committee',
            'description' => null,
        ]);

        $response->assertRedirect(route('projects.show', $project));
        $this->assertDatabaseHas('committees', [
            'project_id' => $project->id,
            'name' => 'Program Committee',
            'description' => null,
        ]);
    }

    public function test_committee_belongs_to_the_correct_project(): void
    {
        $leaderA = $this->createVerifiedUser();
        $projectA = $this->createProjectWithLeader($leaderA);

        $leaderB = $this->createVerifiedUser();
        $projectB = $this->createProjectWithLeader($leaderB);

        $response = $this->actingAs($leaderA)->post(route('projects.committees.store', $projectA), [
            'name' => 'Project A Committee',
            'description' => 'Scoping test description.',
        ]);

        $response->assertSessionHasNoErrors();

        $committee = Committee::where('name', 'Project A Committee')->first();
        $this->assertNotNull($committee);
        $this->assertEquals($projectA->id, $committee->project_id);
        $this->assertNotEquals($projectB->id, $committee->project_id);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. Committee Editing Tests
    // ─────────────────────────────────────────────────────────────────────────────

    public function test_project_leader_can_edit_a_committee(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommittee($project, [
            'name' => 'Original Committee Name',
            'description' => 'Original description.',
        ]);

        $response = $this->actingAs($leader)->patch(route('projects.committees.update', [$project, $committee]), [
            'name' => 'Updated Committee Name',
            'description' => 'Updated committee charter and scope.',
        ]);

        $response->assertSessionHasNoErrors();
        $response->assertSessionHas('status', 'Committee updated successfully.');

        $this->assertDatabaseHas('committees', [
            'id' => $committee->id,
            'project_id' => $project->id,
            'name' => 'Updated Committee Name',
            'description' => 'Updated committee charter and scope.',
        ]);

        $this->assertDatabaseMissing('committees', [
            'id' => $committee->id,
            'name' => 'Original Committee Name',
        ]);
    }

    public function test_committee_edit_from_project_page_redirects_back_to_project_page(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommittee($project, [
            'name' => 'Alpha Committee',
        ]);

        $response = $this->actingAs($leader)
            ->from(route('projects.show', $project))
            ->patch(route('projects.committees.update', [$project, $committee]), [
                'name' => 'Alpha Committee Revised',
            ]);

        $response->assertRedirect(route('projects.show', $project));
        $this->assertDatabaseHas('committees', [
            'id' => $committee->id,
            'name' => 'Alpha Committee Revised',
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. Authorization Tests (Role-Scoped Restrictions)
    // ─────────────────────────────────────────────────────────────────────────────

    public function test_project_staff_cannot_create_or_edit_committees(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);

        $committee = $this->createCommittee($project, ['name' => 'Initial Committee']);

        // Staff attempts to create
        $createResponse = $this->actingAs($staff)->post(route('projects.committees.store', $project), [
            'name' => 'Staff Created Committee',
            'description' => 'Staff attempt.',
        ]);
        $createResponse->assertForbidden();
        $this->assertDatabaseMissing('committees', [
            'name' => 'Staff Created Committee',
        ]);

        // Staff attempts to edit
        $editResponse = $this->actingAs($staff)->patch(route('projects.committees.update', [$project, $committee]), [
            'name' => 'Staff Edited Name',
        ]);
        $editResponse->assertForbidden();
        $this->assertDatabaseHas('committees', [
            'id' => $committee->id,
            'name' => 'Initial Committee',
        ]);
    }

    public function test_project_member_cannot_create_or_edit_committees(): void
    {
        $leader = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);

        $committee = $this->createCommittee($project, ['name' => 'Member Initial Committee']);

        // Member attempts to create
        $createResponse = $this->actingAs($member)->post(route('projects.committees.store', $project), [
            'name' => 'Member Created Committee',
        ]);
        $createResponse->assertForbidden();
        $this->assertDatabaseMissing('committees', [
            'name' => 'Member Created Committee',
        ]);

        // Member attempts to edit
        $editResponse = $this->actingAs($member)->patch(route('projects.committees.update', [$project, $committee]), [
            'name' => 'Member Edited Name',
        ]);
        $editResponse->assertForbidden();
        $this->assertDatabaseHas('committees', [
            'id' => $committee->id,
            'name' => 'Member Initial Committee',
        ]);
    }

    public function test_unassigned_user_cannot_create_or_edit_committees(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommittee($project, ['name' => 'Secured Committee']);

        $unassignedUser = $this->createVerifiedUser();

        $createResponse = $this->actingAs($unassignedUser)->post(route('projects.committees.store', $project), [
            'name' => 'Unassigned Committee',
        ]);
        $createResponse->assertForbidden();

        $editResponse = $this->actingAs($unassignedUser)->patch(route('projects.committees.update', [$project, $committee]), [
            'name' => 'Unassigned Modified Committee',
        ]);
        $editResponse->assertForbidden();
    }

    public function test_leader_of_another_project_cannot_modify_committee(): void
    {
        $leaderA = $this->createVerifiedUser();
        $projectA = $this->createProjectWithLeader($leaderA);
        $committeeA = $this->createCommittee($projectA, ['name' => 'Committee A']);

        $leaderB = $this->createVerifiedUser();
        $projectB = $this->createProjectWithLeader($leaderB);

        $createResponse = $this->actingAs($leaderB)->post(route('projects.committees.store', $projectA), [
            'name' => 'Hijacked Create Committee',
        ]);
        $createResponse->assertForbidden();

        $editResponse = $this->actingAs($leaderB)->patch(route('projects.committees.update', [$projectA, $committeeA]), [
            'name' => 'Hijacked Edit Committee',
        ]);
        $editResponse->assertForbidden();
    }

    public function test_guest_cannot_create_or_edit_committees(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommittee($project, ['name' => 'Guest Target Committee']);

        $guestCreate = $this->post(route('projects.committees.store', $project), [
            'name' => 'Guest Committee',
        ]);
        $guestCreate->assertRedirect(route('login'));

        $guestEdit = $this->patch(route('projects.committees.update', [$project, $committee]), [
            'name' => 'Guest Edit Committee',
        ]);
        $guestEdit->assertRedirect(route('login'));
    }

    public function test_unverified_user_cannot_create_or_edit_committees(): void
    {
        $unverifiedLeader = $this->createUnverifiedUser();
        $project = Project::create([
            'title' => 'Unverified Project',
            'status' => Project::STATUS_PLANNING,
            'created_by' => $unverifiedLeader->id,
        ]);
        $this->assignProjectRole($project, $unverifiedLeader, ProjectRoleAssignment::ROLE_PROJECT_LEADER);

        $committee = $this->createCommittee($project, ['name' => 'Unverified Committee']);

        $unverifiedCreate = $this->actingAs($unverifiedLeader)->post(route('projects.committees.store', $project), [
            'name' => 'Unverified Created Committee',
        ]);
        $unverifiedCreate->assertRedirect(route('verification.notice'));

        $unverifiedEdit = $this->actingAs($unverifiedLeader)->patch(route('projects.committees.update', [$project, $committee]), [
            'name' => 'Unverified Edited Committee',
        ]);
        $unverifiedEdit->assertRedirect(route('verification.notice'));
    }

    public function test_cross_project_committee_mismatch_returns_404(): void
    {
        $leaderA = $this->createVerifiedUser();
        $projectA = $this->createProjectWithLeader($leaderA);
        $committeeA = $this->createCommittee($projectA, ['name' => 'Project A Committee']);

        $otherLeader = $this->createVerifiedUser();
        $otherProject = $this->createProjectWithLeader($otherLeader);

        // Attempting to route committee A through other project's URL prefix
        $mismatchEdit = $this->actingAs($leaderA)->patch(route('projects.committees.update', [
            'project' => $otherProject->id,
            'committee' => $committeeA->id,
        ]), [
            'name' => 'Mismatch Route Edit',
        ]);
        $mismatchEdit->assertNotFound();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 4. Validation Errors Prevent Invalid Committee Data Persistence
    // ─────────────────────────────────────────────────────────────────────────────

    public function test_validation_errors_prevent_invalid_committee_data_from_being_persisted(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommittee($project, [
            'name' => 'Valid Committee',
            'description' => 'Original valid description.',
        ]);

        // 1. Creation: Empty name fails validation
        $createEmptyResponse = $this->actingAs($leader)->post(route('projects.committees.store', $project), [
            'name' => '',
            'description' => 'Empty name description',
        ]);
        $createEmptyResponse->assertSessionHasErrors(['name']);

        // 2. Creation: Name exceeding 255 characters fails validation
        $createLongNameResponse = $this->actingAs($leader)->post(route('projects.committees.store', $project), [
            'name' => str_repeat('A', 256),
            'description' => 'Long name description',
        ]);
        $createLongNameResponse->assertSessionHasErrors(['name']);

        // 3. Edit: Empty name fails validation
        $editEmptyResponse = $this->actingAs($leader)->patch(route('projects.committees.update', [$project, $committee]), [
            'name' => '',
            'description' => 'Changed description',
        ]);
        $editEmptyResponse->assertSessionHasErrors(['name']);

        // 4. Edit: Name exceeding 255 characters fails validation
        $editLongResponse = $this->actingAs($leader)->patch(route('projects.committees.update', [$project, $committee]), [
            'name' => str_repeat('Z', 256),
        ]);
        $editLongResponse->assertSessionHasErrors(['name']);

        // Assert database was not corrupted or updated with invalid data
        $committee->refresh();
        $this->assertEquals('Valid Committee', $committee->name);
        $this->assertEquals('Original valid description.', $committee->description);
    }
}
