import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import { Link } from "react-router-dom";

const API_BASE_URL = "http://localhost:5000/api/admin";

const normalizeStatus = (value) =>
    String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");

const formatCurrency = (value) => {
    const amount = Number(value ?? 0);

    return `₹${(Number.isFinite(amount) ? amount : 0).toLocaleString(
        "en-IN",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }
    )}`;
};

const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

const formatDateTime = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const normalizeRefund = (refund = {}) => ({
    ...refund,
    refund_id: refund.refund_id ?? refund.id ?? null,
    order_id: refund.order_id ?? null,
    order_number:
        refund.order_number ||
        (refund.order_id ? `#ORD-${refund.order_id}` : "—"),
    customer_name: refund.customer_name || "Unknown Customer",
    customer_email: refund.customer_email || "—",
    return_id: refund.return_id ?? null,
    payment_id: refund.payment_id ?? null,
    amount: Number(refund.amount ?? 0),
    reason: refund.reason || "Not specified",
    status: normalizeStatus(refund.status || "pending"),
    refund_transaction_id: refund.refund_transaction_id || "",
    created_at: refund.created_at || null,
    completed_at: refund.completed_at || null,
});

const STATUS_OPTIONS = [
    { value: "all", label: "All Refunds" },
    { value: "pending", label: "Pending" },
    { value: "processing", label: "Processing" },
    { value: "completed", label: "Completed" },
    { value: "failed", label: "Failed" },
];

function getStatusClass(status) {
    switch (normalizeStatus(status)) {
        case "pending":
            return "bg-yellow-100 text-yellow-800";

        case "processing":
            return "bg-blue-100 text-blue-800";

        case "completed":
            return "bg-green-100 text-green-800";

        case "failed":
            return "bg-red-100 text-red-800";

        default:
            return "bg-gray-100 text-gray-700";
    }
}

function getStatusIcon(status) {
    switch (normalizeStatus(status)) {
        case "pending":
            return "fa-clock";

        case "processing":
            return "fa-spinner";

        case "completed":
            return "fa-circle-check";

        case "failed":
            return "fa-circle-xmark";

        default:
            return "fa-circle-question";
    }
}

function getAvailableStatuses(status) {
    switch (normalizeStatus(status)) {
        case "pending":
            return ["processing", "failed"];

        case "processing":
            return ["completed", "failed"];

        case "failed":
            return ["processing"];

        case "completed":
        default:
            return [];
    }
}

function getErrorMessage(data, fallback) {
    return (
        data?.message ||
        data?.error ||
        fallback
    );
}

