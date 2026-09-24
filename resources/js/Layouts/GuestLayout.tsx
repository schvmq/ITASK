import React from 'react';
import { Link } from '@inertiajs/react';

export interface GuestLayoutProps {
    title?: string;
    subtitle?: string;
    children: React.ReactNode;
}

export const GuestLayout: React.FC<GuestLayoutProps> = ({
    title,
    subtitle,
    children,
}) => {
    return (
        <div className="min-h-screen bg-slate-50/60 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            {/* Header Brand */}
            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                <Link href="/" className="inline-flex items-center gap-2.5 group">
                    <div className="w-10 h-10 rounded-xl bg-linear-to-br from-[#F68233] to-[#E06D1F] flex items-center justify-center text-white shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform duration-150">
                        <svg
                            className="w-5 h-5 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                            />
                        </svg>
                    </div>
                    <div className="text-left">
                        <span className="text-xl font-bold tracking-tight text-slate-900 block leading-tight">
                            ITASK
                        </span>
                        <span className="text-[10px] font-semibold text-[#003300] tracking-wider uppercase block">
                            College of Computing and Information Sciences
                        </span>
                    </div>
                </Link>

                {title && (
                    <h2 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">
                        {title}
                    </h2>
                )}
                {subtitle && (
                    <p className="mt-1.5 text-xs text-slate-500 max-w-sm mx-auto">
                        {subtitle}
                    </p>
                )}
            </div>

            {/* Auth Form Card */}
            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
                <div className="bg-white py-8 px-6 sm:px-10 rounded-2xl border border-slate-200/80 shadow-xs sm:shadow-sm">
                    {children}
                </div>

                <div className="mt-6 text-center text-xs text-slate-400">
                    <p>Caraga State University • Faculty Workflow Coordination</p>
                </div>
            </div>
        </div>
    );
};
