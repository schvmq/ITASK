<?php

namespace App\Services;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\Task;

class ProjectProgressService
{
    /**
     * Calculate progress for a single task.
     *
     * A completed task contributes 100% progress.
     * Any other status (To Do, In Progress, Under Review, Returned) contributes 0%.
     *
     * @return array{progress: int, is_completed: bool, status: string}
     */
    public function calculateTaskProgress(Task $task): array
    {
        $isCompleted = ($task->status === Task::STATUS_COMPLETED);

        return [
            'progress' => $isCompleted ? 100 : 0,
            'is_completed' => $isCompleted,
            'status' => $task->status,
        ];
    }

    /**
     * Calculate progress for an activity based on its child tasks.
     *
     * Edge cases:
     * - If activity has tasks: (completed_tasks / total_tasks) * 100 rounded.
     * - If activity has zero tasks: 100% if activity status is Completed, else 0%.
     *
     * @return array{total_tasks: int, completed_tasks: int, progress: int, status: string}
     */
    public function calculateActivityProgress(Activity $activity): array
    {
        $tasks = $activity->relationLoaded('tasks') ? $activity->tasks : $activity->tasks()->get();
        $totalTasks = $tasks->count();
        $completedTasks = $tasks->where('status', Task::STATUS_COMPLETED)->count();

        if ($totalTasks > 0) {
            $progress = (int) round(($completedTasks / $totalTasks) * 100);
        } else {
            $progress = ($activity->status === Activity::STATUS_COMPLETED) ? 100 : 0;
        }

        return [
            'total_tasks' => $totalTasks,
            'completed_tasks' => $completedTasks,
            'progress' => $progress,
            'status' => $activity->status,
        ];
    }

    /**
     * Calculate progress for a committee based on tasks across all its activities.
     *
     * Edge cases:
     * - If committee has tasks across its activities: (completed_tasks / total_tasks) * 100 rounded.
     * - If committee has zero tasks but has activities: 100% if all activities are Completed, else 0%.
     * - If committee has zero activities: 0%.
     *
     * @return array{total_tasks: int, completed_tasks: int, total_activities: int, completed_activities: int, progress: int}
     */
    public function calculateCommitteeProgress(Committee $committee): array
    {
        $activities = $committee->relationLoaded('activities')
            ? $committee->activities
            : $committee->activities()->with('tasks')->get();

        $allTasks = $activities->flatMap(function (Activity $activity) {
            return $activity->relationLoaded('tasks') ? $activity->tasks : $activity->tasks()->get();
        });

        $totalTasks = $allTasks->count();
        $completedTasks = $allTasks->where('status', Task::STATUS_COMPLETED)->count();

        $totalActivities = $activities->count();
        $completedActivities = $activities->where('status', Activity::STATUS_COMPLETED)->count();

        if ($totalTasks > 0) {
            $progress = (int) round(($completedTasks / $totalTasks) * 100);
        } elseif ($totalActivities > 0 && $completedActivities === $totalActivities) {
            $progress = 100;
        } else {
            $progress = 0;
        }

        return [
            'total_tasks' => $totalTasks,
            'completed_tasks' => $completedTasks,
            'total_activities' => $totalActivities,
            'completed_activities' => $completedActivities,
            'progress' => $progress,
        ];
    }

    /**
     * Calculate progress for a project across all its activities and tasks.
     * Fully deterministic and shared between Dashboard and Gantt/Timeline.
     *
     * Edge cases:
     * - If project has tasks: (completed_tasks / total_tasks) * 100 rounded.
     * - If project has zero tasks and status is Completed: 100%.
     * - If project has zero tasks but has activities and all are Completed: 100%.
     * - Otherwise: 0%.
     *
     * @return array{total_tasks: int, completed_tasks: int, total_committees: int, total_activities: int, completed_activities: int, progress: int}
     */
    public function calculateProjectProgress(Project $project): array
    {
        $activities = $project->relationLoaded('activities')
            ? $project->activities
            : $project->activities()->with('tasks')->get();

        $allTasks = $activities->flatMap(function (Activity $activity) {
            return $activity->relationLoaded('tasks') ? $activity->tasks : $activity->tasks()->get();
        });

        $totalTasks = $allTasks->count();
        $completedTasks = $allTasks->where('status', Task::STATUS_COMPLETED)->count();

        $totalActivities = $activities->count();
        $completedActivities = $activities->where('status', Activity::STATUS_COMPLETED)->count();

        $totalCommittees = $project->relationLoaded('committees')
            ? $project->committees->count()
            : $project->committees()->count();

        if ($totalTasks > 0) {
            $progress = (int) round(($completedTasks / $totalTasks) * 100);
        } elseif ($project->status === Project::STATUS_COMPLETED) {
            $progress = 100;
        } elseif ($totalActivities > 0 && $completedActivities === $totalActivities) {
            $progress = 100;
        } else {
            $progress = 0;
        }

        return [
            'total_tasks' => $totalTasks,
            'completed_tasks' => $completedTasks,
            'total_committees' => $totalCommittees,
            'total_activities' => $totalActivities,
            'completed_activities' => $completedActivities,
            'progress' => $progress,
        ];
    }
}
