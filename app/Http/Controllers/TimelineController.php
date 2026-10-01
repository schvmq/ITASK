<?php

namespace App\Http\Controllers;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\Task;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TimelineController extends Controller
{
    /**
     * Display the hierarchical Gantt timeline roadmap across projects, committees, and activities.
     */
    public function index(Request $request): Response
    {
        $userId = $request->user()->id;

        // 1. Determine authorized projects
        $projectQuery = Project::query()
            ->where(function ($q) use ($userId) {
                $q->where('created_by', $userId)
                  ->orWhereHas('roleAssignments', fn($sub) => $sub->where('user_id', $userId));
            })
            ->with([
                'committees.activities' => function ($q) {
                    $q->orderBy('start_date', 'asc')
                      ->with('tasks');
                },
            ]);

        $projectFilter = $request->input('project_id', 'all');
        if ($projectFilter !== 'all' && !empty($projectFilter)) {
            $projectQuery->where('id', $projectFilter);
        }

        $allProjects = Project::query()
            ->where(function ($q) use ($userId) {
                $q->where('created_by', $userId)
                  ->orWhereHas('roleAssignments', fn($sub) => $sub->where('user_id', $userId));
            })
            ->select('id', 'title')
            ->orderBy('title')
            ->get()
            ->map(fn($p) => [
                'id' => (string) $p->id,
                'title' => $p->title,
            ]);

        $projects = $projectQuery->orderBy('title')->get()->map(function (Project $project) {
            $totalActivities = 0;
            $completedActivities = 0;

            $committees = $project->committees->map(function (Committee $committee) use (&$totalActivities, &$completedActivities, $project) {
                $activities = $committee->activities->map(function (Activity $activity) use (&$totalActivities, &$completedActivities, $project, $committee) {
                    $totalActivities++;
                    if ($activity->status === Activity::STATUS_COMPLETED) {
                        $completedActivities++;
                    }

                    $totalTasks = $activity->tasks->count();
                    $completedTasks = $activity->tasks->where('status', Task::STATUS_COMPLETED)->count();

                    $progress = 0;
                    if ($activity->status === Activity::STATUS_COMPLETED) {
                        $progress = 100;
                    } elseif ($totalTasks > 0) {
                        $progress = (int) round(($completedTasks / $totalTasks) * 100);
                    } elseif ($activity->status === Activity::STATUS_IN_PROGRESS || $activity->status === Activity::STATUS_UNDER_REVIEW) {
                        $progress = 50;
                    }

                    return [
                        'id' => (string) $activity->id,
                        'title' => $activity->title,
                        'status' => $activity->status,
                        'start_date' => $activity->start_date?->format('Y-m-d'),
                        'due_date' => $activity->due_date?->format('Y-m-d'),
                        'start_date_formatted' => $activity->start_date ? $activity->start_date->format('M d, Y') : null,
                        'due_date_formatted' => $activity->due_date ? $activity->due_date->format('M d, Y') : null,
                        'tasks_total' => $totalTasks,
                        'tasks_completed' => $completedTasks,
                        'progress_percent' => $progress,
                        'action_url' => route('projects.committees.activities.show', [
                            'project' => $project->id,
                            'committee' => $committee->id,
                            'activity' => $activity->id,
                        ]),
                    ];
                });

                return [
                    'id' => (string) $committee->id,
                    'name' => $committee->name,
                    'activities_count' => $activities->count(),
                    'activities' => $activities,
                ];
            });

            $projectProgress = $totalActivities > 0
                ? (int) round(($completedActivities / $totalActivities) * 100)
                : 0;

            return [
                'id' => (string) $project->id,
                'title' => $project->title,
                'status' => $project->status,
                'start_date' => $project->start_date?->format('Y-m-d'),
                'end_date' => $project->end_date?->format('Y-m-d'),
                'start_date_formatted' => $project->start_date ? $project->start_date->format('M d, Y') : null,
                'end_date_formatted' => $project->end_date ? $project->end_date->format('M d, Y') : null,
                'progress_percent' => $projectProgress,
                'committees' => $committees,
            ];
        });

        return Inertia::render('Timeline/Index', [
            'projects' => $projects,
            'project_options' => $allProjects,
            'filters' => [
                'project_id' => $projectFilter,
            ],
        ]);
    }
}
