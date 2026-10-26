<?php

namespace App\Http\Controllers\Api;

use App\Events\MessageSent;
use App\Events\UserRemovedFromProject;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreProjectPersonnelRequest;
use App\Http\Requests\StoreProjectRequest;
use App\Http\Requests\UpdateProjectRequest;
use App\Models\Chat;
use App\Models\Message;
use App\Models\Project;
use App\Models\ProjectApprovalDocument;
use App\Models\ProjectRoleAssignment;
use App\Models\User;
use App\Services\Authorization\AuthorizationService;
use App\Services\Authorization\RoleRegistry;
use App\Services\ProjectProgressService;
use App\Services\ProjectTimelineService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class ApiProjectController extends Controller
{
    public function __construct(
        protected ProjectProgressService $progressService,
        protected ProjectTimelineService $timelineService,
        protected AuthorizationService $authService = new AuthorizationService()
    ) {}

    /**
     * List user's active and assigned projects.
     */
    public function index(Request $request): JsonResponse
    {
        $userId = $request->user()?->id;

        $projects = Project::query()
            ->with(['roleAssignments', 'leaderAssignment.user'])
            ->where(function ($query) use ($userId) {
                $query->where('created_by', $userId)
                    ->orWhereHas('roleAssignments', function ($q) use ($userId) {
                        $q->where('user_id', $userId);
                    });
            })
            ->latest()
            ->get()
            ->map(function (Project $project) use ($userId) {
                $userAssignment = $project->roleAssignments->firstWhere('user_id', $userId);

                $role = $userAssignment?->role
                    ?? ($project->created_by === $userId ? RoleRegistry::ROLE_PROJECT_LEADER : RoleRegistry::ROLE_PROJECT_MEMBER);

                $projectProgress = $this->progressService->calculateProjectProgress($project);

                return [
                    'id' => (string) $project->id,
                    'title' => $project->title,
                    'description' => $project->description ?? '',
                    'status' => $project->status,
                    'role' => $role,
                    'progress' => $projectProgress['progress'] ?? 0,
                    'deadline' => $project->end_date ? $project->end_date->format('F d, Y') : 'No deadline',
                    'startDate' => $project->start_date ? $project->start_date->format('F d, Y') : null,
                    'committeesCount' => $project->committees()->count(),
                    'tasksCount' => $projectProgress['total_tasks'] ?? 0,
                    'activitiesCount' => $project->activities()->count(),
                ];
            });

        $availableUsers = $userId ? User::query()
            ->where('id', '!=', $userId)
            ->whereNotNull('email_verified_at')
            ->select(['id', 'name', 'email'])
            ->orderBy('name')
            ->get()
            ->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
            ])
            ->values()
            ->all() : [];

        return response()->json([
            'projects' => $projects,
            'availableUsers' => $availableUsers,
        ]);
    }

    /**
     * Create a new project with approval document.
     */
    public function store(StoreProjectRequest $request): JsonResponse
    {
        if ($this->authService->isAdmin($request->user())) {
            return response()->json(['message' => 'Administrators cannot create projects.'], 403);
        }

        $file = $request->file('approval_document');
        $storedFilePath = null;

        $project = DB::transaction(function () use ($request, $file, &$storedFilePath) {
            $project = Project::create([
                'title' => $request->validated('title'),
                'description' => $request->validated('description'),
                'start_date' => $request->validated('start_date'),
                'end_date' => $request->validated('end_date'),
                'status' => Project::STATUS_PLANNING,
                'created_by' => $request->user()->id,
            ]);

            ProjectRoleAssignment::create([
                'project_id' => $project->id,
                'user_id' => $request->user()->id,
                'role' => RoleRegistry::ROLE_PROJECT_LEADER,
                'committee_id' => null,
            ]);

            $chat = Chat::create([
                'project_id' => $project->id,
            ]);

            $chat->messages()->create([
                'sender_id' => null,
                'type' => Message::TYPE_SYSTEM,
                'body' => 'Project chat created. Everyone in this project can message here.',
            ]);

            $memberIds = $request->validated('member_ids') ?? [];
            $memberRoles = $request->validated('member_roles') ?? [];

            $uniqueMemberIds = array_values(array_unique(array_filter(
                $memberIds,
                fn ($id) => (int) $id !== (int) $request->user()->id
            )));

            if (! empty($uniqueMemberIds)) {
                $selectedUsers = User::whereIn('id', $uniqueMemberIds)->get(['id', 'name', 'email']);

                foreach ($selectedUsers as $memberUser) {
                    $role = $memberRoles[$memberUser->id] ?? RoleRegistry::ROLE_PROJECT_MEMBER;
                    if (! in_array($role, [RoleRegistry::ROLE_PROJECT_MEMBER, RoleRegistry::ROLE_PROJECT_STAFF])) {
                        $role = RoleRegistry::ROLE_PROJECT_MEMBER;
                    }

                    ProjectRoleAssignment::create([
                        'project_id' => $project->id,
                        'user_id' => $memberUser->id,
                        'role' => $role,
                        'committee_id' => null,
                    ]);

                    $chat->messages()->create([
                        'sender_id' => null,
                        'type' => Message::TYPE_SYSTEM,
                        'body' => "{$memberUser->name} joined the project",
                    ]);
                }
            }

            $directory = "project_approvals/{$project->id}";
            $storedFilePath = $file->store($directory, 'local');

            ProjectApprovalDocument::create([
                'project_id' => $project->id,
                'uploaded_by' => $request->user()->id,
                'original_name' => $file->getClientOriginalName(),
                'file_path' => $storedFilePath,
                'file_size' => $file->getSize(),
                'mime_type' => $file->getClientMimeType(),
            ]);

            return $project;
        });

        return response()->json([
            'message' => 'Project created successfully.',
            'project' => [
                'id' => (string) $project->id,
                'title' => $project->title,
                'status' => $project->status,
            ],
        ], 201);
    }

    /**
     * Show project details, committees, and personnel.
     */
    public function show(Request $request, Project $project): JsonResponse
    {
        Gate::authorize('view', $project);

        $userId = $request->user()->id;

        $projectModel = Project::query()
            ->with([
                'creator:id,name,email',
                'roleAssignments.user:id,name,email',
                'committees.roleAssignments.user:id,name,email',
                'approvalDocuments.uploader:id,name',
            ])
            ->findOrFail($project->id);

        $userAssignment = $projectModel->roleAssignments->firstWhere('user_id', $userId);
        $userRole = $userAssignment?->role
            ?? ($projectModel->created_by === $userId ? RoleRegistry::ROLE_PROJECT_LEADER : RoleRegistry::ROLE_PROJECT_MEMBER);

        $progressData = $this->progressService->calculateProjectProgress($projectModel);

        return response()->json([
            'project' => [
                'id' => (string) $projectModel->id,
                'title' => $projectModel->title,
                'description' => $projectModel->description,
                'status' => $projectModel->status,
                'start_date' => $projectModel->start_date?->format('Y-m-d'),
                'end_date' => $projectModel->end_date?->format('Y-m-d'),
                'created_by' => $projectModel->created_by,
                'creator' => $projectModel->creator,
                'role' => $userRole,
                'progress' => $progressData,
                'committees' => $projectModel->committees->map(fn ($c) => [
                    'id' => $c->id,
                    'name' => $c->name,
                    'description' => $c->description,
                    'members_count' => $c->roleAssignments->count(),
                ]),
                'personnel' => $projectModel->roleAssignments->map(fn ($ra) => [
                    'id' => $ra->id,
                    'user_id' => $ra->user_id,
                    'user_name' => $ra->user?->name,
                    'user_email' => $ra->user?->email,
                    'role' => $ra->role,
                ]),
            ],
            'can' => [
                'update' => $this->authService->canUpdateProject($request->user(), $projectModel),
                'archive' => $this->authService->canArchiveProject($request->user(), $projectModel),
                'manage_personnel' => $this->authService->isProjectLeader($request->user(), $projectModel),
            ],
        ]);
    }

    /**
     * Update project attributes.
     */
    public function update(UpdateProjectRequest $request, Project $project): JsonResponse
    {
        Gate::authorize('update', $project);

        $project->update($request->validated());
        ProjectProgressService::clearProjectProgressCache($project->id);

        return response()->json([
            'message' => 'Project updated successfully.',
            'project' => [
                'id' => (string) $project->id,
                'title' => $project->title,
                'description' => $project->description,
                'status' => $project->status,
            ],
        ]);
    }

    /**
     * Archive project.
     */
    public function archive(Request $request, Project $project): JsonResponse
    {
        Gate::authorize('archive', $project);

        $project->update(['status' => Project::STATUS_ARCHIVED]);
        ProjectProgressService::clearProjectProgressCache($project->id);

        return response()->json([
            'message' => 'Project archived successfully.',
            'status' => Project::STATUS_ARCHIVED,
        ]);
    }

    /**
     * Unarchive project.
     */
    public function unarchive(Request $request, Project $project): JsonResponse
    {
        Gate::authorize('archive', $project);

        $project->update(['status' => Project::STATUS_ACTIVE]);
        ProjectProgressService::clearProjectProgressCache($project->id);

        return response()->json([
            'message' => 'Project unarchived successfully.',
            'status' => Project::STATUS_ACTIVE,
        ]);
    }

    /**
     * Soft delete project.
     */
    public function destroy(Request $request, Project $project): JsonResponse
    {
        Gate::authorize('archive', $project);

        $project->delete();
        ProjectProgressService::clearProjectProgressCache($project->id);

        return response()->json([
            'message' => 'Project deleted successfully.',
        ]);
    }

    /**
     * Assign project personnel.
     */
    public function storePersonnel(StoreProjectPersonnelRequest $request, Project $project): JsonResponse
    {
        Gate::authorize('update', $project);

        $userId = (int) $request->validated('user_id');
        $role = $request->validated('role');

        if ((int) $project->created_by === $userId) {
            return response()->json(['message' => 'The Project Leader assignment cannot be altered.'], 403);
        }

        $isExistingLeader = ProjectRoleAssignment::where('project_id', $project->id)
            ->where('user_id', $userId)
            ->where('role', RoleRegistry::ROLE_PROJECT_LEADER)
            ->exists();

        if ($isExistingLeader) {
            return response()->json(['message' => 'The Project Leader assignment cannot be altered.'], 403);
        }

        $isNewMember = ! ProjectRoleAssignment::where('project_id', $project->id)
            ->where('user_id', $userId)
            ->exists();

        $assignment = ProjectRoleAssignment::updateOrCreate(
            [
                'project_id' => $project->id,
                'user_id' => $userId,
            ],
            [
                'role' => $role,
            ]
        );

        if ($isNewMember) {
            $assignedUser = User::find($userId);
            if ($assignedUser && $project->chat) {
                $msg = $project->chat->messages()->create([
                    'sender_id' => null,
                    'type' => Message::TYPE_SYSTEM,
                    'body' => "{$assignedUser->name} joined the project",
                ]);

                try {
                    broadcast(new MessageSent($msg))->toOthers();
                } catch (\Throwable $e) {
                    report($e);
                }
            }
        }

        return response()->json([
            'message' => "Personnel assigned as {$role} successfully.",
            'assignment' => [
                'id' => $assignment->id,
                'user_id' => $assignment->user_id,
                'role' => $assignment->role,
            ],
        ]);
    }

    /**
     * Remove project personnel.
     */
    public function destroyPersonnel(Request $request, Project $project, User $user): JsonResponse
    {
        Gate::authorize('update', $project);

        if ((int) $project->created_by === (int) $user->id) {
            return response()->json(['message' => 'Cannot remove the Project Leader.'], 403);
        }

        $assignment = ProjectRoleAssignment::where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        if ($assignment->isLeader()) {
            return response()->json(['message' => 'Cannot remove the Project Leader.'], 403);
        }

        $assignment->delete();

        if ($project->chat) {
            $msg = $project->chat->messages()->create([
                'sender_id' => null,
                'type' => Message::TYPE_SYSTEM,
                'body' => "{$user->name} left the project",
            ]);

            try {
                broadcast(new MessageSent($msg))->toOthers();
                broadcast(new UserRemovedFromProject($project->chat->id, $user->id))->toOthers();
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return response()->json([
            'message' => 'Personnel removed from project.',
        ]);
    }
}
