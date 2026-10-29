import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from '@inertiajs/react';
import {
    X,
    CheckSquare,
    Calendar,
    User,
    Plus,
    Trash2,
    FileCheck,
    Layers,
    ListTodo,
    AlertCircle,
    Flag,
    CheckCircle2,
    Info,
} from 'lucide-react';
import { Button } from '@/Components/Button';
import { Badge } from '@/Components/Badge';

export interface AssigneeOption {
    id: number;
    name: string;
    email: string;
    role?: string;
}

export interface CommitteeOption {
    id: string;
    name: string;
    activities?: Array<{ id: string; title: string }>;
}

export interface ActivityOption {
    id: string;
    title: string;
    committee_id?: string;
}

interface CreateProjectTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string | number;
    projectTitle: string;
    committees?: CommitteeOption[];
    activities?: ActivityOption[];
    assignees?: AssigneeOption[];
    initialCommitteeId?: string;
    initialActivityId?: string;
}

export function CreateProjectTaskModal({
    isOpen,
    onClose,
    projectId,
    projectTitle,
    committees = [],
    activities = [],
    assignees = [],
    initialCommitteeId,
    initialActivityId,
}: CreateProjectTaskModalProps) {
    const todayStr = useMemo(() => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }, []);

    // Form data via Inertia useForm
    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        title: '',
        description: '',
        due_date: todayStr,
        priority: 'Medium' as 'Low' | 'Medium' | 'High',
        assigned_to: '',
        committee_id: initialCommitteeId || (committees[0]?.id ?? ''),
        activity_id: initialActivityId || '',
        requires_review: true, // Default to true so tasks have deliverables for members to submit
        deliverable_guidelines: '',
        checklist: [] as string[],
    });

    const [newChecklistText, setNewChecklistText] = useState('');
    const checklistInputRef = useRef<HTMLInputElement>(null);

    // Filter activities based on selected committee
    const availableActivities = useMemo(() => {
        if (!data.committee_id) return activities;
        const selectedComm = committees.find((c) => String(c.id) === String(data.committee_id));
        if (selectedComm && selectedComm.activities && selectedComm.activities.length > 0) {
            return selectedComm.activities;
        }
        return activities.filter((a) => !a.committee_id || String(a.committee_id) === String(data.committee_id));
    }, [data.committee_id, committees, activities]);

    // Keep activity_id aligned with available activities
    useEffect(() => {
        if (availableActivities.length > 0) {
            if (!data.activity_id || !availableActivities.some((a) => String(a.id) === String(data.activity_id))) {
                setData('activity_id', String(availableActivities[0].id));
            }
        } else {
            setData('activity_id', '');
        }
    }, [availableActivities]);

    // Reset when modal opens
    useEffect(() => {
        if (isOpen) {
            clearErrors();
            setNewChecklistText('');
            setData({
                title: '',
                description: '',
                due_date: todayStr,
                priority: 'Medium',
                assigned_to: '',
                committee_id: initialCommitteeId || (committees[0]?.id ?? ''),
                activity_id: initialActivityId || (availableActivities[0]?.id ?? ''),
                requires_review: true,
                deliverable_guidelines: '',
                checklist: [],
            });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleAddChecklistItem = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmed = newChecklistText.trim();
        if (!trimmed) return;
        setData('checklist', [...data.checklist, trimmed]);
        setNewChecklistText('');
        if (checklistInputRef.current) {
            checklistInputRef.current.focus();
        }
    };

    const handleRemoveChecklistItem = (indexToRemove: number) => {
        setData(
            'checklist',
            data.checklist.filter((_, idx) => idx !== indexToRemove)
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(`/projects/${projectId}/tasks`, {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                onClose();
            },
        });
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
                <div className="flex items-center justify-between px-6 py-4.5 border-b border-[color:var(--border)] shrink-0 bg-[color:var(--card)]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-[10px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] flex items-center justify-center text-[color:var(--primary)] shadow-2xs">
                            <CheckSquare className="w-5 h-5 stroke-[2.2]" />
                        </div>
                        <div>
                            <h2 className="text-[17px] font-bold text-[color:var(--text)] leading-tight flex items-center gap-2">
                                <span>Create new task</span>
                            </h2>
                            <p className="text-[12px] text-[color:var(--muted)] mt-0.5">
                                Set task deliverables, step-by-step checklists, and member assignments in{' '}
                                <span className="font-semibold text-[color:var(--text)]">{projectTitle}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-[8px] text-[color:var(--muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] transition cursor-pointer"
                        aria-label="Close modal"
                    >
                        <X className="w-4 h-4 stroke-[2]" />
                    </button>
                </div>

                {/* ── Modal Form Body ── */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-[13px]">
                    {/* General Errors Banner */}
                    {Object.keys(errors).length > 0 && (
                        <div className="p-3.5 rounded-[10px] bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[12px] space-y-1">
                            <div className="flex items-center gap-2 font-semibold">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>Please resolve the following errors:</span>
                            </div>
                            <ul className="list-disc list-inside pl-1 space-y-0.5 text-[11px]">
                                {Object.values(errors).map((err, i) => (
                                    <li key={i}>{String(err)}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Task Title (What needs to be done) */}
                    <div className="space-y-1.5">
                        <label className="block text-[13px] font-semibold text-[color:var(--text)]">
                            Task Title <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Design Event Promotional Banner & Schedule"
                            value={data.title}
                            onChange={(e) => setData('title', e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-[color:var(--text)] text-[14px] placeholder:text-[color:var(--muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent transition"
                            autoFocus
                        />
                        {errors.title && <p className="text-[11px] text-rose-500 mt-1 font-medium">{errors.title}</p>}
                    </div>

                    {/* Task Description */}
                    <div className="space-y-1.5">
                        <label className="block text-[13px] font-semibold text-[color:var(--text)]">
                            Description & Instructions <span className="text-[11px] font-normal text-[color:var(--muted)]">(Optional)</span>
                        </label>
                        <textarea
                            rows={3}
                            placeholder="Detail what tasks should be completed, requirements, resources, or important context..."
                            value={data.description}
                            onChange={(e) => setData('description', e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-[color:var(--text)] text-[13px] placeholder:text-[color:var(--muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent transition leading-relaxed"
                        />
                    </div>

                    {/* Committee & Activity Selection Row */}
                    <div className="p-3.5 rounded-[10px] bg-[color:var(--soft-surface)]/60 border border-[color:var(--border)] space-y-3">
                        <div className="flex items-center gap-2 text-[12px] font-semibold text-[color:var(--text)]">
                            <Layers className="w-4 h-4 text-[color:var(--primary)] stroke-[2]" />
                            <span>Project Organization</span>
                        </div>

                        {committees.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-[color:var(--muted)] mb-1 uppercase tracking-wider">
                                        Committee
                                    </label>
                                    <select
                                        value={data.committee_id}
                                        onChange={(e) => setData('committee_id', e.target.value)}
                                        className="w-full px-3 py-2 rounded-[6px] bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--text)] text-[12px] focus:outline-none focus:ring-1.5 focus:ring-[color:var(--primary)]"
                                    >
                                        {committees.map((comm) => (
                                            <option key={comm.id} value={comm.id}>
                                                {comm.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-[color:var(--muted)] mb-1 uppercase tracking-wider">
                                        Activity
                                    </label>
                                    <select
                                        value={data.activity_id}
                                        onChange={(e) => setData('activity_id', e.target.value)}
                                        className="w-full px-3 py-2 rounded-[6px] bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--text)] text-[12px] focus:outline-none focus:ring-1.5 focus:ring-[color:var(--primary)]"
                                    >
                                        {availableActivities.length > 0 ? (
                                            availableActivities.map((act) => (
                                                <option key={act.id} value={act.id}>
                                                    {act.title}
                                                </option>
                                            ))
                                        ) : (
                                            <option value="">(Will create General Activity)</option>
                                        )}
                                    </select>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-[12px] text-[color:var(--muted)]">
                                <Info className="w-4 h-4 text-[color:var(--primary)] shrink-0" />
                                <span>
                                    No committees yet. This task will automatically create and organize under{' '}
                                    <span className="font-semibold text-[color:var(--text)]">General Committee</span> &rarr;{' '}
                                    <span className="font-semibold text-[color:var(--text)]">General Project Tasks</span>.
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Assignee & Due Date Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* Assignee */}
                        <div className="space-y-1.5">
                            <label className="block text-[13px] font-semibold text-[color:var(--text)] flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-[color:var(--primary)] stroke-[2]" />
                                <span>Assign to Member</span>
                            </label>
                            <select
                                value={data.assigned_to}
                                onChange={(e) => setData('assigned_to', e.target.value)}
                                className="w-full px-3 py-2.5 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-[color:var(--text)] text-[13px] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] transition"
                            >
                                <option value="">Select an assignee (or Unassigned)...</option>
                                {assignees.map((member) => (
                                    <option key={member.id} value={member.id}>
                                        {member.name} {member.role ? `(${member.role})` : ''} - {member.email}
                                    </option>
                                ))}
                            </select>
                            {errors.assigned_to && (
                                <p className="text-[11px] text-rose-500 font-medium">{errors.assigned_to}</p>
                            )}
                        </div>

                        {/* Due Date */}
                        <div className="space-y-1.5">
                            <label className="block text-[13px] font-semibold text-[color:var(--text)] flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-[color:var(--primary)] stroke-[2]" />
                                <span>Due Date</span>
                            </label>
                            <input
                                type="date"
                                value={data.due_date}
                                onChange={(e) => setData('due_date', e.target.value)}
                                className="w-full px-3 py-2.5 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-[color:var(--text)] text-[13px] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] transition"
                            />
                            {errors.due_date && (
                                <p className="text-[11px] text-rose-500 font-medium">{errors.due_date}</p>
                            )}
                        </div>
                    </div>

                    {/* Priority Selector */}
                    <div className="space-y-1.5">
                        <label className="block text-[12px] font-semibold text-[color:var(--muted)] uppercase tracking-wider flex items-center gap-1.5">
                            <Flag className="w-3.5 h-3.5 text-[color:var(--primary)] stroke-[2]" />
                            <span>Priority Level</span>
                        </label>
                        <div className="flex items-center gap-2">
                            {(['Low', 'Medium', 'High'] as const).map((p) => {
                                const isSelected = data.priority === p;
                                const colors = {
                                    Low: isSelected ? 'bg-slate-500/20 text-slate-300 border-slate-400' : 'text-slate-400 hover:bg-slate-500/10',
                                    Medium: isSelected ? 'bg-amber-500/20 text-amber-300 border-amber-400 font-bold' : 'text-amber-500/70 hover:bg-amber-500/10',
                                    High: isSelected ? 'bg-rose-500/20 text-rose-300 border-rose-400 font-bold' : 'text-rose-500/70 hover:bg-rose-500/10',
                                };
                                return (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setData('priority', p)}
                                        className={`px-3 py-1.5 rounded-[6px] text-[12px] border transition-all cursor-pointer ${
                                            isSelected ? 'border-current shadow-xs' : 'border-transparent'
                                        } ${colors[p]}`}
                                    >
                                        {p} Priority
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── SECTION: CHECKLISTS ("make sure that the tasks then have checklists") ── */}
                    <div className="p-4 rounded-[12px] bg-[color:var(--soft-surface)]/50 border border-[color:var(--border)] space-y-3.5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-[6px] bg-[color:var(--primary)]/15 text-[color:var(--primary)] flex items-center justify-center">
                                    <ListTodo className="w-3.5 h-3.5 stroke-[2.2]" />
                                </div>
                                <h3 className="text-[13px] font-bold text-[color:var(--text)]">
                                    Task Checklist
                                </h3>
                                <Badge variant="soft" className="text-[11px] font-bold tabular-nums">
                                    {data.checklist.length} items
                                </Badge>
                            </div>
                            <span className="text-[11px] text-[color:var(--muted)]">
                                Member action checklist
                            </span>
                        </div>

                        <p className="text-[12px] text-[color:var(--muted)] leading-relaxed">
                            Define the step-by-step checklist items that the assigned member must complete and check off.
                        </p>

                        {/* Checklist Item Input */}
                        <div className="flex items-center gap-2">
                            <input
                                ref={checklistInputRef}
                                type="text"
                                placeholder="Type a checklist step and press Enter or click Add..."
                                value={newChecklistText}
                                onChange={(e) => setNewChecklistText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddChecklistItem();
                                    }
                                }}
                                className="flex-1 px-3 py-2 rounded-[8px] bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--text)] text-[12px] placeholder:text-[color:var(--muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]"
                            />
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => handleAddChecklistItem()}
                                disabled={!newChecklistText.trim()}
                                className="flex items-center gap-1 font-semibold text-[12px] shrink-0"
                            >
                                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Add Item</span>
                            </Button>
                        </div>

                        {/* Rendered Checklist Items List */}
                        {data.checklist.length > 0 ? (
                            <div className="space-y-1.5 pt-1">
                                {data.checklist.map((item, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between p-2.5 rounded-[8px] bg-[color:var(--card)] border border-[color:var(--border)] text-[12px] group hover:border-[color:var(--primary)]/40 transition-colors"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                            <span className="w-5 h-5 rounded-[4px] border border-[color:var(--border)] bg-[color:var(--soft-surface)] flex items-center justify-center text-[10px] font-bold text-[color:var(--muted)] shrink-0 tabular-nums">
                                                {index + 1}
                                            </span>
                                            <span className="text-[color:var(--text)] font-medium break-words leading-snug">
                                                {item}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveChecklistItem(index)}
                                            className="p-1 rounded text-[color:var(--muted)] hover:text-rose-500 hover:bg-rose-500/10 transition shrink-0 cursor-pointer"
                                            title="Remove item"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-3 border border-dashed border-[color:var(--border)] rounded-[8px] text-[11px] text-[color:var(--muted)]">
                                No checklist items added yet. Type an item above to create actionable member checklists.
                            </div>
                        )}
                    </div>

                    {/* ── SECTION: DELIVERABLES & MOV ("and deliverables for members to submit") ── */}
                    <div className="p-4 rounded-[12px] bg-gradient-to-br from-[color:var(--soft-surface)]/70 to-[color:var(--card)] border border-[color:var(--border)] space-y-3.5">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5">
                                <div className="w-7 h-7 rounded-[8px] bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                                    <FileCheck className="w-4 h-4 stroke-[2.2]" />
                                </div>
                                <div>
                                    <h3 className="text-[13px] font-bold text-[color:var(--text)]">
                                        Member Deliverables & Verification (MOV)
                                    </h3>
                                    <p className="text-[11px] text-[color:var(--muted)] mt-0.5">
                                        Require members to submit deliverables (proof of work, reports, files, links) for review before task completion.
                                    </p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                                <input
                                    type="checkbox"
                                    checked={data.requires_review}
                                    onChange={(e) => setData('requires_review', e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-[color:var(--border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[color:var(--primary)]"></div>
                            </label>
                        </div>

                        {data.requires_review && (
                            <div className="space-y-1.5 pt-1 animate-fade-in">
                                <label className="block text-[12px] font-semibold text-[color:var(--text)]">
                                    Expected Deliverables & Proof Guidelines
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="e.g. Upload final event budget spreadsheet (XLSX) and signed quotation PDF before submission..."
                                    value={data.deliverable_guidelines}
                                    onChange={(e) => setData('deliverable_guidelines', e.target.value)}
                                    className="w-full px-3 py-2 rounded-[8px] bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--text)] text-[12px] placeholder:text-[color:var(--muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]"
                                />
                                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                    <span>
                                        Assigned members will have an evidence upload portal to submit files & remarks for review.
                                    </span>
                                </p>
                            </div>
                        )}
                    </div>
                </form>

                {/* ── Modal Footer ── */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[color:var(--border)] shrink-0 bg-[color:var(--card)]">
                    <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        onClick={onClose}
                        disabled={processing}
                        className="cursor-pointer font-medium"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        size="md"
                        onClick={handleSubmit}
                        disabled={processing || !data.title.trim()}
                        isLoading={processing}
                        className="font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                        <span>Create task</span>
                    </Button>
                </div>
            </div>
        </div>
    );
}
