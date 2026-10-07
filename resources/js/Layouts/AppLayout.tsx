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
    ChevronLeft,
    ChevronRight,
    LogOut,
    CheckCircle2,
    Plus,
    Pin,
    Star,
    Layers,
    ChevronDown,
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
import { ErrorBoundary } from '@/Components/ErrorBoundary';
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

export interface BreadcrumbItem {
    label: string;
    href?: string;
}

export interface AppLayoutProps {
    title?: string;
    subtitle?: string;
    headerAction?: React.ReactNode;
    currentProject?: CurrentProjectInfo | null;
    hidePageHeadingBanner?: boolean;
    breadcrumbs?: BreadcrumbItem[];
    children: React.ReactNode;
}

interface NavItemDef {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    exact?: boolean;
    countKey?: 'projects' | 'tasks' | 'messages' | 'notifications';
}

// ─── Navigation Definitions in Strict Order per Section 4 ───────────────────
// Order: Home, My Tasks with count, Projects, Calendar, Messages with unread count, Favorites, Notifications
const NAV_ITEMS: NavItemDef[] = [
    { name: 'Home', href: '/dashboard', icon: LayoutDashboard, exact: true },
    { name: 'My Tasks', href: '/my-tasks', icon: CheckSquare, countKey: 'tasks' },
    { name: 'Projects', href: '/projects', icon: FolderOpen, countKey: 'projects' },
    { name: 'Calendar', href: '/calendar', icon: CalendarDays },
    { name: 'Timeline', href: '/timeline', icon: GanttChartSquare },
    { name: 'Messages', href: '/messages', icon: MessageSquare, countKey: 'messages' },
    { name: 'Notifications', href: '/notifications', icon: Bell, countKey: 'notifications' },
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
    isUrgent?: boolean;
    onClick?: () => void;
}

