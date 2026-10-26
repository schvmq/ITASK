<?php

namespace App\Notifications;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ActivitySubmittedForReviewNotification extends Notification
{
    use Queueable;

    public function __construct(
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
            ->subject("[ITASK] Activity Submitted for Review: {$this->activity->title}")
            ->greeting("Hello {$notifiable->name},")
            ->line("An activity has been submitted for staff review by {$this->submittingMember->name}.")
            ->line("**Project:** {$this->project->title}")
            ->line("**Committee:** {$this->committee->name}")
            ->line("**Activity:** {$this->activity->title}")
            ->line("**Submitted By:** {$this->submittingMember->name}")
            ->line("**Status:** Under Review")
            ->action('Review Activity in ITASK', $url)
            ->line('Please review the activity tasks, deliverables, and completion status.');
    }

    /**
     * Get the array representation of the notification for database persistence.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'notification_type' => 'activity_submitted_for_review',
            'title' => 'Activity Submitted for Review',
            'message' => "{$this->submittingMember->name} submitted activity '{$this->activity->title}' for review.",
            'activity_id' => $this->activity->id,
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
                'status' => 'Under Review',
            ],
            'action_url' => route('projects.committees.activities.show', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
            ]),
        ];
    }
}
