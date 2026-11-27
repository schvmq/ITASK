<?php

namespace App\Http\Controllers;

use App\Models\Activity;
use App\Models\Chat;
use App\Models\CoChairDesignation;
use App\Models\Committee;
use App\Models\Message;
use App\Models\Project;
use App\Models\ProjectApprovalDocument;
use App\Models\ProjectRoleAssignment;
use App\Models\User;
use App\Services\SpecialOrder\SpecialOrderParserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class SpecialOrderImportController extends Controller
{
    public function __construct(
        protected SpecialOrderParserService $parserService
    ) {}

    /**
     * Show the Smart S.O. Import interface.
     */
    public function create(Request $request): Response
    {
        $allUsers = User::select('id', 'name', 'email')
            ->orderBy('name')
            ->get();

        return Inertia::render('Projects/SmartSOImport', [
            'users' => $allUsers,
            'currentUser' => $request->user()->only(['id', 'name', 'email']),
        ]);
    }

    /**
     * Parse an uploaded S.O. PDF or return sample structure.
     */
    public function parse(Request $request): JsonResponse
    {
        try {
            if ($request->boolean('sample') || ! $request->hasFile('file')) {
                $parsedData = $this->parserService->getSampleSO755Data();
                return response()->json([
                    'success' => true,
                    'data' => $parsedData,
                    'temp_file_token' => null,
                ]);
            }

            $request->validate([
                'file' => ['required', 'file', 'mimes:pdf,docx,txt', 'max:20480'],
            ]);

            $uploadedFile = $request->file('file');
            $originalName = $uploadedFile->getClientOriginalName();

            // Store in temporary uploads directory for subsequent confirmation
            $tempPath = $uploadedFile->store('temp_so_uploads', 'local');

            $fullDiskPath = Storage::disk('local')->path($tempPath);
            $parsedData = $this->parserService->parseFile($fullDiskPath, $originalName);

            return response()->json([
                'success' => true,
                'data' => $parsedData,
                'temp_file_path' => $tempPath,
                'original_name' => $originalName,
            ]);
        } catch (\Throwable $e) {
            Log::error('Smart S.O. Parse error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);

            // Graceful fallback to sample data so the user is never blocked
            $sample = $this->parserService->getSampleSO755Data();
            return response()->json([
                'success' => true,
                'data' => $sample,
                'warning' => 'Automated parser encountered a formatting issue. S.O. No. 755 sample structure loaded for review.',
                'temp_file_token' => null,
            ]);
        }
    }

    /**
     * Confirm and create the full Event structure in a single database transaction.
     */
    public function confirm(Request $request): RedirectResponse|JsonResponse
    {
        $validated = $request->validate([
            'so_number' => ['required', 'string', 'max:255'],
            'event_title' => ['required', 'string', 'max:255'],
            'submission_deadline' => ['nullable', 'date'],
            'overall_chair_user_id' => ['required', 'exists:users,id'],
            'event_co_chair_user_ids' => ['nullable', 'array'],
            'event_co_chair_user_ids.*' => ['exists:users,id'],
            'temp_file_path' => ['nullable', 'string'],
            'original_name' => ['nullable', 'string'],
            'committees' => ['required', 'array', 'min:1'],
            'committees.*.name' => ['required', 'string', 'max:255'],
            'committees.*.description' => ['nullable', 'string'],
            'committees.*.chairperson_user_id' => ['nullable', 'exists:users,id'],
            'committees.*.co_chair_user_ids' => ['nullable', 'array'],
            'committees.*.co_chair_user_ids.*' => ['exists:users,id'],
            'committees.*.member_user_ids' => ['nullable', 'array'],
            'committees.*.member_user_ids.*' => ['exists:users,id'],
            'committees.*.deliverables' => ['nullable', 'array'],
            'committees.*.deliverables.*.title' => ['required', 'string'],
            'committees.*.deliverables.*.description' => ['nullable', 'string'],
            'committees.*.deliverables.*.selected' => ['nullable', 'boolean'],
        ]);

        $project = DB::transaction(function () use ($validated, $request) {
            $currentUserId = Auth::id();
            $overallChairUserId = (int) $validated['overall_chair_user_id'];

            // 1. Create the Project
            $project = Project::create([
                'title' => $validated['event_title'],
                'description' => "Event organized pursuant to {$validated['so_number']}.",
                'start_date' => now()->toDateString(),
                'end_date' => $validated['submission_deadline'] ?? now()->addMonths(3)->toDateString(),
                'status' => Project::STATUS_PLANNING,
                'created_by' => $currentUserId,
            ]);

            // 2. Assign Overall Chair (Project Leader)
            ProjectRoleAssignment::create([
                'project_id' => $project->id,
                'user_id' => $overallChairUserId,
                'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
                'committee_id' => null,
            ]);

            // If the user initiating the import is not the Overall Chair, assign them as leader or staff so they retain administrative access
            if ($currentUserId !== $overallChairUserId) {
                ProjectRoleAssignment::create([
                    'project_id' => $project->id,
                    'user_id' => $currentUserId,
                    'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
                    'committee_id' => null,
                ]);
            }

            // 3. Create Group Chat for Event
            $chat = Chat::create([
                'project_id' => $project->id,
            ]);

            $chat->messages()->create([
                'sender_id' => null,
                'type' => Message::TYPE_SYSTEM,
                'body' => "Event structure initialized from {$validated['so_number']}.",
            ]);

            // 4. Assign Event Co-Chairs
            $eventCoChairIds = array_unique(array_filter($validated['event_co_chair_user_ids'] ?? []));
            foreach ($eventCoChairIds as $coChairUserId) {
                $coChairUserId = (int) $coChairUserId;
                if ($coChairUserId === $overallChairUserId) {
                    continue; // Skip if they are already overall chair
                }

                // Ensure base membership assignment exists at project level
                ProjectRoleAssignment::firstOrCreate(
                    [
                        'project_id' => $project->id,
                        'user_id' => $coChairUserId,
                        'committee_id' => null,
                    ],
                    [
                        'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
                    ]
                );

                // Add formal Event-level CoChairDesignation
                CoChairDesignation::firstOrCreate([
                    'project_id' => $project->id,
                    'committee_id' => null,
                    'user_id' => $coChairUserId,
                ], [
                    'designated_by' => $currentUserId,
                ]);
            }

            // 5. Store uploaded Special Order document if present
            if (! empty($validated['temp_file_path']) && Storage::disk('local')->exists($validated['temp_file_path'])) {
                $targetDir = "project_approvals/{$project->id}";
                Storage::disk('local')->makeDirectory($targetDir);

                $fileName = basename($validated['temp_file_path']);
                $newPath = "{$targetDir}/{$fileName}";
                Storage::disk('local')->move($validated['temp_file_path'], $newPath);

                ProjectApprovalDocument::create([
                    'project_id' => $project->id,
                    'uploaded_by' => $currentUserId,
                    'original_name' => $validated['original_name'] ?? "{$validated['so_number']}.pdf",
                    'file_path' => $newPath,
                    'mime_type' => 'application/pdf',
                    'file_size' => Storage::disk('local')->size($newPath),
                ]);
            }

            // 6. Create Committees, Assignments, and Deliverables
            foreach ($validated['committees'] as $cData) {
                $committee = Committee::create([
                    'project_id' => $project->id,
                    'name' => $cData['name'],
                    'description' => $cData['description'] ?? null,
                ]);

                // Chairperson
                if (! empty($cData['chairperson_user_id'])) {
                    $chairUserId = (int) $cData['chairperson_user_id'];
                    ProjectRoleAssignment::create([
                        'project_id' => $project->id,
                        'committee_id' => $committee->id,
                        'user_id' => $chairUserId,
                        'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
                    ]);
                }

                // Committee Co-Chairs
                $commCoChairIds = array_unique(array_filter($cData['co_chair_user_ids'] ?? []));
                foreach ($commCoChairIds as $coChairId) {
                    $coChairId = (int) $coChairId;

                    // Committee membership role
                    ProjectRoleAssignment::firstOrCreate(
                        [
                            'project_id' => $project->id,
                            'committee_id' => $committee->id,
                            'user_id' => $coChairId,
                        ],
                        [
                            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
                        ]
                    );

                    // Committee-level CoChairDesignation
                    CoChairDesignation::firstOrCreate([
                        'project_id' => $project->id,
                        'committee_id' => $committee->id,
                        'user_id' => $coChairId,
                    ], [
                        'designated_by' => $currentUserId,
                    ]);
                }

                // Committee Members
                $memberIds = array_unique(array_filter($cData['member_user_ids'] ?? []));
                foreach ($memberIds as $memberId) {
                    $memberId = (int) $memberId;

                    // Avoid duplicate assignment within the same committee
                    ProjectRoleAssignment::firstOrCreate(
                        [
                            'project_id' => $project->id,
                            'committee_id' => $committee->id,
                            'user_id' => $memberId,
                        ],
                        [
                            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
                        ]
                    );
                }

                // Instantiate approved deliverables as Activities
                if (! empty($cData['deliverables'])) {
                    foreach ($cData['deliverables'] as $deliv) {
                        $isSelected = $deliv['selected'] ?? true;
                        if ($isSelected && ! empty($deliv['title'])) {
                            Activity::create([
                                'project_id' => $project->id,
                                'committee_id' => $committee->id,
                                'created_by' => $currentUserId,
                                'title' => $deliv['title'],
                                'description' => $deliv['description'] ?? null,
                                'status' => Activity::STATUS_TODO,
                                'start_date' => now()->toDateString(),
                                'due_date' => $project->end_date,
                            ]);
                        }
                    }
                }
            }

            return $project;
        });

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'project_id' => $project->id,
                'redirect_url' => route('projects.show', $project),
            ]);
        }

        return redirect()->route('projects.show', $project)
            ->with('status', "Event structure successfully created from {$validated['so_number']} with " . count($validated['committees']) . " committees!");
    }
}

