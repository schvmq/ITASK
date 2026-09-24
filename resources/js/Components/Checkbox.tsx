import React, { InputHTMLAttributes, forwardRef } from 'react';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
    label?: string;
    description?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
    ({ label, description, className = '', disabled, ...props }, ref) => {
        return (
            <label className={`inline-flex items-start gap-2.5 cursor-pointer select-none ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
                <input
                    ref={ref}
                    type="checkbox"
                    disabled={disabled}
                    className={`mt-0.5 h-4 w-4 rounded-sm border-slate-300 text-[#F68233] focus:ring-[#F68233]/30 focus:ring-2 focus:ring-offset-0 transition duration-150 cursor-pointer ${className}`}
                    {...props}
                />
                {(label || description) && (
                    <div className="text-xs">
                        {label && <span className="font-medium text-slate-700">{label}</span>}
                        {description && <p className="text-slate-500 mt-0.5">{description}</p>}
                    </div>
                )}
            </label>
        );
    }
);

Checkbox.displayName = 'Checkbox';
