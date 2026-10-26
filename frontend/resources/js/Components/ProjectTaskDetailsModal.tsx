import React, { useState, useRef } from 'react';
import { router, Link } from '@inertiajs/react';
import {
    X,
    CheckSquare,
    Calendar,
    User,
    CheckCircle2,
    Clock,
    Paperclip,
    Plus,
    Trash2,
    Download,
    Upload,
    Send,
    RotateCcw,
    AlertCircle,
    ExternalLink,
    FileText,
    Flag,
    Check,
} from 'lucide-react';
import { Button } from '@/Components/Button';
import { Badge } from '@/Components/Badge';

export interface ChecklistItemData {
    id: string;
    content: string;
    is_completed: boolean;
    order: number;
}

export interface TaskEvidenceData {
    id: string;
    original_name: string;
    file_size: number;
    file_size_formatted: string;
    mime_type: string;
    remarks: string | null;
    uploaded_at: string | null;
    uploader: { id: number; name: string } | null;
    download_url: string;
    can?: { delete: boolean };
}

export interface ProjectTaskDetail {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority?: string;
    requires_review: boolean;
    due_date: string | null;
    due_date_raw: string | null;
    is_assigned_to_me?: boolean;
    activity: { id: string; title: string };
    committee: { id: string; name: string };
    assignee: { id: number; name: string; email: string } | null;
    checklist_items?: ChecklistItemData[];
    checklist_total?: number;
    checklist_completed?: number;
    evidences?: TaskEvidenceData[];
    can?: {
        update?: boolean;
        delete?: boolean;
        updateStatus?: boolean;
        manageChecklist?: boolean;
        uploadEvidence?: boolean;
        submitReview?: boolean;
        review?: boolean;
        resubmit?: boolean;
    };
}

interface ProjectTaskDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string | number;
    task: ProjectTaskDetail | null;
    onTaskUpdated?: () => void;
}