function SidebarNavItem({
    item,
    isActive,
    isCollapsed = false,
    badgeCount,
    isUrgent = false,
    onClick,
}: SidebarNavItemProps) {
    const Icon = item.icon;

    // Active item marked by soft background and a primary left marker (Section 4)
    const activeClass =
        'bg-[color:var(--soft-surface)] text-[color:var(--text)] font-semibold border-l-4 border-l-[color:var(--primary)]';
    const inactiveClass =
        'text-[color:var(--muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] font-medium border-l-4 border-l-transparent';

    const baseClass = isCollapsed
        ? 'group relative flex items-center justify-center w-10 h-10 mx-auto rounded-[8px] transition-colors duration-150 cursor-pointer'
        : 'group relative flex items-center gap-3 px-3 py-2 rounded-r-[8px] text-[14px] transition-colors duration-150 w-full cursor-pointer';

    const linkContent = (
        <Link
            href={item.href}
            onClick={onClick}
            className={`${baseClass} ${isActive ? activeClass : inactiveClass} focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2`}
            aria-label={item.name}
            aria-current={isActive ? 'page' : undefined}
        >
            <Icon
                className={`w-[18px] h-[18px] shrink-0 stroke-[2px] transition-colors ${
                    isActive
                        ? 'text-[color:var(--primary)]'
                        : 'text-[color:var(--muted)] group-hover:text-[color:var(--text)]'
                }`}
            />

            {!isCollapsed && <span className="flex-1 truncate">{item.name}</span>}

            {!isCollapsed && badgeCount !== undefined && badgeCount > 0 && (
                <span
                    className={`px-1.5 py-0.5 text-[11px] font-semibold rounded-full tabular-nums ${
                        isUrgent
                            ? 'bg-[color:var(--status-danger-bg)] text-[color:var(--primary)] border border-[color:var(--status-danger-border)]'
                            : 'bg-[color:var(--soft-surface)] text-[color:var(--muted)] border border-[color:var(--border)]'
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
                <TooltipContent side="right" className="text-[12px] font-medium bg-[color:var(--card)] text-[color:var(--text)] border border-[color:var(--border)]">
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
    currentPage: string;
    currentProject?: CurrentProjectInfo | null;
    projectsCount?: number;
    tasksCount?: number;
    tasksNeedingAction?: boolean;
    unreadMessagesCount?: number;
    unreadNotificationsCount?: number;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
    onNavClick?: () => void;
    onOpenCreateProject?: () => void;
}

function SidebarContent({
    currentPage,
    currentProject,
    projectsCount = 0,
    tasksCount = 0,
    tasksNeedingAction = false,
    unreadMessagesCount = 0,
    unreadNotificationsCount = 0,
    isCollapsed = false,
    onToggleCollapse,
    onNavClick,
    onOpenCreateProject,
}: SidebarContentProps) {
    const [pinnedProjects, setPinnedProjects] = useState<Array<{ id: string; title: string }>>(() => {
        if (typeof window === 'undefined') return [];
        try {
            const raw = localStorage.getItem('itask_pinned_projects');
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    });

    const [showFavorites, setShowFavorites] = useState(true);

    return (
        <div className="flex flex-col h-full bg-[color:var(--card)] border-r border-[color:var(--border)] select-none">
            {/* ── Brand Header (Flat, no gradients) ── */}
            <div
                className={`h-16 border-b border-[color:var(--border)] flex items-center shrink-0 ${
                    isCollapsed ? 'px-2 justify-center' : 'px-4 justify-between'
                }`}
            >
                {!isCollapsed ? (
                    <>
                        <Link
                            href="/dashboard"
                            onClick={onNavClick}
                            className="flex items-center gap-2.5 group min-w-0 focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 rounded-[6px]"
                        >
                            <div className="w-8 h-8 rounded-[8px] bg-[color:var(--primary)] flex items-center justify-center shrink-0 text-white">
                                <CheckSquare className="w-4 h-4 stroke-[2px]" />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="font-bold text-[16px] tracking-tight text-[color:var(--text)] block leading-none">
                                    ITASK
                                </span>
                                <span className="text-[11px] text-[color:var(--muted)] font-normal mt-0.5 truncate">
                                    Student Workspace
                                </span>
                            </div>
                        </Link>
                        {onToggleCollapse && (
                            <button
                                type="button"
                                onClick={onToggleCollapse}
                                className="p-1.5 rounded-[6px] text-[color:var(--muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] transition-colors cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                                title="Collapse sidebar"
                                aria-label="Collapse sidebar"
                            >
                                <ChevronLeft className="w-4 h-4 stroke-[2px]" />
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
                                    className="w-9 h-9 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] flex items-center justify-center text-[color:var(--text)] hover:bg-[color:var(--border)] transition-colors cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                                    title="Expand sidebar"
                                    aria-label="Expand sidebar"
                                >
                                    <ChevronRight className="w-4 h-4 stroke-[2px]" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="text-[12px] font-medium bg-[color:var(--card)] text-[color:var(--text)] border border-[color:var(--border)]">
                                Expand sidebar
                            </TooltipContent>
                        </Tooltip>
                    ) : (
                        <div className="w-8 h-8 rounded-[8px] bg-[color:var(--primary)] flex items-center justify-center shrink-0 text-white">
                            <CheckSquare className="w-4 h-4 stroke-[2px]" />
                        </div>
                    )
                )}
            </div>

            {/* ── Navigation List ── */}
            <div className={`flex-1 overflow-y-auto ${isCollapsed ? 'px-2 py-3 space-y-3' : 'px-2 py-3 space-y-4'}`}>
                {/* Main Links */}
                <nav className="space-y-0.5" aria-label="Main Navigation">
                    {NAV_ITEMS.map((item) => {
                        const isMessages = item.name === 'Messages';
                        const isNotifications = item.name === 'Notifications';
                        const isActive =
                            item.exact || item.href === '/dashboard'
                                ? currentPage === item.href
                                : isMessages
                                ? currentPage.startsWith('/messages') || currentPage.startsWith('/chat')
                                : isNotifications
                                ? currentPage.startsWith('/notifications')
                                : currentPage === item.href || currentPage.startsWith(`${item.href}/`);

                        let badgeCount: number | undefined;
                        let isUrgent = false;

                        if (item.countKey === 'projects') {
                            badgeCount = projectsCount > 0 ? projectsCount : undefined;
                        } else if (item.countKey === 'tasks') {
                            badgeCount = tasksCount > 0 ? tasksCount : undefined;
                            isUrgent = tasksNeedingAction;
                        } else if (item.countKey === 'messages') {
                            badgeCount = unreadMessagesCount > 0 ? unreadMessagesCount : undefined;
                            isUrgent = unreadMessagesCount > 0;
                        } else if (item.countKey === 'notifications') {
                            badgeCount = unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined;
                            isUrgent = unreadNotificationsCount > 0;
                        }

                        return (
                            <SidebarNavItem
                                key={item.name}
                                item={item}
                                isActive={isActive}
                                isCollapsed={isCollapsed}
                                badgeCount={badgeCount}
                                isUrgent={isUrgent}
                                onClick={onNavClick}
                            />
                        );
                    })}
                </nav>

                {/* ── Favorites Section (Section 4 requirement) ── */}
                {!isCollapsed && (
                    <div className="pt-2 border-t border-[color:var(--border)]">
                        <div
                            onClick={() => setShowFavorites(!showFavorites)}
                            className="flex items-center justify-between px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--muted)] cursor-pointer hover:text-[color:var(--text)] select-none"
                        >
                            <span className="flex items-center gap-1.5">
                                <Star className="w-3 h-3 stroke-[2px]" />
                                Favorites
                            </span>
                            <ChevronDown className={`w-3 h-3 stroke-[2px] transition-transform ${showFavorites ? '' : '-rotate-90'}`} />
                        </div>

                        {showFavorites && (
                            <div className="mt-1 space-y-0.5">
                                {pinnedProjects.length === 0 ? (
                                    <div className="px-3 py-2 text-[12px] text-[color:var(--muted)] italic bg-[color:var(--soft-surface)] rounded-[6px] border border-[color:var(--border)] text-center">
                                        No favorites yet
                                    </div>
                                ) : (
                                    pinnedProjects.map((p) => (
                                        <Link
                                            key={p.id}
                                            href={`/projects/${p.id}`}
                                            onClick={onNavClick}
                                            className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] text-[13px] text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] transition-colors truncate"
                                        >
                                            <FolderOpen className="w-3.5 h-3.5 text-[color:var(--secondary)] shrink-0 stroke-[2px]" />
                                            <span className="truncate">{p.title}</span>
                                        </Link>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Active Project Indicator (if viewing a project) ── */}
            {currentProject && !isCollapsed && (
                <div className="m-3 p-2.5 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] shrink-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--muted)] mb-1">
                        Active project
                    </p>
                    <div className="flex items-center gap-2 min-w-0">
                        <FolderOpen className="w-4 h-4 text-[color:var(--primary)] shrink-0 stroke-[2px]" />
                        <div className="min-w-0 flex-1">
                            <p className="text-[12px] font-semibold text-[color:var(--text)] truncate">
                                {currentProject.title}
                            </p>
                            {currentProject.role && (
                                <p className="text-[11px] text-[color:var(--muted)] truncate">
                                    {currentProject.role}
                                </p>
                            )}
                        </div>
                    </div>
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
    breadcrumbs,
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

    const { auth, flash, primaryRole, stats, projects, assignedTasks, notifications } = pageProps;

    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [dismissedFlash, setDismissedFlash] = useState<string | null>(null);

    // Modals
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
    const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
    const [createProjectInitialValues, setCreateProjectInitialValues] = useState<{
        title?: string;
        description?: string;
        start_date?: string;
        end_date?: string;
    } | undefined>(undefined);

    // Shortcut detection (Mac vs Win)
    const [shortcutLabel, setShortcutLabel] = useState('Ctrl K');
    useEffect(() => {
        if (typeof window !== 'undefined' && navigator.platform?.toUpperCase().indexOf('MAC') >= 0) {
            setShortcutLabel('⌘K');
        }

        const handleOpenCreateProject = (e: Event) => {
            const customEvent = e as CustomEvent;
            setCreateProjectInitialValues(customEvent.detail || undefined);
            setIsCreateProjectOpen(true);
        };
        window.addEventListener('itask:open-create-project', handleOpenCreateProject);
        return () => window.removeEventListener('itask:open-create-project', handleOpenCreateProject);
    }, []);

    // Collapsed sidebar state (Tablets & manual toggle)
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

    const { url } = usePage();
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : url || '/dashboard';
    const isDashboard = currentPath === '/dashboard' || currentPath === '/' || url === '/dashboard' || url === '/';

    const handleLogout = () => {
        router.post('/logout');
    };

    // Calculate badge counts
    const activeProjectsCount = stats?.activeProjectsCount ?? projects?.length ?? 0;
    const tasksCount = stats?.assignedTasksCount ?? (pageProps as any).my_tasks_count ?? assignedTasks?.length ?? 0;
    const tasksNeedingAction = (stats?.returnedTasksCount ?? 0) > 0 || (stats?.overdueTasksCount ?? 0) > 0;
    const unreadMessagesCount = (pageProps as any).unread_messages_count ?? 0;
    const unreadNotificationsCount = notifications?.unread_count ?? 0;

    return (
        <div className="min-h-screen flex bg-[color:var(--background)] text-[color:var(--text)] antialiased">
            {/* ══ Desktop / Tablet Sidebar (Hidden on mobile < 768px) ════════ */}
            <aside
                className={`hidden md:flex md:flex-col shrink-0 fixed inset-y-0 left-0 z-30 transition-all duration-200 ease-in-out border-r border-[color:var(--border)] ${
                    isCollapsed ? 'w-[64px]' : 'w-60'
                }`}
            >
                <SidebarContent
                    currentPage={currentPath}
                    currentProject={currentProject}
                    projectsCount={activeProjectsCount}
                    tasksCount={tasksCount}
                    tasksNeedingAction={tasksNeedingAction}
                    unreadMessagesCount={unreadMessagesCount}
                    unreadNotificationsCount={unreadNotificationsCount}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={toggleCollapse}
                    onOpenCreateProject={() => setIsCreateProjectOpen(true)}
                />
            </aside>

            {/* ══ Main Shell Area (Offset for sidebar on >= 768px) ═════════ */}
            <div
                className={`flex flex-col min-w-0 w-full transition-all duration-200 ease-in-out ${
                    isCollapsed ? 'md:pl-[64px]' : 'md:pl-60'
                }`}
            >
                {/* ── Sticky Top Bar (Section 4 requirement) ── */}
                <header className="h-14 px-4 sm:px-6 border-b border-[color:var(--border)] flex items-center justify-between bg-[color:var(--card)] shrink-0 sticky top-0 z-20">
                    {/* Left: Mobile Drawer Trigger & Search */}
                    <div className="flex items-center gap-2.5 min-w-0">
                        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
                            <SheetTrigger asChild>
                                <button
                                    type="button"
                                    className="md:hidden p-1.5 rounded-[6px] text-[color:var(--muted)] hover:bg-[color:var(--soft-surface)] transition-colors cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                                    aria-label="Open navigation drawer"
                                >
                                    <Menu className="w-5 h-5 stroke-[2px] text-[color:var(--text)]" />
                                </button>
                            </SheetTrigger>
                            <SheetContent
                                side="left"
                                className="p-0 w-64 border-r border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)]"
                            >
                                <SidebarContent
                                    currentPage={currentPath}
                                    currentProject={currentProject}
                                    projectsCount={activeProjectsCount}
                                    tasksCount={tasksCount}
                                    tasksNeedingAction={tasksNeedingAction}
                                    unreadMessagesCount={unreadMessagesCount}
                                    unreadNotificationsCount={unreadNotificationsCount}
                                    isCollapsed={false}
                                    onNavClick={() => setIsMobileOpen(false)}
                                    onOpenCreateProject={() => {
                                        setIsMobileOpen(false);
                                        setIsCreateProjectOpen(true);
                                    }}
                                />
                            </SheetContent>
                        </Sheet>

                        {/* Search & Command Palette trigger (Ctrl/⌘ K) - only on Home dashboard */}
                        {isDashboard && (
                            <button
                                type="button"
                                onClick={() => setIsCommandPaletteOpen(true)}
                                className="flex items-center justify-between h-9 w-44 sm:w-64 md:w-72 px-3 rounded-[8px] border border-[color:var(--border)] bg-[color:var(--soft-surface)] text-[color:var(--muted)] hover:border-[color:var(--primary)] transition-colors cursor-pointer text-left group focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <Search className="w-4 h-4 text-[color:var(--muted)] group-hover:text-[color:var(--primary)] transition-colors shrink-0 stroke-[2px]" />
                                    <span className="text-[13px] truncate">
                                        Search...
                                    </span>
                                </div>
                                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.2 text-[10px] font-mono text-[color:var(--muted)] bg-[color:var(--card)] border border-[color:var(--border)] rounded-[4px] shrink-0">
                                    {shortcutLabel}
                                </kbd>
                            </button>
                        )}
                    </div>

                    {/* Right: Primary Create Button (only on Home dashboard), Theme Switch, Notifications, Avatar */}
                    <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                        {/* Primary "Create" Button - only on Home dashboard */}
                        {isDashboard && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold cursor-pointer shrink-0 focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                                        title="Create item"
                                    >
                                        <Plus className="w-4 h-4 text-white stroke-[2.5]" />
                                        <span>Create</span>
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="w-44 p-1 bg-[color:var(--card)] border border-[color:var(--border)] rounded-[10px] text-[color:var(--text)]"
                                    style={{ boxShadow: 'none' }}
                                >
                                    <DropdownMenuItem
                                        onClick={() => setIsNewTaskOpen(true)}
                                        className="text-[13px] font-medium text-[color:var(--text)] cursor-pointer hover:bg-[color:var(--soft-surface)] rounded-[6px]"
                                    >
                                        <CheckSquare className="w-4 h-4 mr-2 text-[color:var(--primary)] stroke-[2px]" />
                                        New task
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => setIsCreateProjectOpen(true)}
                                        className="text-[13px] font-medium text-[color:var(--text)] cursor-pointer hover:bg-[color:var(--soft-surface)] rounded-[6px]"
                                    >
                                        <FolderOpen className="w-4 h-4 mr-2 text-[color:var(--secondary)] stroke-[2px]" />
                                        New project
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        {/* Theme Switch */}
                        <ThemeToggle />

                        {/* Notifications */}
                        <NotificationDropdown />

                        <Separator orientation="vertical" className="h-5 mx-0.5 bg-[color:var(--border)]" />

                        {/* Avatar & User Menu: User's name shown ONLY ONCE here per Section 4 */}
                        {user ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        className="rounded-full p-0.5 hover:ring-2 hover:ring-[color:var(--primary)] transition-all cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                                        aria-label="User account menu"
                                    >
                                        <Avatar size="sm" className="shrink-0">
                                            <AvatarImage src={undefined} />
                                            <AvatarFallback className="text-[11px] font-bold">
                                                {getInitials(user.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="w-56 mt-1 p-1 bg-[color:var(--card)] border border-[color:var(--border)] rounded-[10px] text-[color:var(--text)]"
                                    style={{ boxShadow: 'none' }}
                                >
                                    {/* The ONLY location displaying the user's name */}
                                    <DropdownMenuLabel className="font-normal px-3 py-2">
                                        <p className="text-[13px] font-semibold text-[color:var(--text)] truncate">
                                            {user.name}
                                        </p>
                                        <p className="text-[11px] text-[color:var(--muted)] truncate">
                                            {user.email}
                                        </p>
                                        <span className="inline-block mt-1 text-[10px] font-medium text-[color:var(--status-neutral-text)] bg-[color:var(--status-neutral-bg)] px-2 py-0.5 rounded-full border border-[color:var(--status-neutral-border)]">
                                            {userRole}
                                        </span>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator className="bg-[color:var(--border)]" />
                                    <DropdownMenuItem
                                        onClick={() => router.visit('/my-tasks')}
                                        className="text-[13px] font-medium text-[color:var(--text)] cursor-pointer hover:bg-[color:var(--soft-surface)] rounded-[6px]"
                                    >
                                        <CheckSquare className="w-3.5 h-3.5 mr-2 stroke-[2px]" />
                                        My Tasks
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => router.visit('/projects')}
                                        className="text-[13px] font-medium text-[color:var(--text)] cursor-pointer hover:bg-[color:var(--soft-surface)] rounded-[6px]"
                                    >
                                        <FolderOpen className="w-3.5 h-3.5 mr-2 stroke-[2px]" />
                                        Projects
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="bg-[color:var(--border)]" />
                                    <DropdownMenuItem
                                        onClick={handleLogout}
                                        className="text-[13px] font-medium text-[color:var(--primary)] hover:bg-[color:var(--status-danger-bg)] cursor-pointer rounded-[6px]"
                                    >
                                        <LogOut className="w-3.5 h-3.5 mr-2 stroke-[2px]" />
                                        Sign out
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <Link
                                href="/login"
                                className="text-[13px] font-semibold text-[color:var(--primary)] hover:underline"
                            >
                                Sign in
                            </Link>
                        )}
                    </div>
                </header>

                {/* ── Optional Breadcrumbs Bar on Deep Pages (Section 4 requirement) ── */}
                {breadcrumbs && breadcrumbs.length > 0 && (
                    <div className="px-4 sm:px-6 py-2 bg-[color:var(--soft-surface)] border-b border-[color:var(--border)] flex items-center gap-1.5 text-[12px] text-[color:var(--muted)]">
                        <Link href="/dashboard" className="hover:text-[color:var(--text)]">Home</Link>
                        {breadcrumbs.map((crumb, idx) => (
                            <React.Fragment key={idx}>
                                <span className="text-[color:var(--muted)]">/</span>
                                {crumb.href ? (
                                    <Link href={crumb.href} className="hover:text-[color:var(--text)]">
                                        {crumb.label}
                                    </Link>
                                ) : (
                                    <span className="text-[color:var(--text)] font-medium truncate">{crumb.label}</span>
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                )}

                {/* ── Optional Page Heading Banner ── */}
                {!hidePageHeadingBanner && (title || headerAction) && (
                    <div className="px-4 sm:px-6 pt-5 pb-4 bg-[color:var(--card)] border-b border-[color:var(--border)] flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="min-w-0">
                            {title && (
                                <h1 className="text-[26px] font-bold tracking-tight text-[color:var(--text)] leading-snug">
                                    {title}
                                </h1>
                            )}
                            {subtitle && (
                                <p className="text-[14px] text-[color:var(--muted)] mt-1 leading-relaxed">
                                    {subtitle}
                                </p>
                            )}
                        </div>
                        {headerAction && <div className="shrink-0">{headerAction}</div>}
                    </div>
                )}

                {/* ── Main Content Container Wrapped in ErrorBoundary ── */}
                <main className="flex-1 p-4 sm:p-6 w-full max-w-7xl mx-auto">
                    {/* Global Flash Alerts */}
                    {(flash?.success || flash?.status) && dismissedFlash !== (flash.success || flash.status) && (
                        <div className="mb-4">
                            <Alert
                                variant="success"
                                onClose={() => setDismissedFlash(flash.success || flash.status || null)}
                            >
                                {flash.success || flash.status}
                            </Alert>
                        </div>
                    )}
                    {flash?.error && dismissedFlash !== flash.error && (
                        <div className="mb-4">
                            <Alert
                                variant="danger"
                                onClose={() => setDismissedFlash(flash.error || null)}
                            >
                                {flash.error}
                            </Alert>
                        </div>
                    )}

                    <ErrorBoundary>
                        {children}
                    </ErrorBoundary>
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
                onClose={() => {
                    setIsCreateProjectOpen(false);
                    setCreateProjectInitialValues(undefined);
                }}
                availableUsers={(pageProps as any).available_users}
                initialValues={createProjectInitialValues}
            />
        </div>
    );
};

export function openCreateProjectModal(initialValues?: {
    title?: string;
    description?: string;
    start_date?: string;
    end_date?: string;
}) {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('itask:open-create-project', { detail: initialValues }));
    }
}
