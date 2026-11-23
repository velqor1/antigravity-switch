import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems: number;
    itemsPerPage: number;
    onPageSizeChange?: (pageSize: number) => void;
    pageSizeOptions?: number[];
}

function Pagination({
    currentPage,
    totalPages,
    onPageChange,
    totalItems,
    itemsPerPage,
    onPageSizeChange,
    pageSizeOptions = [10, 20, 50, 100]
}: PaginationProps) {
    const { t } = useTranslation();

    if (totalPages <= 1 && !onPageSizeChange) return null;

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);

    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    const pages = [];
    for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
    }

    const startIndex = (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

    return (
        <div className="flex items-center justify-between px-4 py-2">
            {/* Mobile View */}
            <div className="flex flex-1 justify-between sm:hidden">
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`relative inline-flex items-center rounded-lg border border-zinc-200 dark:border-white/[0.1] px-4 py-1.5 text-xs font-medium ${currentPage === 1
                        ? 'bg-zinc-100 dark:bg-white/[0.03] text-zinc-400 cursor-not-allowed'
                        : 'bg-white dark:bg-[#141417] text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.08]'
                        }`}
                >
                    {t('common.prev_page')}
                </button>
                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`relative ml-3 inline-flex items-center rounded-lg border border-zinc-200 dark:border-white/[0.1] px-4 py-1.5 text-xs font-medium ${currentPage === totalPages
                        ? 'bg-zinc-100 dark:bg-white/[0.03] text-zinc-400 cursor-not-allowed'
                        : 'bg-white dark:bg-[#141417] text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.08]'
                        }`}
                >
                    {t('common.next_page')}
                </button>
            </div>

            {/* Desktop View */}
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
                        {t('common.pagination_info', { start: startIndex, end: endIndex, total: totalItems })}
                    </p>

                    {onPageSizeChange && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">{t('common.per_page')}</span>
                            <select
                                value={itemsPerPage}
                                onChange={(e) => onPageSizeChange(parseInt(e.target.value))}
                                className="px-2 py-1 text-xs border border-zinc-200 dark:border-white/[0.1] rounded-lg bg-white dark:bg-[#141417] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400/50 dark:focus:ring-white/20"
                            >
                                {pageSizeOptions.map(size => (
                                    <option key={size} value={size}>{size} {t('common.items')}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
                <div>
                    <nav className="isolate inline-flex items-center gap-1" aria-label="Pagination">
                        <button
                            onClick={() => onPageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className={`inline-flex items-center justify-center rounded-lg p-1.5 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#141417] hover:bg-zinc-100 dark:hover:bg-white/[0.08] transition-colors ${currentPage === 1 ? 'cursor-not-allowed opacity-40' : ''}`}
                        >
                            <span className="sr-only">{t('common.prev_page')}</span>
                            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                        </button>

                        {startPage > 1 && (
                            <>
                                <button
                                    onClick={() => onPageChange(1)}
                                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/[0.08] hover:bg-zinc-100 dark:hover:bg-white/[0.08]"
                                >
                                    1
                                </button>
                                {startPage > 2 && (
                                    <span className="px-2 text-xs text-zinc-400">...</span>
                                )}
                            </>
                        )}

                        {pages.map(page => (
                            <button
                                key={page}
                                onClick={() => onPageChange(page)}
                                aria-current={page === currentPage ? 'page' : undefined}
                                className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors ${page === currentPage
                                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-xs'
                                    : 'text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#141417] hover:bg-zinc-100 dark:hover:bg-white/[0.08]'
                                    }`}
                            >
                                {page}
                            </button>
                        ))}

                        {endPage < totalPages && (
                            <>
                                {endPage < totalPages - 1 && (
                                    <span className="px-2 text-xs text-zinc-400">...</span>
                                )}
                                <button
                                    onClick={() => onPageChange(totalPages)}
                                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/[0.08] hover:bg-zinc-100 dark:hover:bg-white/[0.08]"
                                >
                                    {totalPages}
                                </button>
                            </>
                        )}

                        <button
                            onClick={() => onPageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className={`inline-flex items-center justify-center rounded-lg p-1.5 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#141417] hover:bg-zinc-100 dark:hover:bg-white/[0.08] transition-colors ${currentPage === totalPages ? 'cursor-not-allowed opacity-40' : ''}`}
                        >
                            <span className="sr-only">{t('common.next_page')}</span>
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </nav>
                </div>
            </div>
        </div>
    );
}

export default Pagination;
