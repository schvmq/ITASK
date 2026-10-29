import * as React from 'react';
import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            data-slot="skeleton"
            className={cn('skeleton-shimmer bg-[color:var(--soft-surface)] rounded-[6px]', className)}
            {...props}
        />
    );
}

export { Skeleton };
