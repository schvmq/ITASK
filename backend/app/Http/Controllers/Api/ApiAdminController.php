<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Models\User;
use App\Services\Authorization\AuthorizationService;
use App\Services\ProjectProgressService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class ApiAdminController extends Controller
{
    public function __construct(
        protected ProjectProgressService $progressService,
        protected AuthorizationService $authService = new AuthorizationService()
    ) {}

    /**
     * Get admin dashboard overview and datasets.
     */
    public function index(Request $request): JsonResponse
    {
        $search = $request->query('search', '');
        $roleFilter = $request->query('role', 'all');
        $activeTab = $request->query('tab', 'all');

        $usersQuery = User::query()
            ->with([
                'projectRoleAssignments.project:id,title',
                'projectRoleAssignments.committee:id,name',
                'createdProjects:id,title,created_by',
            ])
            ->withCount(['assignedTasks', 'createdProjects'])
            ->when($search, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                      ->orWhere('email', 'like', "%{$search}%");
                });
            })
            ->when($roleFilter === 'admin' || $activeTab === 'admins', fn ($q) => $q->where('is_admin', true))
            ->when($roleFilter === 'non-admin', fn ($q) => $q->where('is_admin', false))
            ->when($roleFilter === 'pending' || $activeTab === 'pending', fn ($q) => $q->whereNull('email_verified_at'))
            ->when($roleFilter === 'verified' || $activeTab === 'verified', fn ($q) => $q->whereNotNull('email_verified_at'))
            ->when($roleFilter === 'leader', function ($q) {
                $q->whereHas('createdProjects')
                  ->orWhereHas('projectRoleAssignments', fn ($rq) => $rq->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER));
            })
            ->when($roleFilter === 'staff', function ($q) {
                $q->whereHas('projectRoleAssignments', fn ($rq) => $rq->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF));
            })
            ->when($roleFilter === 'member', function ($q) {
                $q->whereHas('projectRoleAssignments', fn ($rq) => $rq->where('role', ProjectRoleAssignment::ROLE_PROJECT_MEMBER));
            })
            ->orderByRaw('CASE WHEN email_verified_at IS NULL THEN 0 ELSE 1 END')
            ->orderBy('is_admin', 'desc')
            ->orderBy('name', 'asc');

        $users = $usersQuery->get()->map(function (User $user) {
            return [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'email_verified_at' => $user->email_verified_at?->toISOString(),
                'is_admin' => (bool) $user->is_admin,
                'created_at' => $user->created_at?->toISOString(),
                'created_at_formatted' => $user->created_at?->format('M d, Y'),
                'assigned_tasks_count' => $user->assigned_tasks_count ?? 0,
                'created_projects_count' => $user->created_projects_count ?? 0,
                'computed_roles' => $this->authService->getUserRoles($user),
                'project_role_assignments' => $user->projectRoleAssignments->map(function ($pra) {
                    return [
                        'id' => $pra->id,
                        'project_id' => $pra->project_id,
                        'project_title' => $pra->project?->title ?? 'Unknown Project',
                        'role' => $pra->role,
                        'committee_name' => $pra->committee?->name,
                    ];
                })->values()->all(),
            ];
        });

        $projects = Project::query()
            ->with(['creator:id,name', 'committees.activities.tasks', 'roleAssignments.user'])
            ->orderByRaw("CASE WHEN status = 'Archived' THEN 1 ELSE 0 END")
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function (Project $project) {
                $progress = $this->progressService->calculateProjectProgress($project);
                $isArchived = $project->status === Project::STATUS_ARCHIVED;

                return [
                    'id' => $project->id,
                    'title' => $project->title,
                    'description' => $project->description,
                    'status' => $project->status,
                    'is_archived' => $isArchived,
                    'created_by' => $project->created_by,
                    'creator_name' => $project->creator?->name ?? 'Unknown',
                    'start_date' => $project->start_date?->format('Y-m-d'),
                    'target_date' => $project->target_date?->format('Y-m-d'),
                    'progress_percentage' => $progress['progress_percentage'] ?? 0,
                    'total_activities' => $progress['total_activities'] ?? 0,
                    'completed_activities' => $progress['completed_activities'] ?? 0,
                    'total_tasks' => $progress['total_tasks'] ?? 0,
                    'completed_tasks' => $progress['completed_tasks'] ?? 0,
                    'committees_count' => $project->committees->count(),
                    'personnel_count' => $project->roleAssignments->count(),
                ];
            });

        $metrics = [
            'total_users' => User::count(),
            'pending_verifications' => User::whereNull('email_verified_at')->count(),
            'verified_users' => User::whereNotNull('email_verified_at')->count(),
            'total_admins' => User::where('is_admin', true)->count(),
            'total_projects' => Project::count(),
            'active_projects' => Project::where('status', '!=', Project::STATUS_ARCHIVED)->count(),
            'archived_projects' => Project::where('status', Project::STATUS_ARCHIVED)->count(),
            'total_activities' => Activity::count(),
            'total_tasks' => Task::count(),
        ];

        return response()->json([
            'users' => $users,
            'projects' => $projects,
            'metrics' => $metrics,
            'settings' => [
                'announcement' => Cache::get('itask_system_announcement', ''),
            ],
        ]);
    }

    /**
     * Verify a user account.
     */
    public function verifyUser(Request $request, User $user): JsonResponse
    {
        $user->forceFill([
            'email_verified_at' => now(),
        ])->save();

        return response()->json([
            'message' => "Account for \"{$user->name}\" ({$user->email}) was successfully verified.",
            'user' => [
                'id' => $user->id,
                'email_verified_at' => $user->email_verified_at->toISOString(),
            ],
        ]);
    }

    /**
     * Deny and delete unverified account.
     */
    public function denyUser(Request $request, User $user): JsonResponse
    {
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'You cannot deny your own administrator account.'], 403);
        }

        $userName = $user->name;
        $userEmail = $user->email;

        DB::transaction(function () use ($user) {
            $user->projectRoleAssignments()->delete();
            $user->delete();
        });

        return response()->json([
            'message' => "Registration for \"{$userName}\" ({$userEmail}) has been denied and removed.",
        ]);
    }

    /**
     * Update user role or admin status.
     */
    public function updateRole(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'is_admin' => ['nullable', 'boolean'],
            'project_id' => ['nullable', 'exists:projects,id'],
            'role' => ['nullable', 'in:Project Leader,Project Staff,Project Member'],
            'remove_assignment_id' => ['nullable', 'exists:project_role_assignments,id'],
        ]);

        if (isset($validated['is_admin']) && $user->id === $request->user()->id && ! $validated['is_admin']) {
            return response()->json(['message' => 'You cannot revoke your own administrator status.'], 403);
        }

        DB::transaction(function () use ($validated, $user) {
            if (isset($validated['is_admin'])) {
                $user->update(['is_admin' => $validated['is_admin']]);
            }

            if (! empty($validated['remove_assignment_id'])) {
                ProjectRoleAssignment::where('id', $validated['remove_assignment_id'])
                    ->where('user_id', $user->id)
                    ->delete();
            }

            if (! empty($validated['project_id']) && ! empty($validated['role'])) {
                ProjectRoleAssignment::updateOrCreate(
                    [
                        'project_id' => $validated['project_id'],
                        'user_id' => $user->id,
                    ],
                    [
                        'role' => $validated['role'],
                    ]
                );
            }
        });

        return response()->json([
            'message' => "Roles for {$user->name} have been updated successfully.",
            'user' => [
                'id' => $user->id,
                'is_admin' => (bool) $user->is_admin,
                'computed_roles' => $this->authService->getUserRoles($user),
            ],
        ]);
    }

    /**
     * Toggle a user's admin privilege.
     */
    public function toggleAdmin(Request $request, User $user): JsonResponse
    {
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'You cannot alter your own admin privileges.'], 403);
        }

        $newStatus = ! $user->isAdmin();
        $user->update(['is_admin' => $newStatus]);

        $statusLabel = $newStatus ? 'granted' : 'revoked';

        return response()->json([
            'message' => "Administrator status {$statusLabel} for {$user->name}.",
            'is_admin' => $newStatus,
        ]);
    }

    /**
     * Delete user account.
     */
    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'You cannot remove your own account.'], 403);
        }

        $userName = $user->name;

        DB::transaction(function () use ($user) {
            $user->delete();
        });

        return response()->json([
            'message' => "User account for '{$userName}' was permanently removed.",
        ]);
    }

    /**
     * Toggle project archive state.
     */
    public function toggleProjectArchive(Request $request, Project $project): JsonResponse
    {
        $newStatus = ($project->status === Project::STATUS_ARCHIVED)
            ? Project::STATUS_ACTIVE
            : Project::STATUS_ARCHIVED;

        $project->update(['status' => $newStatus]);
        ProjectProgressService::clearProjectProgressCache($project->id);

        $action = $newStatus === Project::STATUS_ARCHIVED ? 'archived' : 'restored';

        return response()->json([
            'message' => "Project \"{$project->title}\" has been {$action}.",
            'status' => $newStatus,
            'is_archived' => $newStatus === Project::STATUS_ARCHIVED,
        ]);
    }

    /**
     * Update system announcement.
     */
    public function updateSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'announcement' => ['nullable', 'string', 'max:500'],
        ]);

        Cache::put('itask_system_announcement', $validated['announcement'] ?? '', now()->addDays(30));

        return response()->json([
            'message' => 'Institutional settings updated successfully.',
            'announcement' => $validated['announcement'] ?? '',
        ]);
    }
}
