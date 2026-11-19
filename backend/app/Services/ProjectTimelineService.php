<?php

namespace App\Services;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;

class ProjectTimelineService
{
    public function __construct(
        protected ProjectProgressService $progressService
    ) {}

    /**
     * Build the authoritative timeline data structure for a given project and user.
     *
     * Enforces project-scoped RBAC and parent-child relationship integrity:
     * Project -> Committee -> Activity -> Task.
     *
     * @throws AuthorizationException
     */
    public function getTimelineData(Project $project, User $user): array
    {
        // 1. Project-level authorization check
        if (! Gate::forUser($user)->allows('view', $project)) {
            throw new AuthorizationException('You are not authorized to access timeline data for this project.');
        }

        // 2. Load necessary relationships with proper scoping
        $project->loadMissing([
            'roleAssignments',
            'committees.roleAssignments',
            'committees.activities.tasks.assignee',
            'committees.activities.creator',
        ]);

        $userId = $user->id;
        $isLeader = $project->roleAssignments
            ->where('user_id', $userId)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            ->isNotEmpty() || ((int) $project->created_by === (int) $userId);

        // 3. Project progress calculation
        $projectProgress = $this->progressService->calculateProjectProgress($project);
        $projectDurationDays = $this->calculateDuration($project->start_date, $project->end_date);

        // 4. Build authorized committee hierarchy
        $committeesData = [];

        foreach ($project->committees as $committee) {
            // Relationship verification: ensure committee strictly belongs to this project
            if ((int) $committee->project_id !== (int) $project->id) {
                continue;
            }

            // Committee authorization check
            if (! Gate::forUser($user)->allows('view', $committee)) {
                continue;
            }

            $committeeData = $this->buildCommitteeTimeline($committee, $project, $user);
            $committeesData[] = $committeeData;
        }

        return [
            'id' => (string) $project->id,
            'name' => $project->title,
            'title' => $project->title,
            'description' => $project->description ?? '',
            'status' => $project->status,
            'start_date' => $project->start_date?->format('M d, Y'),
            'start_date_raw' => $project->start_date?->format('Y-m-d'),
            'end_date' => $project->end_date?->format('M d, Y'),
            'end_date_raw' => $project->end_date?->format('Y-m-d'),
            'duration_days' => $projectDurationDays,
            'progress' => $projectProgress['progress'],
            'total_committees' => count($committeesData),
            'total_activities' => $projectProgress['total_activities'],
            'completed_activities' => $projectProgress['completed_activities'],
            'total_tasks' => $projectProgress['total_tasks'],
            'completed_tasks' => $projectProgress['completed_tasks'],
            'committees' => $committeesData,
            'parent_id' => null,
            'type' => 'project',
        ];
    }

    /**
     * Build timeline node for a Committee and its child Activities.
     */
    protected function buildCommitteeTimeline(Committee $committee, Project $project, User $user): array
    {
        $activitiesData = [];
        $committeeDates = collect();

        foreach ($committee->activities as $activity) {
            // Relationship verification: ensure activity strictly belongs to this committee and project
            if ((int) $activity->committee_id !== (int) $committee->id || (int) $activity->project_id !== (int) $project->id) {
                continue;
            }

            // Activity authorization check
            if (! Gate::forUser($user)->allows('view', $activity)) {
                continue;
            }

            $activityData = $this->buildActivityTimeline($activity, $committee, $project, $user);
            $activitiesData[] = $activityData;

            // Collect dates for committee date-range derivation
            if ($activity->start_date) {
                $committeeDates->push(Carbon::parse($activity->start_date)->startOfDay());
            }
            if ($activity->due_date) {
                $committeeDates->push(Carbon::parse($activity->due_date)->startOfDay());
            }

            foreach ($activity->tasks as $task) {
                if ($task->due_date) {
                    $committeeDates->push(Carbon::parse($task->due_date)->startOfDay());
                }
            }
        }

        // Derive committee date range from activities and tasks
        $derivedStartDate = $committeeDates->isNotEmpty() ? $committeeDates->min() : null;
        $derivedEndDate = $committeeDates->isNotEmpty() ? $committeeDates->max() : null;
        $committeeDurationDays = $this->calculateDuration($derivedStartDate, $derivedEndDate);

        $committeeProgress = $this->progressService->calculateCommitteeProgress($committee);

        return [
            'id' => (string) $committee->id,
            'project_id' => (string) $project->id,
            'name' => $committee->name,
            'description' => $committee->description ?? '',
            'start_date' => $derivedStartDate?->format('M d, Y'),
            'start_date_raw' => $derivedStartDate?->format('Y-m-d'),
            'end_date' => $derivedEndDate?->format('M d, Y'),
            'end_date_raw' => $derivedEndDate?->format('Y-m-d'),
            'duration_days' => $committeeDurationDays,
            'progress' => $committeeProgress['progress'],
            'total_activities' => count($activitiesData),
            'completed_activities' => $committeeProgress['completed_activities'],
            'total_tasks' => $committeeProgress['total_tasks'],
            'completed_tasks' => $committeeProgress['completed_tasks'],
            'activities' => $activitiesData,
            'parent_id' => (string) $project->id,
            'type' => 'committee',
        ];
    }

