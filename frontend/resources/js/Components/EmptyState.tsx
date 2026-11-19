import React from 'react';
import { Button } from './Button';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
    actionNode?: React.ReactNode;
    className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon,
    title,
    description,
    actionLabel,
    onAction,
    actionNode,
    className = '',
}) => {
    return (
        <div
            className={`flex flex-col items-center justify-center text-center p-8 sm:p-10 rounded-[12px] border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)] ${className}`}
        >
            <div className="w-12 h-12 rounded-[10px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] flex items-center justify-center text-[color:var(--muted)] mb-3.5">
                {icon || <Inbox className="w-6 h-6" />}
            </div>

            <h4 className="text-[16px] font-semibold text-[color:var(--text)]">{title}</h4>
            {description && (
                <p className="text-[13px] text-[color:var(--muted)] max-w-sm mt-1 mb-4 leading-relaxed">
                    {description}
                </p>
            )}

            {actionNode ? (
                actionNode
            ) : actionLabel && onAction ? (
                <Button variant="primary" size="sm" onClick={onAction}>
                    {actionLabel}
                </Button>
            ) : null}
        </div>
    );
};
