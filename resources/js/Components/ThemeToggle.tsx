import React, { useEffect, useState } from 'react';
import { Sun, Moon, Laptop, Check } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/Components/ui/dropdown-menu';

export type ThemeOption = 'light' | 'dark' | 'system';

export function ThemeToggle() {
    const [theme, setTheme] = useState<ThemeOption>(() => {
        if (typeof window === 'undefined') return 'system';
        try {
            const saved = localStorage.getItem('itask_theme') as ThemeOption | null;
            if (saved === 'light' || saved === 'dark' || saved === 'system') {
                return saved;
            }
        } catch {
            // ignore localStorage failure
        }
        return 'system';
    });

    const [resolvedDark, setResolvedDark] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        try {
            const current = document.documentElement.getAttribute('data-theme');
            if (current === 'dark') return true;
            if (current === 'light') return false;
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        } catch {
            return false;
        }
    });

    const applyTheme = (targetTheme: ThemeOption) => {
        try {
            const isDark =
                targetTheme === 'dark' ||
                (targetTheme === 'system' &&
                    window.matchMedia('(prefers-color-scheme: dark)').matches);

            const root = document.documentElement;
            const themeAttr = isDark ? 'dark' : 'light';
            root.setAttribute('data-theme', themeAttr);
            if (isDark) {
                root.classList.add('dark');
            } else {
                root.classList.remove('dark');
            }

            setResolvedDark(isDark);
            setTheme(targetTheme);
            try {
                localStorage.setItem('itask_theme', targetTheme);
            } catch {
                // ignore
            }
        } catch {
            // ignore
        }
    };

    useEffect(() => {
        // Apply on mount
        applyTheme(theme);

        // System preference change listener
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            try {
                const currentSaved = localStorage.getItem('itask_theme');
                if (!currentSaved || currentSaved === 'system') {
                    applyTheme('system');
                }
            } catch {
                // ignore
            }
        };

        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        } else {
            mediaQuery.addListener(handleChange);
            return () => mediaQuery.removeListener(handleChange);
        }
    }, [theme]);

    const accessibleLabel = resolvedDark
        ? 'Theme settings. Currently dark mode. Switch to light mode.'
        : 'Theme settings. Currently light mode. Switch to dark mode.';

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="p-2 rounded-xl text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--tint-neutral)] transition-colors cursor-pointer relative"
                    aria-label={accessibleLabel}
                    title={accessibleLabel}
                >
                    {resolvedDark ? (
                        <Moon className="w-4.5 h-4.5 text-[#FFBB00]" />
                    ) : (
                        <Sun className="w-4.5 h-4.5 text-[#EC7505]" />
                    )}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36 p-1 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg">
                <DropdownMenuItem
                    onClick={() => applyTheme('light')}
                    className="flex items-center justify-between text-xs font-semibold px-2.5 py-1.5 rounded-lg text-[var(--ink)] hover:bg-[var(--tint-neutral)] cursor-pointer"
                >
                    <span className="flex items-center gap-2">
                        <Sun className="w-3.5 h-3.5 text-[#EC7505]" />
                        Light
                    </span>
                    {theme === 'light' && <Check className="w-3.5 h-3.5 text-[#EC7505]" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => applyTheme('dark')}
                    className="flex items-center justify-between text-xs font-semibold px-2.5 py-1.5 rounded-lg text-[var(--ink)] hover:bg-[var(--tint-neutral)] cursor-pointer"
                >
                    <span className="flex items-center gap-2">
                        <Moon className="w-3.5 h-3.5 text-[#FFBB00]" />
                        Dark
                    </span>
                    {theme === 'dark' && <Check className="w-3.5 h-3.5 text-[#FFBB00]" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => applyTheme('system')}
                    className="flex items-center justify-between text-xs font-semibold px-2.5 py-1.5 rounded-lg text-[var(--ink)] hover:bg-[var(--tint-neutral)] cursor-pointer"
                >
                    <span className="flex items-center gap-2">
                        <Laptop className="w-3.5 h-3.5 text-[var(--muted)]" />
                        System
                    </span>
                    {theme === 'system' && <Check className="w-3.5 h-3.5 text-[var(--ink)]" />}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
