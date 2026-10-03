import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { ButtonVariant, ButtonSize } from '@/types';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
    // Accessibility: text on orange buttons is charcoal (#2A2A2A), not white, for readable contrast
    primary:
        'bg-[#EC7505] hover:bg-[#D96904] active:bg-[#C25D03] text-[#2A2A2A] font-bold shadow-xs border border-transparent',
    secondary:
        'bg-[var(--card)] hover:bg-[var(--tint-neutral)] active:opacity-90 text-[var(--ink)] shadow-xs border border-[var(--border)] font-semibold',
    outline:
        'bg-transparent hover:bg-[var(--tint-neutral)] text-[var(--ink)] border border-[var(--border)] shadow-xs font-semibold',
    danger:
        'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-xs border border-transparent font-semibold',
    ghost:
        'bg-transparent hover:bg-[var(--tint-neutral)] text-[var(--ink)] border border-transparent font-medium',
};

const sizeStyles: Record<ButtonSize, string> = {
    sm: 'text-xs px-3 py-1.5 rounded-lg gap-1.5',
    md: 'text-[14px] px-4 py-2 rounded-xl gap-2',
    lg: 'text-[15px] px-5 py-2.5 rounded-xl gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            variant = 'primary',
            size = 'md',
            isLoading = false,
            disabled = false,
            leftIcon,
            rightIcon,
            children,
            className = '',
            ...props
        },
        ref
    ) => {
        const isDisabled = disabled || isLoading;

        return (
            <button
                ref={ref}
                disabled={isDisabled}
                className={`inline-flex items-center justify-center transition-all duration-150 select-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
                {...props}
            >
                {isLoading ? (
                    <svg
                        className="animate-spin h-4 w-4 shrink-0 text-current"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                    </svg>
                ) : (
                    leftIcon
                )}
                <span>{children}</span>
                {!isLoading && rightIcon}
            </button>
        );
    }
);

Button.displayName = 'Button';
