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
    const displayTotalPages = Math.max(5, totalPages);
    // Safe clamped page allowing selection of tabs 1..5
    const safeCurrentPage = Math.min(Math.max(1, currentPage), displayTotalPages);

    const hasItemsOnPage = safeCurrentPage <= totalPages && totalItems > 0;
    const startIndex = !hasItemsOnPage ? 0 : (safeCurrentPage - 1) * pageSize + 1;
    const endIndex = !hasItemsOnPage ? 0 : Math.min(safeCurrentPage * pageSize, totalItems);

    // Generate page numbers ensuring at least tabs 1 2 3 4 5 are shown
    const getPageNumbers = (): (number | string)[] => {
        if (displayTotalPages <= 5) {
            return [1, 2, 3, 4, 5];
        }

        if (safeCurrentPage <= 5) {
            return [1, 2, 3, 4, 5, '...', displayTotalPages];
        } else if (safeCurrentPage >= displayTotalPages - 2) {
            return [1, '...', displayTotalPages - 4, displayTotalPages - 3, displayTotalPages - 2, displayTotalPages - 1, displayTotalPages];
        } else {
            return [1, '...', safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, '...', displayTotalPages];
        }
    };

    return (
        <div
            className={`flex flex-col items-center justify-center gap-3 px-4 py-4 text-[13px] text-[color:var(--muted)] text-center w-full mx-auto ${className}`}
        >
            {/* Centered Pagination Tabs 1 2 3 4 5 */}
            <div className="inline-flex items-center justify-center p-1 rounded-[10px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] gap-1 shadow-2xs">
                <button
                    type="button"
                    onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
                    disabled={safeCurrentPage <= 1}
                    className="p-2 rounded-[8px] text-[color:var(--text)] hover:bg-[color:var(--card)] disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 transition-colors cursor-pointer"
                    aria-label="Previous page"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center justify-center gap-1">
                    {getPageNumbers().map((p, idx) => {
                        if (typeof p === 'string') {
                            return (
                                <span key={`ellipsis-${idx}`} className="px-2 text-[color:var(--muted)] select-none">
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
                                className={`min-w-[36px] h-[34px] px-3 rounded-[7px] text-[13px] font-semibold tabular-nums transition-all cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 ${
                                    isActive
                                        ? 'bg-[color:var(--primary)] text-white shadow-xs font-bold'
                                        : 'text-[color:var(--text)] hover:bg-[color:var(--card)]'
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
                    disabled={safeCurrentPage >= displayTotalPages}
                    className="p-2 rounded-[8px] text-[color:var(--text)] hover:bg-[color:var(--card)] disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 transition-colors cursor-pointer"
                    aria-label="Next page"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            {/* Centered Range summary & page size selector */}
            <div className="flex items-center justify-center gap-3 flex-wrap text-[12px]">
                <span className="tabular-nums">
                    {totalItems === 0 || !hasItemsOnPage ? (
                        <>Showing 0 of {totalItems} {itemLabel}</>
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
        </div>
    );
};
