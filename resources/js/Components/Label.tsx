import React, { LabelHTMLAttributes } from 'react';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
    required?: boolean;
}

export const Label: React.FC<LabelProps> = ({
    required = false,
    children,
    className = '',
    ...props
}) => {
    return (
        <label
            className={`block text-xs font-semibold uppercase tracking-wider text-slate-700 select-none mb-1.5 ${className}`}
            {...props}
        >
            {children}
            {required && <span className="text-rose-500 ml-1 font-bold">*</span>}
        </label>
    );
};
