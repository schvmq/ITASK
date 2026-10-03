import React from 'react';
import { BadgeVariant } from '@/types';

export interface BadgeProps {
    variant?: BadgeVariant;
    children: React.ReactNode;
    className?: string;
    dot?: boolean;
}

const variantStyles: Record<BadgeVariant, { badge: string; dot: string }> = {
    primary: {
        badge: 'bg-[var(--tint-orange)] text-[var(--link-orange)] border-[#FDE5CC] dark:border-[#573516]',
        dot: 'bg-[#EC7505]',
    },
    secondary: {
        badge: 'bg-[var(--tint-neutral)] text-[var(--ink)] border-[var(--border)]',
        dot: 'bg-[#2A2A2A] dark:bg-[#F3F1E2]',
    },
    success: {
        badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
        dot: 'bg-emerald-500',
    },
    warning: {
        badge: 'bg-[var(--tint-yellow)] text-[var(--amber-text)] border-[#FFE9A8] dark:border-[#524410]',
        dot: 'bg-[#FFBB00]',
    },
    danger: {
        badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
        dot: 'bg-rose-500',
    },
    neutral: {
        badge: 'bg-[var(--tint-neutral)] text-[var(--muted)] border-[var(--border)]',
        dot: 'bg-[var(--muted)]',
    },
};

export const Badge: React.FC<BadgeProps> = ({
    variant = 'neutral',
    children,
    className = '',
    dot = false,
}) => {
    const style = variantStyles[variant] || variantStyles.neutral;

    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style.badge} ${className}`}
        >
            {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />}
            <span>{children}</span>
        </span>
    );
};
