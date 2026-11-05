import React, { useMemo, useState } from "react";
import UserDashboardLayout from "../../layouts/UserDashboardLayout";

const ITEMS_PER_PAGE = 3;

function PaymentHistory() {
    const [payments] = useState([
        {
            id: "PAY-1024",
            orderId: "ORD-2024",
            date: "2026-10-05",
            method: "Credit Card",
            transactionId: "TXN987654321",
            amount: 4999,
            status: "Successful",
        },
        {
            id: "PAY-1023",
            orderId: "ORD-2023",
            date: "2026-09-28",
            method: "UPI",
            transactionId: "TXN987654322",
            amount: 5999,
            status: "Successful",
        },
        {
            id: "PAY-1022",
            orderId: "ORD-2022",
            date: "2026-09-20",
            method: "Net Banking",
            transactionId: "TXN987654323",
            amount: 2499,
            status: "Pending",
        },
        {
            id: "PAY-1021",
            orderId: "ORD-2021",
            date: "2026-09-15",
            method: "UPI",
            transactionId: "TXN987654324",
            amount: 1599,
            status: "Failed",
        },
    ]);

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedPayment, setSelectedPayment] = useState(null);

    // Format currency
    const formatPrice = (price) => {
        return `₹${Number(price || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    };

    // Format date
    const formatDate = (date) => {
        return new Date(date).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    // Payment Summary
    const summary = [
        {
            title: "Total Payments",
            value: payments.length,
            icon: "fa-solid fa-wallet",
            bg: "bg-aqua-spring",
            color: "text-ocean-green",
        },
        {
            title: "Successful",
            value: payments.filter(
                (payment) => payment.status === "Successful"
            ).length,
            icon: "fa-solid fa-circle-check",
            bg: "bg-green-50",
            color: "text-green-600",
        },
        {
            title: "Pending",
            value: payments.filter(
                (payment) => payment.status === "Pending"
            ).length,
            icon: "fa-solid fa-clock",
            bg: "bg-yellow-50",
            color: "text-yellow-600",
        },
        {
            title: "Failed",
            value: payments.filter(
                (payment) => payment.status === "Failed"
            ).length,
            icon: "fa-solid fa-circle-xmark",
            bg: "bg-red-50",
            color: "text-red-600",
        },
    ];

    // Filter Payments
    const filteredPayments = useMemo(() => {
        return payments.filter((payment) => {
            const searchValue = search.toLowerCase();

            const matchesSearch =
                payment.id.toLowerCase().includes(searchValue) ||
                payment.orderId.toLowerCase().includes(searchValue) ||
                payment.transactionId.toLowerCase().includes(searchValue);

            const matchesStatus =
                statusFilter === "All" ||
                payment.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [payments, search, statusFilter]);

    const totalPages = Math.max(
        1,
        Math.ceil(filteredPayments.length / ITEMS_PER_PAGE)
    );
    const safePage = Math.min(currentPage, totalPages);
    const paginatedPayments = filteredPayments.slice(
        (safePage - 1) * ITEMS_PER_PAGE,
        safePage * ITEMS_PER_PAGE
    );
    const firstVisiblePayment =
        filteredPayments.length === 0
            ? 0
            : (safePage - 1) * ITEMS_PER_PAGE + 1;
    const lastVisiblePayment = Math.min(
        safePage * ITEMS_PER_PAGE,
        filteredPayments.length
    );

    // Status styles
    const getStatusStyle = (status) => {
        switch (status) {
            case "Successful":
                return "bg-green-50 text-green-700";

            case "Pending":
                return "bg-yellow-50 text-yellow-700";

            case "Failed":
                return "bg-red-50 text-red-600";

            default:
                return "bg-gray-100 text-gray-600";
        }
    };

    // Payment method icon
    const getMethodIcon = (method) => {
        if (method.toLowerCase().includes("card")) {
            return "fa-solid fa-credit-card";
        }

        if (method.toLowerCase().includes("upi")) {
            return "fa-solid fa-mobile-screen-button";
        }

        if (method.toLowerCase().includes("bank")) {
            return "fa-solid fa-building-columns";
        }

        return "fa-solid fa-wallet";
    };

    return (
        <UserDashboardLayout>
            <div className="min-h-full bg-gray-50 p-4 sm:p-6 lg:p-8">

                {/* PAGE HEADER */}
                <div className="mb-6">
                    <p className="text-xs font-bold uppercase tracking-[2px] text-ocean-green">
                        Account Summary
                    </p>

                    <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-cyprus sm:text-3xl">
                                Payment History
                            </h1>

                            <p className="mt-1 text-sm text-text-grey">
                                View and manage all your payment transactions.
                            </p>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-text-grey">
                            <i className="fa-solid fa-shield-halved text-ocean-green" />
                            Secure Payments
                        </div>
                    </div>
                </div>

                {/* SUMMARY CARDS */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
                    {summary.map((item) => (
                        <div
                            key={item.title}
                            className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md sm:p-5"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div
                                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.bg} ${item.color}`}
                                >
                                    <i className={item.icon} />
                                </div>

                                <span className="text-2xl font-bold text-cyprus">
                                    {item.value}
                                </span>
                            </div>

                            <p className="mt-4 text-xs font-medium text-text-grey sm:text-sm">
                                {item.title}
                            </p>
                        </div>
                    ))}
                </div>

                {/* PAYMENT HISTORY */}
                <section className="mt-8">

                    {/* SECTION HEADER */}
                    <div className="mb-4">
                        <h2 className="text-lg font-bold text-cyprus sm:text-xl">
                            All Transactions
                        </h2>

                        <p className="mt-1 text-sm text-text-grey">
                            Your complete payment transaction history.
                        </p>
                    </div>

                    {/* SEARCH AND FILTER */}
                    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">

                        <div className="relative w-full sm:max-w-md">
                            <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />

                            <input
                                type="text"
                                placeholder="Search transaction or order ID..."
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-ocean-green focus:bg-white"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <i className="fa-solid fa-filter text-ocean-green" />

                            <select
                                value={statusFilter}
                                onChange={(e) => {
                                    setStatusFilter(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-cyprus outline-none focus:border-ocean-green sm:w-auto"
                            >
                                <option value="All">All Payments</option>
                                <option value="Successful">Successful</option>
                                <option value="Pending">Pending</option>
                                <option value="Failed">Failed</option>
                            </select>
                        </div>
                    </div>

                    {/* TABLE */}
                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">

                        {/* TABLE HEADER */}
                        <div className="hidden grid-cols-6 gap-4 bg-aqua-spring px-5 py-4 text-xs font-bold uppercase tracking-wide text-cyprus lg:grid">
                            <span>Payment ID</span>
                            <span>Order ID</span>
                            <span>Date</span>
                            <span>Method</span>
                            <span>Amount</span>
                            <span>Status</span>
                        </div>

                        {/* TABLE BODY */}
                        {filteredPayments.length > 0 ? (
                            paginatedPayments.map((payment) => (
                                <div
                                    key={payment.id}
                                    className="grid grid-cols-2 gap-4 border-t border-gray-100 px-4 py-5 first:border-t-0 sm:grid-cols-3 lg:grid-cols-6 lg:items-center lg:px-5"
                                >
                                    {/* PAYMENT ID */}
                                    <div className="min-w-0">
                                        <p className="mb-1 text-[10px] text-text-grey lg:hidden">
                                            Payment ID
                                        </p>

                                        <p className="break-all text-xs font-bold text-cyprus">
                                            {payment.id}
                                        </p>
                                    </div>

                                    {/* ORDER ID */}
                                    <div>
                                        <p className="mb-1 text-[10px] text-text-grey lg:hidden">
                                            Order ID
                                        </p>

                                        <p className="text-xs font-medium text-ocean-green">
                                            {payment.orderId}
                                        </p>
                                    </div>

                                    {/* DATE */}
                                    <div>
                                        <p className="mb-1 text-[10px] text-text-grey lg:hidden">
                                            Date
                                        </p>

                                        <p className="text-xs text-text-grey">
                                            {formatDate(payment.date)}
                                        </p>
                                    </div>

                                    {/* METHOD */}
                                    <div>
                                        <p className="mb-1 text-[10px] text-text-grey lg:hidden">
                                            Payment Method
                                        </p>

                                        <div className="flex items-center gap-2">
                                            <i
                                                className={`${getMethodIcon(
                                                    payment.method
                                                )} text-ocean-green`}
                                            />

                                            <span className="text-xs font-medium text-cyprus">
                                                {payment.method}
                                            </span>
                                        </div>
                                    </div>

                                    {/* AMOUNT */}
                                    <div>
                                        <p className="mb-1 text-[10px] text-text-grey lg:hidden">
                                            Amount
                                        </p>

                                        <p className="text-sm font-bold text-cyprus">
                                            {formatPrice(payment.amount)}
                                        </p>
                                    </div>

                                    {/* STATUS + DETAILS */}
                                    <div>
                                        <p className="mb-1 text-[10px] text-text-grey lg:hidden">
                                            Status
                                        </p>

                                        <div className="flex flex-wrap items-center gap-2">
                                            <span
                                                className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold ${getStatusStyle(
                                                    payment.status
                                                )}`}
                                            >
                                                {payment.status}
                                            </span>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setSelectedPayment(payment)
                                                }
                                                className="text-xs font-bold text-ocean-green transition hover:text-cyprus"
                                                title="View Payment Details"
                                            >
                                                <i className="fa-solid fa-eye" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="px-4 py-12 text-center">
                                <i className="fa-solid fa-receipt text-4xl text-gray-300" />

                                <h3 className="mt-4 text-base font-bold text-cyprus">
                                    No Payments Found
                                </h3>

                                <p className="mt-1 text-sm text-text-grey">
                                    Try changing your search or payment filter.
                                </p>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearch("");
                                        setStatusFilter("All");
                                        setCurrentPage(1);
                                    }}
                                    className="mt-4 rounded-full bg-ocean-green px-5 py-2 text-xs font-bold text-white transition hover:bg-cyprus"
                                >
                                    Clear Filters
                                </button>
                            </div>
                        )}
                    </div>

                    {/* RESULT COUNT */}
                    <div className="mt-3 flex flex-col items-center justify-between gap-3 sm:flex-row">
                        <p className="text-xs text-text-grey">
                            Showing {firstVisiblePayment}-{lastVisiblePayment} of{" "}
                            {filteredPayments.length} filtered transactions
                            {" "}({payments.length} total)
                        </p>

                        {totalPages > 1 && (
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-text-grey">
                                    Page {safePage} of {totalPages}
                                </span>

                                <button
                                    type="button"
                                    disabled={safePage <= 1}
                                    onClick={() =>
                                        setCurrentPage((page) =>
                                            Math.max(1, page - 1)
                                        )
                                    }
                                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-cyprus transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <i className="fa-solid fa-arrow-left" />
                                    Previous
                                </button>

                                <button
                                    type="button"
                                    disabled={safePage >= totalPages}
                                    onClick={() =>
                                        setCurrentPage((page) =>
                                            Math.min(totalPages, page + 1)
                                        )
                                    }
                                    className="inline-flex items-center gap-2 rounded-xl bg-ocean-green px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Next
                                    <i className="fa-solid fa-arrow-right" />
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                {/* PAYMENT DETAILS MODAL */}
                {selectedPayment && (
                    <div
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
                        onClick={() => setSelectedPayment(null)}
                    >
                        <div
                            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between bg-cyprus px-5 py-4">
                                <h2 className="text-lg font-bold text-white">
                                    Payment Details
                                </h2>

                                <button
                                    type="button"
                                    onClick={() => setSelectedPayment(null)}
                                    className="text-white transition hover:text-surf-crest"
                                >
                                    <i className="fa-solid fa-xmark text-xl" />
                                </button>
                            </div>

                            <div className="p-5">
                                <div className="mb-5 text-center">
                                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-aqua-spring text-2xl text-ocean-green">
                                        <i className="fa-solid fa-receipt" />
                                    </div>

                                    <h3 className="mt-3 text-2xl font-bold text-cyprus">
                                        {formatPrice(selectedPayment.amount)}
                                    </h3>

                                    <span
                                        className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold ${getStatusStyle(
                                            selectedPayment.status
                                        )}`}
                                    >
                                        {selectedPayment.status}
                                    </span>
                                </div>

                                <div className="space-y-4 border-t border-gray-100 pt-4">
                                    {[
                                        ["Payment ID", selectedPayment.id],
                                        ["Order ID", selectedPayment.orderId],
                                        ["Transaction ID", selectedPayment.transactionId],
                                        ["Payment Date", formatDate(selectedPayment.date)],
                                        ["Payment Method", selectedPayment.method],
                                    ].map(([label, value]) => (
                                        <div
                                            key={label}
                                            className="flex items-start justify-between gap-4"
                                        >
                                            <span className="text-xs text-text-grey">
                                                {label}
                                            </span>

                                            <span className="break-all text-right text-xs font-bold text-cyprus">
                                                {value}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setSelectedPayment(null)}
                                    className="mt-6 w-full rounded-xl bg-ocean-green py-3 text-sm font-bold text-white transition hover:bg-cyprus"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </UserDashboardLayout>
    );
}

export default PaymentHistory;