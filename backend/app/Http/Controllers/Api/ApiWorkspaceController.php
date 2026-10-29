<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Services\ProjectProgressService;
use App\Services\ProjectTimelineService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class ApiWorkspaceController extends Controller
{
    public function __construct(
        protected ProjectProgressService $progressService,
        protected ProjectTimelineService $timelineService
    ) {}

    /**
     * Get the role-scoped user dashboard data.
     */
    public function dashboard(Request $request): JsonResponse
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

        // 2. My Projects
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

                $projectProgress = $this->progressService->calculateProjectProgress($project);

                return [
                    'id' => (string) $project->id,
                    'title' => $project->title,
                    'description' => $project->description ?? '',
                    'status' => $project->status,
                    'role' => $role,
                    'start_date' => $project->start_date ? $project->start_date->format('M d, Y') : null,
                    'end_date' => $project->end_date ? $project->end_date->format('M d, Y') : 'No deadline',
                    'committeesCount' => $project->committees->count(),
                    'tasksCount' => $projectProgress['total_tasks'],
                    'completedTasksCount' => $projectProgress['completed_tasks'],
                    'progressPercentage' => $projectProgress['progress'],
                ];
            });

        // 3. My Committees
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

                $committeeProgress = $this->progressService->calculateCommitteeProgress($committee);

                return [
                    'id' => (string) $committee->id,
                    'name' => $committee->name,
                    'description' => $committee->description,
                    'role' => $committeeRole ?? ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
                    'project_id' => (string) $committee->project_id,
                    'project_title' => $committee->project->title,
                    'activities_count' => $committee->activities->count(),
                    'tasks_count' => $committeeProgress['total_tasks'],
                    'completed_tasks_count' => $committeeProgress['completed_tasks'],
                    'progress' => $committeeProgress['progress'],
                    'progressPercentage' => $committeeProgress['progress'],
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

        // 5. Pending review items
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

        return response()->json([
            'primary_role' => $primaryRole,
            'stats' => $stats,
            'projects' => $projects,
            'committees' => $committees,
            'assigned_tasks' => $assignedTasks,
            'pending_reviews' => $pendingReviews,
            'recent_notifications' => $recentNotifications,
            'unread_notifications_count' => $user->unreadNotifications()->count(),
            'announcement' => Cache::get('itask_system_announcement', 'System is operating normally. All Capstone deliverables and committee submissions are active.'),
        ]);
    }

    /**
     * Get tasks assigned to the authenticated user across all projects.
     */
    public function myTasks(Request $request): JsonResponse
    {
        $user = $request->user();
        $userId = $user->id;

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

        $today = now()->startOfDay();

        $tasks = Task::query()
            ->whereHas('activity.project')
            ->where(function ($q) use ($userId) {
                $q->where('assigned_to', $userId)
                    ->orWhereHas('assignees', fn ($uq) => $uq->where('user_id', $userId));
            })
            ->with([
                'assignee',
                'assignees',
                'activity.committee.project',
                'checklistItems',
            ])
            ->get()
            ->map(function (Task $task) use ($userId, $today) {
                $dueDate = $task->due_date ? Carbon::parse($task->due_date)->startOfDay() : null;
                $isOverdue = $dueDate && $dueDate->lt($today) && $task->status !== Task::STATUS_COMPLETED;
                $isApproaching = $dueDate && $dueDate->gte($today) && $dueDate->lte($today->copy()->addDays(2)) && $task->status !== Task::STATUS_COMPLETED;

                $checklistTotal = $task->checklistItems->count();
                $checklistCompleted = $task->checklistItems->where('is_completed', true)->count();
                $isMine = ($task->assigned_to === $userId) || $task->assignees->contains('id', $userId);

                return [
                    'id' => (string) $task->id,
                    'title' => $task->title,
                    'description' => $task->description,
                    'status' => $task->status,
                    'priority' => $task->priority ?? 'Medium',
                    'due_date' => $task->due_date?->format('Y-m-d'),
                    'due_date_formatted' => $task->due_date ? $task->due_date->format('M d, Y') : null,
                    'requires_review' => (bool) $task->requires_review,
                    'is_overdue' => (bool) $isOverdue,
                    'is_approaching' => (bool) $isApproaching,
                    'is_mine' => $isMine,
                    'checklist_total' => $checklistTotal,
                    'checklist_completed' => $checklistCompleted,
                    'assignee' => $task->assignee ? [
                        'id' => $task->assignee->id,
                        'name' => $task->assignee->name,
                    ] : null,
                    'project' => [
                        'id' => (string) $task->activity->project_id,
                        'title' => $task->activity->project->title,
                        'status' => $task->activity->project->status,
                    ],
                    'committee' => [
                        'id' => (string) $task->activity->committee_id,
                        'name' => $task->activity->committee->name,
                    ],
                    'activity' => [
                        'id' => (string) $task->activity->id,
                        'title' => $task->activity->title,
                        'status' => $task->activity->status,
                    ],
                ];
            });

        return response()->json([
            'tasks' => $tasks,
            'role_context' => [
                'is_leader' => $leaderProjectIds->isNotEmpty(),
                'is_staff' => $staffCommitteeIds->isNotEmpty(),
                'staff_committee_ids' => $staffCommitteeIds,
                'leader_project_ids' => $leaderProjectIds,
            ],
        ]);
    }

    /**
     * Get authorized calendar events.
     */
    public function calendar(Request $request): JsonResponse
    {
        $user = $request->user();
        $userId = $user->id;

        $userRoleAssignments = ProjectRoleAssignment::query()
            ->where('user_id', $userId)
            ->get();

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

        $staffCommitteeIds = $userRoleAssignments
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
            ->pluck('committee_id')
            ->filter()
            ->values();

        $memberCommitteeIds = $userRoleAssignments
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_MEMBER)
            ->pluck('committee_id')
            ->filter()
            ->values();

        $allAccessibleProjectIds = $leaderProjectIds
            ->merge($userRoleAssignments->pluck('project_id')->filter())
            ->unique()
            ->values();

        $allAccessibleCommitteeIds = $staffCommitteeIds
            ->merge($memberCommitteeIds)
            ->unique()
            ->values();

        $events = collect();

        // 1. Projects
        $projects = Project::query()
            ->whereIn('id', $allAccessibleProjectIds)
            ->where(function ($q) {
                $q->whereNotNull('start_date')->orWhereNotNull('end_date');
            })
            ->get();

        foreach ($projects as $project) {
            $userRole = $leaderProjectIds->contains($project->id)
                ? 'Project Leader'
                : ($userRoleAssignments->where('project_id', $project->id)->first()?->role ?? 'Project Member');

            if ($project->start_date) {
                $events->push([
                    'id' => "project-start-{$project->id}",
                    'type' => 'project_start',
                    'title' => $project->title,
                    'label' => 'Project Start',
                    'date' => $project->start_date->format('Y-m-d'),
                    'date_formatted' => $project->start_date->format('M d, Y'),
                    'status' => $project->status,
                    'role' => $userRole,
                    'color_group' => 'project',
                ]);
            }
            if ($project->end_date) {
                $events->push([
                    'id' => "project-end-{$project->id}",
                    'type' => 'project_deadline',
                    'title' => $project->title,
                    'label' => 'Project Deadline',
                    'date' => $project->end_date->format('Y-m-d'),
                    'date_formatted' => $project->end_date->format('M d, Y'),
                    'status' => $project->status,
                    'role' => $userRole,
                    'color_group' => 'project_deadline',
                ]);
            }
        }

        // 2. Activities
        $activityQuery = Activity::query()
            ->with(['project', 'committee'])
            ->where(function ($q) {
                $q->whereNotNull('start_date')->orWhereNotNull('due_date');
            });

        if ($leaderProjectIds->isNotEmpty()) {
            $activityQuery->where(function ($q) use ($leaderProjectIds, $allAccessibleCommitteeIds) {
                $q->whereIn('project_id', $leaderProjectIds)
                  ->orWhereIn('committee_id', $allAccessibleCommitteeIds);
            });
        } else {
            $activityQuery->whereIn('committee_id', $allAccessibleCommitteeIds);
        }

        foreach ($activityQuery->get() as $activity) {
            if ($activity->start_date) {
                $events->push([
                    'id' => "activity-start-{$activity->id}",
                    'type' => 'activity_start',
                    'title' => $activity->title,
                    'label' => 'Activity Start',
                    'date' => $activity->start_date->format('Y-m-d'),
                    'date_formatted' => $activity->start_date->format('M d, Y'),
                    'status' => $activity->status,
                    'project' => ['id' => (string) $activity->project_id, 'title' => $activity->project->title],
                    'committee' => ['id' => (string) $activity->committee_id, 'name' => $activity->committee->name],
                    'color_group' => 'activity',
                ]);
            }
            if ($activity->due_date) {
                $events->push([
                    'id' => "activity-due-{$activity->id}",
                    'type' => 'activity_due',
                    'title' => $activity->title,
                    'label' => 'Activity Due',
                    'date' => $activity->due_date->format('Y-m-d'),
                    'date_formatted' => $activity->due_date->format('M d, Y'),
                    'status' => $activity->status,
                    'project' => ['id' => (string) $activity->project_id, 'title' => $activity->project->title],
                    'committee' => ['id' => (string) $activity->committee_id, 'name' => $activity->committee->name],
                    'color_group' => 'activity_due',
                ]);
            }
        }

        // 3. Tasks
        $taskQuery = Task::query()
            ->with(['activity.project', 'activity.committee', 'assignee'])
            ->whereNotNull('due_date');

        if ($leaderProjectIds->isNotEmpty()) {
            $taskQuery->where(function ($q) use ($leaderProjectIds, $allAccessibleCommitteeIds, $userId) {
                $q->whereHas('activity', function ($aq) use ($leaderProjectIds) {
                    $aq->whereIn('project_id', $leaderProjectIds);
                })->orWhereHas('activity', function ($aq) use ($allAccessibleCommitteeIds) {
                    $aq->whereIn('committee_id', $allAccessibleCommitteeIds);
                })->orWhere('assigned_to', $userId);
            });
        } elseif ($allAccessibleCommitteeIds->isNotEmpty()) {
            $taskQuery->where(function ($q) use ($allAccessibleCommitteeIds, $userId) {
                $q->whereHas('activity', function ($aq) use ($allAccessibleCommitteeIds) {
                    $aq->whereIn('committee_id', $allAccessibleCommitteeIds);
                })->orWhere('assigned_to', $userId);
            });
        } else {
            $taskQuery->where('assigned_to', $userId);
        }

        foreach ($taskQuery->get() as $task) {
            $events->push([
                'id' => "task-due-{$task->id}",
                'type' => 'task_due',
                'title' => $task->title,
                'label' => 'Task Due',
                'date' => $task->due_date->format('Y-m-d'),
                'date_formatted' => $task->due_date->format('M d, Y'),
                'status' => $task->status,
                'project' => ['id' => (string) $task->activity->project_id, 'title' => $task->activity->project->title],
                'committee' => ['id' => (string) $task->activity->committee_id, 'name' => $task->activity->committee->name],
                'activity' => ['id' => (string) $task->activity->id, 'title' => $task->activity->title],
                'assignee' => $task->assignee ? ['id' => $task->assignee->id, 'name' => $task->assignee->name] : null,
                'is_mine' => $task->assigned_to === $userId,
                'color_group' => 'task',
            ]);
        }

        return response()->json([
            'events' => $events->sortBy('date')->values(),
        ]);
    }

    /**
     * Get timeline overview for all projects accessible to the user.
     */
    public function timeline(Request $request): JsonResponse
    {
        $user = $request->user();
        $userId = $user->id;

        $userRoleAssignments = ProjectRoleAssignment::query()
            ->where('user_id', $userId)
            ->get();

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

        $projects = Project::query()
            ->where(function ($query) use ($userId) {
                $query->where('created_by', $userId)
                    ->orWhereHas('roleAssignments', function ($q) use ($userId) {
                        $q->where('user_id', $userId);
                    });
            })
            ->with(['committees.activities.tasks', 'roleAssignments' => function ($q) use ($userId) {
                $q->where('user_id', $userId);
            }])
            ->latest()
            ->get()
            ->map(function (Project $project) use ($userId, $leaderProjectIds) {
                $userAssignment = $project->roleAssignments->firstWhere('user_id', $userId);
                $role = $userAssignment?->role
                    ?? ($leaderProjectIds->contains($project->id) ? ProjectRoleAssignment::ROLE_PROJECT_LEADER : ProjectRoleAssignment::ROLE_PROJECT_MEMBER);

                $progress = $this->progressService->calculateProjectProgress($project);

                return [
                    'id' => (string) $project->id,
                    'title' => $project->title,
                    'description' => $project->description,
                    'status' => $project->status,
                    'role' => $role,
                    'start_date' => $project->start_date?->format('M d, Y'),
                    'end_date' => $project->end_date?->format('M d, Y') ?? 'No deadline',
                    'progress' => $progress['progress'],
                    'total_tasks' => $progress['total_tasks'],
                    'completed_tasks' => $progress['completed_tasks'],
                    'committees_count' => $project->committees->count(),
                    'activities_count' => $project->committees->flatMap->activities->count(),
                ];
            });

        return response()->json([
            'projects' => $projects,
        ]);
    }
}