export function ProjectTaskDetailsModal({
    isOpen,
    onClose,
    projectId,
    task,
    onTaskUpdated,
}: ProjectTaskDetailsModalProps) {
    if (!isOpen || !task) return null;

    // Checklist state
    const [newChecklistText, setNewChecklistText] = useState('');
    const [checklistLoading, setChecklistLoading] = useState(false);

    // Evidence upload state
    const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
    const [evidenceRemarks, setEvidenceRemarks] = useState('');
    const [evidenceLoading, setEvidenceLoading] = useState(false);
    const [evidenceError, setEvidenceError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Review return feedback modal state
    const [showReturnInput, setShowReturnInput] = useState(false);
    const [returnFeedback, setReturnFeedback] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    const checklistItems = task.checklist_items || [];
    const evidences = task.evidences || [];
    const canManageChecklist = task.can?.manageChecklist ?? false;
    const canUploadEvidence = task.can?.uploadEvidence ?? false;
    const canSubmitReview = task.can?.submitReview ?? false;
    const canReview = task.can?.review ?? false;
    const canResubmit = task.can?.resubmit ?? false;
    const canUpdateStatus = task.can?.updateStatus ?? false;

    // Toggle checklist item
    const handleToggleChecklist = (item: ChecklistItemData) => {
        router.patch(
            `/projects/${projectId}/committees/${task.committee.id}/activities/${task.activity.id}/tasks/${task.id}/checklist/${item.id}`,
            {
                is_completed: !item.is_completed,
            },
            {
                preserveScroll: true,
                onSuccess: () => onTaskUpdated?.(),
            }
        );
    };

    // Add checklist item
    const handleAddChecklistItem = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = newChecklistText.trim();
        if (!trimmed) return;

        setChecklistLoading(true);
        router.post(
            `/projects/${projectId}/committees/${task.committee.id}/activities/${task.activity.id}/tasks/${task.id}/checklist`,
            {
                content: trimmed,
                is_completed: false,
                order: checklistItems.length,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setNewChecklistText('');
                    setChecklistLoading(false);
                    onTaskUpdated?.();
                },
                onError: () => setChecklistLoading(false),
            }
        );
    };

    // Delete checklist item
    const handleDeleteChecklist = (itemId: string) => {
        router.delete(
            `/projects/${projectId}/committees/${task.committee.id}/activities/${task.activity.id}/tasks/${task.id}/checklist/${itemId}`,
            {
                preserveScroll: true,
                onSuccess: () => onTaskUpdated?.(),
            }
        );
    };

    // Upload evidence file
    const handleUploadEvidence = (e: React.FormEvent) => {
        e.preventDefault();
        if (!evidenceFile) {
            setEvidenceError('Please select a file to upload as evidence.');
            return;
        }

        setEvidenceLoading(true);
        setEvidenceError(null);

        const formData = new FormData();
        formData.append('file', evidenceFile);
        if (evidenceRemarks.trim()) {
            formData.append('remarks', evidenceRemarks.trim());
        }

        router.post(
            `/projects/${projectId}/committees/${task.committee.id}/activities/${task.activity.id}/tasks/${task.id}/evidence`,
            formData,
            {
                preserveScroll: true,
                forceFormData: true,
                onSuccess: () => {
                    setEvidenceFile(null);
                    setEvidenceRemarks('');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    setEvidenceLoading(false);
                    onTaskUpdated?.();
                },
                onError: (errs) => {
                    setEvidenceLoading(false);
                    setEvidenceError(Object.values(errs)[0] ? String(Object.values(errs)[0]) : 'Upload failed.');
                },
            }
        );
    };

    // Delete evidence file
    const handleDeleteEvidence = (evidenceId: string) => {
        router.delete(
            `/projects/${projectId}/committees/${task.committee.id}/activities/${task.activity.id}/tasks/${task.id}/evidence/${evidenceId}`,
            {
                preserveScroll: true,
                onSuccess: () => onTaskUpdated?.(),
            }
        );
    };

    // Submit task for review
    const handleSubmitForReview = () => {
        setActionLoading(true);
        router.post(
            `/projects/${projectId}/committees/${task.committee.id}/activities/${task.activity.id}/tasks/${task.id}/submit`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    setActionLoading(false);
                    onTaskUpdated?.();
                },
                onError: () => setActionLoading(false),
            }
        );
    };

    // Approve task (mark completed)
    const handleApprove = () => {
        setActionLoading(true);
        router.post(
            `/projects/${projectId}/committees/${task.committee.id}/activities/${task.activity.id}/tasks/${task.id}/approve`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    setActionLoading(false);
                    onTaskUpdated?.();
                },
                onError: () => setActionLoading(false),
            }
        );
    };

    // Return task for revision
    const handleReturnForRevision = () => {
        setActionLoading(true);
        router.post(
            `/projects/${projectId}/committees/${task.committee.id}/activities/${task.activity.id}/tasks/${task.id}/return`,
            { review_feedback: returnFeedback },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setActionLoading(false);
                    setShowReturnInput(false);
                    setReturnFeedback('');
                    onTaskUpdated?.();
                },
                onError: () => setActionLoading(false),
            }
        );
    };

    // Resubmit task back to In Progress
    const handleResubmit = () => {
        setActionLoading(true);
        router.post(
            `/projects/${projectId}/committees/${task.committee.id}/activities/${task.activity.id}/tasks/${task.id}/resubmit`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    setActionLoading(false);
                    onTaskUpdated?.();
                },
                onError: () => setActionLoading(false),
            }
        );
    };

    // Member complete normal task without review
    const handleDirectComplete = () => {
        setActionLoading(true);
        router.patch(
            `/projects/${projectId}/committees/${task.committee.id}/activities/${task.activity.id}/tasks/${task.id}`,
            { status: 'Completed' },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setActionLoading(false);
                    onTaskUpdated?.();
                },
                onError: () => setActionLoading(false),
            }
        );
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-[3px] overflow-y-auto animate-fade-in"
            onClick={onClose}
        >
            <div
                className="w-full max-w-2xl bg-[color:var(--card)] border border-[color:var(--border)] rounded-[14px] overflow-hidden text-[color:var(--text)] my-auto max-h-[92vh] flex flex-col shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Modal Header ── */}
                <div className="flex items-start justify-between px-6 py-4 border-b border-[color:var(--border)] shrink-0 bg-[color:var(--card)]">
                    <div className="space-y-1.5 min-w-0 pr-4">
                        <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                                variant={
                                    task.status === 'Completed'
                                        ? 'accent'
                                        : task.status === 'Under Review'
                                        ? 'secondary'
                                        : task.status === 'Returned'
                                        ? 'danger'
                                        : 'soft'
                                }
                            >
                                {task.status}
                            </Badge>
                            {task.priority && (
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-[color:var(--muted)]">
                                    {task.priority} Priority
                                </span>
                            )}
                            {task.requires_review && (
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    Deliverables Required
                                </span>
                            )}
                        </div>
                        <h2 className="text-[18px] font-bold text-[color:var(--text)] leading-snug break-words">
                            {task.title}
                        </h2>
                        <div className="flex items-center gap-3 text-[12px] text-[color:var(--muted)] flex-wrap">
                            <span>
                                {task.committee.name} &bull; {task.activity.title}
                            </span>
                            {task.due_date && (
                                <span className="flex items-center gap-1 tabular-nums">
                                    <Clock className="w-3 h-3 text-[color:var(--muted)]" />
                                    Due: {task.due_date}
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-[8px] text-[color:var(--muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] transition cursor-pointer shrink-0"
                        aria-label="Close modal"
                    >
                        <X className="w-4 h-4 stroke-[2]" />
                    </button>
                </div>

                {/* ── Modal Body ── */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5 text-[13px]">
                    {/* Assignee & Meta Info */}
                    <div className="flex items-center justify-between p-3 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] flex-wrap gap-2 text-[12px]">
                        <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-[color:var(--primary)]" />
                            <span className="text-[color:var(--muted)]">Assignee:</span>
                            <span className="font-semibold text-[color:var(--text)]">
                                {task.assignee?.name || <span className="italic text-[color:var(--muted)]">Unassigned</span>}
                            </span>
                        </div>
                        <Link
                            href={`/projects/${projectId}/committees/${task.committee.id}/activities/${task.activity.id}`}
                            className="inline-flex items-center gap-1 font-semibold text-[color:var(--primary)] hover:underline text-[11px]"
                        >
                            <span>Open Activity Page</span>
                            <ExternalLink className="w-3 h-3" />
                        </Link>
                    </div>

                    {/* Description */}
                    {task.description && (
                        <div className="space-y-1.5">
                            <h4 className="text-[12px] font-bold text-[color:var(--muted)] uppercase tracking-wider">
                                Instructions & Objectives
                            </h4>
                            <p className="text-[13px] text-[color:var(--text)] bg-[color:var(--card)] p-3.5 rounded-[8px] border border-[color:var(--border)] whitespace-pre-wrap leading-relaxed">
                                {task.description}
                            </p>
                        </div>
                    )}

                    {/* ── SECTION: CHECKLISTS ── */}
                    <div className="p-4 rounded-[12px] bg-[color:var(--soft-surface)]/50 border border-[color:var(--border)] space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CheckSquare className="w-4 h-4 text-[color:var(--primary)]" />
                                <h3 className="text-[13px] font-bold text-[color:var(--text)]">
                                    Checklist Items
                                </h3>
                                <Badge variant="soft" className="text-[11px] font-bold tabular-nums">
                                    {checklistItems.filter((i) => i.is_completed).length}/{checklistItems.length}
                                </Badge>
                            </div>
                            <span className="text-[11px] text-[color:var(--muted)]">
                                Click checkbox to mark item done
                            </span>
                        </div>

                        {/* List */}
                        {checklistItems.length > 0 ? (
                            <div className="space-y-1.5">
                                {checklistItems.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex items-center justify-between p-2.5 rounded-[8px] bg-[color:var(--card)] border border-[color:var(--border)] group hover:border-[color:var(--primary)]/40 transition-colors"
                                    >
                                        <label className="flex items-center gap-2.5 cursor-pointer min-w-0 pr-2 flex-1">
                                            <input
                                                type="checkbox"
                                                checked={item.is_completed}
                                                onChange={() => handleToggleChecklist(item)}
                                                className="w-4 h-4 rounded text-[color:var(--primary)] focus:ring-[color:var(--primary)] cursor-pointer"
                                            />
                                            <span
                                                className={`text-[12px] leading-snug break-words transition-all ${
                                                    item.is_completed
                                                        ? 'line-through text-[color:var(--muted)] opacity-70'
                                                        : 'text-[color:var(--text)] font-medium'
                                                }`}
                                            >
                                                {item.content}
                                            </span>
                                        </label>
                                        {canManageChecklist && (
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteChecklist(item.id)}
                                                className="p-1 text-[color:var(--muted)] hover:text-rose-500 rounded transition cursor-pointer opacity-0 group-hover:opacity-100"
                                                title="Delete item"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-3 border border-dashed border-[color:var(--border)] rounded-[8px] text-[11px] text-[color:var(--muted)]">
                                No checklist items added to this task.
                            </div>
                        )}

                        {/* Add Item Input */}
                        {canManageChecklist && (
                            <form onSubmit={handleAddChecklistItem} className="flex items-center gap-2 pt-1">
                                <input
                                    type="text"
                                    placeholder="Add a checklist item..."
                                    value={newChecklistText}
                                    onChange={(e) => setNewChecklistText(e.target.value)}
                                    className="flex-1 px-3 py-1.5 rounded-[6px] bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--text)] text-[12px] placeholder:text-[color:var(--muted)] focus:outline-none focus:ring-1.5 focus:ring-[color:var(--primary)]"
                                />
                                <Button
                                    type="submit"
                                    variant="secondary"
                                    size="sm"
                                    disabled={checklistLoading || !newChecklistText.trim()}
                                    isLoading={checklistLoading}
                                    className="text-[12px] font-semibold"
                                >
                                    <Plus className="w-3.5 h-3.5 mr-1" />
                                    <span>Add</span>
                                </Button>
                            </form>
                        )}
                    </div>

                    {/* ── SECTION: DELIVERABLES & MOV SUBMISSION ── */}
                    <div className="p-4 rounded-[12px] bg-gradient-to-br from-[color:var(--soft-surface)]/70 to-[color:var(--card)] border border-[color:var(--border)] space-y-3.5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Paperclip className="w-4 h-4 text-emerald-500 stroke-[2.2]" />
                                <h3 className="text-[13px] font-bold text-[color:var(--text)]">
                                    Deliverables & Means of Verification (MOV)
                                </h3>
                                <Badge variant="soft" className="text-[11px] font-bold tabular-nums">
                                    {evidences.length} files
                                </Badge>
                            </div>
                        </div>

                        {/* Uploaded Deliverables List */}
                        {evidences.length > 0 ? (
                            <div className="space-y-2">
                                {evidences.map((ev) => (
                                    <div
                                        key={ev.id}
                                        className="flex items-center justify-between p-3 rounded-[8px] bg-[color:var(--card)] border border-[color:var(--border)] text-[12px]"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                            <FileText className="w-4 h-4 text-[color:var(--primary)] shrink-0" />
                                            <div className="min-w-0">
                                                <a
                                                    href={ev.download_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="font-semibold text-[color:var(--text)] hover:text-[color:var(--primary)] truncate block"
                                                >
                                                    {ev.original_name}
                                                </a>
                                                <div className="flex items-center gap-2 text-[11px] text-[color:var(--muted)]">
                                                    <span>{ev.file_size_formatted}</span>
                                                    {ev.uploader && <span>&bull; by {ev.uploader.name}</span>}
                                                    {ev.uploaded_at && <span>&bull; {ev.uploaded_at}</span>}
                                                </div>
                                                {ev.remarks && (
                                                    <p className="text-[11px] text-[color:var(--muted)] italic mt-0.5">
                                                        "{ev.remarks}"
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <a
                                                href={ev.download_url}
                                                className="p-1.5 text-[color:var(--muted)] hover:text-[color:var(--text)] rounded transition"
                                                title="Download file"
                                            >
                                                <Download className="w-3.5 h-3.5" />
                                            </a>
                                            {ev.can?.delete && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteEvidence(ev.id)}
                                                    className="p-1.5 text-[color:var(--muted)] hover:text-rose-500 rounded transition cursor-pointer"
                                                    title="Delete file"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-4 border border-dashed border-[color:var(--border)] rounded-[8px] text-[11px] text-[color:var(--muted)]">
                                No deliverables or proof files uploaded yet.
                            </div>
                        )}

                        {/* Upload Form (for assigned member or authorized user) */}
                        {canUploadEvidence && task.status !== 'Completed' && (
                            <form onSubmit={handleUploadEvidence} className="p-3 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] space-y-2.5">
                                <div className="text-[12px] font-semibold text-[color:var(--text)] flex items-center gap-1.5">
                                    <Upload className="w-3.5 h-3.5 text-[color:var(--primary)]" />
                                    <span>Upload Deliverable Document / File</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                                        className="text-[12px] text-[color:var(--muted)] file:mr-2 file:py-1 file:px-2.5 file:rounded-[6px] file:border-0 file:text-[11px] file:font-semibold file:bg-[color:var(--card)] file:text-[color:var(--text)] file:cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Optional remarks / description..."
                                        value={evidenceRemarks}
                                        onChange={(e) => setEvidenceRemarks(e.target.value)}
                                        className="px-2.5 py-1 text-[12px] rounded-[6px] bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--text)] focus:outline-none focus:ring-1 focus:ring-[color:var(--primary)]"
                                    />
                                </div>
                                {evidenceError && (
                                    <p className="text-[11px] text-rose-500 font-medium">{evidenceError}</p>
                                )}
                                <div className="flex justify-end">
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        size="sm"
                                        disabled={evidenceLoading || !evidenceFile}
                                        isLoading={evidenceLoading}
                                        className="font-bold text-[12px]"
                                    >
                                        <Upload className="w-3 h-3 mr-1" />
                                        <span>Upload File</span>
                                    </Button>
                                </div>
                            </form>
                        )}
                    </div>

                    {/* Revision Feedback Display (if returned) */}
                    {task.status === 'Returned' && (
                        <div className="p-3.5 rounded-[10px] bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-[12px]">
                                <RotateCcw className="w-4 h-4" />
                                <span>Returned for Revision</span>
                            </div>
                            <p className="text-[12px] leading-relaxed">
                                Reviewers requested modifications to the deliverables. Please update your deliverables and resubmit.
                            </p>
                        </div>
                    )}

                    {/* Review Feedback Input (Staff action) */}
                    {showReturnInput && (
                        <div className="p-3.5 rounded-[10px] bg-rose-500/10 border border-rose-500/20 space-y-2 animate-fade-in">
                            <label className="block text-[12px] font-bold text-rose-600 dark:text-rose-400">
                                Provide Revision Feedback
                            </label>
                            <textarea
                                rows={2}
                                placeholder="Explain what revisions or deliverables are needed..."
                                value={returnFeedback}
                                onChange={(e) => setReturnFeedback(e.target.value)}
                                className="w-full px-3 py-2 rounded-[6px] bg-[color:var(--card)] border border-rose-500/30 text-[color:var(--text)] text-[12px] focus:outline-none focus:ring-1 focus:ring-rose-500"
                            />
                            <div className="flex justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setShowReturnInput(false)}
                                    disabled={actionLoading}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    variant="danger"
                                    size="sm"
                                    onClick={handleReturnForRevision}
                                    isLoading={actionLoading}
                                    className="font-bold"
                                >
                                    Confirm Return for Revision
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Modal Footer with Member / Reviewer Workflow Actions ── */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-[color:var(--border)] shrink-0 bg-[color:var(--card)] flex-wrap gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        onClick={onClose}
                        disabled={actionLoading}
                    >
                        Close
                    </Button>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Member Submit for Review */}
                        {canSubmitReview && (
                            <Button
                                type="button"
                                variant="primary"
                                size="md"
                                onClick={handleSubmitForReview}
                                isLoading={actionLoading}
                                className="font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                            >
                                <Send className="w-3.5 h-3.5 stroke-[2.2]" />
                                <span>Submit Deliverables for Review</span>
                            </Button>
                        )}

                        {/* Member Resubmit (if returned) */}
                        {canResubmit && (
                            <Button
                                type="button"
                                variant="primary"
                                size="md"
                                onClick={handleResubmit}
                                isLoading={actionLoading}
                                className="font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                            >
                                <RotateCcw className="w-3.5 h-3.5 stroke-[2.2]" />
                                <span>Resubmit Task</span>
                            </Button>
                        )}

                        {/* Member Direct Complete (when requires_review is false) */}
                        {!task.requires_review && canUpdateStatus && task.status !== 'Completed' && (
                            <Button
                                type="button"
                                variant="primary"
                                size="md"
                                onClick={handleDirectComplete}
                                isLoading={actionLoading}
                                className="font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                            >
                                <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.2]" />
                                <span>Mark Task Completed</span>
                            </Button>
                        )}

                        {/* Staff / Reviewer Actions */}
                        {canReview && task.status === 'Under Review' && !showReturnInput && (
                            <>
                                <Button
                                    type="button"
                                    variant="danger"
                                    size="md"
                                    onClick={() => setShowReturnInput(true)}
                                    disabled={actionLoading}
                                    className="font-bold cursor-pointer"
                                >
                                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                                    <span>Return for Revision</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant="primary"
                                    size="md"
                                    onClick={handleApprove}
                                    isLoading={actionLoading}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer shadow-xs"
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                    <span>Approve & Complete</span>
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
