import React, { useState, useEffect } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import { motion, AnimatePresence } from 'motion/react';
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
    Users,
    Shield,
    Crown,
    Zap,
    FileCheck,
    ListTodo,
    ArrowUpDown,
    Check,
    ShieldCheck,
    Settings,
    UserCheck,
    Sparkles,
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
import { CreateCommitteeModal } from '@/Components/CreateCommitteeModal';
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
import {
    getNavigationForRole,
    ROLE_CONFIGS,
    ProjectRole,
    NavItem,
    formatRole,
} from '@/Config/navigation';

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
    pageKey?: string;
    children: React.ReactNode;
}

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
    item: NavItem;
    isActive: boolean;
    isCollapsed?: boolean;
    badgeCount?: number;
    isUrgent?: boolean;
    isHighlighted?: boolean;
    onClick?: () => void;
}

function SidebarNavItem({
    item,
    isActive,
    isCollapsed = false,
    badgeCount,
    isUrgent = false,
    isHighlighted = false,
    onClick,
}: SidebarNavItemProps) {
    const Icon = item.icon;

    // Active item marked by soft surface tint, 1px hairline, and Warm Ember icon
    const activeClass =
        'bg-[color:var(--status-primary-bg)] text-[color:var(--text)] font-semibold border border-[color:var(--status-primary-border)]';
    const inactiveClass =
        'text-[color:var(--muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] font-medium border border-transparent';

    const baseClass = isCollapsed
        ? 'group relative flex items-center justify-center w-10 h-10 mx-auto rounded-[8px] transition-colors duration-150 cursor-pointer'
        : 'group relative flex items-center gap-3 px-3 py-2 min-h-[44px] md:min-h-[38px] rounded-[8px] text-[14px] transition-colors duration-150 w-full cursor-pointer';

    const linkContent = (
        <Link
            href={item.href}
            onClick={onClick}
            className={`${baseClass} ${isActive ? activeClass : inactiveClass} focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2`}
            aria-label={item.name}
            aria-current={isActive ? 'page' : undefined}
        >
            <div className="relative shrink-0 flex items-center justify-center">
                <Icon
                    className={`w-[18px] h-[18px] shrink-0 stroke-[2px] transition-colors ${
                        isActive
                            ? 'text-[color:var(--primary)]'
                            : 'text-[color:var(--muted)] group-hover:text-[color:var(--text)]'
                    }`}
                />
                {isHighlighted && !isActive && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[color:var(--primary)] ring-2 ring-[color:var(--card)]" />
                )}
            </div>

            {!isCollapsed && (
                <div className="flex-1 min-w-0 flex items-center justify-between gap-1.5">
                    <span className="truncate">{item.name}</span>
                    {isHighlighted && !badgeCount && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-[color:var(--primary)]/10 text-[color:var(--primary)] border border-[color:var(--primary)]/20 shrink-0">
                            Key
                        </span>
                    )}
                </div>
            )}

            {!isCollapsed && badgeCount !== undefined && badgeCount > 0 && (
                <span
                    className={`px-1.5 py-0.5 text-[11px] font-semibold rounded-full tabular-nums shrink-0 ${
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
                    <p className="font-semibold">{item.name}</p>
                    {item.description && (
                        <p className="text-[11px] text-[color:var(--muted)] font-normal">{item.description}</p>
                    )}
                    {badgeCount !== undefined && badgeCount > 0 && (
                        <p className="text-[10px] text-[color:var(--primary)] font-semibold mt-0.5">{badgeCount} pending</p>
                    )}
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
    pendingReviewsCount?: number;
    userRole: ProjectRole;
    isAdmin?: boolean;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
    onNavClick?: () => void;
}

function SidebarContent({
    currentPage,
    currentProject,
    projectsCount = 0,
    tasksCount = 0,
    tasksNeedingAction = false,
    unreadMessagesCount = 0,
    unreadNotificationsCount = 0,
    pendingReviewsCount = 0,
    userRole,
    isAdmin = false,
    isCollapsed = false,
    onToggleCollapse,
    onNavClick,
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

    const navItems = getNavigationForRole(userRole, isAdmin);

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
                            href={isAdmin ? '/admin/dashboard' : '/dashboard'}
                            onClick={onNavClick}
                            className="flex items-center gap-2.5 group min-w-0 focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 rounded-[6px]"
                        >
                            <div className="w-8 h-8 rounded-[8px] bg-[color:var(--primary)] flex items-center justify-center shrink-0 text-white shadow-2xs">
                                <CheckSquare className="w-4 h-4 stroke-[2px]" />
                            </div>
                            <span className="font-bold text-[16px] tracking-tight text-[color:var(--text)] block leading-none">
                                ITASK
                            </span>
                        </Link>
                        {onToggleCollapse && (
                            <motion.button
                                type="button"
                                onClick={onToggleCollapse}
                                whileHover={{ scale: 1.12 }}
                                whileTap={{ scale: 0.95 }}
                                className="p-1.5 rounded-[6px] text-[color:var(--muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] transition-colors cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                                title="Collapse sidebar"
                                aria-label="Collapse sidebar"
                            >
                                <ChevronLeft className="w-4 h-4 stroke-[2px]" />
                            </motion.button>
                        )}
                    </>
                ) : (
                    onToggleCollapse ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <motion.button
                                    type="button"
                                    onClick={onToggleCollapse}
                                    whileHover={{ scale: 1.12 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="w-9 h-9 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] flex items-center justify-center text-[color:var(--text)] hover:bg-[color:var(--border)] transition-colors cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                                    title="Expand sidebar"
                                    aria-label="Expand sidebar"
                                >
                                    <ChevronRight className="w-4 h-4 stroke-[2px]" />
                                </motion.button>
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
                    {navItems.map((item) => {
                        const currentPathname = currentPage.split('?')[0];
                        const isMessages = item.name === 'Messages' || item.name.includes('Messages');
                        const isNotifications = item.name === 'Notifications';
                        const isDashboard = item.name === 'Home' || item.name === 'Dashboard' || item.href === '/dashboard' || item.name === 'Dashboard Overview';
                        const isEligibility = item.href === '/eligibility-profile';
                        const isEvents = item.href === '/projects';
                        const isActive =
                            item.href.includes('?')
                                ? currentPage === item.href || currentPage.startsWith(`${item.href}&`)
                                : item.exact || isDashboard
                                ? currentPathname === item.href ||
                                  (isDashboard && (currentPathname === '/' || currentPathname === '/dashboard')) ||
                                  (item.href === '/admin/dashboard' && currentPathname.startsWith('/admin/dashboard') && !currentPage.includes('tab='))
                                : isMessages
                                ? currentPathname.startsWith('/messages') || currentPathname.startsWith('/chat')
                                : isNotifications
                                ? currentPathname.startsWith('/notifications')
                                : isEligibility
                                ? currentPathname === '/eligibility-profile' || currentPathname.startsWith('/eligibility-profile/')
                                : isEvents
                                ? currentPathname === '/projects' || currentPathname === '/projects/smart-import' || currentPathname.startsWith('/projects/')
                                : currentPathname === item.href || currentPathname.startsWith(`${item.href}/`);

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
                        } else if (item.countKey === 'reviews') {
                            badgeCount = pendingReviewsCount > 0 ? pendingReviewsCount : undefined;
                            isUrgent = pendingReviewsCount > 0;
                        }

                        const isHighlighted = item.highlightForRole === userRole;

                        return (
                            <SidebarNavItem
                                key={item.name}
                                item={item}
                                isActive={isActive}
                                isCollapsed={isCollapsed}
                                badgeCount={badgeCount}
                                isUrgent={isUrgent}
                                isHighlighted={isHighlighted}
                                onClick={onNavClick}
                            />
                        );
                    })}
                </nav>

                {/* ── Favorites Section (Section 4 requirement) ── */}
                {!isCollapsed && !isAdmin && (
                    <div className="pt-2 border-t border-[color:var(--border)]">
                        <button
                            type="button"
                            onClick={() => setShowFavorites(!showFavorites)}
                            aria-expanded={showFavorites}
                            aria-controls="sidebar-favorites-list"
                            className="w-full flex items-center justify-between px-3 py-1.5 min-h-[44px] md:min-h-[32px] rounded-[6px] text-[11px] font-semibold uppercase tracking-wider text-[color:var(--muted)] cursor-pointer hover:text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] transition-colors select-none focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                        >
                            <span className="flex items-center gap-1.5">
                                <Star className="w-3 h-3 stroke-[2px]" />
                                Favorites
                            </span>
                            <ChevronDown className={`w-3 h-3 stroke-[2px] transition-transform ${showFavorites ? '' : '-rotate-90'}`} />
                        </button>

                        {showFavorites && (
                            <div id="sidebar-favorites-list" className="mt-1 space-y-0.5">
                                {pinnedProjects.length === 0 ? (
                                    <div className="px-3 py-2 text-[12px] text-[color:var(--text)]/70 italic bg-[color:var(--soft-surface)] rounded-[6px] border border-[color:var(--border)] text-center">
                                        No favorites yet
                                    </div>
                                ) : (
                                    pinnedProjects.map((p) => (
                                        <Link
                                            key={p.id}
                                            href={`/projects/${p.id}`}
                                            onClick={onNavClick}
                                            className="flex items-center gap-2 px-3 py-1.5 min-h-[44px] md:min-h-[32px] rounded-[6px] text-[13px] text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] transition-colors truncate"
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
            {currentProject && !isCollapsed && !isAdmin && (
                <div className="m-3 p-2.5 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] shrink-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--muted)] mb-1">
                        Active event
                    </p>
                    <div className="flex items-center gap-2 min-w-0">
                        <FolderOpen className="w-4 h-4 text-[color:var(--primary)] shrink-0 stroke-[2px]" />
                        <div className="min-w-0 flex-1">
                            <p className="text-[12px] font-semibold text-[color:var(--text)] truncate">
                                {currentProject.title}
                            </p>
                            {currentProject.role && (
                                <p className="text-[11px] text-[color:var(--muted)] truncate">
                                    {formatRole(currentProject.role)}
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
    pageKey,
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

    // Role & identity
    const userRole: ProjectRole = (primaryRole as ProjectRole) || 'Project Member';
    const isAdmin = Boolean(auth?.user?.is_admin);
    const user = auth?.user ? { name: auth.user.name, email: auth.user.email } : null;

    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [dismissedFlash, setDismissedFlash] = useState<string | null>(null);

    // Modals
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
    const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
    const [isCreateCommitteeOpen, setIsCreateCommitteeOpen] = useState(false);
    const [createProjectInitialValues, setCreateProjectInitialValues] = useState<{
        title?: string;
        description?: string;
        start_date?: string;
        end_date?: string;
    } | undefined>(undefined);

    useEffect(() => {
        const handleOpenCreateProject = (e: Event) => {
            if (isAdmin) return; // Admins cannot create projects
            const customEvent = e as CustomEvent;
            setCreateProjectInitialValues(customEvent.detail || undefined);
            setIsCreateProjectOpen(true);
        };
        const handleOpenCreateCommittee = () => {
            setIsCreateCommitteeOpen(true);
        };
        const handleOpenCreateTask = () => {
            setIsNewTaskOpen(true);
        };
        const handleOpenCommandPalette = () => {
            setIsCommandPaletteOpen(true);
        };
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setIsCommandPaletteOpen((prev) => !prev);
            }
        };

        window.addEventListener('itask:open-create-project', handleOpenCreateProject);
        window.addEventListener('itask:open-create-committee', handleOpenCreateCommittee);
        window.addEventListener('itask:open-create-task', handleOpenCreateTask);
        window.addEventListener('itask:open-command-palette', handleOpenCommandPalette);
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => {
            window.removeEventListener('itask:open-create-project', handleOpenCreateProject);
            window.removeEventListener('itask:open-create-committee', handleOpenCreateCommittee);
            window.removeEventListener('itask:open-create-task', handleOpenCreateTask);
            window.removeEventListener('itask:open-command-palette', handleOpenCommandPalette);
            window.removeEventListener('keydown', handleGlobalKeyDown);
        };
    }, [isAdmin]);

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

    const { url } = usePage();
    const currentPath = typeof window !== 'undefined'
        ? window.location.pathname + window.location.search
        : url || '/dashboard';
    const currentPathname = currentPath.split('?')[0];
    const transitionKey = pageKey ?? currentPath;

    const handleLogout = () => {
        router.post('/logout');
    };

    // Calculate badge counts
    const activeProjectsCount = stats?.activeProjectsCount ?? projects?.length ?? 0;
    const tasksCount = stats?.assignedTasksCount ?? (pageProps as any).my_tasks_count ?? assignedTasks?.length ?? 0;
    const tasksNeedingAction = (stats?.returnedTasksCount ?? 0) > 0 || (stats?.overdueTasksCount ?? 0) > 0;
    const unreadMessagesCount = (pageProps as any).unread_messages_count ?? 0;
    const unreadNotificationsCount = notifications?.unread_count ?? 0;
    const pendingReviewsCount = (pageProps as any).pending_reviews_count ?? 0;

    return (
        <div className="min-h-screen flex bg-[color:var(--background)] text-[color:var(--text)] antialiased">
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:min-h-[44px] focus:inline-flex focus:items-center focus:rounded-[8px] focus:bg-[color:var(--primary-btn-active)] focus:text-white focus:font-semibold focus:text-sm"
            >
                Skip to main content
            </a>

            {/* ══ Desktop / Tablet Sidebar (Hidden on mobile < 768px) ════════ */}
            <aside
                aria-label="Primary sidebar"
                className={`hidden md:flex md:flex-col shrink-0 fixed inset-y-0 left-0 z-30 transition-all duration-200 ease-in-out border-r border-[color:var(--border)] ${
                    isCollapsed ? 'w-[72px]' : 'w-64'
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
                    pendingReviewsCount={pendingReviewsCount}
                    userRole={userRole}
                    isAdmin={isAdmin}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={toggleCollapse}
                />
            </aside>

            {/* ══ Main Shell Area (Offset for sidebar on >= 768px) ═════════ */}
            <div
                className={`flex flex-col min-w-0 w-full transition-all duration-200 ease-in-out ${
                    isCollapsed ? 'md:pl-[72px]' : 'md:pl-64'
                }`}
            >
                {/* ── Sticky Top Bar (Section 2 & Section 4 requirement) ── */}
                <header className="h-14 px-4 sm:px-6 border-b border-[color:var(--border)] flex items-center justify-between gap-2 bg-[color:var(--card)] shrink-0 sticky top-0 z-20">
                    {/* Left: Mobile Drawer Trigger & Global Quick Search */}
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
                            <SheetTrigger asChild>
                                <motion.button
                                    type="button"
                                    whileHover={{ scale: 1.12 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="md:hidden p-2 rounded-[6px] text-[color:var(--muted)] hover:bg-[color:var(--soft-surface)] transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                                    aria-label="Open navigation drawer"
                                >
                                    <Menu className="w-5 h-5 stroke-[2px] text-[color:var(--text)]" />
                                </motion.button>
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
                                    pendingReviewsCount={pendingReviewsCount}
                                    userRole={userRole}
                                    isAdmin={isAdmin}
                                    isCollapsed={false}
                                    onNavClick={() => setIsMobileOpen(false)}
                                />
                            </SheetContent>
                        </Sheet>

                        <button
                            type="button"
                            onClick={() => setIsCommandPaletteOpen(true)}
                            className="inline-flex items-center gap-2 px-2.5 sm:px-3 py-1.5 min-h-[44px] md:min-h-[38px] sm:min-w-[220px] rounded-[8px] border border-[color:var(--border)] bg-[color:var(--soft-surface)] hover:border-[color:var(--primary)] text-[13px] text-[color:var(--text)]/80 hover:text-[color:var(--text)] transition-colors cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                            aria-label="Search or jump to page or action (Ctrl+K)"
                        >
                            <Search className="w-4 h-4 shrink-0 text-[color:var(--muted)]" />
                            <span className="hidden sm:inline flex-1 text-left">Jump to page or action...</span>
                            <span className="sm:hidden">Search</span>
                            <kbd
                                aria-hidden="true"
                                className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-[color:var(--card)] border border-[color:var(--border)] rounded text-[color:var(--muted)]"
                            >
                                Ctrl+K
                            </kbd>
                        </button>
                    </div>

                    {/* Right: Current Role Label, Theme Toggle, Notifications, User Identity Badge */}
                    <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">

                        {/* Current Role Label (Visible on all pages for all 3 roles) */}
                        <span
                            data-testid="topbar-role-label"
                            className="inline-flex items-center px-2.5 py-1 rounded-[6px] text-[12px] font-semibold bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)] select-none shrink-0"
                        >
                            {isAdmin ? 'System Admin' : formatRole(userRole)}
                        </span>

                        {/* Theme Switch */}
                        <ThemeToggle />

                        {/* Notifications (synced with unread count) */}
                        <NotificationDropdown />

                        <Separator orientation="vertical" className="h-5 mx-0.5 bg-[color:var(--border)]" />

                        {/* User Identity Badge */}
                        {user ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <motion.button
                                        type="button"
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full border border-[color:var(--border)] bg-[color:var(--soft-surface)] hover:border-[color:var(--primary)] transition-colors cursor-pointer select-none focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 shrink-0 min-h-[36px]"
                                        aria-label="User account menu"
                                    >
                                        <Avatar size="sm" className="shrink-0 w-7 h-7">
                                            <AvatarImage src={undefined} />
                                            <AvatarFallback className="text-[11px] font-bold bg-[color:var(--primary)] text-white">
                                                {getInitials(user.name) || 'BJ'}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="hidden sm:flex items-center gap-1.5 text-left text-[12px] leading-tight">
                                            <span className="font-semibold text-[color:var(--text)] truncate max-w-[130px]">
                                                {user.name}
                                            </span>
                                            <span className="text-[color:var(--muted)]">·</span>
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[color:var(--card)] text-[color:var(--primary)] border border-[color:var(--border)]">
                                                CCIS
                                            </span>
                                        </div>
                                    </motion.button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="w-56 mt-1 p-1 bg-[color:var(--card)] border border-[color:var(--border)] rounded-[10px] text-[color:var(--text)] shadow-xs"
                                    style={{ boxShadow: 'var(--shadow-xs)' }}
                                >
                                    <DropdownMenuLabel className="font-normal px-3 py-2">
                                        <p className="text-[13px] font-semibold text-[color:var(--text)] truncate">
                                            {user.name}
                                        </p>
                                        <p className="text-[11px] text-[color:var(--muted)] truncate">
                                            {user.email}
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                            {isAdmin && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400">
                                                    <ShieldCheck className="w-3 h-3 stroke-[2.5]" />
                                                    <span>Admin</span>
                                                </span>
                                            )}
                                            <span
                                                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                                                style={{
                                                    backgroundColor: ROLE_CONFIGS[userRole]?.badgeBg || 'rgba(79, 70, 229, 0.12)',
                                                    borderColor: ROLE_CONFIGS[userRole]?.badgeBorder || 'rgba(79, 70, 229, 0.35)',
                                                    color: ROLE_CONFIGS[userRole]?.accentColor || '#4F46E5',
                                                }}
                                            >
                                                <span>{formatRole(userRole)}</span>
                                            </span>
                                            <span className="text-[10px] font-bold text-[color:var(--primary)] bg-[color:var(--soft-surface)] px-1.5 py-0.5 rounded border border-[color:var(--border)]">
                                                CCIS
                                            </span>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator className="bg-[color:var(--border)]" />
                                    {isAdmin ? (
                                        <>
                                            <DropdownMenuItem
                                                onClick={() => router.visit('/admin/dashboard')}
                                                className="text-[13px] font-medium text-[color:var(--text)] cursor-pointer hover:bg-[color:var(--soft-surface)] rounded-[6px]"
                                            >
                                                <Users className="w-3.5 h-3.5 mr-2 stroke-[2px] text-purple-500" />
                                                User Management Directory
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => router.visit('/admin/dashboard?tab=pending')}
                                                className="text-[13px] font-medium text-[color:var(--text)] cursor-pointer hover:bg-[color:var(--soft-surface)] rounded-[6px]"
                                            >
                                                <ShieldCheck className="w-3.5 h-3.5 mr-2 stroke-[2px] text-amber-500" />
                                                Pending Registrations
                                            </DropdownMenuItem>
                                        </>
                                    ) : (
                                        <>
                                            <DropdownMenuItem
                                                onClick={() => router.visit('/my-tasks')}
                                                className={`text-[13px] text-[color:var(--text)] cursor-pointer hover:bg-[color:var(--soft-surface)] rounded-[6px] ${
                                                    currentPathname === '/my-tasks' || currentPathname.startsWith('/my-tasks/')
                                                        ? 'bg-[color:var(--soft-surface)] font-semibold'
                                                        : 'font-medium'
                                                }`}
                                            >
                                                <CheckSquare className={`w-3.5 h-3.5 mr-2 stroke-[2px] ${currentPathname === '/my-tasks' ? 'text-[color:var(--primary)]' : ''}`} />
                                                My Tasks
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => router.visit('/projects')}
                                                className={`text-[13px] text-[color:var(--text)] cursor-pointer hover:bg-[color:var(--soft-surface)] rounded-[6px] ${
                                                    currentPathname === '/projects'
                                                        ? 'bg-[color:var(--soft-surface)] font-semibold'
                                                        : 'font-medium'
                                                }`}
                                            >
                                                <FolderOpen className={`w-3.5 h-3.5 mr-2 stroke-[2px] ${currentPathname === '/projects' ? 'text-[color:var(--primary)]' : ''}`} />
                                                Events
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => router.visit('/eligibility-profile')}
                                                className={`text-[13px] text-[color:var(--text)] cursor-pointer hover:bg-[color:var(--soft-surface)] rounded-[6px] ${
                                                    currentPathname === '/eligibility-profile' || currentPathname.startsWith('/eligibility-profile/')
                                                        ? 'bg-[color:var(--soft-surface)] font-semibold'
                                                        : 'font-medium'
                                                }`}
                                            >
                                                <UserCheck className={`w-3.5 h-3.5 mr-2 stroke-[2px] ${currentPathname === '/eligibility-profile' || currentPathname.startsWith('/eligibility-profile/') ? 'text-[color:var(--primary)]' : ''}`} />
                                                Eligibility & Strengths
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => router.visit('/projects/smart-import')}
                                                className={`text-[13px] text-[color:var(--text)] cursor-pointer hover:bg-[color:var(--soft-surface)] rounded-[6px] ${
                                                    currentPathname === '/projects/smart-import'
                                                        ? 'bg-[color:var(--soft-surface)] font-semibold'
                                                        : 'font-medium'
                                                }`}
                                            >
                                                <Sparkles className={`w-3.5 h-3.5 mr-2 stroke-[2px] ${currentPathname === '/projects/smart-import' ? 'text-[color:var(--primary)]' : ''}`} />
                                                Smart S.O. Import
                                            </DropdownMenuItem>
                                        </>
                                    )}
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
                    <nav
                        aria-label="Breadcrumb"
                        className="px-4 sm:px-6 py-2 bg-[color:var(--soft-surface)] border-b border-[color:var(--border)]"
                    >
                        <ol className="flex items-center gap-1.5 flex-wrap text-[12px] text-[color:var(--text)]/75">
                            <li>
                                <Link
                                    href={isAdmin ? '/admin/dashboard' : '/dashboard'}
                                    className="hover:text-[color:var(--text)] rounded-[4px] transition-colors"
                                >
                                    Home
                                </Link>
                            </li>
                            {breadcrumbs.map((crumb, idx) => {
                                const isLast = idx === breadcrumbs.length - 1;
                                return (
                                    <li key={`${crumb.label}-${idx}`} className="flex items-center gap-1.5 min-w-0">
                                        <span aria-hidden="true" className="text-[color:var(--text)]/55">/</span>
                                        {crumb.href ? (
                                            <Link
                                                href={crumb.href}
                                                aria-current={isLast ? 'page' : undefined}
                                                className="hover:text-[color:var(--text)] rounded-[4px] transition-colors"
                                            >
                                                {crumb.label}
                                            </Link>
                                        ) : (
                                            <span
                                                aria-current={isLast ? 'page' : undefined}
                                                className="text-[color:var(--text)] font-medium truncate"
                                            >
                                                {crumb.label}
                                            </span>
                                        )}
                                    </li>
                                );
                            })}
                        </ol>
                    </nav>
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
                <main id="main-content" tabIndex={-1} className="flex-1 p-4 sm:p-6 w-full max-w-7xl mx-auto">
                    {/* Global Flash Alerts with Spring Motion */}
                    <AnimatePresence>
                        {(flash?.success || flash?.status) && dismissedFlash !== (flash.success || flash.status) && (
                            <motion.div
                                key="flash-success"
                                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                                className="mb-4"
                            >
                                <Alert
                                    variant="success"
                                    onClose={() => setDismissedFlash(flash.success || flash.status || null)}
                                >
                                    {flash.success || flash.status}
                                </Alert>
                            </motion.div>
                        )}
                        {flash?.error && dismissedFlash !== flash.error && (
                            <motion.div
                                key="flash-error"
                                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                                className="mb-4"
                            >
                                <Alert
                                    variant="danger"
                                    onClose={() => setDismissedFlash(flash.error || null)}
                                >
                                    {flash.error}
                                </Alert>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Top-Level Page Transition */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={transitionKey}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ type: 'spring', damping: 24, stiffness: 360 }}
                        >
                            <ErrorBoundary>
                                {children}
                            </ErrorBoundary>
                        </motion.div>
                    </AnimatePresence>
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

            <CreateCommitteeModal
                isOpen={isCreateCommitteeOpen}
                onClose={() => setIsCreateCommitteeOpen(false)}
                projectId={currentProject?.id}
                projects={projects?.map((p: any) => ({ id: String(p.id), title: p.title || p.name }))}
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

export function openCreateCommitteeModal() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('itask:open-create-committee'));
    }
}

export function openCreateTaskModal() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('itask:open-create-task'));
    }
}

export function openCommandPalette() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('itask:open-command-palette'));
    }
}
