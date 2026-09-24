import React from 'react';

export interface InputErrorProps {
    message?: string;
    className?: string;
}

export const InputError: React.FC<InputErrorProps> = ({ message, className = '' }) => {
    if (!message) return null;

    return (
        <div className={`flex items-center gap-1.5 mt-1.5 text-xs text-rose-600 font-medium ${className}`}>
            <svg
                className="w-3.5 h-3.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 7.5h.008v.008H12v-.008Z"
                />
            </svg>
            <span>{message}</span>
        </div>
    );
};
