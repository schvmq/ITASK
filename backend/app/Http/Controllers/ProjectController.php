<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreProjectRequest;
use App\Http\Requests\UpdateProjectRequest;
use App\Events\MessageSent;
use App\Models\Chat;
use App\Models\Message;
use App\Models\Project;
use App\Models\ProjectApprovalDocument;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use App\Services\ProjectProgressService;
use App\Services\ProjectTimelineService;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class ProjectController extends Controller
{
    public function __construct(
        protected ProjectProgressService $progressService,
        protected ProjectTimelineService $timelineService,
        protected \App\Services\Authorization\AuthorizationService $authService
    ) {}

    /**
     * Display a listing of projects.
     */
    public function index(Request $request): Response
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
                    ?? ($project->created_by === $userId ? ProjectRoleAssignment::ROLE_PROJECT_LEADER : 'Project Member');

                $projectProgress = $this->progressService->calculateProjectProgress($project);

                return [
                    'id' => (string) $project->id,
                    'title' => $project->title,
                    'description' => $project->description ?? '',
                    'status' => $project->status,
                    'role' => $role,
                    'progress' => $projectProgress['progress'],
                    'deadline' => $project->end_date ? $project->end_date->format('F d, Y') : 'No deadline',
                    'startDate' => $project->start_date ? $project->start_date->format('F d, Y') : null,
                    'committeesCount' => $project->committees()->count(),
                    'tasksCount' => $projectProgress['total_tasks'],
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

        return Inertia::render('Projects/Index', [
            'projects' => $projects,
            'availableUsers' => $availableUsers,
        ]);
    }

    /**
     * Store a newly created project in storage with its required approval document.
     */
    public function store(StoreProjectRequest $request): RedirectResponse
    {
        if ($request->user()->isAdmin()) {
            abort(403, 'Administrators cannot create projects. Administrator accounts are restricted to system administration.');
        }

        $file = $request->file('approval_document');
        $storedFilePath = null;

        try {
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
                    'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
                    'committee_id' => null,
                ]);

                // Create exactly one group chat in the same database transaction
                $chat = Chat::create([
                    'project_id' => $project->id,
                ]);

                // Post initial system message
                $chat->messages()->create([
                    'sender_id' => null,
                    'type' => Message::TYPE_SYSTEM,
                    'body' => 'Group chat created. Everyone in this event can message here.',
                ]);

                // Assign initial project members if provided
                $memberIds = $request->validated('member_ids') ?? [];
                $memberRoles = $request->validated('member_roles') ?? [];

                $uniqueMemberIds = array_values(array_unique(array_filter(
                    $memberIds,
                    fn ($id) => (int) $id !== (int) $request->user()->id
                )));

                if (! empty($uniqueMemberIds)) {
                    $selectedUsers = User::whereIn('id', $uniqueMemberIds)->get(['id', 'name', 'email']);

                    foreach ($selectedUsers as $memberUser) {
                        $role = $memberRoles[$memberUser->id] ?? ProjectRoleAssignment::ROLE_PROJECT_MEMBER;
                        if (! in_array($role, [ProjectRoleAssignment::ROLE_PROJECT_MEMBER, ProjectRoleAssignment::ROLE_PROJECT_STAFF])) {
                            $role = ProjectRoleAssignment::ROLE_PROJECT_MEMBER;
                        }

                        ProjectRoleAssignment::create([
                            'project_id' => $project->id,
                            'user_id' => $memberUser->id,
                            'role' => $role,
                            'committee_id' => null,
                        ]);

                        // Post join system message to chat
                        $chat->messages()->create([
                            'sender_id' => null,
                            'type' => Message::TYPE_SYSTEM,
                            'body' => "{$memberUser->name} joined the event",
                        ]);
                    }
                }

                // Store approval document on the PRIVATE 'local' disk under project_approvals/{project_id}
                $directory = "project_approvals/{$project->id}";
                $storedFilePath = $file->store($directory, 'local');

                ProjectApprovalDocument::create([
                    'project_id' => $project->id,
                    'uploaded_by' => $request->user()->id,
                    'original_name' => $file->getClientOriginalName(),
                    'file_path' => $storedFilePath,
                    'file_size' => $file->getSize(),
                    'mime_type' => $file->getClientMimeType() ?: ($file->getMimeType() ?: 'application/octet-stream'),
                ]);

                return $project;
            });
        } catch (Throwable $e) {
            // Clean up stored file if database transaction fails after file storage
            if ($storedFilePath && Storage::disk('local')->exists($storedFilePath)) {
                Storage::disk('local')->delete($storedFilePath);
            }

            throw $e;
        }

        return redirect()->route('projects.show', $project)->with('status', 'Project created successfully.');
    }

    /**
     * Display the specified project.
     */
    public function show(string $project, ?string $initialTab = null): Response
    {
        $projectModel = is_numeric($project)
            ? Project::with([
                'creator',
                'leaderAssignment.user',
                'approvalDocuments.uploader',
                'committees.roleAssignments.user',
                'committees.coChairDesignations.user',
                'committees.staffAssignment.user',
                'committees.memberAssignments.user',
                'roleAssignments.user',
                'eventCoChairDesignations.user',
                'activities.creator',
                'activities.tasks.assignee',
                'activities.tasks.checklistItems',
                'activities.tasks.evidences.uploader',
            ])->findOrFail($project)
            : null;

        // Enforce project-scoped view authorization for database projects
        if ($projectModel) {
            Gate::authorize('view', $projectModel);

            // Tie parent-child relationships in memory to prevent N+1 backwards queries
            $committeesById = $projectModel->committees->keyBy('id');
            foreach ($projectModel->committees as $comm) {
                $comm->setRelation('project', $projectModel);
                $commActs = $projectModel->activities->where('committee_id', $comm->id)->values();
                $comm->setRelation('activities', $commActs);
            }

            foreach ($projectModel->activities as $act) {
                $comm = $committeesById->get($act->committee_id);
                if ($comm) {
                    $act->setRelation('committee', $comm);
                }
                $act->setRelation('project', $projectModel);

                foreach ($act->tasks as $task) {
                    $task->setRelation('activity', $act);
                }
            }
        }

        $user = Auth::user();
        $userAssignment = ($user && $projectModel)
            ? $projectModel->roleAssignments
                ->where('user_id', $user->id)
                ->first()
            : null;

        $userRole = $userAssignment?->role
            ?? ($projectModel && (int) $projectModel->created_by === (int) $user?->id ? ProjectRoleAssignment::ROLE_PROJECT_LEADER : null);

        $userCommittee = ($userAssignment && $userAssignment->committee_id)
            ? [
                'id' => (string) $userAssignment->committee_id,
                'name' => $projectModel->committees->firstWhere('id', $userAssignment->committee_id)?->name ?? '',
            ]
            : null;

        $eventCoChairUserIds = $projectModel ? $projectModel->eventCoChairDesignations->pluck('user_id')->all() : [];
        $isEventCoChair = ($user && in_array($user->id, $eventCoChairUserIds, true));
        $isLeader = ($user && $projectModel && $this->authService->isProjectLeader($user, $projectModel));

        // Committee IDs where user is Chairperson or Committee Co-Chair
        $managedCommitteeIds = ($user && $projectModel)
            ? $projectModel->committees->filter(function ($c) use ($user) {
                return $this->authService->isStaffInCommittee($user, $c) || $this->authService->isCommitteeCoChair($user, $c);
            })->pluck('id')->all()
            : [];

        // Committee IDs where user is Member
        $memberCommitteeIds = ($user && $projectModel)
            ? $projectModel->committees->filter(function ($c) use ($user) {
                return $this->authService->isMemberInCommittee($user, $c);
            })->pluck('id')->all()
            : [];

        $projectProgress = $projectModel ? $this->progressService->calculateProjectProgress($projectModel) : null;

        $currentTab = $initialTab ?? request('tab');
        if ($currentTab === 'tasks') {
            $currentTab = 'deliverables';
        }

        // Defer expensive Gantt timeline data when user is not viewing the Timeline tab
        $timelineData = ($projectModel && $user)
            ? (($currentTab === 'timeline')
                ? $this->timelineService->getTimelineData($projectModel, $user)
                : Inertia::defer(fn () => $this->timelineService->getTimelineData($projectModel, $user)))
            : null;

        $eventCoChairs = $projectModel ? $projectModel->eventCoChairDesignations->map(fn ($d) => [
            'id' => $d->user->id,
            'name' => $d->user->name,
            'email' => $d->user->email,
            'designated_at' => $d->created_at?->format('M d, Y'),
        ])->values()->all() : [];

        $projectData = $projectModel ? [
            'id' => (string) $projectModel->id,
            'title' => $projectModel->title,
            'description' => $projectModel->description,
            'status' => $projectModel->status,
            'progress' => $projectProgress ? $projectProgress['progress'] : 0,
            'timeline' => null, // Served via top-level deferred 'timeline' prop
            'start_date' => $projectModel->start_date?->format('F d, Y'),
            'end_date' => $projectModel->end_date?->format('F d, Y'),
            'start_date_raw' => $projectModel->start_date?->format('Y-m-d'),
            'end_date_raw' => $projectModel->end_date?->format('Y-m-d'),
            'created_at' => $projectModel->created_at?->toISOString(),
            'role' => $userRole,
            'userCommittee' => $userCommittee,
            'eventCoChairs' => $eventCoChairs,
            'is_event_co_chair' => $isEventCoChair,
            'can' => [
                'update'          => $user ? $this->authService->canUpdateProject($user, $projectModel) : false,
                'archive'         => $user ? $this->authService->canArchiveProject($user, $projectModel) : false,
                'uploadDocument'  => $user ? ($this->authService->isProjectLeader($user, $projectModel) || $this->authService->isEventCoChair($user, $projectModel)) : false,
                'createCommittee' => $user ? $this->authService->canCreateCommittee($user, $projectModel) : false,
                'createTask'      => $user ? $this->authService->canCreateProjectTask($user, $projectModel) : false,
                'createActivity'  => $user ? ($this->authService->isProjectLeader($user, $projectModel) || $projectModel->committees->contains(fn ($c) => $this->authService->canCreateActivity($user, $c))) : false,
                'designateCoChair'=> $user ? $this->authService->canDesignateEventCoChair($user, $projectModel) : false,
            ],
            'committeesForDeliverable' => ($user && $projectModel)
                ? $projectModel->committees
                    ->filter(fn ($c) => $this->authService->canCreateActivity($user, $c))
                    ->values()
                    ->map(fn ($c) => [
                        'id' => (string) $c->id,
                        'name' => $c->name,
                    ])->all()
                : [],
            'creator' => $projectModel->creator ? [
                'id' => $projectModel->creator->id,
                'name' => $projectModel->creator->name,
                'email' => $projectModel->creator->email,
            ] : null,
            'leader' => $projectModel->leaderAssignment?->user ? [
                'id' => $projectModel->leaderAssignment->user->id,
                'name' => $projectModel->leaderAssignment->user->name,
                'email' => $projectModel->leaderAssignment->user->email,
            ] : null,
            'committees' => $projectModel->committees->sortBy('id')->values()->map(function ($committee) use ($user) {
                $canView = $user ? $this->authService->canViewCommittee($user, $committee) : false;
                $canManage = $user ? $this->authService->canManageCommittee($user, $committee) : false;

                return [
                    'id' => (string) $committee->id,
                    'name' => $committee->name,
                    'description' => $committee->description,
                    'progress' => $this->progressService->calculateCommitteeProgress($committee)['progress'],
                    'membersCount' => $committee->memberAssignments->count(),
                    'activitiesCount' => $committee->activities->count(),
                    'activities' => $committee->activities->map(fn ($act) => [
                        'id' => (string) $act->id,
                        'title' => $act->title,
                    ])->values()->all(),
                    'leadName' => $canView
                        ? ($committee->staffAssignment?->user?->name
                            ? $committee->staffAssignment->user->name . ' (Project Staff)'
                            : 'Unassigned Staff')
                        : null,
                    'head' => ($canView && $committee->staffAssignment?->user) ? [
                        'id' => $committee->staffAssignment->user->id,
                        'name' => $committee->staffAssignment->user->name,
                        'email' => $committee->staffAssignment->user->email,
                    ] : null,
                    'members' => $canView ? $committee->memberAssignments->map(fn ($assignment) => [
                        'id' => $assignment->user->id,
                        'name' => $assignment->user->name,
                        'email' => $assignment->user->email,
                    ])->values()->all() : [],
                    'can' => [
                        'view' => $canView,
                        'update' => $canManage,
                        'delete' => $canManage,
                        'createActivity' => $user ? $this->authService->canCreateActivity($user, $committee) : false,
                    ],
                ];
            })->values()->all(),
            'activities' => $projectModel->activities
                ->filter(fn ($act) => ! $user || $this->authService->canViewActivity($user, $act))
                ->map(function ($act) use ($projectModel) {
                    $activityProgress = $this->progressService->calculateActivityProgress($act);
                    $comm = $projectModel->committees->firstWhere('id', $act->committee_id) ?? $act->committee;
                    $staffUser = $comm?->staffAssignment?->user;

                    return [
                        'id' => (string) $act->id,
                        'title' => $act->title,
                        'description' => $act->description,
                        'status' => $act->status,
                        'progress' => $activityProgress['progress'],
                        'start_date' => $act->start_date?->format('M d, Y'),
                        'start_date_raw' => $act->start_date?->format('Y-m-d'),
                        'due_date' => $act->due_date?->format('M d, Y'),
                        'due_date_raw' => $act->due_date?->format('Y-m-d'),
                        'committee' => [
                            'id' => (string) $act->committee_id,
                            'name' => $comm?->name ?? $act->committee?->name ?? 'Unknown Committee',
                            'chairperson' => $staffUser ? [
                                'id' => $staffUser->id,
                                'name' => $staffUser->name,
                                'email' => $staffUser->email,
                            ] : null,
                        ],
                        'url' => route('projects.committees.activities.show', [
                            'project' => $projectModel->id,
                            'committee' => $act->committee_id,
                            'activity' => $act->id,
                        ]),
                        'tasksCount' => $act->tasks->count(),
                        'completedTasksCount' => $act->tasks->where('status', Task::STATUS_COMPLETED)->count(),
                        'creator' => $act->creator ? [
                            'id' => $act->creator->id,
                            'name' => $act->creator->name,
                        ] : null,
                    ];
                })->values()->all(),
            'tasks' => $projectModel->activities->flatMap(function ($act) use ($user, $projectModel) {
                return $act->tasks->map(function ($task) use ($act, $user, $projectModel) {
                    $isAssignedToMe = $user && (int) $task->assigned_to === (int) $user->id;

                    return [
                        'id' => (string) $task->id,
                        'title' => $task->title,
                        'description' => $task->description,
                        'status' => $task->status,
                        'priority' => $task->priority ?? 'Medium',
                        'requires_review' => (bool) $task->requires_review,
                        'due_date' => $task->due_date?->format('M d, Y'),
                        'due_date_raw' => $task->due_date?->format('Y-m-d'),
                        'is_assigned_to_me' => $isAssignedToMe,
                        'activity' => [
                            'id' => (string) $act->id,
                            'title' => $act->title,
                        ],
                        'committee' => [
                            'id' => (string) $act->committee_id,
                            'name' => $act->committee?->name ?? 'Unknown Committee',
                        ],
                        'assignee' => $task->assignee ? [
                            'id' => $task->assignee->id,
                            'name' => $task->assignee->name,
                            'email' => $task->assignee->email,
                        ] : null,
                        'checklist_items' => $task->checklistItems->map(fn ($item) => [
                            'id' => (string) $item->id,
                            'content' => $item->content,
                            'is_completed' => (bool) $item->is_completed,
                            'order' => $item->order,
                        ])->values()->all(),
                        'checklist_total' => $task->checklistItems->count(),
                        'checklist_completed' => $task->checklistItems->where('is_completed', true)->count(),
                        'evidences' => $task->evidences->map(function ($ev) use ($user, $task) {
                            return [
                                'id' => (string) $ev->id,
                                'original_name' => $ev->original_name,
                                'file_size' => $ev->file_size,
                                'file_size_formatted' => $this->formatFileSize($ev->file_size),
                                'mime_type' => $ev->mime_type,
                                'remarks' => $ev->remarks,
                                'uploaded_at' => $ev->created_at?->format('M d, Y, g:i A'),
                                'uploader' => $ev->uploader ? [
                                    'id' => $ev->uploader->id,
                                    'name' => $ev->uploader->name,
                                ] : null,
                                'download_url' => route('projects.committees.activities.tasks.evidence.download', [
                                    'project' => $task->activity->project_id,
                                    'committee' => $task->activity->committee_id,
                                    'activity' => $task->activity->id,
                                    'task' => $task->id,
                                    'evidence' => $ev->id,
                                ]),
                                'can' => [
                                    'delete' => $user ? $this->authService->canDeleteEvidence($user, $task, $ev) : false,
                                ],
                            ];
                        })->values()->all(),
                        'can' => [
                            'update'          => $user ? $this->authService->canUpdateTask($user, $task) : false,
                            'delete'          => $user ? $this->authService->canDeleteTask($user, $task) : false,
                            'updateStatus'    => $user ? $this->authService->canUpdateTaskStatus($user, $task) : false,
                            'manageChecklist' => $user ? $this->authService->canManageChecklist($user, $task) : false,
                            'uploadEvidence'  => $user ? $this->authService->canUploadEvidence($user, $task) : false,
                            'submitReview'    => $user ? $this->authService->canSubmitTaskReview($user, $task) : false,
                            'review'          => $user ? $this->authService->canReviewTask($user, $task) : false,
                            'resubmit'        => $user ? $this->authService->canResubmitTask($user, $task) : false,
                        ],
                    ];
                });
            })->values()->all(),
            'projectStaff' => $projectModel->roleAssignments
                ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
                ->map(fn ($assignment) => [
                    'id' => $assignment->user->id,
                    'name' => $assignment->user->name,
                    'email' => $assignment->user->email,
                    'committee_id' => $assignment->committee_id ? (string) $assignment->committee_id : null,
                    'is_co_chair' => in_array($assignment->user->id, $eventCoChairUserIds, true),
                ])->values()->all(),
            'projectMembers' => $projectModel->roleAssignments
                ->where('role', ProjectRoleAssignment::ROLE_PROJECT_MEMBER)
                ->map(fn ($assignment) => [
                    'id' => $assignment->user->id,
                    'name' => $assignment->user->name,
                    'email' => $assignment->user->email,
                    'committee_id' => $assignment->committee_id ? (string) $assignment->committee_id : null,
                    'is_co_chair' => in_array($assignment->user->id, $eventCoChairUserIds, true),
                ])->values()->all(),
            'eligibleCoChairs' => ($user && $isLeader)
                ? $projectModel->roleAssignments
                    ->where('role', '!=', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
                    ->filter(fn ($a) => (int) $a->user_id !== (int) $projectModel->created_by && ! in_array($a->user_id, $eventCoChairUserIds, true))
                    ->unique('user_id')
                    ->map(fn ($a) => [
                        'id' => $a->user->id,
                        'name' => $a->user->name,
                        'email' => $a->user->email,
                        'role' => $a->role,
                    ])->values()->all()
                : [],
            'availablePersonnel' => ($user && $isLeader)
                ? User::whereNotNull('email_verified_at')
                    ->whereNotIn('id', $projectModel->roleAssignments->pluck('user_id'))
                    ->select(['id', 'name', 'email'])
                    ->limit(50)
                    ->get()
                    ->map(fn ($u) => [
                        'id' => $u->id,
                        'name' => $u->name,
                        'email' => $u->email,
                    ])->values()->all()
                : [],
            'documents' => $projectModel->approvalDocuments->map(function (ProjectApprovalDocument $doc) use ($projectModel) {
                return [
                    'id' => (string) $doc->id,
                    'original_name' => $doc->original_name,
                    'file_size' => $doc->file_size,
                    'mime_type' => $doc->mime_type,
                    'uploaded_at' => $doc->created_at?->format('F d, Y'),
                    'uploader_name' => $doc->uploader?->name ?? 'Unknown',
                    'download_url' => route('projects.documents.download', [
                        'project' => $projectModel->id,
                        'document' => $doc->id,
                    ]),
                ];
            })->values()->all(),
        ] : null;

        return Inertia::render('Projects/Show', [
            'projectId' => $project,
            'project' => $projectData,
            'timeline' => $timelineData,
            'initialTab' => $currentTab,
        ]);
    }

    /**
     * Update the specified project in storage.
     */
    public function update(UpdateProjectRequest $request, Project $project): RedirectResponse
    {
        Gate::authorize('update', $project);

        $oldTitle = $project->title;

        $project->update($request->safe()->only([
            'title',
            'description',
            'start_date',
            'end_date',
            'status',
        ]));

        if ($oldTitle !== $project->title && $project->chat) {
            $msg = $project->chat->messages()->create([
                'sender_id' => null,
                'type' => Message::TYPE_SYSTEM,
                'body' => "Project renamed to \"{$project->title}\".",
            ]);
            try {
                broadcast(new MessageSent($msg))->toOthers();
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return redirect()->route('projects.show', $project)->with('status', 'Project updated successfully.');
    }

    /**
     * Archive the specified project.
     */
    public function archive(Project $project): RedirectResponse
    {
        Gate::authorize('archive', $project);

        $project->update([
            'status' => Project::STATUS_ARCHIVED,
        ]);

        if ($project->chat) {
            $project->chat->update(['archived_at' => now()]);
            $msg = $project->chat->messages()->create([
                'sender_id' => null,
                'type' => Message::TYPE_SYSTEM,
                'body' => 'This project is archived. Messages are read-only.',
            ]);
            try {
                broadcast(new MessageSent($msg))->toOthers();
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return redirect()->route('projects.show', $project)->with('status', 'Project archived successfully.');
    }

    /**
     * Unarchive the specified project.
     */
    public function unarchive(Project $project): RedirectResponse
    {
        Gate::authorize('archive', $project);

        $project->update([
            'status' => Project::STATUS_ACTIVE,
        ]);

        if ($project->chat) {
            $project->chat->update(['archived_at' => null]);
            $msg = $project->chat->messages()->create([
                'sender_id' => null,
                'type' => Message::TYPE_SYSTEM,
                'body' => 'Project restored from archive.',
            ]);
            try {
                broadcast(new MessageSent($msg))->toOthers();
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return redirect()->route('projects.show', $project)->with('status', 'Project unarchived successfully.');
    }

    /**
     * Soft delete project with 30-day retention period.
     * Owner only. Requires typing project name to confirm.
     */
    public function destroy(Request $request, Project $project): RedirectResponse
    {
        $user = $request->user();

        if ((int) $project->created_by !== (int) $user->id) {
            abort(403, 'Only the project owner can delete this project.');
        }

        $request->validate([
            'confirmation_name' => ['required', 'string'],
        ]);

        if (trim($request->input('confirmation_name')) !== trim($project->title)) {
            return back()->withErrors(['confirmation_name' => 'Please type the exact project title to confirm deletion.']);
        }

        DB::transaction(function () use ($project, $user) {
            if ($project->chat) {
                $project->chat->delete();
            }

            $project->delete();
        });

        return redirect()->route('projects.index')->with(
            'status',
            "Project \"{$project->title}\" deleted. It will be retained for 30 days and can be restored during that time."
        );
    }

    /**
     * Restore a soft-deleted project within retention period.
     */
    public function restore(Request $request, int $projectId): RedirectResponse
    {
        $user = $request->user();

        $project = Project::withTrashed()->find($projectId);

        if (! $project) {
            return back()->withErrors(['error' => 'This project was permanently deleted.']);
        }

        if (! $project->trashed()) {
            return redirect()->route('projects.show', $project);
        }

        if ((int) $project->created_by !== (int) $user->id) {
            abort(403, 'Only the project owner can restore this project.');
        }

        // Handle possible name collision on restore
        $collision = Project::where('created_by', $user->id)
            ->where('title', $project->title)
            ->exists();

        if ($collision) {
            $project->title = $project->title . ' (restored)';
        }

        DB::transaction(function () use ($project) {
            $project->restore();

            $chat = Chat::withTrashed()->where('project_id', $project->id)->first();
            if ($chat) {
                $chat->restore();
                $msg = $chat->messages()->create([
                    'sender_id' => null,
                    'type' => Message::TYPE_SYSTEM,
                    'body' => 'Project restored',
                ]);
                try {
                    broadcast(new MessageSent($msg))->toOthers();
                } catch (\Throwable $e) {
                    report($e);
                }
            }
        });

        return redirect()->route('projects.show', $project)->with('status', 'Project restored successfully.');
    }

    /**
     * Upload an additional approval/supporting document to an existing project.
     * Only the Project Leader is authorized to do this.
     */
    public function uploadDocument(Request $request, Project $project): RedirectResponse
    {
        Gate::authorize('uploadDocument', $project);

        $request->validate([
            'approval_document' => [
                'required',
                'file',
                'mimes:pdf,doc,docx,jpg,jpeg,png',
                'max:10240', // 10 MB maximum
            ],
        ], [
            'approval_document.required' => 'Please select an approval document to upload.',
            'approval_document.file'     => 'The uploaded item must be a valid file.',
            'approval_document.mimes'    => 'The document must be a file of type: PDF, DOC, DOCX, JPG, JPEG, or PNG.',
            'approval_document.max'      => 'The document must not exceed 10 MB in size.',
        ]);

        $file = $request->file('approval_document');
        $storedFilePath = null;

        try {
            DB::transaction(function () use ($project, $request, $file, &$storedFilePath) {
                $directory = "project_approvals/{$project->id}";
                $storedFilePath = $file->store($directory, 'local');

                ProjectApprovalDocument::create([
                    'project_id'    => $project->id,
                    'uploaded_by'   => $request->user()->id,
                    'original_name' => $file->getClientOriginalName(),
                    'file_path'     => $storedFilePath,
                    'file_size'     => $file->getSize(),
                    'mime_type'     => $file->getClientMimeType() ?: ($file->getMimeType() ?: 'application/octet-stream'),
                ]);
            });
        } catch (Throwable $e) {
            if ($storedFilePath && Storage::disk('local')->exists($storedFilePath)) {
                Storage::disk('local')->delete($storedFilePath);
            }

            throw $e;
        }

        return redirect()->route('projects.show', $project)
            ->with('status', 'Document uploaded successfully.');
    }

    /**
     * Download or view the specified project approval document securely.
     */
    public function downloadApprovalDocument(Request $request, Project $project, ProjectApprovalDocument $document): \Symfony\Component\HttpFoundation\Response
    {
        // 1. Authorize user against the project (Leader, Staff, Member allowed; unassigned rejected with 403)
        Gate::authorize('downloadDocument', $project);

        // 2. Prevent cross-project document access: verify document belongs to requested project
        if ((int) $document->project_id !== (int) $project->id) {
            abort(404, 'Document not found for this project.');
        }

        // 3. Verify file exists on private local storage
        if (! Storage::disk('local')->exists($document->file_path)) {
            abort(404, 'File not found on storage.');
        }

        // 4. Return inline stream or download response
        if ($request->boolean('inline') || $request->query('disposition') === 'inline') {
            return Storage::disk('local')->response($document->file_path, $document->original_name, [
                'Content-Disposition' => 'inline; filename="' . addslashes($document->original_name) . '"',
            ]);
        }

        return Storage::disk('local')->download($document->file_path, $document->original_name);
    }

    /**
     * Format byte count into human-readable size string.
     */
    protected function formatFileSize(?int $bytes): string
    {
        if ($bytes === null || $bytes <= 0) {
            return '0 B';
        }
        if ($bytes >= 1048576) {
            return number_format($bytes / 1048576, 2) . ' MB';
        }
        if ($bytes >= 1024) {
            return number_format($bytes / 1024, 2) . ' KB';
        }
        return $bytes . ' B';
    }
}
