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
     * Any other status contributes 0%.
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
     * Calculate internal task progress for an activity (deliverable).
     *
     * Hierarchy & Rules:
     * - Deliverable Task Progress: (completed_tasks / total_tasks) * 100 rounded.
     * - If total tasks is 0: 0% progress.
     * - Deliverable can be officially 'Completed' even if task progress < 100%.
     * - Reaching 100% task progress does NOT automatically mark deliverable as Completed.
     *
     * @return array{total_tasks: int, completed_tasks: int, progress: int, status: string, is_completed: bool}
     */
    public function calculateActivityProgress(Activity $activity): array
    {
        $tasks = $activity->relationLoaded('tasks') ? $activity->tasks : $activity->tasks()->get();
        $totalTasks = $tasks->count();
        $completedTasks = $tasks->where('status', Task::STATUS_COMPLETED)->count();

        $progress = $totalTasks > 0 ? (int) round(($completedTasks / $totalTasks) * 100) : 0;
        $isCompleted = ($activity->status === Activity::STATUS_COMPLETED);

        return [
            'total_tasks' => $totalTasks,
            'completed_tasks' => $completedTasks,
            'progress' => $progress,
            'status' => $activity->status,
            'is_completed' => $isCompleted,
        ];
    }

    /**
     * Calculate progress for a committee based exclusively on its deliverables.
     *
     * Formula:
     * - (completed_committee_deliverables / total_committee_deliverables) * 100 rounded.
     * - Task completion NEVER directly affects Committee progress.
     * - If committee has 0 deliverables: 0%.
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

        $progress = $totalActivities > 0
            ? (int) round(($completedActivities / $totalActivities) * 100)
            : 0;

        return [
            'total_tasks' => $totalTasks,
            'completed_tasks' => $completedTasks,
            'total_activities' => $totalActivities,
            'completed_activities' => $completedActivities,
            'progress' => $progress,
        ];
    }

    /**
     * Calculate progress for an entire event (project) based exclusively on its deliverables.
     *
     * Formula:
     * - (completed_deliverables / total_deliverables) * 100 rounded.
     * - Task completion NEVER directly affects Event progress.
     * - If event has 0 deliverables: 0%.
     *
     * @return array{total_tasks: int, completed_tasks: int, total_committees: int, total_activities: int, completed_activities: int, progress: int}
     */
    public function calculateProjectProgress(Project $project): array
    {
        // If relations are preloaded, calculate directly
        if ($project->relationLoaded('activities') && $project->relationLoaded('committees')) {
            return $this->computeProjectProgressDirect($project);
        }

        $cacheKey = "project_progress_{$project->id}";
        return \Illuminate\Support\Facades\Cache::remember(
            $cacheKey,
            now()->addMinutes(10),
            fn () => $this->computeProjectProgressDirect($project)
        );
    }

    protected function computeProjectProgressDirect(Project $project): array
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

        $progress = $totalActivities > 0
            ? (int) round(($completedActivities / $totalActivities) * 100)
            : 0;

        return [
            'total_tasks' => $totalTasks,
            'completed_tasks' => $completedTasks,
            'total_committees' => $totalCommittees,
            'total_activities' => $totalActivities,
            'completed_activities' => $completedActivities,
            'progress' => $progress,
        ];
    }

    /**
     * Clear the cached progress for a project.
     */
    public static function clearProjectProgressCache(int|string $projectId): void
    {
        \Illuminate\Support\Facades\Cache::forget("project_progress_{$projectId}");
    }
}
