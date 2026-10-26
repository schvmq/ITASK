import React from 'react';

export interface SpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const spinnerSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
};

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className = '' }) => {
    return (
        <svg
            className={`animate-spin text-[#F68233] ${spinnerSizes[size]} ${className}`}
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
    );
};

export interface LoadingOverlayProps {
    message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message = 'Loading...' }) => {
    return (
        <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex flex-col items-center justify-center z-20 rounded-xl">
            <Spinner size="md" />
            <p className="text-xs font-medium text-slate-600 mt-2.5">{message}</p>
        </div>
    );
};

export interface PageLoaderProps {
    message?: string;
}

export const PageLoader: React.FC<PageLoaderProps> = ({ message = 'Loading workspace...' }) => {
    return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center p-8">
            <div className="p-3 bg-orange-50 rounded-2xl border border-orange-100 mb-3 shadow-xs">
                <Spinner size="lg" />
            </div>
            <p className="text-sm font-semibold text-slate-800">{message}</p>
            <p className="text-xs text-slate-400 mt-0.5">Please wait a moment</p>
        </div>
    );
};
