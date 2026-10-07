import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
    currentPage: number;
    totalItems: number;
    totalPages?: number;
    pageSize: number;
    onPageChange: (newPage: number) => void;
    onPageSizeChange?: (newSize: number) => void;
    pageSizeOptions?: number[];
    className?: string;
    itemLabel?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
    currentPage,
    totalItems,
    totalPages: propTotalPages,
    pageSize,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = [5, 10, 25],
    className = '',
    itemLabel = 'items',
}) => {
    const totalPages = propTotalPages ?? Math.max(1, Math.ceil(totalItems / pageSize));
    // Safe clamped page
    const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

    const startIndex = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
    const endIndex = Math.min(safeCurrentPage * pageSize, totalItems);

    // Generate page numbers with ellipsis
    const getPageNumbers = (): (number | string)[] => {
        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }

        const pages: (number | string)[] = [1];
        const start = Math.max(2, safeCurrentPage - 1);
        const end = Math.min(totalPages - 1, safeCurrentPage + 1);

        if (start > 2) {
            pages.push('...');
        }

        for (let i = start; i <= end; i++) {
            pages.push(i);
        }

        if (end < totalPages - 1) {
            pages.push('...');
        }

        pages.push(totalPages);
        return pages;
    };

    return (
        <div
            className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-[color:var(--border)] text-[13px] text-[color:var(--muted)] ${className}`}
        >
            {/* Range summary & page size selector */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                <span className="tabular-nums">
                    {totalItems === 0 ? (
                        <>Showing 0 of 0 {itemLabel}</>
                    ) : (
                        <>
                            Showing <span className="font-semibold text-[color:var(--text)]">{startIndex}</span> to{' '}
                            <span className="font-semibold text-[color:var(--text)]">{endIndex}</span> of{' '}
                            <span className="font-semibold text-[color:var(--text)]">{totalItems}</span> {itemLabel}
                        </>
                    )}
                </span>

                {onPageSizeChange && (
                    <div className="flex items-center gap-1.5 pl-2 border-l border-[color:var(--border)]">
                        <label htmlFor="pagination-page-size" className="text-[12px] text-[color:var(--muted)] shrink-0">
                            Per page:
                        </label>
                        <select
                            id="pagination-page-size"
                            value={pageSize}
                            onChange={(e) => {
                                const newSize = Number(e.target.value);
                                onPageSizeChange(newSize);
                            }}
                            className="bg-[color:var(--card)] text-[color:var(--text)] border border-[color:var(--border)] rounded-[6px] px-2 py-1 text-[12px] tabular-nums focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 cursor-pointer"
                        >
                            {pageSizeOptions.map((opt) => (
                                <option key={opt} value={opt}>
                                    {opt}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1 w-full sm:w-auto justify-center sm:justify-end">
                <button
                    type="button"
                    onClick={() => onPageChange(safeCurrentPage - 1)}
                    disabled={safeCurrentPage <= 1 || totalItems === 0}
                    className="p-1.5 rounded-[6px] border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 transition-colors cursor-pointer"
                    aria-label="Previous page"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1">
                    {getPageNumbers().map((p, idx) => {
                        if (typeof p === 'string') {
                            return (
                                <span key={`ellipsis-${idx}`} className="px-1.5 text-[color:var(--muted)]">
                                    …
                                </span>
                            );
                        }

                        const isActive = p === safeCurrentPage;
                        return (
                            <button
                                key={`page-${p}`}
                                type="button"
                                onClick={() => onPageChange(p)}
                                disabled={isActive}
                                className={`min-w-[32px] h-[32px] px-2 rounded-[6px] text-[13px] font-medium tabular-nums transition-colors cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 ${
                                    isActive
                                        ? 'bg-[color:var(--primary-btn)] text-white font-semibold border border-transparent shadow-none'
                                        : 'bg-[color:var(--card)] text-[color:var(--text)] border border-[color:var(--border)] hover:bg-[color:var(--soft-surface)]'
                                }`}
                                aria-current={isActive ? 'page' : undefined}
                                aria-label={`Page ${p}`}
                            >
                                {p}
                            </button>
                        );
                    })}
                </div>

                <button
                    type="button"
                    onClick={() => onPageChange(safeCurrentPage + 1)}
                    disabled={safeCurrentPage >= totalPages || totalItems === 0}
                    className="p-1.5 rounded-[6px] border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 transition-colors cursor-pointer"
                    aria-label="Next page"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
