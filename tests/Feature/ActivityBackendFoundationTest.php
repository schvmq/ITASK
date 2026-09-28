<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Day 9 Step 1 — Activity Backend Foundation Tests
 *
 * Covers: persistence, relationships, validation (including start_date/deadline),
 * status persistence for all five supported statuses, and all authorization cases.
 */
class ActivityBackendFoundationTest extends TestCase
{
    use RefreshDatabase;

    // =========================================================================
    // HELPERS
    // =========================================================================

    protected function createVerifiedUser(array $attributes = []): User
    {
        $user = User::create(array_merge([
            'name'     => 'User ' . uniqid(),
            'email'    => 'user_' . uniqid() . '@carsu.edu.ph',
            'password' => 'SecurePass123!',
        ], $attributes));

        $user->forceFill(['email_verified_at' => now()])->save();

        return $user;
    }

    protected function createProjectWithLeader(User $leader, array $attributes = []): Project
    {
        $project = Project::create(array_merge([
            'title'       => 'Project ' . uniqid(),
            'description' => 'A test project.',
            'status'      => Project::STATUS_PLANNING,
            'created_by'  => $leader->id,
        ], $attributes));

        ProjectRoleAssignment::create([
            'project_id'   => $project->id,
            'user_id'      => $leader->id,
            'role'         => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
            'committee_id' => null,
        ]);

        return $project;
    }

    protected function assignRole(Project $project, User $user, string $role, ?int $committeeId = null): ProjectRoleAssignment
    {
        return ProjectRoleAssignment::create([
            'project_id'   => $project->id,
            'user_id'      => $user->id,
            'role'         => $role,
            'committee_id' => $committeeId,
        ]);
    }

    protected function createCommitteeWithStaff(Project $project, User $staff, array $attributes = []): Committee
    {
        $committee = Committee::create(array_merge([
            'project_id'  => $project->id,
            'name'        => 'Committee ' . uniqid(),
            'description' => 'Test committee.',
        ], $attributes));

        $existing = ProjectRoleAssignment::where('project_id', $project->id)
            ->where('user_id', $staff->id)
            ->first();

        if ($existing) {
            $existing->update([
                'role'         => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
                'committee_id' => $committee->id,
            ]);
        } else {
            $this->assignRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF, $committee->id);
        }

