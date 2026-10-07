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
        applyTheme(theme);

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
        ? 'Theme settings. Dark mode active. Click to switch theme.'
        : 'Theme settings. Light mode active. Click to switch theme.';

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="p-2 rounded-[8px] text-[color:var(--muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] transition-colors cursor-pointer relative focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                    aria-label={accessibleLabel}
                    title={accessibleLabel}
                >
                    {resolvedDark ? (
                        <Moon className="w-[18px] h-[18px] stroke-[2px] text-[color:var(--text)]" />
                    ) : (
                        <Sun className="w-[18px] h-[18px] stroke-[2px] text-[color:var(--text)]" />
                    )}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="w-36 p-1 bg-[color:var(--card)] border border-[color:var(--border)] rounded-[10px] text-[color:var(--text)]"
                style={{ boxShadow: 'none' }}
            >
                <DropdownMenuItem
                    onClick={() => applyTheme('light')}
                    className="flex items-center justify-between text-[13px] px-2.5 py-1.5 rounded-[6px] text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] cursor-pointer"
                >
                    <span className="flex items-center gap-2">
                        <Sun className="w-[16px] h-[16px] stroke-[2px]" />
                        Light
                    </span>
                    {theme === 'light' && <Check className="w-4 h-4 text-[color:var(--primary)]" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => applyTheme('dark')}
                    className="flex items-center justify-between text-[13px] px-2.5 py-1.5 rounded-[6px] text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] cursor-pointer"
                >
                    <span className="flex items-center gap-2">
                        <Moon className="w-[16px] h-[16px] stroke-[2px]" />
                        Dark
                    </span>
                    {theme === 'dark' && <Check className="w-4 h-4 text-[color:var(--primary)]" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => applyTheme('system')}
                    className="flex items-center justify-between text-[13px] px-2.5 py-1.5 rounded-[6px] text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] cursor-pointer"
                >
                    <span className="flex items-center gap-2">
                        <Laptop className="w-[16px] h-[16px] stroke-[2px]" />
                        System
                    </span>
                    {theme === 'system' && <Check className="w-4 h-4 text-[color:var(--primary)]" />}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
