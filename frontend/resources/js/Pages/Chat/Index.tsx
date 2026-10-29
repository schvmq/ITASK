import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import { Head, router, usePage, Link } from '@inertiajs/react';
import { AppLayout } from '@/Layouts/AppLayout';
import { useEcho, useConnectionStatus, echo } from '@laravel/echo-react';
import {
    MessageSquare,
    Search,
    Send,
    Paperclip,
    Smile,
    X,
    FileText,
    Download,
    Users,
    FolderOpen,
    Check,
    Pin,
    ArrowLeft,
    CheckSquare,
    Calendar,
    ChevronDown,
    ChevronRight,
    AlertCircle,
    ArrowDown,
    MoreVertical,
    Trash2,
    RotateCcw,
    ExternalLink,
    Sparkles,
    VolumeX,
    Volume2,
    Shield,
    Archive,
    Lock,
    UserCheck,
    Plus,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/Components/ui/avatar';
import { Button } from '@/Components/Button';
import { Badge } from '@/Components/Badge';
import {
    formatConversationTime,
    formatReadReceiptTime,
    formatFullTooltipDateTime,
} from '@/Components/Chat/formatters';
import { ReadReceiptPopover } from '@/Components/Chat/ReadReceiptPopover';
import { DeleteMessageModal } from '@/Components/Chat/DeleteMessageModal';
import { UndoToast } from '@/Components/Chat/UndoToast';
import { CreateTaskModal } from '@/Components/Chat/CreateTaskModal';
import './messaging.css';

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface Participant {
    id: number;
    name: string;
    email: string;
    role?: string;
    is_online?: boolean;
    last_read_message_id?: number | null;
    last_read_at?: string | null;
}

interface MessageSender {
    id: number;
    name: string;
    email: string;
}

interface TaskAssignee {
    id: number;
    name: string;
}

interface SharedTaskData {
    id?: number;
    title: string;
    description?: string | null;
    due_date?: string | null;
    priority?: string;
    status: string;
    assignees?: TaskAssignee[];
    action_url?: string | null;
    is_unavailable?: boolean;
}

interface MessageItem {
    id: number;
    chat_id: number;
    conversation_id?: number;
    sender_id?: number | null;
    type?: 'text' | 'task' | 'system' | 'file';
    body: string;
    is_deleted?: boolean;
    task_id?: number | null;
    task?: SharedTaskData | null;
    attachment_path?: string | null;
    attachment_name?: string | null;
    attachment_type?: string | null;
    attachment_size?: number | null;
    created_at: string;
    sender?: MessageSender | null;
    isJustCreatedTask?: boolean;
}

interface ChatItem {
    id: number;
    chat_id: number;
    conversation_id?: number;
    project_id: number;
    title: string;
    name: string;
    type: 'project';
    is_archived: boolean;
    is_pinned: boolean;
    is_muted: boolean;
    member_count: number;
    unread_count: number;
    preview: string;
    preview_time?: string | null;
    updated_at: string;
}

interface ProjectInfo {
    id: string;
    title: string;
    progress: number;
    total_tasks?: number;
    completed_tasks?: number;
}

interface SharedFileItem {
    id: number;
    name: string;
    type?: string | null;
    size?: number | null;
    download_url: string;
    created_at: string;
}

interface PinnedTaskItem {
    id: string;
    title: string;
    status: string;
    priority?: string;
    due_date_formatted: string;
    assignee_name: string;
    action_url: string;
}

interface ActiveChat {
    id: number;
    chat_id: number;
    conversation_id?: number;
    project_id: number;
    title: string;
    name: string;
    type: 'project';
    is_archived: boolean;
    is_pinned: boolean;
    is_muted: boolean;
    is_leader: boolean;
    project?: ProjectInfo | null;
    participants: Participant[];
    shared_files?: SharedFileItem[];
    pinned_tasks?: PinnedTaskItem[];
}

interface ChatPageProps {
    chats?: ChatItem[];
    archivedChats?: ChatItem[];
    conversations?: ChatItem[];
    activeChat?: ActiveChat | null;
    activeConversation?: ActiveChat | null;
    messages?: MessageItem[];
    projectMembers?: Array<{ id: number; name: string; email: string }>;
    authUserId?: number;
    totalUnreadCount?: number;
}

function getInitials(name?: string | null): string {
    if (!name) return 'IT';
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join('');
}

function getCsrfHeader(): Record<string, string> {
    const metaToken = typeof document !== 'undefined'
        ? (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content
        : null;
    const match = typeof document !== 'undefined'
        ? document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)
        : null;
    const xsrfCookie = match ? decodeURIComponent(match[1]) : '';

    const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    };
    if (metaToken) headers['X-CSRF-TOKEN'] = metaToken;
    if (xsrfCookie) headers['X-XSRF-TOKEN'] = xsrfCookie;
    return headers;
}

// ─── Main Chat Component ────────────────────────────────────────────────────

