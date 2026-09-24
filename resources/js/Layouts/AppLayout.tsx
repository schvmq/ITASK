import React, { useState } from 'react';
import { Link, usePage } from '@inertiajs/react';
import { PageProps } from '@/types';

export interface AppLayoutProps {
    title?: string;
    subtitle?: string;
    headerAction?: React.ReactNode;
    children: React.ReactNode;
}

interface NavItem {
    name: string;
    href: string;
    icon: React.ReactNode;
    active?: boolean;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
    title,
    subtitle,
    headerAction,
    children,
}) => {
    const { auth } = usePage<PageProps>().props;
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const user = auth?.user || {
        name: 'Faculty Member',
        email: 'faculty@carsu.edu.ph',
    };

    const navigation: NavItem[] = [
        {
            name: 'Dashboard',
            href: '/',
            active: true,
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                </svg>
            ),
        },
        {
            name: 'Projects',
            href: '#projects',
            active: false,
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                </svg>
            ),
        },
        {
            name: 'Committees',
            href: '#committees',
            active: false,
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                </svg>
            ),
        },
        {
            name: 'Activities',
            href: '#activities',
            active: false,
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
                </svg>
            ),
        },
        {
            name: 'Tasks',
            href: '#tasks',
            active: false,
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
            ),
        },
    ];

    return (
        <div className="min-h-screen bg-white flex">
            {/* Desktop Sidebar (White with neutral border) */}
            <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-white border-r border-slate-200/80 shrink-0">
                {/* Brand Header */}
                <div className="h-16 px-6 border-b border-slate-100 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-linear-to-br from-[#F68233] to-[#E06D1F] flex items-center justify-center text-white shadow-xs">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                            </svg>
                        </div>
                        <div>
                            <span className="font-bold text-base tracking-tight text-slate-900 block leading-none">
                                ITASK
                            </span>
                            <span className="text-[9px] font-semibold text-[#003300] tracking-wider uppercase block mt-0.5">
                                CCIS CARSU
                            </span>
                        </div>
                    </Link>
                </div>

                {/* Navigation Links */}
                <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                    <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Workflow Navigation
                    </div>
                    {navigation.map((item) => (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-150 ${
                                item.active
                                    ? 'bg-orange-50 text-[#F68233] border-l-2 border-[#F68233] font-semibold shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                            }`}
                        >
                            <span className={item.active ? 'text-[#F68233]' : 'text-slate-400'}>
                                {item.icon}
                            </span>
                            <span>{item.name}</span>
                        </Link>
                    ))}
                </div>

                {/* Sidebar Footer User Area */}
                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#003300] text-white flex items-center justify-center text-xs font-semibold">
                            {user.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-800 truncate">{user.name}</p>
                            <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-white">
                {/* Top Header */}
                <header className="h-16 px-4 sm:px-8 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        {/* Mobile Hamburger Button */}
                        <button
                            type="button"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition cursor-pointer"
                            aria-label="Toggle navigation menu"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                            </svg>
                        </button>

                        <div className="hidden sm:block">
                            <span className="text-xs font-medium text-slate-400">
                                Faculty Workflow Coordination System
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Notification Bell Placeholder */}
                        <button
                            type="button"
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition relative cursor-pointer"
                            title="Notifications"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                            </svg>
                            <span className="w-2 h-2 rounded-full bg-[#F68233] absolute top-2 right-2 ring-2 ring-white" />
                        </button>

                        {/* Quick Auth links for preview */}
                        <div className="flex items-center gap-2 pl-2 border-l border-slate-100 text-xs">
                            <Link href="/login" className="px-2.5 py-1 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-50 transition">
                                Login
                            </Link>
                            <Link href="/register" className="px-2.5 py-1 text-[#F68233] hover:text-[#E06D1F] font-medium rounded-md hover:bg-orange-50 transition">
                                Register
                            </Link>
                        </div>
                    </div>
                </header>

                {/* Mobile Drawer Navigation */}
                {isMobileMenuOpen && (
                    <div className="lg:hidden border-b border-slate-200 bg-white p-4 space-y-1 shadow-md">
                        {navigation.map((item) => (
                            <Link
                                key={item.name}
                                href={item.href}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium ${
                                    item.active ? 'bg-orange-50 text-[#F68233] font-semibold' : 'text-slate-600'
                                }`}
                            >
                                {item.icon}
                                <span>{item.name}</span>
                            </Link>
                        ))}
                    </div>
                )}

                {/* Page Content Container */}
                <main className="flex-1 px-4 sm:px-8 py-6 max-w-7xl w-full mx-auto">
                    {(title || headerAction) && (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 mb-6 border-b border-slate-100 gap-4">
                            <div>
                                {title && (
                                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                                        {title}
                                    </h1>
                                )}
                                {subtitle && (
                                    <p className="text-xs text-slate-500 mt-1">
                                        {subtitle}
                                    </p>
                                )}
                            </div>
                            {headerAction && <div>{headerAction}</div>}
                        </div>
                    )}

                    {children}
                </main>
            </div>
        </div>
    );
};
