<?php

namespace App\Notifications;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TaskAssignedNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Task $task,
        public Activity $activity,
        public Committee $committee,
        public Project $project
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
        $dueDateText = $this->task->due_date ? $this->task->due_date->format('M d, Y') : 'No deadline set';
        $url = route('projects.committees.activities.show', [
            'project' => $this->project->id,
            'committee' => $this->committee->id,
            'activity' => $this->activity->id,
        ]);

        return (new MailMessage)
            ->subject("[ITASK] Task Assigned: {$this->task->title}")
            ->greeting("Hello {$notifiable->name},")
            ->line("You have been assigned to a task in ITASK.")
            ->line("**Project:** {$this->project->title}")
            ->line("**Committee:** {$this->committee->name}")
            ->line("**Activity:** {$this->activity->title}")
            ->line("**Task:** {$this->task->title}")
            ->line("**Due Date:** {$dueDateText}")
            ->action('View Task in ITASK', $url)
            ->line('Please review your assigned task details and progress deliverables accordingly.');
    }

    /**
     * Get the array representation of the notification for database persistence.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'notification_type' => 'task_assigned',
            'title' => 'Task Assigned',
            'message' => "You have been assigned to task '{$this->task->title}'.",
            'task_id' => $this->task->id,
            'due_date' => $this->task->due_date?->format('Y-m-d'),
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
