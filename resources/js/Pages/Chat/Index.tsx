import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
    Plus,
    Check,
    Pin,
    ArrowLeft,
    CheckSquare,
    Calendar,
    ChevronDown,
    AlertCircle,
    ArrowDown,
    MoreVertical,
    Trash2,
    RotateCcw,
    ExternalLink,
    Sparkles,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/Components/ui/avatar';
import { Button } from '@/Components/Button';
import { Badge } from '@/Components/Badge';
import { formatConversationTime, formatReadReceiptTime, formatFullTooltipDateTime } from '@/Components/Chat/formatters';
import { ReadReceiptPopover } from '@/Components/Chat/ReadReceiptPopover';
import { DeleteMessageModal } from '@/Components/Chat/DeleteMessageModal';
import { UndoToast } from '@/Components/Chat/UndoToast';
import { CreateTaskModal } from '@/Components/Chat/CreateTaskModal';

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
    conversation_id: number;
    sender_id: number;
    body: string;
    is_deleted?: boolean;
    task_id?: number | null;
    task?: SharedTaskData | null;
    attachment_path?: string | null;
    attachment_name?: string | null;
    attachment_type?: string | null;
    attachment_size?: number | null;
    created_at: string;
    sender: MessageSender;
    isJustCreatedTask?: boolean;
}

interface ConversationItem {
    id: number;
    type: 'direct' | 'project' | 'committee';
    title: string;
    project_id?: number | null;
    project_name?: string | null;
    committee_id?: number | null;
    committee_name?: string | null;
    other_user?: Participant | null;
    latest_message?: {
        id: number;
        body: string;
        is_deleted?: boolean;
        attachment_name?: string | null;
        created_at: string;
        sender_name: string;
    } | null;
    unread_count: number;
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

interface ActiveConversation {
    id: number;
    type: 'direct' | 'project' | 'committee';
    title: string;
    project_id?: number | null;
    other_user?: Participant | null;
    project?: ProjectInfo | null;
    participants: Participant[];
    shared_files?: SharedFileItem[];
    pinned_tasks?: PinnedTaskItem[];
}

interface AvailableUser {
    id: number;
    name: string;
    email: string;
}

interface UserProject {
    id: number;
    title: string;
    members?: Array<{ id: number; name: string; email: string }>;
}

interface ChatPageProps {
    conversations: ConversationItem[];
    activeConversation?: ActiveConversation | null;
    messages: MessageItem[];
    availableUsers: AvailableUser[];
    userProjects?: UserProject[];
    authUserId: number;
}

// ─── Helper Functions ────────────────────────────────────────────────────────

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
        return new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        }).format(date);
    } catch {
        return '';
    }
}