function ReturnsRefunds() {
    const [refunds, setRefunds] = useState([]);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        total_pages: 1,
    });

    const [selectedRefund, setSelectedRefund] = useState(null);

    const [statusModal, setStatusModal] = useState(null);
    const [newStatus, setNewStatus] = useState("");
    const [transactionId, setTransactionId] = useState("");
    const [statusNote, setStatusNote] = useState("");

    const [updating, setUpdating] = useState(false);
    const [actionError, setActionError] = useState("");
    const [actionSuccess, setActionSuccess] = useState("");

    const [createReturnId, setCreateReturnId] = useState("");
    const [creatingRefund, setCreatingRefund] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Authenticated API request helper.
    const requestJSON = useCallback(async (url, options = {}) => {
        const token = localStorage.getItem("shopsphereToken");

        const response = await fetch(`${API_BASE_URL}${url}`, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(token
                    ? {
                          Authorization: `Bearer ${token}`,
                      }
                    : {}),
                ...(options.headers || {}),
            },
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || data.success === false) {
            throw new Error(
                getErrorMessage(
                    data,
                    `Request failed (${response.status})`
                )
            );
        }

        return data;
    }, []);

    // Fetch refunds from the backend.
    const fetchRefunds = useCallback(
        async ({ showLoader = true } = {}) => {
            if (showLoader) {
                setLoading(true);
            } else {
                setRefreshing(true);
            }

            setError("");

            try {
                const params = new URLSearchParams({
                    page: String(page),
                    limit: String(limit),
                });

                if (statusFilter !== "all") {
                    params.set("status", statusFilter);
                }

                const data = await requestJSON(
                    `/refunds?${params.toString()}`
                );

                const payload = data.data || data;

                const refundList = Array.isArray(payload.refunds)
                    ? payload.refunds
                    : Array.isArray(data.refunds)
                      ? data.refunds
                      : [];

                const pageData = payload.pagination || {};

                setRefunds(refundList.map(normalizeRefund));

                setPagination({
                    page: Number(pageData.page ?? page),
                    limit: Number(pageData.limit ?? limit),
                    total: Number(pageData.total ?? refundList.length),
                    total_pages: Math.max(
                        1,
                        Number(pageData.total_pages ?? 1)
                    ),
                });
            } catch (err) {
                setError(
                    err.message || "Failed to load refunds."
                );
                setRefunds([]);
                setPagination({
                    page: 1,
                    limit,
                    total: 0,
                    total_pages: 1,
                });
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [requestJSON, page, limit, statusFilter]
    );

    useEffect(() => {
        fetchRefunds();
    }, [fetchRefunds]);

    // Search is applied to the records loaded for the current page.
    const filteredRefunds = useMemo(() => {
        const query = search.trim().toLowerCase();

        if (!query) return refunds;

        return refunds.filter((refund) => {
            const values = [
                refund.refund_id,
                refund.order_id,
                refund.order_number,
                refund.customer_name,
                refund.customer_email,
                refund.return_id,
                refund.payment_id,
                refund.reason,
                refund.refund_transaction_id,
                refund.status,
            ];

            return values.some((value) =>
                String(value ?? "")
                    .toLowerCase()
                    .includes(query)
            );
        });
    }, [refunds, search]);

    // Current page summary only; backend does not provide global status totals.
    const pageStats = useMemo(() => {
        return refunds.reduce(
            (stats, refund) => {
                stats[refund.status] =
                    (stats[refund.status] || 0) + 1;

                stats.amount += refund.amount;

                return stats;
            },
            {
                pending: 0,
                processing: 0,
                completed: 0,
                failed: 0,
                amount: 0,
            }
        );
    }, [refunds]);

    const closeStatusModal = () => {
        if (updating) return;

        setStatusModal(null);
        setNewStatus("");
        setTransactionId("");
        setStatusNote("");
        setActionError("");
    };

    const openStatusModal = (refund) => {
        const allowed = getAvailableStatuses(refund.status);

        if (!allowed.length) return;

        setSelectedRefund(refund);
        setStatusModal(refund);
        setNewStatus(allowed[0]);
        setTransactionId(refund.refund_transaction_id || "");
        setStatusNote("");
        setActionError("");
        setActionSuccess("");
    };

    // Update refund status.
    const handleUpdateStatus = async (event) => {
        event.preventDefault();

        if (!statusModal) return;

        if (
            !["processing", "completed", "failed"].includes(
                normalizeStatus(newStatus)
            )
        ) {
            setActionError("Please select a valid refund status.");
            return;
        }

        if (
            normalizeStatus(newStatus) === "completed" &&
            !transactionId.trim()
        ) {
            setActionError(
                "Transaction/reference ID is required to complete a refund."
            );
            return;
        }

        setUpdating(true);
        setActionError("");

        try {
            const refundId = statusModal.refund_id;

            const payload = {
                status: newStatus,
                note: statusNote.trim(),
            };

            if (transactionId.trim()) {
                payload.refund_transaction_id = transactionId.trim();
            }

            await requestJSON(
                `/refunds/${encodeURIComponent(refundId)}/status`,
                {
                    method: "PATCH",
                    body: JSON.stringify(payload),
                }
            );

            setActionSuccess("Refund status updated successfully.");
            setStatusModal(null);
            setNewStatus("");
            setTransactionId("");
            setStatusNote("");

            await fetchRefunds({ showLoader: false });
        } catch (err) {
            setActionError(
                err.message || "Unable to update refund status."
            );
        } finally {
            setUpdating(false);
        }
    };

    // Create a refund record for an approved return.
    const handleCreateRefund = async (event) => {
        event.preventDefault();

        const returnId = Number(createReturnId);

        if (!Number.isInteger(returnId) || returnId <= 0) {
            setActionError("Enter a valid Return ID.");
            return;
        }

        setCreatingRefund(true);
        setActionError("");
        setActionSuccess("");

        try {
            await requestJSON(
                `/returns/${encodeURIComponent(returnId)}/refund`,
                {
                    method: "POST",
                }
            );

            setActionSuccess(
                "Refund record created successfully. The actual money transfer is not performed by this API."
            );

            setCreateReturnId("");
            setShowCreateModal(false);
            setPage(1);

            // Wait for the page state update before relying on the next effect.
            await fetchRefunds({ showLoader: false });
        } catch (err) {
            setActionError(
                err.message || "Unable to create refund record."
            );
        } finally {
            setCreatingRefund(false);
        }
    };

    const resetFilters = () => {
        setSearch("");
        setStatusFilter("all");
        setPage(1);
    };

    const changeStatusFilter = (value) => {
        setStatusFilter(value);
        setPage(1);
    };

    const exportCSV = () => {
        if (!filteredRefunds.length) return;

        const columns = [
            ["Refund ID", "refund_id"],
            ["Order Number", "order_number"],
            ["Customer", "customer_name"],
            ["Customer Email", "customer_email"],
            ["Return ID", "return_id"],
            ["Payment ID", "payment_id"],
            ["Amount", "amount"],
            ["Reason", "reason"],
            ["Status", "status"],
            ["Transaction ID", "refund_transaction_id"],
            ["Created At", "created_at"],
            ["Completed At", "completed_at"],
        ];

        const escapeCSV = (value) => {
            const text = String(value ?? "");
            return `"${text.replace(/"/g, '""')}"`;
        };

        const csv = [
            columns.map(([label]) => escapeCSV(label)).join(","),
            ...filteredRefunds.map((refund) =>
                columns
                    .map(([, key]) => escapeCSV(refund[key]))
                    .join(",")
            ),
        ].join("\r\n");

        const blob = new Blob(["\uFEFF", csv], {
            type: "text/csv;charset=utf-8;",
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = `shopsphere-refunds-page-${page}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);
    };

    // Escape key closes dialogs.
    useEffect(() => {
        const isOpen = statusModal || showCreateModal || selectedRefund;

        if (!isOpen) return;

        const handleEscape = (event) => {
            if (event.key === "Escape" && !updating && !creatingRefund) {
                closeStatusModal();
                setShowCreateModal(false);
                setSelectedRefund(null);
            }
        };

        window.addEventListener("keydown", handleEscape);

        return () => {
            window.removeEventListener("keydown", handleEscape);
        };
    }, [
        statusModal,
        showCreateModal,
        selectedRefund,
        updating,
        creatingRefund,
    ]);

    return (
        <div className="min-h-full bg-aqua-spring p-4 sm:p-6 lg:p-8">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-text-grey">
                        <Link
                            to="/admin"
                            className="transition hover:text-ocean-green"
                        >
                            Dashboard
                        </Link>

                        <i className="fa-solid fa-chevron-right text-[10px]"></i>

                        <Link
                            to="/admin/orders"
                            className="transition hover:text-ocean-green"
                        >
                            Orders
                        </Link>

                        <i className="fa-solid fa-chevron-right text-[10px]"></i>

                        <span className="text-cyprus">Refunds</span>
                    </div>

                    <h1 className="text-2xl font-bold text-cyprus sm:text-3xl">
                        Returns & Refunds
                    </h1>

                    <p className="mt-1 max-w-2xl text-sm text-text-grey">
                        Review refund records and manage their processing status.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            setActionError("");
                            setShowCreateModal(true);
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-ocean-green px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyprus"
                    >
                        <i className="fa-solid fa-plus"></i>
                        Create Refund
                    </button>

                    <button
                        type="button"
                        onClick={() => fetchRefunds({ showLoader: false })}
                        disabled={refreshing}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-cyprus transition hover:border-ocean-green hover:text-ocean-green disabled:opacity-50"
                    >
                        <i
                            className={`fa-solid fa-rotate-right ${
                                refreshing ? "fa-spin" : ""
                            }`}
                        ></i>
                        Refresh
                    </button>
                </div>
            </div>

            {/* API action success */}
            {actionSuccess && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                    <i className="fa-solid fa-circle-check mt-0.5"></i>
                    <p className="flex-1">{actionSuccess}</p>

                    <button
                        type="button"
                        onClick={() => setActionSuccess("")}
                        className="text-green-700 hover:text-green-900"
                        aria-label="Dismiss success message"
                    >
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>
            )}

            {/* Important API note */}
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
                <i className="fa-solid fa-circle-info mt-0.5 text-blue-600"></i>

                <div>
                    <p className="text-sm font-bold text-blue-900">
                        Refund processing notice
                    </p>

                    <p className="mt-1 text-sm leading-6 text-blue-800">
                        This API creates refund records and updates their
                        status. It does not transfer money through a payment
                        gateway. Process the actual refund externally and
                        enter its reference ID before marking it completed.
                    </p>
                </div>
            </div>

            {/* Statistics for current page */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <StatCard
                    title="Total Refunds"
                    value={loading ? "..." : pagination.total}
                    icon="fa-receipt"
                    iconClass="bg-ocean-green/10 text-ocean-green"
                />

                <StatCard
                    title="Pending"
                    value={loading ? "..." : pageStats.pending}
                    icon="fa-clock"
                    iconClass="bg-yellow-100 text-yellow-700"
                />

                <StatCard
                    title="Processing"
                    value={loading ? "..." : pageStats.processing}
                    icon="fa-spinner"
                    iconClass="bg-blue-100 text-blue-700"
                />

                <StatCard
                    title="Completed"
                    value={loading ? "..." : pageStats.completed}
                    icon="fa-circle-check"
                    iconClass="bg-green-100 text-green-700"
                />

                <StatCard
                    title="Failed"
                    value={loading ? "..." : pageStats.failed}
                    icon="fa-circle-xmark"
                    iconClass="bg-red-100 text-red-700"
                />
            </div>

            {/* Filters */}
            <div className="mb-6 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="relative w-full xl:max-w-md">
                        <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-sm text-text-grey"></i>

                        <input
                            type="text"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search refund, order, customer, transaction..."
                            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm text-cyprus outline-none transition focus:border-ocean-green focus:bg-white"
                        />
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                        <select
                            value={statusFilter}
                            onChange={(event) =>
                                changeStatusFilter(event.target.value)
                            }
                            className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-cyprus outline-none focus:border-ocean-green"
                        >
                            {STATUS_OPTIONS.map((option) => (
                                <option
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </option>
                            ))}
                        </select>

                        <button
                            type="button"
                            onClick={resetFilters}
                            className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-cyprus transition hover:border-ocean-green hover:text-ocean-green"
                        >
                            <i className="fa-solid fa-rotate-right mr-2"></i>
                            Reset
                        </button>

                        <button
                            type="button"
                            onClick={exportCSV}
                            disabled={!filteredRefunds.length}
                            className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-cyprus transition hover:border-ocean-green hover:text-ocean-green disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <i className="fa-solid fa-file-csv mr-2"></i>
                            Export CSV
                        </button>
                    </div>
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="rounded-xl border border-gray-100 bg-white px-6 py-16 text-center shadow-sm">
                    <i className="fa-solid fa-spinner fa-spin text-3xl text-ocean-green"></i>

                    <p className="mt-4 text-sm text-text-grey">
                        Loading refunds...
                    </p>
                </div>
            )}

            {/* Error */}
            {!loading && error && (
                <div className="rounded-xl border border-red-100 bg-white p-6 text-center shadow-sm">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
                        <i className="fa-solid fa-triangle-exclamation text-xl"></i>
                    </div>

                    <h2 className="mt-4 text-lg font-bold text-cyprus">
                        Unable to load refunds
                    </h2>

                    <p className="mt-2 break-words text-sm text-text-grey">
                        {error}
                    </p>

                    <button
                        type="button"
                        onClick={() => fetchRefunds()}
                        className="mt-5 rounded-lg bg-ocean-green px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                    >
                        <i className="fa-solid fa-rotate-right mr-2"></i>
                        Try Again
                    </button>
                </div>
            )}

            {/* Refunds */}
            {!loading && !error && (
                <>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-text-grey">
                            Showing{" "}
                            <span className="font-semibold text-cyprus">
                                {filteredRefunds.length}
                            </span>{" "}
                            of{" "}
                            <span className="font-semibold text-cyprus">
                                {pagination.total}
                            </span>{" "}
                            refunds
                            {statusFilter !== "all" && (
                                <span className="ml-1">
                                    ({statusFilter})
                                </span>
                            )}
                        </p>
                    </div>

                    {/* Desktop table */}
                    <div className="hidden overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm lg:block">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1150px]">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-gray-50">
                                        {[
                                            "Refund",
                                            "Order",
                                            "Customer",
                                            "Amount",
                                            "Reason",
                                            "Status",
                                            "Created",
                                        ].map((heading) => (
                                            <th
                                                key={heading}
                                                className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-text-grey"
                                            >
                                                {heading}
                                            </th>
                                        ))}

                                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-text-grey">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-100">
                                    {filteredRefunds.map((refund) => (
                                        <tr
                                            key={refund.refund_id}
                                            className="transition hover:bg-gray-50"
                                        >
                                            <td className="px-5 py-4">
                                                <p className="text-sm font-bold text-cyprus">
                                                    #{refund.refund_id ?? "—"}
                                                </p>

                                                <p className="mt-1 text-xs text-text-grey">
                                                    Return: {refund.return_id ?? "—"}
                                                </p>
                                            </td>

                                            <td className="px-5 py-4">
                                                <p className="text-sm font-semibold text-cyprus">
                                                    {refund.order_number}
                                                </p>

                                                <p className="mt-1 text-xs text-text-grey">
                                                    Order ID: {refund.order_id ?? "—"}
                                                </p>
                                            </td>

                                            <td className="px-5 py-4">
                                                <p className="text-sm font-semibold text-cyprus">
                                                    {refund.customer_name}
                                                </p>

                                                <p className="mt-1 break-all text-xs text-text-grey">
                                                    {refund.customer_email}
                                                </p>
                                            </td>

                                            <td className="px-5 py-4 text-sm font-bold text-cyprus">
                                                {formatCurrency(refund.amount)}
                                            </td>

                                            <td className="max-w-[220px] px-5 py-4">
                                                <p className="line-clamp-2 text-sm text-text-grey">
                                                    {refund.reason}
                                                </p>
                                            </td>

                                            <td className="px-5 py-4">
                                                <StatusBadge status={refund.status} />
                                            </td>

                                            <td className="px-5 py-4 text-sm text-text-grey">
                                                {formatDate(refund.created_at)}
                                            </td>

                                            <td className="px-5 py-4">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        title="View Details"
                                                        onClick={() =>
                                                            setSelectedRefund(refund)
                                                        }
                                                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-aqua-spring text-cyprus transition hover:bg-ocean-green hover:text-white"
                                                    >
                                                        <i className="fa-regular fa-eye text-sm"></i>
                                                    </button>

                                                    {getAvailableStatuses(refund.status).length > 0 && (
                                                        <button
                                                            type="button"
                                                            title="Update Status"
                                                            onClick={() =>
                                                                openStatusModal(refund)
                                                            }
                                                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700 transition hover:bg-blue-600 hover:text-white"
                                                        >
                                                            <i className="fa-solid fa-pen-to-square text-sm"></i>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {filteredRefunds.length === 0 && (
                            <EmptyRefunds onReset={resetFilters} />
                        )}
                    </div>

                    {/* Mobile cards */}
                    <div className="space-y-4 lg:hidden">
                        {filteredRefunds.map((refund) => (
                            <div
                                key={refund.refund_id}
                                className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="break-words text-sm font-bold text-cyprus">
                                            Refund #{refund.refund_id ?? "—"}
                                        </p>

                                        <p className="mt-1 text-xs text-text-grey">
                                            {refund.order_number}
                                        </p>
                                    </div>

                                    <StatusBadge status={refund.status} />
                                </div>

                                <div className="my-4 border-t border-gray-100"></div>

                                <div>
                                    <p className="text-xs text-text-grey">
                                        Customer
                                    </p>

                                    <p className="mt-1 text-sm font-semibold text-cyprus">
                                        {refund.customer_name}
                                    </p>

                                    <p className="mt-1 break-all text-xs text-text-grey">
                                        {refund.customer_email}
                                    </p>
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-4">
                                    <InfoField
                                        label="Refund Amount"
                                        value={formatCurrency(refund.amount)}
                                        strong
                                    />

                                    <InfoField
                                        label="Return ID"
                                        value={refund.return_id ?? "—"}
                                    />

                                    <InfoField
                                        label="Payment ID"
                                        value={refund.payment_id ?? "—"}
                                    />

                                    <InfoField
                                        label="Created"
                                        value={formatDate(refund.created_at)}
                                    />

                                    <div className="col-span-2">
                                        <InfoField
                                            label="Reason"
                                            value={refund.reason}
                                        />
                                    </div>
                                </div>

                                <div className="mt-5 flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedRefund(refund)}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-aqua-spring px-3 py-2.5 text-sm font-semibold text-cyprus transition hover:bg-ocean-green hover:text-white"
                                    >
                                        <i className="fa-regular fa-eye"></i>
                                        Details
                                    </button>

                                    {getAvailableStatuses(refund.status).length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => openStatusModal(refund)}
                                            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-semibold text-cyprus transition hover:border-ocean-green hover:text-ocean-green"
                                        >
                                            <i className="fa-solid fa-pen-to-square"></i>
                                            Update
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {filteredRefunds.length === 0 && (
                            <EmptyRefunds onReset={resetFilters} />
                        )}
                    </div>

                    {/* Pagination */}
                    {pagination.total_pages > 1 && (
                        <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-xl border border-gray-100 bg-white p-4 sm:flex-row">
                            <p className="text-sm text-text-grey">
                                Page{" "}
                                <span className="font-semibold text-cyprus">
                                    {pagination.page}
                                </span>{" "}
                                of{" "}
                                <span className="font-semibold text-cyprus">
                                    {pagination.total_pages}
                                </span>
                            </p>

                            <div className="flex items-center justify-center gap-3">
                                <button
                                    type="button"
                                    disabled={page <= 1 || loading}
                                    onClick={() =>
                                        setPage((current) =>
                                            Math.max(1, current - 1)
                                        )
                                    }
                                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-cyprus transition hover:border-ocean-green hover:text-ocean-green disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <i className="fa-solid fa-chevron-left mr-2"></i>
                                    Previous
                                </button>

                                <button
                                    type="button"
                                    disabled={
                                        page >= pagination.total_pages ||
                                        loading
                                    }
                                    onClick={() =>
                                        setPage((current) =>
                                            Math.min(
                                                pagination.total_pages,
                                                current + 1
                                            )
                                        )
                                    }
                                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-cyprus transition hover:border-ocean-green hover:text-ocean-green disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Next
                                    <i className="fa-solid fa-chevron-right ml-2"></i>
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Refund Details Modal */}
            {selectedRefund && !statusModal && (
                <Modal
                    title={`Refund #${selectedRefund.refund_id ?? "—"}`}
                    onClose={() => setSelectedRefund(null)}
                >
                    <div className="space-y-5">
                        <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-xs text-text-grey">
                                    Refund Amount
                                </p>

                                <p className="mt-1 text-2xl font-bold text-cyprus">
                                    {formatCurrency(selectedRefund.amount)}
                                </p>
                            </div>

                            <StatusBadge status={selectedRefund.status} />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <DetailField
                                label="Order Number"
                                value={selectedRefund.order_number}
                            />

                            <DetailField
                                label="Order ID"
                                value={selectedRefund.order_id ?? "—"}
                            />

                            <DetailField
                                label="Customer"
                                value={selectedRefund.customer_name}
                            />

                            <DetailField
                                label="Customer Email"
                                value={selectedRefund.customer_email}
                            />

                            <DetailField
                                label="Return ID"
                                value={selectedRefund.return_id ?? "—"}
                            />

                            <DetailField
                                label="Payment ID"
                                value={selectedRefund.payment_id ?? "—"}
                            />

                            <DetailField
                                label="Created At"
                                value={formatDateTime(selectedRefund.created_at)}
                            />

                            <DetailField
                                label="Completed At"
                                value={formatDateTime(selectedRefund.completed_at)}
                            />

                            <DetailField
                                label="Transaction / Reference ID"
                                value={
                                    selectedRefund.refund_transaction_id || "Not provided"
                                }
                            />

                            <div className="rounded-xl border border-gray-100 p-4 sm:col-span-2">
                                <p className="text-xs font-medium text-text-grey">
                                    Refund Reason
                                </p>

                                <p className="mt-2 break-words text-sm text-cyprus">
                                    {selectedRefund.reason}
                                </p>
                            </div>
                        </div>

                        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                            <p className="flex items-center gap-2 text-sm font-bold text-blue-900">
                                <i className="fa-solid fa-circle-info"></i>
                                Money transfer status
                            </p>

                            <p className="mt-2 text-sm leading-6 text-blue-800">
                                The backend stores the refund status and
                                transaction reference. It does not perform the
                                actual payment transfer.
                            </p>
                        </div>

                        {getAvailableStatuses(selectedRefund.status).length > 0 && (
                            <button
                                type="button"
                                onClick={() => openStatusModal(selectedRefund)}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-ocean-green px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyprus"
                            >
                                <i className="fa-solid fa-pen-to-square"></i>
                                Update Refund Status
                            </button>
                        )}
                    </div>
                </Modal>
            )}

            {/* Update Status Modal */}
            {statusModal && (
                <Modal
                    title={`Update Refund #${statusModal.refund_id ?? "—"}`}
                    onClose={closeStatusModal}
                    closeDisabled={updating}
                >
                    <form onSubmit={handleUpdateStatus} className="space-y-5">
                        <div className="rounded-xl bg-gray-50 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs text-text-grey">
                                        Refund Amount
                                    </p>

                                    <p className="mt-1 text-xl font-bold text-cyprus">
                                        {formatCurrency(statusModal.amount)}
                                    </p>
                                </div>

                                <StatusBadge status={statusModal.status} />
                            </div>

                            <p className="mt-3 text-sm text-text-grey">
                                Order:{" "}
                                <span className="font-semibold text-cyprus">
                                    {statusModal.order_number}
                                </span>
                            </p>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold text-cyprus">
                                New Status <span className="text-red-500">*</span>
                            </label>

                            <select
                                required
                                value={newStatus}
                                onChange={(event) =>
                                    setNewStatus(event.target.value)
                                }
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-cyprus outline-none focus:border-ocean-green"
                            >
                                {getAvailableStatuses(statusModal.status).map(
                                    (status) => (
                                        <option key={status} value={status}>
                                            {status.charAt(0).toUpperCase() +
                                                status.slice(1)}
                                        </option>
                                    )
                                )}
                            </select>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold text-cyprus">
                                Transaction / Reference ID
                                {normalizeStatus(newStatus) === "completed" && (
                                    <span className="text-red-500"> *</span>
                                )}
                            </label>

                            <input
                                type="text"
                                value={transactionId}
                                maxLength={191}
                                onChange={(event) =>
                                    setTransactionId(event.target.value)
                                }
                                placeholder="Enter external refund transaction ID"
                                required={normalizeStatus(newStatus) === "completed"}
                                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-cyprus outline-none focus:border-ocean-green"
                            />

                            <p className="mt-2 text-xs leading-5 text-text-grey">
                                Required when marking the refund completed.
                                Process the actual refund externally first.
                            </p>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold text-cyprus">
                                Note (Optional)
                            </label>

                            <textarea
                                value={statusNote}
                                maxLength={2000}
                                rows={3}
                                onChange={(event) =>
                                    setStatusNote(event.target.value)
                                }
                                placeholder="Add an internal note..."
                                className="w-full resize-y rounded-lg border border-gray-200 px-4 py-3 text-sm text-cyprus outline-none focus:border-ocean-green"
                            />
                        </div>

                        {actionError && (
                            <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                                <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                                {actionError}
                            </div>
                        )}

                        <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                disabled={updating}
                                onClick={closeStatusModal}
                                className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-semibold text-cyprus transition hover:bg-gray-50 disabled:opacity-50"
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                disabled={updating}
                                className="rounded-lg bg-ocean-green px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyprus disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {updating ? (
                                    <>
                                        <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                                        Updating...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-floppy-disk mr-2"></i>
                                        Update Status
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Create Refund Modal */}
            {showCreateModal && (
                <Modal
                    title="Create Refund Record"
                    onClose={() => {
                        if (creatingRefund) return;
                        setShowCreateModal(false);
                        setActionError("");
                    }}
                    closeDisabled={creatingRefund}
                >
                    <form onSubmit={handleCreateRefund} className="space-y-5">
                        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                            <p className="flex items-center gap-2 text-sm font-bold text-yellow-900">
                                <i className="fa-solid fa-triangle-exclamation"></i>
                                Before you continue
                            </p>

                            <p className="mt-2 text-sm leading-6 text-yellow-800">
                                Only approved returns with a successful payment
                                can have a refund record created. This action
                                does not transfer money.
                            </p>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold text-cyprus">
                                Approved Return ID
                                <span className="text-red-500"> *</span>
                            </label>

                            <input
                                type="number"
                                min="1"
                                step="1"
                                required
                                value={createReturnId}
                                onChange={(event) =>
                                    setCreateReturnId(event.target.value)
                                }
                                placeholder="Enter the approved return ID"
                                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-cyprus outline-none focus:border-ocean-green"
                            />

                            <p className="mt-2 text-xs text-text-grey">
                                Use the return ID from the admin Returns page.
                            </p>
                        </div>

                        {actionError && (
                            <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                                <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                                {actionError}
                            </div>
                        )}

                        <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                disabled={creatingRefund}
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setActionError("");
                                }}
                                className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-semibold text-cyprus transition hover:bg-gray-50 disabled:opacity-50"
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                disabled={creatingRefund}
                                className="rounded-lg bg-ocean-green px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyprus disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {creatingRefund ? (
                                    <>
                                        <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-plus mr-2"></i>
                                        Create Refund
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}

function StatCard({ title, value, icon, iconClass }) {
    return (
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm text-text-grey">{title}</p>

                    <h2 className="mt-2 break-words text-2xl font-bold text-cyprus">
                        {value}
                    </h2>
                </div>

                <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
                >
                    <i className={`fa-solid ${icon} text-lg`}></i>
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status }) {
    const normalized = normalizeStatus(status);

    return (
        <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold capitalize ${getStatusClass(
                normalized
            )}`}
        >
            <i className={`fa-solid ${getStatusIcon(normalized)}`}></i>
            {normalized.replace(/_/g, " ")}
        </span>
    );
}

function InfoField({ label, value, strong = false }) {
    return (
        <div className="min-w-0">
            <p className="text-xs text-text-grey">{label}</p>

            <p
                className={`mt-1 break-words text-sm ${
                    strong
                        ? "font-bold text-cyprus"
                        : "font-medium text-cyprus"
                }`}
            >
                {value ?? "—"}
            </p>
        </div>
    );
}

function DetailField({ label, value }) {
    return (
        <div className="min-w-0 rounded-xl border border-gray-100 p-4">
            <p className="text-xs font-medium text-text-grey">{label}</p>

            <p className="mt-2 break-words text-sm font-semibold text-cyprus">
                {value ?? "—"}
            </p>
        </div>
    );
}

function Modal({
    title,
    children,
    onClose,
    closeDisabled = false,
}) {
    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 sm:p-5"
            onMouseDown={(event) => {
                if (
                    event.target === event.currentTarget &&
                    !closeDisabled
                ) {
                    onClose();
                }
            }}
        >
            <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:px-6">
                    <h2 className="break-words text-lg font-bold text-cyprus sm:text-xl">
                        {title}
                    </h2>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={closeDisabled}
                        title="Close"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div className="overflow-y-auto p-5 sm:p-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    {children}
                </div>
            </div>
        </div>
    );
}

function EmptyRefunds({ onReset }) {
    return (
        <div className="rounded-xl border border-gray-100 bg-white px-6 py-16 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-aqua-spring text-ocean-green">
                <i className="fa-solid fa-money-bill-transfer text-2xl"></i>
            </div>

            <h2 className="mt-5 text-lg font-bold text-cyprus">
                No Refunds Found
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm text-text-grey">
                No refunds match your current search or status filter.
            </p>

            <button
                type="button"
                onClick={onReset}
                className="mt-5 rounded-lg bg-ocean-green px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyprus"
            >
                Reset Filters
            </button>
        </div>
    );
}

export default ReturnsRefunds;