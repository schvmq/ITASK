import React from 'react';
import { AlertCircle } from 'lucide-react';

export interface InputErrorProps {
    message?: string;
    className?: string;
}

export const InputError: React.FC<InputErrorProps> = ({ message, className = '' }) => {
    if (!message) return null;

    return (
        <div className={`flex items-center gap-1.5 mt-1 text-[12px] text-[color:var(--primary)] font-medium ${className}`}>
            <AlertCircle className="w-3.5 h-3.5 shrink-0 stroke-[2px]" />
            <span>{message}</span>
        </div>
    );
};