export default function ChatIndex({
    chats: propChats = [],
    archivedChats: propArchivedChats = [],
    conversations: propConversations = [],
    activeChat: propActiveChat,
    activeConversation: propActiveConversation,
    messages: initialMessages = [],
    projectMembers: propProjectMembers = [],
    authUserId,
    totalUnreadCount: propTotalUnread = 0,
}: ChatPageProps) {
    const page = usePage<any>();
    const currentUserId = authUserId ?? page.props.auth?.user?.id;

    // Normalize active chat and chat lists
    const activeChat = propActiveChat ?? propActiveConversation ?? null;
    const initialChats = propChats.length > 0 ? propChats : propConversations;

    const [chats, setChats] = useState<ChatItem[]>(initialChats);
    const [archivedChats, setArchivedChats] = useState<ChatItem[]>(propArchivedChats);
    const [messages, setMessages] = useState<MessageItem[]>(initialMessages);
    const [participants, setParticipants] = useState<Participant[]>(activeChat?.participants ?? []);

    // Composer State
    const [messageText, setMessageText] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);
    const [failedMessageText, setFailedMessageText] = useState<string>('');

    // Filters and Search
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTab, setFilterTab] = useState<'all' | 'unread' | 'pinned'>('all');
    const [isArchivedSectionOpen, setIsArchivedSectionOpen] = useState(false);

    // Modals & Popups
    const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
    const [taskPrefillText, setTaskPrefillText] = useState<string>('');
    const [isPinned, setIsPinned] = useState(activeChat?.is_pinned ?? false);
    const [isMuted, setIsMuted] = useState(activeChat?.is_muted ?? false);

    // Mentions (@ autocomplete)
    const [mentionFilter, setMentionFilter] = useState<string | null>(null);
    const [mentionCursorIndex, setMentionCursorIndex] = useState<number>(-1);
    const [selectedMentionIndex, setSelectedMentionIndex] = useState<number>(0);

    // Delete Message Modal & Undo Toast State
    const [messagePendingDelete, setMessagePendingDelete] = useState<MessageItem | null>(null);
    const [isDeletingMessage, setIsDeletingMessage] = useState(false);
    const [undoMessageId, setUndoMessageId] = useState<number | null>(null);
    const [openMenuMessageId, setOpenMenuMessageId] = useState<number | null>(null);
    const triggerMenuButtonRef = useRef<HTMLButtonElement | null>(null);

    // Close message action popup when clicking outside
    useEffect(() => {
        if (openMenuMessageId === null) return;
        const handleOutsideClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && !target.closest('.msg-action-menu-container')) {
                setOpenMenuMessageId(null);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [openMenuMessageId]);

    // Removed from project graceful state
    const [isAccessRevoked, setIsAccessRevoked] = useState(false);

    // One-time history notice for members
    const [showHistoryNotice, setShowHistoryNotice] = useState<boolean>(() => {
        if (!activeChat) return false;
        try {
            const dismissed = localStorage.getItem(`itask_chat_history_seen_${activeChat.id}`);
            return !dismissed;
        } catch {
            return false;
        }
    });

    // Mobile view state: show thread or list (< 820px)
    const [showMobileThread, setShowMobileThread] = useState(Boolean(activeChat));

    // Scroll state for "New messages" pill
    const [hasUnreadBelow, setHasUnreadBelow] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const messagesContainerRef = useRef<HTMLDivElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    // Track latest message ID marked as read
    const lastMarkedReadIdRef = useRef<number | null>(null);

    // Real-time typing indicators state
    const [typingUsers, setTypingUsers] = useState<Record<number, { name: string; timeout: ReturnType<typeof setTimeout> }>>({});
    const lastTypingWhisperRef = useRef<number>(0);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const currentUserName = page.props.auth?.user?.name ?? 'Someone';

    // Broadcast typing whisper + server broadcast fallback
    const sendTypingWhisper = useCallback(
        (isTyping: boolean) => {
            if (!activeChat) return;
            // 1. WebSocket Whisper
            try {
                const ch = echo().private(`chat.${activeChat.id}`);
                if (ch && typeof (ch as any).whisper === 'function') {
                    (ch as any).whisper('typing', {
                        id: currentUserId,
                        name: currentUserName,
                        is_typing: isTyping,
                    });
                }
            } catch {}

            // 2. HTTP broadcast
            axios
                .post(
                    `/chat/${activeChat.id}/typing`,
                    { is_typing: isTyping },
                    { headers: getCsrfHeader() }
                )
                .catch(() => {});
        },
        [activeChat?.id, currentUserId, currentUserName]
    );

    const connectionStatus = useConnectionStatus();

    // Sync incoming props
    useEffect(() => {
        setChats(initialChats);
    }, [initialChats]);

    useEffect(() => {
        setArchivedChats(propArchivedChats);
    }, [propArchivedChats]);

    useEffect(() => {
        setMessages(initialMessages);
        if (activeChat) {
            setParticipants(activeChat.participants ?? []);
            setIsPinned(activeChat.is_pinned ?? false);
            setIsMuted(activeChat.is_muted ?? false);
            setShowMobileThread(true);
            setIsAccessRevoked(false);

            try {
                const dismissed = localStorage.getItem(`itask_chat_history_seen_${activeChat.id}`);
                setShowHistoryNotice(!dismissed);
            } catch {
                setShowHistoryNotice(false);
            }
        }
    }, [initialMessages, activeChat?.id]);

    // Lock page scroll so only internal panes scroll
    useEffect(() => {
        const originalOverflow = document.body.style.overflow;
        const originalHeight = document.body.style.height;
        document.body.style.overflow = 'hidden';
        document.body.style.height = '100vh';

        return () => {
            document.body.style.overflow = originalOverflow;
            document.body.style.height = originalHeight;
        };
    }, []);

    // Dismiss history notice
    const handleDismissHistoryNotice = () => {
        if (!activeChat) return;
        try {
            localStorage.setItem(`itask_chat_history_seen_${activeChat.id}`, 'true');
        } catch {}
        setShowHistoryNotice(false);
    };

    // Scroll to bottom on initial load or chat switch (scoped to messages container only)
    useEffect(() => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTo({
                top: messagesContainerRef.current.scrollHeight,
                behavior: 'auto',
            });
            setHasUnreadBelow(false);
        }
    }, [activeChat?.id]);

    // Handle scroll in chat thread
    const handleScroll = () => {
        if (!messagesContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
        const distanceToBottom = scrollHeight - scrollTop - clientHeight;
        if (distanceToBottom > 120) {
            // User scrolled up
        } else {
            setHasUnreadBelow(false);
        }
    };

    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTo({
                top: messagesContainerRef.current.scrollHeight,
                behavior,
            });
        }
        setHasUnreadBelow(false);
    };

    // Mark messages as read in real-time
    const markMessageAsRead = useCallback(
        (messageId: number) => {
            if (!activeChat) return;
            if (document.visibilityState !== 'visible') return;
            if (lastMarkedReadIdRef.current !== null && lastMarkedReadIdRef.current >= messageId) return;

            lastMarkedReadIdRef.current = messageId;

            axios.post(`/chat/${activeChat.id}/read`, {
                last_read_message_id: messageId,
            }, {
                headers: getCsrfHeader(),
            })
                .then((res) => {
                    const data = res.data;
                    if (data?.success) {
                        setParticipants((prev) =>
                            prev.map((p) =>
                                p.id === currentUserId
                                    ? {
                                          ...p,
                                          last_read_message_id: data.last_read_message_id,
                                          last_read_at: data.read_at,
                                      }
                                    : p
                            )
                        );
                        // Decrement unread count locally for this chat
                        setChats((prev) =>
                            prev.map((c) =>
                                c.id === activeChat.id ? { ...c, unread_count: 0 } : c
                            )
                        );
                    }
                })
                .catch(() => {});
        },
        [activeChat?.id, currentUserId]
    );

    // Reset read marker tracker when switching active chats
    useEffect(() => {
        lastMarkedReadIdRef.current = null;
    }, [activeChat?.id]);

    // Auto-mark latest message as read when active chat is mounted or updated
    useEffect(() => {
        if (!activeChat || messages.length === 0) return;
        const latestMsg = messages[messages.length - 1];
        if (latestMsg && !latestMsg.is_deleted) {
            markMessageAsRead(latestMsg.id);
        }
    }, [activeChat?.id, messages, markMessageAsRead]);

    // Re-verify and send read receipt when tab is focused or returns to visible
    useEffect(() => {
        const handleFocusOrVisible = () => {
            if (!activeChat || messages.length === 0) return;
            if (document.visibilityState === 'visible') {
                const latestMsg = messages[messages.length - 1];
                if (latestMsg && !latestMsg.is_deleted) {
                    markMessageAsRead(latestMsg.id);
                }
            }
        };

        window.addEventListener('focus', handleFocusOrVisible);
        document.addEventListener('visibilitychange', handleFocusOrVisible);

        return () => {
            window.removeEventListener('focus', handleFocusOrVisible);
            document.removeEventListener('visibilitychange', handleFocusOrVisible);
        };
    }, [activeChat?.id, messages, markMessageAsRead]);

    // WebSocket Channel Subscriptions
    useEffect(() => {
        if (!activeChat) return;

        const ch = echo().private(`chat.${activeChat.id}`);

        // 1. Message Sent
        ch.listen('.MessageSent', (data: any) => {
            const isMine = (data.sender_id || data.sender?.id) === currentUserId;

            setMessages((prev) => {
                if (prev.some((m) => m.id === data.id)) return prev;

                const newMsg: MessageItem = {
                    id: data.id,
                    chat_id: data.chat_id || activeChat.id,
                    conversation_id: data.chat_id || activeChat.id,
                    sender_id: data.sender_id ?? data.sender?.id ?? null,
                    type: data.type || (data.sender_id === null ? 'system' : 'text'),
                    body: data.body || '',
                    task_id: data.task_id,
                    task: data.task,
                    attachment_path: data.attachment_path,
                    attachment_name: data.attachment_name,
                    attachment_type: data.attachment_type,
                    attachment_size: data.attachment_size,
                    created_at: data.created_at,
                    sender: data.sender,
                    is_deleted: false,
                };

                return [...prev, newMsg];
            });

            // Update preview in chat list
            setChats((prev) =>
                prev.map((c) => {
                    if (c.id === activeChat.id) {
                        return {
                            ...c,
                            preview: data.body || (data.attachment_name ? `Shared file: ${data.attachment_name}` : 'New message'),
                            preview_time: data.created_at,
                            updated_at: data.created_at,
                            unread_count: isMine ? 0 : c.unread_count,
                        };
                    }
                    return c;
                })
            );

            // Handle scroll vs "New messages" pill
            if (isMine) {
                setTimeout(() => scrollToBottom('smooth'), 50);
            } else {
                if (messagesContainerRef.current) {
                    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
                    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
                    if (distanceToBottom > 120) {
                        setHasUnreadBelow(true);
                    } else {
                        setTimeout(() => scrollToBottom('smooth'), 50);
                        markMessageAsRead(data.id);
                    }
                }
            }

            // Clear typing state for sender who just delivered a message
            const incomingSenderId = Number(data.sender_id || data.sender?.id);
            if (incomingSenderId) {
                setTypingUsers((prev) => {
                    if (!prev[incomingSenderId]) return prev;
                    clearTimeout(prev[incomingSenderId].timeout);
                    const updated = { ...prev };
                    delete updated[incomingSenderId];
                    return updated;
                });
            }
        });

        // 2. Read Receipts
        ch.listen('.MessagesRead', (data: any) => {
            setParticipants((prev) =>
                prev.map((p) => {
                    if (p.id === data.user_id) {
                        const currentLastRead = p.last_read_message_id ?? 0;
                        const newLastRead = data.last_read_message_id ?? currentLastRead;
                        return {
                            ...p,
                            last_read_message_id: Math.max(currentLastRead, newLastRead),
                            last_read_at: data.read_at,
                        };
                    }
                    return p;
                })
            );
        });

        // 3. Message Deleted
        ch.listen('.MessageDeleted', (data: any) => {
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === data.message_id
                        ? { ...m, is_deleted: true, body: '' }
                        : m
                )
            );
        });

        // 4. Message Restored
        ch.listen('.MessageRestored', (data: any) => {
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === data.id
                        ? {
                              ...m,
                              is_deleted: false,
                              body: data.body,
                              sender: data.sender || m.sender,
                          }
                        : m
                )
            );
        });

        // 5. User Removed from Project (graceful close per Requirement 1.2)
        ch.listen('.UserRemovedFromProject', (data: any) => {
            if (data.user_id === currentUserId) {
                setIsAccessRevoked(true);
            } else {
                setParticipants((prev) => prev.filter((p) => p.id !== data.user_id));
            }
        });

        // 6. Typing Whispers
        const handleWhisper = (data: any) => {
            if (!data) return;
            const senderId = Number(data.id ?? data.user_id);
            if (!senderId || senderId === currentUserId) return;

            const isTyping = data.is_typing !== false;
            const senderName = data.name || data.userName || 'Someone';

            setTypingUsers((prev) => {
                const next = { ...prev };
                if (next[senderId]?.timeout) {
                    clearTimeout(next[senderId].timeout);
                }

                if (isTyping) {
                    const timeout = setTimeout(() => {
                        setTypingUsers((curr) => {
                            const updated = { ...curr };
                            delete updated[senderId];
                            return updated;
                        });
                    }, 3500);

                    next[senderId] = {
                        name: senderName,
                        timeout,
                    };
                } else {
                    delete next[senderId];
                }

                return next;
            });
        };

        ch.listenForWhisper('typing', handleWhisper);
        ch.listen('.UserTyping', handleWhisper);

        return () => {
            try {
                if (typeof ch.stopListeningForWhisper === 'function') {
                    ch.stopListeningForWhisper('typing', handleWhisper);
                }
                ch.stopListening('.UserTyping');
                echo().leave(`chat.${activeChat.id}`);
            } catch {}

            setTypingUsers((prev) => {
                Object.values(prev).forEach((u) => clearTimeout(u.timeout));
                return {};
            });
        };
    }, [activeChat?.id, currentUserId, markMessageAsRead]);

    // Typing label
    const typingNames = useMemo(() => Object.values(typingUsers).map((u) => u.name), [typingUsers]);
    const typingLabel = useMemo(() => {
        if (typingNames.length === 0) return '';
        if (typingNames.length === 1) return `${typingNames[0]} is typing...`;
        if (typingNames.length === 2) return `${typingNames[0]} and ${typingNames[1]} are typing...`;
        return `${typingNames[0]} and ${typingNames.length - 1} others are typing...`;
    }, [typingNames]);

    // Resilient fallback sync if websocket disconnected or reconnecting
    useEffect(() => {
        if (!activeChat) return;
        if (connectionStatus !== 'connected') {
            const interval = setInterval(async () => {
                try {
                    const res = await axios.get(`/chat/${activeChat.id}`, {
                        headers: {
                            Accept: 'application/json',
                            ...getCsrfHeader(),
                        },
                    });
                    const data = res.data;
                    if (data?.messages) {
                        setMessages((prev) => {
                            const existingIds = new Set(prev.map((m) => m.id));
                            const toAdd = data.messages.filter((m: any) => !existingIds.has(m.id));
                            if (toAdd.length === 0) return prev;
                            return [...prev, ...toAdd];
                        });
                    }
                    if (data?.active_chat?.participants) {
                        setParticipants(data.active_chat.participants);
                    }
                    if (data?.chats) {
                        setChats(data.chats);
                    }
                } catch (e) {
                    router.reload({
                        only: ['messages', 'chats', 'archivedChats'],
                    });
                }
            }, 2500);
            return () => clearInterval(interval);
        }
    }, [activeChat?.id, connectionStatus]);

    // Total unread count across all project chats
    const totalUnreadCount = useMemo(() => {
        return chats.reduce((acc, c) => acc + (c.unread_count || 0), 0);
    }, [chats]);

    // Filter conversations list: All, Unread, Pinned
    const filteredChats = useMemo(() => {
        return chats.filter((chat) => {
            const matchesSearch =
                (chat.title || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
                Boolean(chat.preview && chat.preview.toLowerCase().includes((searchQuery || '').toLowerCase()));

            if (!matchesSearch) return false;

            if (filterTab === 'unread') return chat.unread_count > 0;
            if (filterTab === 'pinned') return chat.is_pinned;
            return true;
        });
    }, [chats, searchQuery, filterTab]);

    // Switch chat
    const handleSelectChat = (projectId: number) => {
        router.visit(`/messages/${projectId}`, {
            preserveState: false,
            preserveScroll: true,
        });
        setShowMobileThread(true);
    };

    // Send message (Instant optimistic dispatch without loading screen)
    const handleSendMessage = async (customBody?: string) => {
        if (!activeChat || activeChat.is_archived) return;
        const bodyToSend = customBody ?? messageText;
        if (!bodyToSend.trim() && !selectedFile) return;

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        sendTypingWhisper(false);

        const currentFile = selectedFile;
        const tempId = -Date.now();

        // 1. Instantly append message to local UI state (0ms latency feel)
        const optimisticMsg: MessageItem = {
            id: tempId,
            chat_id: activeChat.id,
            conversation_id: activeChat.id,
            sender_id: currentUserId,
            type: currentFile ? 'file' : 'text',
            body: bodyToSend.trim(),
            attachment_name: currentFile?.name,
            attachment_size: currentFile?.size,
            attachment_type: currentFile?.type,
            created_at: new Date().toISOString(),
            sender: {
                id: currentUserId,
                name: currentUserName,
                email: page.props.auth?.user?.email ?? '',
            },
            is_deleted: false,
        };

        setMessages((prev) => [...prev, optimisticMsg]);

        // 2. Instantly update chat list preview
        setChats((prev) =>
            prev.map((c) =>
                c.id === activeChat.id
                    ? {
                          ...c,
                          preview: bodyToSend.trim() || (currentFile ? `Shared file: ${currentFile.name}` : 'New message'),
                          preview_time: new Date().toISOString(),
                          updated_at: new Date().toISOString(),
                      }
                    : c
            )
        );

        // 3. Instantly clear composer inputs and anchor scroll to bottom
        setMessageText('');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setTimeout(() => scrollToBottom('smooth'), 10);
        setSendError(null);

        // 4. Send in background via axios (automatic XSRF cookie handling, multipart boundary, resilient credentials)
        const formData = new FormData();
        if (bodyToSend.trim()) {
            formData.append('body', bodyToSend.trim());
        }
        if (currentFile) {
            formData.append('file', currentFile);
        }

        try {
            const res = await axios.post(`/chat/${activeChat.id}/messages`, formData, {
                headers: getCsrfHeader(),
            });
            const data = res.data;

            // Reconcile optimistic message with real server ID
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === tempId
                        ? {
                              ...m,
                              id: data.id,
                              chat_id: data.chat_id || m.chat_id,
                              created_at: data.created_at || m.created_at,
                              attachment_path: data.attachment_path || m.attachment_path,
                              attachment_name: data.attachment_name || m.attachment_name,
                              attachment_type: data.attachment_type || m.attachment_type,
                              attachment_size: data.attachment_size || m.attachment_size,
                          }
                        : m
                )
            );
            setFailedMessageText('');
            setSendError(null);
        } catch (err: any) {
            console.error('Failed to send message:', err);
            const serverMessage =
                err.response?.data?.message ||
                (err.response?.data?.errors ? Object.values(err.response.data.errors).flat().join(' ') : null) ||
                err.message;
            setSendError(
                serverMessage && typeof serverMessage === 'string'
                    ? serverMessage
                    : 'Failed to send message. Please check your connection and try again.'
            );
            setFailedMessageText(bodyToSend);
            // Remove optimistic message so phantom messages don't confuse user
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
            // Restore text and file to composer so nothing is lost
            setMessageText(bodyToSend);
            if (currentFile) setSelectedFile(currentFile);
        }
    };

    // Typing whisper trigger
    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setMessageText(val);

        // Check for @ mention trigger
        const cursorPos = e.target.selectionStart;
        const textBeforeCursor = val.slice(0, cursorPos);
        const lastAt = textBeforeCursor.lastIndexOf('@');

        if (lastAt !== -1 && (lastAt === 0 || /\s/.test(textBeforeCursor[lastAt - 1]))) {
            const query = textBeforeCursor.slice(lastAt + 1);
            if (!/\s/.test(query)) {
                setMentionFilter(query.toLowerCase());
                setMentionCursorIndex(lastAt);
                setSelectedMentionIndex(0);
            } else {
                setMentionFilter(null);
            }
        } else {
            setMentionFilter(null);
        }

        // Throttle typing whispers
        const now = Date.now();
        if (val.trim() === '') {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
            sendTypingWhisper(false);
        } else {
            if (now - lastTypingWhisperRef.current > 1200) {
                lastTypingWhisperRef.current = now;
                sendTypingWhisper(true);
            }

            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
            typingTimeoutRef.current = setTimeout(() => {
                sendTypingWhisper(false);
            }, 2500);
        }
    };

    // Filter project members for @mentions (current project members only)
    const mentionSuggestions = useMemo(() => {
        if (mentionFilter === null) return [];
        return propProjectMembers.filter((m) =>
            m.name.toLowerCase().includes(mentionFilter)
        );
    }, [mentionFilter, propProjectMembers]);

    const handleSelectMention = (memberName: string) => {
        if (mentionCursorIndex === -1) return;
        const before = messageText.slice(0, mentionCursorIndex);
        const after = messageText.slice(mentionCursorIndex + (mentionFilter?.length ?? 0) + 1);
        const newText = `${before}@${memberName} ${after}`;
        setMessageText(newText);
        setMentionFilter(null);
        textareaRef.current?.focus();
    };

    // Toggle Pin
    const handleTogglePin = async () => {
        if (!activeChat) return;
        try {
            const res = await axios.post(`/chat/${activeChat.id}/pin`, {}, {
                headers: getCsrfHeader(),
            });
            const data = res.data;
            if (data?.success) {
                setIsPinned(data.is_pinned);
                setChats((prev) =>
                    prev.map((c) =>
                        c.id === activeChat.id ? { ...c, is_pinned: data.is_pinned } : c
                    )
                );
            }
        } catch (e) {
            console.error('Failed to toggle pin:', e);
        }
    };

    // Toggle Mute
    const handleToggleMute = async () => {
        if (!activeChat) return;
        try {
            const res = await axios.post(`/chat/${activeChat.id}/mute`, {}, {
                headers: getCsrfHeader(),
            });
            const data = res.data;
            if (data?.success) {
                setIsMuted(data.is_muted);
                setChats((prev) =>
                    prev.map((c) =>
                        c.id === activeChat.id ? { ...c, is_muted: data.is_muted } : c
                    )
                );
            }
        } catch (e) {
            console.error('Failed to toggle mute:', e);
        }
    };

    // Soft delete message
    const handleConfirmDeleteMessage = async () => {
        if (!messagePendingDelete || !activeChat) return;
        const msgId = messagePendingDelete.id;
        setIsDeletingMessage(true);

        try {
            const res = await axios.post(`/chat/${activeChat.id}/messages/${msgId}/delete`, {}, {
                headers: getCsrfHeader(),
            });

            if (res.data?.success) {
                // Replace message with tombstone locally
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === msgId ? { ...m, is_deleted: true, body: '' } : m
                    )
                );

                setMessagePendingDelete(null);
                setIsDeletingMessage(false);
                setUndoMessageId(msgId);
            }
        } catch (err: any) {
            console.error('Failed to delete message:', err);
            setIsDeletingMessage(false);
            const msg = err.response?.data?.message || 'Failed to delete message. Please try again.';
            alert(msg);
        }
    };

    // Undo delete flow (5 seconds)
    const handleUndoDelete = async (msgId: number) => {
        if (!activeChat) return;
        try {
            const res = await axios.post(`/chat/${activeChat.id}/messages/${msgId}/restore`, {}, {
                headers: getCsrfHeader(),
            });

            if (res.data?.success) {
                setUndoMessageId(null);
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === msgId ? { ...m, is_deleted: false } : m
                    )
                );
                router.reload({ only: ['messages'] });
            }
        } catch (err: any) {
            console.error('Failed to restore message:', err);
            const msg = err.response?.data?.message || 'Failed to restore message.';
            alert(msg);
        }
    };

    // Grouping logic: consecutive messages within 5 minutes (Section 3 Spacing Scale)
    const messageGroups = useMemo(() => {
        const groups: Array<{
            id: string;
            dateDivider?: string;
            isSystem: boolean;
            senderId?: number | null;
            sender?: MessageSender | null;
            items: MessageItem[];
        }> = [];

        let lastDateStr = '';

        messages.forEach((msg, idx) => {
            const msgDate = new Date(msg.created_at);
            const dateStr = msgDate.toLocaleDateString([], {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            });

            // Date divider check
            let dateDivider: string | undefined = undefined;
            if (dateStr !== lastDateStr) {
                const now = new Date();
                const isToday = now.toDateString() === msgDate.toDateString();
                const yesterday = new Date(now);
                yesterday.setDate(now.getDate() - 1);
                const isYesterday = yesterday.toDateString() === msgDate.toDateString();

                dateDivider = isToday ? 'Today' : isYesterday ? 'Yesterday' : dateStr;
                lastDateStr = dateStr;
            }

            const isSystem = msg.type === 'system' || msg.sender_id === null || !msg.sender_id;

            // If system message, always standalone centered group
            if (isSystem) {
                groups.push({
                    id: `sys-${msg.id}`,
                    dateDivider,
                    isSystem: true,
                    senderId: null,
                    sender: null,
                    items: [msg],
                });
                return;
            }

            const prevGroup = groups.length > 0 ? groups[groups.length - 1] : null;
            const canGroup =
                prevGroup &&
                !prevGroup.isSystem &&
                prevGroup.senderId === msg.sender_id &&
                !dateDivider;

            if (canGroup) {
                const prevLastMsg = prevGroup.items[prevGroup.items.length - 1];
                const diffMs =
                    new Date(msg.created_at).getTime() - new Date(prevLastMsg.created_at).getTime();
                // 5-minute threshold
                if (diffMs <= 5 * 60 * 1000) {
                    prevGroup.items.push(msg);
                    return;
                }
            }

            groups.push({
                id: `group-${msg.id}`,
                dateDivider,
                isSystem: false,
                senderId: msg.sender_id,
                sender: msg.sender,
                items: [msg],
            });
        });

        return groups;
    }, [messages]);

    // Find the very latest message sent by current user to display read receipts
    const myLatestMessageId = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].sender_id === currentUserId && !messages[i].is_deleted) {
                return messages[i].id;
            }
        }
        return null;
    }, [messages, currentUserId]);

    return (
        <AppLayout hidePageHeadingBanner={true}>
            <Head title={activeChat ? `${activeChat.title} — Chat` : 'Messages — ITASK'} />

            {/* ══ Full-Width Unified Messages Layout (Scoped under .messaging-root) ════ */}
            <div className="messaging-root messaging-shell w-full h-full min-h-0 flex overflow-hidden bg-[color:var(--card)] select-none">

                {/* ─────────────────────────────────────────────────────────────
                   PANE 1: CONVERSATION LIST (320px fixed, hidden on mobile thread)
                   ───────────────────────────────────────────────────────────── */}
                <div
                    className={`msg-pane-conversations shrink-0 border-r border-[color:var(--border)] flex flex-col h-full bg-[color:var(--card)] overflow-hidden transition-all duration-200 ${
                        showMobileThread ? 'hidden md:flex' : 'flex'
                    }`}
                    aria-label="Project chats list"
                >
                        {/* Header: Project chats title & Search */}
                        <div className="p-3.5 pb-2 border-b border-[color:var(--border)] space-y-3 shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <h1 className="text-lg font-extrabold text-[color:var(--text)] tracking-tight">
                                        Project chats
                                    </h1>
                                    {totalUnreadCount > 0 && (
                                        <span className="msg-badge-pulse px-2 py-0.5 rounded-full text-xs font-bold bg-[color:var(--primary)] text-white">
                                            {totalUnreadCount}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Search bar */}
                            <div className="relative">
                                <Search className="w-4 h-4 text-[color:var(--muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search project chats..."
                                    className="w-full pl-9 pr-7 py-2 rounded-xl text-xs bg-[color:var(--soft-surface)] border border-[color:var(--border)] focus:border-[color:var(--primary)] text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)] transition-all"
                                    aria-label="Search project chats"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[color:var(--muted)] hover:text-[color:var(--text)] cursor-pointer"
                                        aria-label="Clear search"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Filter Pills: All, Unread, Pinned */}
                            <div className="flex items-center gap-1.5 pt-0.5 overflow-x-auto no-scrollbar">
                                {(
                                    [
                                        { key: 'all', label: 'All' },
                                        {
                                            key: 'unread',
                                            label: `Unread${totalUnreadCount > 0 ? ` (${totalUnreadCount})` : ''}`,
                                        },
                                        { key: 'pinned', label: 'Pinned' },
                                    ] as const
                                ).map((tab) => {
                                    const isActive = filterTab === tab.key;
                                    return (
                                        <button
                                            key={tab.key}
                                            type="button"
                                            onClick={() => setFilterTab(tab.key)}
                                            className={`px-3 py-1 rounded-full text-xs font-bold tracking-tight transition-all cursor-pointer select-none shrink-0 msg-interactive ${
                                                isActive
                                                    ? 'bg-[color:var(--primary)] text-white shadow-xs'
                                                    : 'bg-[color:var(--soft-surface)] text-[color:var(--muted)] hover:text-[color:var(--text)]'
                                            }`}
                                        >
                                            {tab.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Chats Scrollable List */}
                        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-[color:var(--border)]/50 divide-dashed p-1.5 space-y-1">
                            {filteredChats.length === 0 ? (
                                <div className="p-6 text-center space-y-2 text-[color:var(--muted)]">
                                    <FolderOpen className="w-8 h-8 mx-auto opacity-40 text-[color:var(--primary)]" />
                                    <p className="text-xs font-semibold text-[color:var(--text)]">
                                        {searchQuery ? 'No matching chats found' : 'Chats appear with your projects'}
                                    </p>
                                    <p className="text-[11px] leading-relaxed text-[color:var(--muted)]">
                                        {searchQuery
                                            ? 'Try searching with different keywords.'
                                            : 'When you create or join a project, its group chat shows up here.'}
                                    </p>
                                    {!searchQuery && (
                                        <div className="pt-2">
                                            <Link
                                                href="/projects"
                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[color:var(--primary)] text-white font-bold text-xs hover:opacity-90 transition-opacity"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                <span>Go to Projects</span>
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                filteredChats.map((chat) => {
                                    const isSelected = activeChat?.id === chat.id;
                                    const hasUnread = chat.unread_count > 0;

                                    return (
                                        <button
                                            key={chat.id}
                                            type="button"
                                            onClick={() => handleSelectChat(chat.project_id)}
                                            className={`w-full p-3 rounded-xl flex items-start gap-3 transition-colors text-left cursor-pointer group relative msg-interactive ${
                                                isSelected
                                                    ? 'bg-[color:var(--soft-surface)] border-l-4 border-[color:var(--primary)] shadow-xs'
                                                    : 'hover:bg-[color:var(--soft-surface)]/60'
                                            }`}
                                        >
                                            {/* Project Avatar */}
                                            <div className="w-10 h-10 rounded-xl bg-[color:var(--primary)] text-white flex items-center justify-center font-extrabold text-sm shrink-0 shadow-xs">
                                                {getInitials(chat.title)}
                                            </div>

                                            {/* Chat Info */}
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <div className="flex items-center justify-between gap-1">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <span
                                                            className={`text-xs truncate ${
                                                                hasUnread ? 'font-black text-[color:var(--text)]' : 'font-bold text-[color:var(--text)]'
                                                            }`}
                                                        >
                                                            {chat.title}
                                                        </span>
                                                        {chat.is_pinned && (
                                                            <Pin className="w-3 h-3 text-[color:var(--primary)] shrink-0 fill-current" />
                                                        )}
                                                        {chat.is_muted && (
                                                            <VolumeX className="w-3 h-3 text-[color:var(--muted)] shrink-0" />
                                                        )}
                                                    </div>

                                                    {chat.preview_time && (
                                                        <span className="text-[10px] text-[color:var(--muted)] shrink-0 font-medium">
                                                            {formatConversationTime(chat.preview_time)}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center justify-between gap-2">
                                                    <p
                                                        className={`text-xs truncate leading-snug ${
                                                            hasUnread
                                                                ? 'font-bold text-[color:var(--text)]'
                                                                : 'text-[color:var(--muted)] font-normal'
                                                        }`}
                                                    >
                                                        {chat.preview}
                                                    </p>

                                                    <div className="flex items-center gap-1 shrink-0">
                                                        {hasUnread && (
                                                            <span className="msg-badge-pulse px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[color:var(--primary)] text-white">
                                                                {chat.unread_count}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1 text-[10px] text-[color:var(--muted)]">
                                                    <Users className="w-3 h-3" />
                                                    <span>{chat.member_count} members</span>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })
                            )}

                            {/* Collapsible Archived Projects Section at Bottom */}
                            {archivedChats.length > 0 && (
                                <div className="pt-2 border-t border-[color:var(--border)]">
                                    <button
                                        type="button"
                                        onClick={() => setIsArchivedSectionOpen(!isArchivedSectionOpen)}
                                        className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold text-[color:var(--muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--soft-surface)]/50 transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <Archive className="w-3.5 h-3.5 text-[color:var(--muted)]" />
                                            <span>Archived ({archivedChats.length})</span>
                                        </div>
                                        {isArchivedSectionOpen ? (
                                            <ChevronDown className="w-3.5 h-3.5" />
                                        ) : (
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        )}
                                    </button>

                                    {isArchivedSectionOpen && (
                                        <div className="space-y-1 pt-1 pl-1">
                                            {archivedChats.map((archived) => {
                                                const isSelected = activeChat?.id === archived.id;
                                                return (
                                                    <button
                                                        key={archived.id}
                                                        type="button"
                                                        onClick={() => handleSelectChat(archived.project_id)}
                                                        className={`w-full p-2.5 rounded-xl flex items-center gap-2.5 text-left text-xs transition-colors cursor-pointer opacity-80 hover:opacity-100 msg-interactive ${
                                                            isSelected
                                                                ? 'bg-[color:var(--soft-surface)] border-l-4 border-[color:var(--primary)]'
                                                                : 'hover:bg-[color:var(--soft-surface)]/50'
                                                        }`}
                                                    >
                                                        <div className="w-7 h-7 rounded-lg bg-[color:var(--soft-surface)] text-[color:var(--muted)] flex items-center justify-center font-bold text-xs shrink-0">
                                                            {getInitials(archived.title)}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-semibold text-[color:var(--text)] truncate">
                                                                {archived.title}
                                                            </p>
                                                            <p className="text-[10px] text-[color:var(--muted)] truncate">
                                                                Archived project
                                                            </p>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ─────────────────────────────────────────────────────────────
                       PANE 2: CHAT THREAD (flexible, scrollable)
                       ───────────────────────────────────────────────────────────── */}
                    <div
                        className={`msg-pane-thread min-w-0 flex flex-col h-full bg-[color:var(--card)] relative overflow-hidden ${
                            showMobileThread ? 'flex' : 'hidden md:flex'
                        }`}
                        aria-label="Chat thread"
                    >
                        {/* Access Revoked Overlay State (Requirement 1.2) */}
                        {isAccessRevoked ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 bg-[color:var(--card)] animate-backdrop-in">
                                <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center">
                                    <Shield className="w-7 h-7" />
                                </div>
                                <div className="space-y-1.5 max-w-sm">
                                    <h2 className="text-lg font-black text-[color:var(--text)]">
                                        This chat isn't available
                                    </h2>
                                    <p className="text-xs text-[color:var(--muted)] leading-relaxed">
                                        You may have been removed from the project, or the project was deleted.
                                    </p>
                                </div>
                                <Button
                                    variant="primary"
                                    onClick={() => router.visit('/messages')}
                                    className="px-4 py-2 rounded-xl font-bold bg-[color:var(--primary-btn)] hover:bg-[color:var(--primary-btn-hover)] text-white shadow-xs msg-interactive"
                                >
                                    Back to Messages
                                </Button>
                            </div>
                        ) : activeChat ? (
                            <>
                                {/* ── Group Thread Header ── */}
                                <div className="h-16 px-4 border-b border-[color:var(--border)] flex items-center justify-between gap-3 shrink-0 bg-[color:var(--card)] z-10">
                                    <div className="flex items-center gap-3 min-w-0">
                                        {/* Mobile Back Button (≥40px touch target) */}
                                        <button
                                            type="button"
                                            onClick={() => setShowMobileThread(false)}
                                            className="msg-mobile-back-btn md:hidden msg-touch-target p-1.5 rounded-xl hover:bg-[color:var(--soft-surface)] text-[color:var(--text)] cursor-pointer msg-interactive"
                                            aria-label="Back to project chats"
                                        >
                                            <ArrowLeft className="w-5 h-5" />
                                        </button>

                                        {/* Project Group Avatar */}
                                        <div className="w-10 h-10 rounded-xl bg-[color:var(--primary)] text-white font-extrabold flex items-center justify-center text-sm shrink-0 shadow-xs">
                                            {getInitials(activeChat.title)}
                                        </div>

                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h2 className="text-sm font-extrabold text-[color:var(--text)] truncate">
                                                    {activeChat.title}
                                                </h2>
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[color:var(--soft-surface)] text-[color:var(--muted)] border border-[color:var(--border)] shrink-0 select-none">
                                                    Group Chat
                                                </span>
                                                {activeChat.is_archived && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[color:var(--status-neutral-bg)] text-[color:var(--status-neutral-text)] border border-[color:var(--status-neutral-border)] flex items-center gap-1 shrink-0">
                                                        <Lock className="w-2.5 h-2.5" />
                                                        Archived
                                                    </span>
                                                )}
                                            </div>

                                            {/* Subtitle: Overlapping avatar stack & members count */}
                                            <div className="flex items-center gap-2 text-xs text-[color:var(--muted)]">
                                                <div className="flex -space-x-1.5 overflow-hidden items-center">
                                                    {participants.slice(0, 4).map((m) => (
                                                        <div
                                                            key={m.id}
                                                            title={m.name}
                                                            className="inline-block w-5 h-5 rounded-full ring-2 ring-[color:var(--card)] bg-[color:var(--soft-surface)] text-[color:var(--text)] text-[9px] font-black text-center leading-5 select-none shrink-0"
                                                        >
                                                            {getInitials(m.name)}
                                                        </div>
                                                    ))}
                                                    {participants.length > 4 && (
                                                        <span className="w-5 h-5 rounded-full ring-2 ring-[color:var(--card)] bg-[color:var(--soft-surface)] text-[color:var(--muted)] text-[9px] font-bold flex items-center justify-center shrink-0">
                                                            +{participants.length - 4}
                                                        </span>
                                                    )}
                                                </div>
                                                {typingLabel ? (
                                                    <span className="text-[11px] font-bold text-[color:var(--primary)] italic flex items-center gap-1.5 animate-modal-in">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--primary)] animate-pulse shrink-0" />
                                                        <span className="truncate max-w-[200px]">{typingLabel}</span>
                                                    </span>
                                                ) : (
                                                    <span>{participants.length} members</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action buttons: Pin, Mute, Open Project */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            type="button"
                                            onClick={handleTogglePin}
                                            aria-label={isPinned ? 'Unpin chat' : 'Pin chat'}
                                            className={`msg-touch-target p-2 rounded-xl transition-colors cursor-pointer msg-interactive ${
                                                isPinned
                                                    ? 'bg-[color:var(--status-primary-bg)] text-[color:var(--primary)]'
                                                    : 'text-[color:var(--muted)] hover:bg-[color:var(--soft-surface)] hover:text-[color:var(--text)]'
                                            }`}
                                            title={isPinned ? 'Unpin chat' : 'Pin chat'}
                                        >
                                            <Pin className="w-4 h-4" />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleToggleMute}
                                            aria-label={isMuted ? 'Unmute chat' : 'Mute chat'}
                                            className={`msg-touch-target p-2 rounded-xl transition-colors cursor-pointer msg-interactive ${
                                                isMuted
                                                    ? 'bg-[color:var(--status-primary-bg)] text-[color:var(--primary)]'
                                                    : 'text-[color:var(--muted)] hover:bg-[color:var(--soft-surface)] hover:text-[color:var(--text)]'
                                            }`}
                                            title={isMuted ? 'Unmute notifications' : 'Mute notifications'}
                                        >
                                            {isMuted ? (
                                                <VolumeX className="w-4 h-4 text-[color:var(--primary)]" />
                                            ) : (
                                                <Volume2 className="w-4 h-4" />
                                            )}
                                        </button>

                                        <Link
                                            href={`/projects/${activeChat.project_id}`}
                                            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[color:var(--border)] text-xs font-bold text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] transition-colors msg-interactive"
                                            aria-label="Open project page"
                                        >
                                            <span>Open project</span>
                                            <ExternalLink className="w-3.5 h-3.5 text-[color:var(--muted)]" />
                                        </Link>
                                    </div>
                                </div>

                                {/* Archived Read-Only Banner */}
                                {activeChat.is_archived && (
                                    <div className="bg-[color:var(--status-neutral-bg)] border-b border-[color:var(--status-neutral-border)] px-4 py-2 text-xs font-bold text-[color:var(--status-neutral-text)] flex items-center justify-center gap-2">
                                        <Lock className="w-3.5 h-3.5" />
                                        <span>This project is archived. Messages are read-only.</span>
                                    </div>
                                )}

                                {/* One-Time History Notice (Requirement 1.3) */}
                                {showHistoryNotice && (
                                    <div className="bg-[color:var(--status-primary-bg)] border-b border-[color:var(--status-primary-border)] px-4 py-2 text-xs text-[color:var(--text)] flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="w-3.5 h-3.5 text-[color:var(--primary)]" />
                                            <span>You can see earlier messages in this chat.</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleDismissHistoryNotice}
                                            className="text-[color:var(--muted)] hover:text-[color:var(--text)] text-[11px] font-bold underline cursor-pointer"
                                        >
                                            Dismiss
                                        </button>
                                    </div>
                                )}

                                {/* ── Thread Messages Body (4px Spacing Scale) ── */}
                                <div
                                    ref={messagesContainerRef}
                                    onScroll={handleScroll}
                                    className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4"
                                    style={{ paddingBottom: '24px' }}
                                >
                                    {messages.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-center space-y-3 p-6 text-[color:var(--muted)]">
                                            <div className="w-12 h-12 rounded-2xl bg-[color:var(--status-primary-bg)] text-[color:var(--primary)] flex items-center justify-center">
                                                <MessageSquare className="w-6 h-6" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-sm font-bold text-[color:var(--text)]">
                                                    No messages yet
                                                </p>
                                                <p className="text-xs text-[color:var(--muted)]">
                                                    Say hello to your team and collaborate.
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        messageGroups.map((group) => (
                                            <React.Fragment key={group.id}>
                                                {/* Date Divider (24px margin scale) */}
                                                {group.dateDivider && (
                                                    <div className="flex items-center justify-center my-6">
                                                        <span className="px-3.5 py-1 rounded-full text-[11px] font-bold bg-[color:var(--soft-surface)] text-[color:var(--muted)] border border-[color:var(--border)] shadow-xs select-none">
                                                            {group.dateDivider}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* System Message Pill */}
                                                {group.isSystem ? (
                                                    <div className="flex justify-center my-2 animate-modal-in">
                                                        <div className="max-w-md px-3.5 py-1 rounded-full text-xs bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-[color:var(--muted)] text-center font-medium shadow-xs">
                                                            {group.items[0]?.body}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    /* User Message Group (Grouped consecutive bubbles) */
                                                    <div
                                                        className={`flex gap-2.5 ${
                                                            group.senderId === currentUserId ? 'justify-end' : 'justify-start'
                                                        }`}
                                                    >
                                                        {/* Avatar for other senders (Aligned to first bubble) */}
                                                        {group.senderId !== currentUserId && (
                                                            <div className="w-8 h-8 rounded-xl bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)] font-extrabold flex items-center justify-center text-xs shrink-0 select-none shadow-xs mt-1">
                                                                {getInitials(group.sender?.name ?? 'Member')}
                                                            </div>
                                                        )}

                                                        <div
                                                            className={`flex flex-col space-y-1 max-w-[70%] max-[640px]:max-w-[88%] ${
                                                                group.senderId === currentUserId ? 'items-end' : 'items-start'
                                                            }`}
                                                        >
                                                            {/* Sender Name on first bubble for others */}
                                                            {group.senderId !== currentUserId && (
                                                                <span className="text-[11px] font-bold text-[color:var(--muted)] px-1">
                                                                    {group.sender?.name ?? 'Teammate'}
                                                                </span>
                                                            )}

                                                            {/* Message Bubbles (4px spacing scale) */}
                                                            {group.items.map((msg, itemIdx) => {
                                                                const isMine = msg.sender_id === currentUserId;
                                                                const isLastInGroup = itemIdx === group.items.length - 1;
                                                                const isFirstInGroup = itemIdx === 0;

                                                                // Permission to delete: sender OR project leader
                                                                const canDelete = isMine || activeChat.is_leader;

                                                                return (
                                                                    <div
                                                                        key={msg.id}
                                                                        className="relative group/msg flex flex-col msg-bubble-anim"
                                                                        style={{ marginTop: isFirstInGroup ? 0 : '4px' }}
                                                                    >
                                                                        <div className="flex items-center gap-1.5">
                                                                            {/* Message action buttons for current user (left of bubble) */}
                                                                            {!msg.is_deleted && (
                                                                                <div className="msg-action-menu-container relative flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                                                                                    {/* Quick direct create task button */}
                                                                                    {msg.body && !msg.task_id && (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                setTaskPrefillText(msg.body || '');
                                                                                                setIsCreateTaskModalOpen(true);
                                                                                            }}
                                                                                            className="p-1 rounded-lg hover:bg-[color:var(--soft-surface)] text-[color:var(--muted)] hover:text-[color:var(--primary)] cursor-pointer msg-interactive"
                                                                                            aria-label="Create task from message"
                                                                                            title="Create task from message"
                                                                                        >
                                                                                            <CheckSquare className="w-3.5 h-3.5" />
                                                                                        </button>
                                                                                    )}

                                                                                    {/* Three dots menu button for current user */}
                                                                                    {(canDelete || (msg.body && !msg.task_id)) && (
                                                                                        <div className="relative">
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    setOpenMenuMessageId(
                                                                                                        openMenuMessageId === msg.id ? null : msg.id
                                                                                                    );
                                                                                                }}
                                                                                                className="p-1 rounded-lg hover:bg-[color:var(--soft-surface)] text-[color:var(--muted)] hover:text-[color:var(--text)] cursor-pointer msg-interactive"
                                                                                                aria-label="Message actions"
                                                                                            >
                                                                                                <MoreVertical className="w-3.5 h-3.5" />
                                                                                            </button>

                                                                                            {openMenuMessageId === msg.id && (
                                                                                                <div className="absolute left-0 bottom-full mb-1 w-44 bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl shadow-xl p-1 z-30 animate-modal-in select-none">
                                                                                                    {msg.body && !msg.task_id && (
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            onClick={() => {
                                                                                                                setOpenMenuMessageId(null);
                                                                                                                setTaskPrefillText(msg.body || '');
                                                                                                                setIsCreateTaskModalOpen(true);
                                                                                                            }}
                                                                                                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] cursor-pointer"
                                                                                                        >
                                                                                                            <CheckSquare className="w-3.5 h-3.5 text-[color:var(--primary)]" />
                                                                                                            <span>Create task</span>
                                                                                                        </button>
                                                                                                    )}
                                                                                                    {canDelete && (
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            onClick={() => {
                                                                                                                setOpenMenuMessageId(null);
                                                                                                                setMessagePendingDelete(msg);
                                                                                                            }}
                                                                                                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10 cursor-pointer"
                                                                                                        >
                                                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                                                            <span>Delete message</span>
                                                                                                        </button>
                                                                                                    )}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}

                                                                            {/* Message Bubble */}
                                                                            <div
                                                                                className={`px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed shadow-2xs break-words [overflow-wrap:anywhere] msg-interactive ${
                                                                                    msg.is_deleted
                                                                                        ? 'italic bg-[color:var(--soft-surface)] text-[color:var(--muted)] border border-[color:var(--border)]'
                                                                                        : isMine
                                                                                        ? 'bg-[color:var(--primary)] text-white font-normal rounded-tr-xs shadow-xs'
                                                                                        : 'bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--text)] rounded-tl-xs'
                                                                                }`}
                                                                            >
                                                                                {msg.is_deleted ? (
                                                                                    <span>This message was deleted</span>
                                                                                ) : (
                                                                                    <>
                                                                                        {/* Text Body */}
                                                                                        {msg.body && !msg.task_id && (
                                                                                            <p className="whitespace-pre-wrap">
                                                                                                {msg.body}
                                                                                            </p>
                                                                                        )}

                                                                                        {/* Task Card in Chat (Section 1 & 6) */}
                                                                                        {msg.task && (
                                                                                            <div
                                                                                                className={`border-l-4 border-[color:var(--primary)] p-3 rounded-xl min-w-[280px] max-w-full space-y-2 mt-1.5 ${
                                                                                                    isMine
                                                                                                        ? 'bg-black/10 dark:bg-white/10 text-white'
                                                                                                        : 'bg-[color:var(--soft-surface)]/60 text-[color:var(--text)]'
                                                                                                } ${msg.isJustCreatedTask ? 'animate-task-highlight' : ''}`}
                                                                                            >
                                                                                                <div className="flex items-center justify-between gap-2">
                                                                                                    <div className="flex items-center gap-1.5 font-bold text-xs">
                                                                                                        <CheckSquare className={`w-4 h-4 ${isMine ? 'text-white' : 'text-[color:var(--primary)]'}`} />
                                                                                                        <span className="truncate">
                                                                                                            {msg.task.title}
                                                                                                        </span>
                                                                                                    </div>

                                                                                                    {/* Live status pill */}
                                                                                                    <span
                                                                                                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider shrink-0 ${
                                                                                                            msg.task.status === 'Completed' || msg.task.status === 'Done'
                                                                                                                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                                                                                                                : msg.task.status === 'Under Review' || msg.task.status === 'In review'
                                                                                                                ? 'bg-blue-500/20 text-blue-700 dark:text-blue-400'
                                                                                                                : 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                                                                                                        }`}
                                                                                                    >
                                                                                                        {msg.task.status}
                                                                                                    </span>
                                                                                                </div>

                                                                                                {msg.task.description && (
                                                                                                    <p className="text-xs opacity-90 line-clamp-2">
                                                                                                        {msg.task.description}
                                                                                                    </p>
                                                                                                )}

                                                                                                <div className="flex items-center justify-between gap-2 pt-1 text-[11px] opacity-80 border-t border-black/10 dark:border-white/10">
                                                                                                    <span>
                                                                                                        Due {msg.task.due_date || 'No date'}
                                                                                                    </span>
                                                                                                    {msg.task.assignees && msg.task.assignees.length > 0 && (
                                                                                                        <span className="font-semibold">
                                                                                                            Assigned to {msg.task.assignees.map((a) => a.name).join(', ')}
                                                                                                        </span>
                                                                                                    )}
                                                                                                </div>

                                                                                                {msg.task.action_url && (
                                                                                                    <Link
                                                                                                        href={msg.task.action_url}
                                                                                                        className={`inline-flex items-center gap-1 text-[11px] font-bold hover:underline pt-1 ${
                                                                                                            isMine ? 'text-white/90 underline' : 'text-[color:var(--primary)]'
                                                                                                        }`}
                                                                                                    >
                                                                                                        <span>View task</span>
                                                                                                        <ExternalLink className="w-3 h-3" />
                                                                                                    </Link>
                                                                                                )}
                                                                                            </div>
                                                                                        )}

                                                                                        {/* File Attachment */}
                                                                                        {msg.attachment_name && (
                                                                                            <a
                                                                                                href={`/chat/attachments/${msg.id}`}
                                                                                                target="_blank"
                                                                                                rel="noopener noreferrer"
                                                                                                className={`mt-1.5 flex items-center gap-2 p-2 rounded-xl transition-colors ${
                                                                                                    isMine
                                                                                                        ? 'bg-black/10 dark:bg-white/10 text-white hover:bg-black/20'
                                                                                                        : 'bg-[color:var(--soft-surface)] text-[color:var(--text)] hover:bg-[color:var(--border)]/50'
                                                                                                }`}
                                                                                            >
                                                                                                <FileText className={`w-4 h-4 shrink-0 ${isMine ? 'text-white' : 'text-[color:var(--primary)]'}`} />
                                                                                                <span className="text-xs font-semibold truncate underline">
                                                                                                    {msg.attachment_name}
                                                                                                </span>
                                                                                                <Download className="w-3.5 h-3.5 shrink-0 opacity-70 ml-auto" />
                                                                                            </a>
                                                                                        )}
                                                                                    </>
                                                                                )}
                                                                            </div>

                                                                            {/* Message action buttons for other senders (right of bubble) */}
                                                                            {!msg.is_deleted && (
                                                                                <div className="msg-action-menu-container relative flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                                                                                    {/* Quick direct create task button */}
                                                                                    {msg.body && !msg.task_id && (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                setTaskPrefillText(msg.body || '');
                                                                                                setIsCreateTaskModalOpen(true);
                                                                                            }}
                                                                                            className="p-1 rounded-lg hover:bg-[color:var(--soft-surface)] text-[color:var(--muted)] hover:text-[color:var(--primary)] cursor-pointer msg-interactive"
                                                                                            aria-label="Create task from message"
                                                                                            title="Create task from message"
                                                                                        >
                                                                                            <CheckSquare className="w-3.5 h-3.5" />
                                                                                        </button>
                                                                                    )}

                                                                                    {/* Three dots menu for other senders */}
                                                                                    {(canDelete || (msg.body && !msg.task_id)) && (
                                                                                        <div className="relative">
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    setOpenMenuMessageId(
                                                                                                        openMenuMessageId === msg.id ? null : msg.id
                                                                                                    );
                                                                                                }}
                                                                                                className="p-1 rounded-lg hover:bg-[color:var(--soft-surface)] text-[color:var(--muted)] hover:text-[color:var(--text)] cursor-pointer msg-interactive"
                                                                                                aria-label="Message actions"
                                                                                            >
                                                                                                <MoreVertical className="w-3.5 h-3.5" />
                                                                                            </button>

                                                                                            {openMenuMessageId === msg.id && (
                                                                                                <div className="absolute right-0 bottom-full mb-1 w-44 bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl shadow-xl p-1 z-30 animate-modal-in select-none">
                                                                                                    {msg.body && !msg.task_id && (
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            onClick={() => {
                                                                                                                setOpenMenuMessageId(null);
                                                                                                                setTaskPrefillText(msg.body || '');
                                                                                                                setIsCreateTaskModalOpen(true);
                                                                                                            }}
                                                                                                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] cursor-pointer"
                                                                                                        >
                                                                                                            <CheckSquare className="w-3.5 h-3.5 text-[color:var(--primary)]" />
                                                                                                            <span>Create task</span>
                                                                                                        </button>
                                                                                                    )}
                                                                                                    {canDelete && (
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            onClick={() => {
                                                                                                                setOpenMenuMessageId(null);
                                                                                                                setMessagePendingDelete(msg);
                                                                                                            }}
                                                                                                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10 cursor-pointer"
                                                                                                        >
                                                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                                                            <span>Delete message</span>
                                                                                                        </button>
                                                                                                    )}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* Timestamp and Read Receipts (4px below bubble) */}
                                                                        {isLastInGroup && (
                                                                            <div
                                                                                className={`flex items-center gap-2 mt-1 text-[11px] text-[color:var(--muted)] px-1 ${
                                                                                    isMine ? 'justify-end' : 'justify-start'
                                                                                }`}
                                                                            >
                                                                                <span>
                                                                                    {new Date(msg.created_at).toLocaleTimeString([], {
                                                                                        hour: '2-digit',
                                                                                        minute: '2-digit',
                                                                                    })}
                                                                                </span>

                                                                                {/* Read Receipts reflecting whoever has seen it */}
                                                                                {!msg.is_deleted && (
                                                                                    <ReadReceiptPopover
                                                                                        messageId={msg.id}
                                                                                        senderId={msg.sender_id}
                                                                                        isMine={isMine}
                                                                                        isDirect={participants.length <= 2}
                                                                                        participants={participants}
                                                                                        currentUserId={currentUserId}
                                                                                    />
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </React.Fragment>
                                        ))
                                    )}

                                    {/* Typing Indicator */}
                                    {typingLabel && (
                                        <div className="flex items-center gap-2 text-xs text-[color:var(--muted)] italic pt-1 animate-modal-in">
                                            <div className="flex items-center gap-1.5 py-1 px-3 rounded-full bg-[color:var(--soft-surface)] border border-[color:var(--border)] shadow-xs">
                                                <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--primary)] msg-typing-dot-1" />
                                                <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--primary)] msg-typing-dot-2" />
                                                <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--primary)] msg-typing-dot-3" />
                                                <span className="ml-1 text-[11px] font-medium text-[color:var(--text)]">
                                                    {typingLabel}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Floating "New messages" pill when scrolled up */}
                                {hasUnreadBelow && (
                                    <button
                                        type="button"
                                        onClick={() => scrollToBottom('smooth')}
                                        className="msg-float-pill absolute bottom-24 right-8 z-20 px-3.5 py-1.5 rounded-full bg-[color:var(--primary)] text-white text-xs font-extrabold shadow-lg flex items-center gap-1.5 cursor-pointer hover:scale-105 transition-transform msg-interactive"
                                    >
                                        <span>New messages</span>
                                        <ArrowDown className="w-3.5 h-3.5" />
                                    </button>
                                )}

                                {/* ── Composer Area (Requirement 2 & 6) ── */}
                                <div className="relative p-3 sm:p-4 border-t border-[color:var(--border)] bg-[color:var(--card)] shrink-0 space-y-2.5">
                                    {/* Send Error / Retry Banner */}
                                    {sendError && (
                                        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs animate-modal-in">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <AlertCircle className="w-4 h-4 shrink-0" />
                                                <span className="truncate">{sendError}</span>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const retryText = failedMessageText || messageText;
                                                        handleSendMessage(retryText);
                                                    }}
                                                    className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] cursor-pointer msg-interactive"
                                                >
                                                    Retry
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setSendError(null)}
                                                    className="p-1 hover:opacity-70 cursor-pointer"
                                                    aria-label="Dismiss error"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Dashed pill quick actions */}
                                    {!activeChat.is_archived && (
                                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setTaskPrefillText(messageText);
                                                    setIsCreateTaskModalOpen(true);
                                                }}
                                                className="px-3 py-1 rounded-full border border-dashed border-[color:var(--primary)] text-[color:var(--primary)] bg-[color:var(--status-primary-bg)] hover:opacity-90 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 msg-interactive"
                                            >
                                                <CheckSquare className="w-3.5 h-3.5" />
                                                <span>Create task from message</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="px-3 py-1 rounded-full border border-dashed border-[color:var(--border)] text-[color:var(--muted)] hover:text-[color:var(--text)] hover:border-[color:var(--text)] bg-[color:var(--soft-surface)]/40 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 msg-interactive"
                                            >
                                                <Paperclip className="w-3.5 h-3.5" />
                                                <span>Share file</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setMessageText((prev) =>
                                                        prev ? `${prev}\nTeam meeting schedule:` : 'Team meeting schedule:'
                                                    );
                                                    textareaRef.current?.focus();
                                                }}
                                                className="px-3 py-1 rounded-full border border-dashed border-[color:var(--border)] text-[color:var(--muted)] hover:text-[color:var(--text)] hover:border-[color:var(--text)] bg-[color:var(--soft-surface)]/40 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 msg-interactive"
                                            >
                                                <Calendar className="w-3.5 h-3.5" />
                                                <span>Schedule meeting</span>
                                            </button>
                                        </div>
                                    )}

                                    {/* Selected file preview pill */}
                                    {selectedFile && (
                                        <div className="flex items-center gap-2 p-2 rounded-xl bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-xs font-semibold text-[color:var(--text)]">
                                            <FileText className="w-4 h-4 text-[color:var(--primary)]" />
                                            <span className="truncate flex-1">{selectedFile.name}</span>
                                            <span className="text-[10px] text-[color:var(--muted)]">
                                                {(selectedFile.size / 1024).toFixed(0)} KB
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedFile(null);
                                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                                }}
                                                className="p-1 text-[color:var(--muted)] hover:text-red-500 cursor-pointer msg-interactive"
                                                aria-label="Remove attachment"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}

                                    {/* @ Mentions suggestions popover (floating cleanly above composer) */}
                                    {mentionFilter !== null && mentionSuggestions.length > 0 && (
                                        <div className="absolute bottom-full left-3 right-3 sm:left-4 sm:right-4 mb-2 p-1.5 rounded-2xl bg-[color:var(--card)] border border-[color:var(--border)] shadow-2xl max-h-48 overflow-y-auto z-40 space-y-0.5 animate-modal-in">
                                            <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
                                                Mention project member
                                            </p>
                                            {mentionSuggestions.map((m, idx) => (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => handleSelectMention(m.name)}
                                                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left cursor-pointer transition-colors msg-interactive ${
                                                        idx === selectedMentionIndex
                                                            ? 'bg-[color:var(--primary)] text-white font-bold'
                                                            : 'hover:bg-[color:var(--soft-surface)] text-[color:var(--text)]'
                                                    }`}
                                                >
                                                    <Avatar className="w-5 h-5 text-[9px] font-black">
                                                        <AvatarFallback>{getInitials(m.name)}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="truncate">{m.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Live Typing Status Pill above Input */}
                                    {typingLabel && (
                                        <div className="flex items-center gap-2 px-1 text-xs animate-modal-in select-none">
                                            <div className="flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--primary)] msg-typing-dot-1" />
                                                <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--primary)] msg-typing-dot-2" />
                                                <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--primary)] msg-typing-dot-3" />
                                            </div>
                                            <span className="italic text-[11px] font-bold text-[color:var(--primary)]">
                                                {typingLabel}
                                            </span>
                                        </div>
                                    )}

                                    {/* Input Row: Attach, Textarea, Emoji, Send */}
                                    <div className="flex items-end gap-2">
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            className="hidden"
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) {
                                                    setSelectedFile(e.target.files[0]);
                                                }
                                            }}
                                            disabled={activeChat.is_archived}
                                        />

                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={activeChat.is_archived}
                                            className="msg-touch-target p-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--soft-surface)] hover:bg-[color:var(--card)] text-[color:var(--muted)] hover:text-[color:var(--text)] transition-colors cursor-pointer disabled:opacity-50 shrink-0 msg-interactive"
                                            aria-label="Attach file"
                                            title="Attach file"
                                        >
                                            <Paperclip className="w-4 h-4" />
                                        </button>

                                        <div className="flex-1 relative rounded-xl border border-[color:var(--border)] bg-[color:var(--soft-surface)]/50 focus-within:border-[color:var(--primary)] focus-within:bg-[color:var(--card)] transition-colors">
                                            <textarea
                                                ref={textareaRef}
                                                rows={1}
                                                value={messageText}
                                                onChange={handleTextareaChange}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        handleSendMessage();
                                                    }
                                                }}
                                                disabled={activeChat.is_archived}
                                                placeholder={
                                                    activeChat.is_archived
                                                        ? 'This project is archived. Messages are read-only.'
                                                        : 'Write a message. Use @ to mention someone'
                                                }
                                                className="w-full px-3.5 py-2.5 text-xs bg-transparent text-[color:var(--text)] outline-none resize-none leading-relaxed placeholder:text-[color:var(--muted)] disabled:opacity-50"
                                                style={{ maxHeight: '120px' }}
                                                aria-label="Message input"
                                            />
                                        </div>

                                        {/* Quick Emoji shortcut */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMessageText((prev) => `${prev} 👍`);
                                                textareaRef.current?.focus();
                                            }}
                                            disabled={activeChat.is_archived}
                                            className="msg-touch-target p-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--soft-surface)] hover:bg-[color:var(--card)] text-[color:var(--muted)] hover:text-[color:var(--text)] transition-colors cursor-pointer disabled:opacity-50 shrink-0 msg-interactive"
                                            aria-label="Insert thumbs up emoji"
                                            title="Quick emoji"
                                        >
                                            <Smile className="w-4 h-4" />
                                        </button>

                                        {/* Send Button */}
                                        <button
                                            type="button"
                                            onClick={() => handleSendMessage()}
                                            disabled={
                                                activeChat.is_archived ||
                                                isSending ||
                                                (!messageText.trim() && !selectedFile)
                                            }
                                            className="msg-touch-target p-2.5 rounded-xl bg-[color:var(--primary)] hover:opacity-90 active:scale-95 text-white font-extrabold shadow-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0 msg-interactive"
                                            aria-label="Send message"
                                            title="Send message (Enter)"
                                        >
                                            <Send className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            /* Empty Selection State */
                            <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-3 text-[color:var(--muted)]">
                                <div className="w-14 h-14 rounded-2xl bg-[color:var(--status-primary-bg)] text-[color:var(--primary)] flex items-center justify-center shadow-xs">
                                    <MessageSquare className="w-7 h-7" />
                                </div>
                                <div className="space-y-1 max-w-sm">
                                    <h2 className="text-base font-bold text-[color:var(--text)]">
                                        Select a project chat
                                    </h2>
                                    <p className="text-xs text-[color:var(--muted)] leading-relaxed">
                                        Choose an existing project chat from the left pane to collaborate with your team.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ─────────────────────────────────────────────────────────────
                       PANE 3: DETAILS PANEL (300px fixed, hidden below 1250px)
                       ───────────────────────────────────────────────────────────── */}
                    {activeChat && (
                        <div
                            className="msg-pane-details shrink-0 border-l border-[color:var(--border)] flex-col h-full bg-[color:var(--card)] overflow-hidden select-none"
                            aria-label="Project details"
                        >
                            {/* Panel Header */}
                            <div className="p-4 border-b border-[color:var(--border)] shrink-0 space-y-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
                                    Project Details
                                </span>
                                <h3 className="text-sm font-extrabold text-[color:var(--text)] truncate">
                                    {activeChat.title}
                                </h3>

                                {/* Project Progress Bar */}
                                {activeChat.project && (
                                    <div className="space-y-1.5 pt-1">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-semibold text-[color:var(--muted)]">Progress</span>
                                            <span className="font-black text-[color:var(--primary)]">
                                                {activeChat.project.progress}%
                                            </span>
                                        </div>
                                        <div className="h-2 w-full rounded-full bg-[color:var(--soft-surface)] overflow-hidden">
                                            <div
                                                className="h-full bg-[color:var(--primary)] rounded-full transition-all duration-300"
                                                style={{ width: `${activeChat.project.progress}%` }}
                                            />
                                        </div>
                                        <p className="text-[10px] text-[color:var(--muted)]">
                                            {activeChat.project.completed_tasks ?? 0} of {activeChat.project.total_tasks ?? 0} tasks completed
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Panel Body: Members, Shared Files, Pinned Tasks */}
                            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-5 text-xs">
                                {/* Members Section */}
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-[color:var(--text)] uppercase tracking-wider">
                                            Members ({participants.length})
                                        </span>

                                        {/* Leaders see "Manage members" (opens existing project personnel settings) */}
                                        {activeChat.is_leader && (
                                            <Link
                                                href={`/projects/${activeChat.project_id}?tab=personnel`}
                                                className="text-[10px] font-bold text-[color:var(--primary)] hover:underline"
                                            >
                                                Manage
                                            </Link>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        {participants.map((member) => (
                                            <div
                                                key={member.id}
                                                className="flex items-center justify-between gap-2 p-1.5 rounded-xl hover:bg-[color:var(--soft-surface)]/50 transition-colors msg-interactive"
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="w-7 h-7 rounded-lg bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)] font-bold flex items-center justify-center text-xs shrink-0">
                                                        {getInitials(member.name)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-[color:var(--text)] truncate leading-snug">
                                                            {member.name}
                                                        </p>
                                                        <p className="text-[10px] text-[color:var(--muted)] truncate">
                                                            {member.role || 'Member'}
                                                        </p>
                                                    </div>
                                                </div>

                                                <span
                                                    className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"
                                                    title="Active"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Shared Files Section */}
                                <div className="space-y-2.5 pt-3 border-t border-[color:var(--border)]">
                                    <span className="text-[11px] font-bold text-[color:var(--text)] uppercase tracking-wider">
                                        Shared Files ({activeChat.shared_files?.length ?? 0})
                                    </span>

                                    {activeChat.shared_files && activeChat.shared_files.length > 0 ? (
                                        <div className="space-y-1.5">
                                            {activeChat.shared_files.map((file) => (
                                                <a
                                                    key={file.id}
                                                    href={file.download_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[color:var(--soft-surface)]/50 hover:bg-[color:var(--soft-surface)] text-[color:var(--text)] transition-colors msg-interactive"
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <FileText className="w-3.5 h-3.5 text-[color:var(--primary)] shrink-0" />
                                                        <span className="truncate font-medium text-xs">
                                                            {file.name}
                                                        </span>
                                                    </div>
                                                    <Download className="w-3.5 h-3.5 text-[color:var(--muted)] shrink-0" />
                                                </a>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-[11px] text-[color:var(--muted)] italic">
                                            No shared files yet.
                                        </p>
                                    )}
                                </div>

                                {/* Pinned Tasks Section */}
                                <div className="space-y-2.5 pt-3 border-t border-[color:var(--border)]">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-[color:var(--text)] uppercase tracking-wider">
                                            Pinned Tasks ({activeChat.pinned_tasks?.length ?? 0})
                                        </span>
                                    </div>

                                    {activeChat.pinned_tasks && activeChat.pinned_tasks.length > 0 ? (
                                        <div className="space-y-2">
                                            {activeChat.pinned_tasks.map((task) => (
                                                <Link
                                                    key={task.id}
                                                    href={task.action_url}
                                                    className="block p-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--soft-surface)]/30 hover:bg-[color:var(--soft-surface)]/60 transition-colors space-y-1 msg-interactive"
                                                >
                                                    <p className="font-bold text-[color:var(--text)] truncate">
                                                        {task.title}
                                                    </p>
                                                    <div className="flex items-center justify-between text-[10px] text-[color:var(--muted)]">
                                                        <span>Due {task.due_date_formatted}</span>
                                                        <span className="font-semibold text-[color:var(--primary)]">
                                                            {task.status}
                                                        </span>
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-[11px] text-[color:var(--muted)] italic">
                                            No pinned tasks.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

            {/* ══ Modals & Overlays ════════════════════════════════════════════ */}

            {/* 1. Create Task Modal (Popup First -> Fill -> Submit Atomic Transaction) */}
            {activeChat && (
                <CreateTaskModal
                    isOpen={isCreateTaskModalOpen}
                    onClose={() => {
                        setIsCreateTaskModalOpen(false);
                        setTaskPrefillText('');
                    }}
                    conversationId={activeChat.id}
                    conversationProjectId={activeChat.project_id}
                    conversationProjectTitle={activeChat.title}
                    availableMembers={participants}
                    userProjects={[]}
                    currentUserId={currentUserId}
                    prefilledText={taskPrefillText || messageText}
                    onTaskCreated={(created) => {
                        setIsCreateTaskModalOpen(false);
                        setTaskPrefillText('');
                        setMessageText('');
                        router.reload({ only: ['messages', 'chats'] });
                    }}
                />
            )}

            {/* 2. Delete Message Modal (with Focus Trap, Undo warning, Task preservation note) */}
            <DeleteMessageModal
                isOpen={Boolean(messagePendingDelete)}
                onClose={() => setMessagePendingDelete(null)}
                onConfirm={handleConfirmDeleteMessage}
                isDeleting={isDeletingMessage}
                hasTaskCard={Boolean(messagePendingDelete?.task_id || messagePendingDelete?.task)}
                triggerButtonRef={triggerMenuButtonRef}
            />

            {/* 3. Undo Toast (5-Second shrinking progress line) */}
            {undoMessageId !== null && (
                <UndoToast
                    messageId={undoMessageId}
                    onUndo={handleUndoDelete}
                    onDismiss={() => setUndoMessageId(null)}
                    durationMs={5000}
                />
            )}
        </AppLayout>
    );
}
