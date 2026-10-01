<?php

namespace App\Http\Controllers;

use App\Models\Activity;
use App\Models\ChecklistItem;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class UserTaskController extends Controller
{
    /**
     * Display the task dashboard (personal deliverables or team project deliverables).
     */
    public function index(Request $request): Response
    {
        $user = $request->user();
        $userId = $user->id;
        $today = now()->startOfDay();

        // 1. Determine authorized projects for this user
        $authorizedProjectIds = Project::query()
            ->where('created_by', $userId)
            ->orWhereHas('roleAssignments', fn($q) => $q->where('user_id', $userId))
            ->pluck('id');

        $scope = $request->input('scope', 'mine'); // 'mine' or 'team'
        $view = $request->input('view', 'list');   // 'list' or 'board'

        // 2. Base query based on scope
        if ($scope === 'team') {
            // All tasks in projects user is involved in
            $baseQuery = Task::query()
                ->whereHas('activity', fn($q) => $q->whereIn('project_id', $authorizedProjectIds))
                ->with(['activity.committee.project', 'checklistItems', 'assignee']);
        } else {
            // Only tasks assigned directly to the authenticated user
            $baseQuery = Task::query()
                ->where('assigned_to', $userId)
                ->with(['activity.committee.project', 'checklistItems', 'assignee']);
        }

        // Count personal vs team tasks
        $myTasksCount = Task::where('assigned_to', $userId)->count();
        $teamTasksCount = Task::whereHas('activity', fn($q) => $q->whereIn('project_id', $authorizedProjectIds))->count();

        // 3. Calculate statistics for the current scope
        $scopeTasks = (clone $baseQuery)->get();

        $completedCount = $scopeTasks->where('status', Task::STATUS_COMPLETED)->count();
        $totalCount = $scopeTasks->count();
        $completionRate = $totalCount > 0 ? (int) round(($completedCount / $totalCount) * 100) : 0;

        $stats = [
            'total' => $totalCount,
            'todo' => $scopeTasks->where('status', Task::STATUS_TO_DO)->count(),
            'in_progress' => $scopeTasks->where('status', Task::STATUS_IN_PROGRESS)->count(),
            'under_review' => $scopeTasks->where('status', Task::STATUS_UNDER_REVIEW)->count(),
            'completed' => $completedCount,
            'completion_rate' => $completionRate,
            'overdue' => $scopeTasks->filter(function (Task $task) use ($today) {
                return $task->due_date
                    && Carbon::parse($task->due_date)->startOfDay()->lt($today)
                    && $task->status !== Task::STATUS_COMPLETED;
            })->count(),
        ];

        // 4. Extract distinct projects for filter dropdown
        $projects = $scopeTasks
            ->map(fn(Task $t) => $t->activity?->project)
            ->filter()
            ->unique('id')
            ->values()
            ->map(fn(Project $p) => [
                'id' => (string) $p->id,
                'title' => $p->title,
            ]);

        // 5. Apply status, project, and search filters
        $statusFilter = $request->input('status', 'all');
        $projectFilter = $request->input('project_id', 'all');
        $search = $request->input('search');

        $filteredQuery = clone $baseQuery;

        if ($statusFilter !== 'all' && !empty($statusFilter)) {
            if ($statusFilter === 'overdue') {
                $filteredQuery->whereNotNull('due_date')
                    ->where('due_date', '<', $today)
                    ->where('status', '!=', Task::STATUS_COMPLETED);
            } else {
                $filteredQuery->where('status', $statusFilter);
            }
        }

        if ($projectFilter !== 'all' && !empty($projectFilter)) {
            $filteredQuery->whereHas('activity', function ($q) use ($projectFilter) {
                $q->where('project_id', $projectFilter);
            });
        }

        if (!empty($search)) {
            $filteredQuery->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        // 6. Sort and transform task records
        $tasks = $filteredQuery
            ->orderByRaw('CASE WHEN due_date IS NULL THEN 1 ELSE 0 END')
            ->orderBy('due_date', 'asc')
            ->get()
            ->map(function (Task $task) use ($today, $userId) {
                $dueDate = $task->due_date ? Carbon::parse($task->due_date)->startOfDay() : null;
                $isOverdue = $dueDate && $dueDate->lt($today) && $task->status !== Task::STATUS_COMPLETED;
                $isApproaching = $dueDate && $dueDate->gte($today) && $dueDate->lte($today->copy()->addDays(2)) && $task->status !== Task::STATUS_COMPLETED;

                $checklistTotal = $task->checklistItems->count();
                $checklistCompleted = $task->checklistItems->where('is_completed', true)->count();

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
                    'is_assigned_to_me' => $task->assigned_to === $userId,
                    'assignee_name' => $task->assignee?->name ?? 'Unassigned',
                    'checklist_total' => $checklistTotal,
                    'checklist_completed' => $checklistCompleted,
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
            });

        return Inertia::render('Tasks/Index', [
            'tasks' => $tasks,
            'stats' => $stats,
            'projects' => $projects,
            'filters' => [
                'status' => $statusFilter,
                'project_id' => $projectFilter,
                'search' => $search ?? '',
                'scope' => $scope,
                'view' => $view,
            ],
            'my_tasks_count' => $myTasksCount,
            'team_tasks_count' => $teamTasksCount,
            'user_name' => $user->name,
        ]);
    }

    /**
     * Demo / testing helper: Assign 3 sample deliverables to the authenticated user.
     */
    public function assignSampleTasks(Request $request)
    {
        $userId = $request->user()->id;
        $activity = Activity::first();

        if (! $activity) {
            return back()->with('error', 'No activities found to attach tasks to.');
        }

        // Sample tasks with varied statuses & checklists
        $samples = [
            [
                'title' => 'Prepare CCIS Capstone Project Deliverables Checklist',
                'description' => 'Draft the initial project charter and finalize committee deliverables structure.',
                'status' => Task::STATUS_IN_PROGRESS,
                'due_date' => now()->addDays(3)->toDateString(),
                'requires_review' => true,
                'checklists' => [
                    ['title' => 'Download official CCIS document template', 'is_completed' => true],
                    ['title' => 'Input committee role assignments', 'is_completed' => true],
                    ['title' => 'Submit for Committee Staff review', 'is_completed' => false],
                ],
            ],
            [
                'title' => 'Review Committee Activity Evidences (MOVs)',
                'description' => 'Verify uploaded PDF documentation against institutional quality standards.',
                'status' => Task::STATUS_TO_DO,
                'due_date' => now()->addDays(7)->toDateString(),
                'requires_review' => false,
                'checklists' => [
                    ['title' => 'Check file size and format (PDF/DOCX)', 'is_completed' => false],
                    ['title' => 'Cross-reference attendee signatures', 'is_completed' => false],
                ],
            ],
            [
                'title' => 'Finalize Activity Milestone Accomplishment Report',
                'description' => 'Aggregate checklist progress and prepare summary presentation for Project Leader.',
                'status' => Task::STATUS_COMPLETED,
                'due_date' => now()->subDay()->toDateString(),
                'requires_review' => true,
                'checklists' => [
                    ['title' => 'Compile milestone metrics', 'is_completed' => true],
                    ['title' => 'Generate status graph', 'is_completed' => true],
                ],
            ],
        ];

        foreach ($samples as $data) {
            $checklists = $data['checklists'];
            unset($data['checklists']);

            $data['activity_id'] = $activity->id;
            $data['assigned_to'] = $userId;

            $task = Task::create($data);

            foreach ($checklists as $idx => $item) {
                ChecklistItem::create([
                    'task_id' => $task->id,
                    'title' => $item['title'],
                    'is_completed' => $item['is_completed'],
                    'order' => $idx + 1,
                ]);
            }
        }

        return redirect()->route('tasks.index')->with('success', '3 sample tasks assigned to your account successfully!');
    }
}
