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
        <div className="min-h-screen bg-slate-50/70 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
            {/* Header Brand */}
            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                <Link href="/login" className="inline-flex items-center gap-3.5 group">
                    <div className="w-12 h-12 rounded-xl bg-linear-to-br from-[#F68233] to-[#E06D1F] flex items-center justify-center text-white shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform duration-150">
                        <svg
                            className="w-6 h-6 text-white"
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
                        <span className="text-2xl font-extrabold tracking-tight text-slate-900 block leading-none">
                            ITASK
                        </span>
                        <span className="text-xs font-medium text-slate-600 block mt-1 leading-snug">
                            Integrated Task Assignment and Knowledge Sharing
                        </span>
                        <span className="text-[10px] font-semibold text-[#003300] tracking-wider uppercase block mt-0.5">
                            College of Computing and Information Sciences
                        </span>
                    </div>
                </Link>

                {title && (
                    <h2 className="mt-6 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                        {title}
                    </h2>
                )}
                {subtitle && (
                    <p className="mt-1.5 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                        {subtitle}
                    </p>
                )}
            </div>

            {/* Auth Form Card */}
            <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-6 sm:px-10 rounded-2xl border border-slate-200/90 shadow-xs sm:shadow-sm">
                    {children}
                </div>

                <div className="mt-8 text-center text-xs text-slate-400 space-y-1">
                    <p className="font-semibold text-slate-500">
                        College of Computing and Information Sciences
                    </p>
                    <p className="text-[11px] text-slate-400">
                        Integrated Task Assignment and Knowledge Sharing • CarSU
                    </p>
                </div>
            </div>
        </div>
    );
};
