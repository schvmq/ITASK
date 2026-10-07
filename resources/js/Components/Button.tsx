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
    // Primary: main action button using accessible --primary-btn with white text (WCAG AA > 4.5:1)
    primary:
        'bg-[color:var(--primary-btn)] hover:opacity-90 active:scale-[0.99] text-white font-semibold border border-transparent',
    secondary:
        'bg-[color:var(--soft-surface)] hover:bg-[color:color-mix(in_srgb,var(--text)_9%,var(--background))] active:scale-[0.99] text-[color:var(--text)] border border-[color:var(--border)] font-medium',
    outline:
        'bg-transparent hover:bg-[color:var(--soft-surface)] active:scale-[0.99] text-[color:var(--text)] border border-[color:var(--border)] font-medium',
    danger:
        'bg-[color:var(--primary)] hover:opacity-90 active:scale-[0.99] text-white font-semibold border border-transparent',
    ghost:
        'bg-transparent hover:bg-[color:var(--soft-surface)] active:scale-[0.99] text-[color:var(--text)] border border-transparent font-medium',
};

const sizeStyles: Record<ButtonSize, string> = {
    sm: 'text-xs px-2.5 py-1.5 rounded-lg gap-1.5',
    md: 'text-[14px] px-3.5 py-2 rounded-lg gap-2',
    lg: 'text-[15px] px-4.5 py-2.5 rounded-lg gap-2.5',
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
                className={`inline-flex items-center justify-center transition-all duration-150 select-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
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
                    leftIcon && <span className="inline-flex shrink-0 items-center justify-center">{leftIcon}</span>
                )}
                {typeof children === 'string' ? <span>{children}</span> : children}
                {!isLoading && rightIcon && (
                    <span className="inline-flex shrink-0 items-center justify-center">{rightIcon}</span>
                )}
            </button>
        );
    }
);

Button.displayName = 'Button';
