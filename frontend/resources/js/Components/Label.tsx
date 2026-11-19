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
            className={`block text-[13px] font-medium text-[color:var(--text)] select-none mb-1 ${className}`}
            {...props}
        >
            {children}
            {required && <span className="text-[color:var(--primary)] ml-1 font-semibold">*</span>}
        </label>
    );
};
