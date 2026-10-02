<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreProjectRequest;
use App\Http\Requests\UpdateProjectRequest;
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
        protected ProjectTimelineService $timelineService
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

        return Inertia::render('Projects/Index', [
            'projects' => $projects,
        ]);
    }

    /**
     * Store a newly created project in storage with its required approval document.
     */
    public function store(StoreProjectRequest $request): RedirectResponse
    {
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
                'committees.staffAssignment.user',
                'committees.memberAssignments.user',
                'committees.activities.tasks.assignee',
                'roleAssignments.user',
                'activities.committee',
                'activities.tasks.assignee',
                'activities.creator',
            ])->findOrFail($project)
            : null;

        // Enforce project-scoped view authorization for database projects
        if ($projectModel) {
            Gate::authorize('view', $projectModel);
        }

        $userAssignment = (Auth::check() && $projectModel)
            ? $projectModel->roleAssignments()
                ->where('user_id', Auth::id())
                ->with('committee')
                ->first()
            : null;

        $userRole = $userAssignment?->role
            ?? ($projectModel && $projectModel->created_by === Auth::id() ? ProjectRoleAssignment::ROLE_PROJECT_LEADER : null);

        $userCommittee = $userAssignment?->committee ? [
            'id' => (string) $userAssignment->committee->id,
            'name' => $userAssignment->committee->name,
        ] : null;

        $projectProgress = $projectModel ? $this->progressService->calculateProjectProgress($projectModel) : null;
        $timelineData = (Auth::check() && $projectModel)
            ? $this->timelineService->getTimelineData($projectModel, Auth::user())
            : null;

        $projectData = $projectModel ? [
            'id' => (string) $projectModel->id,
            'title' => $projectModel->title,
            'description' => $projectModel->description,
            'status' => $projectModel->status,
            'progress' => $projectProgress ? $projectProgress['progress'] : 0,
            'timeline' => $timelineData,
            'start_date' => $projectModel->start_date?->format('F d, Y'),
            'end_date' => $projectModel->end_date?->format('F d, Y'),
            'start_date_raw' => $projectModel->start_date?->format('Y-m-d'),
            'end_date_raw' => $projectModel->end_date?->format('Y-m-d'),
            'created_at' => $projectModel->created_at?->toISOString(),
            'role' => $userRole,
            'userCommittee' => $userCommittee,
            'can' => [
                'update'          => Auth::check() ? Auth::user()->can('update', $projectModel) : false,
                'archive'         => Auth::check() ? Auth::user()->can('archive', $projectModel) : false,
                'uploadDocument'  => Auth::check() ? Auth::user()->can('uploadDocument', $projectModel) : false,
                'createCommittee' => Auth::check() ? Auth::user()->can('create', [\App\Models\Committee::class, $projectModel]) : false,
            ],
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
            'committees' => $projectModel->committees->map(function ($committee) {
                $canView = Auth::check() ? Auth::user()->can('view', $committee) : false;

                return [
                    'id' => (string) $committee->id,
                    'name' => $committee->name,
                    'description' => $committee->description,
                    'progress' => $this->progressService->calculateCommitteeProgress($committee)['progress'],
                    'membersCount' => $committee->memberAssignments->count(),
                    'activitiesCount' => $committee->activities->count(),
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
                        'update' => Auth::check() ? Auth::user()->can('update', $committee) : false,
                        'delete' => Auth::check() ? Auth::user()->can('delete', $committee) : false,
                    ],
                ];
            })->values()->all(),
            'activities' => $projectModel->activities->map(function ($act) {
                return [
                    'id' => (string) $act->id,
                    'title' => $act->title,
                    'description' => $act->description,
                    'status' => $act->status,
                    'progress' => $this->progressService->calculateActivityProgress($act)['progress'],
                    'due_date' => $act->due_date?->format('M d, Y'),
                    'due_date_raw' => $act->due_date?->format('Y-m-d'),
                    'committee' => [
                        'id' => (string) $act->committee_id,
                        'name' => $act->committee?->name ?? 'Unknown Committee',
                    ],
                    'tasksCount' => $act->tasks->count(),
                    'completedTasksCount' => $act->tasks->where('status', Task::STATUS_COMPLETED)->count(),
                    'creator' => $act->creator ? [
                        'id' => $act->creator->id,
                        'name' => $act->creator->name,
                    ] : null,
                ];
            })->values()->all(),
            'tasks' => $projectModel->activities->flatMap(function ($act) {
                return $act->tasks->map(function ($task) use ($act) {
                    return [
                        'id' => (string) $task->id,
                        'title' => $task->title,
                        'description' => $task->description,
                        'status' => $task->status,
                        'due_date' => $task->due_date?->format('M d, Y'),
                        'due_date_raw' => $task->due_date?->format('Y-m-d'),
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
                ])->values()->all(),
            'projectMembers' => $projectModel->roleAssignments
                ->where('role', ProjectRoleAssignment::ROLE_PROJECT_MEMBER)
                ->map(fn ($assignment) => [
                    'id' => $assignment->user->id,
                    'name' => $assignment->user->name,
                    'email' => $assignment->user->email,
                    'committee_id' => $assignment->committee_id ? (string) $assignment->committee_id : null,
                ])->values()->all(),
            'availablePersonnel' => (Auth::check() && $userRole === ProjectRoleAssignment::ROLE_PROJECT_LEADER)
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

        $currentTab = $initialTab ?? request('tab');

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

        $project->update($request->safe()->only([
            'title',
            'description',
            'start_date',
            'end_date',
            'status',
        ]));

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

        return redirect()->route('projects.show', $project)->with('status', 'Project archived successfully.');
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
}
