<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Models\User;
use App\Notifications\ActivityAssignedNotification;
use App\Notifications\ActivityReviewedNotification;
use App\Notifications\ActivitySubmittedForReviewNotification;
use App\Notifications\TaskAssignedNotification;
use App\Notifications\TaskDeadlineApproachingNotification;
use App\Notifications\TaskReviewedNotification;
use App\Notifications\TaskSubmittedForReviewNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class NotificationWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private User $leader;
    private User $staff;
    private User $member1;
    private User $member2;
    private User $otherStaff;
    private Project $project;
    private Committee $committee;
    private Activity $activity;

    protected function setUp(): void
    {
        parent::setUp();

        $this->leader = User::factory()->create(['email' => 'leader@carsu.edu.ph', 'email_verified_at' => now()]);
        $this->staff = User::factory()->create(['email' => 'staff@carsu.edu.ph', 'email_verified_at' => now()]);
        $this->member1 = User::factory()->create(['email' => 'member1@carsu.edu.ph', 'email_verified_at' => now()]);
        $this->member2 = User::factory()->create(['email' => 'member2@carsu.edu.ph', 'email_verified_at' => now()]);
        $this->otherStaff = User::factory()->create(['email' => 'otherstaff@carsu.edu.ph', 'email_verified_at' => now()]);

        $this->project = Project::create([
            'title' => 'Test Notification Project',
            'status' => Project::STATUS_ACTIVE,
            'start_date' => '2026-09-01',
            'end_date' => '2026-12-31',
            'created_by' => $this->leader->id,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->leader->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
            'committee_id' => null,
        ]);

        $this->committee = Committee::create([
            'project_id' => $this->project->id,
            'name' => 'Program Committee',
            'description' => 'Test committee',
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->staff->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
            'committee_id' => $this->committee->id,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->member1->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
            'committee_id' => $this->committee->id,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->member2->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
            'committee_id' => $this->committee->id,
        ]);

        $this->activity = Activity::create([
            'project_id' => $this->project->id,
            'committee_id' => $this->committee->id,
            'created_by' => $this->staff->id,
            'title' => 'Stage & Sound Setup',
            'status' => Activity::STATUS_IN_PROGRESS,
            'start_date' => '2026-09-15',
            'due_date' => '2026-10-15',
        ]);
    }

    // =========================================================================
    // 1. TASK ASSIGNMENT NOTIFICATIONS
    // =========================================================================

    public function test_assigned_member_receives_notification_on_task_creation(): void
    {
        Notification::fake();

        $response = $this->actingAs($this->staff)->post(
            route('projects.committees.activities.tasks.store', [$this->project, $this->committee, $this->activity]),
            [
                'title' => 'Configure Audio Mixers',
                'description' => 'Audio mixer checks',
                'due_date' => '2026-10-05',
                'status' => 'To Do',
                'assigned_to' => $this->member1->id,
                'requires_review' => false,
            ]
        );

        $response->assertRedirect();

        Notification::assertSentTo(
            $this->member1,
            TaskAssignedNotification::class,
            function (TaskAssignedNotification $notification) {
                return $notification->task->title === 'Configure Audio Mixers'
                    && $notification->activity->id === $this->activity->id
                    && $notification->project->id === $this->project->id;
            }
        );

        Notification::assertNotSentTo($this->member2, TaskAssignedNotification::class);
        Notification::assertNotSentTo($this->leader, TaskAssignedNotification::class);
    }

    public function test_assigned_member_receives_notification_when_reassigned(): void
    {
        $task = Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Set Stage Lights',
            'status' => Task::STATUS_IN_PROGRESS,
            'assigned_to' => $this->member1->id,
            'requires_review' => false,
            'due_date' => '2026-10-05',
        ]);

        Notification::fake();

        $response = $this->actingAs($this->staff)->patch(
            route('projects.committees.activities.tasks.update', [$this->project, $this->committee, $this->activity, $task]),
            [
                'assigned_to' => $this->member2->id,
            ]
        );

        $response->assertRedirect();

        Notification::assertSentTo($this->member2, TaskAssignedNotification::class);
        Notification::assertNotSentTo($this->member1, TaskAssignedNotification::class);
    }

    public function test_task_assigned_notification_persists_in_database_with_structured_data(): void
    {
        // Test real persistence without faking
        $this->actingAs($this->staff)->post(
            route('projects.committees.activities.tasks.store', [$this->project, $this->committee, $this->activity]),
            [
                'title' => 'Install Microphones',
                'description' => 'Test microphones on podium',
                'due_date' => '2026-10-05',
                'status' => 'To Do',
                'assigned_to' => $this->member1->id,
                'requires_review' => false,
            ]
        );

        $this->assertDatabaseHas('notifications', [
            'notifiable_type' => User::class,
            'notifiable_id' => $this->member1->id,
            'type' => TaskAssignedNotification::class,
        ]);

        $notification = $this->member1->notifications()->latest()->first();
        $this->assertNotNull($notification);
        $this->assertSame('task_assigned', $notification->data['notification_type']);
        $this->assertSame('Install Microphones', $notification->data['task']['title']);
        $this->assertSame($this->project->title, $notification->data['project']['title']);
        $this->assertSame($this->activity->title, $notification->data['activity']['title']);
    }

    // =========================================================================
    // 2. TASK SUBMISSION FOR REVIEW
    // =========================================================================

    public function test_committee_staff_receives_notification_when_task_submitted_for_review(): void
    {
        $task = Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Speaker Itinerary Document',
            'status' => Task::STATUS_IN_PROGRESS,
            'assigned_to' => $this->member1->id,
            'requires_review' => true,
            'due_date' => '2026-10-10',
        ]);

        Notification::fake();

        $response = $this->actingAs($this->member1)->post(
            route('projects.committees.activities.tasks.submit', [$this->project, $this->committee, $this->activity, $task])
        );

        $response->assertRedirect();

        Notification::assertSentTo(
            $this->staff,
            TaskSubmittedForReviewNotification::class,
            function (TaskSubmittedForReviewNotification $notification) use ($task) {
                return $notification->task->id === $task->id
                    && $notification->submittingMember->id === $this->member1->id;
            }
        );

        Notification::assertNotSentTo($this->member2, TaskSubmittedForReviewNotification::class);
        Notification::assertNotSentTo($this->otherStaff, TaskSubmittedForReviewNotification::class);
    }

    // =========================================================================
    // 3. TASK REVIEW RESULTS (Approved & Returned)
    // =========================================================================

    public function test_assigned_member_receives_approval_notification_when_task_approved(): void
    {
        $task = Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Stage Backdrop Design',
            'status' => Task::STATUS_UNDER_REVIEW,
            'assigned_to' => $this->member1->id,
            'requires_review' => true,
            'due_date' => '2026-10-10',
        ]);

        Notification::fake();

        $response = $this->actingAs($this->staff)->post(
            route('projects.committees.activities.tasks.approve', [$this->project, $this->committee, $this->activity, $task]),
            ['review_feedback' => null]
        );

        $response->assertRedirect();

        Notification::assertSentTo(
            $this->member1,
            TaskReviewedNotification::class,
            function (TaskReviewedNotification $notification) {
                return $notification->status === Task::STATUS_COMPLETED
                    && $notification->reviewer->id === $this->staff->id;
            }
        );
    }

    public function test_assigned_member_receives_return_notification_with_feedback(): void
    {
        $task = Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Cue Sheet Timing',
            'status' => Task::STATUS_UNDER_REVIEW,
            'assigned_to' => $this->member2->id,
            'requires_review' => true,
            'due_date' => '2026-10-10',
        ]);

        Notification::fake();

        $response = $this->actingAs($this->staff)->post(
            route('projects.committees.activities.tasks.return', [$this->project, $this->committee, $this->activity, $task]),
            ['review_feedback' => 'Adjust the opening sequence timing to 15 minutes.']
        );

        $response->assertRedirect();

        Notification::assertSentTo(
            $this->member2,
            TaskReviewedNotification::class,
            function (TaskReviewedNotification $notification) {
                return $notification->status === Task::STATUS_RETURNED
                    && $notification->feedback === 'Adjust the opening sequence timing to 15 minutes.'
                    && $notification->reviewer->id === $this->staff->id;
            }
        );

        Notification::assertNotSentTo($this->member1, TaskReviewedNotification::class);
    }

    // =========================================================================
    // 4. ACTIVITY SUBMISSION AND REVIEW NOTIFICATIONS
    // =========================================================================

    public function test_staff_receives_notification_on_activity_submission(): void
    {
        // Member must have a task to submit activity
        Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Member Task',
            'status' => Task::STATUS_IN_PROGRESS,
            'assigned_to' => $this->member1->id,
            'requires_review' => false,
        ]);

        Notification::fake();

        $response = $this->actingAs($this->member1)->post(
            route('projects.committees.activities.submit', [$this->project, $this->committee, $this->activity]),
            ['submission_notes' => 'All tasks completed and ready for review.']
        );

        $response->assertRedirect();

        Notification::assertSentTo(
            $this->staff,
            ActivitySubmittedForReviewNotification::class,
            function (ActivitySubmittedForReviewNotification $notification) {
                return $notification->activity->id === $this->activity->id
                    && $notification->submittingMember->id === $this->member1->id;
            }
        );

        Notification::assertNotSentTo($this->otherStaff, ActivitySubmittedForReviewNotification::class);
    }

    public function test_members_and_creator_receive_notification_on_activity_review_return(): void
    {
        Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Member Task',
            'status' => Task::STATUS_IN_PROGRESS,
            'assigned_to' => $this->member1->id,
            'requires_review' => false,
        ]);

        $this->activity->update(['status' => Activity::STATUS_UNDER_REVIEW]);

        Notification::fake();

        $response = $this->actingAs($this->staff)->post(
            route('projects.committees.activities.review', [$this->project, $this->committee, $this->activity]),
            [
                'action' => 'return',
                'review_feedback' => 'Need additional safety documentation.',
            ]
        );

        $response->assertRedirect();

        Notification::assertSentTo(
            $this->member1,
            ActivityReviewedNotification::class,
            function (ActivityReviewedNotification $notification) {
                return $notification->status === Activity::STATUS_RETURNED_FOR_REVISION
                    && $notification->feedback === 'Need additional safety documentation.'
                    && $notification->reviewer->id === $this->staff->id;
            }
        );
    }

    // =========================================================================
    // 5. DEADLINE REMINDER CONSOLE COMMAND
    // =========================================================================

    public function test_deadline_reminder_notifies_assignee_of_approaching_task(): void
    {
        // Approaching task (due tomorrow)
        $task = Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Upcoming Urgent Setup',
            'status' => Task::STATUS_IN_PROGRESS,
            'assigned_to' => $this->member1->id,
            'requires_review' => false,
            'due_date' => now()->addDay()->toDateString(),
        ]);

        // Far-future task (should not trigger reminder)
        Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Far Future Task',
            'status' => Task::STATUS_IN_PROGRESS,
            'assigned_to' => $this->member2->id,
            'requires_review' => false,
            'due_date' => now()->addDays(10)->toDateString(),
        ]);

        Notification::fake();

        $this->artisan('tasks:send-deadline-reminders', ['--days' => 2])
            ->assertSuccessful();

        Notification::assertSentTo(
            $this->member1,
            TaskDeadlineApproachingNotification::class,
            function (TaskDeadlineApproachingNotification $notification) use ($task) {
                return $notification->task->id === $task->id
                    && $notification->daysRemaining === 1;
            }
        );

        Notification::assertNotSentTo($this->member2, TaskDeadlineApproachingNotification::class);
    }

    public function test_deadline_reminder_ignores_completed_tasks(): void
    {
        Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Already Done Task',
            'status' => Task::STATUS_COMPLETED,
            'assigned_to' => $this->member1->id,
            'requires_review' => false,
            'due_date' => now()->addDay()->toDateString(),
        ]);

        Notification::fake();

        $this->artisan('tasks:send-deadline-reminders', ['--days' => 2])
            ->assertSuccessful();

        Notification::assertNotSentTo($this->member1, TaskDeadlineApproachingNotification::class);
    }

    public function test_deadline_reminder_prevents_duplicate_reminders_for_same_due_date(): void
    {
        Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Reminder Idempotency Task',
            'status' => Task::STATUS_IN_PROGRESS,
            'assigned_to' => $this->member1->id,
            'requires_review' => false,
            'due_date' => now()->addDay()->toDateString(),
        ]);

        // Run once with real database persistence
        $this->artisan('tasks:send-deadline-reminders', ['--days' => 2])
            ->expectsOutput('Processed task deadline reminders: 1 sent.')
            ->assertSuccessful();

        $this->assertSame(1, $this->member1->notifications()->count());

        // Run second time — should skip already notified task
        $this->artisan('tasks:send-deadline-reminders', ['--days' => 2])
            ->expectsOutput('Processed task deadline reminders: 0 sent.')
            ->assertSuccessful();

        $this->assertSame(1, $this->member1->notifications()->count());
    }

    // =========================================================================
    // 6. SCOPE AND CROSS-PROJECT / CROSS-COMMITTEE ISOLATION
    // =========================================================================

    public function test_notifications_do_not_leak_to_staff_from_other_projects(): void
    {
        $otherProject = Project::create([
            'title' => 'Other Project',
            'status' => Project::STATUS_ACTIVE,
            'start_date' => '2026-09-01',
            'end_date' => '2026-12-31',
            'created_by' => $this->otherStaff->id,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $otherProject->id,
            'user_id' => $this->otherStaff->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
            'committee_id' => null,
        ]);

        $task = Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Project-Scoped Task',
            'status' => Task::STATUS_IN_PROGRESS,
            'assigned_to' => $this->member1->id,
            'requires_review' => true,
            'due_date' => '2026-10-10',
        ]);

        Notification::fake();

        $this->actingAs($this->member1)->post(
            route('projects.committees.activities.tasks.submit', [$this->project, $this->committee, $this->activity, $task])
        );

        Notification::assertSentTo($this->staff, TaskSubmittedForReviewNotification::class);
        Notification::assertNotSentTo($this->otherStaff, TaskSubmittedForReviewNotification::class);
    }

    public function test_notifications_generate_email_messages_correctly(): void
    {
        $task = Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Email Check Task',
            'status' => Task::STATUS_IN_PROGRESS,
            'assigned_to' => $this->member1->id,
            'requires_review' => true,
            'due_date' => '2026-10-10',
        ]);

        // 1. TaskAssignedNotification: IN-APP ONLY (does NOT send email)
        $assignedNotif = new TaskAssignedNotification($task, $this->activity, $this->committee, $this->project, $this->staff);
        $this->assertEquals(['database'], $assignedNotif->via($this->member1));

        // 2. ActivityAssignedNotification: Sends email and in-app
        $actAssignedNotif = new ActivityAssignedNotification($this->activity, $this->committee, $this->project, $this->staff);
        $this->assertEquals(['database', 'mail'], $actAssignedNotif->via($this->member1));
        $actMail = $actAssignedNotif->toMail($this->member1);
        $this->assertStringContainsString('Activity Assigned', $actMail->subject);

        // 3. TaskDeadlineApproachingNotification (3-day or 1-day): Sends email and in-app
        $deadlineNotif = new TaskDeadlineApproachingNotification($task, $this->activity, $this->committee, $this->project, 3);
        $this->assertEquals(['database', 'mail'], $deadlineNotif->via($this->member1));
        $mail = $deadlineNotif->toMail($this->member1);
        $this->assertStringContainsString('Deadline Approaching', $mail->subject);

        // 4. TaskSubmittedForReviewNotification: Sends email to reviewer and in-app
        $submittedNotif = new TaskSubmittedForReviewNotification($task, $this->activity, $this->committee, $this->project, $this->member1);
        $this->assertEquals(['database', 'mail'], $submittedNotif->via($this->staff));
        $mail = $submittedNotif->toMail($this->staff);
        $this->assertStringContainsString('Task Submitted for Review', $mail->subject);

        // 5. TaskReviewedNotification: Returned sends email and in-app; Completed is in-app only
        $reviewedReturnedNotif = new TaskReviewedNotification($task, $this->activity, $this->committee, $this->project, $this->staff, Task::STATUS_RETURNED, 'Please fix section 2.');
        $this->assertEquals(['database', 'mail'], $reviewedReturnedNotif->via($this->member1));
        $mail = $reviewedReturnedNotif->toMail($this->member1);
        $this->assertStringContainsString('Task Returned for Revision', $mail->subject);

        $reviewedCompletedNotif = new TaskReviewedNotification($task, $this->activity, $this->committee, $this->project, $this->staff, Task::STATUS_COMPLETED);
        $this->assertEquals(['database'], $reviewedCompletedNotif->via($this->member1));

        // 6. ActivitySubmittedForReviewNotification: Sends email and in-app
        $activitySubNotif = new ActivitySubmittedForReviewNotification($this->activity, $this->committee, $this->project, $this->member1);
        $this->assertEquals(['database', 'mail'], $activitySubNotif->via($this->staff));
        $mail = $activitySubNotif->toMail($this->staff);
        $this->assertStringContainsString('Activity Submitted for Review', $mail->subject);

        // 7. ActivityReviewedNotification: Returned sends email and in-app; Completed is in-app only
        $activityRevReturnedNotif = new ActivityReviewedNotification($this->activity, $this->committee, $this->project, $this->staff, Activity::STATUS_RETURNED_FOR_REVISION, 'Revise dates');
        $this->assertEquals(['database', 'mail'], $activityRevReturnedNotif->via($this->member1));
        $mail = $activityRevReturnedNotif->toMail($this->member1);
        $this->assertStringContainsString('Activity Returned for Revision', $mail->subject);

        $activityRevCompletedNotif = new ActivityReviewedNotification($this->activity, $this->committee, $this->project, $this->staff, Activity::STATUS_COMPLETED);
        $this->assertEquals(['database'], $activityRevCompletedNotif->via($this->member1));
    }

    // =========================================================================
    // 7. EMAIL NOTIFICATION RULES & DEADLINE REMINDER TESTS
    // =========================================================================

    public function test_activity_assignment_sends_email_and_persists_in_app(): void
    {
        Notification::fake();

        $response = $this->actingAs($this->staff)->post(
            route('projects.committees.activities.store', [$this->project, $this->committee]),
            [
                'title' => 'New Logistics Activity',
                'description' => 'Handle audio visual setup',
                'start_date' => '2026-10-01',
                'due_date' => '2026-10-20',
                'status' => 'To Do',
            ]
        );

        $response->assertRedirect();

        // Committee members (member1 and member2) receive ActivityAssignedNotification
        Notification::assertSentTo(
            $this->member1,
            ActivityAssignedNotification::class,
            function (ActivityAssignedNotification $notification) {
                return $notification->activity->title === 'New Logistics Activity'
                    && in_array('mail', $notification->via($this->member1), true)
                    && in_array('database', $notification->via($this->member1), true);
            }
        );

        Notification::assertSentTo(
            $this->member2,
            ActivityAssignedNotification::class
        );
    }

    public function test_task_assignment_does_not_send_email(): void
    {
        $task = Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Cabling and Mic Tests',
            'status' => Task::STATUS_TO_DO,
            'assigned_to' => $this->member1->id,
            'requires_review' => false,
            'due_date' => '2026-10-10',
        ]);

        $notification = new TaskAssignedNotification($task, $this->activity, $this->committee, $this->project);
        $channels = $notification->via($this->member1);

        $this->assertContains('database', $channels);
        $this->assertNotContains('mail', $channels, 'Task assignment must NOT include mail channel.');
    }

    public function test_3_day_deadline_reminder_sends_exactly_once(): void
    {
        $task = Task::create([
            'activity_id' => $this->activity->id,
            'title' => '3-Day Due Task',
            'status' => Task::STATUS_IN_PROGRESS,
            'assigned_to' => $this->member1->id,
            'requires_review' => false,
            'due_date' => now()->startOfDay()->addDays(3)->toDateString(),
        ]);

        Notification::fake();

        // First run: sends 3-day reminder
        $this->artisan('tasks:send-deadline-reminders')
            ->assertSuccessful();

        Notification::assertSentTo(
            $this->member1,
            TaskDeadlineApproachingNotification::class,
            function (TaskDeadlineApproachingNotification $notification) use ($task) {
                return $notification->task->id === $task->id
                    && $notification->daysRemaining === 3
                    && in_array('mail', $notification->via($this->member1), true)
                    && in_array('database', $notification->via($this->member1), true);
            }
        );

        // Real persistence test to verify exact-once idempotency
        Notification::swap(new \Illuminate\Notifications\ChannelManager(app()));

        // Run with database persistence
        $this->artisan('tasks:send-deadline-reminders')
            ->expectsOutput('Processed task deadline reminders: 1 sent.')
            ->assertSuccessful();

        $this->assertSame(1, $this->member1->notifications()->count());

        // Re-run: must NOT duplicate
        $this->artisan('tasks:send-deadline-reminders')
            ->expectsOutput('Processed task deadline reminders: 0 sent.')
            ->assertSuccessful();

        $this->assertSame(1, $this->member1->notifications()->count());
    }

    public function test_1_day_deadline_reminder_sends_exactly_once(): void
    {
        $task = Task::create([
            'activity_id' => $this->activity->id,
            'title' => '1-Day Due Task',
            'status' => Task::STATUS_IN_PROGRESS,
            'assigned_to' => $this->member1->id,
            'requires_review' => false,
            'due_date' => now()->startOfDay()->addDays(1)->toDateString(),
        ]);

        Notification::fake();

        $this->artisan('tasks:send-deadline-reminders')
            ->assertSuccessful();

        Notification::assertSentTo(
            $this->member1,
            TaskDeadlineApproachingNotification::class,
            function (TaskDeadlineApproachingNotification $notification) use ($task) {
                return $notification->task->id === $task->id
                    && $notification->daysRemaining === 1
                    && in_array('mail', $notification->via($this->member1), true);
            }
        );

        // Real persistence check
        Notification::swap(new \Illuminate\Notifications\ChannelManager(app()));

        $this->artisan('tasks:send-deadline-reminders')
            ->expectsOutput('Processed task deadline reminders: 1 sent.')
            ->assertSuccessful();

        $this->assertSame(1, $this->member1->notifications()->count());

        // Re-run
        $this->artisan('tasks:send-deadline-reminders')
            ->expectsOutput('Processed task deadline reminders: 0 sent.')
            ->assertSuccessful();

        $this->assertSame(1, $this->member1->notifications()->count());
    }

    public function test_completed_tasks_do_not_receive_deadline_reminders(): void
    {
        // 3-day due completed task
        Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Completed 3-Day Task',
            'status' => Task::STATUS_COMPLETED,
            'assigned_to' => $this->member1->id,
            'requires_review' => false,
            'due_date' => now()->startOfDay()->addDays(3)->toDateString(),
        ]);

        // 1-day due completed task
        Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Completed 1-Day Task',
            'status' => Task::STATUS_COMPLETED,
            'assigned_to' => $this->member2->id,
            'requires_review' => false,
            'due_date' => now()->startOfDay()->addDays(1)->toDateString(),
        ]);

        Notification::fake();

        $this->artisan('tasks:send-deadline-reminders')
            ->expectsOutput('Processed task deadline reminders: 0 sent.')
            ->assertSuccessful();

        Notification::assertNothingSent();
    }

    public function test_overdue_tasks_do_not_receive_deadline_reminders(): void
    {
        // Overdue yesterday
        Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Past Deadline Task 1',
            'status' => Task::STATUS_IN_PROGRESS,
            'assigned_to' => $this->member1->id,
            'requires_review' => false,
            'due_date' => now()->startOfDay()->subDay()->toDateString(),
        ]);

        // Overdue 3 days ago
        Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Past Deadline Task 2',
            'status' => Task::STATUS_IN_PROGRESS,
            'assigned_to' => $this->member2->id,
            'requires_review' => false,
            'due_date' => now()->startOfDay()->subDays(3)->toDateString(),
        ]);

        Notification::fake();

        $this->artisan('tasks:send-deadline-reminders')
            ->expectsOutput('Processed task deadline reminders: 0 sent.')
            ->assertSuccessful();

        Notification::assertNothingSent();
    }

    public function test_re_running_reminder_command_does_not_duplicate_an_already_sent_reminder(): void
    {
        // Task due in 3 days
        $task = Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Multi-interval Task',
            'status' => Task::STATUS_IN_PROGRESS,
            'assigned_to' => $this->member1->id,
            'requires_review' => false,
            'due_date' => now()->startOfDay()->addDays(3)->toDateString(),
        ]);

        // First execution: sends 3-day reminder
        $this->artisan('tasks:send-deadline-reminders')
            ->expectsOutput('Processed task deadline reminders: 1 sent.')
            ->assertSuccessful();

        // Repeated run on same interval: 0 sent
        $this->artisan('tasks:send-deadline-reminders')
            ->expectsOutput('Processed task deadline reminders: 0 sent.')
            ->assertSuccessful();

        $this->assertSame(1, $this->member1->notifications()->count());

        // Fast-forward task due date to 1-day remaining
        $task->update(['due_date' => now()->startOfDay()->addDay()->toDateString()]);

        // Next execution at 1-day interval: sends 1-day reminder
        $this->artisan('tasks:send-deadline-reminders')
            ->expectsOutput('Processed task deadline reminders: 1 sent.')
            ->assertSuccessful();

        // Repeated run at 1-day interval: 0 sent
        $this->artisan('tasks:send-deadline-reminders')
            ->expectsOutput('Processed task deadline reminders: 0 sent.')
            ->assertSuccessful();

        // Total notifications for this task is exactly 2 (one 3-day, one 1-day)
        $this->assertSame(2, $this->member1->notifications()->count());
    }

    public function test_submission_requiring_review_sends_email_to_appropriate_reviewer_only(): void
    {
        $task = Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Deliverable Review Document',
            'status' => Task::STATUS_IN_PROGRESS,
            'assigned_to' => $this->member1->id,
            'requires_review' => true,
            'due_date' => '2026-10-10',
        ]);

        Notification::fake();

        $this->actingAs($this->member1)->post(
            route('projects.committees.activities.tasks.submit', [$this->project, $this->committee, $this->activity, $task])
        );

        // Only committee staff receives the review notification
        Notification::assertSentTo(
            $this->staff,
            TaskSubmittedForReviewNotification::class,
            function (TaskSubmittedForReviewNotification $notification) {
                return in_array('mail', $notification->via($this->staff), true)
                    && in_array('database', $notification->via($this->staff), true);
            }
        );

        Notification::assertNotSentTo($this->member2, TaskSubmittedForReviewNotification::class);
        Notification::assertNotSentTo($this->otherStaff, TaskSubmittedForReviewNotification::class);
        Notification::assertNotSentTo($this->leader, TaskSubmittedForReviewNotification::class);
    }

    public function test_returned_submission_sends_email_to_responsible_user(): void
    {
        $task = Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Budget Proposal Sheet',
            'status' => Task::STATUS_UNDER_REVIEW,
            'assigned_to' => $this->member1->id,
            'requires_review' => true,
            'due_date' => '2026-10-10',
        ]);

        Notification::fake();

        $this->actingAs($this->staff)->post(
            route('projects.committees.activities.tasks.return', [$this->project, $this->committee, $this->activity, $task]),
            ['review_feedback' => 'Please provide cost breakdown for sound equipment.']
        );

        // Responsible user (member1) receives the returned for revision email
        Notification::assertSentTo(
            $this->member1,
            TaskReviewedNotification::class,
            function (TaskReviewedNotification $notification) {
                return $notification->status === Task::STATUS_RETURNED
                    && in_array('mail', $notification->via($this->member1), true)
                    && in_array('database', $notification->via($this->member1), true);
            }
        );

        Notification::assertNotSentTo($this->member2, TaskReviewedNotification::class);
        Notification::assertNotSentTo($this->leader, TaskReviewedNotification::class);
    }

    public function test_approved_completion_does_not_send_email_and_remains_in_app_only(): void
    {
        $task = Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Signage Printing',
            'status' => Task::STATUS_UNDER_REVIEW,
            'assigned_to' => $this->member1->id,
            'requires_review' => true,
            'due_date' => '2026-10-10',
        ]);

        $completedNotif = new TaskReviewedNotification(
            $task,
            $this->activity,
            $this->committee,
            $this->project,
            $this->staff,
            Task::STATUS_COMPLETED
        );

        $channels = $completedNotif->via($this->member1);
        $this->assertContains('database', $channels);
        $this->assertNotContains('mail', $channels, 'Task completion must NOT send email.');

        $activityCompletedNotif = new ActivityReviewedNotification(
            $this->activity,
            $this->committee,
            $this->project,
            $this->staff,
            Activity::STATUS_COMPLETED
        );

        $actChannels = $activityCompletedNotif->via($this->member1);
        $this->assertContains('database', $actChannels);
        $this->assertNotContains('mail', $actChannels, 'Activity completion must NOT send email.');
    }
}
