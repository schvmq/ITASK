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
    primary:
        'bg-[#F68233] hover:bg-[#E06D1F] active:bg-[#C85E17] text-white shadow-xs focus-visible:ring-2 focus-visible:ring-[#F68233]/40 focus-visible:ring-offset-2 border border-transparent',
    secondary:
        'bg-[#003300] hover:bg-[#002600] active:bg-[#001A00] text-white shadow-xs focus-visible:ring-2 focus-visible:ring-[#003300]/40 focus-visible:ring-offset-2 border border-transparent',
    outline:
        'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 border border-slate-300 shadow-xs focus-visible:ring-2 focus-visible:ring-[#F68233]/30 focus-visible:ring-offset-1',
    danger:
        'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-xs focus-visible:ring-2 focus-visible:ring-rose-500/40 focus-visible:ring-offset-2 border border-transparent',
    ghost:
        'bg-transparent hover:bg-slate-100 active:bg-slate-200 text-slate-700 focus-visible:ring-2 focus-visible:ring-slate-300 border border-transparent',
};

const sizeStyles: Record<ButtonSize, string> = {
    sm: 'text-xs px-2.5 py-1.5 rounded-md gap-1.5 font-medium',
    md: 'text-sm px-4 py-2 rounded-lg gap-2 font-medium',
    lg: 'text-base px-5 py-2.5 rounded-lg gap-2.5 font-semibold',
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
                className={`inline-flex items-center justify-center transition-all duration-150 select-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none focus:outline-hidden ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
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
