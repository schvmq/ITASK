<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Models\User;
use App\Notifications\ActivityReminderNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class ManualActivityReminderTest extends TestCase
{
    use RefreshDatabase;

    private User $leader;
    private User $staff;
    private User $taskAssignee1;     // assigned to a task under the activity
    private User $taskAssignee2;     // assigned to a task under the activity
    private User $committeeOnlyMember; // committee member NOT assigned to any task
    private User $otherStaff;
    private User $otherMember;
    private User $unassignedUser;
    private Project $project;
    private Committee $committee;
    private Activity $activity;
    private Task $task1;
    private Task $task2;

    protected function setUp(): void
    {
        parent::setUp();

        $this->leader = User::factory()->create(['name' => 'Project Leader', 'email' => 'leader@carsu.edu.ph', 'email_verified_at' => now()]);
        $this->staff = User::factory()->create(['name' => 'Committee Staff', 'email' => 'staff@carsu.edu.ph', 'email_verified_at' => now()]);
        $this->taskAssignee1 = User::factory()->create(['name' => 'Task Assignee One', 'email' => 'assignee1@carsu.edu.ph', 'email_verified_at' => now()]);
        $this->taskAssignee2 = User::factory()->create(['name' => 'Task Assignee Two', 'email' => 'assignee2@carsu.edu.ph', 'email_verified_at' => now()]);
        $this->committeeOnlyMember = User::factory()->create(['name' => 'Committee Only Member', 'email' => 'committeeonly@carsu.edu.ph', 'email_verified_at' => now()]);
        $this->otherStaff = User::factory()->create(['name' => 'Other Staff', 'email' => 'otherstaff@carsu.edu.ph', 'email_verified_at' => now()]);
        $this->otherMember = User::factory()->create(['name' => 'Other Member', 'email' => 'othermember@carsu.edu.ph', 'email_verified_at' => now()]);
        $this->unassignedUser = User::factory()->create(['name' => 'Unassigned User', 'email' => 'unassigned@carsu.edu.ph', 'email_verified_at' => now()]);

        // Create Project
        $this->project = Project::create([
            'title' => 'Annual College Foundation Day',
            'status' => Project::STATUS_ACTIVE,
            'start_date' => '2026-09-01',
            'end_date' => '2026-12-31',
            'created_by' => $this->leader->id,
        ]);

        // Leader assignment
        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->leader->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
            'committee_id' => null,
        ]);

        // Committee
        $this->committee = Committee::create([
            'project_id' => $this->project->id,
            'name' => 'Logistics Committee',
            'description' => 'Logistics handling committee',
        ]);

        // Staff assignment to this committee
        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->staff->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
            'committee_id' => $this->committee->id,
        ]);

        // taskAssignee1 and taskAssignee2 are committee members (and will be assigned tasks)
        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->taskAssignee1->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
            'committee_id' => $this->committee->id,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->taskAssignee2->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
            'committee_id' => $this->committee->id,
        ]);

        // committeeOnlyMember is in the same committee but is NOT assigned to any task
        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->committeeOnlyMember->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
            'committee_id' => $this->committee->id,
        ]);

        // Other committee with other staff and member (completely separate)
        $otherCommittee = Committee::create([
            'project_id' => $this->project->id,
            'name' => 'Marketing Committee',
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->otherStaff->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
            'committee_id' => $otherCommittee->id,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->otherMember->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
            'committee_id' => $otherCommittee->id,
        ]);

        // Create Activity
        $this->activity = Activity::create([
            'project_id' => $this->project->id,
            'committee_id' => $this->committee->id,
            'created_by' => $this->staff->id,
            'title' => 'Stage & Sound Equipment Preparation',
            'description' => 'Prepare microphones, speakers, and cables.',
            'status' => Activity::STATUS_IN_PROGRESS,
            'start_date' => '2026-10-01',
            'due_date' => '2026-10-15',
        ]);

        // Create Tasks under the Activity with explicit assigned_to.
        // ONLY these two users are the valid reminder recipients.
        $this->task1 = Task::create([
            'activity_id' => $this->activity->id,
            'assigned_to' => $this->taskAssignee1->id,
            'title' => 'Set up main speakers',
            'status' => Task::STATUS_IN_PROGRESS,
            'due_date' => '2026-10-14',
            'requires_review' => false,
        ]);

        $this->task2 = Task::create([
            'activity_id' => $this->activity->id,
            'assigned_to' => $this->taskAssignee2->id,
            'title' => 'Test all microphones',
            'status' => Task::STATUS_TO_DO,
            'due_date' => '2026-10-14',
            'requires_review' => false,
        ]);

        // NOTE: committeeOnlyMember has NO task assigned under this activity.
    }

    /**
     * 1. Authorized Project Leader can send an activity reminder.
     *    Only task assignees receive it — not all committee members.
     */
    public function test_authorized_project_leader_can_send_activity_reminder(): void
    {
        Notification::fake();

        $response = $this->actingAs($this->leader)->post(
            route('projects.committees.activities.remind', [$this->project, $this->committee, $this->activity]),
            ['message' => 'Please wrap up the preparation before next week.']
        );

        $response->assertRedirect(route('projects.committees.activities.show', [$this->project, $this->committee, $this->activity]));
        $response->assertSessionHas('status');

        // Task assignees receive the notification
        Notification::assertSentTo(
            $this->taskAssignee1,
            ActivityReminderNotification::class,
            function (ActivityReminderNotification $notif) {
                return $notif->activity->id === $this->activity->id
                    && $notif->sender->id === $this->leader->id
                    && $notif->customMessage === 'Please wrap up the preparation before next week.';
            }
        );

        Notification::assertSentTo($this->taskAssignee2, ActivityReminderNotification::class);

        // The sender (leader) does NOT receive the reminder
        Notification::assertNotSentTo($this->leader, ActivityReminderNotification::class);
    }

    /**
     * 2. Authorized Project Staff can send an activity reminder.
     *    Sender is excluded from recipients.
     */
    public function test_authorized_project_staff_can_send_activity_reminder(): void
    {
        Notification::fake();

        $response = $this->actingAs($this->staff)->post(
            route('projects.committees.activities.remind', [$this->project, $this->committee, $this->activity]),
            ['message' => 'Team, please submit your task status reports.']
        );

        $response->assertRedirect(route('projects.committees.activities.show', [$this->project, $this->committee, $this->activity]));
        $response->assertSessionHas('status');

        // Task assignees receive it
        Notification::assertSentTo($this->taskAssignee1, ActivityReminderNotification::class);
        Notification::assertSentTo($this->taskAssignee2, ActivityReminderNotification::class);

        // Staff sender does not receive a reminder to themselves
        Notification::assertNotSentTo($this->staff, ActivityReminderNotification::class);
    }

    /**
     * 3. Project Member cannot send an activity reminder.
     */
    public function test_project_member_cannot_send_activity_reminder(): void
    {
        Notification::fake();

        $response = $this->actingAs($this->taskAssignee1)->post(
            route('projects.committees.activities.remind', [$this->project, $this->committee, $this->activity]),
            ['message' => 'Member trying to send reminder.']
        );

        $response->assertForbidden();
        Notification::assertNothingSent();
    }

    /**
     * 4. Unauthorized personnel cannot send a reminder.
     */
    public function test_unauthorized_personnel_cannot_send_reminder(): void
    {
        Notification::fake();

        // Staff from another committee
        $response1 = $this->actingAs($this->otherStaff)->post(
            route('projects.committees.activities.remind', [$this->project, $this->committee, $this->activity]),
            ['message' => 'Other staff reminder.']
        );
        $response1->assertForbidden();

        // Unassigned user
        $response2 = $this->actingAs($this->unassignedUser)->post(
            route('projects.committees.activities.remind', [$this->project, $this->committee, $this->activity]),
            ['message' => 'Unassigned user reminder.']
        );
        $response2->assertForbidden();

        // Guest
        $response3 = $this->post(
            route('projects.committees.activities.remind', [$this->project, $this->committee, $this->activity]),
            ['message' => 'Guest reminder.']
        );
        $response3->assertForbidden();

        Notification::assertNothingSent();
    }

    /**
     * 5. Only explicit task assignees receive the notification.
     *    Unrelated project personnel do NOT receive it.
     */
    public function test_only_task_assignees_receive_notification(): void
    {
        Notification::fake();

        $this->actingAs($this->staff)->post(
            route('projects.committees.activities.remind', [$this->project, $this->committee, $this->activity]),
            ['message' => 'Targeted reminder.']
        );

        // Explicitly task-assigned members receive it
        Notification::assertSentTo($this->taskAssignee1, ActivityReminderNotification::class);
        Notification::assertSentTo($this->taskAssignee2, ActivityReminderNotification::class);

        // Unrelated personnel do NOT receive it
        Notification::assertNotSentTo($this->otherStaff, ActivityReminderNotification::class);
        Notification::assertNotSentTo($this->otherMember, ActivityReminderNotification::class);
        Notification::assertNotSentTo($this->unassignedUser, ActivityReminderNotification::class);
    }

    /**
     * 6. Committee members who are NOT assigned to any task under the activity
     *    must NOT receive the reminder — even if they are committee members.
     *
     * This is the key scoping rule: committee membership alone is NOT sufficient.
     */
    public function test_committee_member_not_assigned_to_any_task_does_not_receive_reminder(): void
    {
        Notification::fake();

        $this->actingAs($this->staff)->post(
            route('projects.committees.activities.remind', [$this->project, $this->committee, $this->activity]),
            ['message' => 'Scoped reminder — task assignees only.']
        );

        // committeeOnlyMember is in the same committee but has NO task assigned.
        // They must NOT receive the reminder under any circumstances.
        Notification::assertNotSentTo($this->committeeOnlyMember, ActivityReminderNotification::class);

        // Confirm task assignees still received it (sanity check)
        Notification::assertSentTo($this->taskAssignee1, ActivityReminderNotification::class);
        Notification::assertSentTo($this->taskAssignee2, ActivityReminderNotification::class);
    }

    /**
     * 7. The notification is stored in the database with correct structured data.
     */
    public function test_notification_is_stored_in_database_with_structured_data(): void
    {
        $this->actingAs($this->staff)->post(
            route('projects.committees.activities.remind', [$this->project, $this->committee, $this->activity]),
            ['message' => 'Important check on audio equipment.']
        );

        $notification = $this->taskAssignee1->notifications()
            ->where('type', ActivityReminderNotification::class)
            ->first();

        $this->assertNotNull($notification);
        $data = $notification->data;

        $this->assertSame('activity_reminder', $data['notification_type']);
        $this->assertStringContainsString('Reminder:', $data['title']);
        $this->assertSame('Important check on audio equipment.', $data['message']);
        $this->assertSame('Important check on audio equipment.', $data['custom_message']);
        $this->assertSame($this->activity->id, $data['activity_id']);
        $this->assertSame($this->project->id, $data['project']['id']);
        $this->assertSame($this->committee->id, $data['committee']['id']);
        $this->assertSame($this->staff->id, $data['sender']['id']);
    }

    /**
     * 8. The notification generates a valid email message.
     */
    public function test_notification_generates_valid_email_message(): void
    {
        $notification = new ActivityReminderNotification(
            $this->activity,
            $this->committee,
            $this->project,
            $this->staff,
            'Please test the wireless microphone batteries.'
        );

        // Delivery channels
        $this->assertEquals(['database', 'mail'], $notification->via($this->taskAssignee1));

        $mail = $notification->toMail($this->taskAssignee1);

        $this->assertStringContainsString("Reminder: {$this->activity->title}", $mail->subject);
        $this->assertStringContainsString($this->project->title, implode("\n", $mail->introLines));
        $this->assertStringContainsString($this->activity->title, implode("\n", $mail->introLines));
        $this->assertStringContainsString($this->committee->name, implode("\n", $mail->introLines));
        $this->assertStringContainsString('Please test the wireless microphone batteries.', implode("\n", $mail->introLines));
    }

    /**
     * 9. Optional custom message is included in both database and email payloads.
     */
    public function test_optional_custom_message_is_included(): void
    {
        $customText = 'Urgent reminder: Vendor arrives at 2 PM.';

        $notification = new ActivityReminderNotification(
            $this->activity,
            $this->committee,
            $this->project,
            $this->leader,
            $customText
        );

        $data = $notification->toArray($this->taskAssignee1);
        $this->assertSame($customText, $data['message']);
        $this->assertSame($customText, $data['custom_message']);

        $mail = $notification->toMail($this->taskAssignee1);
        $this->assertStringContainsString($customText, implode("\n", $mail->introLines));
    }

    /**
     * 10. Empty/omitted message uses the default reminder text.
     */
    public function test_omitted_message_uses_sensible_default_reminder_text(): void
    {
        $notification = new ActivityReminderNotification(
            $this->activity,
            $this->committee,
            $this->project,
            $this->staff,
            null
        );

        $data = $notification->toArray($this->taskAssignee1);
        $this->assertStringContainsString('Reminder:', $data['message']);
        $this->assertStringContainsString($this->activity->title, $data['message']);
        $this->assertNull($data['custom_message']);

        $mail = $notification->toMail($this->taskAssignee1);
        $this->assertStringContainsString('You have an activity that needs your attention', implode("\n", $mail->introLines));
    }

    /**
     * 11. Validation rejects invalid message input.
     */
    public function test_validation_rejects_invalid_message_input(): void
    {
        // Message too long (max: 2000)
        $response = $this->actingAs($this->staff)->post(
            route('projects.committees.activities.remind', [$this->project, $this->committee, $this->activity]),
            ['message' => str_repeat('A', 2001)]
        );

        $response->assertSessionHasErrors('message');

        // Message non-string (array)
        $response2 = $this->actingAs($this->staff)->post(
            route('projects.committees.activities.remind', [$this->project, $this->committee, $this->activity]),
            ['message' => ['invalid', 'array']]
        );

        $response2->assertSessionHasErrors('message');
    }

    /**
     * 12. Prevents accidental duplicate submissions from rapid clicks.
     */
    public function test_prevents_accidental_duplicate_submissions(): void
    {
        Notification::fake();

        // First click/request
        $response1 = $this->actingAs($this->staff)->post(
            route('projects.committees.activities.remind', [$this->project, $this->committee, $this->activity]),
            ['message' => 'First submission']
        );
        $response1->assertRedirect();
        Notification::assertSentTo($this->taskAssignee1, ActivityReminderNotification::class);

        // Immediate second click (simulating double click while lock active)
        Notification::fake();
        $response2 = $this->actingAs($this->staff)->post(
            route('projects.committees.activities.remind', [$this->project, $this->committee, $this->activity]),
            ['message' => 'Second duplicate click']
        );
        $response2->assertRedirect();
        // Second submission while lock held does not dispatch duplicate notifications
        Notification::assertNothingSent();
    }

    /**
     * 13. Activity show page props expose sendReminder capability for Project Leader and Staff.
     */
    public function test_activity_show_props_expose_send_reminder_capability_for_authorized_roles(): void
    {
        // Project Leader sees can.sendReminder = true
        $responseLeader = $this->actingAs($this->leader)->get(
            route('projects.committees.activities.show', [$this->project, $this->committee, $this->activity])
        );
        $responseLeader->assertOk();
        $responseLeader->assertInertia(fn ($page) => $page
            ->component('Activities/Show')
            ->where('activity.can.sendReminder', true)
        );

        // Project Staff sees can.sendReminder = true
        $responseStaff = $this->actingAs($this->staff)->get(
            route('projects.committees.activities.show', [$this->project, $this->committee, $this->activity])
        );
        $responseStaff->assertOk();
        $responseStaff->assertInertia(fn ($page) => $page
            ->component('Activities/Show')
            ->where('activity.can.sendReminder', true)
        );
    }

    /**
     * 14. Activity show page props hide sendReminder capability for Project Members.
     */
    public function test_activity_show_props_hide_send_reminder_capability_for_members(): void
    {
        $responseMember = $this->actingAs($this->taskAssignee1)->get(
            route('projects.committees.activities.show', [$this->project, $this->committee, $this->activity])
        );
        $responseMember->assertOk();
        $responseMember->assertInertia(fn ($page) => $page
            ->component('Activities/Show')
            ->where('activity.can.sendReminder', false)
        );
    }
}

