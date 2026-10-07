import React from 'react';
import { Link } from '@inertiajs/react';
import { ThemeToggle } from '@/Components/ThemeToggle';

export interface GuestLayoutProps {
    title?: string;
    subtitle?: string;
    backgroundImage?: string;
    children: React.ReactNode;
}

export const GuestLayout: React.FC<GuestLayoutProps> = ({
    title,
    subtitle,
    backgroundImage = '/images/hiraya-building.webp',
    children,
}) => {
    return (
        <div className="min-h-screen relative flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 font-sans selection:bg-[color:var(--primary)] selection:text-white overflow-x-hidden">
            {/* Background Image Layer with Orange Gradient Blend */}
            {backgroundImage && (
                <div className="fixed inset-0 pointer-events-none z-0">
                    {/* Brighter, vibrant image rendering */}
                    <img
                        src={backgroundImage}
                        alt="CarSU Hiraya Building"
                        className="w-full h-full object-cover object-center brightness-[1.12] contrast-[1.05] saturate-[1.1] scale-105 motion-safe:transition-transform motion-safe:duration-1000"
                    />

                    {/* Warm Orange Brand Gradient Overlay (blends harmoniously with primary orange theme) */}
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/40 via-orange-500/45 to-orange-950/75 dark:from-orange-950/60 dark:via-[#1c0d05]/85 dark:to-[#0a0705]/92 transition-colors duration-300" />

                    {/* Radial highlight for a warm, luminous campus atmosphere */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-300/30 via-transparent to-black/35" />
                </div>
            )}

            {/* Top Bar with Floating Glass Theme Switcher */}
            <div className="absolute top-4 right-4 sm:right-8 z-20 bg-black/20 dark:bg-white/10 backdrop-blur-md rounded-full border border-white/20 p-0.5">
                <ThemeToggle />
            </div>

            {/* Header Brand */}
            <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md text-center">
                <Link href="/login" className="inline-flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-white font-black text-sm tracking-tighter shadow-lg ring-2 ring-white/40">
                        IT
                    </div>
                    <div className="text-left">
                        <span className="text-2xl font-black tracking-tight text-white block leading-none drop-shadow-md">
                            ITASK
                        </span>
                        <span className="text-[12px] font-medium text-amber-100/90 block mt-1 leading-snug drop-shadow-sm">
                            Project Management for Student Teams
                        </span>
                    </div>
                </Link>

                {title && (
                    <h1 className="mt-5 text-[24px] font-bold tracking-tight text-white drop-shadow-md">
                        {title}
                    </h1>
                )}
                {subtitle && (
                    <p className="mt-1 text-[13px] font-medium text-amber-50/90 max-w-sm mx-auto leading-relaxed drop-shadow-sm">
                        {subtitle}
                    </p>
                )}
            </div>

            {/* Auth Form Card with bright, frosted glass and elevated depth */}
            <div className="relative z-10 mt-6 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white/95 dark:bg-[#1a130e]/95 backdrop-blur-xl py-7 px-6 sm:px-8 rounded-[16px] border border-white/70 dark:border-orange-500/25 shadow-[0_20px_50px_rgba(0,0,0,0.25),0_0_40px_rgba(249,115,22,0.12)]">
                    {children}
                </div>

                {/* Footer Brand Info */}
                <div className="mt-6 text-center text-[12px] text-amber-100/90 space-y-1 drop-shadow-sm">
                    <p className="font-semibold text-white drop-shadow-md">
                        College of Computing and Information Sciences
                    </p>
                    <p className="text-[11px] text-orange-100/80">
                        Caraga State University • Institutional Project Hub
                    </p>
                </div>
            </div>
        </div>
    );
};
