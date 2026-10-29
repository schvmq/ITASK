<?php

namespace App\Notifications;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TaskSubmittedForReviewNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Task $task,
        public Activity $activity,
        public Committee $committee,
        public Project $project,
        public User $submittingMember
    ) {}

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $url = route('projects.committees.activities.show', [
            'project' => $this->project->id,
            'committee' => $this->committee->id,
            'activity' => $this->activity->id,
        ]);

        return (new MailMessage)
            ->subject("[ITASK] Task Submitted for Review: {$this->task->title}")
            ->greeting("Hello {$notifiable->name},")
            ->line("A task requiring staff review has been submitted by {$this->submittingMember->name}.")
            ->line("**Project:** {$this->project->title}")
            ->line("**Committee:** {$this->committee->name}")
            ->line("**Activity:** {$this->activity->title}")
            ->line("**Task:** {$this->task->title}")
            ->line("**Submitted By:** {$this->submittingMember->name}")
            ->line("**Status:** Under Review")
            ->action('Review Task in ITASK', $url)
            ->line('Please inspect the submitted deliverables and supporting evidence, then approve or return for revision.');
    }

    /**
     * Get the array representation of the notification for database persistence.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'notification_type' => 'task_submitted_for_review',
            'title' => 'Task Submitted for Review',
            'message' => "{$this->submittingMember->name} submitted task '{$this->task->title}' for review.",
            'task_id' => $this->task->id,
            'submitting_user' => [
                'id' => $this->submittingMember->id,
                'name' => $this->submittingMember->name,
                'email' => $this->submittingMember->email,
            ],
            'project' => [
                'id' => $this->project->id,
                'title' => $this->project->title,
            ],
            'committee' => [
                'id' => $this->committee->id,
                'name' => $this->committee->name,
            ],
            'activity' => [
                'id' => $this->activity->id,
                'title' => $this->activity->title,
            ],
            'task' => [
                'id' => $this->task->id,
                'title' => $this->task->title,
                'status' => 'Under Review',
                'requires_review' => true,
            ],
            'action_url' => route('projects.committees.activities.show', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
            ]),
        ];
    }
}
