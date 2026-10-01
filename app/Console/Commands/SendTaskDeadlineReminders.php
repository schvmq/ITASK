<?php

namespace App\Console\Commands;

use App\Models\Task;
use App\Notifications\TaskDeadlineApproachingNotification;
use Illuminate\Console\Command;

class SendTaskDeadlineReminders extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'tasks:send-deadline-reminders {--days= : Specific days ahead to check (defaults to 3-day and 1-day reminders)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send deadline reminder notifications (3-day and 1-day) to assigned members for upcoming tasks.';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $daysOption = $this->option('days');
        if ($daysOption !== null && is_numeric($daysOption)) {
            $daysVal = (int) $daysOption;
            $intervals = match ($daysVal) {
                3 => [3],
                1 => [1],
                default => array_values(array_filter([3, 1], fn ($d) => $d <= $daysVal)),
            };
        } else {
            $intervals = [3, 1];
        }

        if (empty($intervals)) {
            $this->info('Processed task deadline reminders: 0 sent.');
            return Command::SUCCESS;
        }

        $tasks = Task::query()
            ->whereNotIn('status', [Task::STATUS_COMPLETED])
            ->whereNotNull('assigned_to')
            ->whereNotNull('due_date')
            ->where(function ($query) use ($intervals) {
                foreach ($intervals as $days) {
                    $targetDate = now()->startOfDay()->addDays($days)->toDateString();
                    $query->orWhereDate('due_date', '=', $targetDate);
                }
            })
            ->with(['assignee', 'activity.committee.project'])
            ->get();

        $sentCount = 0;

        foreach ($tasks as $task) {
            $assignee = $task->assignee;
            $activity = $task->activity;

            if (! $assignee || ! $activity || ! $activity->committee || ! $activity->project) {
                continue;
            }

            // Do not send reminders for completed tasks
            if ($task->status === Task::STATUS_COMPLETED) {
                continue;
            }

            $daysRemaining = (int) now()->startOfDay()->diffInDays($task->due_date->copy()->startOfDay(), false);

            // Do not send reminders after deadline or for non-target intervals
            if (! in_array($daysRemaining, $intervals, true) || $daysRemaining <= 0) {
                continue;
            }

            // Idempotency check: prevent duplicate reminders for this task at this specific interval (3-day or 1-day)
            $alreadyNotified = $assignee->notifications()
                ->where('type', TaskDeadlineApproachingNotification::class)
                ->where('data', 'like', '%"task_id":' . $task->id . '%')
                ->get()
                ->contains(function ($notification) use ($task, $daysRemaining) {
                    $data = $notification->data;
                    $taskId = $data['task_id'] ?? null;
                    $interval = $data['reminder_interval'] ?? ($data['days_remaining'] ?? null);

                    return (int) $taskId === (int) $task->id && (int) $interval === (int) $daysRemaining;
                });

            if ($alreadyNotified) {
                continue;
            }

            $assignee->notify(new TaskDeadlineApproachingNotification(
                $task,
                $activity,
                $activity->committee,
                $activity->project,
                $daysRemaining
            ));

            $sentCount++;
        }

        $this->info("Processed task deadline reminders: {$sentCount} sent.");

        return Command::SUCCESS;
    }
}
