import React from 'react';
import { AlertVariant } from '@/types';

export interface AlertProps {
    variant?: AlertVariant;
    title?: string;
    children: React.ReactNode;
    className?: string;
    onClose?: () => void;
}

const variantStyles: Record<AlertVariant, { container: string; icon: string; title: string }> = {
    info: {
        container: 'bg-blue-50/80 border-blue-200 text-blue-900',
        icon: 'text-blue-600',
        title: 'text-blue-900',
    },
    success: {
        container: 'bg-emerald-50/80 border-emerald-200 text-emerald-900',
        icon: 'text-emerald-600',
        title: 'text-emerald-900',
    },
    warning: {
        container: 'bg-amber-50/80 border-amber-200 text-amber-900',
        icon: 'text-amber-600',
        title: 'text-amber-900',
    },
    danger: {
        container: 'bg-rose-50/80 border-rose-200 text-rose-900',
        icon: 'text-rose-600',
        title: 'text-rose-900',
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
            className={`flex items-start gap-3 p-3.5 rounded-lg border text-sm transition-all duration-150 ${style.container} ${className}`}
        >
            <div className={`shrink-0 mt-0.5 ${style.icon}`}>
                {variant === 'info' && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                    </svg>
                )}
                {variant === 'success' && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                )}
                {variant === 'warning' && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                )}
                {variant === 'danger' && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 7.5h.008v.008H12v-.008Z" />
                    </svg>
                )}
            </div>

            <div className="flex-1 min-w-0">
                {title && <h5 className={`font-semibold mb-0.5 text-xs tracking-wide uppercase ${style.title}`}>{title}</h5>}
                <div className="leading-relaxed">{children}</div>
            </div>

            {onClose && (
                <button
                    onClick={onClose}
                    className="shrink-0 p-1 -mr-1 rounded-sm opacity-70 hover:opacity-100 transition cursor-pointer"
                    aria-label="Close alert"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                </button>
            )}
        </div>
    );
};
