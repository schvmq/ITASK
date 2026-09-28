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

/**
 * Day 11 — Step 1: Activity Submission + Optional Task Review Backend Tests
 *
 * Verifies:
 * - Optional task review per task (`requires_review` boolean, default false)
 * - Configuration permissions for `requires_review` (Leader/Staff allowed, Member disallowed)
 * - Normal task workflow without review (`To Do` -> `In Progress` -> `Completed`)
 * - Review-required task workflow (`To Do` -> `In Progress` -> `Under Review` -> `Completed` / `Returned` -> `In Progress`)
 * - Explicit actions: submit, approve, return, resubmit
 * - Strict role authorization and boundary enforcement
 * - Activity-level submission, approval, return, and resubmission
 */
class TaskReviewWorkflowTest extends TestCase
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
            'description' => 'Test project.',
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

    protected function assignRole(Project $project, User $user, string $role, ?int $committeeId = null): void
    {
        ProjectRoleAssignment::create([
            'project_id'   => $project->id,
            'user_id'      => $user->id,
            'role'         => $role,
            'committee_id' => $committeeId,
        ]);
    }

    protected function createCommitteeWithStaff(Project $project, User $staff): Committee
    {
        $committee = Committee::create([
            'project_id'  => $project->id,
            'name'        => 'Committee ' . uniqid(),
            'description' => 'Test committee.',
        ]);

        $this->assignRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF, $committee->id);

        return $committee;
    }

    protected function createActivity(Committee $committee, User $creator, array $attributes = []): Activity
    {
        return Activity::create(array_merge([
            'project_id'   => $committee->project_id,
            'committee_id' => $committee->id,
            'created_by'   => $creator->id,
            'title'        => 'Activity ' . uniqid(),
            'status'       => Activity::STATUS_IN_PROGRESS,
        ], $attributes));
    }

    protected function createTask(Activity $activity, ?User $assignee = null, array $attributes = []): Task
    {
        return Task::create(array_merge([
            'activity_id'     => $activity->id,
            'assigned_to'     => $assignee?->id,
            'title'           => 'Task ' . uniqid(),
            'description'     => 'Task description.',
            'status'          => Task::STATUS_TO_DO,
            'due_date'        => now()->addDays(5)->format('Y-m-d'),
            'requires_review' => false,
        ], $attributes));
    }

    // =========================================================================
    // SECTION 1 — TASK REVIEW CONFIGURATION
    // =========================================================================

    public function test_leader_can_configure_requires_review_on_create_and_update(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity = $this->createActivity($committee, $staff);

        // Create with requires_review = true
        $storeResponse = $this->actingAs($leader)->post(
            route('projects.committees.activities.tasks.store', [$project, $committee, $activity]),
            [
                'title' => 'Review Required Task',
                'requires_review' => true,
            ]
        );
        $storeResponse->assertRedirect();

        $task = Task::where('title', 'Review Required Task')->firstOrFail();
        $this->assertTrue($task->requires_review);

        // Update to requires_review = false
        $updateResponse = $this->actingAs($leader)->patch(
            route('projects.committees.activities.tasks.update', [$project, $committee, $activity, $task]),
            [
                'requires_review' => false,
            ]
        );
        $updateResponse->assertRedirect();
        $this->assertFalse($task->fresh()->requires_review);
    }

    public function test_authorized_staff_can_configure_requires_review(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity = $this->createActivity($committee, $staff);

        $storeResponse = $this->actingAs($staff)->post(
            route('projects.committees.activities.tasks.store', [$project, $committee, $activity]),
            [
                'title' => 'Staff Configured Task',
                'requires_review' => true,
            ]
        );
        $storeResponse->assertRedirect();

        $task = Task::where('title', 'Staff Configured Task')->firstOrFail();
        $this->assertTrue($task->requires_review);
    }

    public function test_default_requires_review_is_false(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity = $this->createActivity($committee, $staff);

        $storeResponse = $this->actingAs($staff)->post(
            route('projects.committees.activities.tasks.store', [$project, $committee, $activity]),
            [
                'title' => 'Normal Default Task',
            ]
        );
        $storeResponse->assertRedirect();

        $task = Task::where('title', 'Normal Default Task')->firstOrFail();
        $this->assertFalse($task->requires_review);
    }

    public function test_unauthorized_member_cannot_configure_requires_review(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $this->assignRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);
        $activity = $this->createActivity($committee, $staff);

        $task = $this->createTask($activity, $member, ['requires_review' => false]);

        $updateResponse = $this->actingAs($member)->patch(
            route('projects.committees.activities.tasks.update', [$project, $committee, $activity, $task]),
            [
                'requires_review' => true,
                'status' => Task::STATUS_IN_PROGRESS,
            ]
        );

        // Forbidden because Member cannot manage configuration fields
        $updateResponse->assertForbidden();
        $this->assertFalse($task->fresh()->requires_review);
    }

    // =========================================================================
    // SECTION 2 — NORMAL TASK WORKFLOW (requires_review = false)
    // =========================================================================

    public function test_member_can_complete_normal_task_without_review(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $this->assignRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);
        $activity = $this->createActivity($committee, $staff);

        $task = $this->createTask($activity, $member, [
            'status' => Task::STATUS_TO_DO,
            'requires_review' => false,
        ]);

        // 1. Move to In Progress
        $inProgressResponse = $this->actingAs($member)->patch(
            route('projects.committees.activities.tasks.update', [$project, $committee, $activity, $task]),
            ['status' => Task::STATUS_IN_PROGRESS]
        );
        $inProgressResponse->assertRedirect();
        $this->assertSame(Task::STATUS_IN_PROGRESS, $task->fresh()->status);

        // 2. Move directly to Completed (no review required)
        $completedResponse = $this->actingAs($member)->patch(
            route('projects.committees.activities.tasks.update', [$project, $committee, $activity, $task]),
            ['status' => Task::STATUS_COMPLETED]
        );
        $completedResponse->assertRedirect();
        $this->assertSame(Task::STATUS_COMPLETED, $task->fresh()->status);
    }

    public function test_normal_task_cannot_be_submitted_to_review_endpoint(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $this->assignRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);
        $activity = $this->createActivity($committee, $staff);

        $task = $this->createTask($activity, $member, [
            'status' => Task::STATUS_IN_PROGRESS,
            'requires_review' => false,
        ]);

        $response = $this->actingAs($member)->post(
            route('projects.committees.activities.tasks.submit', [$project, $committee, $activity, $task])
        );

        $response->assertSessionHasErrors('requires_review');
        $this->assertSame(Task::STATUS_IN_PROGRESS, $task->fresh()->status);
    }

    // =========================================================================
    // SECTION 3 — REVIEW-REQUIRED TASK WORKFLOW (requires_review = true)
    // =========================================================================

    public function test_assigned_member_can_submit_review_required_task(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $this->assignRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);
        $activity = $this->createActivity($committee, $staff);

        $task = $this->createTask($activity, $member, [
            'status' => Task::STATUS_IN_PROGRESS,
            'requires_review' => true,
        ]);

        $response = $this->actingAs($member)->post(
            route('projects.committees.activities.tasks.submit', [$project, $committee, $activity, $task]),
            ['submission_notes' => 'Draft is ready for inspection.']
        );

        $response->assertRedirect();
        $this->assertSame(Task::STATUS_UNDER_REVIEW, $task->fresh()->status);
    }

    public function test_member_cannot_directly_complete_review_required_task(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $this->assignRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);
        $activity = $this->createActivity($committee, $staff);

        $task = $this->createTask($activity, $member, [
            'status' => Task::STATUS_IN_PROGRESS,
            'requires_review' => true,
        ]);

        $response = $this->actingAs($member)->patch(
            route('projects.committees.activities.tasks.update', [$project, $committee, $activity, $task]),
            ['status' => Task::STATUS_COMPLETED]
        );

        $response->assertSessionHasErrors('status');
        $this->assertNotSame(Task::STATUS_COMPLETED, $task->fresh()->status);
    }

    public function test_authorized_staff_can_approve_task_under_review(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $this->assignRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);
        $activity = $this->createActivity($committee, $staff);

        $task = $this->createTask($activity, $member, [
            'status' => Task::STATUS_UNDER_REVIEW,
            'requires_review' => true,
        ]);

        $response = $this->actingAs($staff)->post(
            route('projects.committees.activities.tasks.approve', [$project, $committee, $activity, $task])
        );

        $response->assertRedirect();
        $this->assertSame(Task::STATUS_COMPLETED, $task->fresh()->status);
    }

    public function test_authorized_staff_can_return_task_for_revision(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $this->assignRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);
        $activity = $this->createActivity($committee, $staff);

        $task = $this->createTask($activity, $member, [
            'status' => Task::STATUS_UNDER_REVIEW,
            'requires_review' => true,
        ]);

        $response = $this->actingAs($staff)->post(
            route('projects.committees.activities.tasks.return', [$project, $committee, $activity, $task]),
            ['review_feedback' => 'Please revise section 2.']
        );

        $response->assertRedirect();
        $this->assertSame(Task::STATUS_RETURNED, $task->fresh()->status);
    }

    public function test_assigned_member_can_resubmit_returned_task(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $this->assignRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);
        $activity = $this->createActivity($committee, $staff);

        $task = $this->createTask($activity, $member, [
            'status' => Task::STATUS_RETURNED,
            'requires_review' => true,
        ]);

        // 1. Resubmit returned task -> returns task to In Progress
        $resubmitResponse = $this->actingAs($member)->post(
            route('projects.committees.activities.tasks.resubmit', [$project, $committee, $activity, $task]),
            ['submission_notes' => 'Working on revisions.']
        );

        $resubmitResponse->assertRedirect();
        $this->assertSame(Task::STATUS_IN_PROGRESS, $task->fresh()->status);

        // 2. Member can then submit again once revised
        $submitAgainResponse = $this->actingAs($member)->post(
            route('projects.committees.activities.tasks.submit', [$project, $committee, $activity, $task]),
            ['submission_notes' => 'Revised and ready.']
        );

        $submitAgainResponse->assertRedirect();
        $this->assertSame(Task::STATUS_UNDER_REVIEW, $task->fresh()->status);
    }

    // =========================================================================
    // SECTION 4 — AUTHORIZATION & SECURITY BOUNDARIES
    // =========================================================================

    public function test_member_cannot_approve_task(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $this->assignRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);
        $activity = $this->createActivity($committee, $staff);

        $task = $this->createTask($activity, $member, [
            'status' => Task::STATUS_UNDER_REVIEW,
            'requires_review' => true,
        ]);

        $response = $this->actingAs($member)->post(
            route('projects.committees.activities.tasks.approve', [$project, $committee, $activity, $task])
        );

        $response->assertForbidden();
        $this->assertSame(Task::STATUS_UNDER_REVIEW, $task->fresh()->status);
    }

    public function test_member_cannot_return_task(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $this->assignRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);
        $activity = $this->createActivity($committee, $staff);

        $task = $this->createTask($activity, $member, [
            'status' => Task::STATUS_UNDER_REVIEW,
            'requires_review' => true,
        ]);

        $response = $this->actingAs($member)->post(
            route('projects.committees.activities.tasks.return', [$project, $committee, $activity, $task])
        );

        $response->assertForbidden();
        $this->assertSame(Task::STATUS_UNDER_REVIEW, $task->fresh()->status);
    }

    public function test_member_cannot_submit_another_members_task(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $memberA = $this->createVerifiedUser();
        $memberB = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $this->assignRole($project, $memberA, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);
        $this->assignRole($project, $memberB, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);
        $activity = $this->createActivity($committee, $staff);

        $task = $this->createTask($activity, $memberA, [
            'status' => Task::STATUS_IN_PROGRESS,
            'requires_review' => true,
        ]);

        $response = $this->actingAs($memberB)->post(
            route('projects.committees.activities.tasks.submit', [$project, $committee, $activity, $task])
        );

        $response->assertForbidden();
        $this->assertSame(Task::STATUS_IN_PROGRESS, $task->fresh()->status);
    }

    public function test_staff_cannot_review_another_committees_task(): void
    {
        $leader = $this->createVerifiedUser();
        $staff1 = $this->createVerifiedUser();
        $staff2 = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee1 = $this->createCommitteeWithStaff($project, $staff1);
        $committee2 = $this->createCommitteeWithStaff($project, $staff2);
        $activity1 = $this->createActivity($committee1, $staff1);

        $task = $this->createTask($activity1, null, [
            'status' => Task::STATUS_UNDER_REVIEW,
            'requires_review' => true,
        ]);

        // Staff 2 attempts to approve Committee 1's task
        $response = $this->actingAs($staff2)->post(
            route('projects.committees.activities.tasks.approve', [$project, $committee1, $activity1, $task])
        );

        $response->assertForbidden();
        $this->assertSame(Task::STATUS_UNDER_REVIEW, $task->fresh()->status);
    }

    public function test_cross_project_task_review_access_is_rejected(): void
    {
        $leader1 = $this->createVerifiedUser();
        $staff1 = $this->createVerifiedUser();
        $project1 = $this->createProjectWithLeader($leader1);
        $committee1 = $this->createCommitteeWithStaff($project1, $staff1);
        $activity1 = $this->createActivity($committee1, $staff1);
        $task1 = $this->createTask($activity1, null, [
            'status' => Task::STATUS_UNDER_REVIEW,
            'requires_review' => true,
        ]);

        $leader2 = $this->createVerifiedUser();
        $staff2 = $this->createVerifiedUser();
        $project2 = $this->createProjectWithLeader($leader2);
        $committee2 = $this->createCommitteeWithStaff($project2, $staff2);

        // Staff from project 2 attempts to approve task in project 1
        $response = $this->actingAs($staff2)->post(
            "/projects/{$project2->id}/committees/{$committee2->id}/activities/{$activity1->id}/tasks/{$task1->id}/approve"
        );

        $response->assertNotFound();
    }

    public function test_completed_task_cannot_be_submitted_again(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $this->assignRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);
        $activity = $this->createActivity($committee, $staff);

        $task = $this->createTask($activity, $member, [
            'status' => Task::STATUS_COMPLETED,
            'requires_review' => true,
        ]);

        $response = $this->actingAs($member)->post(
            route('projects.committees.activities.tasks.submit', [$project, $committee, $activity, $task])
        );

        $response->assertSessionHasErrors('status');
        $this->assertSame(Task::STATUS_COMPLETED, $task->fresh()->status);
    }

    public function test_task_must_be_under_review_to_be_approved_or_returned(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity = $this->createActivity($committee, $staff);

        $task = $this->createTask($activity, null, [
            'status' => Task::STATUS_IN_PROGRESS,
            'requires_review' => true,
        ]);

        $responseApprove = $this->actingAs($staff)->post(
            route('projects.committees.activities.tasks.approve', [$project, $committee, $activity, $task])
        );
        $responseApprove->assertSessionHasErrors('status');

        $responseReturn = $this->actingAs($staff)->post(
            route('projects.committees.activities.tasks.return', [$project, $committee, $activity, $task])
        );
        $responseReturn->assertSessionHasErrors('status');
    }

    // =========================================================================
    // SECTION 5 — ACTIVITY-LEVEL REVIEW WORKFLOW
    // =========================================================================

    public function test_activity_level_review_cycle(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $this->assignRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);

        $activity = $this->createActivity($committee, $staff, ['status' => Activity::STATUS_IN_PROGRESS]);
        $task = $this->createTask($activity, $member, ['status' => Task::STATUS_COMPLETED]);

        // 1. Authorized Member submits activity for review
        $submitResponse = $this->actingAs($member)->post(
            route('projects.committees.activities.submit', [$project, $committee, $activity]),
            ['submission_notes' => 'Activity work done.']
        );
        $submitResponse->assertRedirect();
        $this->assertSame(Activity::STATUS_UNDER_REVIEW, $activity->fresh()->status);

        // 2. Staff returns activity for revision
        $returnResponse = $this->actingAs($staff)->post(
            route('projects.committees.activities.return', [$project, $committee, $activity]),
            [
                'action' => 'return',
                'review_feedback' => 'Need additional documentation.',
            ]
        );
        $returnResponse->assertRedirect();
        $this->assertSame(Activity::STATUS_RETURNED_FOR_REVISION, $activity->fresh()->status);

        // 3. Member resubmits returned activity
        $resubmitResponse = $this->actingAs($member)->post(
            route('projects.committees.activities.submit', [$project, $committee, $activity]),
            ['submission_notes' => 'Documentation added.']
        );
        $resubmitResponse->assertRedirect();
        $this->assertSame(Activity::STATUS_UNDER_REVIEW, $activity->fresh()->status);

        // 4. Staff approves activity
        $completeResponse = $this->actingAs($staff)->post(
            route('projects.committees.activities.complete', [$project, $committee, $activity]),
            ['action' => 'complete']
        );
        $completeResponse->assertRedirect();
        $this->assertSame(Activity::STATUS_COMPLETED, $activity->fresh()->status);
    }
}
