<?php

namespace App\Http\Controllers;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * Display the role-scoped user dashboard.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();
        $userId = $user->id;

        // 1. Role assignments for the authenticated user
        $userRoleAssignments = ProjectRoleAssignment::query()
            ->where('user_id', $userId)
            ->get();

        $staffCommitteeIds = $userRoleAssignments
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
            ->pluck('committee_id')
            ->filter();

        $leaderProjectIds = Project::query()
            ->where('created_by', $userId)
            ->pluck('id')
            ->merge(
                $userRoleAssignments
                    ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
                    ->pluck('project_id')
            )
            ->unique();

        $primaryRole = ProjectRoleAssignment::ROLE_PROJECT_MEMBER;
        if ($leaderProjectIds->isNotEmpty()) {
            $primaryRole = ProjectRoleAssignment::ROLE_PROJECT_LEADER;
        } elseif ($staffCommitteeIds->isNotEmpty()) {
            $primaryRole = ProjectRoleAssignment::ROLE_PROJECT_STAFF;
        }

        // 2. My Projects (projects user created or is assigned to)
        $projects = Project::query()
            ->where(function ($query) use ($userId) {
                $query->where('created_by', $userId)
                    ->orWhereHas('roleAssignments', function ($q) use ($userId) {
                        $q->where('user_id', $userId);
                    });
            })
            ->with([
                'roleAssignments' => function ($q) use ($userId) {
                    $q->where('user_id', $userId);
                },
                'committees',
                'activities.tasks',
            ])
            ->latest()
            ->get()
            ->map(function (Project $project) use ($userId) {
                $userAssignment = $project->roleAssignments->firstWhere('user_id', $userId);
                $role = $userAssignment?->role
                    ?? ($project->created_by === $userId ? ProjectRoleAssignment::ROLE_PROJECT_LEADER : ProjectRoleAssignment::ROLE_PROJECT_MEMBER);

                $allTasks = $project->activities->flatMap->tasks;
                $tasksCount = $allTasks->count();
                $completedTasksCount = $allTasks->where('status', Task::STATUS_COMPLETED)->count();
                $progressPercentage = $tasksCount > 0 ? (int) round(($completedTasksCount / $tasksCount) * 100) : 0;

                return [
                    'id' => (string) $project->id,
                    'title' => $project->title,
                    'description' => $project->description ?? '',
                    'status' => $project->status,
                    'role' => $role,
                    'start_date' => $project->start_date ? $project->start_date->format('M d, Y') : null,
                    'end_date' => $project->end_date ? $project->end_date->format('M d, Y') : 'No deadline',
                    'committeesCount' => $project->committees->count(),
                    'tasksCount' => $tasksCount,
                    'completedTasksCount' => $completedTasksCount,
                    'progressPercentage' => $progressPercentage,
                ];
            });

        // 3. My Committees (staff committees, member committees, or all committees in projects led by user)
        $committees = Committee::query()
            ->where(function ($query) use ($userId) {
                $query->whereHas('roleAssignments', function ($q) use ($userId) {
                    $q->where('user_id', $userId);
                })
                ->orWhereHas('project', function ($q) use ($userId) {
                    $q->where('created_by', $userId)
                        ->orWhereHas('roleAssignments', function ($sub) use ($userId) {
                            $sub->where('user_id', $userId)
                                ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER);
                        });
                });
            })
            ->with([
                'project',
                'roleAssignments' => function ($q) use ($userId) {
                    $q->where('user_id', $userId);
                },
                'activities.tasks',
            ])
            ->get()
            ->map(function (Committee $committee) use ($userId) {
                $committeeRole = $committee->roleAssignments->firstWhere('user_id', $userId)?->role;
                if (! $committeeRole && ($committee->project->created_by === $userId || $committee->project->roleAssignments()->where('user_id', $userId)->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)->exists())) {
                    $committeeRole = ProjectRoleAssignment::ROLE_PROJECT_LEADER;
                }

                $allTasks = $committee->activities->flatMap->tasks;
                $tasksCount = $allTasks->count();
                $completedTasksCount = $allTasks->where('status', Task::STATUS_COMPLETED)->count();

                return [
                    'id' => (string) $committee->id,
                    'name' => $committee->name,
                    'description' => $committee->description,
                    'role' => $committeeRole ?? ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
                    'project_id' => (string) $committee->project_id,
                    'project_title' => $committee->project->title,
                    'activities_count' => $committee->activities->count(),
                    'tasks_count' => $tasksCount,
                    'completed_tasks_count' => $completedTasksCount,
                ];
            });

        // 4. My Assigned Tasks
        $today = now()->startOfDay();
        $assignedTasks = Task::query()
            ->where('assigned_to', $userId)
            ->with(['activity.committee.project'])
            ->get()
            ->map(function (Task $task) use ($today) {
                $dueDate = $task->due_date ? Carbon::parse($task->due_date)->startOfDay() : null;
                $isOverdue = $dueDate && $dueDate->lt($today) && $task->status !== Task::STATUS_COMPLETED;
                $isApproaching = $dueDate && $dueDate->gte($today) && $dueDate->lte($today->copy()->addDays(2)) && $task->status !== Task::STATUS_COMPLETED;

                return [
                    'id' => (string) $task->id,
                    'title' => $task->title,
                    'description' => $task->description,
                    'status' => $task->status,
                    'due_date' => $task->due_date?->format('Y-m-d'),
                    'due_date_formatted' => $task->due_date ? $task->due_date->format('M d, Y') : 'No deadline',
                    'requires_review' => (bool) $task->requires_review,
                    'is_overdue' => (bool) $isOverdue,
                    'is_approaching' => (bool) $isApproaching,
                    'project' => [
                        'id' => (string) $task->activity->project_id,
                        'title' => $task->activity->project->title,
                    ],
                    'committee' => [
                        'id' => (string) $task->activity->committee_id,
                        'name' => $task->activity->committee->name,
                    ],
                    'activity' => [
                        'id' => (string) $task->activity->id,
                        'title' => $task->activity->title,
                    ],
                    'action_url' => route('projects.committees.activities.show', [
                        'project' => $task->activity->project_id,
                        'committee' => $task->activity->committee_id,
                        'activity' => $task->activity->id,
                    ]),
                ];
            })
            ->sortBy(function ($t) {
                $priority = match ($t['status']) {
                    Task::STATUS_RETURNED => 1,
                    Task::STATUS_UNDER_REVIEW => 2,
                    Task::STATUS_IN_PROGRESS => 3,
                    Task::STATUS_TO_DO => 4,
                    Task::STATUS_COMPLETED => 5,
                    default => 6,
                };
                $urgency = ($t['is_overdue'] ? 0 : ($t['is_approaching'] ? 1 : 2));
                return "{$priority}_{$urgency}_" . ($t['due_date'] ?? '9999-99-99');
            })
            ->values();

        // 5. Pending review items (for Staff / Leader)
        $pendingReviews = collect();
        if ($primaryRole === ProjectRoleAssignment::ROLE_PROJECT_STAFF || $primaryRole === ProjectRoleAssignment::ROLE_PROJECT_LEADER) {
            $pendingTasks = Task::query()
                ->where('status', Task::STATUS_UNDER_REVIEW)
                ->where(function ($q) use ($staffCommitteeIds, $leaderProjectIds) {
                    $q->whereHas('activity', function ($actQ) use ($staffCommitteeIds, $leaderProjectIds) {
                        $actQ->whereIn('committee_id', $staffCommitteeIds)
                            ->orWhereIn('project_id', $leaderProjectIds);
                    });
                })
                ->with(['assignee', 'activity.committee.project'])
                ->get()
                ->map(function (Task $task) {
                    return [
                        'type' => 'task',
                        'id' => (string) $task->id,
                        'title' => $task->title,
                        'status' => $task->status,
                        'submitted_by' => $task->assignee?->name ?? 'Assigned Member',
                        'project' => [
                            'id' => (string) $task->activity->project_id,
                            'title' => $task->activity->project->title,
                        ],
                        'committee' => [
                            'id' => (string) $task->activity->committee_id,
                            'name' => $task->activity->committee->name,
                        ],
                        'activity' => [
                            'id' => (string) $task->activity->id,
                            'title' => $task->activity->title,
                        ],
                        'action_url' => route('projects.committees.activities.show', [
                            'project' => $task->activity->project_id,
                            'committee' => $task->activity->committee_id,
                            'activity' => $task->activity->id,
                        ]),
                        'updated_at' => $task->updated_at?->diffForHumans(),
                    ];
                });

            $pendingActivities = Activity::query()
                ->where('status', Activity::STATUS_UNDER_REVIEW)
                ->where(function ($q) use ($staffCommitteeIds, $leaderProjectIds) {
                    $q->whereIn('committee_id', $staffCommitteeIds)
                        ->orWhereIn('project_id', $leaderProjectIds);
                })
                ->with(['creator', 'committee.project'])
                ->get()
                ->map(function (Activity $activity) {
                    return [
                        'type' => 'activity',
                        'id' => (string) $activity->id,
                        'title' => $activity->title,
                        'status' => $activity->status,
                        'submitted_by' => $activity->creator?->name ?? 'Activity Creator',
                        'project' => [
                            'id' => (string) $activity->project_id,
                            'title' => $activity->project->title,
                        ],
                        'committee' => [
                            'id' => (string) $activity->committee_id,
                            'name' => $activity->committee->name,
                        ],
                        'activity' => [
                            'id' => (string) $activity->id,
                            'title' => $activity->title,
                        ],
                        'action_url' => route('projects.committees.activities.show', [
                            'project' => $activity->project_id,
                            'committee' => $activity->committee_id,
                            'activity' => $activity->id,
                        ]),
                        'updated_at' => $activity->updated_at?->diffForHumans(),
                    ];
                });

            $pendingReviews = $pendingTasks->concat($pendingActivities)->values();
        }

        // 6. Recent notifications
        $recentNotifications = $user->notifications()
            ->latest()
            ->take(5)
            ->get()
            ->map(function ($notif) {
                return [
                    'id' => $notif->id,
                    'type' => $notif->type,
                    'data' => $notif->data,
                    'read_at' => $notif->read_at?->toISOString(),
                    'created_at' => $notif->created_at?->toISOString(),
                    'created_at_human' => $notif->created_at?->diffForHumans(),
                ];
            });

        // 7. Overall Stats
        $stats = [
            'activeProjectsCount' => $projects->where('status', '!=', Project::STATUS_ARCHIVED)->count(),
            'assignedTasksCount' => $assignedTasks->count(),
            'completedTasksCount' => $assignedTasks->where('status', Task::STATUS_COMPLETED)->count(),
            'pendingReviewsCount' => $pendingReviews->count(),
            'returnedTasksCount' => $assignedTasks->where('status', Task::STATUS_RETURNED)->count(),
            'overdueTasksCount' => $assignedTasks->where('is_overdue', true)->count(),
            'approachingTasksCount' => $assignedTasks->where('is_approaching', true)->count(),
        ];

        return Inertia::render('Welcome', [
            'primaryRole' => $primaryRole,
            'stats' => $stats,
            'projects' => $projects,
            'committees' => $committees,
            'assignedTasks' => $assignedTasks,
            'pendingReviews' => $pendingReviews,
            'recentNotifications' => $recentNotifications,
            'unreadNotificationsCount' => $user->unreadNotifications()->count(),
        ]);
    }
}
