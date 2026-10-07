import React from 'react';

export interface CardProps {
    title?: string;
    subtitle?: string;
    headerAction?: React.ReactNode;
    footer?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    isAttention?: boolean;
}

const paddingStyles = {
    none: '',
    sm: 'p-3 sm:p-4',
    md: 'p-4 sm:p-5',
    lg: 'p-5 sm:p-6',
};

export const Card: React.FC<CardProps> = ({
    title,
    subtitle,
    headerAction,
    footer,
    children,
    className = '',
    padding = 'md',
    isAttention = false,
}) => {
    return (
        <div
            className={`bg-[color:var(--card)] rounded-[12px] border border-[color:var(--border)] text-[color:var(--text)] transition-colors duration-150 ${
                isAttention ? 'border-l-4 border-l-[color:var(--primary)]' : ''
            } ${className}`}
            style={{ boxShadow: 'none' }}
        >
            {(title || headerAction) && (
                <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-[color:var(--border)]">
                    <div>
                        {title && <h3 className="text-[16px] font-semibold text-[color:var(--text)] leading-snug">{title}</h3>}
                        {subtitle && <p className="text-[13px] text-[color:var(--muted)] mt-0.5">{subtitle}</p>}
                    </div>
                    {headerAction && <div>{headerAction}</div>}
                </div>
            )}

            <div className={paddingStyles[padding]}>{children}</div>

            {footer && (
                <div className="px-4 sm:px-5 py-3 bg-[color:var(--soft-surface)] border-t border-[color:var(--border)] rounded-b-[12px] flex items-center justify-between text-[13px]">
                    {footer}
                </div>
            )}
        </div>
    );
};
