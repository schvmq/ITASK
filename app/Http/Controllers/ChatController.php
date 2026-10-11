<?php

namespace App\Http\Controllers;

use App\Events\MessageDeleted;
use App\Events\MessageRestored;
use App\Events\MessageSent;
use App\Events\MessagesRead;
use App\Models\Activity;
use App\Models\Chat;
use App\Models\ChatReadState;
use App\Models\ChatUserPreference;
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
     * Display the Project Group Chats interface.
     * Enforces that only active project members can view chats.
     * No direct messages exist.
     */
    public function index(Request $request, ?int $projectId = null): Response
    {
        $user = $request->user();

        // 1. Fetch all active projects where the user is a member
        $projects = Project::query()
            ->whereNull('deleted_at')
            ->where(function ($q) use ($user) {
                $q->where('created_by', $user->id)
                    ->orWhereHas('roleAssignments', fn ($rq) => $rq->where('user_id', $user->id));
            })
            ->with([
                'chat.latestMessage.sender:id,name,email',
                'chat.latestMessage.task',
                'roleAssignments.user:id,name,email',
                'creator:id,name,email',
            ])
            ->get();

        // 2. Map and ensure each project has exactly one group chat (idempotent)
        $chatItems = $projects->map(function (Project $project) use ($user) {
            $chat = $project->chat;

            if (! $chat) {
                $chat = Chat::create([
                    'project_id' => $project->id,
                    'archived_at' => $project->status === Project::STATUS_ARCHIVED ? now() : null,
                ]);

                $chat->messages()->create([
                    'sender_id' => null,
                    'type' => Message::TYPE_SYSTEM,
                    'body' => 'Project chat created. Everyone in this project can message here.',
                ]);

                $chat->load('latestMessage');
            }

            // Read state for this user in this chat
            $readState = ChatReadState::where('chat_id', $chat->id)
                ->where('user_id', $user->id)
                ->first();

            $lastReadMsgId = $readState?->last_read_message_id;
            $lastReadAt = $readState?->read_at;

            // Unread count: only messages from other users or system messages after last read
            $unreadCount = $chat->messages()
                ->where(function ($mq) use ($user) {
                    $mq->where('sender_id', '!=', $user->id)
                       ->orWhereNull('sender_id');
                })
                ->when($lastReadMsgId, function ($query, $lastReadMsgId) {
                    return $query->where('id', '>', $lastReadMsgId);
                }, function ($query) use ($lastReadAt) {
                    return $query->when($lastReadAt, fn ($q) => $q->where('created_at', '>', $lastReadAt));
                })
                ->count();

            // Preferences: is_pinned, is_muted
            $pref = ChatUserPreference::where('chat_id', $chat->id)
                ->where('user_id', $user->id)
                ->first();

            $isPinned = $pref?->is_pinned ?? false;
            $isMuted = $pref?->is_muted ?? false;

            // Active members count
            $memberCount = $project->roleAssignments->pluck('user_id')
                ->push($project->created_by)
                ->unique()
                ->count();

            // Format preview text
            $latestMsg = $chat->latestMessage;
            $preview = 'No messages yet';
            $previewTime = null;
            $isDeleted = false;

            if ($latestMsg) {
                $isDeleted = $latestMsg->trashed();
                $previewTime = $latestMsg->created_at->toISOString();

                if ($isDeleted) {
                    $preview = 'This message was deleted';
                } elseif ($latestMsg->type === Message::TYPE_SYSTEM || ! $latestMsg->sender_id) {
                    $preview = $latestMsg->body;
                } elseif ($latestMsg->type === Message::TYPE_TASK || $latestMsg->task_id) {
                    $taskTitle = $latestMsg->task?->title ?? 'New Task';
                    $senderName = (int) $latestMsg->sender_id === (int) $user->id ? 'You' : ($latestMsg->sender?->name ?? 'Teammate');
                    $preview = "{$senderName} assigned task: {$taskTitle}";
                } elseif ($latestMsg->attachment_name) {
                    $senderName = (int) $latestMsg->sender_id === (int) $user->id ? 'You' : ($latestMsg->sender?->name ?? 'Teammate');
                    $preview = "{$senderName} shared a file: {$latestMsg->attachment_name}";
                } else {
                    $senderName = (int) $latestMsg->sender_id === (int) $user->id ? 'You' : ($latestMsg->sender?->name ?? 'Teammate');
                    $preview = "{$senderName}: {$latestMsg->body}";
                }
            }

            $isArchived = $project->status === Project::STATUS_ARCHIVED || $chat->archived_at !== null;

            return [
                'id' => $chat->id,
                'chat_id' => $chat->id,
                'conversation_id' => $chat->id,
                'project_id' => $project->id,
                'title' => $project->title,
                'name' => $project->title,
                'type' => 'project',
                'is_archived' => $isArchived,
                'is_pinned' => $isPinned,
                'is_muted' => $isMuted,
                'member_count' => $memberCount,
                'unread_count' => max(0, $unreadCount),
                'preview' => $preview,
                'preview_time' => $previewTime,
                'updated_at' => $latestMsg?->created_at?->toISOString() ?? $project->updated_at->toISOString(),
            ];
        });

        // Split into active and archived chats
        $activeChats = $chatItems->filter(fn ($c) => ! $c['is_archived'])
            ->sort(function ($a, $b) {
                if ($a['is_pinned'] !== $b['is_pinned']) {
                    return $b['is_pinned'] ? 1 : -1;
                }
                return strcmp($b['updated_at'], $a['updated_at']);
            })
            ->values();

        $archivedChats = $chatItems->filter(fn ($c) => $c['is_archived'])
            ->sortByDesc('updated_at')
            ->values();

        // 3. Determine Selected / Active Chat
        $targetProjectId = $projectId ?? $request->query('project') ?? $request->query('conversation');
        $selectedChat = null;

        if ($targetProjectId) {
            // Find chat by project_id first, then chat_id
            $candidateChat = Chat::query()
                ->where('project_id', $targetProjectId)
                ->with(['project.creator', 'project.roleAssignments.user'])
                ->first();

            if (! $candidateChat) {
                $candidateChat = Chat::query()
                    ->where('id', $targetProjectId)
                    ->with(['project.creator', 'project.roleAssignments.user'])
                    ->first();
            }

            if (! $candidateChat) {
                $proj = Project::where('id', $targetProjectId)
                    ->whereNull('deleted_at')
                    ->where(function ($q) use ($user) {
                        $q->where('created_by', $user->id)
                            ->orWhereHas('roleAssignments', fn ($rq) => $rq->where('user_id', $user->id));
                    })
                    ->first();

                if ($proj) {
                    $candidateChat = Chat::firstOrCreate([
                        'project_id' => $proj->id,
                    ], [
                        'archived_at' => $proj->status === Project::STATUS_ARCHIVED ? now() : null,
                    ]);
                    $candidateChat->load(['project.creator', 'project.roleAssignments.user']);
                }
            }

            // If not found or soft-deleted or user is not a member, abort 404 with no info leaked
            if (! $candidateChat || ! $candidateChat->hasActiveMember($user->id)) {
                abort(404, "This chat isn't available. You may have been removed from the project.");
            }

            $selectedChat = $candidateChat;
        } elseif ($activeChats->isNotEmpty()) {
            $firstChatId = $activeChats->first()['id'];
            $selectedChat = Chat::with(['project.creator', 'project.roleAssignments.user'])->find($firstChatId);
        } elseif ($archivedChats->isNotEmpty()) {
            $firstChatId = $archivedChats->first()['id'];
            $selectedChat = Chat::with(['project.creator', 'project.roleAssignments.user'])->find($firstChatId);
        }

        // 4. Load Active Chat Messages, Receipts, and Details
        $messages = [];
        $activeChatData = null;

        if ($selectedChat) {
            $project = $selectedChat->project;

            // Access check: Active members only
            if (! $selectedChat->hasActiveMember($user->id)) {
                abort(403, "This chat isn't available. You may have been removed from the project.");
            }

            // Message query: New members see full history per Requirement 1.3
            $messagesQuery = $selectedChat->messages()
                ->withTrashed()
                ->with(['sender:id,name,email', 'task.assignees:id,name', 'task.assignee:id,name', 'task.activity'])
                ->orderBy('created_at', 'asc');

            if (! Chat::NEW_MEMBERS_SEE_HISTORY) {
                $assignment = $project->roleAssignments()->where('user_id', $user->id)->first();
                if ($assignment) {
                    $messagesQuery->where('created_at', '>=', $assignment->created_at);
                }
            }

            $messages = $messagesQuery->get()->map(function (Message $m) {
                $isDeleted = $m->trashed();
                $taskData = null;

                if (! $isDeleted && $m->task) {
                    $t = $m->task;
                    $assignees = $t->assignees->isNotEmpty()
                        ? $t->assignees->map(fn ($u) => ['id' => $u->id, 'name' => $u->name])->values()
                        : ($t->assignee ? [['id' => $t->assignee->id, 'name' => $t->assignee->name]] : []);

                    $taskData = [
                        'id' => $t->id,
                        'title' => $t->title,
                        'description' => $t->description,
                        'status' => $t->status,
                        'priority' => $t->priority ?? 'Medium',
                        'due_date' => $t->due_date ? Carbon::parse($t->due_date)->format('M d, Y') : null,
                        'assignees' => $assignees,
                        'action_url' => $t->activity ? route('projects.committees.activities.show', [
                            'project' => $t->activity->project_id,
                            'committee' => $t->activity->committee_id,
                            'activity' => $t->activity->id,
                        ]) : null,
                    ];
                } elseif ($m->task_id && ! $m->task) {
                    $taskData = [
                        'is_unavailable' => true,
                    ];
                }

                return [
                    'id' => $m->id,
                    'chat_id' => $m->chat_id,
                    'conversation_id' => $m->chat_id,
                    'sender_id' => $m->sender_id,
                    'type' => $m->type ?? ($m->sender_id === null ? 'system' : 'text'),
                    'body' => $isDeleted ? '' : ($m->body ?? ''),
                    'is_deleted' => $isDeleted,
                    'task_id' => $isDeleted ? null : $m->task_id,
                    'task' => $isDeleted ? null : $taskData,
                    'attachment_path' => $isDeleted ? null : $m->attachment_path,
                    'attachment_name' => $isDeleted ? null : $m->attachment_name,
                    'attachment_type' => $isDeleted ? null : $m->attachment_type,
                    'attachment_size' => $isDeleted ? null : $m->attachment_size,
                    'created_at' => $m->created_at->toISOString(),
                    'sender' => $m->sender ? [
                        'id' => $m->sender->id,
                        'name' => $m->sender->name,
                        'email' => $m->sender->email,
                    ] : null,
                ];
            });

            // Active Members with roles and read receipts
            $allActiveMembers = $selectedChat->getActiveMembers();
            $readStates = ChatReadState::where('chat_id', $selectedChat->id)->get()->keyBy('user_id');

            $participants = $allActiveMembers->map(function (User $u) use ($project, $readStates) {
                $role = 'Member';
                if ((int) $project->created_by === (int) $u->id) {
                    $role = 'Project Leader';
                } else {
                    $assignment = $project->roleAssignments->firstWhere('user_id', $u->id);
                    if ($assignment) {
                        $role = $assignment->role;
                    }
                }

                $userReadState = $readStates->get($u->id);

                return [
                    'id' => $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'role' => $role,
                    'is_online' => true,
                    'last_read_message_id' => $userReadState?->last_read_message_id,
                    'last_read_at' => $userReadState?->read_at?->toISOString(),
                ];
            })->values();

            // Shared files from non-deleted messages
            $sharedFiles = $selectedChat->messages()
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

            // Pinned tasks from project
            $pinnedTasks = Task::query()
                ->whereHas('activity', fn ($q) => $q->where('project_id', $project->id))
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
                    'action_url' => $t->activity ? route('projects.committees.activities.show', [
                        'project' => $t->activity->project_id,
                        'committee' => $t->activity->committee_id,
                        'activity' => $t->activity->id,
                    ]) : null,
                ]);

            // Project progress
            $prog = $this->progressService->calculateProjectProgress($project);
            $projectInfo = [
                'id' => (string) $project->id,
                'title' => $project->title,
                'progress' => $prog['progress'] ?? 0,
                'total_tasks' => $prog['total_tasks'] ?? 0,
                'completed_tasks' => $prog['completed_tasks'] ?? 0,
            ];

            $pref = ChatUserPreference::where('chat_id', $selectedChat->id)->where('user_id', $user->id)->first();

            $activeChatData = [
                'id' => $selectedChat->id,
                'chat_id' => $selectedChat->id,
                'conversation_id' => $selectedChat->id,
                'project_id' => $project->id,
                'title' => $project->title,
                'name' => $project->title,
                'type' => 'project',
                'is_archived' => $selectedChat->isArchived(),
                'is_pinned' => $pref?->is_pinned ?? false,
                'is_muted' => $pref?->is_muted ?? false,
                'is_leader' => $selectedChat->isLeader($user->id),
                'project' => $projectInfo,
                'participants' => $participants,
                'shared_files' => $sharedFiles,
                'pinned_tasks' => $pinnedTasks,
            ];
        }

        // Total unread count for sidebar
        $totalUnreadMessages = $chatItems->sum('unread_count');

        // Current project members for @mentions and task assignment
        $projectMembers = $selectedChat ? $selectedChat->getActiveMembers()->map(fn ($u) => [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
        ]) : [];

        return Inertia::render('Chat/Index', [
            'chats' => $activeChats,
            'archivedChats' => $archivedChats,
            'conversations' => $activeChats, // backward-compat prop alias
            'activeChat' => $activeChatData,
            'activeConversation' => $activeChatData, // backward-compat prop alias
            'messages' => $messages,
            'projectMembers' => $projectMembers,
            'authUserId' => $user->id,
            'totalUnreadCount' => $totalUnreadMessages,
        ]);
    }

    /**
     * Resolves a Chat instance from either a Chat model, a chat ID, or a project ID.
     */
    protected function resolveChat($chat): Chat
    {
        if ($chat instanceof Chat) {
            return $chat;
        }

        $resolved = Chat::where('id', $chat)->first()
            ?: Chat::where('project_id', $chat)->first();

        if (! $resolved) {
            $project = Project::find($chat);
            if ($project) {
                $resolved = Chat::firstOrCreate([
                    'project_id' => $project->id,
                ], [
                    'archived_at' => $project->status === Project::STATUS_ARCHIVED ? now() : null,
                ]);
            }
        }

        if (! $resolved) {
            abort(404, 'Chat not found.');
        }

        return $resolved;
    }

    /**
     * Send a message in the project group chat.
     */
    public function store(Request $request, $chat)
    {
        $user = $request->user();
        $chat = $this->resolveChat($chat);

        // 1. Enforce active project membership
        if (! $chat->hasActiveMember($user->id)) {
            abort(403, 'You are not a member of this project.');
        }

        // 2. Enforce archived read-only check
        if ($chat->isArchived()) {
            abort(403, 'This project is archived. Messages are read-only.');
        }

        // 3. Validate input
        $validated = $request->validate([
            'body' => ['nullable', 'string', 'max:5000'],
            'file' => ['nullable', 'file', 'max:10240'], // 10MB limit
        ]);

        $body = isset($validated['body']) ? trim($validated['body']) : '';
        $hasFile = $request->hasFile('file') && $request->file('file') !== null;

        if ($body === '' && ! $hasFile) {
            if ($request->wantsJson() || $request->expectsJson() || $request->ajax() || $request->header('X-Requested-With') === 'XMLHttpRequest') {
                return response()->json(['message' => 'Message or attachment is required.'], 422);
            }
            return back()->withErrors(['body' => 'Message or attachment is required.']);
        }

        $attachmentPath = null;
        $attachmentName = null;
        $attachmentType = null;
        $attachmentSize = null;

        if ($hasFile) {
            $file = $request->file('file');
            if (! $file->isValid()) {
                return response()->json(['message' => 'The uploaded file is invalid or exceeded upload limits.'], 422);
            }
            $attachmentPath = Storage::disk('local')->putFile('chat_attachments', $file);
            $attachmentName = $file->getClientOriginalName();
            $attachmentType = $file->getClientMimeType() ?: 'application/octet-stream';
            $attachmentSize = $file->getSize();
        }

        // 4. Create message & update sender read receipt in transaction
        $message = DB::transaction(function () use ($chat, $user, $body, $attachmentPath, $attachmentName, $attachmentType, $attachmentSize) {
            $msgType = $attachmentPath ? Message::TYPE_FILE : Message::TYPE_TEXT;

            $msg = $chat->messages()->create([
                'sender_id' => $user->id,
                'type' => $msgType,
                'body' => $body,
                'attachment_path' => $attachmentPath,
                'attachment_name' => $attachmentName,
                'attachment_type' => $attachmentType,
                'attachment_size' => $attachmentSize,
            ]);

            // Advance sender's read marker
            ChatReadState::updateOrCreate(
                ['chat_id' => $chat->id, 'user_id' => $user->id],
                ['last_read_message_id' => $msg->id, 'read_at' => now()]
            );

            $chat->touch();

            return $msg;
        });

        // 5. Broadcast in real time
        try {
            broadcast(new MessageSent($message))->toOthers();
        } catch (\Throwable $e) {
            report($e);
        }

        $responseData = [
            'id' => $message->id,
            'chat_id' => $message->chat_id,
            'conversation_id' => $message->chat_id,
            'sender_id' => $message->sender_id,
            'type' => $message->type,
            'body' => $message->body,
            'attachment_path' => $message->attachment_path,
            'attachment_name' => $message->attachment_name,
            'attachment_type' => $message->attachment_type,
            'attachment_size' => $message->attachment_size,
            'is_deleted' => false,
            'created_at' => $message->created_at->toISOString(),
            'sender' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
        ];

        if ($request->wantsJson() || $request->expectsJson() || $request->ajax() || $request->header('X-Requested-With') === 'XMLHttpRequest') {
            return response()->json($responseData);
        }

        return redirect()->route('messages.index', ['projectId' => $chat->project_id]);
    }

    /**
     * Mark messages in a chat as read.
     * Enforces server time and strictly advances forward (never moves backward).
     */
    public function markAsRead(Request $request, $chat): JsonResponse
    {
        $user = $request->user();
        $chat = $this->resolveChat($chat);

        if (! $chat->hasActiveMember($user->id)) {
            abort(403, 'You are not a member of this project.');
        }

        $validated = $request->validate([
            'last_read_message_id' => ['nullable', 'integer'],
        ]);

        $readState = ChatReadState::firstOrCreate(
            ['chat_id' => $chat->id, 'user_id' => $user->id]
        );

        $newMsgId = $validated['last_read_message_id'] ?? null;
        $currentMsgId = $readState->last_read_message_id;

        // Never move receipt backward
        $shouldUpdateMsgId = $newMsgId && (! $currentMsgId || $newMsgId > $currentMsgId);
        $readAt = now();

        $updateData = ['read_at' => $readAt];
        if ($shouldUpdateMsgId) {
            $updateData['last_read_message_id'] = $newMsgId;
        }

        $readState->update($updateData);

        // Broadcast to other participants
        try {
            broadcast(new MessagesRead(
                chatId: $chat->id,
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
            'last_read_message_id' => $readState->fresh()->last_read_message_id,
            'read_at' => $readState->fresh()->read_at?->toISOString(),
        ]);
    }

    /**
     * Soft delete a message.
     * Enforces server-side permissions: Sender OR Project Leader only.
     */
    public function destroyMessage(Request $request, $chat, Message $message): JsonResponse
    {
        $user = $request->user();
        $chat = $this->resolveChat($chat);

        if (! $chat->hasActiveMember($user->id)) {
            abort(403, 'You are not a member of this project.');
        }

        if ((int) $message->chat_id !== (int) $chat->id) {
            abort(404, 'Message does not belong to this chat.');
        }

        // Permission: Sender OR Project Leader
        $isSender = (int) $message->sender_id === (int) $user->id;
        $isLeader = $chat->isLeader($user->id);

        if (! $isSender && ! $isLeader) {
            abort(403, 'You do not have permission to delete this message.');
        }

        // Soft delete message (task stays intact if message contained task card)
        $message->delete();

        // Broadcast MessageDeleted
        try {
            broadcast(new MessageDeleted($chat->id, $message->id))->toOthers();
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json([
            'success' => true,
            'message_id' => $message->id,
        ]);
    }

    /**
     * Restore a soft-deleted message within the 5-second Undo flow.
     */
    public function restoreMessage(Request $request, $chat, int $messageId): JsonResponse
    {
        $user = $request->user();
        $chat = $this->resolveChat($chat);

        if (! $chat->hasActiveMember($user->id)) {
            abort(403, 'You are not a member of this project.');
        }

        $message = $chat->messages()->withTrashed()->findOrFail($messageId);

        $isSender = (int) $message->sender_id === (int) $user->id;
        $isLeader = $chat->isLeader($user->id);

        if (! $isSender && ! $isLeader) {
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
     * Modal opens first -> fills fields -> "Create task and send" -> atomic commit.
     */
    public function createTask(Request $request, $chat): JsonResponse
    {
        $user = $request->user();
        $chat = $this->resolveChat($chat);

        // 1. Authorize member
        if (! $chat->hasActiveMember($user->id)) {
            abort(403, 'You are not a member of this project.');
        }

        if ($chat->isArchived()) {
            abort(403, 'This project is archived. Cannot create tasks.');
        }

        // 2. Validate input
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:5000'],
            'assignee_ids' => ['required', 'array', 'min:1'],
            'assignee_ids.*' => ['integer', 'exists:users,id'],
            'due_date' => ['required', 'date'],
            'priority' => ['required', 'string', 'in:Low,Medium,High'],
            'idempotency_key' => ['nullable', 'string', 'max:64'],
        ]);

        // 3. Idempotency check
        $idempotencyKey = $validated['idempotency_key'] ?? null;
        if ($idempotencyKey) {
            $cacheKey = "task_create_idem_{$idempotencyKey}_{$user->id}";
            if (Cache::has($cacheKey)) {
                return response()->json(['message' => 'This task was already submitted.'], 409);
            }
        }

        $project = $chat->project;
        if (! $project) {
            return response()->json(['message' => 'Project not found.'], 404);
        }

        // 4. Timezone-aware date validation: no past dates
        $dueDate = Carbon::parse($validated['due_date']);
        if ($dueDate->endOfDay()->isPast()) {
            return response()->json(['message' => 'Choose a date that is today or later.'], 422);
        }

        // 5. Validate all assignees belong to this project
        $assigneeIds = array_values(array_unique($validated['assignee_ids']));
        $projectMemberIds = $project->roleAssignments()->pluck('user_id')->push($project->created_by)->unique();

        foreach ($assigneeIds as $assigneeId) {
            if (! $projectMemberIds->contains($assigneeId)) {
                return response()->json(['message' => 'One or more assignees are not members of this project.'], 422);
            }
        }

        // 6. Atomic DB Transaction: Task -> Assignments -> Chat Message -> Notifications
        try {
            $result = DB::transaction(function () use ($chat, $project, $user, $validated, $assigneeIds, $dueDate) {
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

                // 6a. Create Task
                $task = Task::create([
                    'activity_id' => $activity->id,
                    'assigned_to' => $assigneeIds[0],
                    'title' => $validated['title'],
                    'description' => $validated['description'] ?? null,
                    'due_date' => $dueDate->toDateString(),
                    'priority' => $validated['priority'],
                    'status' => Task::STATUS_TO_DO,
                    'requires_review' => false,
                ]);

                // 6b. Create task_assignees records for all assignees
                foreach ($assigneeIds as $uid) {
                    DB::table('task_assignees')->updateOrInsert(
                        ['task_id' => $task->id, 'user_id' => $uid],
                        ['created_at' => now(), 'updated_at' => now()]
                    );
                }

                $assignees = User::whereIn('id', $assigneeIds)->get(['id', 'name', 'email']);

                // 6c. Create Chat Message containing task payload
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

                $message = $chat->messages()->create([
                    'sender_id' => $user->id,
                    'type' => Message::TYPE_TASK,
                    'task_id' => $task->id,
                    'body' => '[task:' . json_encode($taskPayload) . ']',
                ]);

                // Advance sender's read marker
                ChatReadState::updateOrCreate(
                    ['chat_id' => $chat->id, 'user_id' => $user->id],
                    ['last_read_message_id' => $message->id, 'read_at' => now()]
                );

                $chat->touch();

                // 6d. Notifications for assignees (exclude self)
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

            if ($idempotencyKey) {
                Cache::put("task_create_idem_{$idempotencyKey}_{$user->id}", true, now()->addHour());
            }

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
                    'chat_id' => $result['message']->chat_id,
                    'conversation_id' => $result['message']->chat_id,
                    'sender_id' => $result['message']->sender_id,
                    'type' => $result['message']->type,
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
     * Toggle pin status for the chat for current user.
     */
    public function togglePin(Request $request, $chat): JsonResponse
    {
        $user = $request->user();
        $chat = $this->resolveChat($chat);

        if (! $chat->hasActiveMember($user->id)) {
            abort(403, 'You are not a member of this project.');
        }

        $pref = ChatUserPreference::firstOrCreate(
            ['chat_id' => $chat->id, 'user_id' => $user->id]
        );

        $newPinned = ! $pref->is_pinned;
        $pref->update(['is_pinned' => $newPinned]);

        return response()->json([
            'success' => true,
            'is_pinned' => $newPinned,
        ]);
    }

    /**
     * Toggle mute status for the chat for current user.
     */
    public function toggleMute(Request $request, $chat): JsonResponse
    {
        $user = $request->user();
        $chat = $this->resolveChat($chat);

        if (! $chat->hasActiveMember($user->id)) {
            abort(403, 'You are not a member of this project.');
        }

        $pref = ChatUserPreference::firstOrCreate(
            ['chat_id' => $chat->id, 'user_id' => $user->id]
        );

        $newMuted = ! $pref->is_muted;
        $pref->update(['is_muted' => $newMuted]);

        return response()->json([
            'success' => true,
            'is_muted' => $newMuted,
        ]);
    }

    /**
     * Securely download a chat attachment.
     * Prevents downloading deleted message attachments or cross-project leaks.
     */
    public function downloadAttachment(Request $request, Message $message): StreamedResponse
    {
        $user = $request->user();

        if ($message->trashed()) {
            abort(404, 'Attachment is no longer accessible because the message was deleted.');
        }

        if (! $message->chat || ! $message->chat->hasActiveMember($user->id)) {
            abort(403, 'Unauthorized access to chat attachment.');
        }

        if (! $message->attachment_path || ! Storage::disk('local')->exists($message->attachment_path)) {
            abort(404, 'Attachment file not found.');
        }

        return Storage::disk('local')->download($message->attachment_path, $message->attachment_name ?? 'attachment');
    }
}
