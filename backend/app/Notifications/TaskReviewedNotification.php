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

class TaskReviewedNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Task $task,
        public Activity $activity,
        public Committee $committee,
        public Project $project,
        public User $reviewer,
        public string $status, // 'Completed' or 'Returned'
        public ?string $feedback = null
    ) {}

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        if ($this->status === Task::STATUS_RETURNED || $this->status === 'Returned') {
            return ['database', 'mail'];
        }

        return ['database'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $isApproved = ($this->status === Task::STATUS_COMPLETED);
        $subject = $isApproved
            ? "[ITASK] Task Approved: {$this->task->title}"
            : "[ITASK] Task Returned for Revision: {$this->task->title}";

        $url = route('projects.committees.activities.show', [
            'project' => $this->project->id,
            'committee' => $this->committee->id,
            'activity' => $this->activity->id,
        ]);

        $mail = (new MailMessage)
            ->subject($subject)
            ->greeting("Hello {$notifiable->name},");

        if ($isApproved) {
            $mail->line("Great work! Your task review has been approved and marked as completed by {$this->reviewer->name}.")
                ->line("**Project:** {$this->project->title}")
                ->line("**Committee:** {$this->committee->name}")
                ->line("**Activity:** {$this->activity->title}")
                ->line("**Task:** {$this->task->title}")
                ->line("**Status:** Completed");
        } else {
            $mail->line("Your task has been returned for revision by {$this->reviewer->name}.")
                ->line("**Project:** {$this->project->title}")
                ->line("**Committee:** {$this->committee->name}")
                ->line("**Activity:** {$this->activity->title}")
                ->line("**Task:** {$this->task->title}")
                ->line("**Status:** Returned for Revision");

            if ($this->feedback) {
                $mail->line("**Staff Feedback:** \"{$this->feedback}\"");
            }

            $mail->line('Please update your deliverables according to the feedback and resubmit for review.');
        }

        return $mail->action('View Task in ITASK', $url);
    }

    /**
     * Get the array representation of the notification for database persistence.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $isApproved = ($this->status === Task::STATUS_COMPLETED);

        return [
            'notification_type' => 'task_reviewed',
            'title' => $isApproved ? 'Task Approved' : 'Task Returned for Revision',
            'message' => $isApproved
                ? "Task '{$this->task->title}' was approved by {$this->reviewer->name}."
                : "Task '{$this->task->title}' was returned for revision by {$this->reviewer->name}.",
            'task_id' => $this->task->id,
            'status' => $this->status,
            'review_feedback' => $this->feedback,
            'reviewer' => [
                'id' => $this->reviewer->id,
                'name' => $this->reviewer->name,
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
                'status' => $this->status,
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
