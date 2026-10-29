<?php

namespace App\Notifications;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ActivityAssignedNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Activity $activity,
        public Committee $committee,
        public Project $project,
        public ?User $assignedBy = null
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
        $dueDateText = $this->activity->due_date ? $this->activity->due_date->format('M d, Y') : 'No deadline set';
        $url = route('projects.committees.activities.show', [
            'project' => $this->project->id,
            'committee' => $this->committee->id,
            'activity' => $this->activity->id,
        ]);

        return (new MailMessage)
            ->subject("[ITASK] Activity Assigned: {$this->activity->title}")
            ->greeting("Hello {$notifiable->name},")
            ->line("You have a new activity assignment in ITASK.")
            ->line("**Project:** {$this->project->title}")
            ->line("**Committee:** {$this->committee->name}")
            ->line("**Activity:** {$this->activity->title}")
            ->line("**Due Date:** {$dueDateText}")
            ->action('View Activity in ITASK', $url)
            ->line('Please review the activity details and prepare the deliverables accordingly.');
    }

    /**
     * Get the array representation of the notification for database persistence.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'notification_type' => 'activity_assigned',
            'title' => 'Activity Assigned',
            'message' => "You have been assigned to activity '{$this->activity->title}'.",
            'activity_id' => $this->activity->id,
            'due_date' => $this->activity->due_date?->format('Y-m-d'),
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
                'due_date' => $this->activity->due_date?->format('M d, Y'),
                'status' => $this->activity->status,
            ],
            'action_url' => route('projects.committees.activities.show', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
            ]),
        ];
    }
}
