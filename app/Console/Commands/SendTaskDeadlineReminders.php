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
    protected $signature = 'tasks:send-deadline-reminders {--days=2 : Days ahead threshold to check for approaching deadlines}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send deadline reminder notifications to assigned members for upcoming tasks.';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $daysAhead = (int) $this->option('days');
        if ($daysAhead < 0) {
            $daysAhead = 0;
        }

        $startDate = now()->startOfDay();
        $endDate = now()->addDays($daysAhead)->endOfDay();

        $tasks = Task::query()
            ->whereNotIn('status', [Task::STATUS_COMPLETED])
            ->whereNotNull('assigned_to')
            ->whereNotNull('due_date')
            ->whereDate('due_date', '>=', $startDate->toDateString())
            ->whereDate('due_date', '<=', $endDate->toDateString())
            ->with(['assignee', 'activity.committee.project'])
            ->get();

        $sentCount = 0;

        foreach ($tasks as $task) {
            $assignee = $task->assignee;
            $activity = $task->activity;

            if (! $assignee || ! $activity || ! $activity->committee || ! $activity->project) {
                continue;
            }

            $dueDateFormatted = $task->due_date->format('Y-m-d');

            // Idempotency check: prevent duplicate reminders for the exact same due date
            $alreadyNotified = $assignee->notifications()
                ->where('type', TaskDeadlineApproachingNotification::class)
                ->where('data', 'like', '%"task_id":' . $task->id . '%')
                ->where('data', 'like', '%"due_date":"' . $dueDateFormatted . '"%')
                ->exists();

            if ($alreadyNotified) {
                continue;
            }

            $daysRemaining = max(0, (int) now()->startOfDay()->diffInDays($task->due_date->copy()->startOfDay(), false));

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
