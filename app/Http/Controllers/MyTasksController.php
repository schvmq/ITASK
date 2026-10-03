<?php

namespace App\Http\Controllers;

use App\Models\Activity;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class MyTasksController extends Controller
{
    /**
     * Display a role-scoped "My Tasks" view for the authenticated user.
     *
     * - Project Member: tasks assigned to them
     * - Project Staff:  tasks in their assigned committee + activities under review
     * - Project Leader: tasks across projects they lead
     */
    public function index(Request $request): Response
    {
        $user = $request->user();
        $userId = $user->id;

        // Determine role context
        $userRoleAssignments = ProjectRoleAssignment::query()
            ->where('user_id', $userId)
            ->get();

        $staffCommitteeIds = $userRoleAssignments
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
            ->pluck('committee_id')
            ->filter()
            ->values();

        $leaderProjectIds = Project::query()
            ->where('created_by', $userId)
            ->pluck('id')
            ->merge(
                $userRoleAssignments
                    ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
                    ->pluck('project_id')
            )
            ->unique()
            ->values();

        $isLeader = $leaderProjectIds->isNotEmpty();
        $isStaff  = $staffCommitteeIds->isNotEmpty();

        $today = now()->startOfDay();

        // ── Build tasks based on primary role scope ──────────────────────────

        $taskQuery = Task::query()->with([
            'assignee',
            'assignees',
            'activity.committee.project',
            'activity.committee.staffAssignment.user',
            'checklistItems',
        ]);

        if ($isLeader) {
            // All tasks in projects they lead
            $taskQuery->whereHas('activity', function ($q) use ($leaderProjectIds) {
                $q->whereIn('project_id', $leaderProjectIds);
            });
        } elseif ($isStaff) {
            // Tasks in their committees, OR tasks assigned to them
            $taskQuery->where(function ($q) use ($staffCommitteeIds, $userId) {
                $q->whereHas('activity', function ($aq) use ($staffCommitteeIds) {
                    $aq->whereIn('committee_id', $staffCommitteeIds);
                })->orWhere('assigned_to', $userId)
                  ->orWhereHas('assignees', fn ($uq) => $uq->where('user_id', $userId));
            });
        } else {
            // Members: only their own assigned tasks
            $taskQuery->where(function ($q) use ($userId) {
                $q->where('assigned_to', $userId)
                  ->orWhereHas('assignees', fn ($uq) => $uq->where('user_id', $userId));
            });
        }

        $tasks = $taskQuery->get()->map(function (Task $task) use ($userId, $today) {
            $dueDate    = $task->due_date ? Carbon::parse($task->due_date)->startOfDay() : null;
            $isOverdue  = $dueDate && $dueDate->lt($today) && $task->status !== Task::STATUS_COMPLETED;
            $isApproaching = $dueDate && $dueDate->gte($today) && $dueDate->lte($today->copy()->addDays(2)) && $task->status !== Task::STATUS_COMPLETED;

            $checklistTotal     = $task->checklistItems->count();
            $checklistCompleted = $task->checklistItems->where('is_completed', true)->count();
            $isMine = ($task->assigned_to === $userId) || $task->assignees->contains('id', $userId);

            return [
                'id'              => (string) $task->id,
                'title'           => $task->title,
                'description'     => $task->description,
                'status'          => $task->status,
                'priority'        => $task->priority ?? 'Medium',
                'due_date'        => $task->due_date?->format('Y-m-d'),
                'due_date_formatted' => $task->due_date ? $task->due_date->format('M d, Y') : null,
                'requires_review' => (bool) $task->requires_review,
                'is_overdue'      => (bool) $isOverdue,
                'is_approaching'  => (bool) $isApproaching,
                'is_mine'         => $isMine,
                'assignee'        => $task->assignee ? [
                    'id'   => $task->assignee->id,
                    'name' => $task->assignee->name,
                ] : ($task->assignees->first() ? [
                    'id'   => $task->assignees->first()->id,
                    'name' => $task->assignees->first()->name,
                ] : null),
                'project'  => [
                    'id'    => (string) $task->activity->project_id,
                    'title' => $task->activity->project->title,
                    'status' => $task->activity->project->status,
                ],
                'committee' => [
                    'id'   => (string) $task->activity->committee_id,
                    'name' => $task->activity->committee->name,
                ],
                'activity' => [
                    'id'     => (string) $task->activity->id,
                    'title'  => $task->activity->title,
                    'status' => $task->activity->status,
                    'due_date_formatted' => $task->activity->due_date?->format('M d, Y'),
                ],
                'checklist_total'     => $checklistTotal,
                'checklist_completed' => $checklistCompleted,
                'action_url' => route('projects.committees.activities.show', [
                    'project'   => $task->activity->project_id,
                    'committee' => $task->activity->committee_id,
                    'activity'  => $task->activity->id,
                ]),
            ];
        })->sortBy(function ($t) {
            $priority = match ($t['status']) {
                Task::STATUS_RETURNED      => 1,
                Task::STATUS_UNDER_REVIEW  => 2,
                Task::STATUS_IN_PROGRESS   => 3,
                Task::STATUS_TO_DO         => 4,
                Task::STATUS_COMPLETED     => 5,
                default                    => 6,
            };
            $urgency = ($t['is_overdue'] ? 0 : ($t['is_approaching'] ? 1 : 2));
            return "{$priority}_{$urgency}_" . ($t['due_date'] ?? '9999-99-99');
        })->values();

        // ── Summary stats ────────────────────────────────────────────────────
        $stats = [
            'total'       => $tasks->count(),
            'todo'        => $tasks->where('status', Task::STATUS_TO_DO)->count(),
            'in_progress' => $tasks->where('status', Task::STATUS_IN_PROGRESS)->count(),
            'under_review'=> $tasks->where('status', Task::STATUS_UNDER_REVIEW)->count(),
            'completed'   => $tasks->where('status', Task::STATUS_COMPLETED)->count(),
            'returned'    => $tasks->where('status', Task::STATUS_RETURNED)->count(),
            'overdue'     => $tasks->where('is_overdue', true)->count(),
        ];

        $roleContext = $isLeader ? 'leader' : ($isStaff ? 'staff' : 'member');

        return Inertia::render('MyTasks/Index', [
            'tasks'       => $tasks,
            'stats'       => $stats,
            'roleContext' => $roleContext,
        ]);
    }
}
