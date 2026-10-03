import React, { useState, useEffect } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import { PageProps } from '@/types';
import {
    LayoutDashboard,
    FolderOpen,
    CheckSquare,
    CalendarDays,
    GanttChartSquare,
    MessageSquare,
    Bell,
    Search,
    Menu,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    LogOut,
    User as UserIcon,
    Settings,
    CheckCircle2,
    Plus,
    Pin,
    PinOff,
} from 'lucide-react';

import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from '@/Components/ui/avatar';
import { Alert } from '@/Components/Alert';
import { NotificationDropdown } from '@/Components/NotificationDropdown';
import { ThemeToggle } from '@/Components/ThemeToggle';
import { CommandPalette } from '@/Components/CommandPalette';
import { QuickNewTaskModal } from '@/Components/QuickNewTaskModal';
import { CreateProjectModal } from '@/Components/CreateProjectModal';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/Components/ui/dropdown-menu';
import {
    Sheet,
    SheetContent,
    SheetTrigger,
} from '@/Components/ui/sheet';
import { Separator } from '@/Components/ui/separator';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/Components/ui/tooltip';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CurrentProjectInfo {
    id?: string;
    title: string;
    role?: string;
    status?: string;
}

export interface AppLayoutProps {
    title?: string;
    subtitle?: string;
    headerAction?: React.ReactNode;
    currentProject?: CurrentProjectInfo | null;
    hidePageHeadingBanner?: boolean;
    children: React.ReactNode;
}

interface NavItemDef {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    exact?: boolean;
    countKey?: 'projects' | 'tasks';
}

// ─── Navigation Definitions ──────────────────────────────────────────────────
const MAIN_NAV_ITEMS: NavItemDef[] = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
    { name: 'Projects', href: '/projects', icon: FolderOpen, countKey: 'projects' },
    { name: 'My Tasks', href: '/my-tasks', icon: CheckSquare, countKey: 'tasks' },
    { name: 'Calendar', href: '/calendar', icon: CalendarDays },
    { name: 'Timeline', href: '/timeline', icon: GanttChartSquare },
];

const COLLABORATE_NAV_ITEMS: NavItemDef[] = [
    { name: 'Messages', href: '/messages', icon: MessageSquare, countKey: 'messages' as any },
    { name: 'Notifications', href: '/notifications', icon: Bell },
];

function getInitials(name: string): string {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join('');
}

// ─── Sidebar Nav Item ────────────────────────────────────────────────────────

interface SidebarNavItemProps {
    item: NavItemDef;
    isActive: boolean;
    isCollapsed?: boolean;
    badgeCount?: number;
    isTaskNeedingAction?: boolean;
    onClick?: () => void;
}

