import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useForm, usePage } from '@inertiajs/react';
import {
    X,
    FolderOpen,
    Upload,
    FileText,
    Search,
    Check,
    Users,
    AlertCircle,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/Components/ui/avatar';
import { Button } from '@/Components/Button';

export interface AvailableUser {
    id: number;
    name: string;
    email: string;
}

export interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    availableUsers?: AvailableUser[];
    initialValues?: {
        title?: string;
        description?: string;
        start_date?: string;
        end_date?: string;
    };
}

function getInitials(name: string): string {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join('');
}

export function CreateProjectModal({
    isOpen,
    onClose,
    availableUsers: propUsers,
    initialValues,
}: CreateProjectModalProps) {
    const page = usePage<{
        auth?: { user?: { id: number; name: string; email: string } };
        available_users?: AvailableUser[];
    }>();

    const currentUser = page.props.auth?.user;
    const allUsers: AvailableUser[] = useMemo(() => {
        const list = propUsers && propUsers.length > 0
            ? propUsers
            : (page.props.available_users || []);

        return list.filter((u) => u.id !== currentUser?.id);
    }, [propUsers, page.props.available_users, currentUser?.id]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [memberSearch, setMemberSearch] = useState('');

    const { data, setData, post, processing, errors, reset, clearErrors } = useForm<{
        title: string;
        description: string;
        start_date: string;
        end_date: string;
        status: string;
        approval_document: File | null;
        member_ids: number[];
        member_roles: Record<number, 'Project Member' | 'Project Staff'>;
    }>({
        title: '',
        description: '',
        start_date: '',
        end_date: '',
        status: 'Active',
        approval_document: null,
        member_ids: [],
        member_roles: {},
    });

    // Populate initial template values
    useEffect(() => {
        if (isOpen && initialValues) {
            setData((prev) => ({
                ...prev,
                title: initialValues.title ?? prev.title,
                description: initialValues.description ?? prev.description,
                start_date: initialValues.start_date ?? prev.start_date,
                end_date: initialValues.end_date ?? prev.end_date,
            }));
        }
    }, [isOpen, initialValues]);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen && !processing) {
                handleClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, processing]);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        setData('approval_document', file);
    };

    const handleRemoveFile = () => {
        if (processing) return;
        setData('approval_document', null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleClose = () => {
        if (processing) return;
        reset();
        clearErrors();
        setMemberSearch('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        onClose();
    };

    const toggleMember = (userId: number) => {
        const isSelected = data.member_ids.includes(userId);
        if (isSelected) {
            const newMemberIds = data.member_ids.filter((id) => id !== userId);
            const newRoles = { ...data.member_roles };
            delete newRoles[userId];
            setData((prev) => ({
                ...prev,
                member_ids: newMemberIds,
                member_roles: newRoles,
            }));
        } else {
            setData((prev) => ({
                ...prev,
                member_ids: [...prev.member_ids, userId],
                member_roles: {
                    ...prev.member_roles,
                    [userId]: 'Project Member',
                },
            }));
        }
    };

    const setMemberRole = (userId: number, role: 'Project Member' | 'Project Staff') => {
        setData('member_roles', {
            ...data.member_roles,
            [userId]: role,
        });
    };

    const filteredUsers = allUsers.filter((u) => {
        if (!memberSearch.trim()) return true;
        const query = memberSearch.toLowerCase();
        return u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query);
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        clearErrors();

        post('/projects', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                handleClose();
            },
        });
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]"
            onClick={handleClose}
        >
            <div
                className="w-full max-w-2xl bg-[color:var(--card)] border border-[color:var(--border)] rounded-[12px] overflow-hidden animate-fade-in text-[color:var(--text)] max-h-[90vh] flex flex-col"
                style={{ boxShadow: 'none' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Modal Header ── */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--border)] shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] flex items-center justify-center text-[color:var(--primary)]">
                            <FolderOpen className="w-[18px] h-[18px] stroke-[2px]" />
                        </div>
                        <div>
                            <h3 className="text-[16px] font-semibold text-[color:var(--text)]">
                                Create new project
                            </h3>
                            <p className="text-[12px] text-[color:var(--muted)]">
                                Set up workspace details, schedule, and team members
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={processing}
                        className="p-1 rounded-[6px] text-[color:var(--muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] transition cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                        aria-label="Close modal"
                    >
                        <X className="w-[18px] h-[18px] stroke-[2px]" />
                    </button>
                </div>

                {/* ── Form Body (Scrollable) ── */}
                <form id="create-project-form" onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
                    {/* Project Title */}
                    <div>
                        <label className="block text-[13px] font-medium text-[color:var(--text)] mb-1">
                            Project title <span className="text-[color:var(--primary)]">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            autoFocus
                            value={data.title}
                            onChange={(e) => setData('title', e.target.value)}
                            placeholder="e.g. Capstone Research Project 2026"
                            className="w-full px-3.5 py-2 text-[14px] rounded-[8px] border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)] placeholder-[color:var(--muted)] focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                        />
                        {errors.title && (
                            <p className="text-[12px] text-[color:var(--primary)] font-medium mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0 stroke-[2px]" />
                                <span>{errors.title}</span>
                            </p>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-[13px] font-medium text-[color:var(--text)] mb-1">
                            Description
                        </label>
                        <textarea
                            rows={2}
                            value={data.description}
                            onChange={(e) => setData('description', e.target.value)}
                            placeholder="Summarize project goals, scope, and target outcomes..."
                            className="w-full px-3.5 py-2 text-[14px] rounded-[8px] border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)] placeholder-[color:var(--muted)] focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 resize-none"
                        />
                        {errors.description && (
                            <p className="text-[12px] text-[color:var(--primary)] font-medium mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0 stroke-[2px]" />
                                <span>{errors.description}</span>
                            </p>
                        )}
                    </div>

                    {/* Schedule Dates & Status */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-[13px] font-medium text-[color:var(--text)] mb-1">
                                Start date
                            </label>
                            <input
                                type="date"
                                value={data.start_date}
                                onChange={(e) => setData('start_date', e.target.value)}
                                className="w-full px-3 py-1.5 text-[13px] rounded-[8px] border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)] focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                            />
                            {errors.start_date && (
                                <p className="text-[12px] text-[color:var(--primary)] font-medium mt-1">{errors.start_date}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-[13px] font-medium text-[color:var(--text)] mb-1">
                                End date / deadline
                            </label>
                            <input
                                type="date"
                                value={data.end_date}
                                onChange={(e) => setData('end_date', e.target.value)}
                                className="w-full px-3 py-1.5 text-[13px] rounded-[8px] border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)] focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                            />
                            {errors.end_date && (
                                <p className="text-[12px] text-[color:var(--primary)] font-medium mt-1">{errors.end_date}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-[13px] font-medium text-[color:var(--text)] mb-1">
                                Initial status
                            </label>
                            <select
                                value={data.status}
                                onChange={(e) => setData('status', e.target.value)}
                                className="w-full px-3 py-1.5 text-[13px] rounded-[8px] border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)] focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 cursor-pointer"
                            >
                                <option value="Active">Active</option>
                                <option value="Planning">Planning</option>
                            </select>
                        </div>
                    </div>

                    {/* Approval / Supporting Document (REQUIRED) */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-[13px] font-medium text-[color:var(--text)]">
                                Approval / supporting document <span className="text-[color:var(--primary)]">*</span>
                            </label>
                            <span className="text-[11px] text-[color:var(--muted)]">
                                PDF, Word, or Image · Max 10MB
                            </span>
                        </div>

                        {data.approval_document ? (
                            <div className="flex items-center justify-between p-3 rounded-[8px] border border-[color:var(--border)] bg-[color:var(--soft-surface)]">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-[6px] bg-[color:var(--card)] border border-[color:var(--border)] flex items-center justify-center text-[color:var(--secondary)] shrink-0">
                                        <FileText className="w-4 h-4 stroke-[2px]" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[13px] font-medium text-[color:var(--text)] truncate">
                                            {data.approval_document.name}
                                        </p>
                                        <p className="text-[11px] text-[color:var(--muted)] tabular-nums">
                                            {(data.approval_document.size / (1024 * 1024)).toFixed(2)} MB
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleRemoveFile}
                                    className="p-1 rounded-[6px] text-[color:var(--primary)] hover:bg-[color:var(--status-danger-bg)] transition-colors cursor-pointer"
                                    title="Remove document"
                                >
                                    <X className="w-4 h-4 stroke-[2px]" />
                                </button>
                            </div>
                        ) : (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className={`border border-dashed rounded-[8px] p-4 text-center cursor-pointer transition-colors ${
                                    errors.approval_document
                                        ? 'border-[color:var(--primary)] bg-[color:var(--status-danger-bg)]'
                                        : 'border-[color:var(--border)] hover:border-[color:var(--primary)] bg-[color:var(--soft-surface)]'
                                }`}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                                <div className="flex flex-col items-center justify-center gap-1.5">
                                    <div className="w-8 h-8 rounded-full bg-[color:var(--card)] border border-[color:var(--border)] flex items-center justify-center text-[color:var(--primary)]">
                                        <Upload className="w-4 h-4 stroke-[2px]" />
                                    </div>
                                    <p className="text-[13px] font-medium text-[color:var(--text)]">
                                        Click to attach official approval document
                                    </p>
                                    <p className="text-[11px] text-[color:var(--muted)]">
                                        Approved project memo, syllabus task design, or endorsement letter
                                    </p>
                                </div>
                            </div>
                        )}
                        {errors.approval_document && (
                            <p className="text-[12px] text-[color:var(--primary)] font-medium mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0 stroke-[2px]" />
                                <span>{errors.approval_document}</span>
                            </p>
                        )}
                    </div>

                    {/* ── Project Members Selector ── */}
                    <div className="space-y-2.5 pt-3 border-t border-[color:var(--border)]">
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-[13px] font-medium text-[color:var(--text)] flex items-center gap-1.5">
                                    <Users className="w-4 h-4 text-[color:var(--primary)] stroke-[2px]" />
                                    <span>Assign team members</span>
                                </label>
                                <p className="text-[11px] text-[color:var(--muted)] mt-0.5">
                                    Add student collaborators. You are automatically set as Project Leader.
                                </p>
                            </div>

                            {data.member_ids.length > 0 && (
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[color:var(--status-neutral-bg)] text-[color:var(--status-neutral-text)] border border-[color:var(--status-neutral-border)] tabular-nums">
                                    {data.member_ids.length} selected
                                </span>
                            )}
                        </div>

                        {/* Search Members Input */}
                        {allUsers.length > 0 && (
                            <div className="space-y-2">
                                <div className="relative">
                                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)] pointer-events-none stroke-[2px]" />
                                    <input
                                        type="text"
                                        value={memberSearch}
                                        onChange={(e) => setMemberSearch(e.target.value)}
                                        placeholder="Search available students by name or email..."
                                        className="w-full pl-8.5 pr-8 py-1.5 text-[13px] rounded-[8px] border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)] placeholder-[color:var(--muted)] focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                                    />
                                    {memberSearch && (
                                        <button
                                            type="button"
                                            onClick={() => setMemberSearch('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[color:var(--muted)] hover:text-[color:var(--text)]"
                                        >
                                            <X className="w-3.5 h-3.5 stroke-[2px]" />
                                        </button>
                                    )}
                                </div>

                                {/* Available Members List */}
                                <div className="border border-[color:var(--border)] rounded-[8px] max-h-40 overflow-y-auto divide-y divide-[color:var(--border)] bg-[color:var(--card)]">
                                    {filteredUsers.length === 0 ? (
                                        <div className="p-3 text-center text-[12px] text-[color:var(--muted)]">
                                            No students found matching "{memberSearch}"
                                        </div>
                                    ) : (
                                        filteredUsers.map((user) => {
                                            const isSelected = data.member_ids.includes(user.id);
                                            const role = data.member_roles[user.id] || 'Project Member';
                                            return (
                                                <div
                                                    key={user.id}
                                                    className={`flex items-center justify-between p-2.5 transition-colors ${
                                                        isSelected
                                                            ? 'bg-[color:var(--soft-surface)]'
                                                            : 'hover:bg-[color:var(--soft-surface)]'
                                                    }`}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleMember(user.id)}
                                                        className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                                                    >
                                                        <div
                                                            className={`w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors ${
                                                                isSelected
                                                                    ? 'bg-[color:var(--primary)] border-[color:var(--primary)] text-white'
                                                                    : 'border-[color:var(--border)] bg-[color:var(--card)]'
                                                            }`}
                                                        >
                                                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                                        </div>

                                                        <Avatar size="sm" className="shrink-0">
                                                            <AvatarFallback className="text-[10px]">
                                                                {getInitials(user.name)}
                                                            </AvatarFallback>
                                                        </Avatar>

                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[13px] font-medium text-[color:var(--text)] truncate">
                                                                {user.name}
                                                            </p>
                                                            <p className="text-[11px] text-[color:var(--muted)] truncate">
                                                                {user.email}
                                                            </p>
                                                        </div>
                                                    </button>

                                                    {/* Role Dropdown when selected */}
                                                    {isSelected && (
                                                        <div className="ml-2 shrink-0">
                                                            <select
                                                                value={role}
                                                                onChange={(e) =>
                                                                    setMemberRole(
                                                                        user.id,
                                                                        e.target.value as 'Project Member' | 'Project Staff'
                                                                    )
                                                                }
                                                                className="text-[11px] font-medium px-2 py-1 rounded-[6px] border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)] cursor-pointer"
                                                            >
                                                                <option value="Project Member">Member</option>
                                                                <option value="Project Staff">Staff</option>
                                                            </select>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </form>

                {/* ── Modal Footer ── */}
                <div className="px-5 py-3.5 border-t border-[color:var(--border)] bg-[color:var(--soft-surface)] flex items-center justify-between shrink-0">
                    <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        onClick={handleClose}
                        disabled={processing}
                    >
                        Cancel
                    </Button>

                    <Button
                        type="submit"
                        form="create-project-form"
                        variant="primary"
                        size="md"
                        isLoading={processing}
                        disabled={processing || !data.title.trim() || !data.approval_document}
                    >
                        Create project
                    </Button>
                </div>
            </div>
        </div>
    );
}