function formatDateDivider(isoString: string): string {
    try {
        const date = new Date(isoString);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

// Parse task card from message if formatted as json or markdown tag
function parseTaskFromMessage(msg: MessageItem): SharedTaskData | null {
    if (msg.is_deleted) return null;
    if (msg.task) return msg.task;
    if (!msg.body) return null;

    const match = msg.body.match(/\[task:(.*?)\]/);
    if (match && match[1]) {
        try {
            return JSON.parse(match[1]);
        } catch {
            return null;
        }
    }
    return null;
}

// ─── Main Chat Component ────────────────────────────────────────────────────

export default function ChatIndex({
    conversations: initialConversations = [],
    activeConversation,
    messages: initialMessages = [],
    availableUsers = [],
    userProjects = [],
    authUserId,
}: ChatPageProps) {
    const page = usePage<any>();
    const currentUserId = authUserId ?? page.props.auth?.user?.id;

    const [conversations, setConversations] = useState<ConversationItem[]>(initialConversations);
    const [messages, setMessages] = useState<MessageItem[]>(initialMessages);
    const [participants, setParticipants] = useState<Participant[]>(activeConversation?.participants ?? []);

    const [messageText, setMessageText] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [isStartingChat, setIsStartingChat] = useState<number | null>(null);

    // Filters and Search
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTab, setFilterTab] = useState<'all' | 'unread' | 'projects' | 'direct'>('all');

    // Modals & Popups
    const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
    const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [isPinned, setIsPinned] = useState(false);

    // Delete Message Modal & Undo Toast State
    const [messagePendingDelete, setMessagePendingDelete] = useState<MessageItem | null>(null);
    const [isDeletingMessage, setIsDeletingMessage] = useState(false);
    const [undoMessageId, setUndoMessageId] = useState<number | null>(null);
    const [openMenuMessageId, setOpenMenuMessageId] = useState<number | null>(null);
    const triggerMenuButtonRef = useRef<HTMLButtonElement | null>(null);

    // Mobile navigation state: show thread or list (< 820px)
    const [showMobileThread, setShowMobileThread] = useState(Boolean(activeConversation));

    // Scroll state for "New messages" pill
    const [hasUnreadBelow, setHasUnreadBelow] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const messagesContainerRef = useRef<HTMLDivElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    // Track latest message ID marked as read to prevent redundant API calls
    const lastMarkedReadIdRef = useRef<number | null>(null);

    // Real-time typing indicators state
    const [typingUsers, setTypingUsers] = useState<Record<number, { name: string; timeout: NodeJS.Timeout }>>({});
    const lastTypingWhisperRef = useRef<number>(0);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const currentUserName = page.props.auth?.user?.name ?? 'Someone';

    const sendTypingWhisper = useCallback(
        (isTyping: boolean) => {
            if (!activeConversation) return;
            try {
                const ch = echo().private(`chat.${activeConversation.id}`);
                if (ch && typeof (ch as any).whisper === 'function') {
                    (ch as any).whisper('typing', {
                        id: currentUserId,
                        name: currentUserName,
                        is_typing: isTyping,
                    });
                }
            } catch {
                // Ignore if websocket connection is not ready
            }
        },
        [activeConversation?.id, currentUserId, currentUserName]
    );

    const connectionStatus = useConnectionStatus();

    // Sync conversations, messages, and participants
    useEffect(() => {
        setConversations(initialConversations);
    }, [initialConversations]);

    useEffect(() => {
        setMessages(initialMessages);
        if (activeConversation) {
            setParticipants(activeConversation.participants ?? []);
            setShowMobileThread(true);
        }
    }, [initialMessages, activeConversation?.id]);

    // Scroll to bottom on initial load or conversation switch
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
            setHasUnreadBelow(false);
        }
    }, [activeConversation?.id]);

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
        messagesEndRef.current?.scrollIntoView({ behavior });
        setHasUnreadBelow(false);
    };

    // ── Real-Time Read Receipts (IntersectionObserver & Visibility) ─────────────
    const markMessageAsRead = useCallback(
        (messageId: number) => {
            if (!activeConversation) return;
            if (document.visibilityState !== 'visible') return;
            if (lastMarkedReadIdRef.current !== null && lastMarkedReadIdRef.current >= messageId) return;

            lastMarkedReadIdRef.current = messageId;

            const csrfToken =
                (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';

            fetch(`/chat/${activeConversation.id}/read`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({ last_read_message_id: messageId }),
            })
                .then((res) => res.json())
                .then((data) => {
                    if (data.success) {
                        // Optimistically update current user's read marker
                        setParticipants((prev) =>
                            prev.map((p) =>
                                p.id === currentUserId
                                    ? {
                                          ...p,
                                          last_read_message_id: data.last_read_message_id,
                                          last_read_at: data.last_read_at,
                                      }
                                    : p
                            )
                        );
                        // Clear unread count for current conversation in list
                        setConversations((prev) =>
                            prev.map((c) =>
                                c.id === activeConversation.id ? { ...c, unread_count: 0 } : c
                            )
                        );
                    }
                })
                .catch((err) => console.error('Failed to mark message as read:', err));
        },
        [activeConversation?.id, currentUserId]
    );

    // Find the latest message in thread to observe for read receipt
    const latestIncomingMessageId = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].sender_id !== currentUserId) {
                return messages[i].id;
            }
        }
        return null;
    }, [messages, currentUserId]);

    // IntersectionObserver to mark read when scrolled into view and tab is active
    useEffect(() => {
        if (!activeConversation || !latestIncomingMessageId) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry && entry.isIntersecting && document.visibilityState === 'visible') {
                    markMessageAsRead(latestIncomingMessageId);
                }
            },
            {
                root: messagesContainerRef.current,
                threshold: 0.5,
            }
        );

        const targetEl = document.getElementById(`msg-${latestIncomingMessageId}`);
        if (targetEl) {
            observer.observe(targetEl);
        }

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && targetEl) {
                const rect = targetEl.getBoundingClientRect();
                const containerRect = messagesContainerRef.current?.getBoundingClientRect();
                if (
                    containerRect &&
                    rect.top >= containerRect.top &&
                    rect.bottom <= containerRect.bottom + 100
                ) {
                    markMessageAsRead(latestIncomingMessageId);
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            observer.disconnect();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [activeConversation?.id, latestIncomingMessageId, markMessageAsRead]);

    // ── WebSocket Real-Time Listeners via Echo ──────────────────────────────────
    const channelName = activeConversation ? `chat.${activeConversation.id}` : 'chat.0';

    // 1. MessageSent
    useEcho<MessageItem>(channelName, ['.MessageSent', 'MessageSent'], (incomingMessage) => {
        if (activeConversation && incomingMessage.conversation_id === activeConversation.id) {
            // Clear typing state for sender who just delivered a message
            if (incomingMessage.sender_id) {
                setTypingUsers((prev) => {
                    if (!prev[incomingMessage.sender_id]) return prev;
                    clearTimeout(prev[incomingMessage.sender_id].timeout);
                    const updated = { ...prev };
                    delete updated[incomingMessage.sender_id];
                    return updated;
                });
            }

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
                                  is_deleted: false,
                                  attachment_name: incomingMessage.attachment_name,
                                  created_at: incomingMessage.created_at,
                                  sender_name: incomingMessage.sender?.name ?? 'Someone',
                              },
                              updated_at: incomingMessage.created_at,
                          }
                        : c
                )
            );

            // Check scroll position
            if (messagesContainerRef.current) {
                const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
                if (scrollHeight - scrollTop - clientHeight > 100) {
                    setHasUnreadBelow(true);
                } else {
                    setTimeout(() => scrollToBottom('smooth'), 50);
                }
            }
        }
    });

    // 2. MessageDeleted
    useEcho<{ conversation_id: number; message_id: number; is_deleted: boolean }>(
        channelName,
        ['.MessageDeleted', 'MessageDeleted'],
        (data) => {
            if (activeConversation && data.conversation_id === activeConversation.id) {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === data.message_id
                            ? { ...m, is_deleted: true, body: '', attachment_path: null, attachment_name: null }
                            : m
                    )
                );

                // Update conversation list preview if deleted message was latest
                setConversations((prev) =>
                    prev.map((c) => {
                        if (c.id === data.conversation_id && c.latest_message?.id === data.message_id) {
                            return {
                                ...c,
                                latest_message: {
                                    ...c.latest_message,
                                    body: 'This message was deleted',
                                    is_deleted: true,
                                },
                            };
                        }
                        return c;
                    })
                );
            }
        }
    );

    // 3. MessageRestored
    useEcho<MessageItem>(channelName, ['.MessageRestored', 'MessageRestored'], (restoredMsg) => {
        if (activeConversation && restoredMsg.conversation_id === activeConversation.id) {
            setMessages((prev) =>
                prev.map((m) => (m.id === restoredMsg.id ? { ...restoredMsg, is_deleted: false } : m))
            );
        }
    });

    // 4. MessagesRead
    useEcho<{
        conversation_id: number;
        user_id: number;
        last_read_message_id: number;
        read_at: string;
    }>(channelName, ['.MessagesRead', 'MessagesRead'], (data) => {
        if (activeConversation && data.conversation_id === activeConversation.id) {
            setParticipants((prev) =>
                prev.map((p) =>
                    p.id === data.user_id
                        ? {
                              ...p,
                              last_read_message_id: data.last_read_message_id,
                              last_read_at: data.read_at,
                          }
                        : p
                )
            );
        }
    });

    // 5. Typing Whisper Listener (Active only when real members are typing)
    useEffect(() => {
        if (!activeConversation) {
            setTypingUsers({});
            return;
        }

        let ch: any;
        try {
            ch = echo().private(`chat.${activeConversation.id}`);
        } catch {
            return;
        }

        if (!ch || typeof ch.listenForWhisper !== 'function') {
            return;
        }

        const handleWhisper = (data: { id?: number; name?: string; is_typing?: boolean }) => {
            if (!data || !data.id || data.id === currentUserId) return;

            setTypingUsers((prev) => {
                const next = { ...prev };
                if (next[data.id!]?.timeout) {
                    clearTimeout(next[data.id!].timeout);
                }

                if (data.is_typing) {
                    const timeout = setTimeout(() => {
                        setTypingUsers((curr) => {
                            const updated = { ...curr };
                            delete updated[data.id!];
                            return updated;
                        });
                    }, 3000);

                    next[data.id!] = {
                        name: data.name || 'Someone',
                        timeout,
                    };
                } else {
                    delete next[data.id!];
                }

                return next;
            });
        };

        ch.listenForWhisper('typing', handleWhisper);

        return () => {
            try {
                if (typeof ch.stopListeningForWhisper === 'function') {
                    ch.stopListeningForWhisper('typing', handleWhisper);
                }
            } catch {}
            setTypingUsers((prev) => {
                Object.values(prev).forEach((u) => clearTimeout(u.timeout));
                return {};
            });
        };
    }, [activeConversation?.id, currentUserId]);

    // Clear typing timeout when leaving conversation or unmounting
    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
            sendTypingWhisper(false);
        };
    }, [activeConversation?.id, sendTypingWhisper]);

    const typingNames = useMemo(() => Object.values(typingUsers).map((u) => u.name), [typingUsers]);
    const typingLabel = useMemo(() => {
        if (typingNames.length === 0) return '';
        if (typingNames.length === 1) return `${typingNames[0]} is typing...`;
        if (typingNames.length === 2) return `${typingNames[0]} and ${typingNames[1]} are typing...`;
        return `${typingNames[0]} and ${typingNames.length - 1} others are typing...`;
    }, [typingNames]);

    // Fallback polling every 5s if websocket disconnected
    useEffect(() => {
        if (!activeConversation) return;
        if (connectionStatus !== 'connected') {
            const interval = setInterval(() => {
                router.reload({
                    only: ['messages', 'conversations'],
                });
            }, 5000);
            return () => clearInterval(interval);
        }
    }, [activeConversation?.id, connectionStatus]);

    // Total unread count across conversations
    const totalUnreadCount = useMemo(() => {
        return conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);
    }, [conversations]);

    // Filter conversations list
    const filteredConversations = useMemo(() => {
        return conversations.filter((conv) => {
            const matchesSearch =
                conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (conv.latest_message?.body &&
                    conv.latest_message.body.toLowerCase().includes(searchQuery.toLowerCase()));

            if (!matchesSearch) return false;

            if (filterTab === 'unread') return conv.unread_count > 0;
            if (filterTab === 'direct') return conv.type === 'direct';
            if (filterTab === 'projects') return conv.type === 'project' || conv.type === 'committee';
            return true;
        });
    }, [conversations, searchQuery, filterTab]);

    // Switch conversation
    const handleSelectConversation = (convId: number) => {
        router.visit(`/messages?conversation=${convId}`, {
            preserveState: false,
            preserveScroll: true,
        });
        setShowMobileThread(true);
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

    // Send message
    const handleSendMessage = (customBody?: string) => {
        if (!activeConversation) return;
        const bodyToSend = customBody ?? messageText;
        if (!bodyToSend.trim() && !selectedFile) return;

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        sendTypingWhisper(false);

        setIsSending(true);

        const formData = new FormData();
        if (bodyToSend.trim()) {
            formData.append('body', bodyToSend.trim());
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
                if (fileInputRef.current) fileInputRef.current.value = '';
                setTimeout(() => scrollToBottom('smooth'), 50);
            },
            onError: (err) => {
                console.error('Failed to send message:', err);
            },
            onFinish: () => {
                setIsSending(false);
            },
        });
    };

    // Keystroke typing tracker with throttle and auto-reset
    const handleComposerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setMessageText(val);

        if (!activeConversation) return;

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        if (val.trim() === '') {
            sendTypingWhisper(false);
            return;
        }

        const now = Date.now();
        if (now - lastTypingWhisperRef.current > 1500) {
            lastTypingWhisperRef.current = now;
            sendTypingWhisper(true);
        }

        typingTimeoutRef.current = setTimeout(() => {
            sendTypingWhisper(false);
        }, 2500);
    };

    const handleComposerBlur = () => {
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        sendTypingWhisper(false);
    };

    // Keyboard handling in composer
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // ── Delete Message Flow ───────────────────────────────────────────────────
    const handleOpenDeleteModal = (msg: MessageItem, buttonEl: HTMLButtonElement | null) => {
        triggerMenuButtonRef.current = buttonEl;
        setMessagePendingDelete(msg);
        setOpenMenuMessageId(null);
    };

    const handleConfirmDelete = async () => {
        if (!activeConversation || !messagePendingDelete) return;

        setIsDeletingMessage(true);
        const msgId = messagePendingDelete.id;

        try {
            const csrfToken =
                (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';

            const res = await fetch(`/chat/${activeConversation.id}/messages/${msgId}/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to delete message');
            }

            // Optimistically update message to deleted tombstone
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === msgId
                        ? { ...m, is_deleted: true, body: '', attachment_path: null, attachment_name: null }
                        : m
                )
            );

            // Update conversation list preview if deleted message was latest
            setConversations((prev) =>
                prev.map((c) => {
                    if (c.id === activeConversation.id && c.latest_message?.id === msgId) {
                        return {
                            ...c,
                            latest_message: {
                                ...c.latest_message,
                                body: 'This message was deleted',
                                is_deleted: true,
                            },
                        };
                    }
                    return c;
                })
            );

            // Show Undo toast for 5 seconds
            setUndoMessageId(msgId);
            setMessagePendingDelete(null);
        } catch (err: any) {
            alert(err.message || 'Could not delete message. Try again.');
        } finally {
            setIsDeletingMessage(false);
        }
    };

    // Undo Message Deletion (within 5 seconds)
    const handleUndoDelete = async (msgId: number) => {
        if (!activeConversation) return;

        try {
            const csrfToken =
                (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';

            const res = await fetch(`/chat/${activeConversation.id}/messages/${msgId}/restore`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to restore message');
            }

            // Reload messages to restore full body and state
            router.reload({
                only: ['messages', 'conversations'],
                preserveScroll: true,
            });
            setUndoMessageId(null);
        } catch (err: any) {
            alert(err.message || 'Could not restore message.');
        }
    };

    // ── Task Creation Callback ────────────────────────────────────────────────
    const handleTaskCreated = (data: { task: any; message: any }) => {
        // Optimistically append new message with highlight
        const newMsg: MessageItem = {
            id: data.message.id,
            conversation_id: data.message.conversation_id,
            sender_id: currentUserId,
            body: data.message.body,
            task_id: data.task.id,
            task: data.task,
            created_at: data.message.created_at,
            isJustCreatedTask: true,
            sender: {
                id: currentUserId,
                name: page.props.auth?.user?.name || 'You',
                email: page.props.auth?.user?.email || '',
            },
        };

        setMessages((prev) => [...prev, newMsg]);
        setTimeout(() => scrollToBottom('smooth'), 100);

        // Remove 1.5s highlight tag after animation
        setTimeout(() => {
            setMessages((prev) =>
                prev.map((m) => (m.id === newMsg.id ? { ...m, isJustCreatedTask: false } : m))
            );
        }, 1600);

        // Reload to update sidebar My Tasks count and dashboard
        router.reload({
            only: ['conversations'],
            preserveScroll: true,
        });
    };

    // ── Group consecutive messages by sender (< 5 minutes) ────────────────────
    const groupedMessages = useMemo(() => {
        const result: Array<{
            item: MessageItem;
            isFirstInGroup: boolean;
            isLastInGroup: boolean;
            isDifferentSenderGroup: boolean;
            showDateDivider: boolean;
            dateDividerText: string;
            parsedTask: SharedTaskData | null;
        }> = [];

        let lastSenderId: number | null = null;
        let lastMsgTime: Date | null = null;
        let lastDateStr: string | null = null;

        messages.forEach((msg, idx) => {
            const nextMsg = messages[idx + 1];
            const msgDate = new Date(msg.created_at);
            const msgDateStr = msgDate.toDateString();
            const showDateDivider = msgDateStr !== lastDateStr;
            lastDateStr = msgDateStr;

            // Check if within 5 minutes of previous message from same sender
            const diffMsWithPrev = lastMsgTime ? msgDate.getTime() - lastMsgTime.getTime() : Infinity;
            const isWithin5Min = diffMsWithPrev <= 5 * 60 * 1000;

            const isFirstInGroup = showDateDivider || msg.sender_id !== lastSenderId || !isWithin5Min;

            // Check next message
            let isLastInGroup = true;
            if (nextMsg) {
                const nextDate = new Date(nextMsg.created_at);
                const isSameNextSender = nextMsg.sender_id === msg.sender_id;
                const isNextWithin5Min = nextDate.getTime() - msgDate.getTime() <= 5 * 60 * 1000;
                const isSameNextDay = nextDate.toDateString() === msgDateStr;
                isLastInGroup = !isSameNextSender || !isNextWithin5Min || !isSameNextDay;
            }

            const isDifferentSenderGroup = isFirstInGroup && idx > 0;

            lastSenderId = msg.sender_id;
            lastMsgTime = msgDate;

            result.push({
                item: msg,
                isFirstInGroup,
                isLastInGroup,
                isDifferentSenderGroup,
                showDateDivider,
                dateDividerText: formatDateDivider(msg.created_at),
                parsedTask: parseTaskFromMessage(msg),
            });
        });

        return result;
    }, [messages]);

    // Find the latest message sent by current user to show read receipt
    const myLatestMessageId = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].sender_id === currentUserId && !messages[i].is_deleted) {
                return messages[i].id;
            }
        }
        return null;
    }, [messages, currentUserId]);

    // Active project context from active conversation
    const activeProjectInfo = activeConversation?.project ?? null;
    const sharedFilesList = activeConversation?.shared_files ?? [];
    const pinnedTasksList = activeConversation?.pinned_tasks ?? [];

    return (
        <AppLayout hidePageHeadingBanner={true}>
            <Head title="Messages — ITASK" />

            {/* ══ Three-Pane Messages Layout (16px gap, viewport fill) ════════ */}
            <div className="h-[calc(100vh-6.75rem)] flex gap-4 overflow-hidden select-none">
                {/* ─────────────────────────────────────────────────────────────
                   PANE 1: CONVERSATION LIST (330px, scrollable)
                   Hidden on mobile if viewing thread (< 820px)
                   ───────────────────────────────────────────────────────────── */}
                <section
                    aria-label="Conversation list"
                    className={`w-full min-[820px]:w-[330px] shrink-0 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-card)] flex flex-col overflow-hidden transition-all ${
                        showMobileThread ? 'hidden min-[820px]:flex' : 'flex'
                    }`}
                >
                    {/* Header with 16-20px padding */}
                    <div className="p-4 sm:p-5 border-b border-[var(--border)] space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-extrabold text-[var(--ink)] tracking-tight">
                                Messages
                            </h2>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={() => setIsNewChatModalOpen(true)}
                                className="text-xs px-2.5 py-1 btn-press"
                            >
                                <Plus className="w-3.5 h-3.5 text-[#2A2A2A]" strokeWidth={2.5} />
                                <span>+ New</span>
                            </Button>
                        </div>

                        {/* Search Field */}
                        <div className="relative">
                            <Search className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2 shrink-0" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search messages"
                                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-[var(--border)] bg-[var(--tint-neutral)]/40 text-[var(--ink)] placeholder-[var(--muted)] outline-none focus:border-[#EC7505]"
                            />
                        </div>

                        {/* Filter Pills with Sliding Indicator Feel */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                            {(['all', 'unread', 'projects', 'direct'] as const).map((tab) => {
                                const isActive = filterTab === tab;
                                const label =
                                    tab === 'all'
                                        ? 'All'
                                        : tab === 'unread'
                                        ? 'Unread'
                                        : tab === 'projects'
                                        ? 'Projects'
                                        : 'Direct';

                                return (
                                    <button
                                        key={tab}
                                        type="button"
                                        onClick={() => setFilterTab(tab)}
                                        className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1 btn-press ${
                                            isActive
                                                ? 'bg-[var(--ink)] text-[var(--bg)] shadow-xs'
                                                : 'bg-[var(--tint-neutral)] text-[var(--muted)] hover:text-[var(--ink)]'
                                        }`}
                                    >
                                        <span>{label}</span>
                                        {tab === 'unread' && totalUnreadCount > 0 && (
                                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-[#EC7505] text-[#2A2A2A] animate-badge-pop">
                                                {totalUnreadCount}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Conversation Rows: Equal height, 12px padding, gap-3, ellipsis without wrap */}
                    <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
                        {filteredConversations.length === 0 ? (
                            <div className="p-8 text-center space-y-3 animate-float-once">
                                <div className="w-12 h-12 rounded-2xl bg-[var(--tint-neutral)] flex items-center justify-center text-[var(--muted)] mx-auto">
                                    <MessageSquare className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-[var(--ink)]">
                                        No messages yet
                                    </h3>
                                    <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">
                                        Chat with your project members here.
                                    </p>
                                </div>
                                <div className="pt-2">
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => setIsNewChatModalOpen(true)}
                                        className="btn-press"
                                    >
                                        Start a conversation
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            filteredConversations.map((conv) => {
                                const isSelected = activeConversation?.id === conv.id;
                                const isDirect = conv.type === 'direct';
                                const hasUnread = conv.unread_count > 0;
                                const timeStr = conv.latest_message
                                    ? formatConversationTime(conv.latest_message.created_at)
                                    : formatConversationTime(conv.updated_at);

                                const latestSnippet = conv.latest_message
                                    ? conv.latest_message.is_deleted
                                        ? 'This message was deleted'
                                        : `${
                                              conv.latest_message.sender_name === page.props.auth?.user?.name
                                                  ? 'You: '
                                                  : ''
                                          }${conv.latest_message.body || conv.latest_message.attachment_name || 'Attachment'}`
                                    : 'No messages yet';

                                return (
                                    <button
                                        key={conv.id}
                                        type="button"
                                        onClick={() => handleSelectConversation(conv.id)}
                                        className={`w-full h-[72px] p-3 text-left transition-colors flex items-center gap-3 cursor-pointer group ${
                                            isSelected
                                                ? 'bg-[var(--tint-yellow)] border-l-4 border-l-[#FFBB00]'
                                                : 'hover:bg-[var(--tint-neutral)]/40 bg-transparent'
                                        }`}
                                    >
                                        {/* Avatar with Online indicator */}
                                        <div className="relative shrink-0">
                                            <Avatar size="md" className="ring-2 ring-[var(--border)]">
                                                <AvatarFallback
                                                    className={`text-xs font-extrabold ${
                                                        isDirect
                                                            ? 'bg-[#FFBB00] text-[#2A2A2A]'
                                                            : 'bg-[var(--tint-orange)] text-[#EC7505]'
                                                    }`}
                                                >
                                                    {getInitials(conv.title)}
                                                </AvatarFallback>
                                            </Avatar>
                                            {isDirect && (
                                                <span
                                                    className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[var(--card)] absolute -bottom-0.5 -right-0.5"
                                                    title="Online"
                                                />
                                            )}
                                        </div>

                                        {/* Name, Snippet, Badge: No wrapping */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-1">
                                                <p
                                                    className={`text-xs truncate ${
                                                        hasUnread
                                                            ? 'font-extrabold text-[var(--ink)]'
                                                            : 'font-bold text-[var(--ink)]'
                                                    }`}
                                                >
                                                    {conv.title}
                                                </p>
                                                <span className="text-[10px] text-[var(--muted)] font-medium shrink-0">
                                                    {timeStr}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between gap-2 mt-1">
                                                <p
                                                    className={`text-xs truncate leading-snug ${
                                                        hasUnread
                                                            ? 'font-bold text-[var(--ink)]'
                                                            : conv.latest_message?.is_deleted
                                                            ? 'italic text-[var(--muted)]'
                                                            : 'text-[var(--muted)]'
                                                    }`}
                                                >
                                                    {latestSnippet}
                                                </p>
                                                {hasUnread && (
                                                    <span className="px-1.5 py-0.5 text-[10px] font-extrabold rounded-full bg-[#EC7505] text-[#2A2A2A] shrink-0 animate-badge-pop">
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
                </section>

                {/* ─────────────────────────────────────────────────────────────
                   PANE 2: CHAT THREAD (flexible, scrollable)
                   Hidden on mobile if not viewing thread (< 820px)
                   ───────────────────────────────────────────────────────────── */}
                <section
                    aria-label="Chat thread"
                    className={`flex-1 min-w-0 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-card)] flex-col overflow-hidden relative ${
                        showMobileThread ? 'flex' : 'hidden min-[820px]:flex'
                    }`}
                >
                    {activeConversation ? (
                        <>
                            {/* Thread Header (16-20px padding) */}
                            <div className="px-5 py-3.5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--card)] shrink-0">
                                <div className="flex items-center gap-3 min-w-0">
                                    <button
                                        type="button"
                                        onClick={() => setShowMobileThread(false)}
                                        className="min-[820px]:hidden p-1.5 -ml-1 rounded-xl text-[var(--muted)] hover:bg-[var(--tint-neutral)] btn-press"
                                        aria-label="Back to conversations list"
                                    >
                                        <ArrowLeft className="w-5 h-5 text-[var(--ink)]" />
                                    </button>

                                    <Avatar size="sm" className="shrink-0 ring-1 ring-[var(--border)]">
                                        <AvatarFallback className="text-[11px] font-extrabold bg-[#FFBB00] text-[#2A2A2A]">
                                            {getInitials(activeConversation.title)}
                                        </AvatarFallback>
                                    </Avatar>

                                    <div className="min-w-0">
                                        <h3 className="text-sm font-extrabold text-[var(--ink)] truncate">
                                            {activeConversation.title}
                                        </h3>
                                        <p className="text-xs text-[var(--muted)] truncate">
                                            {activeConversation.type === 'direct'
                                                ? 'Direct conversation'
                                                : `${participants.length} members · ${activeProjectInfo?.title || 'Project'}`}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                    {/* Member Avatar Stack */}
                                    {participants.length > 0 && (
                                        <div className="hidden sm:flex items-center -space-x-2 overflow-hidden">
                                            {participants.slice(0, 4).map((p) => (
                                                <Avatar
                                                    key={p.id}
                                                    size="xs"
                                                    className="ring-2 ring-[var(--card)] border border-[var(--border)]"
                                                >
                                                    <AvatarFallback className="text-[9px] font-bold bg-[var(--tint-yellow)] text-[#2A2A2A]">
                                                        {getInitials(p.name)}
                                                    </AvatarFallback>
                                                </Avatar>
                                            ))}
                                            {participants.length > 4 && (
                                                <span className="w-6 h-6 rounded-full bg-[var(--tint-neutral)] text-[var(--ink)] text-[9px] font-bold flex items-center justify-center ring-2 ring-[var(--card)]">
                                                    +{participants.length - 4}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Pin Button */}
                                    <button
                                        type="button"
                                        onClick={() => setIsPinned(!isPinned)}
                                        className={`p-2 rounded-xl border transition-colors cursor-pointer btn-press ${
                                            isPinned
                                                ? 'bg-[var(--tint-yellow)] text-[#8A5A00] dark:text-[#FFBB00] border-[#FFE9A8]'
                                                : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--tint-neutral)] border-transparent'
                                        }`}
                                        aria-label={isPinned ? 'Unpin chat' : 'Pin chat'}
                                        title={isPinned ? 'Pinned conversation' : 'Pin conversation'}
                                    >
                                        <Pin className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* ── Messages Container: 16-20px padding, pb-8, bg-[var(--bg)] ── */}
                            <div
                                ref={messagesContainerRef}
                                onScroll={handleScroll}
                                className="flex-1 overflow-y-auto p-4 sm:p-5 pb-8 bg-[var(--bg)]"
                            >
                                {groupedMessages.length === 0 ? (
                                    <div className="py-16 text-center space-y-2 animate-float-once">
                                        <MessageSquare className="w-8 h-8 mx-auto text-[var(--muted)]/50" />
                                        <p className="text-xs font-bold text-[var(--ink)]">
                                            No messages yet
                                        </p>
                                        <p className="text-[11px] text-[var(--muted)]">
                                            Send a message or create a task to start collaborating.
                                        </p>
                                    </div>
                                ) : (
                                    groupedMessages.map((entry) => {
                                        const {
                                            item: msg,
                                            isFirstInGroup,
                                            isLastInGroup,
                                            isDifferentSenderGroup,
                                            showDateDivider,
                                            dateDividerText,
                                            parsedTask,
                                        } = entry;

                                        const isMine = msg.sender_id === currentUserId;
                                        const isDeleted = Boolean(msg.is_deleted);
                                        const isLatestOfMine = myLatestMessageId === msg.id;

                                        return (
                                            <div
                                                key={msg.id}
                                                id={`msg-${msg.id}`}
                                                className={`transition-all ${
                                                    showDateDivider
                                                        ? 'my-6'
                                                        : isDifferentSenderGroup
                                                        ? 'mt-4'
                                                        : 'mt-1'
                                                }`}
                                            >
                                                {/* Date Divider (24px margin around divider) */}
                                                {showDateDivider && (
                                                    <div className="flex items-center justify-center my-6">
                                                        <span className="px-3.5 py-1 rounded-full bg-[var(--card)] border border-[var(--border)] text-[11px] font-bold text-[var(--muted)] shadow-xs">
                                                            {dateDividerText}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Message Row with Action Menu */}
                                                <div
                                                    className={`group relative flex items-start gap-2.5 ${
                                                        isMine ? 'justify-end' : 'justify-start'
                                                    }`}
                                                >
                                                    {/* Other sender Avatar: Aligned to first bubble of group */}
                                                    {!isMine && (
                                                        <div className="w-7 shrink-0">
                                                            {isFirstInGroup ? (
                                                                <Avatar size="sm" className="ring-1 ring-[var(--border)]">
                                                                    <AvatarFallback className="text-[10px] font-bold bg-[var(--tint-neutral)] text-[var(--ink)]">
                                                                        {getInitials(msg.sender.name)}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                            ) : (
                                                                <div className="w-7 h-7" />
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* "..." Action menu for Sender / Leader (hover or touch) */}
                                                    {!isDeleted && (
                                                        <div
                                                            className={`opacity-0 group-hover:opacity-100 max-[820px]:opacity-100 transition-opacity flex items-center self-center shrink-0 ${
                                                                isMine ? 'order-first' : 'order-last'
                                                            }`}
                                                        >
                                                            <div className="relative">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setOpenMenuMessageId(
                                                                            openMenuMessageId === msg.id ? null : msg.id
                                                                        );
                                                                    }}
                                                                    className="p-1 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--card)] transition-colors cursor-pointer"
                                                                    aria-label="Message options"
                                                                    title="Message options"
                                                                >
                                                                    <MoreVertical className="w-4 h-4" />
                                                                </button>

                                                                {/* Dropdown Menu */}
                                                                {openMenuMessageId === msg.id && (
                                                                    <div
                                                                        role="menu"
                                                                        className="absolute right-0 bottom-full mb-1 w-36 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl py-1 z-30 animate-modal-in"
                                                                    >
                                                                        {(isMine ||
                                                                            activeConversation.project_id) && (
                                                                            <button
                                                                                type="button"
                                                                                role="menuitem"
                                                                                onClick={(e) => {
                                                                                    handleOpenDeleteModal(
                                                                                        msg,
                                                                                        e.currentTarget
                                                                                    );
                                                                                }}
                                                                                className="w-full px-3 py-1.5 text-xs text-left text-red-600 dark:text-red-400 hover:bg-red-500/10 flex items-center gap-2 cursor-pointer font-semibold"
                                                                            >
                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                                <span>Delete message</span>
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Message Bubble Body (Max 75% desktop, 92% mobile) */}
                                                    <div
                                                        className={`max-w-[75%] max-[640px]:max-w-[92%] flex flex-col ${
                                                            isMine ? 'items-end' : 'items-start'
                                                        }`}
                                                    >
                                                        {/* Sender Name (Others only, shown on first bubble of group) */}
                                                        {!isMine && isFirstInGroup && (
                                                            <div className="flex items-center gap-2 pl-1 mb-1">
                                                                <span className="text-[11px] font-bold text-[var(--ink)]">
                                                                    {msg.sender.name}
                                                                </span>
                                                            </div>
                                                        )}

                                                        {/* ── Soft-Deleted Tombstone ── */}
                                                        {isDeleted ? (
                                                            <div className="px-3.5 py-2 rounded-2xl bg-[var(--tint-neutral)]/40 border border-dashed border-[var(--border)] text-[var(--muted)] text-xs italic flex items-center gap-1.5 select-none animate-modal-in">
                                                                <Trash2 className="w-3.5 h-3.5 shrink-0 opacity-60" />
                                                                <span>This message was deleted</span>
                                                            </div>
                                                        ) : parsedTask ? (
                                                            /* ── Task Card inside Chat (Section 1 & 4) ── */
                                                            <div
                                                                className={`mt-2 py-3 px-3.5 min-w-[280px] max-[640px]:min-w-0 max-[640px]:w-full rounded-2xl bg-[var(--card)] border border-[var(--border)] border-l-4 border-l-[#EC7505] shadow-xs text-left space-y-2 [overflow-wrap:anywhere] ${
                                                                    msg.isJustCreatedTask
                                                                        ? 'animate-task-highlight'
                                                                        : ''
                                                                }`}
                                                            >
                                                                {parsedTask.is_unavailable ? (
                                                                    <div className="p-2 text-xs italic text-[var(--muted)]">
                                                                        Task no longer available
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <span className="text-xs font-extrabold text-[var(--ink)]">
                                                                                {parsedTask.title}
                                                                            </span>
                                                                            <Badge
                                                                                variant={
                                                                                    parsedTask.status === 'Completed' ||
                                                                                    parsedTask.status === 'Done'
                                                                                        ? 'success'
                                                                                        : parsedTask.status === 'Returned' ||
                                                                                          parsedTask.status === 'Needs revision'
                                                                                        ? 'danger'
                                                                                        : 'warning'
                                                                                }
                                                                            >
                                                                                {parsedTask.status}
                                                                            </Badge>
                                                                        </div>

                                                                        {parsedTask.description && (
                                                                            <p className="text-[11px] text-[var(--ink)] line-clamp-2">
                                                                                {parsedTask.description}
                                                                            </p>
                                                                        )}

                                                                        <div className="flex items-center justify-between text-[11px] text-[var(--muted)] pt-0.5">
                                                                            <span>
                                                                                {parsedTask.due_date
                                                                                    ? `Due ${parsedTask.due_date}`
                                                                                    : 'No date'}
                                                                            </span>
                                                                            <span className="font-medium truncate max-w-[140px]">
                                                                                {parsedTask.assignees &&
                                                                                parsedTask.assignees.length > 0
                                                                                    ? `Assigned: ${parsedTask.assignees.map((a) => a.name).join(', ')}`
                                                                                    : 'Unassigned'}
                                                                            </span>
                                                                        </div>

                                                                        {parsedTask.action_url && (
                                                                            <div className="pt-1 border-t border-[var(--border)]">
                                                                                <a
                                                                                    href={parsedTask.action_url}
                                                                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--link-orange)] hover:underline"
                                                                                >
                                                                                    <span>Open task</span>
                                                                                    <ExternalLink className="w-3 h-3" />
                                                                                </a>
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            /* ── Standard Message Bubble (10px 14px padding, overflow-wrap:anywhere) ── */
                                                            <div
                                                                className={`px-3.5 py-2.5 rounded-2xl text-[14px] leading-relaxed shadow-xs [overflow-wrap:anywhere] ${
                                                                    isMine
                                                                        ? 'bg-[#FFBB00] text-[#2A2A2A] font-medium rounded-br-xs'
                                                                        : 'bg-[var(--card)] text-[var(--ink)] border border-[var(--border)] rounded-bl-xs'
                                                                }`}
                                                            >
                                                                {msg.body && (
                                                                    <p className="whitespace-pre-wrap">{msg.body}</p>
                                                                )}

                                                                {/* Attachment Preview */}
                                                                {msg.attachment_name && (
                                                                    <div className="mt-2 pt-2 border-t border-black/10 dark:border-white/10 flex items-center justify-between gap-3">
                                                                        <div className="flex items-center gap-2 min-w-0">
                                                                            <FileText className="w-4 h-4 shrink-0" />
                                                                            <div className="min-w-0">
                                                                                <p className="text-xs font-bold truncate">
                                                                                    {msg.attachment_name}
                                                                                </p>
                                                                                <p className="text-[10px] opacity-75">
                                                                                    {formatBytes(msg.attachment_size)}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        <a
                                                                            href={`/chat/attachments/${msg.id}`}
                                                                            download
                                                                            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 btn-press"
                                                                            title="Download file"
                                                                            aria-label="Download attachment"
                                                                        >
                                                                            <Download className="w-3.5 h-3.5" />
                                                                        </a>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Timestamp & Read Receipt: 4px below bubble, muted 12px style */}
                                                        {isLastInGroup && !isDeleted && (
                                                            <div
                                                                className={`mt-1 flex items-center gap-2 text-xs text-[var(--muted)] px-1 ${
                                                                    isMine ? 'justify-end' : 'justify-start'
                                                                }`}
                                                            >
                                                                <span>{formatMessageTime(msg.created_at)}</span>

                                                                {/* Read Receipts under sender's most recent message */}
                                                                {isMine && isLatestOfMine && (
                                                                    <ReadReceiptPopover
                                                                        messageId={msg.id}
                                                                        isDirect={activeConversation.type === 'direct'}
                                                                        participants={participants}
                                                                        currentUserId={currentUserId}
                                                                    />
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}

                                {/* Typing indicator: only rendered when active members are typing */}
                                {typingNames.length > 0 && (
                                    <div
                                        className="flex items-center gap-2 pl-9 pt-2 text-xs text-[var(--muted)] animate-fade-in"
                                        aria-live="polite"
                                    >
                                        <div className="flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#EC7505] typing-dot-1" />
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#EC7505] typing-dot-2" />
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#EC7505] typing-dot-3" />
                                        </div>
                                        <span className="italic text-[11px] text-[var(--ink)]/75">
                                            {typingLabel}
                                        </span>
                                    </div>
                                )}

                                <div ref={messagesEndRef} />
                            </div>

                            {/* Floating "New messages" scroll pill if scrolled up */}
                            {hasUnreadBelow && (
                                <button
                                    type="button"
                                    onClick={() => scrollToBottom('smooth')}
                                    className="absolute bottom-28 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-[#EC7505] text-[#2A2A2A] font-extrabold text-xs shadow-lg flex items-center gap-1.5 z-10 cursor-pointer animate-bounce btn-press"
                                    aria-label="Scroll down to new messages"
                                >
                                    <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>New messages</span>
                                </button>
                            )}

                            {/* ── Composer Pane: 14px 18px padding, 10px between quick actions, 8px input gaps ── */}
                            <div className="py-3.5 px-[18px] bg-[var(--card)] border-t border-[var(--border)] shrink-0 space-y-2.5">
                                {/* Quick Actions as Dashed Pill Buttons */}
                                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
                                    {/* Create task from message: OPENS MODAL FIRST */}
                                    <button
                                        type="button"
                                        onClick={() => setIsCreateTaskModalOpen(true)}
                                        className="px-3 py-1 rounded-full border border-dashed border-[var(--border)] hover:border-[#EC7505] hover:bg-[var(--tint-orange)] text-[var(--ink)] font-bold transition-colors whitespace-nowrap cursor-pointer btn-press"
                                    >
                                        + Create task from message
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="px-3 py-1 rounded-full border border-dashed border-[var(--border)] hover:border-[#EC7505] hover:bg-[var(--tint-neutral)] text-[var(--ink)] font-bold transition-colors whitespace-nowrap cursor-pointer btn-press"
                                    >
                                        Share file
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleSendMessage('🗓️ Scheduled a quick team check-in on project milestones.');
                                        }}
                                        className="px-3 py-1 rounded-full border border-dashed border-[var(--border)] hover:border-[#EC7505] hover:bg-[var(--tint-neutral)] text-[var(--ink)] font-bold transition-colors whitespace-nowrap cursor-pointer btn-press"
                                    >
                                        Schedule meeting
                                    </button>
                                </div>

                                {/* Attachment Chip Preview */}
                                {selectedFile && (
                                    <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--tint-neutral)] border border-[var(--border)] text-xs animate-modal-in">
                                        <div className="flex items-center gap-2 truncate">
                                            <FileText className="w-4 h-4 text-[#EC7505]" />
                                            <span className="font-bold text-[var(--ink)] truncate">
                                                {selectedFile.name}
                                            </span>
                                            <span className="text-[10px] text-[var(--muted)]">
                                                ({formatBytes(selectedFile.size)})
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedFile(null);
                                                if (fileInputRef.current) fileInputRef.current.value = '';
                                            }}
                                            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                                            aria-label="Remove attachment"
                                        >
                                            <X className="w-3.5 h-3.5 text-[var(--muted)]" />
                                        </button>
                                    </div>
                                )}

                                {/* Input Row with Attach, Field, Emoji, Send (8px gaps) */}
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }}
                                    className="flex items-end gap-2 p-1.5 rounded-2xl border border-[var(--border)] bg-[var(--card)] focus-within:border-[#EC7505] focus-within:ring-1 focus-within:ring-[#EC7505] transition-all"
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0] ?? null;
                                            setSelectedFile(file);
                                        }}
                                    />

                                    {/* Attach Button */}
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-2 rounded-xl text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--tint-neutral)] transition-colors cursor-pointer shrink-0 btn-press"
                                        aria-label="Attach file"
                                        title="Attach file"
                                    >
                                        <Paperclip className="w-5 h-5" />
                                    </button>

                                    {/* Textarea Field */}
                                    <textarea
                                        ref={textareaRef}
                                        rows={1}
                                        value={messageText}
                                        onChange={handleComposerChange}
                                        onBlur={handleComposerBlur}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Write a message. Use @ to mention someone"
                                        className="flex-1 py-1.5 px-2 bg-transparent text-sm text-[var(--ink)] placeholder-[var(--muted)] outline-none resize-none max-h-28 overflow-y-auto leading-relaxed border-none ring-0 focus:ring-0"
                                    />

                                    {/* Emoji Button */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMessageText((prev) => prev + ' 👍 ');
                                            sendTypingWhisper(true);
                                            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                                            typingTimeoutRef.current = setTimeout(() => {
                                                sendTypingWhisper(false);
                                            }, 2500);
                                        }}
                                        className="p-2 rounded-xl text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--tint-neutral)] transition-colors cursor-pointer shrink-0 btn-press"
                                        aria-label="Insert emoji"
                                        title="Insert emoji"
                                    >
                                        <Smile className="w-5 h-5" />
                                    </button>

                                    {/* Primary Orange Send Button (#2A2A2A text) */}
                                    <button
                                        type="submit"
                                        disabled={isSending || (!messageText.trim() && !selectedFile)}
                                        className="btn-primary-orange p-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer shadow-xs btn-press"
                                        aria-label="Send message"
                                        title="Send message (Enter)"
                                    >
                                        <Send className="w-4 h-4 text-[#2A2A2A]" strokeWidth={2.5} />
                                    </button>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center p-8 text-center bg-[var(--bg)] animate-float-once">
                            <div className="max-w-sm space-y-3">
                                <div className="w-12 h-12 rounded-2xl bg-[var(--tint-yellow)] flex items-center justify-center text-[#8A5A00] dark:text-[#FFBB00] mx-auto">
                                    <MessageSquare className="w-6 h-6" />
                                </div>
                                <h3 className="text-base font-bold text-[var(--ink)]">
                                    Select a conversation
                                </h3>
                                <p className="text-xs text-[var(--muted)]">
                                    Choose an existing channel or start a new direct chat with a teammate.
                                </p>
                            </div>
                        </div>
                    )}
                </section>

                {/* ─────────────────────────────────────────────────────────────
                   PANE 3: DETAILS PANEL (290px, scrollable)
                   Hidden below 1250px per spec: "Below 1250px hide the details panel"
                   ───────────────────────────────────────────────────────────── */}
                <aside
                    aria-label="Conversation details"
                    className="hidden min-[1250px]:flex w-[290px] shrink-0 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-card)] flex-col overflow-y-auto divide-y divide-[var(--border)]"
                >
                    {activeConversation ? (
                        <>
                            {/* Section 1: Project Overview */}
                            <div className="p-4 space-y-3">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                                    Project
                                </p>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-[var(--tint-yellow)] flex items-center justify-center text-[#8A5A00] dark:text-[#FFBB00] shrink-0">
                                            <FolderOpen className="w-4 h-4" />
                                        </div>
                                        <h4 className="text-xs font-bold text-[var(--ink)] truncate">
                                            {activeProjectInfo?.title || 'Capstone Project'}
                                        </h4>
                                    </div>

                                    {/* Progress Bar with filling animation */}
                                    <div>
                                        <div className="flex items-center justify-between text-[11px] mb-1">
                                            <span className="text-[var(--muted)]">Progress</span>
                                            <span className="font-extrabold text-[var(--ink)]">
                                                {activeProjectInfo?.progress ?? 0}%
                                            </span>
                                        </div>
                                        <div className="w-full h-1.5 bg-[var(--tint-neutral)] rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-[#EC7505] rounded-full transition-all duration-500 ease-out"
                                                style={{ width: `${activeProjectInfo?.progress ?? 0}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Members */}
                            <div className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                                        Members ({participants.length})
                                    </p>
                                </div>
                                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                                    {participants.map((member) => (
                                        <div key={member.id} className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="relative shrink-0">
                                                    <Avatar size="xs">
                                                        <AvatarFallback className="text-[9px] font-bold bg-[#FFBB00] text-[#2A2A2A]">
                                                            {getInitials(member.name)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-[var(--card)] absolute -bottom-0.5 -right-0.5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-[var(--ink)] truncate">
                                                        {member.name}
                                                    </p>
                                                    <p className="text-[10px] text-[var(--muted)] truncate">
                                                        {member.role || 'Member'}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                                Online
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Section 3: Shared Files */}
                            <div className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                                        Shared Files
                                    </p>
                                </div>
                                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                                    {sharedFilesList.length === 0 ? (
                                        <p className="text-[11px] text-[var(--muted)] italic">
                                            No files shared yet
                                        </p>
                                    ) : (
                                        sharedFilesList.map((file) => (
                                            <div
                                                key={file.id}
                                                className="flex items-center justify-between p-2 rounded-xl bg-[var(--tint-neutral)]/40 hover:bg-[var(--tint-neutral)] transition-colors group"
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <FileText className="w-4 h-4 text-[#EC7505] shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-[var(--ink)] truncate">
                                                            {file.name}
                                                        </p>
                                                        <p className="text-[10px] text-[var(--muted)]">
                                                            {formatBytes(file.size)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <a
                                                    href={file.download_url}
                                                    download
                                                    className="p-1 rounded text-[var(--muted)] group-hover:text-[var(--ink)] btn-press"
                                                    title="Download"
                                                    aria-label="Download shared file"
                                                >
                                                    <Download className="w-3.5 h-3.5" />
                                                </a>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Section 4: Pinned Tasks */}
                            <div className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                                        Pinned Tasks
                                    </p>
                                    <Pin className="w-3.5 h-3.5 text-[var(--muted)]" />
                                </div>
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {pinnedTasksList.length === 0 ? (
                                        <p className="text-[11px] text-[var(--muted)] italic">
                                            No pinned tasks in this channel
                                        </p>
                                    ) : (
                                        pinnedTasksList.map((task) => (
                                            <a
                                                key={task.id}
                                                href={task.action_url}
                                                className="block p-2.5 rounded-xl border border-[var(--border)] hover:border-[#EC7505] bg-[var(--card)] shadow-xs transition-colors group card-hover"
                                            >
                                                <div className="flex items-start justify-between gap-1">
                                                    <span className="text-xs font-bold text-[var(--ink)] group-hover:text-[#EC7505] transition-colors truncate">
                                                        {task.title}
                                                    </span>
                                                    <Badge
                                                        variant={
                                                            task.status === 'Completed'
                                                                ? 'success'
                                                                : task.status === 'Returned'
                                                                ? 'danger'
                                                                : 'warning'
                                                        }
                                                    >
                                                        {task.status}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center justify-between text-[10px] text-[var(--muted)] mt-1.5">
                                                    <span>{task.due_date_formatted}</span>
                                                    <span>{task.assignee_name}</span>
                                                </div>
                                            </a>
                                        ))
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="p-6 text-center text-xs text-[var(--muted)]">
                            No conversation selected
                        </div>
                    )}
                </aside>
            </div>

            {/* ══ Create Task From Message Modal (Section 4) ═══════════════════ */}
            <CreateTaskModal
                isOpen={isCreateTaskModalOpen}
                onClose={() => setIsCreateTaskModalOpen(false)}
                conversationId={activeConversation?.id || 0}
                conversationProjectId={activeConversation?.project_id}
                conversationProjectTitle={activeConversation?.project?.title}
                availableMembers={participants}
                userProjects={userProjects}
                currentUserId={currentUserId}
                prefilledText={messageText}
                onTaskCreated={handleTaskCreated}
            />

            {/* ══ Delete Message Confirm Modal (Section 3) ═════════════════════ */}
            <DeleteMessageModal
                isOpen={Boolean(messagePendingDelete)}
                onClose={() => setMessagePendingDelete(null)}
                onConfirm={handleConfirmDelete}
                isDeleting={isDeletingMessage}
                hasTaskCard={Boolean(messagePendingDelete?.task_id || messagePendingDelete?.task)}
                triggerButtonRef={triggerMenuButtonRef}
            />

            {/* ══ 5-Second Undo Toast (Section 3 & 5) ══════════════════════════ */}
            {undoMessageId && (
                <UndoToast
                    messageId={undoMessageId}
                    onUndo={handleUndoDelete}
                    onDismiss={() => setUndoMessageId(null)}
                    durationMs={5000}
                />
            )}

            {/* ══ Start New Direct Chat Modal ══════════════════════════════════ */}
            {isNewChatModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-backdrop-in"
                    onClick={() => setIsNewChatModalOpen(false)}
                >
                    <div
                        className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden animate-modal-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-[var(--tint-orange)] flex items-center justify-center text-[#EC7505]">
                                    <MessageSquare className="w-4 h-4" />
                                </div>
                                <h3 className="text-sm font-bold text-[var(--ink)]">
                                    Start New Direct Chat
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsNewChatModalOpen(false)}
                                className="p-1 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--tint-neutral)] cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-4 space-y-3">
                            <div className="relative">
                                <Search className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={userSearchTerm}
                                    onChange={(e) => setUserSearchTerm(e.target.value)}
                                    placeholder="Search student or faculty name..."
                                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--ink)] placeholder-[var(--muted)] outline-none focus:border-[#EC7505]"
                                />
                            </div>

                            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                                {availableUsers
                                    .filter(
                                        (u) =>
                                            u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                                            u.email.toLowerCase().includes(userSearchTerm.toLowerCase())
                                    )
                                    .map((user) => (
                                        <button
                                            key={user.id}
                                            type="button"
                                            disabled={isStartingChat === user.id}
                                            onClick={() => handleStartDirectChat(user.id)}
                                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[var(--tint-neutral)] text-left transition-colors cursor-pointer group btn-press"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <Avatar size="sm">
                                                    <AvatarFallback className="text-[10px] font-bold bg-[#FFBB00] text-[#2A2A2A]">
                                                        {getInitials(user.name)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-[var(--ink)] group-hover:text-[#EC7505] truncate">
                                                        {user.name}
                                                    </p>
                                                    <p className="text-[10px] text-[var(--muted)] truncate">
                                                        {user.email}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-xs font-bold text-[var(--link-orange)] shrink-0">
                                                Chat
                                            </span>
                                        </button>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
