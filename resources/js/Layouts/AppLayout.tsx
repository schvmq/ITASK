import React, { useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import { PageProps } from '@/types';
import {
    LayoutDashboard,
    FolderOpen,
    CheckSquare,
    CalendarDays,
    GanttChartSquare,
    Bell,
    Search,
    Menu,
    ChevronDown,
    LogOut,
    User,
    Settings,
    CheckCircle2,
} from 'lucide-react';

import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from '@/Components/ui/avatar';
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
    title: string;
    role?: string;
    status?: string;
}

export interface AppLayoutProps {
    /** Page heading shown in the topbar */
    title?: string;
    /** Optional subtitle below the heading */
    subtitle?: string;
    /** Optional action slot rendered next to the title */
    headerAction?: React.ReactNode;
    /** Optional active project context for sidebar display */
    currentProject?: CurrentProjectInfo | null;
    children: React.ReactNode;
}

import {
    MAIN_NAV_ITEMS,
    UTILITY_NAV_ITEMS,
    type NavItem,
} from '@/Config/navigation';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns the user's display initials (up to 2 chars) */
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
    onClick?: () => void;
}

function SidebarNavItem({ item, isActive, onClick }: SidebarNavItemProps) {
    const Icon = item.icon;

    const baseClass =
        'group flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-150 w-full';

    const activeClass =
        'bg-[color:var(--color-brand-active-warm-orange)] text-[color:var(--color-brand-dark-green)] font-semibold';

    const inactiveClass =
        'text-orange-100 hover:bg-white/10 hover:text-white';

    const comingSoonClass =
        'text-orange-200/50 cursor-not-allowed';

    if (item.comingSoon) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className={`${baseClass} ${comingSoonClass}`}>
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="flex-1">{item.name}</span>
                        <span className="text-[9px] font-semibold bg-orange-900/40 text-orange-200/60 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                            Soon
                        </span>
                    </span>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                    Coming in a future release
                </TooltipContent>
            </Tooltip>
        );
    }

    return (
        <Link
            href={item.href}
            onClick={onClick}
            className={`${baseClass} ${isActive ? activeClass : inactiveClass}`}
        >
            <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive
                        ? 'text-[color:var(--color-brand-dark-green)]'
                        : 'text-orange-200/70 group-hover:text-orange-50'
                }`}
            />
            <span className="flex-1">{item.name}</span>
            {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-brand-dark-green)] shrink-0" />
            )}
        </Link>
    );
}

// ─── Sidebar Content (shared between desktop & mobile sheet) ─────────────────

interface SidebarContentProps {
    user: { name: string; email: string } | null;
    currentPage: string;
    currentProject?: CurrentProjectInfo | null;
    onNavClick?: () => void;
    onLogout: () => void;
}

function SidebarContent({ user, currentPage, currentProject, onNavClick, onLogout }: SidebarContentProps) {
    // Determine active project display:
    // 1. Explicit currentProject passed in props
    // 2. Or fallback when inside /projects/{project} route
    // 3. Otherwise (/dashboard, /projects, etc.) remains null (No project selected)
    const isInsideProjectRoute =
        currentPage.startsWith('/projects/') && currentPage.replace(/\/+$/, '') !== '/projects';

    const activeProject =
        currentProject !== undefined
            ? currentProject
            : isInsideProjectRoute
            ? { title: 'CCIS General Assembly 2026', role: 'Project Leader', status: 'In Progress' }
            : null;

    return (
        <div className="flex flex-col h-full">
            {/* ── Brand ── */}
            <div className="h-16 px-5 border-b border-white/10 flex items-center shrink-0">
                <Link
                    href="/dashboard"
                    onClick={onNavClick}
                    className="flex items-center gap-3 group"
                >
                    <div className="w-8 h-8 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center shrink-0 shadow-sm group-hover:bg-white/20 transition-colors">
                        <CheckCircle2 className="w-4.5 h-4.5 text-white" strokeWidth={2.2} />
                    </div>
                    <div>
                        <span className="font-extrabold text-base tracking-tight text-white block leading-none">
                            ITASK
                        </span>
                        <span
                            className="text-[9px] font-bold tracking-widest uppercase block mt-0.5 leading-none"
                            style={{ color: 'var(--color-brand-active-warm-orange)' }}
                        >
                            CCIS · CarSU
                        </span>
                    </div>
                </Link>
            </div>

            {/* ── Navigation ── */}
            <div className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
                <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-orange-200/40 select-none">
                    Navigation
                </p>

                {MAIN_NAV_ITEMS.map((item) => {
                    const isActive = item.exact || item.href === '/dashboard'
                        ? currentPage === item.href
                        : currentPage === item.href || currentPage.startsWith(`${item.href}/`);

                    return (
                        <SidebarNavItem
                            key={item.name}
                            item={item}
                            isActive={isActive}
                            onClick={onNavClick}
                        />
                    );
                })}

                <div className="pt-3 mt-3 border-t border-white/10 space-y-0.5">
                    {UTILITY_NAV_ITEMS.map((item) => (
                        <SidebarNavItem
                            key={item.name}
                            item={item}
                            isActive={currentPage === item.href}
                            onClick={onNavClick}
                        />
                    ))}
                </div>
            </div>

            {/* ── Current Project Context (Dynamic / Role-Aware) ── */}
            <div className="mx-3 mb-3 rounded-xl border border-white/10 bg-white/5 overflow-hidden shrink-0">
                <div className="px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-orange-200/40 mb-2 select-none">
                        Current Project
                    </p>
                    <div className="flex items-center gap-2.5">
                        <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white"
                            style={{ backgroundColor: 'var(--color-brand-project-darker-orange)' }}
                        >
                            <FolderOpen className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-orange-50 truncate leading-snug">
                                {activeProject ? activeProject.title : 'No project selected'}
                            </p>
                            <p className="text-[10px] text-orange-200/50 leading-snug">
                                {activeProject
                                    ? `${activeProject.role || 'Member'} · ${activeProject.status || 'Active'}`
                                    : 'Select from Projects'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── User footer ── */}
            <div className="px-3 pb-4 shrink-0">
                <Separator className="mb-3 bg-white/10" />
                {user ? (
                    <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/8 transition-colors group">
                        <Avatar size="sm" className="shrink-0">
                            <AvatarImage src={undefined} />
                            <AvatarFallback
                                className="text-[10px] font-bold"
                                style={{
                                    backgroundColor: 'var(--color-brand-dark-green)',
                                    color: 'var(--color-brand-active-warm-orange)',
                                }}
                            >
                                {getInitials(user.name)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white truncate leading-snug">
                                {user.name}
                            </p>
                            <p className="text-[10px] text-orange-200/60 truncate leading-snug">
                                {user.email}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onLogout}
                            className="p-1.5 rounded-lg text-orange-200/40 hover:text-rose-300 hover:bg-white/10 transition-colors cursor-pointer shrink-0 opacity-0 group-hover:opacity-100"
                            title="Sign out"
                            aria-label="Sign out"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ) : (
                    <Link
                        href="/login"
                        className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-orange-200/70 hover:text-white transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign In
                    </Link>
                )}
            </div>
        </div>
    );
}

// ─── Main AppLayout ───────────────────────────────────────────────────────────

export const AppLayout: React.FC<AppLayoutProps> = ({
    title,
    subtitle,
    headerAction,
    currentProject,
    children,
}) => {
    const { auth, url } = usePage<PageProps & { url: string }>().props;
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    const user = auth?.user
        ? { name: auth.user.name, email: auth.user.email }
        : null;

    // Determine active nav from the current URL
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/dashboard';

    const handleLogout = () => {
        router.post('/logout');
    };

    return (
        <div className="min-h-screen flex bg-[color:var(--color-surface-subtle)]">

            {/* ══ Desktop Sidebar ══════════════════════════════════════════ */}
            <aside
                className="hidden lg:flex lg:flex-col lg:w-64 shrink-0 fixed inset-y-0 left-0 z-30"
                style={{
                    background: 'linear-gradient(160deg, #1a4a1a 0%, var(--color-brand-dark-green) 60%, #0d2e0d 100%)',
                }}
            >
                <SidebarContent
                    user={user}
                    currentPage={currentPath}
                    currentProject={currentProject}
                    onLogout={handleLogout}
                />
            </aside>

            {/* ══ Main Area (offset by sidebar width on desktop) ═══════════ */}
            <div className="flex-1 flex flex-col min-w-0 lg:pl-64">

                {/* ── Topbar ──────────────────────────────────────────────── */}
                <header className="h-14 px-4 sm:px-6 border-b border-[color:var(--color-border-light)] flex items-center justify-between bg-white shrink-0 sticky top-0 z-20 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)]">

                    {/* Left: Mobile menu + breadcrumb */}
                    <div className="flex items-center gap-3 min-w-0">
                        {/* Mobile hamburger (Sheet trigger) */}
                        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
                            <SheetTrigger asChild>
                                <button
                                    type="button"
                                    className="lg:hidden p-2 rounded-lg text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-muted)] transition-colors cursor-pointer"
                                    aria-label="Open navigation"
                                >
                                    <Menu className="w-5 h-5" />
                                </button>
                            </SheetTrigger>
                            <SheetContent
                                side="left"
                                className="p-0 w-64 border-r-0"
                                style={{
                                    background: 'linear-gradient(160deg, #1a4a1a 0%, var(--color-brand-dark-green) 60%, #0d2e0d 100%)',
                                }}
                            >
                                <SidebarContent
                                    user={user}
                                    currentPage={currentPath}
                                    currentProject={currentProject}
                                    onNavClick={() => setIsMobileOpen(false)}
                                    onLogout={() => {
                                        setIsMobileOpen(false);
                                        handleLogout();
                                    }}
                                />
                            </SheetContent>
                        </Sheet>

                        {/* Page title (desktop only) */}
                        {title && (
                            <div className="hidden sm:block min-w-0">
                                <h1 className="text-sm font-semibold text-[color:var(--color-text-main)] truncate leading-snug">
                                    {title}
                                </h1>
                                {subtitle && (
                                    <p className="text-xs text-[color:var(--color-text-muted)] truncate leading-snug">
                                        {subtitle}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right: Search + Notifications + User */}
                    <div className="flex items-center gap-2 shrink-0">

                        {/* Search placeholder */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-lg border border-[color:var(--color-border-light)] bg-[color:var(--color-surface-subtle)] text-[color:var(--color-text-subtle)] text-xs hover:border-[color:var(--color-border-dark)] hover:bg-white transition-colors cursor-not-allowed"
                                    disabled
                                >
                                    <Search className="w-3.5 h-3.5" />
                                    <span className="hidden md:block">Search…</span>
                                    <kbd className="hidden md:block text-[10px] bg-white/80 border border-[color:var(--color-border-light)] rounded px-1 py-0.5 font-mono leading-none">
                                        ⌘K
                                    </kbd>
                                </button>
                            </TooltipTrigger>
                            <TooltipContent className="text-xs">Search coming soon</TooltipContent>
                        </Tooltip>

                        {/* Notification bell placeholder */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    className="relative p-2 rounded-lg text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-muted)] transition-colors cursor-not-allowed"
                                    disabled
                                    aria-label="Notifications (coming soon)"
                                >
                                    <Bell className="w-4.5 h-4.5" />
                                    {/* Dot indicator placeholder */}
                                    <span
                                        className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full ring-2 ring-white"
                                        style={{ backgroundColor: 'var(--color-brand-action-orange)' }}
                                        aria-hidden="true"
                                    />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent className="text-xs">Notifications coming soon</TooltipContent>
                        </Tooltip>

                        <Separator orientation="vertical" className="h-6 mx-1" />

                        {/* ── User account dropdown ── */}
                        {user ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        className="flex items-center gap-2.5 pl-1 pr-2.5 py-1 rounded-lg hover:bg-[color:var(--color-surface-muted)] transition-colors cursor-pointer group"
                                        aria-label="Account menu"
                                    >
                                        <Avatar size="sm" className="shrink-0">
                                            <AvatarImage src={undefined} />
                                            <AvatarFallback
                                                className="text-[10px] font-bold"
                                                style={{
                                                    backgroundColor: 'var(--color-brand-dark-green)',
                                                    color: 'var(--color-brand-active-warm-orange)',
                                                }}
                                            >
                                                {getInitials(user.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="hidden sm:block text-left min-w-0">
                                            <p className="text-xs font-semibold text-[color:var(--color-text-main)] truncate max-w-[120px] leading-snug">
                                                {user.name}
                                            </p>
                                            <p className="text-[10px] text-[color:var(--color-text-muted)] truncate max-w-[120px] leading-snug">
                                                {user.email}
                                            </p>
                                        </div>
                                        <ChevronDown className="w-3.5 h-3.5 text-[color:var(--color-text-subtle)] group-data-[state=open]:rotate-180 transition-transform shrink-0" />
                                    </button>
                                </DropdownMenuTrigger>

                                <DropdownMenuContent align="end" className="w-56 mt-1">
                                    <DropdownMenuLabel className="font-normal py-2">
                                        <div className="flex flex-col space-y-0.5">
                                            <p className="text-xs font-semibold text-[color:var(--color-text-main)] truncate">
                                                {user.name}
                                            </p>
                                            <p className="text-[11px] text-[color:var(--color-text-muted)] truncate">
                                                {user.email}
                                            </p>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        disabled
                                        className="gap-2 text-xs cursor-not-allowed opacity-50"
                                    >
                                        <User className="w-3.5 h-3.5" />
                                        Profile
                                        <span className="ml-auto text-[10px] text-[color:var(--color-text-subtle)]">Soon</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        disabled
                                        className="gap-2 text-xs cursor-not-allowed opacity-50"
                                    >
                                        <Settings className="w-3.5 h-3.5" />
                                        Settings
                                        <span className="ml-auto text-[10px] text-[color:var(--color-text-subtle)]">Soon</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={handleLogout}
                                        className="gap-2 text-xs text-rose-600 focus:text-rose-700 focus:bg-rose-50 cursor-pointer"
                                    >
                                        <LogOut className="w-3.5 h-3.5" />
                                        Sign Out
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <Link
                                href="/login"
                                className="text-xs font-medium text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-main)] transition-colors px-2 py-1"
                            >
                                Sign In
                            </Link>
                        )}
                    </div>
                </header>

                {/* ── Page heading (mobile / full width) ─────────────────── */}
                {(title || headerAction) && (
                    <div className="px-4 sm:px-6 pt-5 pb-4 bg-white border-b border-[color:var(--color-border-light)] flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="min-w-0">
                            {title && (
                                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[color:var(--color-text-main)] leading-snug">
                                    {title}
                                </h1>
                            )}
                            {subtitle && (
                                <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5 leading-relaxed">
                                    {subtitle}
                                </p>
                            )}
                        </div>
                        {headerAction && (
                            <div className="shrink-0">{headerAction}</div>
                        )}
                    </div>
                )}

                {/* ── Main content ────────────────────────────────────────── */}
                <main className="flex-1 px-4 sm:px-6 py-6 w-full max-w-screen-xl">
                    {children}
                </main>
            </div>
        </div>
    );
};
