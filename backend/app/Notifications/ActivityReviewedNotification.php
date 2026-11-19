<?php

namespace App\Notifications;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ActivityReviewedNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Activity $activity,
        public Committee $committee,
        public Project $project,
        public User $reviewer,
        public string $status, // 'Completed' or 'Returned for Revision' / 'Returned'
        public ?string $feedback = null
    ) {}

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        if ($this->status === Activity::STATUS_COMPLETED) {
            return ['database'];
        }

        return ['database', 'mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $isCompleted = ($this->status === Activity::STATUS_COMPLETED);
        $subject = $isCompleted
            ? "[ITASK] Activity Completed: {$this->activity->title}"
            : "[ITASK] Activity Returned for Revision: {$this->activity->title}";

        $url = route('projects.committees.activities.show', [
            'project' => $this->project->id,
            'committee' => $this->committee->id,
            'activity' => $this->activity->id,
        ]);

        $mail = (new MailMessage)
            ->subject($subject)
            ->greeting("Hello {$notifiable->name},");

        if ($isCompleted) {
            $mail->line("Congratulations! The activity review has been approved and marked as completed by {$this->reviewer->name}.")
                ->line("**Project:** {$this->project->title}")
                ->line("**Committee:** {$this->committee->name}")
                ->line("**Activity:** {$this->activity->title}")
                ->line("**Status:** Completed");
        } else {
            $mail->line("The activity has been returned for revision by {$this->reviewer->name}.")
                ->line("**Project:** {$this->project->title}")
                ->line("**Committee:** {$this->committee->name}")
                ->line("**Activity:** {$this->activity->title}")
                ->line("**Status:** Returned for Revision");

            if ($this->feedback) {
                $mail->line("**Staff Feedback:** \"{$this->feedback}\"");
            }

            $mail->line('Please address the review comments and resubmit the activity when ready.');
        }

        return $mail->action('View Activity in ITASK', $url);
    }

    /**
     * Get the array representation of the notification for database persistence.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $isCompleted = ($this->status === Activity::STATUS_COMPLETED);

        return [
            'notification_type' => 'activity_reviewed',
            'title' => $isCompleted ? 'Activity Completed' : 'Activity Returned for Revision',
            'message' => $isCompleted
                ? "Activity '{$this->activity->title}' was marked as completed by {$this->reviewer->name}."
                : "Activity '{$this->activity->title}' was returned for revision by {$this->reviewer->name}.",
            'activity_id' => $this->activity->id,
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
                'status' => $this->status,
            ],
            'action_url' => route('projects.committees.activities.show', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
            ]),
        ];
    }
}
