import React from 'react';

export interface CardProps {
    title?: string;
    subtitle?: string;
    headerAction?: React.ReactNode;
    footer?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingStyles = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
};

export const Card: React.FC<CardProps> = ({
    title,
    subtitle,
    headerAction,
    footer,
    children,
    className = '',
    padding = 'md',
}) => {
    return (
        <div
            className={`bg-white rounded-xl border border-slate-200/80 shadow-xs transition-shadow duration-150 ${className}`}
        >
            {(title || headerAction) && (
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div>
                        {title && <h3 className="text-base font-semibold text-slate-900">{title}</h3>}
                        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
                    </div>
                    {headerAction && <div>{headerAction}</div>}
                </div>
            )}

            <div className={paddingStyles[padding]}>{children}</div>

            {footer && (
                <div className="px-6 py-3.5 bg-slate-50/70 border-t border-slate-100 rounded-b-xl flex items-center justify-between">
                    {footer}
                </div>
            )}
        </div>
    );
};
