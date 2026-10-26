import React, { useState, useTransition, useEffect, useMemo } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { motion, AnimatePresence } from 'motion/react';
import { AppLayout } from '@/Layouts/AppLayout';
import { PageProps } from '@/types';
import {
    Users,
    ShieldCheck,
    Shield,
    CheckSquare,
    Search,
    Trash2,
    AlertTriangle,
    Check,
    RefreshCw,
    UserCog,
    Mail,
    Calendar,
    Crown,
    Filter,
    Clock,
    Lock,
    Globe,
    CheckCircle2,
    XCircle,
    X,
    UserCheck,
    UserX,
    ShieldAlert,
    ChevronRight,
    ArrowUpDown,
    CheckCheck,
    Sparkles,
} from 'lucide-react';
import { Modal } from '@/Components/Modal';
import { Avatar, AvatarFallback } from '@/Components/ui/avatar';
import { Button } from '@/Components/Button';
import { Badge } from '@/Components/Badge';
import { Card } from '@/Components/Card';
import { Pagination } from '@/Components/Pagination';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ProjectOption {
    id: number;
    title: string;
}

interface ProjectRoleItem {
    id: number;
    project_id: number;
    project_title: string;
    role: string;
    committee_name?: string | null;
}

interface AdminUserItem {
    id: number;
    name: string;
    email: string;
    email_verified_at: string | null;
    is_admin: boolean;
    created_at: string;
    created_at_formatted: string;
    assigned_tasks_count: number;
    created_projects_count: number;
    computed_roles: string[];
    project_role_assignments: ProjectRoleItem[];
}

interface AdminStats {
    total_users: number;
    pending_verifications?: number;
    verified_users?: number;
    total_admins?: number;
    total_projects?: number;
    active_projects?: number;
    completed_projects?: number;
    planning_projects?: number;
    archived_projects?: number;
    total_tasks?: number;
    completed_tasks?: number;
    total_committees?: number;
    total_activities?: number;
    total_evidence?: number;
}

interface AdminDashboardProps extends PageProps {
    users: AdminUserItem[];
    stats: AdminStats;
    projects?: ProjectOption[];
    availableRoles?: string[];
    activeTab?: string;
    filters?: {
        search?: string;
        role?: string;
    };
    // Kept optional for backward compatibility
    oversightProjects?: any[];
    auditLogs?: any[];
    systemSettings?: any;
}

function getInitials(name: string): string {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0].toUpperCase())
        .join('');
}

type UserViewTab = 'all' | 'pending' | 'verified' | 'admins';

