import React, { useEffect, useState } from 'react';

interface NumberCounterProps {
    value: number;
    durationMs?: number;
    className?: string;
    suffix?: string;
}

export function NumberCounter({
    value,
    durationMs = 600,
    className = '',
    suffix = '',
}: NumberCounterProps) {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        // If reduced motion is preferred, jump directly to target value
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (mediaQuery.matches) {
            setDisplayValue(value);
            return;
        }

        let startTimestamp: number | null = null;
        let animationFrameId: number;

        const startValue = 0;
        const targetValue = value;

        const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / durationMs, 1);
            // Ease out cubic: 1 - Math.pow(1 - progress, 3)
            const easeOutCubic = 1 - Math.pow(1 - progress, 3);
            const current = Math.floor(startValue + (targetValue - startValue) * easeOutCubic);
            setDisplayValue(current);

            if (progress < 1) {
                animationFrameId = window.requestAnimationFrame(step);
            } else {
                setDisplayValue(targetValue);
            }
        };

        animationFrameId = window.requestAnimationFrame(step);

        return () => {
            window.cancelAnimationFrame(animationFrameId);
        };
    }, [value, durationMs]);

    return (
        <span className={className}>
            {displayValue}
            {suffix}
        </span>
    );
}
