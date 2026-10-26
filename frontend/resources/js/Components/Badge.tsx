import React from 'react';
import { motion } from 'motion/react';
import { BadgeVariant } from '@/types';
import { badgePopVariant } from '@/animations';

export interface BadgeProps {
    variant?: BadgeVariant;
    children: React.ReactNode;
    className?: string;
    dot?: boolean;
}

const variantStyles: Record<BadgeVariant, { badge: string; dot: string }> = {
    // Accent for "On track" and success states
    success: {
        badge: 'bg-[color:var(--status-success-bg)] text-[color:var(--status-success-text)] border-[color:var(--status-success-border)]',
        dot: 'bg-[color:var(--accent)]',
    },
    // Secondary for neutral or "In review" states
    secondary: {
        badge: 'bg-[color:var(--status-neutral-bg)] text-[color:var(--status-neutral-text)] border-[color:var(--status-neutral-border)]',
        dot: 'bg-[color:var(--secondary)]',
    },
    warning: {
        badge: 'bg-[color:var(--status-neutral-bg)] text-[color:var(--status-neutral-text)] border-[color:var(--status-neutral-border)]',
        dot: 'bg-[color:var(--secondary)]',
    },
    // Danger for "At risk" and "Overdue"
    danger: {
        badge: 'bg-[color:var(--status-danger-bg)] text-[color:var(--status-danger-text)] border-[color:var(--status-danger-border)]',
        dot: 'bg-[color:var(--status-danger)]',
    },
    // Primary light orange tint for active or highlighted badges
    primary: {
        badge: 'bg-[color:var(--status-primary-bg)] text-[color:var(--status-primary-text)] border-[color:var(--status-primary-border)]',
        dot: 'bg-[color:var(--primary)]',
    },
    neutral: {
        badge: 'bg-[color:var(--soft-surface)] text-[color:var(--muted)] border-[color:var(--border)]',
        dot: 'bg-[color:var(--muted)]',
    },
    accent: {
        badge: 'bg-[color:var(--status-success-bg)] text-[color:var(--status-success-text)] border-[color:var(--status-success-border)]',
        dot: 'bg-[color:var(--accent)]',
    },
    soft: {
        badge: 'bg-[color:var(--soft-surface)] text-[color:var(--muted)] border-[color:var(--border)]',
        dot: 'bg-[color:var(--muted)]',
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
        <motion.span
            variants={badgePopVariant}
            initial="hidden"
            animate="visible"
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-medium border ${style.badge} ${className}`}
        >
            {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} aria-hidden="true" />}
            <span>{children}</span>
        </motion.span>
    );
};
