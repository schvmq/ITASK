import React, { useState, useEffect, useRef } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { AppLayout } from '@/Layouts/AppLayout';
import { useEcho, useConnectionStatus } from '@laravel/echo-react';
import {
    MessageSquare,
    Search,
    Send,
    Paperclip,
    X,
    FileText,
    Download,
    Users,
    User as UserIcon,
    FolderKanban,
    Plus,
    CheckCheck,
    Wifi,
    WifiOff,
    Clock,
    ArrowLeft,
    Loader2,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/Components/ui/avatar';
import { Badge } from '@/Components/Badge';
import { Button } from '@/Components/ui/button';

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface Participant {
    id: number;
    name: string;
    email: string;
}

interface MessageSender {
    id: number;
    name: string;
    email: string;
}

interface MessageItem {
    id: number;
    conversation_id: number;
    sender_id: number;
    body: string;
    attachment_path?: string | null;
    attachment_name?: string | null;
    attachment_type?: string | null;
    attachment_size?: number | null;
    created_at: string;
    sender: MessageSender;
}

interface ConversationItem {
    id: number;
    type: 'direct' | 'project' | 'committee';
    title: string;
    project_id?: number | null;
    committee_id?: number | null;
    other_user?: Participant | null;
    latest_message?: {
        id: number;
        body: string;
        attachment_name?: string | null;
        created_at: string;
        sender_name: string;
    } | null;
    unread_count: number;
    updated_at: string;
}

interface ActiveConversation {
    id: number;
    type: 'direct' | 'project' | 'committee';
    title: string;
    other_user?: Participant | null;
    participants: Participant[];
}

interface AvailableUser {
    id: number;
    name: string;
    email: string;
}

interface ChatPageProps {
    conversations: ConversationItem[];
    activeConversation?: ActiveConversation | null;
    messages: MessageItem[];
    availableUsers: AvailableUser[];
    authUserId: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join('');
}

function formatMessageTime(isoString: string): string {
    try {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
}

function formatRelativeTime(isoString: string): string {
    try {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
        return '';
    }
}

function formatBytes(bytes?: number | null): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ChatIndex({
    conversations: initialConversations,
    activeConversation,
    messages: initialMessages,
    availableUsers,
    authUserId,
}: ChatPageProps) {
    const [conversations, setConversations] = useState<ConversationItem[]>(initialConversations);
    const [messages, setMessages] = useState<MessageItem[]>(initialMessages);
    const [messageText, setMessageText] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [isStartingChat, setIsStartingChat] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTab, setFilterTab] = useState<'all' | 'direct' | 'teams'>('all');
    const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [showMobileChat, setShowMobileChat] = useState(Boolean(activeConversation));

    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const connectionStatus = useConnectionStatus();
    const page = usePage<any>();
    const currentUserId = authUserId ?? page.props.auth?.user?.id;

    // Sync state when props change
    useEffect(() => {
        setConversations(initialConversations);
    }, [initialConversations]);

    useEffect(() => {
        setMessages(initialMessages);
        if (activeConversation) {
            setShowMobileChat(true);
        }
    }, [initialMessages, activeConversation?.id]);

    // Auto-scroll on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // WebSocket real-time listener for current active conversation
    useEcho<MessageItem>(
        activeConversation ? `chat.${activeConversation.id}` : 'chat.0',
        ['.MessageSent', 'MessageSent'],
        (incomingMessage) => {
            if (activeConversation && incomingMessage.conversation_id === activeConversation.id) {
                setMessages((prev) => {
                    if (prev.some((m) => m.id === incomingMessage.id)) return prev;
                    return [...prev, incomingMessage];
                });

                // Update latest message in conversation list
                setConversations((prev) =>
                    prev.map((c) =>
                        c.id === incomingMessage.conversation_id
                            ? {
                                  ...c,
                                  latest_message: {
                                      id: incomingMessage.id,
                                      body: incomingMessage.body,
                                      attachment_name: incomingMessage.attachment_name,
                                      created_at: incomingMessage.created_at,
                                      sender_name: incomingMessage.sender?.name ?? 'Someone',
                                  },
                                  updated_at: incomingMessage.created_at,
                              }
                            : c
                    )
                );
            }
        },
        [activeConversation?.id]
    );

    // Fallback polling: if WebSocket is not connected or in development, poll every 4s so chat never stalls
    useEffect(() => {
        if (!activeConversation) return;
        if (connectionStatus !== 'connected') {
            const interval = setInterval(() => {
                router.reload({
                    only: ['messages', 'conversations'],
                });
            }, 4000);
            return () => clearInterval(interval);
        }
    }, [activeConversation?.id, connectionStatus]);

    // Filter conversations
    const filteredConversations = conversations.filter((conv) => {
        const matchesSearch =
            conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (conv.latest_message?.body &&
                conv.latest_message.body.toLowerCase().includes(searchQuery.toLowerCase()));

        if (!matchesSearch) return false;
        if (filterTab === 'direct') return conv.type === 'direct';
        if (filterTab === 'teams') return conv.type === 'project' || conv.type === 'committee';
        return true;
    });

    // Filter users in "New Chat" modal
    const filteredUsers = availableUsers.filter(
        (u) =>
            u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
            u.email.toLowerCase().includes(userSearchTerm.toLowerCase())
    );

    // Switch conversation
    const handleSelectConversation = (convId: number) => {
        router.visit(`/chat?conversation=${convId}`, {
            preserveState: false,
            preserveScroll: true,
        });
        setShowMobileChat(true);
    };

    // Start direct message with user
    const handleStartDirectChat = (userId: number) => {
        setIsStartingChat(userId);
        router.post(
            `/chat/direct/${userId}`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIsNewChatModalOpen(false);
                    setIsStartingChat(null);
                },
                onError: (errors) => {
                    console.error('Error starting direct chat:', errors);
                    setIsStartingChat(null);
                },
            }
        );
    };

    // Send message handler
    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeConversation) return;
        if (!messageText.trim() && !selectedFile) return;

        setIsSending(true);

        const formData = new FormData();
        if (messageText.trim()) {
            formData.append('body', messageText.trim());
        }
        if (selectedFile) {
            formData.append('file', selectedFile);
        }

        router.post(`/chat/${activeConversation.id}/messages`, formData, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                setMessageText('');
                setSelectedFile(null);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            },
            onError: (err) => {
                console.error('Failed to send message:', err);
            },
            onFinish: () => {
                setIsSending(false);
            },
        });
    };

    // Keyboard shortcut (Enter to send, Shift+Enter for new line)
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage(e);
        }
    };

    return (
        <AppLayout
            title="Messages"
            subtitle="Direct messaging and project collaboration"
            hidePageHeadingBanner={true}
        >
            <Head title="Messages - iTasks" />

            <div className="flex h-[calc(100vh-4.25rem)] overflow-hidden bg-slate-50 dark:bg-slate-950">
                {/* ─── Left Sidebar: Conversations List ────────────────────────── */}
                <div
                    className={`w-full md:w-80 lg:w-96 flex-shrink-0 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-200 ${
                        showMobileChat ? 'hidden md:flex' : 'flex'
                    }`}
                >
                    {/* Header */}
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                                    <MessageSquare className="w-5 h-5" />
                                </div>
                                <div>
                                    <h1 className="text-base font-semibold text-slate-900 dark:text-white">
                                        Messages
                                    </h1>
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                        <span
                                            className={`inline-block w-2 h-2 rounded-full ${
                                                connectionStatus === 'connected'
                                                    ? 'bg-emerald-500 animate-pulse'
                                                    : connectionStatus === 'connecting'
                                                    ? 'bg-amber-500 animate-pulse'
                                                    : 'bg-emerald-500'
                                            }`}
                                        />
                                        <span>
                                            {connectionStatus === 'connected'
                                                ? 'Live Connected'
                                                : connectionStatus === 'connecting'
                                                ? 'Connecting...'
                                                : 'Active (Auto-sync)'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setIsNewChatModalOpen(true)}
                                className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                New Chat
                            </Button>
                        </div>

                        {/* Search Bar */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search conversations..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-800 border-transparent rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                            />
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex items-center gap-1 mt-3 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium">
                            <button
                                type="button"
                                onClick={() => setFilterTab('all')}
                                className={`flex-1 py-1 rounded-md transition-all ${
                                    filterTab === 'all'
                                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                }`}
                            >
                                All
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterTab('direct')}
                                className={`flex-1 py-1 rounded-md transition-all ${
                                    filterTab === 'direct'
                                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                }`}
                            >
                                Direct
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterTab('teams')}
                                className={`flex-1 py-1 rounded-md transition-all ${
                                    filterTab === 'teams'
                                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                }`}
                            >
                                Channels
                            </button>
                        </div>
                    </div>

                    {/* Conversations List */}
                    <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                        {filteredConversations.length === 0 ? (
                            <div className="p-8 text-center text-slate-400">
                                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    No conversations found
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                    Start a new direct chat with a teammate.
                                </p>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setIsNewChatModalOpen(true)}
                                    className="mt-4 text-xs"
                                >
                                    Start Chat
                                </Button>
                            </div>
                        ) : (
                            filteredConversations.map((conv) => {
                                const isActive = activeConversation?.id === conv.id;
                                return (
                                    <button
                                        key={conv.id}
                                        type="button"
                                        onClick={() => handleSelectConversation(conv.id)}
                                        className={`w-full text-left p-3.5 flex items-start gap-3 transition-colors relative ${
                                            isActive
                                                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-l-4 border-emerald-600'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                        }`}
                                    >
                                        <div className="relative flex-shrink-0">
                                            <Avatar className="w-10 h-10 border border-slate-200 dark:border-slate-700">
                                                <AvatarFallback className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-xs font-semibold">
                                                    {conv.type === 'direct' ? (
                                                        getInitials(conv.title)
                                                    ) : (
                                                        <FolderKanban className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                                    )}
                                                </AvatarFallback>
                                            </Avatar>
                                            {conv.type === 'direct' && (
                                                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                                    {conv.title}
                                                </span>
                                                <span className="text-[11px] text-slate-400 flex-shrink-0 ml-2">
                                                    {formatRelativeTime(conv.updated_at)}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                                    {conv.latest_message ? (
                                                        conv.latest_message.attachment_name ? (
                                                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                                                <Paperclip className="w-3 h-3" />
                                                                {conv.latest_message.attachment_name}
                                                            </span>
                                                        ) : (
                                                            conv.latest_message.body
                                                        )
                                                    ) : (
                                                        <span className="italic text-slate-400">No messages yet</span>
                                                    )}
                                                </p>

                                                {conv.unread_count > 0 && (
                                                    <span className="inline-flex items-center justify-center min-w-4 h-4 px-1.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                                                        {conv.unread_count}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* ─── Right Pane: Active Chat Window ──────────────────────────── */}
                <div
                    className={`flex-1 flex flex-col bg-white dark:bg-slate-900 transition-all ${
                        !showMobileChat ? 'hidden md:flex' : 'flex'
                    }`}
                >
                    {activeConversation ? (
                        <>
                            {/* Chat Header */}
                            <div className="h-16 px-4 md:px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs">
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowMobileChat(false)}
                                        className="md:hidden p-1.5 -ml-1 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                                    >
                                        <ArrowLeft className="w-5 h-5" />
                                    </button>

                                    <Avatar className="w-10 h-10 border border-slate-200 dark:border-slate-700">
                                        <AvatarFallback className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-xs font-semibold">
                                            {activeConversation.type === 'direct' ? (
                                                getInitials(activeConversation.title)
                                            ) : (
                                                <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                            )}
                                        </AvatarFallback>
                                    </Avatar>

                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-sm md:text-base font-semibold text-slate-900 dark:text-white">
                                                {activeConversation.title}
                                            </h2>
                                            <Badge
                                                variant="neutral"
                                                className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 border-slate-300 dark:border-slate-700"
                                            >
                                                {activeConversation.type}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {activeConversation.type === 'direct'
                                                ? activeConversation.other_user?.email || 'Active direct message'
                                                : `${activeConversation.participants.length} team members`}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span
                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                                            connectionStatus === 'connected'
                                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                        }`}
                                    >
                                        {connectionStatus === 'connected' ? (
                                            <>
                                                <Wifi className="w-3 h-3 text-emerald-500" />
                                                Live
                                            </>
                                        ) : (
                                            <>
                                                <CheckCheck className="w-3 h-3 text-emerald-500" />
                                                Active
                                            </>
                                        )}
                                    </span>
                                </div>
                            </div>

                            {/* Messages Stream */}
                            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-slate-50/50 dark:bg-slate-950/40">
                                {messages.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-8">
                                        <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mb-3">
                                            <MessageSquare className="w-6 h-6" />
                                        </div>
                                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                                            No messages yet
                                        </h3>
                                        <p className="text-xs text-slate-500 max-w-sm mt-1">
                                            Send a message below to start collaborating with {activeConversation.title}.
                                        </p>
                                    </div>
                                ) : (
                                    messages.map((msg, index) => {
                                        const isMine = Number(msg.sender_id) === Number(currentUserId);
                                        const showDateHeader =
                                            index === 0 ||
                                            new Date(msg.created_at).toDateString() !==
                                                new Date(messages[index - 1].created_at).toDateString();

                                        return (
                                            <React.Fragment key={msg.id}>
                                                {showDateHeader && (
                                                    <div className="flex justify-center my-4">
                                                        <span className="px-3 py-1 bg-slate-200/80 dark:bg-slate-800 rounded-full text-[11px] font-medium text-slate-600 dark:text-slate-400 shadow-2xs">
                                                            {new Date(msg.created_at).toLocaleDateString([], {
                                                                weekday: 'short',
                                                                month: 'short',
                                                                day: 'numeric',
                                                            })}
                                                        </span>
                                                    </div>
                                                )}

                                                <div
                                                    className={`flex flex-col ${
                                                        isMine ? 'items-end' : 'items-start'
                                                    }`}
                                                >
                                                    {!isMine && (
                                                        <span className="text-[11px] font-medium text-slate-500 mb-1 ml-1">
                                                            {msg.sender?.name}
                                                        </span>
                                                    )}

                                                    <div
                                                        className={`max-w-[85%] md:max-w-md lg:max-w-lg rounded-2xl p-3.5 shadow-xs ${
                                                            isMine
                                                                ? 'bg-emerald-600 text-white rounded-br-xs'
                                                                : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/60 rounded-bl-xs'
                                                        }`}
                                                    >
                                                        {/* Text Body */}
                                                        {msg.body && (
                                                            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                                                                {msg.body}
                                                            </p>
                                                        )}

                                                        {/* Attachment Card */}
                                                        {msg.attachment_path && (
                                                            <div
                                                                className={`mt-2 p-2.5 rounded-lg flex items-center justify-between gap-3 border ${
                                                                    isMine
                                                                        ? 'bg-emerald-700/60 border-emerald-500/40 text-white'
                                                                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <div className="p-1.5 rounded-md bg-white/20 dark:bg-white/10 flex-shrink-0">
                                                                        <FileText className="w-4 h-4" />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="text-xs font-medium truncate">
                                                                            {msg.attachment_name ?? 'Attachment'}
                                                                        </p>
                                                                        <p
                                                                            className={`text-[10px] ${
                                                                                isMine
                                                                                    ? 'text-emerald-100'
                                                                                    : 'text-slate-400'
                                                                            }`}
                                                                        >
                                                                            {formatBytes(msg.attachment_size)}
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                <a
                                                                    href={`/chat/attachments/${msg.id}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className={`p-1.5 rounded-md transition-colors ${
                                                                        isMine
                                                                            ? 'hover:bg-emerald-600 text-white'
                                                                            : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                                                                    }`}
                                                                    title="Download Attachment"
                                                                >
                                                                    <Download className="w-4 h-4" />
                                                                </a>
                                                            </div>
                                                        )}

                                                        {/* Timestamp & Read Indicator */}
                                                        <div
                                                            className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                                                                isMine ? 'text-emerald-100' : 'text-slate-400'
                                                            }`}
                                                        >
                                                            <span>{formatMessageTime(msg.created_at)}</span>
                                                            {isMine && <CheckCheck className="w-3 h-3 text-emerald-200" />}
                                                        </div>
                                                    </div>
                                                </div>
                                            </React.Fragment>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Message Composer */}
                            <div className="p-3 md:p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                                {selectedFile && (
                                    <div className="mb-2 p-2 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Paperclip className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                            <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                                {selectedFile.name}
                                            </span>
                                            <span className="text-slate-400">({formatBytes(selectedFile.size)})</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedFile(null)}
                                            className="p-1 text-slate-400 hover:text-rose-500 rounded-md transition-colors"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}

                                <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) {
                                                setSelectedFile(e.target.files[0]);
                                            }
                                        }}
                                        className="hidden"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-2.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
                                        title="Attach file"
                                    >
                                        <Paperclip className="w-5 h-5" />
                                    </button>

                                    <div className="flex-1 relative">
                                        <textarea
                                            rows={1}
                                            placeholder="Write your message... (Enter to send, Shift+Enter for newline)"
                                            value={messageText}
                                            onChange={(e) => setMessageText(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            className="w-full resize-none max-h-32 px-4 py-2.5 text-sm bg-slate-100 dark:bg-slate-800 border-transparent rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                        />
                                    </div>

                                    <Button
                                        type="submit"
                                        disabled={isSending || (!messageText.trim() && !selectedFile)}
                                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-all flex-shrink-0"
                                    >
                                        {isSending ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Send className="w-4 h-4" />
                                        )}
                                        <span className="hidden sm:inline">Send</span>
                                    </Button>
                                </form>
                            </div>
                        </>
                    ) : (
                        /* Empty State: No active conversation */
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/40 dark:bg-slate-950/40">
                            <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 shadow-xs">
                                <MessageSquare className="w-8 h-8" />
                            </div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                Select a Conversation
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mt-1.5 leading-relaxed">
                                Choose an ongoing conversation from the sidebar or start a new direct message to collaborate with your project team.
                            </p>
                            <Button
                                onClick={() => setIsNewChatModalOpen(true)}
                                className="mt-5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Start New Message
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Modal: New Chat / Direct Message ────────────────────────── */}
            {isNewChatModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <UserIcon className="w-5 h-5 text-emerald-600" />
                                <h3 className="font-semibold text-slate-900 dark:text-white">
                                    New Direct Message
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsNewChatModalOpen(false)}
                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4">
                            <div className="relative mb-3">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search by name or email..."
                                    value={userSearchTerm}
                                    onChange={(e) => setUserSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 border-transparent rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                />
                            </div>

                            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 -mx-4 px-4">
                                {filteredUsers.length === 0 ? (
                                    <p className="py-6 text-center text-xs text-slate-400">
                                        No team members found matching "{userSearchTerm}".
                                    </p>
                                ) : (
                                    filteredUsers.map((u) => (
                                        <button
                                            key={u.id}
                                            type="button"
                                            disabled={isStartingChat === u.id}
                                            onClick={() => handleStartDirectChat(u.id)}
                                            className="w-full py-2.5 px-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors text-left disabled:opacity-50"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Avatar className="w-9 h-9">
                                                    <AvatarFallback className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-xs font-semibold">
                                                        {getInitials(u.name)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                                                        {u.name}
                                                    </p>
                                                    <p className="text-xs text-slate-400">{u.email}</p>
                                                </div>
                                            </div>
                                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                                                {isStartingChat === u.id ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    'Chat'
                                                )}
                                            </span>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
