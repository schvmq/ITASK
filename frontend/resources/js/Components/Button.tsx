import React, { forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'motion/react';
import { ButtonVariant, ButtonSize } from '@/types';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    children?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
    primary:
        'bg-[color:var(--primary-btn)] hover:opacity-90 text-white font-semibold border border-transparent',
    secondary:
        'bg-[color:var(--soft-surface)] hover:bg-[color:color-mix(in_srgb,var(--text)_9%,var(--background))] text-[color:var(--text)] border border-[color:var(--border)] font-medium',
    outline:
        'bg-transparent hover:bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)] font-medium',
    danger:
        'bg-[color:var(--primary)] hover:opacity-90 text-white font-semibold border border-transparent',
    ghost:
        'bg-transparent hover:bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-transparent font-medium',
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
            whileHover,
            whileTap,
            ...props
        },
        ref
    ) => {
        const isDisabled = disabled || isLoading;

        const defaultHover = !isDisabled
            ? variant === 'primary'
                ? { scale: 1.02 }
                : { scale: 1.01 }
            : undefined;

        const defaultTap = !isDisabled ? { scale: 0.98 } : undefined;

        return (
            <motion.button
                ref={ref}
                disabled={isDisabled}
                whileHover={whileHover !== undefined ? whileHover : defaultHover}
                whileTap={whileTap !== undefined ? whileTap : defaultTap}
                transition={{ type: 'spring', damping: 20, stiffness: 400 }}
                className={`inline-flex items-center justify-center transition-colors duration-150 select-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
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
            </motion.button>
        );
    }
);

Button.displayName = 'Button';
