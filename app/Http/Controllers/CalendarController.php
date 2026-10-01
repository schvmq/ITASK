<?php

namespace App\Http\Controllers;

use App\Models\Activity;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CalendarController extends Controller
{
    /**
     * Display the monthly project and task schedule calendar.
     */
    public function index(Request $request): Response
    {
        $userId = $request->user()->id;
        $today = now()->startOfDay();

        // 1. Determine projects the user is authorized to see
        $authorizedProjectIds = Project::query()
            ->where('created_by', $userId)
            ->orWhereHas('roleAssignments', fn($q) => $q->where('user_id', $userId))
            ->pluck('id');

        // Distinct project options for filtering
        $projects = Project::query()
            ->whereIn('id', $authorizedProjectIds)
            ->select('id', 'title')
            ->orderBy('title')
            ->get()
            ->map(fn($p) => [
                'id' => (string) $p->id,
                'title' => $p->title,
            ]);

        $projectFilter = $request->input('project_id', 'all');
        $typeFilter = $request->input('type', 'all'); // 'all', 'tasks', 'activities'

        // 2. Fetch Tasks with due dates
        $tasksQuery = Task::query()
            ->whereNotNull('due_date')
            ->whereHas('activity', function ($q) use ($authorizedProjectIds, $projectFilter) {
                $q->whereIn('project_id', $authorizedProjectIds);
                if ($projectFilter !== 'all' && !empty($projectFilter)) {
                    $q->where('project_id', $projectFilter);
                }
            })
            ->with(['activity.committee.project', 'assignee']);

        // 3. Fetch Activities with dates
        $activitiesQuery = Activity::query()
            ->where(function ($q) {
                $q->whereNotNull('start_date')
                  ->orWhereNotNull('due_date');
            })
            ->whereIn('project_id', $authorizedProjectIds)
            ->with(['project', 'committee']);

        if ($projectFilter !== 'all' && !empty($projectFilter)) {
            $activitiesQuery->where('project_id', $projectFilter);
        }

        $events = collect();

        // Include Tasks in calendar events
        if ($typeFilter === 'all' || $typeFilter === 'tasks') {
            $tasks = $tasksQuery->get();
            foreach ($tasks as $task) {
                $dueDate = Carbon::parse($task->due_date)->startOfDay();
                $isOverdue = $dueDate->lt($today) && $task->status !== Task::STATUS_COMPLETED;

                $events->push([
                    'id' => "task-{$task->id}",
                    'raw_id' => (string) $task->id,
                    'type' => 'task',
                    'title' => $task->title,
                    'description' => $task->description,
                    'status' => $task->status,
                    'date' => $task->due_date->format('Y-m-d'),
                    'start_date' => $task->due_date->format('Y-m-d'),
                    'end_date' => $task->due_date->format('Y-m-d'),
                    'due_date_formatted' => $task->due_date->format('M d, Y'),
                    'is_overdue' => $isOverdue,
                    'assigned_to_user' => $task->assigned_to === $userId,
                    'assignee_name' => $task->assignee?->name ?? 'Unassigned',
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
                ]);
            }
        }

        // Include Activities in calendar events
        if ($typeFilter === 'all' || $typeFilter === 'activities') {
            $activities = $activitiesQuery->get();
            foreach ($activities as $act) {
                $date = $act->due_date ?? $act->start_date;
                if (!$date) {
                    continue;
                }

                $dueDate = $act->due_date ? Carbon::parse($act->due_date)->startOfDay() : null;
                $isOverdue = $dueDate && $dueDate->lt($today) && $act->status !== Activity::STATUS_COMPLETED;

                $events->push([
                    'id' => "activity-{$act->id}",
                    'raw_id' => (string) $act->id,
                    'type' => 'activity',
                    'title' => $act->title,
                    'description' => $act->description,
                    'status' => $act->status,
                    'date' => $date->format('Y-m-d'),
                    'start_date' => $act->start_date?->format('Y-m-d'),
                    'end_date' => $act->due_date?->format('Y-m-d'),
                    'due_date_formatted' => $act->due_date ? $act->due_date->format('M d, Y') : ($act->start_date ? $act->start_date->format('M d, Y') : 'No date'),
                    'is_overdue' => (bool) $isOverdue,
                    'assigned_to_user' => false,
                    'assignee_name' => null,
                    'project' => [
                        'id' => (string) $act->project_id,
                        'title' => $act->project->title,
                    ],
                    'committee' => [
                        'id' => (string) $act->committee_id,
                        'name' => $act->committee->name,
                    ],
                    'activity' => [
                        'id' => (string) $act->id,
                        'title' => $act->title,
                    ],
                    'action_url' => route('projects.committees.activities.show', [
                        'project' => $act->project_id,
                        'committee' => $act->committee_id,
                        'activity' => $act->id,
                    ]),
                ]);
            }
        }

        return Inertia::render('Calendar/Index', [
            'events' => $events->values(),
            'projects' => $projects,
            'filters' => [
                'project_id' => $projectFilter,
                'type' => $typeFilter,
            ],
        ]);
    }
}
