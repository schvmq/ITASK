<?php

namespace App\Http\Controllers;

use App\Events\MessageSent;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ChatController extends Controller
{
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
                'latestMessage.sender:id,name',
                'users:id,name,email',
                'project:id,title',
                'committee:id,name',
            ])
            ->get()
            ->map(function (Conversation $conv) use ($user) {
                $participant = $conv->participants->firstWhere('user_id', $user->id);
                $lastReadAt = $participant?->last_read_at;

                $unreadCount = $conv->messages()
                    ->where('sender_id', '!=', $user->id)
                    ->when($lastReadAt, function ($query, $lastReadAt) {
                        return $query->where('created_at', '>', $lastReadAt);
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

                return [
                    'id' => $conv->id,
                    'type' => $conv->type,
                    'title' => $title,
                    'project_id' => $conv->project_id,
                    'committee_id' => $conv->committee_id,
                    'other_user' => $otherUser ? [
                        'id' => $otherUser->id,
                        'name' => $otherUser->name,
                        'email' => $otherUser->email,
                    ] : null,
                    'latest_message' => $conv->latestMessage ? [
                        'id' => $conv->latestMessage->id,
                        'body' => $conv->latestMessage->body,
                        'attachment_name' => $conv->latestMessage->attachment_name,
                        'created_at' => $conv->latestMessage->created_at->toISOString(),
                        'sender_name' => $conv->latestMessage->sender?->name ?? 'Unknown',
                    ] : null,
                    'unread_count' => $unreadCount,
                    'updated_at' => $conv->latestMessage?->created_at?->toISOString() ?? $conv->updated_at->toISOString(),
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
                ->with(['users:id,name,email', 'project:id,title', 'committee:id,name'])
                ->first();

            if ($selected) {
                // Mark conversation as read for current user
                $selected->participants()
                    ->where('user_id', $user->id)
                    ->update(['last_read_at' => now()]);

                // Load messages
                $messages = $selected->messages()
                    ->with('sender:id,name,email')
                    ->orderBy('created_at', 'asc')
                    ->take(100)
                    ->get()
                    ->map(fn (Message $m) => [
                        'id' => $m->id,
                        'conversation_id' => $m->conversation_id,
                        'sender_id' => $m->sender_id,
                        'body' => $m->body,
                        'attachment_path' => $m->attachment_path,
                        'attachment_name' => $m->attachment_name,
                        'attachment_type' => $m->attachment_type,
                        'attachment_size' => $m->attachment_size,
                        'created_at' => $m->created_at->toISOString(),
                        'sender' => [
                            'id' => $m->sender->id,
                            'name' => $m->sender->name,
                            'email' => $m->sender->email,
                        ],
                    ]);

                $otherUser = $selected->type === 'direct'
                    ? $selected->users->firstWhere('id', '!=', $user->id)
                    : null;

                $activeConversation = [
                    'id' => $selected->id,
                    'type' => $selected->type,
                    'title' => match ($selected->type) {
                        'direct' => $otherUser?->name ?? 'Direct Message',
                        'project' => $selected->project ? $selected->project->title : ($selected->title ?? 'Project Channel'),
                        'committee' => $selected->committee ? $selected->committee->name : ($selected->title ?? 'Committee Channel'),
                        default => $selected->title ?? 'Conversation',
                    },
                    'other_user' => $otherUser ? [
                        'id' => $otherUser->id,
                        'name' => $otherUser->name,
                        'email' => $otherUser->email,
                    ] : null,
                    'participants' => $selected->users->map(fn ($u) => [
                        'id' => $u->id,
                        'name' => $u->name,
                        'email' => $u->email,
                    ]),
                ];
            }
        }

        // 3. Fetch potential direct chat partners (users with accounts)
        $availableUsers = User::query()
            ->where('id', '!=', $user->id)
            ->select('id', 'name', 'email')
            ->orderBy('name')
            ->get();

        return Inertia::render('Chat/Index', [
            'conversations' => $conversations,
            'activeConversation' => $activeConversation,
            'messages' => $messages,
            'availableUsers' => $availableUsers,
            'authUserId' => $user->id,
        ]);
    }

    /**
     * Send a new message in the conversation.
     */
    public function store(Request $request, Conversation $conversation): RedirectResponse
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

            // Mark conversation as read for the sender
            $conversation->participants()
                ->where('user_id', $user->id)
                ->update(['last_read_at' => now()]);

            $conversation->touch();

            return $msg;
        });

        // 4. Broadcast event in real time to other participants (graceful if Reverb server is offline)
        try {
            broadcast(new MessageSent($message))->toOthers();
        } catch (\Throwable $e) {
            report($e);
        }

        return redirect()->route('chat.index', ['conversation' => $conversation->id]);
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
     * Mark a conversation as read.
     */
    public function markAsRead(Request $request, Conversation $conversation): RedirectResponse
    {
        $user = $request->user();

        $conversation->participants()
            ->where('user_id', $user->id)
            ->update(['last_read_at' => now()]);

        return back();
    }

    /**
     * Securely download a chat attachment.
     */
    public function downloadAttachment(Request $request, Message $message): StreamedResponse
    {
        $user = $request->user();

        if (! $message->conversation->hasParticipant($user->id)) {
            abort(403, 'Unauthorized access to chat attachment.');
        }

        if (! $message->attachment_path || ! Storage::disk('local')->exists($message->attachment_path)) {
            abort(404, 'Attachment file not found.');
        }

        return Storage::disk('local')->download($message->attachment_path, $message->attachment_name ?? 'attachment');
    }
}
