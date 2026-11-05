import React, { useCallback, useEffect, useMemo, useState } from "react";
import Pagination from "../../../components/Pagination";

const API_BASE_URL = "http://192.168.1.20:5000/api";
const PAGE_SIZE = 10;

function Payments() {
    const [payments, setPayments] = useState([]);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [methodFilter, setMethodFilter] = useState("All");
    const [currentPage, setCurrentPage] = useState(1);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [actionError, setActionError] = useState("");
    const [confirmingId, setConfirmingId] = useState(null);

    const getToken = () =>
        localStorage.getItem("shopsphereToken") ||
        localStorage.getItem("shopsphereToken") ||
        localStorage.getItem("token");

    const getHeaders = () => {
        const token = getToken();

        if (!token) {
            throw new Error(
                "Authentication token not found. Please login again."
            );
        }

        return {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        };
    };

    // Fetch admin orders and display their payment information
    const fetchPayments = useCallback(async (showLoader = true) => {
        try {
            if (showLoader) {
                setLoading(true);
            } else {
                setRefreshing(true);
            }

            setError("");

            const response = await fetch(
                `${API_BASE_URL}/admin/orders`,
                {
                    method: "GET",
                    headers: getHeaders(),
                }
            );

            const result = await response.json().catch(() => ({}));

            if (!response.ok || result.success === false) {
                throw new Error(
                    result.message ||
                    `Unable to load orders (${response.status}).`
                );
            }

            const orders = Array.isArray(result.orders)
                ? result.orders
                : Array.isArray(result.data?.orders)
                ? result.data.orders
                : Array.isArray(result.data)
                ? result.data
                : null;

            if (!orders) {
                throw new Error(
                    "Invalid orders API response. Check the backend response format."
                );
            }

            const normalizedPayments = orders.map((order) => {
                const rawStatus = String(
                    order.payment_status ??
                    order.paymentStatus ??
                    "pending"
                ).toLowerCase().trim();

                let status = "Pending";

                if (
                    ["paid", "completed", "success", "successful"].includes(
                        rawStatus
                    )
                ) {
                    status = "Completed";
                } else if (
                    ["failed", "failure"].includes(rawStatus)
                ) {
                    status = "Failed";
                } else if (
                    ["refunded", "refund"].includes(rawStatus)
                ) {
                    status = "Refunded";
                } else if (
                    ["cancelled", "canceled"].includes(rawStatus)
                ) {
                    status = "Cancelled";
                }

                return {
                    id: order.order_id ?? order.id,
                    orderId:
                        order.order_number ??
                        order.order_id ??
                        "N/A",

                    transactionId:
                        order.transaction_id ??
                        order.payment_reference ??
                        order.transaction_reference ??
                        null,

                    customer:
                        order.customer_name ??
                        order.user_name ??
                        order.name ??
                        "N/A",

                    email: order.customer_email ?? "",

                    amount: Number(
                        order.total_amount ??
                        order.amount ??
                        0
                    ),

                    method:
                        order.payment_method ??
                        order.paymentMethod ??
                        order.method ??
                        "N/A",

                    date:
                        order.paid_at ??
                        order.payment_date ??
                        order.created_at ??
                        order.createdAt ??
                        null,

                    status,
                    rawStatus,
                };
            });

            setPayments(normalizedPayments);
        } catch (err) {
            setError(
                err.message || "Unable to load payment information."
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchPayments();
    }, [fetchPayments]);

    // Confirm payment using the backend endpoint
    const confirmPayment = async (payment) => {
        if (!payment.id) {
            setActionError("Order ID is missing.");
            return;
        }

        if (payment.status !== "Pending") {
            setActionError(
                "Only pending payments can be confirmed."
            );
            return;
        }

        const confirmed = window.confirm(
            `Confirm payment for order ${payment.orderId}?\n\n` +
            "Continue only after verifying that the payment was actually received."
        );

        if (!confirmed) return;

        try {
            setConfirmingId(payment.id);
            setActionError("");
            setError("");

            const response = await fetch(
                `${API_BASE_URL}/admin/orders/${payment.id}/payment-status`,
                {
                    method: "PATCH",
                    headers: getHeaders(),
                    body: JSON.stringify({}),
                }
            );

            const result = await response.json().catch(() => ({}));

            if (!response.ok || result.success === false) {
                throw new Error(
                    result.message ||
                    `Payment confirmation failed (${response.status}).`
                );
            }

            await fetchPayments(false);
        } catch (err) {
            setActionError(
                err.message || "Unable to confirm payment."
            );
        } finally {
            setConfirmingId(null);
        }
    };

    const formatAmount = (amount) =>
        `₹${Number(amount || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;

    const formatDate = (date) => {
        if (!date) return "N/A";

        const parsedDate = new Date(date);

        if (Number.isNaN(parsedDate.getTime())) {
            return "N/A";
        }

        return parsedDate.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    const completedPayments = payments.filter(
        (payment) => payment.status === "Completed"
    );

    const pendingPayments = payments.filter(
        (payment) => payment.status === "Pending"
    );

    const refundedPayments = payments.filter(
        (payment) => payment.status === "Refunded"
    );

    const totalRevenue = completedPayments.reduce(
        (total, payment) => total + payment.amount,
        0
    );

    const filteredPayments = useMemo(() => {
        const searchText = search.trim().toLowerCase();

        return payments.filter((payment) => {
            const matchesSearch = [
                payment.transactionId,
                payment.orderId,
                payment.customer,
                payment.email,
                payment.method,
            ].some((value) =>
                String(value ?? "")
                    .toLowerCase()
                    .includes(searchText)
            );

            const matchesStatus =
                statusFilter === "All" ||
                payment.status === statusFilter;

            const matchesMethod =
                methodFilter === "All" ||
                payment.method.toLowerCase() ===
                    methodFilter.toLowerCase();

            return (
                matchesSearch &&
                matchesStatus &&
                matchesMethod
            );
        });
    }, [payments, search, statusFilter, methodFilter]);
    const totalPages = Math.max(1, Math.ceil(filteredPayments.length / PAGE_SIZE));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const currentPayments = filteredPayments.slice(
        (safeCurrentPage - 1) * PAGE_SIZE,
        safeCurrentPage * PAGE_SIZE
    );

    const paymentMethods = [
        ...new Set(
            payments
                .map((payment) => payment.method)
                .filter((method) => method && method !== "N/A")
        ),
    ];

    const getStatusClass = (status) => {
        const classes = {
            Completed: "bg-green-100 text-green-700",
            Pending: "bg-yellow-100 text-yellow-700",
            Failed: "bg-red-100 text-red-700",
            Refunded: "bg-purple-100 text-purple-700",
            Cancelled: "bg-gray-100 text-gray-600",
        };

        return classes[status] || "bg-gray-100 text-gray-600";
    };

    const clearFilters = () => {
        setCurrentPage(1);
        setSearch("");
        setStatusFilter("All");
        setMethodFilter("All");
    };

    return (
        <div className="min-h-screen bg-aqua-spring p-4 sm:p-6 lg:p-8">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-cyprus sm:text-3xl">
                        Payments
                    </h1>

                    <p className="mt-1 text-sm text-text-grey">
                        Monitor transactions, payment statuses and refunds.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => fetchPayments(false)}
                    disabled={loading || refreshing}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-ocean-green px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <i
                        className={`fa-solid fa-rotate-right ${
                            refreshing ? "animate-spin" : ""
                        }`}
                    />

                    {refreshing ? "Refreshing..." : "Refresh"}
                </button>
            </div>

            {/* Fetch Error */}
            {error && (
                <div className="mb-6 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="font-semibold text-red-700">
                            Unable to load payments
                        </p>

                        <p className="mt-1 break-words text-sm text-red-600">
                            {error}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => fetchPayments()}
                        className="shrink-0 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                    >
                        Try Again
                    </button>
                </div>
            )}

            {/* Payment Action Error */}
            {actionError && (
                <div className="mb-6 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                    <p className="break-words text-sm text-red-700">
                        {actionError}
                    </p>

                    <button
                        type="button"
                        onClick={() => setActionError("")}
                        className="text-red-600"
                        aria-label="Dismiss error"
                    >
                        <i className="fa-solid fa-xmark" />
                    </button>
                </div>
            )}

            {/* Statistics */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    title="Total Transactions"
                    value={payments.length.toLocaleString("en-IN")}
                    icon="fa-money-bill-transfer"
                    iconClass="bg-aqua-spring text-ocean-green"
                />

                <StatCard
                    title="Completed Revenue"
                    value={formatAmount(totalRevenue)}
                    icon="fa-indian-rupee-sign"
                    iconClass="bg-green-50 text-green-600"
                />

                <StatCard
                    title="Pending Payments"
                    value={pendingPayments.length.toLocaleString("en-IN")}
                    icon="fa-clock"
                    iconClass="bg-yellow-50 text-yellow-600"
                />

                <StatCard
                    title="Refunded Transactions"
                    value={refundedPayments.length.toLocaleString("en-IN")}
                    icon="fa-rotate-left"
                    iconClass="bg-purple-50 text-purple-600"
                />
            </div>

            {/* Filters */}
            <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="relative">
                        <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-sm text-text-grey" />

                        <input
                            type="text"
                            value={search}
                            onChange={(event) => {
                                setCurrentPage(1);
                                setSearch(event.target.value)
                            }}
                            placeholder="Search transaction, order or customer..."
                            className="w-full rounded-lg border border-gray-200 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-ocean-green focus:ring-2 focus:ring-ocean-green/10"
                        />
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(event) => {
                            setCurrentPage(1);
                            setStatusFilter(event.target.value)
                        }}
                        className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-ocean-green"
                    >
                        <option value="All">All Payment Statuses</option>
                        <option value="Completed">Completed</option>
                        <option value="Pending">Pending</option>
                        <option value="Failed">Failed</option>
                        <option value="Refunded">Refunded</option>
                        <option value="Cancelled">Cancelled</option>
                    </select>

                    <select
                        value={methodFilter}
                        onChange={(event) => {
                            setCurrentPage(1);
                            setMethodFilter(event.target.value)
                        }}
                        className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-ocean-green"
                    >
                        <option value="All">All Payment Methods</option>

                        {paymentMethods.map((method) => (
                            <option key={method} value={method}>
                                {method}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Loading */}
            {loading ? (
                <div className="rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm">
                    <i className="fa-solid fa-spinner animate-spin text-3xl text-ocean-green" />

                    <p className="mt-4 text-sm font-medium text-text-grey">
                        Loading payments...
                    </p>
                </div>
            ) : (
                <>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-text-grey">
                            Showing{" "}
                            <span className="font-semibold text-cyprus">
                                {filteredPayments.length}
                            </span>{" "}
                            of{" "}
                            <span className="font-semibold text-cyprus">
                                {payments.length}
                            </span>{" "}
                            transactions
                        </p>
                    </div>

                    {/* Desktop Table */}
                    {filteredPayments.length > 0 && (
                        <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:block">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            {[
                                                "Transaction",
                                                "Customer",
                                                "Amount",
                                                "Method",
                                                "Date",
                                                "Status",
                                                "Action",
                                            ].map((heading) => (
                                                <th
                                                    key={heading}
                                                    className="px-5 py-4 text-left text-xs font-semibold uppercase text-text-grey"
                                                >
                                                    {heading}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-gray-100">
                                        {currentPayments.map((payment) => (
                                            <tr
                                                key={payment.id}
                                                className="transition hover:bg-gray-50"
                                            >
                                                <td className="px-5 py-4">
                                                    <p className="font-bold text-cyprus">
                                                        {payment.transactionId ||
                                                            `PAY-${payment.id}`}
                                                    </p>

                                                    <p className="mt-1 text-xs text-text-grey">
                                                        Order: {payment.orderId}
                                                    </p>
                                                </td>

                                                <td className="px-5 py-4 text-sm text-cyprus">
                                                    <p className="font-medium">
                                                        {payment.customer}
                                                    </p>

                                                    {payment.email && (
                                                        <p className="mt-1 text-xs text-text-grey">
                                                            {payment.email}
                                                        </p>
                                                    )}
                                                </td>

                                                <td className="px-5 py-4 text-sm font-bold text-cyprus">
                                                    {formatAmount(payment.amount)}
                                                </td>

                                                <td className="px-5 py-4 text-sm text-cyprus">
                                                    {payment.method}
                                                </td>

                                                <td className="px-5 py-4 text-sm text-text-grey">
                                                    {formatDate(payment.date)}
                                                </td>

                                                <td className="px-5 py-4">
                                                    <StatusBadge
                                                        status={payment.status}
                                                        className={getStatusClass(
                                                            payment.status
                                                        )}
                                                    />
                                                </td>

                                                <td className="px-5 py-4">
                                                    {payment.status ===
                                                    "Pending" ? (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                confirmPayment(
                                                                    payment
                                                                )
                                                            }
                                                            disabled={
                                                                confirmingId !==
                                                                    null
                                                            }
                                                            className="whitespace-nowrap rounded-lg bg-ocean-green px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                                                        >
                                                            {confirmingId ===
                                                            payment.id
                                                                ? "Confirming..."
                                                                : "Confirm Payment"}
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs text-text-grey">
                                                            No action
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Mobile and Tablet Cards */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:hidden">
                        {currentPayments.map((payment) => (
                            <div
                                key={payment.id}
                                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h3 className="break-all font-bold text-cyprus">
                                            {payment.transactionId ||
                                                `PAY-${payment.id}`}
                                        </h3>

                                        <p className="mt-1 text-xs text-text-grey">
                                            Order: {payment.orderId}
                                        </p>
                                    </div>

                                    <StatusBadge
                                        status={payment.status}
                                        className={getStatusClass(
                                            payment.status
                                        )}
                                    />
                                </div>

                                <div className="mt-4 border-t border-gray-100 pt-4">
                                    <p className="text-xs text-text-grey">
                                        Amount
                                    </p>

                                    <p className="mt-1 text-xl font-bold text-ocean-green">
                                        {formatAmount(payment.amount)}
                                    </p>
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-text-grey">
                                            Customer
                                        </p>

                                        <p className="mt-1 break-words text-sm font-semibold text-cyprus">
                                            {payment.customer}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs text-text-grey">
                                            Method
                                        </p>

                                        <p className="mt-1 break-words text-sm font-semibold text-cyprus">
                                            {payment.method}
                                        </p>
                                    </div>

                                    <div className="col-span-2">
                                        <p className="text-xs text-text-grey">
                                            Payment Date
                                        </p>

                                        <p className="mt-1 text-sm text-cyprus">
                                            {formatDate(payment.date)}
                                        </p>
                                    </div>
                                </div>

                                {payment.status === "Pending" && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            confirmPayment(payment)
                                        }
                                        disabled={confirmingId !== null}
                                        className="mt-5 w-full rounded-lg bg-ocean-green px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                                    >
                                        {confirmingId === payment.id
                                            ? "Confirming..."
                                            : "Confirm Payment"}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {filteredPayments.length > 0 && (
                        <Pagination
                            page={safeCurrentPage}
                            totalPages={totalPages}
                            totalItems={filteredPayments.length}
                            pageSize={PAGE_SIZE}
                            itemLabel="payments"
                            onPageChange={setCurrentPage}
                        />
                    )}

                    {/* Empty State */}
                    {filteredPayments.length === 0 && (
                        <div className="rounded-xl border border-gray-200 bg-white px-4 py-16 text-center shadow-sm">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-aqua-spring text-2xl text-ocean-green">
                                <i className="fa-solid fa-money-bill-transfer" />
                            </div>

                            <h3 className="mt-4 text-lg font-bold text-cyprus">
                                {payments.length === 0
                                    ? "No Payments Available"
                                    : "No Payments Found"}
                            </h3>

                            <p className="mt-1 text-sm text-text-grey">
                                {payments.length === 0
                                    ? "Payment information will appear here when orders are available."
                                    : "Try changing your search or filters."}
                            </p>

                            {(search ||
                                statusFilter !== "All" ||
                                methodFilter !== "All") && (
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="mt-4 rounded-lg bg-ocean-green px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                                >
                                    Clear Filters
                                </button>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function StatusBadge({ status, className }) {
    return (
        <span
            className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${className}`}
        >
            {status}
        </span>
    );
}

function StatCard({ title, value, icon, iconClass }) {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm text-text-grey">{title}</p>

                    <h2 className="mt-2 break-words text-2xl font-bold text-cyprus">
                        {value}
                    </h2>
                </div>

                <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${iconClass}`}
                >
                    <i className={`fa-solid ${icon}`} />
                </div>
            </div>
        </div>
    );
}

export default Payments;