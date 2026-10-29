import React from 'react';
import { Shield } from 'lucide-react';
import { type ProjectRole } from '@/Config/navigation';

export interface ProjectRoleBadgeProps {
    role?: ProjectRole | string | null;
    className?: string;
}

const ROLE_STYLES: Record<string, { bg: string; text: string; border: string; iconColor: string }> = {
    'Project Leader': {
        bg: 'bg-[color:var(--status-success-bg)]',
        text: 'text-[color:var(--status-success-text)]',
        border: 'border-[color:var(--status-success-border)]',
        iconColor: 'text-[color:var(--accent)]',
    },
    'Project Committee': {
        bg: 'bg-[color:var(--status-neutral-bg)]',
        text: 'text-[color:var(--status-neutral-text)]',
        border: 'border-[color:var(--status-neutral-border)]',
        iconColor: 'text-[color:var(--secondary)]',
    },
    'Committee Staff': {
        bg: 'bg-[color:var(--soft-surface)]',
        text: 'text-[color:var(--text)]',
        border: 'border-[color:var(--border)]',
        iconColor: 'text-[color:var(--muted)]',
    },
    'Project Staff': {
        bg: 'bg-[color:var(--status-neutral-bg)]',
        text: 'text-[color:var(--status-neutral-text)]',
        border: 'border-[color:var(--status-neutral-border)]',
        iconColor: 'text-[color:var(--secondary)]',
    },
    'Project Member': {
        bg: 'bg-[color:var(--soft-surface)]',
        text: 'text-[color:var(--text)]',
        border: 'border-[color:var(--border)]',
        iconColor: 'text-[color:var(--muted)]',
    },
};

export const ProjectRoleBadge: React.FC<ProjectRoleBadgeProps> = ({ role, className = '' }) => {
    if (!role) {
        return (
            <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] text-[11px] font-medium border bg-[color:var(--soft-surface)] text-[color:var(--muted)] border-[color:var(--border)] ${className}`}
                title="No project role assigned"
            >
                <Shield className="w-3 h-3 text-[color:var(--muted)] stroke-[2px]" />
                <span>No role</span>
            </span>
        );
    }

    const style = ROLE_STYLES[role] ?? {
        bg: 'bg-[color:var(--soft-surface)]',
        text: 'text-[color:var(--text)]',
        border: 'border-[color:var(--border)]',
        iconColor: 'text-[color:var(--muted)]',
    };

    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] text-[11px] font-medium border ${style.bg} ${style.text} ${style.border} ${className}`}
            title={`Project role: ${role}`}
        >
            <Shield className={`w-3 h-3 ${style.iconColor} stroke-[2px]`} />
            <span>{role}</span>
        </span>
    );
};