export default function AdminDashboard({
    users = [],
    stats,
    projects = [],
    availableRoles = ['Project Leader', 'Project Staff', 'Project Member'],
    activeTab = 'all',
    filters = {},
}: AdminDashboardProps) {
    const { auth } = usePage<PageProps>().props;
    const currentUserId = auth?.user?.id;

    // ── Tab Management (Solely for User Management) ──
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const initialTabParam = (searchParams?.get('tab') as UserViewTab) || (activeTab as UserViewTab) || 'all';
    
    // Normalize tab key if legacy tab string like 'users' or 'overview' was supplied
    const normalizedInitialTab: UserViewTab = 
        initialTabParam === 'pending'
            ? 'pending'
            : initialTabParam === 'verified'
            ? 'verified'
            : initialTabParam === 'admins'
            ? 'admins'
            : 'all';

    const [currentView, setCurrentView] = useState<UserViewTab>(normalizedInitialTab);

    // Sync tab with URL search parameter if changed externally
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const urlTab = urlParams.get('tab') as UserViewTab;
        if (urlTab && ['all', 'pending', 'verified', 'admins'].includes(urlTab) && urlTab !== currentView) {
            setCurrentView(urlTab);
        }
    }, [window.location.search]);

    const handleSwitchView = (tab: UserViewTab) => {
        setCurrentView(tab);
        setUserCurrentPage(1);
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('tab', tab);
            window.history.replaceState({}, '', url.toString());
        }
    };

    // ── User Management & Filtering State ──
    const [searchTerm, setSearchTerm] = useState(filters.search || '');
    const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
    const [userCurrentPage, setUserCurrentPage] = useState(1);
    const [userPageSize, setUserPageSize] = useState(10);

    // ── Action Modals State ──
    const [roleModalUser, setRoleModalUser] = useState<AdminUserItem | null>(null);
    const [deleteModalUser, setDeleteModalUser] = useState<AdminUserItem | null>(null);
    const [denyModalUser, setDenyModalUser] = useState<AdminUserItem | null>(null);

    // Verification loading states
    const [verifyingUserId, setVerifyingUserId] = useState<number | null>(null);
    const [isDenyingUser, setIsDenyingUser] = useState<boolean>(false);

    // Role assignment form state
    const [selectedProject, setSelectedProject] = useState<string>('');
    const [selectedRole, setSelectedRole] = useState<string>('Project Member');
    const [isAdminChecked, setIsAdminChecked] = useState<boolean>(false);
    const [isSubmittingRole, setIsSubmittingRole] = useState<boolean>(false);
    const [isDeletingUser, setIsDeletingUser] = useState<boolean>(false);

    // ── Counts computation ──
    const counts = useMemo(() => {
        const total = users.length;
        const pending = users.filter((u) => !u.email_verified_at).length;
        const verified = users.filter((u) => Boolean(u.email_verified_at)).length;
        const admins = users.filter((u) => u.is_admin).length;

        return {
            total: stats?.total_users ?? total,
            pending: stats?.pending_verifications ?? pending,
            verified: stats?.verified_users ?? verified,
            admins: stats?.total_admins ?? admins,
        };
    }, [users, stats]);

    // ── Client-side reactive filtering for instant 60fps interaction ──
    const filteredUsers = useMemo(() => {
        return users.filter((u) => {
            // 1. Status / View Tab filter
            if (currentView === 'pending' && u.email_verified_at !== null) {
                return false;
            }
            if (currentView === 'verified' && u.email_verified_at === null) {
                return false;
            }
            if (currentView === 'admins' && !u.is_admin) {
                return false;
            }

            // 2. Search term
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const matchesName = u.name.toLowerCase().includes(term);
                const matchesEmail = u.email.toLowerCase().includes(term);
                if (!matchesName && !matchesEmail) {
                    return false;
                }
            }

            // 3. Project role filter
            if (selectedRoleFilter !== 'all') {
                if (selectedRoleFilter === 'leader') {
                    const isLeader =
                        u.created_projects_count > 0 ||
                        u.project_role_assignments.some((r) => r.role === 'Project Leader');
                    if (!isLeader) return false;
                } else if (selectedRoleFilter === 'staff') {
                    const isStaff = u.project_role_assignments.some((r) => r.role === 'Project Staff');
                    if (!isStaff) return false;
                } else if (selectedRoleFilter === 'member') {
                    const isMember = u.project_role_assignments.some((r) => r.role === 'Project Member');
                    if (!isMember) return false;
                }
            }

            return true;
        });
    }, [users, currentView, searchTerm, selectedRoleFilter]);

    const paginatedUsers = useMemo(() => {
        const start = (userCurrentPage - 1) * userPageSize;
        return filteredUsers.slice(start, start + userPageSize);
    }, [filteredUsers, userCurrentPage, userPageSize]);

    // Reset pagination when filter results shrink
    useEffect(() => {
        const maxPage = Math.max(1, Math.ceil(filteredUsers.length / userPageSize));
        if (userCurrentPage > maxPage) {
            setUserCurrentPage(1);
        }
    }, [filteredUsers.length, userPageSize, userCurrentPage]);

    const handleClearFilters = () => {
        setSearchTerm('');
        setSelectedRoleFilter('all');
        setUserCurrentPage(1);
    };

    // ── User Verification Actions ──
    const handleVerifyUser = (user: AdminUserItem) => {
        setVerifyingUserId(user.id);
        router.post(
            `/admin/users/${user.id}/verify`,
            {},
            {
                preserveScroll: true,
                onFinish: () => {
                    setVerifyingUserId(null);
                },
            }
        );
    };

    const handleConfirmDeny = () => {
        if (!denyModalUser) return;
        setIsDenyingUser(true);
        router.post(
            `/admin/users/${denyModalUser.id}/deny`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIsDenyingUser(false);
                    setDenyModalUser(null);
                },
                onError: () => {
                    setIsDenyingUser(false);
                },
            }
        );
    };

    // ── Role Management ──
    const openRoleModal = (user: AdminUserItem) => {
        setRoleModalUser(user);
        setIsAdminChecked(user.is_admin);
        setSelectedProject(projects.length > 0 ? String(projects[0].id) : '');
        setSelectedRole('Project Member');
    };

    const handleSaveRoleAssignments = (e: React.FormEvent) => {
        e.preventDefault();
        if (!roleModalUser) return;

        setIsSubmittingRole(true);
        router.post(
            `/admin/users/${roleModalUser.id}/role`,
            {
                is_admin: isAdminChecked,
                project_id: selectedProject ? Number(selectedProject) : null,
                role: selectedProject ? selectedRole : null,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIsSubmittingRole(false);
                    setRoleModalUser(null);
                },
                onError: () => {
                    setIsSubmittingRole(false);
                },
            }
        );
    };

    const handleRemoveProjectRole = (user: AdminUserItem, assignmentId: number) => {
        router.post(
            `/admin/users/${user.id}/role`,
            {
                remove_assignment_id: assignmentId,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    if (roleModalUser && roleModalUser.id === user.id) {
                        setRoleModalUser({
                            ...roleModalUser,
                            project_role_assignments: roleModalUser.project_role_assignments.filter(
                                (r) => r.id !== assignmentId
                            ),
                        });
                    }
                },
            }
        );
    };

    // ── Delete Verified Account ──
    const handleConfirmDelete = () => {
        if (!deleteModalUser) return;
        setIsDeletingUser(true);
        router.delete(`/admin/users/${deleteModalUser.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setIsDeletingUser(false);
                setDeleteModalUser(null);
            },
            onError: () => {
                setIsDeletingUser(false);
            },
        });
    };

    // ── Subtabs definition ──
    const VIEW_TABS: { key: UserViewTab; label: string; count: number; badgeColor?: string }[] = [
        {
            key: 'all',
            label: 'All Accounts',
            count: counts.total,
        },
        {
            key: 'pending',
            label: 'Pending Approval',
            count: counts.pending,
            badgeColor: counts.pending > 0 ? 'amber' : undefined,
        },
        {
            key: 'verified',
            label: 'Verified Active',
            count: counts.verified,
        },
        {
            key: 'admins',
            label: 'Administrators',
            count: counts.admins,
        },
    ];

    return (
        <AppLayout
            title="User Management"
            subtitle="Centralized account directory and verification console · Caraga State University"
            breadcrumbs={[
                { label: 'Admin Console', href: '/admin/dashboard' },
                { label: 'User Management' },
            ]}
        >
            <Head title="User Management & Verification · Admin Console" />

            <div className="space-y-6 pb-12 max-w-7xl mx-auto">
                {/* ══ 1. Header Banner ══ */}
                <div className="p-5 rounded-[12px] bg-gradient-to-r from-purple-900/10 via-indigo-900/10 to-transparent border border-purple-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3.5">
                        <div className="w-11 h-11 rounded-[10px] bg-purple-600 text-white flex items-center justify-center shadow-xs shrink-0">
                            <Users className="w-6 h-6 stroke-[2.2]" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-[18px] font-bold text-[color:var(--text)] tracking-tight">
                                    User Management & Verification Console
                                </h1>
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                                    <Lock className="w-3 h-3 stroke-[2.5]" />
                                    Admin Role
                                </span>
                            </div>
                            <p className="text-[12px] text-[color:var(--muted)] mt-0.5">
                                Sole administrative responsibility: decide new user registrations, verify or deny access, and manage user roles.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                        <span className="text-[11px] text-[color:var(--muted)] font-medium hidden lg:inline">
                            Institution Whitelist:
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2.5 py-1 rounded-[6px] bg-[color:var(--card)] border border-[color:var(--border)] text-emerald-600 dark:text-emerald-400">
                            <Globe className="w-3 h-3 stroke-[2]" />
                            @carsu.edu.ph
                        </span>
                    </div>
                </div>

                {/* ══ 2. Primary Metrics Cards ══ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Total Registered Accounts */}
                    <div
                        onClick={() => handleSwitchView('all')}
                        className={`p-5 rounded-[12px] bg-[color:var(--card)] border transition-all cursor-pointer ${
                            currentView === 'all'
                                ? 'border-[color:var(--primary)] ring-1 ring-[color:var(--primary)]/20 shadow-xs'
                                : 'border-[color:var(--border)] hover:border-[color:var(--primary)]/50'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
                                Total Accounts
                            </span>
                            <div className="w-8 h-8 rounded-[8px] bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                <Users className="w-4 h-4 stroke-[2px]" />
                            </div>
                        </div>
                        <div className="mt-3">
                            <div className="text-2xl font-bold text-[color:var(--text)] tracking-tight">
                                {counts.total}
                            </div>
                            <p className="text-[11px] text-[color:var(--muted)] mt-1 font-medium">
                                Total registered accounts in directory
                            </p>
                        </div>
                    </div>

                    {/* Pending Verifications (Highlight if > 0) */}
                    <div
                        onClick={() => handleSwitchView('pending')}
                        className={`p-5 rounded-[12px] transition-all cursor-pointer ${
                            counts.pending > 0
                                ? 'bg-amber-500/10 border border-amber-500/30 ring-1 ring-amber-500/20'
                                : 'bg-[color:var(--card)] border border-[color:var(--border)]'
                        } ${currentView === 'pending' ? 'ring-2 ring-amber-500' : 'hover:border-amber-500/50'}`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[12px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                                    Pending Approvals
                                </span>
                                {counts.pending > 0 && (
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                    </span>
                                )}
                            </div>
                            <div className="w-8 h-8 rounded-[8px] bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                                <Clock className="w-4 h-4 stroke-[2.2]" />
                            </div>
                        </div>
                        <div className="mt-3">
                            <div className="text-2xl font-bold text-amber-900 dark:text-amber-300 tracking-tight">
                                {counts.pending}
                            </div>
                            <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-1 font-medium">
                                {counts.pending > 0
                                    ? 'Awaiting your verification or denial'
                                    : 'Zero pending accounts'}
                            </p>
                        </div>
                    </div>

                    {/* Verified Active Users */}
                    <div
                        onClick={() => handleSwitchView('verified')}
                        className={`p-5 rounded-[12px] bg-[color:var(--card)] border transition-all cursor-pointer ${
                            currentView === 'verified'
                                ? 'border-emerald-500 ring-1 ring-emerald-500/20 shadow-xs'
                                : 'border-[color:var(--border)] hover:border-emerald-500/50'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
                                Verified Users
                            </span>
                            <div className="w-8 h-8 rounded-[8px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                <CheckCircle2 className="w-4 h-4 stroke-[2px]" />
                            </div>
                        </div>
                        <div className="mt-3">
                            <div className="text-2xl font-bold text-[color:var(--text)] tracking-tight">
                                {counts.verified}
                            </div>
                            <p className="text-[11px] text-[color:var(--muted)] mt-1 font-medium">
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                    Approved
                                </span>{' '}
                                & eligible to access projects
                            </p>
                        </div>
                    </div>

                    {/* System Administrators */}
                    <div
                        onClick={() => handleSwitchView('admins')}
                        className={`p-5 rounded-[12px] bg-[color:var(--card)] border transition-all cursor-pointer ${
                            currentView === 'admins'
                                ? 'border-purple-500 ring-1 ring-purple-500/20 shadow-xs'
                                : 'border-[color:var(--border)] hover:border-purple-500/50'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
                                Administrators
                            </span>
                            <div className="w-8 h-8 rounded-[8px] bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                                <ShieldCheck className="w-4 h-4 stroke-[2px]" />
                            </div>
                        </div>
                        <div className="mt-3">
                            <div className="text-2xl font-bold text-[color:var(--text)] tracking-tight">
                                {counts.admins}
                            </div>
                            <p className="text-[11px] text-[color:var(--muted)] mt-1 font-medium">
                                Sole role: User management
                            </p>
                        </div>
                    </div>
                </div>

                {/* ══ 3. High-Attention Pending Registration Banner (Conditional) ══ */}
                {counts.pending > 0 && currentView !== 'pending' && (
                    <div className="p-4 rounded-[12px] bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                        <div className="flex items-start sm:items-center gap-3">
                            <div className="w-9 h-9 rounded-[8px] bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                                <ShieldAlert className="w-5 h-5 stroke-[2.2]" />
                            </div>
                            <div>
                                <h3 className="text-[13px] font-bold text-amber-900 dark:text-amber-200">
                                    {counts.pending} Registration{counts.pending > 1 ? 's' : ''} Awaiting Admin Decision
                                </h3>
                                <p className="text-[12px] text-amber-700/90 dark:text-amber-300/80 mt-0.5">
                                    New accounts must be verified by you before the user can log in or access any project.
                                </p>
                            </div>
                        </div>
                        <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => handleSwitchView('pending')}
                            className="bg-amber-600 hover:bg-amber-700 text-white border-none shrink-0"
                            leftIcon={<Clock className="w-3.5 h-3.5" />}
                        >
                            Review Pending ({counts.pending})
                        </Button>
                    </div>
                )}

                {/* ══ 4. Directory Subtabs & Filtering Section ══ */}
                <div className="space-y-4">
                    {/* View Switcher Pills with Fluid Sliding Animation */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="inline-flex p-1 bg-[color:var(--soft-surface)] rounded-[10px] border border-[color:var(--border)] relative select-none">
                            {VIEW_TABS.map((tab) => {
                                const isActive = currentView === tab.key;
                                return (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => handleSwitchView(tab.key)}
                                        className={`relative px-3.5 py-1.5 text-[13px] font-semibold rounded-[8px] transition-colors cursor-pointer flex items-center gap-2 ${
                                            isActive
                                                ? 'text-[color:var(--text)] font-bold'
                                                : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'
                                        }`}
                                    >
                                        {/* Fluid Sliding Background Indicator */}
                                        {isActive && (
                                            <motion.div
                                                layoutId="userViewActivePill"
                                                className="absolute inset-0 bg-[color:var(--card)] rounded-[8px] shadow-xs border border-[color:var(--border)]"
                                                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                                            />
                                        )}
                                        <span className="relative z-10">{tab.label}</span>
                                        <span
                                            className={`relative z-10 text-[11px] font-bold px-1.5 py-0.2 rounded-full tabular-nums ${
                                                tab.badgeColor === 'amber'
                                                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                                                    : isActive
                                                    ? 'bg-[color:var(--primary)]/10 text-[color:var(--primary)]'
                                                    : 'bg-[color:var(--border)]/60 text-[color:var(--muted)]'
                                            }`}
                                        >
                                            {tab.count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex items-center gap-2 text-[12px] text-[color:var(--muted)] font-medium">
                            <span>
                                Showing <strong className="text-[color:var(--text)]">{filteredUsers.length}</strong> of{' '}
                                <strong className="text-[color:var(--text)]">{counts.total}</strong> accounts
                            </span>
                            {(searchTerm || selectedRoleFilter !== 'all') && (
                                <button
                                    type="button"
                                    onClick={handleClearFilters}
                                    className="text-[12px] font-semibold text-[color:var(--primary)] hover:underline cursor-pointer"
                                >
                                    Reset
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Search and Secondary Role Filters Bar */}
                    <div className="p-4 rounded-[12px] bg-[color:var(--card)] border border-[color:var(--border)] shadow-xs space-y-3">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                            <div className="relative flex-1 max-w-md">
                                <Search className="w-4 h-4 text-[color:var(--muted)] absolute left-3 top-1/2 -translate-y-1/2 stroke-[2px]" />
                                <input
                                    type="text"
                                    placeholder="Search account by name or institutional email..."
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setUserCurrentPage(1);
                                    }}
                                    className="w-full h-10 pl-9 pr-9 text-[13px] rounded-[8px] border border-[color:var(--border)] bg-[color:var(--soft-surface)] text-[color:var(--text)] placeholder-[color:var(--muted)] focus:outline-none focus:border-[color:var(--primary)] transition-colors"
                                />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchTerm('');
                                            setUserCurrentPage(1);
                                        }}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[color:var(--muted)] hover:text-[color:var(--text)] rounded"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Role Filter Pills */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] font-semibold text-[color:var(--muted)] uppercase tracking-wider mr-1 flex items-center gap-1">
                                    <Filter className="w-3 h-3" /> Role:
                                </span>
                                {[
                                    { key: 'all', label: 'All Roles' },
                                    { key: 'leader', label: 'Project Leaders' },
                                    { key: 'staff', label: 'Project Staff' },
                                    { key: 'member', label: 'Project Members' },
                                ].map((filter) => {
                                    const isActive = selectedRoleFilter === filter.key;
                                    return (
                                        <button
                                            key={filter.key}
                                            type="button"
                                            onClick={() => {
                                                setSelectedRoleFilter(filter.key);
                                                setUserCurrentPage(1);
                                            }}
                                            className={`px-2.5 py-1 text-[12px] font-medium rounded-[6px] transition-colors cursor-pointer ${
                                                isActive
                                                    ? 'bg-[color:var(--primary)] text-white shadow-2xs font-semibold'
                                                    : 'bg-[color:var(--soft-surface)] text-[color:var(--muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--border)]'
                                            }`}
                                        >
                                            {filter.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* ══ 5. Users Directory Table ══ */}
                    <div className="rounded-[12px] bg-[color:var(--card)] border border-[color:var(--border)] shadow-xs overflow-hidden">
                        {filteredUsers.length === 0 ? (
                            <div className="p-12 text-center">
                                <Users className="w-8 h-8 text-[color:var(--muted)] mx-auto mb-2 opacity-50" />
                                <h3 className="text-[14px] font-semibold text-[color:var(--text)]">
                                    {currentView === 'pending'
                                        ? 'No registrations currently pending approval'
                                        : 'No users match your criteria'}
                                </h3>
                                <p className="text-[12px] text-[color:var(--muted)] mt-1">
                                    {currentView === 'pending'
                                        ? 'All registered institutional accounts have been verified.'
                                        : 'Try broadening your search term or selecting All Roles.'}
                                </p>
                                {(searchTerm || selectedRoleFilter !== 'all' || currentView !== 'all') && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleClearFilters();
                                            handleSwitchView('all');
                                        }}
                                        className="mt-3 px-3 py-1.5 text-[12px] font-semibold rounded-[6px] bg-[color:var(--soft-surface)] text-[color:var(--text)] hover:bg-[color:var(--border)] transition-colors cursor-pointer"
                                    >
                                        View All Accounts
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-[color:var(--border)] bg-[color:var(--soft-surface)] text-[11px] font-bold text-[color:var(--muted)] uppercase tracking-wider">
                                            <th className="py-3 px-4">User</th>
                                            <th className="py-3 px-4">Institutional Email</th>
                                            <th className="py-3 px-4">Registration Status</th>
                                            <th className="py-3 px-4">System Role</th>
                                            <th className="py-3 px-4">Project Assignments</th>
                                            <th className="py-3 px-4">Workload</th>
                                            <th className="py-3 px-4 text-right">Admin Decisions & Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[color:var(--border)] text-[13px]">
                                        {paginatedUsers.map((u) => {
                                            const isCurrentUser = u.id === currentUserId;
                                            const isPending = !u.email_verified_at;
                                            const isVerifying = verifyingUserId === u.id;

                                            return (
                                                <tr
                                                    key={u.id}
                                                    className={`hover:bg-[color:var(--soft-surface)]/60 transition-colors ${
                                                        isPending ? 'bg-amber-500/[0.03]' : ''
                                                    }`}
                                                >
                                                    {/* User Identity */}
                                                    <td className="py-3.5 px-4">
                                                        <div className="flex items-center gap-3">
                                                            <Avatar size="sm" className="w-8 h-8 shrink-0">
                                                                <AvatarFallback
                                                                    className={`text-[11px] font-bold text-white ${
                                                                        u.is_admin
                                                                            ? 'bg-purple-600'
                                                                            : isPending
                                                                            ? 'bg-amber-500'
                                                                            : 'bg-[color:var(--primary)]'
                                                                    }`}
                                                                >
                                                                    {getInitials(u.name) || 'U'}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className="font-semibold text-[color:var(--text)] truncate max-w-[170px]">
                                                                        {u.name}
                                                                    </span>
                                                                    {isCurrentUser && (
                                                                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                                                                            You
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-[11px] text-[color:var(--muted)] mt-0.5">
                                                                    <span>Joined {u.created_at_formatted}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Email */}
                                                    <td className="py-3.5 px-4 font-mono text-[12px] text-[color:var(--muted)]">
                                                        {u.email}
                                                    </td>

                                                    {/* Registration Status (Verified vs Pending) */}
                                                    <td className="py-3.5 px-4">
                                                        {isPending ? (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                                                <Clock className="w-3 h-3 stroke-[2.5] animate-pulse" />
                                                                Pending Approval
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                                                <CheckCircle2 className="w-3 h-3 stroke-[2.5]" />
                                                                Verified Active
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* System Role */}
                                                    <td className="py-3.5 px-4">
                                                        {u.is_admin ? (
                                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                                                                <ShieldCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                                                                <span>Administrator</span>
                                                            </div>
                                                        ) : (
                                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[color:var(--soft-surface)] text-[color:var(--muted)] border border-[color:var(--border)]">
                                                                <Shield className="w-3.5 h-3.5 stroke-[2px]" />
                                                                <span>Standard User</span>
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Project Roles */}
                                                    <td className="py-3.5 px-4">
                                                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                                                            {u.project_role_assignments.length === 0 && u.created_projects_count === 0 ? (
                                                                <span className="text-[11px] text-[color:var(--muted)] italic">
                                                                    No Project Roles
                                                                </span>
                                                            ) : (
                                                                <>
                                                                    {u.created_projects_count > 0 && (
                                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[11px] font-medium bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                                                                            <Crown className="w-3 h-3 text-indigo-500" />
                                                                            Leader ({u.created_projects_count})
                                                                        </span>
                                                                    )}
                                                                    {u.project_role_assignments.map((pra) => (
                                                                        <span
                                                                            key={pra.id}
                                                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[11px] font-medium border ${
                                                                                pra.role === 'Project Leader'
                                                                                    ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20'
                                                                                    : pra.role === 'Project Staff'
                                                                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                                                                                    : 'bg-[color:var(--soft-surface)] text-[color:var(--text)] border-[color:var(--border)]'
                                                                            }`}
                                                                            title={`Role in ${pra.project_title}`}
                                                                        >
                                                                            <span className="font-semibold">{pra.role}</span>
                                                                            <span className="text-[10px] opacity-75">
                                                                                @{pra.project_title}
                                                                            </span>
                                                                        </span>
                                                                    ))}
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Workload */}
                                                    <td className="py-3.5 px-4 text-[12px] text-[color:var(--muted)]">
                                                        <div className="flex items-center gap-2">
                                                            <span>
                                                                <strong className="text-[color:var(--text)]">
                                                                    {u.assigned_tasks_count}
                                                                </strong>{' '}
                                                                tasks
                                                            </span>
                                                            <span>·</span>
                                                            <span>
                                                                <strong className="text-[color:var(--text)]">
                                                                    {u.created_projects_count}
                                                                </strong>{' '}
                                                                projects
                                                            </span>
                                                        </div>
                                                    </td>

                                                    {/* Admin Decision Actions */}
                                                    <td className="py-3.5 px-4 text-right">
                                                        <div className="inline-flex items-center gap-2">
                                                            {/* IF PENDING: Direct Verify and Deny Buttons */}
                                                            {isPending ? (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleVerifyUser(u)}
                                                                        disabled={isVerifying}
                                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold rounded-[6px] bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                                                                        title="Verify and approve new registration"
                                                                    >
                                                                        {isVerifying ? (
                                                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                                        ) : (
                                                                            <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                                                                        )}
                                                                        <span>Verify</span>
                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setDenyModalUser(u)}
                                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold rounded-[6px] bg-red-600/10 hover:bg-red-600 text-red-600 hover:text-white border border-red-500/20 hover:border-transparent transition-colors cursor-pointer"
                                                                        title="Deny and reject new registration"
                                                                    >
                                                                        <XCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                                                                        <span>Deny</span>
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                // IF VERIFIED: Manage Roles & Delete
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openRoleModal(u)}
                                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium rounded-[6px] border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)] transition-colors cursor-pointer"
                                                                        title="Configure system privileges & project roles"
                                                                    >
                                                                        <UserCog className="w-3.5 h-3.5 stroke-[2px]" />
                                                                        <span>Manage Roles</span>
                                                                    </button>

                                                                    {!isCurrentUser && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setDeleteModalUser(u)}
                                                                            className="p-1.5 text-[color:var(--muted)] hover:text-red-600 hover:bg-red-500/10 rounded-[6px] transition-colors cursor-pointer"
                                                                            title={`Remove user account for ${u.name}`}
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5 stroke-[2px]" />
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {filteredUsers.length > 0 && (
                            <Pagination
                                currentPage={userCurrentPage}
                                totalItems={filteredUsers.length}
                                pageSize={userPageSize}
                                pageSizeOptions={[5, 10, 25, 50]}
                                onPageChange={setUserCurrentPage}
                                onPageSizeChange={(newSize) => {
                                    setUserPageSize(newSize);
                                    setUserCurrentPage(1);
                                }}
                                itemLabel="accounts"
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* ══ Modal 1: Deny User Registration ══ */}
            <Modal
                isOpen={Boolean(denyModalUser)}
                onClose={() => setDenyModalUser(null)}
                title="Deny User Registration"
                maxWidth="md"
            >
                {denyModalUser && (
                    <div className="space-y-4 pt-1">
                        <div className="flex items-start gap-3 p-3.5 rounded-[8px] bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400">
                            <UserX className="w-5 h-5 shrink-0 mt-0.5" />
                            <div className="text-[13px] leading-relaxed">
                                Are you sure you want to deny registration for{' '}
                                <strong className="font-bold">{denyModalUser.name}</strong> ({denyModalUser.email})?
                                This will reject and permanently remove their unverified account. The user will not be able to log in.
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setDenyModalUser(null)}
                                className="px-3 py-1.5 text-[12px] font-semibold rounded-[6px] border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted)] hover:text-[color:var(--text)] transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDeny}
                                disabled={isDenyingUser}
                                className="px-3.5 py-1.5 text-[12px] font-semibold rounded-[6px] bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50"
                            >
                                {isDenyingUser ? 'Denying Account...' : 'Confirm Deny & Remove'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* ══ Modal 2: Manage User Roles & Access ══ */}
            <Modal
                isOpen={Boolean(roleModalUser)}
                onClose={() => setRoleModalUser(null)}
                title="Manage User Roles & Access"
                description={
                    roleModalUser
                        ? `Configure permissions and project assignments for ${roleModalUser.name}.`
                        : undefined
                }
                maxWidth="lg"
            >
                {roleModalUser && (
                    <form onSubmit={handleSaveRoleAssignments} className="space-y-5 pt-1">
                        {/* User Identity Card */}
                        <div className="p-3 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] flex items-center justify-between">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <Avatar size="sm" className="w-9 h-9">
                                    <AvatarFallback className="text-[12px] font-bold bg-[color:var(--primary)] text-white">
                                        {getInitials(roleModalUser.name)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                    <p className="text-[13px] font-bold text-[color:var(--text)] truncate">
                                        {roleModalUser.name}
                                    </p>
                                    <p className="text-[11px] text-[color:var(--muted)] truncate">
                                        {roleModalUser.email}
                                    </p>
                                </div>
                            </div>
                            <span className="text-[11px] text-[color:var(--muted)]">
                                ID: #{roleModalUser.id}
                            </span>
                        </div>

                        {/* Section 1: Administrator Status */}
                        <div className="p-3.5 rounded-[8px] border border-purple-500/30 bg-purple-500/5 space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400 stroke-[2.5]" />
                                    <span className="text-[13px] font-semibold text-[color:var(--text)]">
                                        Administrator Role
                                    </span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isAdminChecked}
                                        disabled={roleModalUser.id === currentUserId}
                                        onChange={(e) => setIsAdminChecked(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                                </label>
                            </div>
                            <p className="text-[11px] text-[color:var(--muted)]">
                                Administrators have dedicated authority over User Management, verification decisions, and role governance.
                            </p>
                            {roleModalUser.id === currentUserId && (
                                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                                    You cannot remove your own administrator status.
                                </p>
                            )}
                        </div>

                        {/* Section 2: Assign Project Role */}
                        <div className="space-y-3 pt-2 border-t border-[color:var(--border)]">
                            <h4 className="text-[13px] font-bold text-[color:var(--text)] flex items-center gap-1.5">
                                <Crown className="w-4 h-4 text-indigo-500" />
                                Assign / Update Project Role
                            </h4>
                            <p className="text-[11px] text-[color:var(--muted)]">
                                Assign this user to a project workspace with an official role.
                            </p>

                            {projects.length === 0 ? (
                                <div className="p-3 text-[12px] text-[color:var(--muted)] italic bg-[color:var(--soft-surface)] rounded-[6px]">
                                    No active projects available to assign.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-[color:var(--muted)] uppercase tracking-wider mb-1">
                                            Select Project
                                        </label>
                                        <select
                                            value={selectedProject}
                                            onChange={(e) => setSelectedProject(e.target.value)}
                                            className="w-full h-9 px-2.5 text-[12px] rounded-[6px] border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)] focus:outline-none focus:border-[color:var(--primary)]"
                                        >
                                            <option value="">-- Choose Project (Optional) --</option>
                                            {projects.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.title}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-[color:var(--muted)] uppercase tracking-wider mb-1">
                                            Assign Role
                                        </label>
                                        <select
                                            value={selectedRole}
                                            onChange={(e) => setSelectedRole(e.target.value)}
                                            disabled={!selectedProject}
                                            className="w-full h-9 px-2.5 text-[12px] rounded-[6px] border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)] focus:outline-none focus:border-[color:var(--primary)] disabled:opacity-50"
                                        >
                                            {availableRoles.map((r) => (
                                                <option key={r} value={r}>
                                                    {r}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Section 3: Existing Project Roles */}
                        <div className="space-y-2 pt-2 border-t border-[color:var(--border)]">
                            <h4 className="text-[12px] font-bold text-[color:var(--text)] uppercase tracking-wider">
                                Current Role Assignments
                            </h4>
                            {roleModalUser.project_role_assignments.length === 0 ? (
                                <p className="text-[12px] text-[color:var(--muted)] italic">
                                    No specific project role assignments found.
                                </p>
                            ) : (
                                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                    {roleModalUser.project_role_assignments.map((pra) => (
                                        <div
                                            key={pra.id}
                                            className="p-2 rounded-[6px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] flex items-center justify-between text-[12px]"
                                        >
                                            <div className="min-w-0 pr-2">
                                                <span className="font-semibold text-[color:var(--text)]">
                                                    {pra.project_title}
                                                </span>
                                                <span className="text-[color:var(--muted)] ml-1">·</span>
                                                <span className="text-[color:var(--primary)] ml-1 font-medium">
                                                    {pra.role}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveProjectRole(roleModalUser, pra.id)}
                                                className="text-[11px] text-red-600 hover:underline cursor-pointer shrink-0 font-medium"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[color:var(--border)]">
                            <button
                                type="button"
                                onClick={() => setRoleModalUser(null)}
                                className="px-3 py-1.5 text-[12px] font-semibold rounded-[6px] border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted)] hover:text-[color:var(--text)] transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmittingRole}
                                className="px-3.5 py-1.5 text-[12px] font-semibold rounded-[6px] bg-[color:var(--primary)] text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                            >
                                {isSubmittingRole ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* ══ Modal 3: Delete User Account Confirmation ══ */}
            <Modal
                isOpen={Boolean(deleteModalUser)}
                onClose={() => setDeleteModalUser(null)}
                title="Remove User Account"
                maxWidth="md"
            >
                {deleteModalUser && (
                    <div className="space-y-4 pt-1">
                        <div className="flex items-start gap-3 p-3.5 rounded-[8px] bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400">
                            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                            <div className="text-[13px] leading-relaxed">
                                Are you sure you want to permanently remove the account for{' '}
                                <strong className="font-bold">{deleteModalUser.name}</strong> ({deleteModalUser.email})?
                                This action is permanent and will dissociate their task assignments.
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setDeleteModalUser(null)}
                                className="px-3 py-1.5 text-[12px] font-semibold rounded-[6px] border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted)] hover:text-[color:var(--text)] transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDelete}
                                disabled={isDeletingUser}
                                className="px-3.5 py-1.5 text-[12px] font-semibold rounded-[6px] bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50"
                            >
                                {isDeletingUser ? 'Removing...' : 'Permanently Remove Account'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </AppLayout>
    );
}
