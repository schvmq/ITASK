<?php

namespace App\Notifications;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TaskDeadlineApproachingNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Task $task,
        public Activity $activity,
        public Committee $committee,
        public Project $project,
        public int $daysRemaining
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
        $dueDateText = $this->task->due_date ? $this->task->due_date->format('M d, Y') : 'Upcoming';
        $timeRemainingText = match ($this->daysRemaining) {
            0 => 'due today',
            1 => 'due tomorrow',
            default => "due in {$this->daysRemaining} days",
        };

        $url = route('projects.committees.activities.show', [
            'project' => $this->project->id,
            'committee' => $this->committee->id,
            'activity' => $this->activity->id,
        ]);

        return (new MailMessage)
            ->subject("[ITASK] Deadline Approaching: {$this->task->title} ({$timeRemainingText})")
            ->greeting("Hello {$notifiable->name},")
            ->line("This is a reminder that an assigned task is approaching its deadline.")
            ->line("**Project:** {$this->project->title}")
            ->line("**Committee:** {$this->committee->name}")
            ->line("**Activity:** {$this->activity->title}")
            ->line("**Task:** {$this->task->title}")
            ->line("**Status:** {$this->task->status}")
            ->line("**Due Date:** {$dueDateText} ({$timeRemainingText})")
            ->action('View Task in ITASK', $url)
            ->line('Please make sure your work and any supporting evidence are up to date before the deadline.');
    }

    /**
     * Get the array representation of the notification for database persistence.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'notification_type' => 'task_deadline_approaching',
            'title' => 'Deadline Approaching',
            'message' => "Task '{$this->task->title}' is due on {$this->task->due_date?->format('M d, Y')}.",
            'task_id' => $this->task->id,
            'due_date' => $this->task->due_date?->format('Y-m-d'),
            'days_remaining' => $this->daysRemaining,
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
                'due_date' => $this->task->due_date?->format('M d, Y'),
                'status' => $this->task->status,
                'requires_review' => (bool) $this->task->requires_review,
            ],
            'action_url' => route('projects.committees.activities.show', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
            ]),
        ];
    }
}
