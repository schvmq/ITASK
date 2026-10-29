<?php

namespace App\Notifications;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ActivityReminderNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Activity $activity,
        public Committee $committee,
        public Project $project,
        public User $sender,
        public ?string $customMessage = null
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

        $defaultMessage = 'You have an activity that needs your attention. Please begin or continue this activity before the upcoming deadline.';
        $hasCustom = filled(trim((string) $this->customMessage));
        $effectiveMessage = $hasCustom ? trim((string) $this->customMessage) : $defaultMessage;

        $mail = (new MailMessage)
            ->subject("[ITASK] Reminder: {$this->activity->title}")
            ->greeting("Hello {$notifiable->name},")
            ->line("You have received an activity reminder from {$this->sender->name}.")
            ->line("**Project:** {$this->project->title}")
            ->line("**Committee:** {$this->committee->name}")
            ->line("**Activity:** {$this->activity->title}")
            ->line("**Due Date:** {$dueDateText}")
            ->line("**Status:** {$this->activity->status}");

        if ($hasCustom) {
            $mail->line("**Message from {$this->sender->name}:** \"{$effectiveMessage}\"");
        } else {
            $mail->line($effectiveMessage);
        }

        return $mail->action('View Activity in ITASK', $url)
            ->line('Please review your assigned activity details and deliverables.');
    }

    /**
     * Get the array representation of the notification for database persistence.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $defaultMessage = "Reminder: Please review and continue work on activity '{$this->activity->title}'.";
        $hasCustom = filled(trim((string) $this->customMessage));
        $displayMessage = $hasCustom ? trim((string) $this->customMessage) : $defaultMessage;

        return [
            'notification_type' => 'activity_reminder',
            'title' => "Reminder: {$this->activity->title}",
            'message' => $displayMessage,
            'custom_message' => $this->customMessage,
            'activity_id' => $this->activity->id,
            'due_date' => $this->activity->due_date?->format('Y-m-d'),
            'sender' => [
                'id' => $this->sender->id,
                'name' => $this->sender->name,
                'email' => $this->sender->email,
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
