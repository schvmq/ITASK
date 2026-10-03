import React, { useState, useEffect, useRef, useMemo } from 'react';
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
            const initialTitle = cleanText.length > 120 ? cleanText.slice(0, 117) + '...' : cleanText;
            setTitle(initialTitle);
            setDescription('');
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
            const csrfToken =
                (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';

            const response = await fetch(`/chat/${conversationId}/tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim() || null,
                    assignee_ids: selectedAssigneeIds,
                    due_date: dueDate,
                    priority,
                    project_id: targetProjectId,
                    idempotency_key: idempotencyKey,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Couldn't create the task. Nothing was sent. Try again.");
            }

            // Success
            setIsSubmitting(false);
            onTaskCreated({
                task: data.task,
                message: data.message,
            });
            onClose();
        } catch (err: any) {
            setIsSubmitting(false);
            setErrorSummary(err.message || "Couldn't create the task. Nothing was sent. Try again.");
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
                className="w-full max-w-[520px] max-[640px]:max-w-none bg-[var(--card)] border border-[var(--border)] rounded-[18px] max-[640px]:rounded-b-none shadow-2xl overflow-hidden animate-modal-in flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Modal Header ── */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[#EC7505]/15 text-[#EC7505] flex items-center justify-center">
                            <CheckSquare className="w-4 h-4 stroke-[2.5]" />
                        </div>
                        <div>
                            <h3 id="create-task-title" className="text-base font-extrabold text-[var(--ink)]">
                                Create a task
                            </h3>
                            <p className="text-xs text-[var(--muted)]">
                                Creates task and shares an interactive card in chat
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleRequestClose}
                        className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--tint-neutral)] transition-colors cursor-pointer"
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
                            <label htmlFor="task-title-input" className="font-bold text-[var(--ink)]">
                                Task Title <span className="text-[#EC7505]">*</span>
                            </label>
                            <span className="text-[10px] text-[var(--muted)]">{title.length}/120</span>
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
                            className={`w-full px-3.5 py-2 rounded-xl border bg-[var(--card)] text-[var(--ink)] outline-none transition-colors ${
                                errors.title
                                    ? 'border-red-500 focus:ring-1 focus:ring-red-500'
                                    : 'border-[var(--border)] focus:border-[#EC7505]'
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
                        <label htmlFor="task-desc-input" className="font-bold text-[var(--ink)]">
                            Description <span className="font-normal text-[var(--muted)]">(optional)</span>
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
                            className="w-full px-3.5 py-2 rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--ink)] outline-none focus:border-[#EC7505] resize-none leading-relaxed"
                        />
                    </div>

                    {/* 3. Project Selection (Read-only in group chats, selectable in direct chats) */}
                    <div className="space-y-1">
                        <label htmlFor="task-project-select" className="font-bold text-[var(--ink)]">
                            Project <span className="text-[#EC7505]">*</span>
                        </label>
                        {conversationProjectId ? (
                            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--tint-neutral)]/50 border border-[var(--border)] text-[var(--ink)] font-semibold">
                                <FolderOpen className="w-4 h-4 text-[#EC7505]" />
                                <span className="truncate">
                                    {conversationProjectTitle || 'Current Project Channel'}
                                </span>
                                <span className="ml-auto text-[10px] text-[var(--muted)]">Locked to channel</span>
                            </div>
                        ) : (
                            <select
                                ref={projectSelectRef}
                                id="task-project-select"
                                value={selectedProjectId ?? ''}
                                onChange={(e) => {
                                    setSelectedProjectId(Number(e.target.value) || null);
                                    handleFieldChange();
                                    if (errors.project) setErrors((prev) => ({ ...prev, project: undefined }));
                                }}
                                className={`w-full px-3 py-2 rounded-xl border bg-[var(--card)] text-[var(--ink)] outline-none ${
                                    errors.project
                                        ? 'border-red-500'
                                        : 'border-[var(--border)] focus:border-[#EC7505]'
                                }`}
                            >
                                <option value="">Select project...</option>
                                {userProjects.map((proj) => (
                                    <option key={proj.id} value={proj.id}>
                                        {proj.title}
                                    </option>
                                ))}
                            </select>
                        )}
                        {errors.project && (
                            <p className="text-[11px] font-bold text-red-600 dark:text-red-400">
                                {errors.project}
                            </p>
                        )}
                    </div>

                    {/* 4. Assign To (Searchable multi-select + "Assign to me") */}
                    <div className="space-y-1.5" ref={assigneeContainerRef} tabIndex={-1}>
                        <div className="flex items-center justify-between">
                            <label className="font-bold text-[var(--ink)]">
                                Assign to <span className="text-[#EC7505]">*</span>
                            </label>
                            <button
                                type="button"
                                onClick={handleAssignToMe}
                                className="text-[11px] font-bold text-[#B35400] dark:text-[#FFBB00] hover:underline cursor-pointer flex items-center gap-1"
                            >
                                <UserCheck className="w-3 h-3" />
                                <span>Assign to me</span>
                            </button>
                        </div>

                        {/* Search field */}
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={memberSearchTerm}
                                onChange={(e) => setMemberSearchTerm(e.target.value)}
                                placeholder="Search project members..."
                                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--ink)] outline-none focus:border-[#EC7505]"
                            />
                        </div>

                        {/* Member checkable list */}
                        <div
                            className={`max-h-36 overflow-y-auto space-y-1 p-1 rounded-xl border ${
                                errors.assignees
                                    ? 'border-red-500'
                                    : 'border-[var(--border)] bg-[var(--tint-neutral)]/20'
                            }`}
                        >
                            {filteredMembers.length === 0 ? (
                                <p className="p-3 text-center text-[11px] text-[var(--muted)] italic">
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
                                            className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors cursor-pointer ${
                                                isSelected
                                                    ? 'bg-[var(--tint-yellow)] text-[#2A2A2A]'
                                                    : 'hover:bg-[var(--tint-neutral)]/40 text-[var(--ink)]'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Avatar size="xs">
                                                    <AvatarFallback className="text-[9px] font-bold bg-[#FFBB00] text-[#2A2A2A]">
                                                        {getInitials(member.name)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0">
                                                    <p className="font-bold truncate">{member.name}</p>
                                                    <p className="text-[10px] text-[var(--muted)] truncate">
                                                        {member.email}
                                                    </p>
                                                </div>
                                            </div>
                                            <div
                                                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                                    isSelected
                                                        ? 'bg-[#EC7505] border-[#EC7505] text-white'
                                                        : 'border-[var(--border)] bg-[var(--card)]'
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
                            <label htmlFor="task-due-date" className="font-bold text-[var(--ink)]">
                                Due date <span className="text-[#EC7505]">*</span>
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
                                className={`w-full px-3 py-2 rounded-xl border bg-[var(--card)] text-[var(--ink)] outline-none ${
                                    errors.dueDate
                                        ? 'border-red-500'
                                        : 'border-[var(--border)] focus:border-[#EC7505]'
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
                            <label className="font-bold text-[var(--ink)]">Priority</label>
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
                                            className={`flex-1 py-2 text-center rounded-xl font-bold transition-all cursor-pointer ${
                                                isSelected
                                                    ? p === 'High'
                                                        ? 'bg-red-500 text-white shadow-xs'
                                                        : p === 'Low'
                                                        ? 'bg-emerald-600 text-white shadow-xs'
                                                        : 'bg-[#FFBB00] text-[#2A2A2A] shadow-xs'
                                                    : 'border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--ink)]'
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
                    <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--border)] shrink-0">
                        <button
                            type="button"
                            onClick={handleRequestClose}
                            disabled={isSubmitting}
                            className="px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--tint-neutral)] text-[var(--ink)] font-bold transition-colors cursor-pointer disabled:opacity-50 btn-press"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="btn-primary-orange px-4 py-2 rounded-xl font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2 btn-press"
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
                        className="w-full max-w-sm bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl p-5 space-y-4 animate-modal-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="space-y-1">
                            <h4 id="discard-title" className="text-sm font-bold text-[var(--ink)]">
                                Discard this task?
                            </h4>
                            <p className="text-xs text-[var(--muted)]">
                                The information you entered will not be saved. Your message text in the composer will remain intact.
                            </p>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowDiscardConfirm(false)}
                                className="px-3.5 py-1.5 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--ink)] hover:bg-[var(--tint-neutral)]"
                            >
                                Continue editing
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowDiscardConfirm(false);
                                    onClose();
                                }}
                                className="px-3.5 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700"
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
