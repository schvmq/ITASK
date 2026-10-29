import React from 'react';
import { motion } from 'framer-motion';
import { getProgressBarGradient, type ProgressBarStyles } from '@/lib/progress';

export interface StatusProgressBarProps {
    progress: number;
    isCompleted?: boolean;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    showBadge?: boolean;
    animated?: boolean;
    className?: string;
    ariaLabel?: string;
}

const SIZE_MAP = {
    xs: 'h-1.5 p-0',
    sm: 'h-2 p-[0.5px]',
    md: 'h-2.5 p-[1px]',
    lg: 'h-3 p-[1px]',
};

export const StatusProgressBar: React.FC<StatusProgressBarProps> = ({
    progress,
    isCompleted = false,
    size = 'md',
    showLabel = false,
    showBadge = false,
    animated = true,
    className = '',
    ariaLabel = 'Progress',
}) => {
    const rawVal = Math.round(Number(progress) || 0);
    const clampedProgress = Math.max(0, Math.min(100, rawVal));
    const effectiveDone = isCompleted || clampedProgress >= 100;
    const styles: ProgressBarStyles = getProgressBarGradient(clampedProgress, effectiveDone);

    const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;

    return (
        <div className={`space-y-1.5 w-full ${className}`}>
            {(showLabel || showBadge) && (
                <div className="flex items-center justify-between text-xs">
                    {showLabel && (
                        <span className="font-semibold text-[color:var(--muted)]">
                            {effectiveDone ? 'Complete' : `${clampedProgress}% Finished`}
                        </span>
                    )}
                    {showBadge && (
                        <span
                            className={`px-2 py-0.5 rounded-full font-bold tabular-nums text-[10px] border shadow-2xs ${styles.badgeBg} ${styles.badgeText} ${styles.badgeBorder}`}
                        >
                            {clampedProgress}%
                        </span>
                    )}
                </div>
            )}

            <div
                className={`w-full rounded-full bg-[color:var(--soft-surface)] border border-[color:var(--border)] overflow-hidden shadow-inner ${sizeClass}`}
            >
                {animated ? (
                    <motion.div
                        className={`h-full rounded-full transition-all ${styles.barGradient} ${styles.shadow}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${clampedProgress > 0 ? Math.max(3, clampedProgress) : 0}%` }}
                        transition={{ type: 'spring', stiffness: 220, damping: 26 }}
                        role="progressbar"
                        aria-valuenow={clampedProgress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={ariaLabel}
                    />
                ) : (
                    <div
                        className={`h-full rounded-full transition-all duration-300 ${styles.barGradient} ${styles.shadow}`}
                        style={{ width: `${clampedProgress > 0 ? Math.max(3, clampedProgress) : 0}%` }}
                        role="progressbar"
                        aria-valuenow={clampedProgress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={ariaLabel}
                    />
                )}
            </div>
        </div>
    );
};
