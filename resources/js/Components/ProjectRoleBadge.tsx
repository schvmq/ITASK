import React from 'react';
import { Shield } from 'lucide-react';
import { type ProjectRole } from '@/Config/navigation';

export interface ProjectRoleBadgeProps {
    role?: ProjectRole | string | null;
    className?: string;
}

const ROLE_STYLES: Record<string, { bg: string; text: string; border: string; iconColor: string }> = {
    'Project Leader': {
        bg: 'bg-emerald-50/90',
        text: 'text-[color:var(--color-brand-dark-green)]',
        border: 'border-emerald-300/80',
        iconColor: 'text-[color:var(--color-brand-dark-green)]',
    },
    'Project Staff': {
        bg: 'bg-[color:var(--color-brand-active-warm-orange)]',
        text: 'text-[color:var(--color-brand-action-orange)]',
        border: 'border-orange-200',
        iconColor: 'text-[color:var(--color-brand-action-orange)]',
    },
    'Project Member': {
        bg: 'bg-slate-100',
        text: 'text-slate-700',
        border: 'border-slate-300/80',
        iconColor: 'text-slate-600',
    },
};

export const ProjectRoleBadge: React.FC<ProjectRoleBadgeProps> = ({ role, className = '' }) => {
    if (!role) {
        return (
            <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wide uppercase border bg-slate-50 text-slate-500 border-slate-200 ${className}`}
                title="No project role assigned"
            >
                <Shield className="w-3 h-3 text-slate-400" />
                <span>No project role</span>
            </span>
        );
    }

    const style = ROLE_STYLES[role] ?? {
        bg: 'bg-slate-50',
        text: 'text-slate-700',
        border: 'border-slate-200',
        iconColor: 'text-slate-500',
    };

    return (
        <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wide uppercase border ${style.bg} ${style.text} ${style.border} ${className}`}
            title={`Your role in this project: ${role}`}
        >
            <Shield className={`w-3 h-3 ${style.iconColor}`} />
            <span>{role}</span>
        </span>
    );
};
