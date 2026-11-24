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
use App\Services\ProjectProgressService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class CommitteeController extends Controller
{
    public function __construct(
        protected ProjectProgressService $progressService
    ) {}
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

            // Assign Chairperson (Project Staff) if provided
            if ($request->filled('user_id')) {
                $staffUserId = (int) $request->validated('user_id');
                $staffAssignment = ProjectRoleAssignment::where('project_id', $project->id)
                    ->where('user_id', $staffUserId)
                    ->first();

                if ($staffAssignment) {
                    $staffAssignment->update([
                        'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
                        'committee_id' => $committee->id,
                    ]);
                } else {
                    ProjectRoleAssignment::create([
                        'project_id' => $project->id,
                        'user_id' => $staffUserId,
                        'committee_id' => $committee->id,
                        'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
                    ]);
                }
            }

            // Assign Co-Chair if provided
            if ($request->filled('co_chair_id')) {
                $coChairUserId = (int) $request->validated('co_chair_id');
                $coChairAssignment = ProjectRoleAssignment::where('project_id', $project->id)
                    ->where('user_id', $coChairUserId)
                    ->first();

                if ($coChairAssignment) {
                    $coChairAssignment->update([
                        'committee_id' => $committee->id,
                    ]);
                } else {
                    ProjectRoleAssignment::create([
                        'project_id' => $project->id,
                        'user_id' => $coChairUserId,
                        'committee_id' => $committee->id,
                        'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
                    ]);
                }

                \App\Models\CoChairDesignation::create([
                    'project_id' => $project->id,
                    'committee_id' => $committee->id,
                    'user_id' => $coChairUserId,
                    'designated_by' => Auth::id(),
                ]);
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
            'coChairDesignations.user',
            'activities.tasks.assignee',
            'activities.creator',
        ]);

        $user = Auth::user();
        $canManage = $user ? Gate::forUser($user)->allows('manageMembers', $committee) : false;

        $alreadyInCommitteeUserIds = ProjectRoleAssignment::where('project_id', $project->id)
            ->where('committee_id', $committee->id)
            ->pluck('user_id');

        $eventCoChairUserIds = \App\Models\CoChairDesignation::eventLevel()
            ->where('project_id', $project->id)
            ->pluck('user_id')
            ->all();

        // Retrieve available participants in this project who are not yet in this committee
        $availableMembers = $canManage
            ? (function () use ($project, $committee, $alreadyInCommitteeUserIds, $eventCoChairUserIds) {
                $candidateAssignments = ProjectRoleAssignment::where('project_id', $project->id)
                    ->where('role', '!=', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
                    ->where('user_id', '!=', $project->created_by)
                    ->whereNotIn('user_id', $alreadyInCommitteeUserIds)
                    ->whereHas('user', function ($q) {
                        $q->whereNotNull('email_verified_at');
                    })
                    ->with(['user.resume'])
                    ->get()
                    ->unique('user_id');

                $candidateUserIds = $candidateAssignments->pluck('user_id')->unique()->values();

                // Batch-load all other-committee assignments for these users in ONE query
                $otherCommitteeAssignments = ProjectRoleAssignment::where('project_id', $project->id)
                    ->whereIn('user_id', $candidateUserIds)
                    ->whereNotNull('committee_id')
                    ->where('committee_id', '!=', $committee->id)
                    ->with('committee:id,name')
                    ->get()
                    ->groupBy('user_id');

                return $candidateAssignments->map(function ($assignment) use ($otherCommitteeAssignments, $eventCoChairUserIds) {
                    $otherCommittees = ($otherCommitteeAssignments->get($assignment->user_id) ?? collect())
                        ->pluck('committee.name')
                        ->filter()
                        ->values();

                    $context = null;
                    if ($otherCommittees->count() === 1) {
                        $context = "Already assigned to {$otherCommittees[0]}";
                    } elseif ($otherCommittees->count() > 1) {
                        $context = "Currently assigned to {$otherCommittees->count()} other committees";
                    }

                    $isEventCoChair = in_array($assignment->user_id, $eventCoChairUserIds, true);
                    if ($isEventCoChair) {
                        $context = $context ? "Event Co-Chair • {$context}" : "Event Co-Chair";
                    }

                    return [
                        'id'                     => $assignment->user->id,
                        'name'                   => $assignment->user->name,
                        'email'                  => $assignment->user->email,
                        'context'                => $context,
                        'is_event_co_chair'      => $isEventCoChair,
                        'other_committees_count' => $otherCommittees->count(),
                        'has_resume'             => (bool) $assignment->user->resume,
                        'resume'                 => $assignment->user->resume ? [
                            'original_name'      => $assignment->user->resume->original_name,
                            'skills'             => $assignment->user->resume->extracted_skills ?? [],
                            'certifications'     => $assignment->user->resume->certifications ?? [],
                            'eligibility_status' => $assignment->user->resume->eligibility_status,
                        ] : null,
                    ];
                })->values()->all();
            })()
            : [];

        // Available participants in this project for changing committee staff
        $availableStaff = $canManage
            ? (function () use ($project, $eventCoChairUserIds) {
                $assignments = ProjectRoleAssignment::where('project_id', $project->id)
                    ->where('role', '!=', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
                    ->where('user_id', '!=', $project->created_by)
                    ->whereHas('user', function ($q) {
                        $q->whereNotNull('email_verified_at');
                    })
                    ->with(['user', 'committee'])
                    ->get()
                    ->unique('user_id');

                return $assignments->map(function ($assignment) use ($eventCoChairUserIds) {
                    $isEventCoChair = in_array($assignment->user_id, $eventCoChairUserIds, true);
                    return [
                        'id' => $assignment->user->id,
                        'name' => $assignment->user->name,
                        'email' => $assignment->user->email,
                        'committee_id' => $assignment->committee_id ? (string) $assignment->committee_id : null,
                        'committee_name' => $assignment->committee?->name,
                        'is_event_co_chair' => $isEventCoChair,
                    ];
                })->values()->all();
            })()
            : [];

        $committeeProgress = $this->progressService->calculateCommitteeProgress($committee);

        $allCommitteeTasks = $committee->activities->flatMap(fn ($act) => $act->tasks);

        $headData = null;
        if ($committee->staffAssignment?->user) {
            $headUser = $committee->staffAssignment->user;
            $headTasks = $allCommitteeTasks->where('assigned_to', $headUser->id);
            $headTasksCount = $headTasks->count();
            $headCompletedCount = $headTasks->where('status', Task::STATUS_COMPLETED)->count();
            $headProgress = $headTasksCount > 0 ? (int) round(($headCompletedCount / $headTasksCount) * 100) : 0;

            $headData = [
                'id' => $headUser->id,
                'name' => $headUser->name,
                'email' => $headUser->email,
                'tasks_count' => $headTasksCount,
                'completed_tasks_count' => $headCompletedCount,
                'progress' => $headProgress,
            ];
        }

        $committeeCoChairs = $committee->coChairDesignations->map(fn ($d) => [
            'id' => $d->user->id,
            'name' => $d->user->name,
            'email' => $d->user->email,
            'designated_at' => $d->created_at?->format('M d, Y'),
        ]);
        $committeeCoChairUserIds = $committee->coChairDesignations->pluck('user_id')->all();

        $membersData = $committee->memberAssignments->map(function ($assignment) use ($allCommitteeTasks, $committeeCoChairUserIds) {
            $memberTasks = $allCommitteeTasks->where('assigned_to', $assignment->user->id);
            $tasksCount = $memberTasks->count();
            $completedCount = $memberTasks->where('status', Task::STATUS_COMPLETED)->count();
            $progress = $tasksCount > 0 ? (int) round(($completedCount / $tasksCount) * 100) : 0;

            return [
                'id' => $assignment->user->id,
                'name' => $assignment->user->name,
                'email' => $assignment->user->email,
                'assigned_at' => $assignment->updated_at?->format('F d, Y'),
                'tasks_count' => $tasksCount,
                'completed_tasks_count' => $completedCount,
                'progress' => $progress,
                'is_co_chair' => in_array($assignment->user->id, $committeeCoChairUserIds, true),
            ];
        })->values()->all();

        $canDesignateCoChair = $user ? Gate::forUser($user)->allows('designateCoChair', $committee) : false;

        $committeeData = [
            'id' => (string) $committee->id,
            'name' => $committee->name,
            'description' => $committee->description,
            'progress' => $committeeProgress['progress'],
            'project' => [
                'id' => (string) $project->id,
                'title' => $project->title,
                'status' => $project->status,
            ],
            'head' => $headData,
            'members' => $membersData,
            'coChairs' => $committeeCoChairs->values()->all(),
            'is_committee_co_chair' => $user ? in_array($user->id, $committeeCoChairUserIds, true) : false,
            'eligibleCoChairs' => $canDesignateCoChair
                ? $committee->memberAssignments
                    ->filter(fn ($a) => ! in_array($a->user->id, $committeeCoChairUserIds, true))
                    ->map(fn ($a) => [
                        'id' => $a->user->id,
                        'name' => $a->user->name,
                        'email' => $a->user->email,
                    ])->values()->all()
                : [],
            'can' => [
                'update' => $user ? Gate::forUser($user)->allows('update', $committee) : false,
                'delete' => $user ? Gate::forUser($user)->allows('delete', $committee) : false,
                'manageMembers' => $canManage,
                'designateCoChair' => $canDesignateCoChair,
                'createActivity' => $user ? Gate::forUser($user)->allows('create', [Activity::class, $committee]) : false,
            ],
            'activities' => $committee->activities->map(function ($act) {
                $assigneeNames = $act->tasks
                    ->map(fn ($t) => $t->assignee?->name)
                    ->filter()
                    ->unique()
                    ->values()
                    ->all();

                return [
                    'id' => (string) $act->id,
                    'title' => $act->title,
                    'description' => $act->description,
                    'status' => $act->status,
                    'progress' => $this->progressService->calculateActivityProgress($act)['progress'],
                    'start_date' => $act->start_date?->format('M d, Y'),
                    'start_date_raw' => $act->start_date?->format('Y-m-d'),
                    'due_date' => $act->due_date?->format('M d, Y'),
                    'due_date_raw' => $act->due_date?->format('Y-m-d'),
                    'tasks_count' => $act->tasks->count(),
                    'completed_tasks_count' => $act->tasks->where('status', Task::STATUS_COMPLETED)->count(),
                    'creator' => $act->creator ? [
                        'id' => $act->creator->id,
                        'name' => $act->creator->name,
                    ] : null,
                    'assignee_names' => $assigneeNames,
                ];
            })->values()->all(),
        ];

        $userRole = ($user && $project)
            ? $project->roleAssignments()->where('user_id', $user->id)->value('role')
            : null;

        return Inertia::render('Committees/Show', [
            'project' => [
                'id' => (string) $project->id,
                'title' => $project->title,
                'status' => $project->status,
                'role' => $userRole,
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

                // Clear previous staff's committee assignment if different or if unassigning
                ProjectRoleAssignment::where('project_id', $project->id)
                    ->where('committee_id', $committee->id)
                    ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
                    ->when($newStaffUserId, fn ($q) => $q->where('user_id', '!=', $newStaffUserId))
                    ->update(['committee_id' => null]);

                // Assign new staff if provided
                if ($newStaffUserId) {
                    $staffAssignment = ProjectRoleAssignment::where('project_id', $project->id)
                        ->where('user_id', $newStaffUserId)
                        ->first();

                    if ($staffAssignment) {
                        $staffAssignment->update([
                            'committee_id' => $committee->id,
                            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
                        ]);
                    } else {
                        ProjectRoleAssignment::create([
                            'project_id' => $project->id,
                            'user_id' => $newStaffUserId,
                            'committee_id' => $committee->id,
                            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
                        ]);
                    }
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
            foreach ($userIds as $userId) {
                $assignment = ProjectRoleAssignment::where('project_id', $project->id)
                    ->where('user_id', $userId)
                    ->first();

                if ($assignment) {
                    $assignment->update([
                        'committee_id' => $committee->id,
                        'role' => $assignment->role === ProjectRoleAssignment::ROLE_PROJECT_STAFF
                            ? ProjectRoleAssignment::ROLE_PROJECT_STAFF
                            : ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
                    ]);
                } else {
                    ProjectRoleAssignment::create([
                        'project_id' => $project->id,
                        'user_id' => $userId,
                        'committee_id' => $committee->id,
                        'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
                    ]);
                }
            }
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

        $otherAssignments = ProjectRoleAssignment::where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->where('id', '!=', $assignment->id)
            ->exists();

        if ($otherAssignments) {
            $assignment->delete();
        } else {
            $assignment->update(['committee_id' => null]);
        }

        return redirect()->route('projects.committees.show', [
            'project' => $project->id,
            'committee' => $committee->id,
        ])->with('status', 'Member removed from committee.');
    }

    /**
     * AI-Powered Candidate Ranking and Recommendation using Ollama.
     */
    public function recommendMembers(
        Project $project,
        Committee $committee,
        \App\Services\AI\OllamaResumeScreeningService $screeningService
    ): \Illuminate\Http\JsonResponse {
        if ((int) $committee->project_id !== (int) $project->id) {
            abort(404, 'Committee not found in this project.');
        }

        Gate::authorize('manageMembers', $committee);

        $alreadyInCommitteeUserIds = ProjectRoleAssignment::where('project_id', $project->id)
            ->where('committee_id', $committee->id)
            ->pluck('user_id');

        $candidateAssignments = ProjectRoleAssignment::where('project_id', $project->id)
            ->where('role', '!=', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            ->where('user_id', '!=', $project->created_by)
            ->whereNotIn('user_id', $alreadyInCommitteeUserIds)
            ->whereHas('user', function ($q) {
                $q->whereNotNull('email_verified_at');
            })
            ->with(['user.resume'])
            ->get()
            ->unique('user_id');

        $candidates = $candidateAssignments->map(fn ($assignment) => $assignment->user);
        $recommendations = $screeningService->rankCandidatesForCommittee($committee, $candidates);

        return response()->json([
            'success' => true,
            'ollama_active' => $screeningService->isAvailable(),
            'recommendations' => $recommendations,
        ]);
    }
}
