import React from "react";

function ProductPagination({
    page,
    totalPages,
    totalItems,
    pageSize,
    itemLabel = "products",
    onPageChange,
}) {
    if (totalPages <= 1) return null;

    const firstPage = Math.max(1, Math.min(page - 2, totalPages - 4));
    const visiblePages = Array.from(
        { length: Math.min(5, totalPages) },
        (_, index) => firstPage + index
    );
    const firstItem = (page - 1) * pageSize + 1;
    const lastItem = Math.min(page * pageSize, totalItems);

    return (
        <nav
            aria-label={`${itemLabel} pagination`}
            className="flex flex-col items-center justify-between gap-3 border-t border-gray-100 bg-white p-4 sm:flex-row"
        >
            <p className="text-sm text-text-grey">
                Showing{" "}
                <span className="font-semibold text-cyprus">
                    {firstItem}-{lastItem}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-cyprus">
                    {totalItems}
                </span>{" "}
                {itemLabel}
            </p>

            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => onPageChange(page - 1)}
                    disabled={page === 1}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-cyprus transition hover:border-ocean-green hover:text-ocean-green disabled:cursor-not-allowed disabled:opacity-40"
                >
                    Previous
                </button>

                {visiblePages.map((pageNumber) => (
                    <button
                        key={pageNumber}
                        type="button"
                        onClick={() => onPageChange(pageNumber)}
                        aria-current={pageNumber === page ? "page" : undefined}
                        className={`h-9 min-w-9 rounded-lg px-2 text-sm font-semibold ${
                            pageNumber === page
                                ? "bg-ocean-green text-white"
                                : "border border-gray-200 text-cyprus hover:border-ocean-green hover:text-ocean-green"
                        }`}
                    >
                        {pageNumber}
                    </button>
                ))}

                <button
                    type="button"
                    onClick={() => onPageChange(page + 1)}
                    disabled={page === totalPages}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-cyprus transition hover:border-ocean-green hover:text-ocean-green disabled:cursor-not-allowed disabled:opacity-40"
                >
                    Next
                </button>
            </div>
        </nav>
    );
}

export default ProductPagination;
