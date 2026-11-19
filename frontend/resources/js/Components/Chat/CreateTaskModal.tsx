import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import {
    X,
    Calendar as CalendarIcon,
    AlertCircle,
    UserCheck,
    Check,
    Search,
    Loader2,
    CheckSquare,
    FolderOpen,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/Components/ui/avatar';
import { Button } from '@/Components/Button';

interface Member {
    id: number;
    name: string;
    email: string;
}

interface ProjectOption {
    id: number;
    title: string;
    members?: Member[];
}

interface CreateTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    conversationId: number;
    conversationProjectId?: number | null;
    conversationProjectTitle?: string | null;
    availableMembers: Member[];
    userProjects: ProjectOption[];
    currentUserId: number;
    prefilledText?: string;
    onTaskCreated: (createdData: { task: any; message: any }) => void;
}

function getInitials(name: string): string {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join('');
}

export function CreateTaskModal({
    isOpen,
    onClose,
    conversationId,
    conversationProjectId,
    conversationProjectTitle,
    availableMembers,
    userProjects,
    currentUserId,
    prefilledText = '',
    onTaskCreated,
}: CreateTaskModalProps) {
    // Form fields
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<number[]>([]);
    const [dueDate, setDueDate] = useState('');
    const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
        conversationProjectId ?? (userProjects[0]?.id ?? null)
    );

    // Member search inside modal
    const [memberSearchTerm, setMemberSearchTerm] = useState('');

    // Submission & validation state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorSummary, setErrorSummary] = useState<string | null>(null);
    const [errors, setErrors] = useState<{
        title?: string;
        assignees?: string;
        dueDate?: string;
        project?: string;
    }>({});

    // Dirty state for discard confirmation
    const [isDirty, setIsDirty] = useState(false);
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

    // Form element refs for focus-on-error
    const titleInputRef = useRef<HTMLInputElement | null>(null);
    const assigneeContainerRef = useRef<HTMLDivElement | null>(null);
    const dateInputRef = useRef<HTMLInputElement | null>(null);
    const projectSelectRef = useRef<HTMLSelectElement | null>(null);

    // Minimum date is today in local time format (YYYY-MM-DD)
    const todayStr = useMemo(() => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }, []);

    // Prefill title when modal opens
    useEffect(() => {
        if (isOpen) {
            const cleanText = prefilledText.replace(/\[task:.*?\]/g, '').trim();
            const lines = cleanText.split('\n').map((l) => l.trim()).filter(Boolean);
            const firstLine = lines[0] || '';
            const remainingLines = lines.slice(1).join('\n').trim();
            const initialTitle = firstLine.length > 120 ? firstLine.slice(0, 117) + '...' : firstLine;
            setTitle(initialTitle);
            setDescription(remainingLines || '');
            // Default due date: tomorrow or today
            setDueDate(todayStr);
            setPriority('Medium');
            setSelectedAssigneeIds([]);
            setErrors({});
            setErrorSummary(null);
            setIsDirty(false);
            setShowDiscardConfirm(false);
            setSelectedProjectId(conversationProjectId ?? (userProjects[0]?.id ?? null));

            setTimeout(() => {
                titleInputRef.current?.focus();
            }, 100);
        }
    }, [isOpen, prefilledText, conversationProjectId, userProjects, todayStr]);

    // Active project members
    const activeProjectMembers = useMemo(() => {
        if (conversationProjectId && availableMembers.length > 0) {
            return availableMembers;
        }
        if (selectedProjectId) {
            const proj = userProjects.find((p) => p.id === selectedProjectId);
            if (proj?.members && proj.members.length > 0) {
                return proj.members;
            }
        }
        return availableMembers;
    }, [conversationProjectId, selectedProjectId, availableMembers, userProjects]);

    // Filter members based on search
    const filteredMembers = useMemo(() => {
        if (!memberSearchTerm.trim()) return activeProjectMembers;
        const term = memberSearchTerm.toLowerCase();
        return activeProjectMembers.filter(
            (m) => m.name.toLowerCase().includes(term) || m.email.toLowerCase().includes(term)
        );
    }, [activeProjectMembers, memberSearchTerm]);

    // Track dirty state
    const handleFieldChange = () => {
        if (!isDirty) setIsDirty(true);
    };

    // "Assign to me" shortcut
    const handleAssignToMe = () => {
        handleFieldChange();
        if (!selectedAssigneeIds.includes(currentUserId)) {
            setSelectedAssigneeIds((prev) => [...prev, currentUserId]);
        }
        setErrors((prev) => ({ ...prev, assignees: undefined }));
    };

    const toggleAssignee = (memberId: number) => {
        handleFieldChange();
        setSelectedAssigneeIds((prev) =>
            prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
        );
        setErrors((prev) => ({ ...prev, assignees: undefined }));
    };

    // Close requested: check dirty
    const handleRequestClose = () => {
        if (isDirty) {
            setShowDiscardConfirm(true);
        } else {
            onClose();
        }
    };

    // Form submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorSummary(null);

        const newErrors: typeof errors = {};

        // 1. Title validation
        if (!title.trim()) {
            newErrors.title = 'Add a title';
        } else if (title.trim().length > 120) {
            newErrors.title = 'Title must be 120 characters or less';
        }

        // 2. Assignees validation
        if (selectedAssigneeIds.length === 0) {
            newErrors.assignees = 'Pick at least one person';
        }

        // 3. Due date validation
        if (!dueDate) {
            newErrors.dueDate = 'Choose a due date';
        } else if (dueDate < todayStr) {
            newErrors.dueDate = 'Choose a date that is today or later';
        }

        // 4. Project validation
        const targetProjectId = conversationProjectId ?? selectedProjectId;
        if (!targetProjectId) {
            newErrors.project = 'Select a project for this task';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            // Move focus to first invalid field
            if (newErrors.title) {
                titleInputRef.current?.focus();
            } else if (newErrors.assignees) {
                assigneeContainerRef.current?.focus();
            } else if (newErrors.dueDate) {
                dateInputRef.current?.focus();
            } else if (newErrors.project) {
                projectSelectRef.current?.focus();
            }
            return;
        }

        setIsSubmitting(true);

        const idempotencyKey = `task_${conversationId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        try {
            const metaToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content;
            const match = typeof document !== 'undefined' ? document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/) : null;
            const xsrfCookie = match ? decodeURIComponent(match[1]) : '';

            const headers: Record<string, string> = {
                Accept: 'application/json',
            };
            if (metaToken) headers['X-CSRF-TOKEN'] = metaToken;
            if (xsrfCookie) headers['X-XSRF-TOKEN'] = xsrfCookie;

            const response = await axios.post(`/chat/${conversationId}/tasks`, {
                title: title.trim(),
                description: description.trim() || null,
                assignee_ids: selectedAssigneeIds,
                due_date: dueDate,
                priority,
                project_id: targetProjectId,
                idempotency_key: idempotencyKey,
            }, {
                headers,
            });

            const data = response.data;

            // Success
            setIsSubmitting(false);
            onTaskCreated({
                task: data.task,
                message: data.message,
            });
            onClose();
        } catch (err: any) {
            setIsSubmitting(false);
            const msg =
                err.response?.data?.message ||
                (err.response?.data?.errors ? Object.values(err.response.data.errors).flat().join(' ') : null) ||
                err.message ||
                "Couldn't create the task. Nothing was sent. Try again.";
            setErrorSummary(msg);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 max-[640px]:p-0 max-[640px]:items-end bg-black/60 backdrop-blur-xs animate-backdrop-in select-none"
            onClick={handleRequestClose}
            role="presentation"
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-task-title"
                className="w-full max-w-[520px] max-[640px]:max-w-none bg-[color:var(--card)] border border-[color:var(--border)] rounded-[18px] max-[640px]:rounded-b-none shadow-2xl overflow-hidden animate-modal-in flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Modal Header ── */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--border)] shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[color:var(--status-primary-bg)] text-[color:var(--primary)] flex items-center justify-center">
                            <CheckSquare className="w-4 h-4 stroke-[2.5]" />
                        </div>
                        <div>
                            <h3 id="create-task-title" className="text-base font-extrabold text-[color:var(--text)]">
                                Create a task
                            </h3>
                            <p className="text-xs text-[color:var(--muted)]">
                                Creates task and shares an interactive card in chat
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleRequestClose}
                        className="p-1.5 rounded-lg text-[color:var(--muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] transition-colors cursor-pointer msg-interactive"
                        aria-label="Close modal"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* ── Form Body (Scrollable) ── */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                    {/* Top Error Alert */}
                    {errorSummary && (
                        <div
                            role="alert"
                            className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 flex items-start gap-2.5"
                        >
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                                <p className="font-bold">Task creation failed</p>
                                <p className="text-[11px] opacity-90">{errorSummary}</p>
                            </div>
                        </div>
                    )}

                    {/* 1. Task Title (Required, max 120) */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <label htmlFor="task-title-input" className="font-bold text-[color:var(--text)]">
                                Task Title <span className="text-[color:var(--primary)]">*</span>
                            </label>
                            <span className="text-[10px] text-[color:var(--muted)]">{title.length}/120</span>
                        </div>
                        <input
                            ref={titleInputRef}
                            id="task-title-input"
                            type="text"
                            maxLength={120}
                            value={title}
                            onChange={(e) => {
                                setTitle(e.target.value);
                                handleFieldChange();
                                if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
                            }}
                            placeholder="e.g. Design wireframes for sprint review"
                            className={`w-full px-3.5 py-2 rounded-xl border bg-[color:var(--card)] text-[color:var(--text)] outline-none transition-colors ${
                                errors.title
                                    ? 'border-red-500 focus:ring-1 focus:ring-red-500'
                                    : 'border-[color:var(--border)] focus:border-[color:var(--primary)]'
                            }`}
                        />
                        {errors.title && (
                            <p className="text-[11px] font-bold text-red-600 dark:text-red-400">
                                {errors.title}
                            </p>
                        )}
                    </div>

                    {/* 2. Description (Optional, multi-line) */}
                    <div className="space-y-1">
                        <label htmlFor="task-desc-input" className="font-bold text-[color:var(--text)]">
                            Description <span className="font-normal text-[color:var(--muted)]">(optional)</span>
                        </label>
                        <textarea
                            id="task-desc-input"
                            rows={3}
                            value={description}
                            onChange={(e) => {
                                setDescription(e.target.value);
                                handleFieldChange();
                            }}
                            placeholder="Add deliverables, criteria, or context..."
                            className="w-full px-3.5 py-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)] outline-none focus:border-[color:var(--primary)] resize-none leading-relaxed"
                        />
                    </div>

                    {/* 3. Project Selection (Always prefilled and read-only in project chats) */}
                    <div className="space-y-1">
                        <label className="font-bold text-[color:var(--text)]">
                            Project
                        </label>
                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[color:var(--soft-surface)]/50 border border-[color:var(--border)] text-[color:var(--text)] font-semibold">
                            <FolderOpen className="w-4 h-4 text-[color:var(--primary)]" />
                            <span className="truncate">
                                {conversationProjectTitle || 'Current Project'}
                            </span>
                            <span className="ml-auto text-[10px] text-[color:var(--muted)] font-medium">Locked to project</span>
                        </div>
                    </div>

                    {/* 4. Assign To (Searchable multi-select + "Assign to me") */}
                    <div className="space-y-1.5" ref={assigneeContainerRef} tabIndex={-1}>
                        <div className="flex items-center justify-between">
                            <label className="font-bold text-[color:var(--text)]">
                                Assign to <span className="text-[color:var(--primary)]">*</span>
                            </label>
                            <button
                                type="button"
                                onClick={handleAssignToMe}
                                className="text-[11px] font-bold text-[color:var(--primary)] hover:underline cursor-pointer flex items-center gap-1"
                            >
                                <UserCheck className="w-3 h-3" />
                                <span>Assign to me</span>
                            </button>
                        </div>

                        {/* Search field */}
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 text-[color:var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={memberSearchTerm}
                                onChange={(e) => setMemberSearchTerm(e.target.value)}
                                placeholder="Search project members..."
                                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)] outline-none focus:border-[color:var(--primary)]"
                            />
                        </div>

                        {/* Member checkable list */}
                        <div
                            className={`max-h-36 overflow-y-auto space-y-1 p-1 rounded-xl border ${
                                errors.assignees
                                    ? 'border-red-500'
                                    : 'border-[color:var(--border)] bg-[color:var(--soft-surface)]/20'
                            }`}
                        >
                            {filteredMembers.length === 0 ? (
                                <p className="p-3 text-center text-[11px] text-[color:var(--muted)] italic">
                                    No members found in this project
                                </p>
                            ) : (
                                filteredMembers.map((member) => {
                                    const isSelected = selectedAssigneeIds.includes(member.id);
                                    return (
                                        <button
                                            key={member.id}
                                            type="button"
                                            onClick={() => toggleAssignee(member.id)}
                                            className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors cursor-pointer msg-interactive ${
                                                isSelected
                                                    ? 'bg-[color:var(--status-primary-bg)] text-[color:var(--primary)] font-bold'
                                                    : 'hover:bg-[color:var(--soft-surface)]/40 text-[color:var(--text)]'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Avatar size="sm">
                                                    <AvatarFallback className="text-[9px] font-bold bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)]">
                                                        {getInitials(member.name)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0">
                                                    <p className="font-bold truncate">{member.name}</p>
                                                    <p className="text-[10px] text-[color:var(--muted)] truncate">
                                                        {member.email}
                                                    </p>
                                                </div>
                                            </div>
                                            <div
                                                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                                    isSelected
                                                        ? 'bg-[color:var(--primary)] border-[color:var(--primary)] text-white'
                                                        : 'border-[color:var(--border)] bg-[color:var(--card)]'
                                                }`}
                                            >
                                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                        {errors.assignees && (
                            <p className="text-[11px] font-bold text-red-600 dark:text-red-400">
                                {errors.assignees}
                            </p>
                        )}
                    </div>

                    {/* 5. Row: Due Date & Priority */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                        {/* Due Date (No past dates) */}
                        <div className="space-y-1">
                            <label htmlFor="task-due-date" className="font-bold text-[color:var(--text)]">
                                Due date <span className="text-[color:var(--primary)]">*</span>
                            </label>
                            <input
                                ref={dateInputRef}
                                id="task-due-date"
                                type="date"
                                min={todayStr}
                                value={dueDate}
                                onChange={(e) => {
                                    setDueDate(e.target.value);
                                    handleFieldChange();
                                    if (errors.dueDate) setErrors((prev) => ({ ...prev, dueDate: undefined }));
                                }}
                                className={`w-full px-3 py-2 rounded-xl border bg-[color:var(--card)] text-[color:var(--text)] outline-none ${
                                    errors.dueDate
                                        ? 'border-red-500'
                                        : 'border-[color:var(--border)] focus:border-[color:var(--primary)]'
                                }`}
                            />
                            {errors.dueDate && (
                                <p className="text-[11px] font-bold text-red-600 dark:text-red-400">
                                    {errors.dueDate}
                                </p>
                            )}
                        </div>

                        {/* Priority: Low, Medium, High */}
                        <div className="space-y-1">
                            <label className="font-bold text-[color:var(--text)]">Priority</label>
                            <div className="flex items-center gap-1.5 pt-0.5">
                                {(['Low', 'Medium', 'High'] as const).map((p) => {
                                    const isSelected = priority === p;
                                    return (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => {
                                                setPriority(p);
                                                handleFieldChange();
                                            }}
                                            className={`flex-1 py-2 text-center rounded-xl font-bold transition-all cursor-pointer msg-interactive ${
                                                isSelected
                                                    ? p === 'High'
                                                        ? 'bg-red-500 text-white shadow-xs'
                                                        : p === 'Low'
                                                        ? 'bg-emerald-600 text-white shadow-xs'
                                                        : 'bg-[color:var(--primary)] text-white shadow-xs'
                                                    : 'border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted)] hover:text-[color:var(--text)]'
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* ── Modal Footer ── */}
                    <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[color:var(--border)] shrink-0">
                        <button
                            type="button"
                            onClick={handleRequestClose}
                            disabled={isSubmitting}
                            className="px-4 py-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] hover:bg-[color:var(--soft-surface)] text-[color:var(--text)] font-bold transition-colors cursor-pointer disabled:opacity-50 msg-interactive"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-4 py-2 rounded-xl font-bold bg-[color:var(--primary-btn)] hover:bg-[color:var(--primary-btn-hover)] text-white shadow-xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2 msg-interactive"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Creating & sending...</span>
                                </>
                            ) : (
                                <span>Create task and send</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* ── Discard Confirmation Dialog ── */}
            {showDiscardConfirm && (
                <div
                    role="alertdialog"
                    aria-modal="true"
                    aria-labelledby="discard-title"
                    className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-backdrop-in"
                    onClick={() => setShowDiscardConfirm(false)}
                >
                    <div
                        className="w-full max-w-sm bg-[color:var(--card)] border border-[color:var(--border)] rounded-2xl shadow-2xl p-5 space-y-4 animate-modal-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="space-y-1">
                            <h4 id="discard-title" className="text-sm font-bold text-[color:var(--text)]">
                                Discard this task?
                            </h4>
                            <p className="text-xs text-[color:var(--muted)]">
                                The information you entered will not be saved. Your message text in the composer will remain intact.
                            </p>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowDiscardConfirm(false)}
                                className="px-3.5 py-1.5 rounded-xl border border-[color:var(--border)] text-xs font-bold text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] msg-interactive"
                            >
                                Continue editing
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowDiscardConfirm(false);
                                    onClose();
                                }}
                                className="px-3.5 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 msg-interactive"
                            >
                                Discard
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
