<?php

namespace App\Http\Controllers;

use App\Http\Requests\AssignCommitteeMemberRequest;
use App\Http\Requests\StoreCommitteeRequest;
use App\Http\Requests\UpdateCommitteeRequest;
use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class CommitteeController extends Controller
{
    /**
     * Store a newly created committee in storage.
     */
    public function store(StoreCommitteeRequest $request, Project $project): RedirectResponse
    {
        Gate::authorize('create', [Committee::class, $project]);

        DB::transaction(function () use ($request, $project) {
            $committee = $project->committees()->create([
                'name' => $request->validated('name'),
                'description' => $request->validated('description'),
            ]);

            // Assign the selected Project Staff member as head of this committee if provided
            if ($request->filled('user_id')) {
                $staffAssignment = ProjectRoleAssignment::where('project_id', $project->id)
                    ->where('user_id', $request->validated('user_id'))
                    ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
                    ->firstOrFail();

                $staffAssignment->update(['committee_id' => $committee->id]);
            }

            return $committee;
        });

        return redirect()->route('projects.show', $project)->with('status', 'Committee created successfully.');
    }

    /**
     * Display the specified committee details.
     */
    public function show(Project $project, Committee $committee): Response
    {
        // 1. Verify committee belongs to this project
        if ((int) $committee->project_id !== (int) $project->id) {
            abort(404, 'Committee not found in this project.');
        }

        // 2. Authorize view
        Gate::authorize('view', $committee);

        $committee->load([
            'project',
            'staffAssignment.user',
            'memberAssignments.user',
            'activities.tasks.assignee',
            'activities.creator',
        ]);

        $user = Auth::user();
        $canManage = $user ? Gate::forUser($user)->allows('manageMembers', $committee) : false;

        // Retrieve available Project Members in this project who are not yet in this committee
        $availableMembers = $canManage
            ? ProjectRoleAssignment::where('project_id', $project->id)
                ->where('role', ProjectRoleAssignment::ROLE_PROJECT_MEMBER)
                ->where(function ($q) use ($committee) {
                    $q->whereNull('committee_id')
                        ->orWhere('committee_id', '!=', $committee->id);
                })
                ->with('user')
                ->get()
                ->map(fn ($assignment) => [
                    'id' => $assignment->user->id,
                    'name' => $assignment->user->name,
                    'email' => $assignment->user->email,
                ])
                ->values()
                ->all()
            : [];

        // Available Project Staff in this project for changing committee head
        $availableStaff = $canManage
            ? ProjectRoleAssignment::where('project_id', $project->id)
                ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
                ->whereHas('user', function ($q) {
                    $q->whereNotNull('email_verified_at');
                })
                ->with('user')
                ->get()
                ->map(fn ($assignment) => [
                    'id' => $assignment->user->id,
                    'name' => $assignment->user->name,
                    'email' => $assignment->user->email,
                ])
                ->values()
                ->all()
            : [];

        $committeeData = [
            'id' => (string) $committee->id,
            'name' => $committee->name,
            'description' => $committee->description,
            'project' => [
                'id' => (string) $project->id,
                'title' => $project->title,
                'status' => $project->status,
            ],
            'head' => $committee->staffAssignment?->user ? [
                'id' => $committee->staffAssignment->user->id,
                'name' => $committee->staffAssignment->user->name,
                'email' => $committee->staffAssignment->user->email,
            ] : null,
            'members' => $committee->memberAssignments->map(fn ($assignment) => [
                'id' => $assignment->user->id,
                'name' => $assignment->user->name,
                'email' => $assignment->user->email,
                'assigned_at' => $assignment->updated_at?->format('F d, Y'),
            ])->values()->all(),
            'can' => [
                'update' => $user ? Gate::forUser($user)->allows('update', $committee) : false,
                'delete' => $user ? Gate::forUser($user)->allows('delete', $committee) : false,
                'manageMembers' => $canManage,
                'createActivity' => $user ? Gate::forUser($user)->allows('create', [Activity::class, $committee]) : false,
            ],
            'activities' => $committee->activities->map(fn ($act) => [
                'id' => (string) $act->id,
                'title' => $act->title,
                'description' => $act->description,
                'status' => $act->status,
                'due_date' => $act->due_date?->format('M d, Y'),
                'due_date_raw' => $act->due_date?->format('Y-m-d'),
                'tasks_count' => $act->tasks->count(),
                'completed_tasks_count' => $act->tasks->where('status', Task::STATUS_COMPLETED)->count(),
                'creator' => $act->creator ? [
                    'id' => $act->creator->id,
                    'name' => $act->creator->name,
                ] : null,
            ])->values()->all(),
        ];

        $userRole = ($user && $project)
            ? $project->roleAssignments()->where('user_id', $user->id)->value('role')
            : null;

        return Inertia::render('Committees/Show', [
            'project' => [
                'id' => (string) $project->id,
                'title' => $project->title,
                'status' => $project->status,
                'role' => $userRole ?? 'Project Member',
            ],
            'committee' => $committeeData,
            'availableMembers' => $availableMembers,
            'availableStaff' => $availableStaff,
        ]);
    }

    /**
     * Update the specified committee.
     */
    public function update(UpdateCommitteeRequest $request, Project $project, Committee $committee): RedirectResponse
    {
        if ((int) $committee->project_id !== (int) $project->id) {
            abort(404, 'Committee not found in this project.');
        }

        Gate::authorize('update', $committee);

        DB::transaction(function () use ($request, $project, $committee) {
            $dataToUpdate = $request->safe()->only(['name', 'description']);
            if (! empty($dataToUpdate)) {
                $committee->update($dataToUpdate);
            }

            if ($request->has('user_id')) {
                $newStaffUserId = $request->validated('user_id') ? (int) $request->validated('user_id') : null;

                // Clear previous head's committee assignment if different or if unassigning
                ProjectRoleAssignment::where('project_id', $project->id)
                    ->where('committee_id', $committee->id)
                    ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
                    ->when($newStaffUserId, fn ($q) => $q->where('user_id', '!=', $newStaffUserId))
                    ->update(['committee_id' => null]);

                // Assign new staff head if provided
                if ($newStaffUserId) {
                    ProjectRoleAssignment::where('project_id', $project->id)
                        ->where('user_id', $newStaffUserId)
                        ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
                        ->update(['committee_id' => $committee->id]);
                }
            }
        });

        if (str_contains(url()->previous(), "/projects/{$project->id}") && ! str_contains(url()->previous(), "/committees/{$committee->id}")) {
            return redirect()->route('projects.show', $project)->with('status', 'Committee updated successfully.');
        }

        return redirect()->route('projects.committees.show', [
            'project' => $project->id,
            'committee' => $committee->id,
        ])->with('status', 'Committee updated successfully.');
    }

    /**
     * Assign or change the Project Staff head for this committee.
     */
    public function assignStaff(UpdateCommitteeRequest $request, Project $project, Committee $committee): RedirectResponse
    {
        return $this->update($request, $project, $committee);
    }

    /**
     * Remove the specified committee.
     */
    public function destroy(Project $project, Committee $committee): RedirectResponse
    {
        if ((int) $committee->project_id !== (int) $project->id) {
            abort(404, 'Committee not found in this project.');
        }

        Gate::authorize('delete', $committee);

        $committee->delete();

        return redirect()->route('projects.show', $project)->with('status', 'Committee removed successfully.');
    }

    /**
     * Assign a Project Member to this committee.
     */
    public function assignMember(AssignCommitteeMemberRequest $request, Project $project, Committee $committee): RedirectResponse
    {
        if ((int) $committee->project_id !== (int) $project->id) {
            abort(404, 'Committee not found in this project.');
        }

        Gate::authorize('manageMembers', $committee);

        $userIds = $request->validatedUserIds();

        DB::transaction(function () use ($project, $committee, $userIds) {
            ProjectRoleAssignment::where('project_id', $project->id)
                ->whereIn('user_id', $userIds)
                ->where('role', ProjectRoleAssignment::ROLE_PROJECT_MEMBER)
                ->update(['committee_id' => $committee->id]);
        });

        $message = count($userIds) > 1
            ? 'Members assigned to committee successfully.'
            : 'Member assigned to committee successfully.';

        return redirect()->route('projects.committees.show', [
            'project' => $project->id,
            'committee' => $committee->id,
        ])->with('status', $message);
    }

    /**
     * Remove a Project Member from this committee.
     */
    public function removeMember(Project $project, Committee $committee, User $user): RedirectResponse
    {
        if ((int) $committee->project_id !== (int) $project->id) {
            abort(404, 'Committee not found in this project.');
        }

        Gate::authorize('manageMembers', $committee);

        $assignment = ProjectRoleAssignment::where('project_id', $project->id)
            ->where('committee_id', $committee->id)
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_MEMBER)
            ->firstOrFail();

        $assignment->update(['committee_id' => null]);

        return redirect()->route('projects.committees.show', [
            'project' => $project->id,
            'committee' => $committee->id,
        ])->with('status', 'Member removed from committee.');
    }
}
