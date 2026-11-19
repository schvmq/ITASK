import React from 'react';
import { AlertVariant } from '@/types';
import { Info, CheckCircle2, AlertTriangle, AlertCircle, X } from 'lucide-react';

export interface AlertProps {
    variant?: AlertVariant;
    title?: string;
    children: React.ReactNode;
    className?: string;
    onClose?: () => void;
}

const variantStyles: Record<AlertVariant, { container: string; iconClass: string; titleClass: string }> = {
    info: {
        container: 'bg-[color:var(--soft-surface)] border-[color:var(--border)] text-[color:var(--text)]',
        iconClass: 'text-[color:var(--muted)]',
        titleClass: 'text-[color:var(--text)]',
    },
    success: {
        container: 'bg-[color:var(--status-success-bg)] border-[color:var(--status-success-border)] text-[color:var(--status-success-text)]',
        iconClass: 'text-[color:var(--accent)]',
        titleClass: 'text-[color:var(--status-success-text)]',
    },
    warning: {
        container: 'bg-[color:var(--status-neutral-bg)] border-[color:var(--status-neutral-border)] text-[color:var(--status-neutral-text)]',
        iconClass: 'text-[color:var(--secondary)]',
        titleClass: 'text-[color:var(--status-neutral-text)]',
    },
    danger: {
        container: 'bg-[color:var(--status-danger-bg)] border-[color:var(--status-danger-border)] text-[color:var(--status-danger-text)]',
        iconClass: 'text-[color:var(--primary)]',
        titleClass: 'text-[color:var(--status-danger-text)]',
    },
};

export const Alert: React.FC<AlertProps> = ({
    variant = 'info',
    title,
    children,
    className = '',
    onClose,
}) => {
    const style = variantStyles[variant];

    return (
        <div
            role="alert"
            className={`flex items-start gap-3 p-3.5 rounded-[10px] border text-[14px] transition-all duration-150 ${style.container} ${className}`}
        >
            <div className={`shrink-0 mt-0.5 ${style.iconClass}`}>
                {variant === 'info' && <Info className="w-4 h-4 stroke-[2px]" />}
                {variant === 'success' && <CheckCircle2 className="w-4 h-4 stroke-[2px]" />}
                {variant === 'warning' && <AlertTriangle className="w-4 h-4 stroke-[2px]" />}
                {variant === 'danger' && <AlertCircle className="w-4 h-4 stroke-[2px]" />}
            </div>

            <div className="flex-1 min-w-0">
                {title && <h5 className={`font-semibold mb-0.5 text-[12px] tracking-wide uppercase ${style.titleClass}`}>{title}</h5>}
                <div className="leading-relaxed">{children}</div>
            </div>

            {onClose && (
                <button
                    onClick={onClose}
                    className="shrink-0 p-1 -mr-1 rounded-[6px] opacity-70 hover:opacity-100 transition cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                    aria-label="Close alert"
                >
                    <X className="w-4 h-4 stroke-[2px]" />
                </button>
            )}
        </div>
    );
};
