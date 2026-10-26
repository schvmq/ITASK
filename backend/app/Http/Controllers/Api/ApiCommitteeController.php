<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\AssignCommitteeMemberRequest;
use App\Http\Requests\StoreCommitteeRequest;
use App\Http\Requests\UpdateCommitteeRequest;
use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\User;
use App\Services\Authorization\AuthorizationService;
use App\Services\Authorization\RoleRegistry;
use App\Services\ProjectProgressService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class ApiCommitteeController extends Controller
{
    public function __construct(
        protected ProjectProgressService $progressService,
        protected AuthorizationService $authService = new AuthorizationService()
    ) {}

    /**
     * Create committee within a project.
     */
    public function store(StoreCommitteeRequest $request, Project $project): JsonResponse
    {
        Gate::authorize('create', [Committee::class, $project]);

        $committee = DB::transaction(function () use ($request, $project) {
            $committee = $project->committees()->create([
                'name' => $request->validated('name'),
                'description' => $request->validated('description'),
            ]);

            if ($request->filled('user_id')) {
                $staffUserId = (int) $request->validated('user_id');
                $staffAssignment = ProjectRoleAssignment::where('project_id', $project->id)
                    ->where('user_id', $staffUserId)
                    ->where('role', RoleRegistry::ROLE_PROJECT_STAFF)
                    ->first();

                if ($staffAssignment) {
                    $staffAssignment->update(['committee_id' => $committee->id]);
                } else {
                    ProjectRoleAssignment::create([
                        'project_id' => $project->id,
                        'user_id' => $staffUserId,
                        'committee_id' => $committee->id,
                        'role' => RoleRegistry::ROLE_PROJECT_STAFF,
                    ]);
                }
            }

            return $committee;
        });

        return response()->json([
            'message' => 'Committee created successfully.',
            'committee' => [
                'id' => $committee->id,
                'name' => $committee->name,
                'description' => $committee->description,
            ],
        ], 201);
    }

    /**
     * Show committee details.
     */
    public function show(Project $project, Committee $committee): JsonResponse
    {
        if ((int) $committee->project_id !== (int) $project->id) {
            return response()->json(['message' => 'Committee not found in this project.'], 404);
        }

        Gate::authorize('view', $committee);

        $committee->load([
            'roleAssignments.user:id,name,email',
            'activities.tasks',
        ]);

        $staffAssignment = $committee->roleAssignments->firstWhere('role', RoleRegistry::ROLE_PROJECT_STAFF);
        $membersAssignments = $committee->roleAssignments->where('role', RoleRegistry::ROLE_PROJECT_MEMBER);

        return response()->json([
            'committee' => [
                'id' => $committee->id,
                'name' => $committee->name,
                'description' => $committee->description,
                'project_id' => $committee->project_id,
                'staff' => $staffAssignment ? [
                    'id' => $staffAssignment->user->id,
                    'name' => $staffAssignment->user->name,
                    'email' => $staffAssignment->user->email,
                ] : null,
                'members' => $membersAssignments->map(fn ($ra) => [
                    'id' => $ra->user->id,
                    'name' => $ra->user->name,
                    'email' => $ra->user->email,
                ])->values()->all(),
                'activities_count' => $committee->activities->count(),
            ],
        ]);
    }

    /**
     * Update committee details.
     */
    public function update(UpdateCommitteeRequest $request, Project $project, Committee $committee): JsonResponse
    {
        if ((int) $committee->project_id !== (int) $project->id) {
            return response()->json(['message' => 'Committee not found in this project.'], 404);
        }

        Gate::authorize('update', $committee);

        $committee->update($request->validated());

        return response()->json([
            'message' => 'Committee updated successfully.',
            'committee' => [
                'id' => $committee->id,
                'name' => $committee->name,
                'description' => $committee->description,
            ],
        ]);
    }

    /**
     * Delete committee.
     */
    public function destroy(Project $project, Committee $committee): JsonResponse
    {
        if ((int) $committee->project_id !== (int) $project->id) {
            return response()->json(['message' => 'Committee not found in this project.'], 404);
        }

        Gate::authorize('delete', $committee);

        DB::transaction(function () use ($committee) {
            $committee->roleAssignments()->delete();
            $committee->delete();
        });

        return response()->json([
            'message' => 'Committee deleted successfully.',
        ]);
    }

    /**
     * Assign staff head to committee.
     */
    public function assignStaff(Request $request, Project $project, Committee $committee): JsonResponse
    {
        if ((int) $committee->project_id !== (int) $project->id) {
            return response()->json(['message' => 'Committee not found in this project.'], 404);
        }

        Gate::authorize('update', $committee);

        $validated = $request->validate([
            'user_id' => ['required', 'exists:users,id'],
        ]);

        $userId = (int) $validated['user_id'];

        ProjectRoleAssignment::where('committee_id', $committee->id)
            ->where('role', RoleRegistry::ROLE_PROJECT_STAFF)
            ->update(['committee_id' => null]);

        ProjectRoleAssignment::updateOrCreate(
            [
                'project_id' => $project->id,
                'user_id' => $userId,
            ],
            [
                'committee_id' => $committee->id,
                'role' => RoleRegistry::ROLE_PROJECT_STAFF,
            ]
        );

        return response()->json([
            'message' => 'Staff assigned to committee successfully.',
        ]);
    }

    /**
     * Assign member to committee.
     */
    public function assignMember(AssignCommitteeMemberRequest $request, Project $project, Committee $committee): JsonResponse
    {
        if ((int) $committee->project_id !== (int) $project->id) {
            return response()->json(['message' => 'Committee not found in this project.'], 404);
        }

        Gate::authorize('manageMembers', $committee);

        $userId = (int) $request->validated('user_id');

        ProjectRoleAssignment::updateOrCreate(
            [
                'project_id' => $project->id,
                'user_id' => $userId,
                'committee_id' => $committee->id,
            ],
            [
                'role' => RoleRegistry::ROLE_PROJECT_MEMBER,
            ]
        );

        return response()->json([
            'message' => 'Member added to committee successfully.',
        ]);
    }

    /**
     * Remove member from committee.
     */
    public function removeMember(Project $project, Committee $committee, User $user): JsonResponse
    {
        if ((int) $committee->project_id !== (int) $project->id) {
            return response()->json(['message' => 'Committee not found in this project.'], 404);
        }

        Gate::authorize('manageMembers', $committee);

        ProjectRoleAssignment::where('project_id', $project->id)
            ->where('committee_id', $committee->id)
            ->where('user_id', $user->id)
            ->delete();

        return response()->json([
            'message' => 'Member removed from committee successfully.',
        ]);
    }
}