function SidebarNavItem({
    item,
    isActive,
    isCollapsed = false,
    badgeCount,
    isTaskNeedingAction = false,
    onClick,
}: SidebarNavItemProps) {
    const Icon = item.icon;

    // Requirement:
    // Active item: cream pill (#F3F1E2) with charcoal text and bold weight,
    // plus a 4px yellow marker on the left edge. Remove old small dot.
    const activeClass =
        'relative bg-[#F3F1E2] dark:bg-[#383838] text-[#2A2A2A] dark:text-[#FFFEF9] font-bold shadow-xs';

    const inactiveClass =
        'text-[#B9B6A3] hover:text-[#F3F1E2] hover:bg-white/10 font-medium';

    const baseClass = isCollapsed
        ? 'group relative flex items-center justify-center w-10 h-10 mx-auto rounded-xl text-xs transition-colors duration-150'
        : 'group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] transition-colors duration-150 w-full';

    const linkContent = (
        <Link
            href={item.href}
            onClick={onClick}
            className={`${baseClass} ${isActive ? activeClass : inactiveClass}`}
            aria-label={item.name}
        >
            {/* 4px Yellow Marker on Left Edge for Active Items */}
            {isActive && (
                <span
                    className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#FFBB00]"
                    aria-hidden="true"
                />
            )}

            <Icon
                className={`w-4.5 h-4.5 shrink-0 transition-colors ${
                    isActive
                        ? 'text-[#2A2A2A] dark:text-[#FFBB00]'
                        : 'text-[#B9B6A3] group-hover:text-[#F3F1E2]'
                }`}
            />

            {!isCollapsed && <span className="flex-1 truncate">{item.name}</span>}

            {/* Badges: Projects count & My Tasks (orange badge when needing action) */}
            {!isCollapsed && badgeCount !== undefined && badgeCount > 0 && (
                <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        isTaskNeedingAction
                            ? 'bg-[#EC7505] text-[#2A2A2A]'
                            : 'bg-white/15 text-[#F3F1E2]'
                    }`}
                >
                    {badgeCount}
                </span>
            )}
        </Link>
    );

    if (isCollapsed) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent side="right" className="text-xs font-bold">
                    {item.name}
                    {badgeCount !== undefined && badgeCount > 0 && ` (${badgeCount})`}
                </TooltipContent>
            </Tooltip>
        );
    }

    return linkContent;
}

// ─── Sidebar Content ─────────────────────────────────────────────────────────

interface SidebarContentProps {
    user: { name: string; email: string } | null;
    userRole?: string;
    currentPage: string;
    currentProject?: CurrentProjectInfo | null;
    projectsCount?: number;
    tasksCount?: number;
    tasksNeedingAction?: boolean;
    unreadMessagesCount?: number;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
    onNavClick?: () => void;
    onLogout: () => void;
    onOpenCreateProject?: () => void;
}

function SidebarContent({
    user,
    userRole = 'Student',
    currentPage,
    currentProject,
    projectsCount = 0,
    tasksCount = 0,
    tasksNeedingAction = false,
    unreadMessagesCount = 0,
    isCollapsed = false,
    onToggleCollapse,
    onNavClick,
    onLogout,
    onOpenCreateProject,
}: SidebarContentProps) {
    // Pinned projects in localStorage
    const [pinnedProjects, setPinnedProjects] = useState<Array<{ id: string; title: string }>>(() => {
        if (typeof window === 'undefined') return [];
        try {
            const raw = localStorage.getItem('itask_pinned_projects');
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    });

    const activeProject = currentProject ?? null;

    return (
        <div className="flex flex-col h-full select-none">
            {/* ── Brand Header ── */}
            <div
                className={`h-16 border-b border-white/10 flex items-center shrink-0 ${
                    isCollapsed ? 'px-2 justify-center' : 'px-4 justify-between'
                }`}
            >
                {!isCollapsed ? (
                    <>
                        <Link
                            href="/dashboard"
                            onClick={onNavClick}
                            className="flex items-center gap-2.5 group min-w-0"
                        >
                            {/* Brand yellow logo tile with charcoal checkmark */}
                            <div className="w-8 h-8 rounded-xl bg-[#FFBB00] flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform">
                                <CheckCircle2 className="w-5 h-5 text-[#2A2A2A]" strokeWidth={2.5} />
                            </div>
                            <div className="flex flex-col">
                                <span className="font-extrabold text-base tracking-tight text-[#F3F1E2] block leading-none">
                                    ITASK
                                </span>
                                <span className="text-[10px] text-[#B9B6A3] font-medium tracking-wide">
                                    Student Workspace
                                </span>
                            </div>
                        </Link>
                        {onToggleCollapse && (
                            <button
                                type="button"
                                onClick={onToggleCollapse}
                                className="p-1.5 rounded-lg text-[#B9B6A3] hover:text-[#F3F1E2] hover:bg-white/10 transition-colors cursor-pointer"
                                title="Collapse sidebar"
                                aria-label="Collapse sidebar"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                        )}
                    </>
                ) : (
                    onToggleCollapse ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    onClick={onToggleCollapse}
                                    className="w-9 h-9 rounded-xl bg-[#FFBB00] flex items-center justify-center text-[#2A2A2A] hover:opacity-90 transition-all cursor-pointer shadow-md"
                                    title="Expand sidebar"
                                    aria-label="Expand sidebar"
                                >
                                    <ChevronRight className="w-5 h-5" strokeWidth={2.5} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="text-xs font-bold">
                                Expand sidebar
                            </TooltipContent>
                        </Tooltip>
                    ) : (
                        <div className="w-8 h-8 rounded-xl bg-[#FFBB00] flex items-center justify-center shrink-0 shadow-md">
                            <CheckCircle2 className="w-5 h-5 text-[#2A2A2A]" strokeWidth={2.5} />
                        </div>
                    )
                )}
            </div>

            {/* ── Navigation Groups ── */}
            <div
                className={`flex-1 overflow-y-auto ${
                    isCollapsed ? 'px-2 py-3 space-y-4' : 'px-3 py-4 space-y-5'
                }`}
            >
                {/* 1. Main Navigation */}
                <div>
                    {!isCollapsed && (
                        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-[#B9B6A3]/70">
                            Main
                        </p>
                    )}
                    <div className="space-y-1">
                        {MAIN_NAV_ITEMS.map((item) => {
                            const isActive =
                                item.exact || item.href === '/dashboard'
                                    ? currentPage === item.href
                                    : currentPage === item.href || currentPage.startsWith(`${item.href}/`);

                            let badgeCount: number | undefined;
                            let isTaskNeedingAction = false;

                            if (item.countKey === 'projects') {
                                badgeCount = projectsCount > 0 ? projectsCount : undefined;
                            } else if (item.countKey === 'tasks') {
                                badgeCount = tasksCount > 0 ? tasksCount : undefined;
                                isTaskNeedingAction = tasksNeedingAction;
                            }

                            return (
                                <SidebarNavItem
                                    key={item.name}
                                    item={item}
                                    isActive={isActive}
                                    isCollapsed={isCollapsed}
                                    badgeCount={badgeCount}
                                    isTaskNeedingAction={isTaskNeedingAction}
                                    onClick={onNavClick}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* 2. Collaborate Navigation */}
                <div>
                    {!isCollapsed && (
                        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-[#B9B6A3]/70">
                            Collaborate
                        </p>
                    )}
                    <div className="space-y-1">
                        {COLLABORATE_NAV_ITEMS.map((item) => {
                            const isMessages = item.name === 'Messages';
                            const isActive = isMessages
                                ? currentPage.startsWith('/messages') || currentPage.startsWith('/chat')
                                : currentPage === item.href || currentPage.startsWith(`${item.href}/`);

                            let badgeCount: number | undefined;
                            let isTaskNeedingAction = false;

                            if (isMessages && unreadMessagesCount > 0) {
                                badgeCount = unreadMessagesCount;
                                isTaskNeedingAction = true; // Orange badge for unread messages per spec!
                            }

                            return (
                                <SidebarNavItem
                                    key={item.name}
                                    item={item}
                                    isActive={isActive}
                                    isCollapsed={isCollapsed}
                                    badgeCount={badgeCount}
                                    isTaskNeedingAction={isTaskNeedingAction}
                                    onClick={onNavClick}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* 3. Pinned Projects Section */}
                {!isCollapsed && (
                    <div className="pt-1">
                        <div className="flex items-center justify-between px-3 pb-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#B9B6A3]/70">
                                Pinned Projects
                            </p>
                            <Pin className="w-3 h-3 text-[#B9B6A3]/60" />
                        </div>
                        {pinnedProjects.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-[#B9B6A3] italic bg-white/5 rounded-xl border border-white/5 text-center">
                                Pin a project to see it here
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {pinnedProjects.map((p) => (
                                    <Link
                                        key={p.id}
                                        href={`/projects/${p.id}`}
                                        onClick={onNavClick}
                                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#F3F1E2] hover:bg-white/10 transition-colors truncate"
                                    >
                                        <FolderOpen className="w-3.5 h-3.5 text-[#FFBB00] shrink-0" />
                                        <span className="truncate">{p.title}</span>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Active Project Context (if viewing a project) ── */}
            {activeProject && !isCollapsed && (
                <div className="mx-3 mb-2 rounded-xl border border-white/10 bg-white/5 p-3 shrink-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#B9B6A3] mb-1.5">
                        Active Project
                    </p>
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-lg bg-[#EC7505] flex items-center justify-center shrink-0 text-[#2A2A2A]">
                            <FolderOpen className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-[#F3F1E2] truncate">
                                {activeProject.title}
                            </p>
                            <p className="text-[10px] text-[#B9B6A3] truncate">
                                {activeProject.role || 'Project Role'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Bottom Profile Card (Show profile only once here!) ── */}
            {!isCollapsed ? (
                <div className="p-3 shrink-0 border-t border-white/10">
                    {user ? (
                        <div className="flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/10 group">
                            {/* Amber yellow avatar with charcoal text */}
                            <Avatar size="sm" className="shrink-0 ring-2 ring-[#FFBB00]/30">
                                <AvatarImage src={undefined} />
                                <AvatarFallback className="text-[11px] font-extrabold bg-[#FFBB00] text-[#2A2A2A]">
                                    {getInitials(user.name)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-[#F3F1E2] truncate">
                                    {user.name}
                                </p>
                                <p className="text-[10px] font-medium text-[#B9B6A3] truncate">
                                    {userRole}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={onLogout}
                                className="p-1.5 rounded-lg text-[#B9B6A3] hover:text-rose-400 hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                                title="Sign out"
                                aria-label="Sign out"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ) : (
                        <Link
                            href="/login"
                            className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-[#F3F1E2] hover:bg-white/10 rounded-xl transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            Sign In
                        </Link>
                    )}
                </div>
            ) : (
                <div className="p-2 shrink-0 border-t border-white/10 flex flex-col items-center gap-2">
                    {user && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Avatar size="sm" className="shrink-0 cursor-pointer ring-2 ring-[#FFBB00]/30">
                                    <AvatarFallback className="text-[10px] font-bold bg-[#FFBB00] text-[#2A2A2A]">
                                        {getInitials(user.name)}
                                    </AvatarFallback>
                                </Avatar>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="text-xs">
                                <p className="font-bold">{user.name}</p>
                                <p className="text-[10px] text-slate-300">{userRole}</p>
                            </TooltipContent>
                        </Tooltip>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Main AppLayout ───────────────────────────────────────────────────────────

export const AppLayout: React.FC<AppLayoutProps> = ({
    title,
    subtitle,
    headerAction,
    currentProject,
    hidePageHeadingBanner = false,
    children,
}) => {
    const pageProps = usePage<PageProps & {
        url?: string;
        primaryRole?: string;
        stats?: {
            activeProjectsCount?: number;
            assignedTasksCount?: number;
            returnedTasksCount?: number;
            overdueTasksCount?: number;
        };
        projects?: Array<any>;
        assignedTasks?: Array<any>;
    }>().props;

    const { auth, flash, primaryRole, stats, projects, assignedTasks } = pageProps;

    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [dismissedFlash, setDismissedFlash] = useState<string | null>(null);

    // Modals
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
    const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);

    // Shortcut detection (Mac vs Win)
    const [shortcutLabel, setShortcutLabel] = useState('Ctrl K');
    useEffect(() => {
        if (typeof window !== 'undefined' && navigator.platform?.toUpperCase().indexOf('MAC') >= 0) {
            setShortcutLabel('⌘K');
        }
    }, []);

    // Collapsed sidebar state
    const [isCollapsed, setIsCollapsed] = useState(() => {
        if (typeof window !== 'undefined') {
            try {
                return localStorage.getItem('itask_sidebar_collapsed') === 'true';
            } catch {
                return false;
            }
        }
        return false;
    });

    const toggleCollapse = () => {
        setIsCollapsed((prev) => {
            const next = !prev;
            if (typeof window !== 'undefined') {
                try {
                    localStorage.setItem('itask_sidebar_collapsed', String(next));
                } catch {
                    // ignore
                }
            }
            return next;
        });
    };

    const user = auth?.user ? { name: auth.user.name, email: auth.user.email } : null;
    const userRole = primaryRole || 'Student';

    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/dashboard';

    const handleLogout = () => {
        router.post('/logout');
    };

    // Calculate badge counts
    const activeProjectsCount = stats?.activeProjectsCount ?? projects?.length ?? 0;
    const tasksCount = stats?.assignedTasksCount ?? (pageProps as any).my_tasks_count ?? assignedTasks?.length ?? 0;
    const tasksNeedingAction = (stats?.returnedTasksCount ?? 0) > 0 || (stats?.overdueTasksCount ?? 0) > 0;
    const unreadMessagesCount = (pageProps as any).unread_messages_count ?? 0;

    return (
        <div className="min-h-screen flex bg-[var(--bg)] text-[var(--ink)] antialiased">
            {/* ══ Desktop Sidebar (Hidden below 820px per layout spec) ════════ */}
            <aside
                className={`hidden min-[820px]:flex min-[820px]:flex-col shrink-0 fixed inset-y-0 left-0 z-30 transition-all duration-200 ease-in-out border-r border-[var(--sidebar-border)] ${
                    isCollapsed ? 'w-[72px]' : 'w-64'
                }`}
                style={{
                    background: 'linear-gradient(180deg, var(--sidebar-grad-from) 0%, var(--sidebar-grad-to) 100%)',
                }}
            >
                <SidebarContent
                    user={user}
                    userRole={userRole}
                    currentPage={currentPath}
                    currentProject={currentProject}
                    projectsCount={activeProjectsCount}
                    tasksCount={tasksCount}
                    tasksNeedingAction={tasksNeedingAction}
                    unreadMessagesCount={unreadMessagesCount}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={toggleCollapse}
                    onLogout={handleLogout}
                    onOpenCreateProject={() => setIsCreateProjectOpen(true)}
                />
            </aside>

            {/* ══ Main Area (Offset for sidebar on >= 820px) ═════════════════ */}
            <div
                className={`flex flex-col min-w-0 w-full transition-all duration-200 ease-in-out ${
                    isCollapsed ? 'min-[820px]:pl-[72px]' : 'min-[820px]:pl-64'
                }`}
            >
                {/* ── Topbar Header ────────────────────────────────────────── */}
                <header className="h-16 px-4 sm:px-6 lg:px-8 border-b border-[var(--border)] flex items-center justify-between bg-[var(--card)] shrink-0 sticky top-0 z-20 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)]">
                    {/* Left: Mobile hamburger menu (< 820px) */}
                    <div className="flex items-center gap-3 min-w-0">
                        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
                            <SheetTrigger asChild>
                                <button
                                    type="button"
                                    className="min-[820px]:hidden p-2 rounded-xl text-[var(--muted)] hover:bg-[var(--tint-neutral)] transition-colors cursor-pointer"
                                    aria-label="Open navigation drawer"
                                >
                                    <Menu className="w-5 h-5 text-[var(--ink)]" />
                                </button>
                            </SheetTrigger>
                            <SheetContent
                                side="left"
                                className="p-0 w-72 border-r-0 text-white"
                                style={{
                                    background: 'linear-gradient(180deg, var(--sidebar-grad-from) 0%, var(--sidebar-grad-to) 100%)',
                                }}
                            >
                                <SidebarContent
                                    user={user}
                                    userRole={userRole}
                                    currentPage={currentPath}
                                    currentProject={currentProject}
                                    projectsCount={activeProjectsCount}
                                    tasksCount={tasksCount}
                                    tasksNeedingAction={tasksNeedingAction}
                                    unreadMessagesCount={unreadMessagesCount}
                                    isCollapsed={false}
                                    onNavClick={() => setIsMobileOpen(false)}
                                    onLogout={() => {
                                        setIsMobileOpen(false);
                                        handleLogout();
                                    }}
                                    onOpenCreateProject={() => {
                                        setIsMobileOpen(false);
                                        setIsCreateProjectOpen(true);
                                    }}
                                />
                            </SheetContent>
                        </Sheet>

                        {/* Search bar: Larger, with "Search tasks, projects, people" & "Ctrl K" */}
                        <button
                            type="button"
                            onClick={() => setIsCommandPaletteOpen(true)}
                            className="flex items-center justify-between h-10 w-48 sm:w-72 md:w-80 lg:w-96 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--tint-neutral)]/40 text-[var(--muted)] hover:border-[#EC7505] hover:bg-[var(--card)] transition-all cursor-pointer text-left group"
                        >
                            <div className="flex items-center gap-2.5 truncate">
                                <Search className="w-4 h-4 text-[var(--muted)] group-hover:text-[#EC7505] transition-colors shrink-0" />
                                <span className="text-xs sm:text-[13px] truncate">
                                    Search tasks, projects, people
                                </span>
                            </div>
                            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-bold text-[var(--muted)] bg-[var(--card)] border border-[var(--border)] rounded-md shrink-0 shadow-xs">
                                {shortcutLabel}
                            </kbd>
                        </button>
                    </div>

                    {/* Right: + New task + Notification bell + Theme toggle + Avatar */}
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {/* Primary "+ New task" Button (Orange with charcoal text) */}
                        <button
                            type="button"
                            onClick={() => setIsNewTaskOpen(true)}
                            className="btn-primary-orange inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-[13px] transition-all shadow-sm hover:shadow cursor-pointer shrink-0"
                            title="Create a new task"
                        >
                            <Plus className="w-4 h-4 text-[#2A2A2A]" strokeWidth={2.5} />
                            <span className="font-bold">+ New task</span>
                        </button>

                        {/* Notification Bell with unread orange dot */}
                        <NotificationDropdown />

                        {/* Theme Toggle (Light / Dark / System) */}
                        <ThemeToggle />

                        <Separator orientation="vertical" className="h-6 mx-0.5 bg-[var(--border)]" />

                        {/* Header User Profile: Avatar ONLY (Removed duplicate name/email) */}
                        {user ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        className="rounded-full p-0.5 hover:ring-2 hover:ring-[#FFBB00] transition-all cursor-pointer"
                                        aria-label="Account menu"
                                    >
                                        <Avatar size="sm" className="shrink-0">
                                            <AvatarImage src={undefined} />
                                            <AvatarFallback className="text-[11px] font-extrabold bg-[#FFBB00] text-[#2A2A2A]">
                                                {getInitials(user.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56 mt-1 p-1 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg">
                                    <DropdownMenuLabel className="font-normal px-3 py-2">
                                        <p className="text-xs font-bold text-[var(--ink)] truncate">
                                            {user.name}
                                        </p>
                                        <p className="text-[11px] text-[var(--muted)] truncate">
                                            {user.email}
                                        </p>
                                        <span className="inline-block mt-1 text-[10px] font-bold text-[#8A5A00] dark:text-[#FFBB00] bg-[var(--tint-yellow)] px-2 py-0.5 rounded-full">
                                            {userRole}
                                        </span>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator className="bg-[var(--border)]" />
                                    <DropdownMenuItem
                                        onClick={() => router.visit('/my-tasks')}
                                        className="text-xs font-semibold text-[var(--ink)] cursor-pointer hover:bg-[var(--tint-neutral)] rounded-lg"
                                    >
                                        <CheckSquare className="w-3.5 h-3.5 mr-2 text-[var(--link-orange)]" />
                                        My Tasks
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => router.visit('/projects')}
                                        className="text-xs font-semibold text-[var(--ink)] cursor-pointer hover:bg-[var(--tint-neutral)] rounded-lg"
                                    >
                                        <FolderOpen className="w-3.5 h-3.5 mr-2 text-[#FFBB00]" />
                                        My Projects
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="bg-[var(--border)]" />
                                    <DropdownMenuItem
                                        onClick={handleLogout}
                                        className="text-xs font-semibold text-rose-600 focus:text-rose-700 focus:bg-rose-50 dark:focus:bg-rose-950/40 cursor-pointer rounded-lg"
                                    >
                                        <LogOut className="w-3.5 h-3.5 mr-2" />
                                        Sign Out
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <Link
                                href="/login"
                                className="text-xs font-bold text-[var(--ink)] hover:text-[#EC7505] transition-colors"
                            >
                                Sign In
                            </Link>
                        )}
                    </div>
                </header>

                {/* ── Optional Page Heading Banner ─────────────────────────── */}
                {!hidePageHeadingBanner && (title || headerAction) && (
                    <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-5 bg-[var(--card)] border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="min-w-0">
                            {title && (
                                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[var(--ink)] leading-snug">
                                    {title}
                                </h1>
                            )}
                            {subtitle && (
                                <p className="text-xs sm:text-sm text-[var(--muted)] mt-1 leading-relaxed">
                                    {subtitle}
                                </p>
                            )}
                        </div>
                        {headerAction && <div className="shrink-0">{headerAction}</div>}
                    </div>
                )}

                {/* ── Main Content Container (Consistent 32px desktop padding, 16px mobile) ── */}
                <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto">
                    {/* Global Flash Alerts */}
                    {(flash?.success || flash?.status) && dismissedFlash !== (flash.success || flash.status) && (
                        <div className="mb-5">
                            <Alert
                                variant="success"
                                onClose={() => setDismissedFlash(flash.success || flash.status || null)}
                            >
                                {flash.success || flash.status}
                            </Alert>
                        </div>
                    )}
                    {flash?.error && dismissedFlash !== flash.error && (
                        <div className="mb-5">
                            <Alert
                                variant="danger"
                                onClose={() => setDismissedFlash(flash.error || null)}
                            >
                                {flash.error}
                            </Alert>
                        </div>
                    )}

                    {children}
                </main>
            </div>

            {/* ══ Global App Modals ═════════════════════════════════════════ */}
            <CommandPalette
                isOpen={isCommandPaletteOpen}
                onClose={() => setIsCommandPaletteOpen(false)}
                onOpenNewTask={() => setIsNewTaskOpen(true)}
                onOpenCreateProject={() => setIsCreateProjectOpen(true)}
            />

            <QuickNewTaskModal
                isOpen={isNewTaskOpen}
                onClose={() => setIsNewTaskOpen(false)}
                onOpenCreateProject={() => setIsCreateProjectOpen(true)}
            />

            <CreateProjectModal
                isOpen={isCreateProjectOpen}
                onClose={() => setIsCreateProjectOpen(false)}
            />
        </div>
    );
};