        return $committee;
    }

    protected function createActivity(Committee $committee, User $creator, array $attributes = []): Activity
    {
        return Activity::create(array_merge([
            'project_id'   => $committee->project_id,
            'committee_id' => $committee->id,
            'created_by'   => $creator->id,
            'title'        => 'Activity ' . uniqid(),
            'description'  => 'A test activity.',
            'status'       => Activity::STATUS_TO_DO,
            'start_date'   => now()->format('Y-m-d'),
            'due_date'     => now()->addDays(7)->format('Y-m-d'),
        ], $attributes));
    }

    // =========================================================================
    // SECTION 1 — PERSISTENCE & RELATIONSHIPS
    // =========================================================================

    /**
     * 1. Activity can be created and persists with correct data.
     */
    public function test_activity_can_be_created_and_persists(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);

        $activity = $this->createActivity($committee, $staff, [
            'title'       => 'Annual Sports Fest',
            'description' => 'Yearly sports event.',
            'status'      => Activity::STATUS_TO_DO,
            'start_date'  => '2026-10-01',
            'due_date'    => '2026-10-15',
        ]);

        $this->assertDatabaseHas('activities', [
            'id'           => $activity->id,
            'project_id'   => $project->id,
            'committee_id' => $committee->id,
            'created_by'   => $staff->id,
            'title'        => 'Annual Sports Fest',
            'description'  => 'Yearly sports event.',
            'status'       => Activity::STATUS_TO_DO,
            'start_date'   => '2026-10-01',
            'due_date'     => '2026-10-15',
        ]);
    }

    /**
     * 2. Activity belongs to correct Committee.
     */
    public function test_activity_belongs_to_correct_committee(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);

        $activity = $this->createActivity($committee, $staff);

        $this->assertEquals($committee->id, $activity->committee->id);
        $this->assertEquals($committee->name, $activity->committee->name);
    }

    /**
     * 3. Activity's committee belongs to correct Project.
     */
    public function test_activity_committee_belongs_to_correct_project(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);

        $activity = $this->createActivity($committee, $staff);

        $this->assertEquals($project->id, $activity->committee->project->id);
        $this->assertEquals($project->title, $activity->committee->project->title);
    }

    /**
     * 4. Activity is accessible via Committee->activities() relationship.
     */
    public function test_committee_has_activities_relationship(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);

        $activity1 = $this->createActivity($committee, $staff, ['title' => 'Activity One']);
        $activity2 = $this->createActivity($committee, $staff, ['title' => 'Activity Two']);

        $committee->refresh();
        $this->assertCount(2, $committee->activities);
        $this->assertTrue($committee->activities->contains('id', $activity1->id));
        $this->assertTrue($committee->activities->contains('id', $activity2->id));
    }

    /**
     * 5. Activity data can be updated and persists.
     */
    public function test_activity_can_be_updated_and_persists(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);

        $activity->update([
            'title'       => 'Updated Title',
            'description' => 'Updated description.',
            'status'      => Activity::STATUS_IN_PROGRESS,
            'start_date'  => '2026-11-01',
            'due_date'    => '2026-11-20',
        ]);

        $this->assertDatabaseHas('activities', [
            'id'          => $activity->id,
            'title'       => 'Updated Title',
            'status'      => Activity::STATUS_IN_PROGRESS,
            'start_date'  => '2026-11-01',
            'due_date'    => '2026-11-20',
        ]);
    }

    /**
     * 6. Activities are scoped to their committee.
     */
    public function test_activities_are_scoped_to_their_committee(): void
    {
        $leader     = $this->createVerifiedUser();
        $project    = $this->createProjectWithLeader($leader);
        $staffA     = $this->createVerifiedUser();
        $committeeA = $this->createCommitteeWithStaff($project, $staffA);
        $staffB     = $this->createVerifiedUser();
        $committeeB = $this->createCommitteeWithStaff($project, $staffB);

        $activityA = $this->createActivity($committeeA, $staffA, ['title' => 'Activity A']);
        $activityB = $this->createActivity($committeeB, $staffB, ['title' => 'Activity B']);

        $this->assertTrue($committeeA->activities->contains('id', $activityA->id));
        $this->assertFalse($committeeA->activities->contains('id', $activityB->id));
        $this->assertTrue($committeeB->activities->contains('id', $activityB->id));
        $this->assertFalse($committeeB->activities->contains('id', $activityA->id));
    }

    // =========================================================================
    // SECTION 2 — STATUS PERSISTENCE
    // =========================================================================

    /**
     * 7. All five supported statuses can be persisted and read back.
     */
    public function test_all_supported_statuses_persist_correctly(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);

        $statuses = [
            Activity::STATUS_TO_DO,
            Activity::STATUS_IN_PROGRESS,
            Activity::STATUS_UNDER_REVIEW,
            Activity::STATUS_RETURNED,
            Activity::STATUS_COMPLETED,
        ];

        foreach ($statuses as $status) {
            $activity = $this->createActivity($committee, $staff, ['status' => $status]);

            $this->assertDatabaseHas('activities', [
                'id'     => $activity->id,
                'status' => $status,
            ]);

            $activity->refresh();
            $this->assertSame($status, $activity->status);
        }
    }

    /**
     * 8. STATUS_TO_DO constant value is 'To Do'.
     */
    public function test_status_to_do_constant_value(): void
    {
        $this->assertSame('To Do', Activity::STATUS_TO_DO);
        $this->assertSame('To Do', Activity::STATUS_TODO);
    }

    /**
     * 9. STATUS_IN_PROGRESS constant value is 'In Progress'.
     */
    public function test_status_in_progress_constant_value(): void
    {
        $this->assertSame('In Progress', Activity::STATUS_IN_PROGRESS);
    }

    /**
     * 10. STATUS_UNDER_REVIEW constant value is 'Under Review'.
     */
    public function test_status_under_review_constant_value(): void
    {
        $this->assertSame('Under Review', Activity::STATUS_UNDER_REVIEW);
    }

    /**
     * 11. STATUS_RETURNED constant value is 'Returned'.
     */
    public function test_status_returned_constant_value(): void
    {
        $this->assertSame('Returned', Activity::STATUS_RETURNED);
        // Backward-compat alias resolves to same value
        $this->assertSame(Activity::STATUS_RETURNED, Activity::STATUS_RETURNED_FOR_REVISION);
    }

    /**
     * 12. STATUS_COMPLETED constant value is 'Completed'.
     */
    public function test_status_completed_constant_value(): void
    {
        $this->assertSame('Completed', Activity::STATUS_COMPLETED);
    }

    /**
     * 13. STATUSES array contains exactly the five approved statuses.
     */
    public function test_statuses_array_contains_exactly_five_approved_statuses(): void
    {
        $this->assertCount(5, Activity::STATUSES);
        $this->assertContains('To Do', Activity::STATUSES);
        $this->assertContains('In Progress', Activity::STATUSES);
        $this->assertContains('Under Review', Activity::STATUSES);
        $this->assertContains('Returned', Activity::STATUSES);
        $this->assertContains('Completed', Activity::STATUSES);
    }

    // =========================================================================
    // SECTION 3 — VALIDATION
    // =========================================================================

    /**
     * 14. Title is required to create an activity.
     */
    public function test_title_is_required_to_create_activity(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);

        $response = $this->actingAs($staff)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities", [
                'title'  => '',
                'status' => Activity::STATUS_TO_DO,
            ]);

        $response->assertSessionHasErrors('title');
        $this->assertDatabaseCount('activities', 0);
    }

    /**
     * 15. Description is optional.
     */
    public function test_description_is_optional(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);

        $response = $this->actingAs($staff)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities", [
                'title'  => 'Activity Without Description',
                'status' => Activity::STATUS_TO_DO,
            ]);

        $response->assertSessionDoesntHaveErrors('description');
        $this->assertDatabaseHas('activities', [
            'title'       => 'Activity Without Description',
            'description' => null,
        ]);
    }

    /**
     * 16. Invalid status is rejected.
     */
    public function test_invalid_status_is_rejected(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);

        $response = $this->actingAs($staff)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities", [
                'title'  => 'Invalid Status Activity',
                'status' => 'INVALID_STATUS',
            ]);

        $response->assertSessionHasErrors('status');
    }

    /**
     * 17. All valid statuses are accepted by store validation.
     */
    public function test_all_valid_statuses_are_accepted(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);

        foreach (Activity::STATUSES as $status) {
            $response = $this->actingAs($staff)
                ->post("/projects/{$project->id}/committees/{$committee->id}/activities", [
                    'title'  => "Activity With Status {$status}",
                    'status' => $status,
                ]);

            $response->assertSessionDoesntHaveErrors('status');
        }
    }

    /**
     * 18. Invalid start_date format is rejected.
     */
    public function test_invalid_start_date_is_rejected(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);

        $response = $this->actingAs($staff)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities", [
                'title'      => 'Activity With Bad Start Date',
                'start_date' => 'not-a-date',
                'status'     => Activity::STATUS_TO_DO,
            ]);

        $response->assertSessionHasErrors('start_date');
    }

    /**
     * 19. Invalid due_date format is rejected.
     */
    public function test_invalid_due_date_is_rejected(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);

        $response = $this->actingAs($staff)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities", [
                'title'    => 'Activity With Bad Due Date',
                'due_date' => 'not-a-date',
                'status'   => Activity::STATUS_TO_DO,
            ]);

        $response->assertSessionHasErrors('due_date');
    }

    /**
     * 20. Deadline before start_date is rejected on store.
     */
    public function test_deadline_before_start_date_is_rejected_on_store(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);

        $response = $this->actingAs($staff)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities", [
                'title'      => 'Invalid Date Range Activity',
                'start_date' => '2026-11-20',
                'due_date'   => '2026-11-10', // before start_date
                'status'     => Activity::STATUS_TO_DO,
            ]);

        $response->assertSessionHasErrors('due_date');
        $this->assertDatabaseMissing('activities', ['title' => 'Invalid Date Range Activity']);
    }

    /**
     * 21. Deadline equal to start_date is accepted.
     */
    public function test_deadline_equal_to_start_date_is_accepted(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);

        $response = $this->actingAs($staff)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities", [
                'title'      => 'Same Day Activity',
                'start_date' => '2026-11-10',
                'due_date'   => '2026-11-10', // equal to start_date
                'status'     => Activity::STATUS_TO_DO,
            ]);

        $response->assertSessionDoesntHaveErrors('due_date');
        $this->assertDatabaseHas('activities', [
            'title'      => 'Same Day Activity',
            'start_date' => '2026-11-10',
            'due_date'   => '2026-11-10',
        ]);
    }

    /**
     * 22. Deadline before start_date is rejected on update.
     */
    public function test_deadline_before_start_date_is_rejected_on_update(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);

        $response = $this->actingAs($staff)
            ->patch("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}", [
                'title'      => 'Updated Activity',
                'start_date' => '2026-12-15',
                'due_date'   => '2026-12-01', // before start_date
                'status'     => Activity::STATUS_IN_PROGRESS,
            ]);

        $response->assertSessionHasErrors('due_date');
        $this->assertDatabaseMissing('activities', ['title' => 'Updated Activity']);
    }

    /**
     * 23. Valid start_date and due_date persist on store.
     */
    public function test_valid_start_date_and_due_date_persist_on_store(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);

        $response = $this->actingAs($staff)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities", [
                'title'      => 'Date Range Activity',
                'start_date' => '2026-10-05',
                'due_date'   => '2026-10-20',
                'status'     => Activity::STATUS_TO_DO,
            ]);

        $response->assertSessionDoesntHaveErrors();
        $this->assertDatabaseHas('activities', [
            'title'      => 'Date Range Activity',
            'start_date' => '2026-10-05',
            'due_date'   => '2026-10-20',
        ]);
    }

    /**
     * 24. Null start_date is accepted (optional field).
     */
    public function test_null_start_date_is_accepted(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);

        $response = $this->actingAs($staff)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities", [
                'title'      => 'No Start Date Activity',
                'start_date' => null,
                'due_date'   => '2026-10-20',
                'status'     => Activity::STATUS_TO_DO,
            ]);

        $response->assertSessionDoesntHaveErrors();
        $this->assertDatabaseHas('activities', [
            'title'      => 'No Start Date Activity',
            'start_date' => null,
        ]);
    }

    // =========================================================================
    // SECTION 4 — ACTIVITY CREATION AUTHORIZATION
    // =========================================================================

    /**
     * 25. Project Staff can create activity in their committee.
     */
    public function test_project_staff_can_create_activity_in_their_committee(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);

        $response = $this->actingAs($staff)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities", [
                'title'  => 'Staff Created Activity',
                'status' => Activity::STATUS_TO_DO,
            ]);

        $response->assertSessionDoesntHaveErrors();
        $this->assertDatabaseHas('activities', ['title' => 'Staff Created Activity']);
    }

    /**
     * 26. Project Leader can create activity in any committee of their project.
     */
    public function test_project_leader_can_create_activity_in_any_committee(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);

        $response = $this->actingAs($leader)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities", [
                'title'  => 'Leader Created Activity',
                'status' => Activity::STATUS_TO_DO,
            ]);

        $response->assertSessionDoesntHaveErrors();
        $this->assertDatabaseHas('activities', ['title' => 'Leader Created Activity']);
    }

    /**
     * 27. Project Staff cannot create activity in another committee.
     */
    public function test_project_staff_cannot_create_activity_in_another_committee(): void
    {
        $leader     = $this->createVerifiedUser();
        $project    = $this->createProjectWithLeader($leader);
        $staffA     = $this->createVerifiedUser();
        $committeeA = $this->createCommitteeWithStaff($project, $staffA);
        $staffB     = $this->createVerifiedUser();
        $committeeB = $this->createCommitteeWithStaff($project, $staffB);

        $response = $this->actingAs($staffA)
            ->post("/projects/{$project->id}/committees/{$committeeB->id}/activities", [
                'title'  => 'Unauthorized Activity',
                'status' => Activity::STATUS_TO_DO,
            ]);

        $response->assertForbidden();
        $this->assertDatabaseMissing('activities', ['title' => 'Unauthorized Activity']);
    }

    /**
     * 28. Project Member cannot create an activity.
     */
    public function test_project_member_cannot_create_activity(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $member    = $this->createVerifiedUser();
        $this->assignRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);

        $response = $this->actingAs($member)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities", [
                'title'  => 'Member Activity Attempt',
                'status' => Activity::STATUS_TO_DO,
            ]);

        $response->assertForbidden();
        $this->assertDatabaseMissing('activities', ['title' => 'Member Activity Attempt']);
    }

    /**
     * 29. Unassigned user cannot create an activity.
     */
    public function test_unassigned_user_cannot_create_activity(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $outsider  = $this->createVerifiedUser();

        $response = $this->actingAs($outsider)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities", [
                'title'  => 'Outsider Activity Attempt',
                'status' => Activity::STATUS_TO_DO,
            ]);

        $response->assertForbidden();
        $this->assertDatabaseMissing('activities', ['title' => 'Outsider Activity Attempt']);
    }

    /**
     * 30. Guest is redirected to login when attempting to create an activity.
     */
    public function test_guest_is_redirected_to_login_when_creating_activity(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);

        $response = $this->post("/projects/{$project->id}/committees/{$committee->id}/activities", [
            'title'  => 'Guest Activity Attempt',
            'status' => Activity::STATUS_TO_DO,
        ]);

        $response->assertRedirect('/login');
    }

    // =========================================================================
    // SECTION 5 — ACTIVITY EDITING AUTHORIZATION
    // =========================================================================

    /**
     * 31. Project Staff can update activity in their committee.
     */
    public function test_project_staff_can_update_activity_in_their_committee(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);

        $response = $this->actingAs($staff)
            ->patch("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}", [
                'title'  => 'Staff Updated Activity',
                'status' => Activity::STATUS_IN_PROGRESS,
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('activities', [
            'id'     => $activity->id,
            'title'  => 'Staff Updated Activity',
            'status' => Activity::STATUS_IN_PROGRESS,
        ]);
    }

    /**
     * 32. Project Leader can update activity in any committee of their project.
     */
    public function test_project_leader_can_update_activity_in_any_committee(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);

        $response = $this->actingAs($leader)
            ->patch("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}", [
                'title'  => 'Leader Updated Activity',
                'status' => Activity::STATUS_IN_PROGRESS,
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('activities', [
            'id'    => $activity->id,
            'title' => 'Leader Updated Activity',
        ]);
    }

    /**
     * 33. Project Staff cannot update activity in another committee.
     */
    public function test_project_staff_cannot_update_activity_in_another_committee(): void
    {
        $leader     = $this->createVerifiedUser();
        $project    = $this->createProjectWithLeader($leader);
        $staffA     = $this->createVerifiedUser();
        $committeeA = $this->createCommitteeWithStaff($project, $staffA);
        $staffB     = $this->createVerifiedUser();
        $committeeB = $this->createCommitteeWithStaff($project, $staffB);
        $activityB  = $this->createActivity($committeeB, $staffB);

        $response = $this->actingAs($staffA)
            ->patch("/projects/{$project->id}/committees/{$committeeB->id}/activities/{$activityB->id}", [
                'title'  => 'Malicious Edit',
                'status' => Activity::STATUS_IN_PROGRESS,
            ]);

        $response->assertForbidden();
        $this->assertDatabaseMissing('activities', ['title' => 'Malicious Edit']);
    }

    /**
     * 34. Project Member cannot update an activity.
     */
    public function test_project_member_cannot_update_activity(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $member    = $this->createVerifiedUser();
        $this->assignRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);

        $response = $this->actingAs($member)
            ->patch("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}", [
                'title'  => 'Member Updated Activity',
                'status' => Activity::STATUS_IN_PROGRESS,
            ]);

        $response->assertForbidden();
    }

    /**
     * 35. Unassigned user cannot update an activity.
     */
    public function test_unassigned_user_cannot_update_activity(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $outsider  = $this->createVerifiedUser();

        $response = $this->actingAs($outsider)
            ->patch("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}", [
                'title'  => 'Outsider Updated Activity',
                'status' => Activity::STATUS_IN_PROGRESS,
            ]);

        $response->assertForbidden();
    }

    // =========================================================================
    // SECTION 6 — ACTIVITY VIEWING AUTHORIZATION
    // =========================================================================

    /**
     * 36. Project Leader can view activities in any committee of their project.
     */
    public function test_project_leader_can_view_activity(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);

        $response = $this->actingAs($leader)
            ->get("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}");

        $response->assertOk();
    }

    /**
     * 37. Project Staff can view their committee's activities.
     */
    public function test_project_staff_can_view_their_committee_activities(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);

        $response = $this->actingAs($staff)
            ->get("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}");

        $response->assertOk();
    }

    /**
     * 38. Project Member assigned to committee can view activity.
     */
    public function test_project_member_can_view_their_committee_activities(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $member    = $this->createVerifiedUser();
        $this->assignRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);

        $response = $this->actingAs($member)
            ->get("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}");

        $response->assertOk();
    }

    /**
     * 39. Unassigned user cannot view activity.
     */
    public function test_unassigned_user_cannot_view_activity(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $outsider  = $this->createVerifiedUser();

        $this->actingAs($outsider)
            ->get("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}")
            ->assertForbidden();
    }

    /**
     * 40. Guest cannot view activity (redirected to login).
     */
    public function test_guest_is_redirected_to_login_when_viewing_activity(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);

        $this->get("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}")
            ->assertRedirect('/login');
    }

    // =========================================================================
    // SECTION 7 — CROSS-PROJECT ISOLATION
    // =========================================================================

    /**
     * 41. User from another project cannot view, create, or edit activities.
     */
    public function test_cross_project_user_cannot_access_activities(): void
    {
        // Project 1
        $leader1    = $this->createVerifiedUser();
        $project1   = $this->createProjectWithLeader($leader1);
        $staff1     = $this->createVerifiedUser();
        $committee1 = $this->createCommitteeWithStaff($project1, $staff1);
        $activity1  = $this->createActivity($committee1, $staff1);

        // Project 2 — separate
        $leader2  = $this->createVerifiedUser();
        $project2 = $this->createProjectWithLeader($leader2);
        $staff2   = $this->createVerifiedUser();
        Committee::create(['project_id' => $project2->id, 'name' => 'Ignored']);

        // Staff from project2 cannot view activity in project1
        $this->actingAs($staff2)
            ->get("/projects/{$project1->id}/committees/{$committee1->id}/activities/{$activity1->id}")
            ->assertForbidden();

        // Staff from project2 cannot update activity in project1
        $this->actingAs($staff2)
            ->patch("/projects/{$project1->id}/committees/{$committee1->id}/activities/{$activity1->id}", [
                'title'  => 'Cross-project edit',
                'status' => Activity::STATUS_IN_PROGRESS,
            ])
            ->assertForbidden();
    }

    /**
     * 42. Mismatched project + committee in route returns 404.
     */
    public function test_mismatched_project_committee_in_route_returns_404_on_store(): void
    {
        $leader1    = $this->createVerifiedUser();
        $project1   = $this->createProjectWithLeader($leader1);
        $staff1     = $this->createVerifiedUser();
        $committee1 = $this->createCommitteeWithStaff($project1, $staff1);

        $leader2    = $this->createVerifiedUser();
        $project2   = $this->createProjectWithLeader($leader2);
        $staff2     = $this->createVerifiedUser();
        $committee2 = $this->createCommitteeWithStaff($project2, $staff2);

        // Committee2 does not belong to Project1
        $this->actingAs($staff1)
            ->post("/projects/{$project1->id}/committees/{$committee2->id}/activities", [
                'title'  => 'Orphan Activity',
                'status' => Activity::STATUS_TO_DO,
            ])
            ->assertNotFound();
    }

    /**
     * 43. Mismatched project + committee + activity in route returns 404.
     */
    public function test_mismatched_project_committee_activity_in_route_returns_404(): void
    {
        $leader1    = $this->createVerifiedUser();
        $project1   = $this->createProjectWithLeader($leader1);
        $staff1     = $this->createVerifiedUser();
        $committee1 = $this->createCommitteeWithStaff($project1, $staff1);
        $activity1  = $this->createActivity($committee1, $staff1);

        $leader2    = $this->createVerifiedUser();
        $project2   = $this->createProjectWithLeader($leader2);
        $staff2     = $this->createVerifiedUser();
        $committee2 = $this->createCommitteeWithStaff($project2, $staff2);

        // Activity1 does not belong to project2/committee2
        $this->actingAs($staff2)
            ->get("/projects/{$project2->id}/committees/{$committee2->id}/activities/{$activity1->id}")
            ->assertNotFound();

        $this->actingAs($staff2)
            ->patch("/projects/{$project2->id}/committees/{$committee2->id}/activities/{$activity1->id}", [
                'title'  => 'Cross-project manipulated edit',
                'status' => Activity::STATUS_IN_PROGRESS,
            ])
            ->assertNotFound();
    }

    /**
     * 44. Activity from another committee within the same project returns 404.
     */
    public function test_activity_from_different_committee_same_project_returns_404(): void
    {
        $leader     = $this->createVerifiedUser();
        $project    = $this->createProjectWithLeader($leader);
        $staffA     = $this->createVerifiedUser();
        $committeeA = $this->createCommitteeWithStaff($project, $staffA);
        $activityA  = $this->createActivity($committeeA, $staffA);

        $staffB     = $this->createVerifiedUser();
        $committeeB = $this->createCommitteeWithStaff($project, $staffB);

        // activityA belongs to committeeA, not committeeB
        $this->actingAs($staffB)
            ->get("/projects/{$project->id}/committees/{$committeeB->id}/activities/{$activityA->id}")
            ->assertNotFound();
    }

    // =========================================================================
    // SECTION 8 — DATA RESPONSE INTEGRITY
    // =========================================================================

    /**
     * 45. Activity show response includes start_date fields.
     */
    public function test_activity_show_response_includes_start_date(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff, [
            'start_date' => '2026-10-05',
            'due_date'   => '2026-10-20',
        ]);

        $response = $this->actingAs($leader)
            ->get("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}");

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Activities/Show')
            ->has('activity.start_date_raw')
            ->where('activity.start_date_raw', '2026-10-05')
            ->where('activity.due_date_raw', '2026-10-20')
        );
    }
}
