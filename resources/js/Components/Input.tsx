import React, { InputHTMLAttributes, forwardRef } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    hasError?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ hasError = false, className = '', type = 'text', disabled, ...props }, ref) => {
        return (
            <input
                ref={ref}
                type={type}
                disabled={disabled}
                className={`w-full px-3.5 py-2 text-[14px] text-[color:var(--text)] bg-[color:var(--card)] rounded-[8px] border transition-colors duration-150 placeholder:text-[color:var(--muted)] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 ${
                    hasError
                        ? 'border-[color:var(--primary)]'
                        : 'border-[color:var(--border)] hover:border-[color:color-mix(in_srgb,var(--text)_25%,var(--background))]'
                } ${className}`}
                {...props}
            />
        );
    }
);

Input.displayName = 'Input';
