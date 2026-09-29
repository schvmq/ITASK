<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Services\ProjectProgressService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TimelineIndexController extends Controller
{
    public function __construct(
        protected ProjectProgressService $progressService
    ) {}

    /**
     * Show all projects accessible to the user with links to each project timeline.
     */
    public function index(Request $request): Response
    {
        $user   = $request->user();
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

                $progressData = $this->progressService->calculateProjectProgress($project);

                return [
                    'id'          => (string) $project->id,
                    'title'       => $project->title,
                    'description' => $project->description ?? '',
                    'status'      => $project->status,
                    'role'        => $role,
                    'start_date'  => $project->start_date?->format('M d, Y'),
                    'end_date'    => $project->end_date?->format('M d, Y'),
                    'progress'    => $progressData['progress'],
                    'total_tasks'     => $progressData['total_tasks'],
                    'completed_tasks' => $progressData['completed_tasks'],
                    'committees_count' => $project->committees->count(),
                    'timeline_url' => route('projects.timeline', $project->id),
                    'project_url'  => route('projects.show', $project->id),
                ];
            });

        return Inertia::render('Timeline/Index', [
            'projects' => $projects,
        ]);
    }
}
