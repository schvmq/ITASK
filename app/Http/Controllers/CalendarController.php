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
     * Display a calendar view of existing ITASK project/activity/task dates.
     *
     * Respects project/committee authorization — users only see dates
     * for projects/activities/tasks they are authorized to access.
     */
    public function index(Request $request): Response
    {
        $user   = $request->user();
        $userId = $user->id;

        // Determine the user's scoped project/committee access
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

        // ── 1. Project start/end dates ────────────────────────────────────────
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
                    'id'         => "project-start-{$project->id}",
                    'type'       => 'project_start',
                    'title'      => $project->title,
                    'label'      => 'Project Start',
                    'date'       => $project->start_date->format('Y-m-d'),
                    'date_formatted' => $project->start_date->format('M d, Y'),
                    'status'     => $project->status,
                    'role'       => $userRole,
                    'url'        => route('projects.show', $project->id),
                    'color_group' => 'project',
                ]);
            }
            if ($project->end_date) {
                $events->push([
                    'id'         => "project-end-{$project->id}",
                    'type'       => 'project_deadline',
                    'title'      => $project->title,
                    'label'      => 'Project Deadline',
                    'date'       => $project->end_date->format('Y-m-d'),
                    'date_formatted' => $project->end_date->format('M d, Y'),
                    'status'     => $project->status,
                    'role'       => $userRole,
                    'url'        => route('projects.show', $project->id),
                    'color_group' => 'project_deadline',
                ]);
            }
        }

        // ── 2. Activity start/due dates ───────────────────────────────────────
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

        $activities = $activityQuery->get();

        foreach ($activities as $activity) {
            if ($activity->start_date) {
                $events->push([
                    'id'         => "activity-start-{$activity->id}",
                    'type'       => 'activity_start',
                    'title'      => $activity->title,
                    'label'      => 'Activity Start',
                    'date'       => $activity->start_date->format('Y-m-d'),
                    'date_formatted' => $activity->start_date->format('M d, Y'),
                    'status'     => $activity->status,
                    'project'    => ['id' => (string) $activity->project_id, 'title' => $activity->project->title],
                    'committee'  => ['id' => (string) $activity->committee_id, 'name' => $activity->committee->name],
                    'url'        => route('projects.committees.activities.show', [
                        'project'   => $activity->project_id,
                        'committee' => $activity->committee_id,
                        'activity'  => $activity->id,
                    ]),
                    'color_group' => 'activity',
                ]);
            }
            if ($activity->due_date) {
                $events->push([
                    'id'         => "activity-due-{$activity->id}",
                    'type'       => 'activity_due',
                    'title'      => $activity->title,
                    'label'      => 'Activity Due',
                    'date'       => $activity->due_date->format('Y-m-d'),
                    'date_formatted' => $activity->due_date->format('M d, Y'),
                    'status'     => $activity->status,
                    'project'    => ['id' => (string) $activity->project_id, 'title' => $activity->project->title],
                    'committee'  => ['id' => (string) $activity->committee_id, 'name' => $activity->committee->name],
                    'url'        => route('projects.committees.activities.show', [
                        'project'   => $activity->project_id,
                        'committee' => $activity->committee_id,
                        'activity'  => $activity->id,
                    ]),
                    'color_group' => 'activity_due',
                ]);
            }
        }

        // ── 3. Task due dates (scoped) ────────────────────────────────────────
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

        $tasks = $taskQuery->get();

        foreach ($tasks as $task) {
            $events->push([
                'id'         => "task-due-{$task->id}",
                'type'       => 'task_due',
                'title'      => $task->title,
                'label'      => 'Task Due',
                'date'       => $task->due_date->format('Y-m-d'),
                'date_formatted' => $task->due_date->format('M d, Y'),
                'status'     => $task->status,
                'project'    => ['id' => (string) $task->activity->project_id, 'title' => $task->activity->project->title],
                'committee'  => ['id' => (string) $task->activity->committee_id, 'name' => $task->activity->committee->name],
                'activity'   => ['id' => (string) $task->activity->id, 'title' => $task->activity->title],
                'assignee'   => $task->assignee ? ['id' => $task->assignee->id, 'name' => $task->assignee->name] : null,
                'is_mine'    => $task->assigned_to === $userId,
                'url'        => route('projects.committees.activities.show', [
                    'project'   => $task->activity->project_id,
                    'committee' => $task->activity->committee_id,
                    'activity'  => $task->activity->id,
                ]),
                'color_group' => 'task',
            ]);
        }

        // Sort all events by date
        $sortedEvents = $events->sortBy('date')->values();

        return Inertia::render('Calendar/Index', [
            'events' => $sortedEvents,
        ]);
    }
}
