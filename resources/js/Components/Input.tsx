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
                className={`w-full px-3.5 py-2 text-sm text-slate-900 bg-white rounded-lg border transition-all duration-150 placeholder:text-slate-400 focus:outline-hidden disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed ${
                    hasError
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                        : 'border-slate-300 hover:border-slate-400 focus:border-[#F68233] focus:ring-2 focus:ring-[#F68233]/20'
                } ${className}`}
                {...props}
            />
        );
    }
);

Input.displayName = 'Input';