    /**
     * Build timeline node for an Activity and its child Tasks.
     */
    protected function buildActivityTimeline(Activity $activity, Committee $committee, Project $project, User $user): array
    {
        $tasksData = [];

        foreach ($activity->tasks as $task) {
            // Relationship verification: ensure task strictly belongs to this activity
            if ((int) $task->activity_id !== (int) $activity->id) {
                continue;
            }

            // Task authorization check
            if (! Gate::forUser($user)->allows('view', $task)) {
                continue;
            }

            $tasksData[] = $this->buildTaskTimeline($task, $activity, $committee, $project);
        }

        $activityDurationDays = $this->calculateDuration($activity->start_date, $activity->due_date);
        $activityProgress = $this->progressService->calculateActivityProgress($activity);

        return [
            'id' => (string) $activity->id,
            'project_id' => (string) $project->id,
            'committee_id' => (string) $committee->id,
            'title' => $activity->title,
            'name' => $activity->title,
            'description' => $activity->description ?? '',
            'status' => $activity->status,
            'start_date' => $activity->start_date?->format('M d, Y'),
            'start_date_raw' => $activity->start_date?->format('Y-m-d'),
            'due_date' => $activity->due_date?->format('M d, Y'),
            'due_date_raw' => $activity->due_date?->format('Y-m-d'),
            'end_date' => $activity->due_date?->format('M d, Y'),
            'end_date_raw' => $activity->due_date?->format('Y-m-d'),
            'duration_days' => $activityDurationDays,
            'progress' => $activityProgress['progress'],
            'total_tasks' => count($tasksData),
            'completed_tasks' => $activityProgress['completed_tasks'],
            'tasks' => $tasksData,
            'parent_id' => (string) $committee->id,
            'type' => 'activity',
        ];
    }

    /**
     * Build timeline node for a Task.
     */
    protected function buildTaskTimeline(Task $task, Activity $activity, Committee $committee, Project $project): array
    {
        $taskProgress = $this->progressService->calculateTaskProgress($task);

        // A task with a due date is represented on its due date; duration is 1 day milestone if due_date is present
        $durationDays = $task->due_date ? 1 : null;

        return [
            'id' => (string) $task->id,
            'activity_id' => (string) $activity->id,
            'committee_id' => (string) $committee->id,
            'project_id' => (string) $project->id,
            'title' => $task->title,
            'name' => $task->title,
            'description' => $task->description ?? '',
            'status' => $task->status,
            'due_date' => $task->due_date?->format('M d, Y'),
            'due_date_raw' => $task->due_date?->format('Y-m-d'),
            'end_date' => $task->due_date?->format('M d, Y'),
            'end_date_raw' => $task->due_date?->format('Y-m-d'),
            'start_date' => null,
            'start_date_raw' => null,
            'duration_days' => $durationDays,
            'requires_review' => (bool) $task->requires_review,
            'progress' => $taskProgress['progress'],
            'is_completed' => $taskProgress['is_completed'],
            'assigned_user' => $task->assignee ? [
                'id' => $task->assignee->id,
                'name' => $task->assignee->name,
                'email' => $task->assignee->email,
            ] : null,
            'parent_id' => (string) $activity->id,
            'type' => 'task',
        ];
    }

    /**
     * Safely calculate calendar duration in days inclusive of start and end dates.
     *
     * Edge cases:
     * - Returns null if either start_date or end_date is null (missing date handling).
     * - Returns 0 if end_date is strictly before start_date (safe against negative durations).
     * - Returns 1 for same-day items.
     * - Returns (diffInDays + 1) for multi-day items.
     */
    public function calculateDuration(CarbonInterface|string|null $startDate, CarbonInterface|string|null $endDate): ?int
    {
        if ($startDate === null || $endDate === null) {
            return null;
        }

        $start = Carbon::parse($startDate)->startOfDay();
        $end = Carbon::parse($endDate)->startOfDay();

        if ($end->lt($start)) {
            return 0; // Prevent invalid negative duration
        }

        return (int) $start->diffInDays($end) + 1;
    }
}
