import React, { InputHTMLAttributes, forwardRef } from 'react';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
    label?: string;
    description?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
    ({ label, description, className = '', disabled, ...props }, ref) => {
        return (
            <label className={`inline-flex items-start gap-2.5 cursor-pointer select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <input
                    ref={ref}
                    type="checkbox"
                    disabled={disabled}
                    className={`mt-0.5 h-4 w-4 rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] accent-[color:var(--primary)] focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 transition-colors cursor-pointer ${className}`}
                    {...props}
                />
                {(label || description) && (
                    <div className="text-[14px]">
                        {label && <span className="font-medium text-[color:var(--text)]">{label}</span>}
                        {description && <p className="text-[12px] text-[color:var(--muted)] mt-0.5">{description}</p>}
                    </div>
                )}
            </label>
        );
    }
);

Checkbox.displayName = 'Checkbox';
