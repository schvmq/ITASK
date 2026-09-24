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
        badge: 'bg-[#FFF7ED] text-[#F68233] border-[#FED7AA]',
        dot: 'bg-[#F68233]',
    },
    secondary: {
        badge: 'bg-[#F0FDF4] text-[#003300] border-[#BBF7D0]',
        dot: 'bg-[#003300]',
    },
    success: {
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-500',
    },
    warning: {
        badge: 'bg-amber-50 text-amber-800 border-amber-200',
        dot: 'bg-amber-500',
    },
    danger: {
        badge: 'bg-rose-50 text-rose-700 border-rose-200',
        dot: 'bg-rose-500',
    },
    neutral: {
        badge: 'bg-slate-50 text-slate-700 border-slate-200',
        dot: 'bg-slate-400',
    },
};

export const Badge: React.FC<BadgeProps> = ({
    variant = 'neutral',
    children,
    className = '',
    dot = false,
}) => {
    const style = variantStyles[variant];

    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style.badge} ${className}`}
        >
            {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />}
            <span>{children}</span>
        </span>
    );
};
