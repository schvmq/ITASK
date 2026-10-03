<?php

namespace App\Http\Controllers;

use App\Events\MessageDeleted;
use App\Events\MessageRestored;
use App\Events\MessageSent;
use App\Events\MessagesRead;
use App\Models\Activity;
use App\Models\Committee;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Message;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Models\User;
use App\Notifications\TaskAssignedNotification;
use App\Services\ProjectProgressService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ChatController extends Controller
{
    public function __construct(
        protected ProjectProgressService $progressService
    ) {}

    /**
     * Display the messaging interface.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();

        // 1. Fetch conversations for the current user
        $conversations = Conversation::query()
            ->whereHas('participants', function ($q) use ($user) {
                $q->where('user_id', $user->id);
            })
            ->with([
                'latestMessage' => fn ($q) => $q->withTrashed()->with('sender:id,name'),
                'users:id,name,email',
                'project:id,title',
                'committee:id,name',
            ])
            ->get()
            ->map(function (Conversation $conv) use ($user) {
                $participant = $conv->participants->firstWhere('user_id', $user->id);
                $lastReadMsgId = $participant?->last_read_message_id;
                $lastReadAt = $participant?->last_read_at;

                $unreadCount = $conv->messages()
                    ->where('sender_id', '!=', $user->id)
                    ->when($lastReadMsgId, function ($query, $lastReadMsgId) {
                        return $query->where('id', '>', $lastReadMsgId);
                    }, function ($query) use ($lastReadAt) {
                        return $query->when($lastReadAt, fn ($q) => $q->where('created_at', '>', $lastReadAt));
                    })
                    ->count();

                // Compute display title and avatar subtitle
                $otherUser = $conv->type === 'direct'
                    ? $conv->users->firstWhere('id', '!=', $user->id)
                    : null;

                $title = match ($conv->type) {
                    'direct' => $otherUser?->name ?? 'Direct Message',
                    'project' => $conv->project ? $conv->project->title . ' (Project Team)' : ($conv->title ?? 'Project Channel'),
                    'committee' => $conv->committee ? $conv->committee->name . ' (Committee)' : ($conv->title ?? 'Committee Channel'),
                    default => $conv->title ?? 'Conversation',
                };

                $latestMsg = $conv->latestMessage;
                $latestMsgBody = null;
                $isDeleted = false;

                if ($latestMsg) {
                    $isDeleted = $latestMsg->trashed();
                    $latestMsgBody = $isDeleted ? 'This message was deleted' : $latestMsg->body;
                }

                return [
                    'id' => $conv->id,
                    'type' => $conv->type,
                    'title' => $title,
                    'project_id' => $conv->project_id,
                    'project_name' => $conv->project?->title,
                    'committee_id' => $conv->committee_id,
                    'committee_name' => $conv->committee?->name,
                    'other_user' => $otherUser ? [
                        'id' => $otherUser->id,
                        'name' => $otherUser->name,
                        'email' => $otherUser->email,
                    ] : null,
                    'latest_message' => $latestMsg ? [
                        'id' => $latestMsg->id,
                        'body' => $latestMsgBody,
                        'is_deleted' => $isDeleted,
                        'attachment_name' => $isDeleted ? null : $latestMsg->attachment_name,
                        'created_at' => $latestMsg->created_at->toISOString(),
                        'sender_name' => $latestMsg->sender?->name ?? 'Unknown',
                    ] : null,
                    'unread_count' => $unreadCount,
                    'updated_at' => $latestMsg?->created_at?->toISOString() ?? $conv->updated_at->toISOString(),
                ];
            })
            ->sortByDesc('updated_at')
            ->values();

        // 2. Determine active conversation
        $activeConversationId = $request->query('conversation');
        if (! $activeConversationId && $conversations->isNotEmpty()) {
            $activeConversationId = $conversations->first()['id'];
        }
        $activeConversation = null;
        $messages = [];

        if ($activeConversationId) {
            $selected = Conversation::query()
                ->where('id', $activeConversationId)
                ->whereHas('participants', fn ($q) => $q->where('user_id', $user->id))
                ->with(['users:id,name,email', 'project:id,title,created_by', 'committee:id,name', 'participants'])
                ->first();

            if ($selected) {
                // Load messages including soft deleted ones to display the tombstone
                $messages = $selected->messages()
                    ->withTrashed()
                    ->with(['sender:id,name,email', 'task.assignees:id,name', 'task.assignee:id,name'])
                    ->orderBy('created_at', 'asc')
                    ->take(150)
                    ->get()
                    ->map(function (Message $m) {
                        $isDeleted = $m->trashed();
                        $taskData = null;

                        if (! $isDeleted && $m->task) {
                            $assignees = $m->task->assignees->isNotEmpty()
                                ? $m->task->assignees->map(fn ($u) => ['id' => $u->id, 'name' => $u->name])->values()
                                : ($m->task->assignee ? [['id' => $m->task->assignee->id, 'name' => $m->task->assignee->name]] : []);

                            $taskData = [
                                'id' => $m->task->id,
                                'title' => $m->task->title,
                                'description' => $m->task->description,
                                'status' => $m->task->status,
                                'priority' => $m->task->priority ?? 'Medium',
                                'due_date' => $m->task->due_date ? Carbon::parse($m->task->due_date)->format('M d, Y') : null,
                                'assignees' => $assignees,
                                'action_url' => $m->task->activity ? route('projects.committees.activities.show', [
                                    'project' => $m->task->activity->project_id,
                                    'committee' => $m->task->activity->committee_id,
                                    'activity' => $m->task->activity->id,
                                ]) : null,
                            ];
                        } elseif ($m->task_id && ! $m->task) {
                            $taskData = [
                                'is_unavailable' => true,
                            ];
                        }

                        return [
                            'id' => $m->id,
                            'conversation_id' => $m->conversation_id,
                            'sender_id' => $m->sender_id,
                            'body' => $isDeleted ? '' : $m->body,
                            'is_deleted' => $isDeleted,
                            'task_id' => $isDeleted ? null : $m->task_id,
                            'task' => $isDeleted ? null : $taskData,
                            'attachment_path' => $isDeleted ? null : $m->attachment_path,
                            'attachment_name' => $isDeleted ? null : $m->attachment_name,
                            'attachment_type' => $isDeleted ? null : $m->attachment_type,
                            'attachment_size' => $isDeleted ? null : $m->attachment_size,
                            'created_at' => $m->created_at->toISOString(),
                            'sender' => [
                                'id' => $m->sender->id,
                                'name' => $m->sender->name,
                                'email' => $m->sender->email,
                            ],
                        ];
                    });

                $otherUser = $selected->type === 'direct'
                    ? $selected->users->firstWhere('id', '!=', $user->id)
                    : null;

                // Shared files from active non-deleted conversation messages
                $sharedFiles = $selected->messages()
                    ->whereNotNull('attachment_name')
                    ->latest()
                    ->take(8)
                    ->get(['id', 'attachment_name', 'attachment_path', 'attachment_type', 'attachment_size', 'created_at'])
                    ->map(fn ($m) => [
                        'id' => $m->id,
                        'name' => $m->attachment_name,
                        'type' => $m->attachment_type,
                        'size' => $m->attachment_size,
                        'download_url' => route('chat.attachments.download', $m->id),
                        'created_at' => $m->created_at->toISOString(),
                    ]);

                // Pinned tasks from conversation project
                $pinnedTasks = collect();
                if ($selected->project_id) {
                    $pinnedTasks = Task::query()
                        ->whereHas('activity', fn ($q) => $q->where('project_id', $selected->project_id))
                        ->with(['assignee:id,name', 'activity.committee'])
                        ->latest()
                        ->take(5)
                        ->get()
                        ->map(fn ($t) => [
                            'id' => (string) $t->id,
                            'title' => $t->title,
                            'status' => $t->status,
                            'priority' => $t->priority ?? 'Medium',
                            'due_date_formatted' => $t->due_date ? $t->due_date->format('M d') : 'No date',
                            'assignee_name' => $t->assignee?->name ?? 'Unassigned',
                            'action_url' => route('projects.committees.activities.show', [
                                'project' => $t->activity->project_id,
                                'committee' => $t->activity->committee_id,
                                'activity' => $t->activity->id,
                            ]),
                        ]);
                }

                // Project progress info
                $projectInfo = null;
                if ($selected->project) {
                    $prog = $this->progressService->calculateProjectProgress($selected->project);
                    $projectInfo = [
                        'id' => (string) $selected->project->id,
                        'title' => $selected->project->title,
                        'progress' => $prog['progress'] ?? 0,
                        'total_tasks' => $prog['total_tasks'] ?? 0,
                        'completed_tasks' => $prog['completed_tasks'] ?? 0,
                    ];
                }

                // Participants with project role and read receipts tracking
                $participants = $selected->participants->map(function (ConversationParticipant $p) use ($selected) {
                    $u = $p->user;
                    if (! $u) return null;

                    $role = 'Member';
                    if ($selected->project) {
                        $assignment = $selected->project->roleAssignments()->where('user_id', $u->id)->first();
                        if ($assignment) {
                            $role = $assignment->role;
                        } elseif ($selected->project->created_by === $u->id) {
                            $role = 'Project Leader';
                        }
                    }

                    return [
                        'id' => $u->id,
                        'name' => $u->name,
                        'email' => $u->email,
                        'role' => $role,
                        'is_online' => true,
                        'last_read_message_id' => $p->last_read_message_id,
                        'last_read_at' => $p->last_read_at?->toISOString(),
                    ];
                })->filter()->values();

                $activeConversation = [
                    'id' => $selected->id,
                    'type' => $selected->type,
                    'title' => match ($selected->type) {
                        'direct' => $otherUser?->name ?? 'Direct Message',
                        'project' => $selected->project ? $selected->project->title : ($selected->title ?? 'Project Channel'),
                        'committee' => $selected->committee ? $selected->committee->name : ($selected->title ?? 'Committee Channel'),
                        default => $selected->title ?? 'Conversation',
                    },
                    'project_id' => $selected->project_id,
                    'other_user' => $otherUser ? [
                        'id' => $otherUser->id,
                        'name' => $otherUser->name,
                        'email' => $otherUser->email,
                    ] : null,
                    'project' => $projectInfo,
                    'participants' => $participants,
                    'shared_files' => $sharedFiles,
                    'pinned_tasks' => $pinnedTasks,
                ];
            }
        }

        // 3. Fetch potential direct chat partners (users with accounts)
        $availableUsers = User::query()
            ->where('id', '!=', $user->id)
            ->select('id', 'name', 'email')
            ->orderBy('name')
            ->get();

        // 4. Projects user belongs to (for "Create task from message" in direct chats)
        $userProjects = Project::query()
            ->where('created_by', $user->id)
            ->orWhereHas('roleAssignments', fn ($q) => $q->where('user_id', $user->id))
            ->with(['roleAssignments.user:id,name,email', 'creator:id,name,email'])
            ->select('id', 'title', 'created_by')
            ->get()
            ->map(function ($p) {
                $members = collect();
                if ($p->creator) {
                    $members->push($p->creator);
                }
                if ($p->relationLoaded('roleAssignments')) {
                    foreach ($p->roleAssignments as $assignment) {
                        if ($assignment->user) {
                            $members->push($assignment->user);
                        }
                    }
                }
                return [
                    'id' => $p->id,
                    'title' => $p->title,
                    'members' => $members->unique('id')->values()->map(fn ($u) => [
                        'id' => $u->id,
                        'name' => $u->name,
                        'email' => $u->email,
                    ]),
                ];
            });

        return Inertia::render('Chat/Index', [
            'conversations' => $conversations,
            'activeConversation' => $activeConversation,
            'messages' => $messages,
            'availableUsers' => $availableUsers,
            'userProjects' => $userProjects,
            'authUserId' => $user->id,
        ]);
    }

    /**
     * Send a new message in the conversation.
     */
    public function store(Request $request, Conversation $conversation)
    {
        $user = $request->user();

        // 1. Authorize participant
        if (! $conversation->hasParticipant($user->id)) {
            abort(403, 'You are not a participant in this conversation.');
        }

        // 2. Validate input
        $validated = $request->validate([
            'body' => ['nullable', 'string', 'max:5000'],
            'file' => ['nullable', 'file', 'max:10240'], // 10MB limit
        ]);

        if (empty($validated['body']) && ! $request->hasFile('file')) {
            if ($request->wantsJson()) {
                return response()->json(['message' => 'Message or attachment is required.'], 422);
            }
            return back()->withErrors(['body' => 'Message or attachment is required.']);
        }

        $attachmentPath = null;
        $attachmentName = null;
        $attachmentType = null;
        $attachmentSize = null;

        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $attachmentPath = Storage::disk('local')->putFile('chat_attachments', $file);
            $attachmentName = $file->getClientOriginalName();
            $attachmentType = $file->getClientMimeType() ?: 'application/octet-stream';
            $attachmentSize = $file->getSize();
        }

        // 3. Create message
        $message = DB::transaction(function () use ($conversation, $user, $validated, $attachmentPath, $attachmentName, $attachmentType, $attachmentSize) {
            $msg = $conversation->messages()->create([
                'sender_id' => $user->id,
                'body' => $validated['body'] ?? '',
                'attachment_path' => $attachmentPath,
                'attachment_name' => $attachmentName,
                'attachment_type' => $attachmentType,
                'attachment_size' => $attachmentSize,
            ]);

            // Advance sender's read marker to this new message
            $conversation->participants()
                ->where('user_id', $user->id)
                ->update([
                    'last_read_at' => now(),
                    'last_read_message_id' => $msg->id,
                ]);

            $conversation->touch();

            return $msg;
        });

        // 4. Broadcast event in real time to other participants
        try {
            broadcast(new MessageSent($message))->toOthers();
        } catch (\Throwable $e) {
            report($e);
        }

        if ($request->wantsJson()) {
            return response()->json([
                'id' => $message->id,
                'conversation_id' => $message->conversation_id,
                'sender_id' => $message->sender_id,
                'body' => $message->body,
                'is_deleted' => false,
                'created_at' => $message->created_at->toISOString(),
            ]);
        }

        return redirect()->route('chat.index', ['conversation' => $conversation->id]);
    }

    /**
     * Mark messages in a conversation as read.
     * Enforces server time and strictly advances forward (never moves backward).
     */
    public function markAsRead(Request $request, Conversation $conversation): JsonResponse
    {
        $user = $request->user();

        // 1. Authorize participant
        if (! $conversation->hasParticipant($user->id)) {
            abort(403, 'You are not a participant in this conversation.');
        }

        $validated = $request->validate([
            'last_read_message_id' => ['nullable', 'integer'],
        ]);

        $participant = $conversation->participants()->where('user_id', $user->id)->first();
        if (! $participant) {
            return response()->json(['success' => false, 'message' => 'Participant not found.'], 404);
        }

        $newMsgId = $validated['last_read_message_id'] ?? null;
        $currentMsgId = $participant->last_read_message_id;

        // Never move receipt backward
        $shouldUpdateMsgId = $newMsgId && (! $currentMsgId || $newMsgId > $currentMsgId);
        $readAt = now();

        $updateData = ['last_read_at' => $readAt];
        if ($shouldUpdateMsgId) {
            $updateData['last_read_message_id'] = $newMsgId;
        }

        $participant->update($updateData);

        // Broadcast to other participants in this chat channel
        try {
            broadcast(new MessagesRead(
                conversationId: $conversation->id,
                userId: $user->id,
                lastReadMessageId: $shouldUpdateMsgId ? $newMsgId : $currentMsgId,
                readAt: $readAt->toISOString(),
                userName: $user->name
            ))->toOthers();
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json([
            'success' => true,
            'last_read_message_id' => $participant->fresh()->last_read_message_id,
            'last_read_at' => $participant->fresh()->last_read_at?->toISOString(),
        ]);
    }

    /**
     * Soft delete a message.
     * Enforces server-side permissions: Sender OR Project Leader only.
     */
    public function destroyMessage(Request $request, Conversation $conversation, Message $message): JsonResponse
    {
        $user = $request->user();

        // 1. Authorize participant
        if (! $conversation->hasParticipant($user->id)) {
            abort(403, 'You are not a participant in this conversation.');
        }

        if ((int) $message->conversation_id !== (int) $conversation->id) {
            abort(404, 'Message does not belong to this conversation.');
        }

        // 2. Permission check: Sender OR Project Leader
        $isSender = (int) $message->sender_id === (int) $user->id;
        $isProjectLeader = false;

        if ($conversation->project_id && $conversation->project) {
            $isProjectLeader = ((int) $conversation->project->created_by === (int) $user->id) ||
                $conversation->project->roleAssignments()
                    ->where('user_id', $user->id)
                    ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
                    ->exists();
        }

        if (! $isSender && ! $isProjectLeader) {
            abort(403, 'You do not have permission to delete this message.');
        }

        // 3. Perform soft delete
        $message->delete();

        // 4. Broadcast MessageDeleted to real-time channel
        try {
            broadcast(new MessageDeleted($conversation->id, $message->id))->toOthers();
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json([
            'success' => true,
            'message_id' => $message->id,
        ]);
    }

    /**
     * Restore a soft-deleted message (5-second Undo flow).
     */
    public function restoreMessage(Request $request, Conversation $conversation, int $messageId): JsonResponse
    {
        $user = $request->user();

        if (! $conversation->hasParticipant($user->id)) {
            abort(403, 'You are not a participant in this conversation.');
        }

        $message = $conversation->messages()->withTrashed()->findOrFail($messageId);

        $isSender = (int) $message->sender_id === (int) $user->id;
        $isProjectLeader = false;

        if ($conversation->project_id && $conversation->project) {
            $isProjectLeader = ((int) $conversation->project->created_by === (int) $user->id) ||
                $conversation->project->roleAssignments()
                    ->where('user_id', $user->id)
                    ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
                    ->exists();
        }

        if (! $isSender && ! $isProjectLeader) {
            abort(403, 'You do not have permission to restore this message.');
        }

        $message->restore();

        try {
            broadcast(new MessageRestored($message))->toOthers();
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json([
            'success' => true,
            'message_id' => $message->id,
        ]);
    }

    /**
     * Create a task from message popup within an atomic database transaction.
     * Creates: Task -> Task Assignments -> Chat Message -> Assignee Notifications.
     * Rolls back on any error.
     */
    public function createTask(Request $request, Conversation $conversation): JsonResponse
    {
        $user = $request->user();

        // 1. Authorize participant
        if (! $conversation->hasParticipant($user->id)) {
            abort(403, 'You are not a participant in this conversation.');
        }

        // 2. Validate input
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:5000'],
            'assignee_ids' => ['required', 'array', 'min:1'],
            'assignee_ids.*' => ['integer', 'exists:users,id'],
            'due_date' => ['required', 'date'],
            'priority' => ['required', 'string', 'in:Low,Medium,High'],
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'idempotency_key' => ['nullable', 'string', 'max:64'],
        ]);

        // 3. Idempotency check to prevent duplicate double-click submissions
        $idempotencyKey = $validated['idempotency_key'] ?? null;
        if ($idempotencyKey) {
            $cacheKey = "task_create_idem_{$idempotencyKey}_{$user->id}";
            if (Cache::has($cacheKey)) {
                return response()->json(['message' => 'This task was already submitted.'], 409);
            }
        }

        // 4. Resolve and validate Project
        $projectId = $conversation->project_id ?? ($validated['project_id'] ?? null);
        if (! $projectId) {
            return response()->json(['message' => 'Please select a project for this task.'], 422);
        }

        $project = Project::find($projectId);
        if (! $project) {
            return response()->json(['message' => 'Project not found.'], 404);
        }

        // Ensure user belongs to the project
        $isUserInProject = ((int) $project->created_by === (int) $user->id) ||
            $project->roleAssignments()->where('user_id', $user->id)->exists();

        if (! $isUserInProject) {
            return response()->json(['message' => 'You do not have access to this project.'], 403);
        }

        // 5. Timezone-aware date validation: no past dates
        $dueDate = Carbon::parse($validated['due_date']);
        if ($dueDate->endOfDay()->isPast()) {
            return response()->json(['message' => 'Choose a date that is today or later.'], 422);
        }

        // 6. Validate all assignees belong to this project
        $assigneeIds = array_values(array_unique($validated['assignee_ids']));
        $projectMemberIds = $project->roleAssignments()->pluck('user_id')->push($project->created_by)->unique();

        foreach ($assigneeIds as $assigneeId) {
            if (! $projectMemberIds->contains($assigneeId)) {
                return response()->json(['message' => 'One or more assignees are not members of this project.'], 422);
            }
        }

        // 7. Atomic DB Transaction: Task -> Assignments -> Chat Message -> Notifications
        try {
            $result = DB::transaction(function () use ($conversation, $project, $user, $validated, $assigneeIds, $dueDate) {
                // Ensure project has a committee and an activity
                $committee = $project->committees()->first();
                if (! $committee) {
                    $committee = $project->committees()->create([
                        'name' => 'General Committee',
                        'description' => 'Default committee for project collaboration',
                    ]);
                }

                $activity = $committee->activities()->first();
                if (! $activity) {
                    $activity = $committee->activities()->create([
                        'project_id' => $project->id,
                        'created_by' => $user->id,
                        'title' => 'General Project Tasks',
                        'status' => 'To Do',
                        'due_date' => $dueDate->toDateString(),
                    ]);
                }

                // 7a. Create Task
                $task = Task::create([
                    'activity_id' => $activity->id,
                    'assigned_to' => $assigneeIds[0], // primary assignee for backwards compatibility
                    'title' => $validated['title'],
                    'description' => $validated['description'] ?? null,
                    'due_date' => $dueDate->toDateString(),
                    'priority' => $validated['priority'],
                    'status' => Task::STATUS_TO_DO,
                    'requires_review' => false,
                ]);

                // 7b. Create task_assignees records for all assignees
                foreach ($assigneeIds as $uid) {
                    DB::table('task_assignees')->updateOrInsert(
                        ['task_id' => $task->id, 'user_id' => $uid],
                        ['created_at' => now(), 'updated_at' => now()]
                    );
                }

                $assignees = User::whereIn('id', $assigneeIds)->get(['id', 'name', 'email']);

                // 7c. Create Chat Message containing the live task tag
                $taskPayload = [
                    'id' => $task->id,
                    'title' => $task->title,
                    'description' => $task->description,
                    'due_date' => $dueDate->format('M d, Y'),
                    'priority' => $task->priority,
                    'status' => $task->status,
                    'assignees' => $assignees->map(fn ($u) => ['id' => $u->id, 'name' => $u->name])->toArray(),
                    'project_name' => $project->title,
                    'action_url' => route('projects.committees.activities.show', [
                        'project' => $activity->project_id,
                        'committee' => $activity->committee_id,
                        'activity' => $activity->id,
                    ]),
                ];

                $message = $conversation->messages()->create([
                    'sender_id' => $user->id,
                    'task_id' => $task->id,
                    'body' => '[task:' . json_encode($taskPayload) . ']',
                ]);

                // Advance sender's read marker
                $conversation->participants()
                    ->where('user_id', $user->id)
                    ->update([
                        'last_read_at' => now(),
                        'last_read_message_id' => $message->id,
                    ]);

                $conversation->touch();

                // 7d. Notifications for each assignee (suppress self-assignment notification noise)
                foreach ($assignees as $assigneeUser) {
                    if ((int) $assigneeUser->id !== (int) $user->id) {
                        try {
                            $assigneeUser->notify(new TaskAssignedNotification($task, $activity, $committee, $project));
                        } catch (\Throwable $ne) {
                            report($ne);
                        }
                    }
                }

                return [
                    'task' => $task,
                    'message' => $message,
                    'taskPayload' => $taskPayload,
                ];
            });

            // Mark idempotency key in cache for 1 hour
            if ($idempotencyKey) {
                Cache::put("task_create_idem_{$idempotencyKey}_{$user->id}", true, now()->addHour());
            }

            // Broadcast message to chat thread
            try {
                broadcast(new MessageSent($result['message']))->toOthers();
            } catch (\Throwable $e) {
                report($e);
            }

            return response()->json([
                'success' => true,
                'task' => $result['taskPayload'],
                'message' => [
                    'id' => $result['message']->id,
                    'conversation_id' => $result['message']->conversation_id,
                    'sender_id' => $result['message']->sender_id,
                    'body' => $result['message']->body,
                    'task_id' => $result['task']->id,
                    'created_at' => $result['message']->created_at->toISOString(),
                ],
            ]);
        } catch (\Throwable $e) {
            report($e);
            return response()->json([
                'message' => "Couldn't create the task. Nothing was sent. Try again.",
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Start or open an existing direct message conversation with another user.
     */
    public function startDirectMessage(Request $request, User $recipient): RedirectResponse
    {
        $currentUser = $request->user();

        if ($recipient->id === $currentUser->id) {
            return back()->withErrors(['error' => 'You cannot message yourself.']);
        }

        // Check if a direct conversation already exists between these 2 users
        $existing = Conversation::query()
            ->where('type', 'direct')
            ->whereHas('participants', fn ($q) => $q->where('user_id', $currentUser->id))
            ->whereHas('participants', fn ($q) => $q->where('user_id', $recipient->id))
            ->first();

        if ($existing) {
            return redirect()->route('chat.index', ['conversation' => $existing->id]);
        }

        // Create new direct conversation
        $conversation = DB::transaction(function () use ($currentUser, $recipient) {
            $conv = Conversation::create([
                'type' => 'direct',
                'created_by' => $currentUser->id,
            ]);

            $conv->participants()->createMany([
                ['user_id' => $currentUser->id, 'last_read_at' => now()],
                ['user_id' => $recipient->id, 'last_read_at' => null],
            ]);

            return $conv;
        });

        return redirect()->route('chat.index', ['conversation' => $conversation->id]);
    }

    /**
     * Securely download a chat attachment.
     * Prevents downloading deleted message attachments.
     */
    public function downloadAttachment(Request $request, Message $message): StreamedResponse
    {
        $user = $request->user();

        if ($message->trashed()) {
            abort(404, 'Attachment is no longer accessible because the message was deleted.');
        }

        if (! $message->conversation->hasParticipant($user->id)) {
            abort(403, 'Unauthorized access to chat attachment.');
        }

        if (! $message->attachment_path || ! Storage::disk('local')->exists($message->attachment_path)) {
            abort(404, 'Attachment file not found.');
        }

        return Storage::disk('local')->download($message->attachment_path, $message->attachment_name ?? 'attachment');
    }
}
