<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ActivitySubmissionReviewTest extends TestCase
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
     * Helper to create a committee with an assigned Project Staff head.
     */
    protected function createCommitteeWithHead(Project $project, User $staffHead, array $attributes = []): Committee
    {
        $committee = Committee::create(array_merge([
            'project_id' => $project->id,
            'name' => 'Test Committee ' . uniqid(),
            'description' => 'A test committee description.',
        ], $attributes));

        $assignment = ProjectRoleAssignment::where('project_id', $project->id)
            ->where('user_id', $staffHead->id)
            ->first();

        if ($assignment) {
            $assignment->update([
                'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
                'committee_id' => $committee->id,
            ]);
        } else {
            $this->assignProjectRole($project, $staffHead, ProjectRoleAssignment::ROLE_PROJECT_STAFF, $committee->id);
        }

        return $committee;
    }

    /**
     * Helper to create an activity under a committee.
     */
    protected function createActivity(Committee $committee, User $creator, array $attributes = []): Activity
    {
        return Activity::create(array_merge([
            'project_id' => $committee->project_id,
            'committee_id' => $committee->id,
            'created_by' => $creator->id,
            'title' => 'Test Activity ' . uniqid(),
            'description' => 'Activity description',
            'status' => Activity::STATUS_TODO,
            'due_date' => now()->addDays(7)->format('Y-m-d'),
        ], $attributes));
    }

    /**
     * Helper to create a task under an activity.
     */
    protected function createTask(Activity $activity, ?User $assignee = null, array $attributes = []): Task
    {
        return Task::create(array_merge([
            'activity_id' => $activity->id,
            'assigned_to' => $assignee?->id,
            'title' => 'Test Task ' . uniqid(),
            'description' => 'Task description',
            'status' => Task::STATUS_TODO,
            'due_date' => now()->addDays(3)->format('Y-m-d'),
        ], $attributes));
    }

    // =========================================================================
    // 1. SUBMISSION AUTHORIZATION & WORKFLOW TESTS
    // =========================================================================

    /**
     * 1. Authorized Project Member can submit their Activity.
     */
    public function test_authorized_project_member_can_submit_their_activity(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $staff = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithHead($project, $staff);
        $activity = $this->createActivity($committee, $staff, ['status' => Activity::STATUS_IN_PROGRESS]);

        $member = $this->createVerifiedUser();
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);

        // Assign task to member so they have relevant work
        $task = $this->createTask($activity, $member, ['status' => Task::STATUS_COMPLETED]);

        $response = $this->actingAs($member)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/submit", [
                'submission_notes' => 'All presentation slides and rehearsals are finished.',
            ]);

        $response->assertRedirect("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}");

        $activity->refresh();
        $this->assertSame(Activity::STATUS_UNDER_REVIEW, $activity->status);
        $this->assertSame('All presentation slides and rehearsals are finished.', $activity->submission_notes);
    }

    /**
     * 2. Member from another committee cannot submit it.
     */
    public function test_member_from_another_committee_cannot_submit_it(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $staffA = $this->createVerifiedUser();
        $committeeA = $this->createCommitteeWithHead($project, $staffA);
        $activityA = $this->createActivity($committeeA, $staffA);

        $staffB = $this->createVerifiedUser();
        $committeeB = $this->createCommitteeWithHead($project, $staffB);

        $memberB = $this->createVerifiedUser();
        $this->assignProjectRole($project, $memberB, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committeeB->id);

        $response = $this->actingAs($memberB)
            ->post("/projects/{$project->id}/committees/{$committeeA->id}/activities/{$activityA->id}/submit", [
                'submission_notes' => 'Attempt by member B',
            ]);

        $response->assertForbidden();

        $activityA->refresh();
        $this->assertNotSame(Activity::STATUS_UNDER_REVIEW, $activityA->status);
    }

    /**
     * 3. Member from another project cannot submit it.
     */
    public function test_member_from_another_project_cannot_submit_it(): void
    {
        $leader1 = $this->createVerifiedUser();
        $project1 = $this->createProjectWithLeader($leader1);
        $staff1 = $this->createVerifiedUser();
        $committee1 = $this->createCommitteeWithHead($project1, $staff1);
        $activity1 = $this->createActivity($committee1, $staff1);

        $leader2 = $this->createVerifiedUser();
        $project2 = $this->createProjectWithLeader($leader2);
        $staff2 = $this->createVerifiedUser();
        $committee2 = $this->createCommitteeWithHead($project2, $staff2);
        $memberProject2 = $this->createVerifiedUser();
        $this->assignProjectRole($project2, $memberProject2, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee2->id);

        $response = $this->actingAs($memberProject2)
            ->post("/projects/{$project1->id}/committees/{$committee1->id}/activities/{$activity1->id}/submit", [
                'submission_notes' => 'Cross-project submit attempt',
            ]);

        $response->assertForbidden();
    }

    /**
     * 4. Unrelated user cannot submit it.
     */
    public function test_unrelated_user_cannot_submit_it(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $staff = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithHead($project, $staff);
        $activity = $this->createActivity($committee, $staff);

        $outsideUser = $this->createVerifiedUser();

        $response = $this->actingAs($outsideUser)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/submit", [
                'submission_notes' => 'Outside user submit attempt',
            ]);

        $response->assertForbidden();
    }

    /**
     * Member without assigned tasks cannot submit.
     */
    public function test_member_without_assigned_work_under_activity_cannot_submit(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $staff = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithHead($project, $staff);
        $activity = $this->createActivity($committee, $staff);

        $member = $this->createVerifiedUser();
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);
        // Note: No task assigned to $member under $activity

        $response = $this->actingAs($member)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/submit");

        $response->assertForbidden();
    }

    /**
     * 5. Duplicate submission while Under Review is rejected.
     */
    public function test_duplicate_submission_while_under_review_is_rejected(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $staff = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithHead($project, $staff);
        $activity = $this->createActivity($committee, $staff, ['status' => Activity::STATUS_UNDER_REVIEW]);

        $member = $this->createVerifiedUser();
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);
        $this->createTask($activity, $member);

        $response = $this->actingAs($member)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/submit", [
                'submission_notes' => 'Duplicate attempt',
            ]);

        $response->assertSessionHasErrors('status');
    }

    // =========================================================================
    // 2. STAFF REVIEW AUTHORIZATION & WORKFLOW TESTS
    // =========================================================================

    /**
     * 6. Committee Staff can review an Activity under their committee (Mark Completed).
     */
    public function test_committee_staff_can_review_activity_and_mark_completed(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $staff = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithHead($project, $staff);
        $activity = $this->createActivity($committee, $staff, [
            'status' => Activity::STATUS_UNDER_REVIEW,
            'submission_notes' => 'Ready for final sign-off.',
        ]);

        $response = $this->actingAs($staff)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/review", [
                'action' => 'complete',
            ]);

        $response->assertRedirect("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}");

        $activity->refresh();
        $this->assertSame(Activity::STATUS_COMPLETED, $activity->status);
        $this->assertSame($staff->id, $activity->reviewed_by);
        $this->assertNotNull($activity->reviewed_at);
        $this->assertSame('Ready for final sign-off.', $activity->submission_notes);
        $this->assertNull($activity->review_feedback);
    }

    /**
     * 7. Staff from another committee cannot review it.
     */
    public function test_staff_from_another_committee_cannot_review_it(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $staffA = $this->createVerifiedUser();
        $committeeA = $this->createCommitteeWithHead($project, $staffA);
        $activityA = $this->createActivity($committeeA, $staffA, ['status' => Activity::STATUS_UNDER_REVIEW]);

        $staffB = $this->createVerifiedUser();
        $committeeB = $this->createCommitteeWithHead($project, $staffB);

        $response = $this->actingAs($staffB)
            ->post("/projects/{$project->id}/committees/{$committeeA->id}/activities/{$activityA->id}/review", [
                'action' => 'complete',
            ]);

        $response->assertForbidden();

        $activityA->refresh();
        $this->assertSame(Activity::STATUS_UNDER_REVIEW, $activityA->status);
    }

    /**
     * 8. Staff from another project cannot review it.
     */
    public function test_staff_from_another_project_cannot_review_it(): void
    {
        $leader1 = $this->createVerifiedUser();
        $project1 = $this->createProjectWithLeader($leader1);
        $staff1 = $this->createVerifiedUser();
        $committee1 = $this->createCommitteeWithHead($project1, $staff1);
        $activity1 = $this->createActivity($committee1, $staff1, ['status' => Activity::STATUS_UNDER_REVIEW]);

        $leader2 = $this->createVerifiedUser();
        $project2 = $this->createProjectWithLeader($leader2);
        $staff2 = $this->createVerifiedUser();
        $committee2 = $this->createCommitteeWithHead($project2, $staff2);

        $response = $this->actingAs($staff2)
            ->post("/projects/{$project1->id}/committees/{$committee1->id}/activities/{$activity1->id}/review", [
                'action' => 'complete',
            ]);

        $response->assertForbidden();
    }

    /**
     * 9. Project Member cannot mark an Activity Completed.
     */
    public function test_project_member_cannot_mark_activity_completed(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $staff = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithHead($project, $staff);
        $activity = $this->createActivity($committee, $staff, ['status' => Activity::STATUS_UNDER_REVIEW]);

        $member = $this->createVerifiedUser();
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);

        $response = $this->actingAs($member)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/review", [
                'action' => 'complete',
            ]);

        $response->assertForbidden();
    }

    /**
     * 10. Project Member cannot Return an Activity for Revision.
     */
    public function test_project_member_cannot_return_activity_for_revision(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $staff = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithHead($project, $staff);
        $activity = $this->createActivity($committee, $staff, ['status' => Activity::STATUS_UNDER_REVIEW]);

        $member = $this->createVerifiedUser();
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);

        $response = $this->actingAs($member)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/review", [
                'action' => 'return',
                'review_feedback' => 'Member attempting to return activity.',
            ]);

        $response->assertForbidden();
    }

    /**
     * 11. Project Leader cannot use Staff review controls.
     */
    public function test_project_leader_cannot_use_staff_review_controls(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $staff = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithHead($project, $staff);
        $activity = $this->createActivity($committee, $staff, ['status' => Activity::STATUS_UNDER_REVIEW]);

        $response = $this->actingAs($leader)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/review", [
                'action' => 'complete',
            ]);

        $response->assertForbidden();
    }

    /**
     * 12. Staff cannot review an Activity outside their committee.
     */
    public function test_staff_cannot_review_activity_outside_their_committee(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $staffA = $this->createVerifiedUser();
        $committeeA = $this->createCommitteeWithHead($project, $staffA);
        $activityA = $this->createActivity($committeeA, $staffA, ['status' => Activity::STATUS_UNDER_REVIEW]);

        $staffB = $this->createVerifiedUser();
        $committeeB = $this->createCommitteeWithHead($project, $staffB);

        $response = $this->actingAs($staffB)
            ->post("/projects/{$project->id}/committees/{$committeeA->id}/activities/{$activityA->id}/review", [
                'action' => 'return',
                'review_feedback' => 'Unauthorized staff review attempt',
            ]);

        $response->assertForbidden();
    }

    /**
     * 13. Return for Revision requires feedback.
     */
    public function test_return_for_revision_requires_feedback(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $staff = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithHead($project, $staff);
        $activity = $this->createActivity($committee, $staff, ['status' => Activity::STATUS_UNDER_REVIEW]);

        $response = $this->actingAs($staff)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/review", [
                'action' => 'return',
                'review_feedback' => '', // empty feedback
            ]);

        $response->assertSessionHasErrors('review_feedback');

        $activity->refresh();
        $this->assertSame(Activity::STATUS_UNDER_REVIEW, $activity->status);
    }

    /**
     * 14. Returned Activity can be resubmitted.
     */
    public function test_returned_activity_can_be_resubmitted(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $staff = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithHead($project, $staff);
        $activity = $this->createActivity($committee, $staff, [
            'status' => Activity::STATUS_RETURNED_FOR_REVISION,
            'review_feedback' => 'Please include the final attendance list.',
            'reviewed_by' => $staff->id,
            'reviewed_at' => now()->subDay(),
        ]);

        $member = $this->createVerifiedUser();
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);
        $this->createTask($activity, $member);

        $response = $this->actingAs($member)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/submit", [
                'submission_notes' => 'Attendance list attached and verified.',
            ]);

        $response->assertRedirect("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}");

        $activity->refresh();
        $this->assertSame(Activity::STATUS_UNDER_REVIEW, $activity->status);
        $this->assertSame('Attendance list attached and verified.', $activity->submission_notes);
        // Previous feedback remains available for historical context
        $this->assertSame('Please include the final attendance list.', $activity->review_feedback);
    }

    /**
     * 15. Completed Activity cannot be resubmitted.
     */
    public function test_completed_activity_cannot_be_resubmitted(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $staff = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithHead($project, $staff);
        $activity = $this->createActivity($committee, $staff, ['status' => Activity::STATUS_COMPLETED]);

        $member = $this->createVerifiedUser();
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);
        $this->createTask($activity, $member);

        $response = $this->actingAs($member)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/submit", [
                'submission_notes' => 'Attempting to resubmit completed activity',
            ]);

        $response->assertSessionHasErrors('status');
    }

    /**
     * 16. Review timestamps and reviewer are recorded correctly.
     */
    public function test_review_timestamps_and_reviewer_are_recorded_correctly(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $staff = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithHead($project, $staff);
        $activity = $this->createActivity($committee, $staff, ['status' => Activity::STATUS_UNDER_REVIEW]);

        $this->actingAs($staff)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/review", [
                'action' => 'return_for_revision',
                'review_feedback' => 'Need budget receipt copy.',
            ]);

        $activity->refresh();
        $this->assertSame(Activity::STATUS_RETURNED_FOR_REVISION, $activity->status);
        $this->assertSame($staff->id, $activity->reviewed_by);
        $this->assertNotNull($activity->reviewed_at);
        $this->assertSame('Need budget receipt copy.', $activity->review_feedback);
    }

    /**
     * 17. Cross-project ID manipulation is blocked.
     */
    public function test_cross_project_id_manipulation_is_blocked_on_submit_and_review(): void
    {
        // Project 1
        $leader1 = $this->createVerifiedUser();
        $project1 = $this->createProjectWithLeader($leader1);
        $staff1 = $this->createVerifiedUser();
        $committee1 = $this->createCommitteeWithHead($project1, $staff1);
        $activity1 = $this->createActivity($committee1, $staff1, ['status' => Activity::STATUS_UNDER_REVIEW]);

        // Project 2
        $leader2 = $this->createVerifiedUser();
        $project2 = $this->createProjectWithLeader($leader2);
        $staff2 = $this->createVerifiedUser();
        $committee2 = $this->createCommitteeWithHead($project2, $staff2);

        // Mismatched project2/committee2 with activity1
        $this->actingAs($staff2)
            ->post("/projects/{$project2->id}/committees/{$committee2->id}/activities/{$activity1->id}/review", [
                'action' => 'complete',
            ])
            ->assertNotFound();

        $this->actingAs($staff2)
            ->post("/projects/{$project2->id}/committees/{$committee2->id}/activities/{$activity1->id}/submit", [
                'submission_notes' => 'Manipulated submit',
            ])
            ->assertNotFound();
    }

    // =========================================================================
    // 3. COMPLETE END-TO-END WORKFLOW TESTS
    // =========================================================================

    /**
     * Full member task completion -> Activity submission -> Staff Mark Completed
     */
    public function test_full_member_task_completion_to_staff_approval_workflow(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $staff = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithHead($project, $staff);
        $activity = $this->createActivity($committee, $staff, ['status' => Activity::STATUS_IN_PROGRESS]);

        $member = $this->createVerifiedUser();
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);
        $task = $this->createTask($activity, $member, ['status' => Task::STATUS_IN_PROGRESS]);

        // 1. Member updates their assigned task to Completed
        $this->actingAs($member)
            ->patch("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/tasks/{$task->id}", [
                'status' => Task::STATUS_COMPLETED,
            ])
            ->assertRedirect();

        $task->refresh();
        $this->assertSame(Task::STATUS_COMPLETED, $task->status);

        // Activity is NOT automatically completed
        $activity->refresh();
        $this->assertSame(Activity::STATUS_IN_PROGRESS, $activity->status);

        // 2. Member submits Activity for review
        $this->actingAs($member)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/submit", [
                'submission_notes' => 'All tasks completed and verified.',
            ])
            ->assertRedirect();

        $activity->refresh();
        $this->assertSame(Activity::STATUS_UNDER_REVIEW, $activity->status);

        // 3. Staff reviews and marks activity completed
        $this->actingAs($staff)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/complete", [
                'action' => 'complete',
            ])
            ->assertRedirect();

        $activity->refresh();
        $this->assertSame(Activity::STATUS_COMPLETED, $activity->status);
        $this->assertSame($staff->id, $activity->reviewed_by);
        $this->assertNotNull($activity->reviewed_at);

        // Task remains Completed
        $task->refresh();
        $this->assertSame(Task::STATUS_COMPLETED, $task->status);
    }

    /**
     * Member task update -> Submit -> Staff Return for Revision -> Member revise & resubmit -> Staff Complete
     */
    public function test_return_for_revision_revision_and_reapproval_cycle(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $staff = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithHead($project, $staff);
        $activity = $this->createActivity($committee, $staff, ['status' => Activity::STATUS_IN_PROGRESS]);

        $member = $this->createVerifiedUser();
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);
        $task = $this->createTask($activity, $member, ['status' => Task::STATUS_COMPLETED]);

        // 1. Initial submission
        $this->actingAs($member)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/submit", [
                'submission_notes' => 'First submission.',
            ]);

        $activity->refresh();
        $this->assertSame(Activity::STATUS_UNDER_REVIEW, $activity->status);

        // 2. Staff returns for revision with feedback
        $this->actingAs($staff)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/return", [
                'action' => 'return',
                'review_feedback' => 'Please update task description to match rubric.',
            ]);

        $activity->refresh();
        $this->assertSame(Activity::STATUS_RETURNED_FOR_REVISION, $activity->status);
        $this->assertSame('Please update task description to match rubric.', $activity->review_feedback);

        // 3. Member revises task status and resubmits activity
        $this->actingAs($member)
            ->patch("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/tasks/{$task->id}", [
                'status' => Task::STATUS_COMPLETED,
            ]);

        $this->actingAs($member)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/submit", [
                'submission_notes' => 'Addressed rubric issues.',
            ]);

        $activity->refresh();
        $this->assertSame(Activity::STATUS_UNDER_REVIEW, $activity->status);
        $this->assertSame('Addressed rubric issues.', $activity->submission_notes);

        // 4. Staff approves revised activity
        $this->actingAs($staff)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/complete", [
                'action' => 'complete',
            ]);

        $activity->refresh();
        $this->assertSame(Activity::STATUS_COMPLETED, $activity->status);
        $this->assertSame($staff->id, $activity->reviewed_by);
    }
}
