import React, {
    useState,
    useEffect,
    useCallback,
    useRef,
} from "react";

const API_BASE_URL = "http://localhost:5000/api";
const ORDERS_API = `${API_BASE_URL}/admin/orders`;
const ORDERS_PER_PAGE = 5;

const ORDER_STATUSES = [
    "pending",
    "confirmed",
    "processing",
    "packed",
    "shipped",
    "delivered",
    "cancelled",
];

const ORDER_STATUS_RANK = {
    pending: 0,
    confirmed: 1,
    processing: 2,
    packed: 3,
    shipped: 4,
    delivered: 5,
};

function PendingOrders() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [selectedOrder, setSelectedOrder] = useState(null);
    const [selectedOrderId, setSelectedOrderId] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState("");

    const [selectedStatus, setSelectedStatus] = useState("");
    const [statusNote, setStatusNote] = useState("");
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");
    const [statusMessageType, setStatusMessageType] = useState("");

    const listRequestId = useRef(0);
    const detailsRequestId = useRef(0);

    // --------------------------------------------------
    // Authentication
    // --------------------------------------------------

    const getToken = () => {
        return (
            localStorage.getItem("shopsphereToken") ||
            localStorage.getItem("token")
        );
    };

    // --------------------------------------------------
    // Formatting Helpers
    // --------------------------------------------------

    const formatDate = (value) => {
        if (!value) return "—";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return "—";

        return date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    const formatDateTime = (value) => {
        if (!value) return "—";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return "—";

        return date.toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

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

    const formatStatus = (value) => {
        if (!value) return "Unknown";

        return String(value)
            .replace(/_/g, " ")
            .replace(/\b\w/g, (letter) => letter.toUpperCase());
    };

    const getPaymentClass = (paymentStatus) => {
        const value = String(paymentStatus || "").toLowerCase();

        if (["paid", "completed", "success"].includes(value)) {
            return "bg-green-100 text-green-700";
        }

        if (["pending", "unpaid"].includes(value)) {
            return "bg-yellow-100 text-yellow-700";
        }

        if (["failed", "refunded", "cancelled"].includes(value)) {
            return "bg-red-100 text-red-700";
        }

        return "bg-gray-100 text-gray-700";
    };

    const getStatusClass = (status) => {
        const value = String(status || "").toLowerCase();

        if (value === "delivered") {
            return "bg-green-100 text-green-700";
        }

        if (value === "cancelled") {
            return "bg-red-100 text-red-700";
        }

        if (value === "shipped") {
            return "bg-blue-100 text-blue-700";
        }

        if (["processing", "confirmed", "packed"].includes(value)) {
            return "bg-purple-100 text-purple-700";
        }

        return "bg-yellow-100 text-yellow-700";
    };

    const getHistoryStatus = (history) => {
        return (
            history.status ||
            history.order_status ||
            history.new_status ||
            history.status_name ||
            "Status updated"
        );
    };

    const getHistoryDate = (history) => {
        return (
            history.created_at ||
            history.changed_at ||
            history.updated_at ||
            history.timestamp
        );
    };

    // --------------------------------------------------
    // API Helper
    // --------------------------------------------------

    const requestJSON = async (url, options = {}) => {
        const token = getToken();

        if (!token) {
            throw new Error(
                "Login session not found. Please log in again."
            );
        }

        const response = await fetch(url, {
            ...options,
            headers: {
                ...(options.headers || {}),
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || data.success === false) {
            throw new Error(
                data.message ||
                    `Request failed with status ${response.status}.`
            );
        }

        return data;
    };

    // --------------------------------------------------
    // Fetch Pending Orders
    // --------------------------------------------------

    const fetchPendingOrders = useCallback(async () => {
        const requestId = ++listRequestId.current;

        try {
            setLoading(true);
            setError("");

            const params = new URLSearchParams({
                status: "pending",
            });

            if (search.trim()) {
                params.set("search", search.trim());
            }

            const data = await requestJSON(
                `${ORDERS_API}?${params.toString()}`,
                { method: "GET" }
            );

            // Ignore outdated responses.
            if (requestId !== listRequestId.current) return;

            setOrders(Array.isArray(data.orders) ? data.orders : []);
        } catch (err) {
            if (requestId !== listRequestId.current) return;

            setError(err.message || "Unable to load pending orders.");
            setOrders([]);
        } finally {
            if (requestId === listRequestId.current) {
                setLoading(false);
            }
        }
    }, [search]);

    useEffect(() => {
        const timer = setTimeout(
            fetchPendingOrders,
            search.trim() ? 350 : 0
        );

        return () => clearTimeout(timer);
    }, [fetchPendingOrders, search]);

    useEffect(() => {
        setCurrentPage(1);
    }, [search]);

    // --------------------------------------------------
    // Pagination
    // --------------------------------------------------

    const totalOrders = orders.length;

    const totalPages = Math.max(
        1,
        Math.ceil(totalOrders / ORDERS_PER_PAGE)
    );

    const startIndex = (currentPage - 1) * ORDERS_PER_PAGE;

    const currentOrders = orders.slice(
        startIndex,
        startIndex + ORDERS_PER_PAGE
    );

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const handlePageChange = (page) => {
        if (page < 1 || page > totalPages) return;

        setCurrentPage(page);

        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    };

    // --------------------------------------------------
    // Fetch Order Details
    // --------------------------------------------------

    const fetchOrderDetails = async (orderId) => {
        const data = await requestJSON(`${ORDERS_API}/${orderId}`, {
            method: "GET",
        });

        if (!data.order) {
            throw new Error(
                "Order details were not returned by the server."
            );
        }

        return data.order;
    };

    const handleViewOrder = async (orderId) => {
        const requestId = ++detailsRequestId.current;

        setSelectedOrderId(orderId);
        setSelectedOrder(null);
        setDetailsError("");
        setStatusMessage("");
        setStatusMessageType("");
        setStatusNote("");
        setSelectedStatus("");
        setDetailsLoading(true);

        try {
            const order = await fetchOrderDetails(orderId);

            if (requestId !== detailsRequestId.current) return;

            setSelectedOrder(order);

            const currentStatus = String(
                order.order_status || "pending"
            ).toLowerCase();

            setSelectedStatus(
                ORDER_STATUSES.includes(currentStatus)
                    ? currentStatus
                    : "pending"
            );
        } catch (err) {
            if (requestId !== detailsRequestId.current) return;

            setDetailsError(
                err.message || "Unable to load order details."
            );
        } finally {
            if (requestId === detailsRequestId.current) {
                setDetailsLoading(false);
            }
        }
    };

    const closeOrderDetails = () => {
        if (updatingStatus) return;

        detailsRequestId.current += 1;

        setSelectedOrder(null);
        setSelectedOrderId(null);
        setDetailsError("");
        setDetailsLoading(false);
        setStatusMessage("");
        setStatusMessageType("");
        setStatusNote("");
        setSelectedStatus("");
    };

    // --------------------------------------------------
    // Status Transition Validation
    // --------------------------------------------------

    const isStatusChangeAllowed = (currentStatus, nextStatus) => {
        if (currentStatus === nextStatus) return false;

        if (["delivered", "cancelled"].includes(currentStatus)) {
            return false;
        }

        // Cancellation is permitted from a non-terminal status.
        if (nextStatus === "cancelled") return true;

        const currentRank = ORDER_STATUS_RANK[currentStatus];
        const nextRank = ORDER_STATUS_RANK[nextStatus];

        // If a status is not in the rank map, let the backend validate it.
        if (
            currentRank === undefined ||
            nextRank === undefined
        ) {
            return true;
        }

        return nextRank > currentRank;
    };

    // --------------------------------------------------
    // Update Order Status
    // --------------------------------------------------

    const handleStatusUpdate = async (event) => {
        event.preventDefault();

        if (!selectedOrder || updatingStatus) return;

        const currentStatus = String(
            selectedOrder.order_status || "pending"
        ).toLowerCase();

        if (!ORDER_STATUSES.includes(selectedStatus)) {
            setStatusMessage("Please select a valid order status.");
            setStatusMessageType("error");
            return;
        }

        if (!isStatusChangeAllowed(currentStatus, selectedStatus)) {
            setStatusMessage(
                "This status change is not allowed. Please select a later status."
            );
            setStatusMessageType("error");
            return;
        }

        if (statusNote.trim().length > 2000) {
            setStatusMessage("Note must not exceed 2000 characters.");
            setStatusMessageType("error");
            return;
        }

        try {
            setUpdatingStatus(true);
            setStatusMessage("");
            setStatusMessageType("");

            const orderId = selectedOrder.id || selectedOrder.order_id;

            if (!orderId) {
                throw new Error("Order ID is missing.");
            }

            const data = await requestJSON(
                `${ORDERS_API}/${orderId}/status`,
                {
                    method: "PATCH",
                    body: JSON.stringify({
                        status: selectedStatus,
                        note: statusNote.trim(),
                    }),
                }
            );

            setStatusMessage(
                data.message || "Order status updated successfully."
            );
            setStatusMessageType("success");

            // Refresh the order details and history.
            try {
                const updatedOrder = await fetchOrderDetails(orderId);

                setSelectedOrder(updatedOrder);

                const updatedStatus = String(
                    updatedOrder.order_status || selectedStatus
                ).toLowerCase();

                setSelectedStatus(
                    ORDER_STATUSES.includes(updatedStatus)
                        ? updatedStatus
                        : selectedStatus
                );
            } catch (refreshError) {
                // The PATCH succeeded; retain its confirmed status.
                console.error(
                    "Could not refresh order details:",
                    refreshError
                );

                setSelectedOrder((previousOrder) => ({
                    ...previousOrder,
                    order_status: selectedStatus,
                    updated_at: new Date().toISOString(),
                }));

                setSelectedStatus(selectedStatus);
            }

            setStatusNote("");

            // This page only displays pending orders.
            await fetchPendingOrders();
        } catch (err) {
            setStatusMessage(
                err.message || "Unable to update order status."
            );
            setStatusMessageType("error");
        } finally {
            setUpdatingStatus(false);
        }
    };

    // --------------------------------------------------
    // Shared UI Helpers
    // --------------------------------------------------

    const renderPaymentBadge = (paymentStatus) => (
        <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getPaymentClass(
                paymentStatus
            )}`}
        >
            {formatStatus(paymentStatus)}
        </span>
    );

    const renderStatusBadge = (status) => (
        <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                status
            )}`}
        >
            {formatStatus(status)}
        </span>
    );

    const currentOrderStatus = String(
        selectedOrder?.order_status || "pending"
    ).toLowerCase();

    const terminalOrder = ["delivered", "cancelled"].includes(
        currentOrderStatus
    );

    // --------------------------------------------------
    // Render
    // --------------------------------------------------

    return (
        <div className="min-h-full bg-aqua-spring p-4 sm:p-6 lg:p-8">
            {/* Header */}
            <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <p className="text-sm font-medium text-ocean-green">
                        Order Management
                    </p>

                    <h1 className="mt-1 text-2xl font-bold text-cyprus sm:text-3xl">
                        Pending Orders
                    </h1>

                    <p className="mt-1 text-sm text-text-grey">
                        Review and manage orders awaiting confirmation.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={fetchPendingOrders}
                    disabled={loading}
                    className="rounded-lg bg-ocean-green px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyprus disabled:opacity-60"
                >
                    <i
                        className={`fa-solid ${
                            loading ? "fa-spinner fa-spin" : "fa-rotate"
                        } mr-2`}
                    />
                    Refresh
                </button>
            </div>

            {/* Statistics */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm text-text-grey">
                                Pending Orders
                            </p>
                            <h2 className="mt-2 text-2xl font-bold text-cyprus">
                                {totalOrders}
                            </h2>
                        </div>

                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-50 text-yellow-600">
                            <i className="fa-solid fa-clock text-lg" />
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm text-text-grey">
                                Current Page
                            </p>
                            <h2 className="mt-2 text-2xl font-bold text-cyprus">
                                {currentPage} / {totalPages}
                            </h2>
                        </div>

                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-aqua-spring text-ocean-green">
                            <i className="fa-solid fa-file-lines text-lg" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="mb-6 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <label className="mb-2 block text-sm font-semibold text-cyprus">
                    Search Pending Orders
                </label>

                <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                    <i className="fa-solid fa-magnifying-glass text-sm text-text-grey" />

                    <input
                        type="text"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search order number, customer, email..."
                        className="w-full bg-transparent text-sm text-cyprus outline-none placeholder:text-text-grey"
                    />
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <p className="font-semibold">
                        Unable to load pending orders
                    </p>
                    <p className="mt-1">{error}</p>

                    <button
                        type="button"
                        onClick={fetchPendingOrders}
                        className="mt-2 font-semibold underline"
                    >
                        Try Again
                    </button>
                </div>
            )}

            {/* Desktop Table */}
            <div className="hidden overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm lg:block">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px]">
                        <thead className="border-b border-gray-100 bg-gray-50">
                            <tr>
                                {[
                                    "Order",
                                    "Customer",
                                    "Date",
                                    "Total",
                                    "Payment",
                                    "Status",
                                    "Action",
                                ].map((heading) => (
                                    <th
                                        key={heading}
                                        className={`px-5 py-4 text-xs font-bold uppercase tracking-wide text-text-grey ${
                                            heading === "Action"
                                                ? "text-center"
                                                : "text-left"
                                        }`}
                                    >
                                        {heading}
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100">
                            {!loading &&
                                !error &&
                                currentOrders.map((order) => (
                                    <tr
                                        key={order.order_id}
                                        className="transition hover:bg-gray-50"
                                    >
                                        <td className="px-5 py-4">
                                            <p className="text-sm font-bold text-cyprus">
                                                {order.order_number ||
                                                    `ORD-${order.order_id}`}
                                            </p>
                                        </td>

                                        <td className="px-5 py-4">
                                            <p className="text-sm font-semibold text-cyprus">
                                                {order.customer_name ||
                                                    "Unknown Customer"}
                                            </p>
                                            <p className="mt-1 text-xs text-text-grey">
                                                {order.customer_email || "—"}
                                            </p>
                                        </td>

                                        <td className="px-5 py-4 text-sm text-text-grey">
                                            {formatDate(order.created_at)}
                                        </td>

                                        <td className="px-5 py-4 text-sm font-bold text-cyprus">
                                            {formatCurrency(order.total_amount)}
                                        </td>

                                        <td className="px-5 py-4">
                                            {renderPaymentBadge(
                                                order.payment_status
                                            )}
                                        </td>

                                        <td className="px-5 py-4">
                                            {renderStatusBadge(
                                                order.order_status || "pending"
                                            )}
                                        </td>

                                        <td className="px-5 py-4 text-center">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleViewOrder(
                                                        order.order_id
                                                    )
                                                }
                                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-aqua-spring text-ocean-green transition hover:bg-ocean-green hover:text-white"
                                                title="View Order Details"
                                                aria-label="View Order Details"
                                            >
                                                <i className="fa-solid fa-eye text-sm" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>

                {loading && (
                    <div className="px-6 py-16 text-center">
                        <i className="fa-solid fa-spinner fa-spin text-3xl text-ocean-green" />
                        <p className="mt-4 text-sm text-text-grey">
                            Loading pending orders...
                        </p>
                    </div>
                )}

                {!loading && !error && currentOrders.length === 0 && (
                    <div className="px-6 py-16 text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-aqua-spring text-ocean-green">
                            <i className="fa-solid fa-box-open text-2xl" />
                        </div>
                        <h3 className="mt-4 text-lg font-bold text-cyprus">
                            No Pending Orders
                        </h3>
                        <p className="mt-2 text-sm text-text-grey">
                            No orders are currently waiting for confirmation.
                        </p>
                    </div>
                )}
            </div>

            {/* Mobile Cards */}
            <div className="space-y-4 lg:hidden">
                {loading && (
                    <div className="rounded-xl bg-white px-6 py-16 text-center shadow-sm">
                        <i className="fa-solid fa-spinner fa-spin text-3xl text-ocean-green" />
                        <p className="mt-4 text-sm text-text-grey">
                            Loading pending orders...
                        </p>
                    </div>
                )}

                {!loading &&
                    !error &&
                    currentOrders.map((order) => (
                        <div
                            key={order.order_id}
                            className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-bold text-cyprus">
                                        {order.order_number ||
                                            `ORD-${order.order_id}`}
                                    </p>
                                    <p className="mt-1 text-xs text-text-grey">
                                        {formatDate(order.created_at)}
                                    </p>
                                </div>

                                {renderStatusBadge(
                                    order.order_status || "pending"
                                )}
                            </div>

                            <div className="my-4 border-t border-gray-100" />

                            <p className="text-xs text-text-grey">Customer</p>
                            <p className="mt-1 text-sm font-semibold text-cyprus">
                                {order.customer_name || "Unknown Customer"}
                            </p>
                            <p className="mt-1 break-all text-xs text-text-grey">
                                {order.customer_email || "—"}
                            </p>

                            <div className="mt-4 grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-text-grey">
                                        Total
                                    </p>
                                    <p className="mt-1 text-sm font-bold text-cyprus">
                                        {formatCurrency(order.total_amount)}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs text-text-grey">
                                        Payment
                                    </p>
                                    <div className="mt-1">
                                        {renderPaymentBadge(
                                            order.payment_status
                                        )}
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    handleViewOrder(order.order_id)
                                }
                                className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-aqua-spring px-4 py-2.5 text-sm font-semibold text-ocean-green transition hover:bg-ocean-green hover:text-white"
                            >
                                <i className="fa-solid fa-eye" />
                                View Order Details
                            </button>
                        </div>
                    ))}

                {!loading && !error && currentOrders.length === 0 && (
                    <div className="rounded-xl border border-gray-100 bg-white px-6 py-16 text-center shadow-sm">
                        <i className="fa-solid fa-box-open text-3xl text-ocean-green" />
                        <h3 className="mt-4 text-lg font-bold text-cyprus">
                            No Pending Orders
                        </h3>
                        <p className="mt-2 text-sm text-text-grey">
                            No orders are currently waiting for confirmation.
                        </p>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {!loading && !error && totalOrders > ORDERS_PER_PAGE && (
                <div className="mt-6 rounded-xl border border-gray-100 bg-white px-4 py-4 shadow-sm sm:px-6">
                    <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                        <p className="text-sm text-text-grey">
                            Showing{" "}
                            <span className="font-semibold text-cyprus">
                                {startIndex + 1}
                            </span>{" "}
                            to{" "}
                            <span className="font-semibold text-cyprus">
                                {Math.min(
                                    startIndex + ORDERS_PER_PAGE,
                                    totalOrders
                                )}
                            </span>{" "}
                            of{" "}
                            <span className="font-semibold text-cyprus">
                                {totalOrders}
                            </span>{" "}
                            pending orders
                        </p>

                        <div className="flex flex-wrap items-center justify-center gap-2">
                            <button
                                type="button"
                                onClick={() =>
                                    handlePageChange(currentPage - 1)
                                }
                                disabled={currentPage === 1}
                                className="flex h-9 items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm font-medium text-cyprus hover:border-ocean-green disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <i className="fa-solid fa-chevron-left text-xs" />
                                Previous
                            </button>

                            {Array.from(
                                { length: totalPages },
                                (_, index) => index + 1
                            ).map((page) => (
                                <button
                                    key={page}
                                    type="button"
                                    onClick={() => handlePageChange(page)}
                                    className={`flex h-9 min-w-9 items-center justify-center rounded-lg px-3 text-sm font-semibold ${
                                        currentPage === page
                                            ? "bg-ocean-green text-white"
                                            : "border border-gray-200 text-cyprus hover:border-ocean-green"
                                    }`}
                                >
                                    {page}
                                </button>
                            ))}

                            <button
                                type="button"
                                onClick={() =>
                                    handlePageChange(currentPage + 1)
                                }
                                disabled={currentPage === totalPages}
                                className="flex h-9 items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm font-medium text-cyprus hover:border-ocean-green disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Next
                                <i className="fa-solid fa-chevron-right text-xs" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Order Details Modal */}
            {(detailsLoading || selectedOrder || detailsError) && (
                <div
                    className="fixed inset-0 z-[100] overflow-y-auto bg-black/50 p-3 sm:p-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                    onMouseDown={(event) => {
                        if (
                            event.target === event.currentTarget &&
                            !updatingStatus
                        ) {
                            closeOrderDetails();
                        }
                    }}
                >
                    <div className="flex min-h-full items-center justify-center">
                        <div
                            className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                            onMouseDown={(event) =>
                                event.stopPropagation()
                            }
                        >
                            {/* Modal Header */}
                            <div className="z-10 flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-5 py-4 sm:px-7">
                                <div>
                                    <h2 className="text-xl font-bold text-cyprus sm:text-2xl">
                                        Order Details
                                    </h2>
                                    <p className="mt-1 text-sm text-text-grey">
                                        View customer, products and order history.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={closeOrderDetails}
                                    disabled={updatingStatus}
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                    aria-label="Close order details"
                                >
                                    <i className="fa-solid fa-xmark text-lg" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                                {detailsLoading && (
                                    <div className="px-6 py-16 text-center">
                                        <i className="fa-solid fa-spinner fa-spin text-3xl text-ocean-green" />
                                        <p className="mt-4 text-sm text-text-grey">
                                            Loading order details...
                                        </p>
                                    </div>
                                )}

                                {!detailsLoading && detailsError && (
                                    <div className="p-6 sm:p-7">
                                        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                                            <p className="font-semibold">
                                                Unable to load order details
                                            </p>
                                            <p className="mt-1">{detailsError}</p>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (selectedOrderId) {
                                                        handleViewOrder(
                                                            selectedOrderId
                                                        );
                                                    }
                                                }}
                                                className="mt-3 font-semibold underline"
                                            >
                                                Try Again
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {!detailsLoading && selectedOrder && (
                                    <div className="space-y-6 p-5 sm:p-7">
                                        {/* Order Summary */}
                                        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 sm:p-5">
                                            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                                                <div>
                                                    <p className="text-xs font-medium uppercase tracking-wide text-text-grey">
                                                        Order Number
                                                    </p>
                                                    <h3 className="mt-1 text-lg font-bold text-cyprus">
                                                        {selectedOrder.order_number ||
                                                            `ORD-${selectedOrder.id ||
                                                                selectedOrder.order_id}`}
                                                    </h3>
                                                    <p className="mt-1 text-sm text-text-grey">
                                                        Placed on{" "}
                                                        {formatDateTime(
                                                            selectedOrder.created_at
                                                        )}
                                                    </p>
                                                </div>

                                                <div className="flex flex-wrap gap-2">
                                                    {renderStatusBadge(
                                                        selectedOrder.order_status
                                                    )}

                                                    <span
                                                        className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${getPaymentClass(
                                                            selectedOrder.payment_status
                                                        )}`}
                                                    >
                                                        Payment:{" "}
                                                        {formatStatus(
                                                            selectedOrder.payment_status
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Customer Details */}
                                        <section>
                                            <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-cyprus">
                                                <i className="fa-solid fa-user text-ocean-green" />
                                                Customer Information
                                            </h3>

                                            <div className="grid grid-cols-1 gap-4 rounded-xl border border-gray-100 p-4 sm:grid-cols-2 sm:p-5">
                                                <div>
                                                    <p className="text-xs text-text-grey">
                                                        Customer Name
                                                    </p>
                                                    <p className="mt-1 break-words text-sm font-semibold text-cyprus">
                                                        {selectedOrder.customer_name ||
                                                            selectedOrder.name ||
                                                            "Unknown Customer"}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs text-text-grey">
                                                        Email Address
                                                    </p>
                                                    <p className="mt-1 break-all text-sm font-semibold text-cyprus">
                                                        {selectedOrder.customer_email ||
                                                            selectedOrder.email ||
                                                            "—"}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs text-text-grey">
                                                        Customer ID
                                                    </p>
                                                    <p className="mt-1 text-sm font-semibold text-cyprus">
                                                        {selectedOrder.user_id || "—"}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs text-text-grey">
                                                        Last Updated
                                                    </p>
                                                    <p className="mt-1 text-sm font-semibold text-cyprus">
                                                        {formatDateTime(
                                                            selectedOrder.updated_at
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        </section>

                                        {/* Product Items */}
                                        <section>
                                            <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-cyprus">
                                                <i className="fa-solid fa-box text-ocean-green" />
                                                Order Items
                                                <span className="rounded-full bg-aqua-spring px-2.5 py-0.5 text-xs text-ocean-green">
                                                    {Array.isArray(selectedOrder.items)
                                                        ? selectedOrder.items.length
                                                        : 0}
                                                </span>
                                            </h3>

                                            {Array.isArray(selectedOrder.items) &&
                                            selectedOrder.items.length > 0 ? (
                                                <div className="overflow-hidden rounded-xl border border-gray-100">
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full min-w-[600px]">
                                                            <thead className="bg-gray-50">
                                                                <tr>
                                                                    {[
                                                                        "Product",
                                                                        "SKU",
                                                                        "Quantity",
                                                                        "Unit Price",
                                                                        "Total",
                                                                    ].map((heading) => (
                                                                        <th
                                                                            key={heading}
                                                                            className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-text-grey"
                                                                        >
                                                                            {heading}
                                                                        </th>
                                                                    ))}
                                                                </tr>
                                                            </thead>

                                                            <tbody className="divide-y divide-gray-100">
                                                                {selectedOrder.items.map(
                                                                    (item, index) => (
                                                                        <tr
                                                                            key={
                                                                                item.id ||
                                                                                `${item.product_id}-${index}`
                                                                            }
                                                                        >
                                                                            <td className="px-4 py-4">
                                                                                <p className="text-sm font-semibold text-cyprus">
                                                                                    {item.product_name ||
                                                                                        item.name ||
                                                                                        `Product #${item.product_id ||
                                                                                            index + 1}`}
                                                                                </p>
                                                                            </td>
                                                                            <td className="px-4 py-4 text-sm text-text-grey">
                                                                                {item.sku || "—"}
                                                                            </td>
                                                                            <td className="px-4 py-4 text-sm text-cyprus">
                                                                                {Number(
                                                                                    item.quantity || 0
                                                                                )}
                                                                            </td>
                                                                            <td className="px-4 py-4 text-sm text-cyprus">
                                                                                {formatCurrency(
                                                                                    item.unit_price
                                                                                )}
                                                                            </td>
                                                                            <td className="px-4 py-4 text-sm font-bold text-cyprus">
                                                                                {formatCurrency(
                                                                                    item.total ??
                                                                                        Number(
                                                                                            item.unit_price || 0
                                                                                        ) *
                                                                                            Number(
                                                                                                item.quantity || 0
                                                                                            )
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    )
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="rounded-xl border border-gray-100 p-6 text-center">
                                                    <i className="fa-solid fa-box-open text-2xl text-ocean-green" />
                                                    <p className="mt-2 text-sm text-text-grey">
                                                        No product items were returned for this order.
                                                    </p>
                                                </div>
                                            )}
                                        </section>

                                        {/* Price Summary */}
                                        <section>
                                            <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-cyprus">
                                                <i className="fa-solid fa-receipt text-ocean-green" />
                                                Price Summary
                                            </h3>

                                            <div className="rounded-xl border border-gray-100 p-4 sm:p-5">
                                                <div className="space-y-3">
                                                    <div className="flex justify-between gap-4 text-sm">
                                                        <span className="text-text-grey">
                                                            Subtotal
                                                        </span>
                                                        <span className="font-medium text-cyprus">
                                                            {formatCurrency(
                                                                selectedOrder.subtotal
                                                            )}
                                                        </span>
                                                    </div>

                                                    <div className="flex justify-between gap-4 text-sm">
                                                        <span className="text-text-grey">
                                                            Discount
                                                        </span>
                                                        <span className="font-medium text-green-600">
                                                            -{" "}
                                                            {formatCurrency(
                                                                Number(
                                                                    selectedOrder.discount || 0
                                                                ) +
                                                                    Number(
                                                                        selectedOrder.coupon_discount || 0
                                                                    )
                                                            )}
                                                        </span>
                                                    </div>

                                                    <div className="flex justify-between gap-4 text-sm">
                                                        <span className="text-text-grey">
                                                            Tax
                                                        </span>
                                                        <span className="font-medium text-cyprus">
                                                            {formatCurrency(selectedOrder.tax)}
                                                        </span>
                                                    </div>

                                                    <div className="flex justify-between gap-4 text-sm">
                                                        <span className="text-text-grey">
                                                            Shipping Fee
                                                        </span>
                                                        <span className="font-medium text-cyprus">
                                                            {formatCurrency(
                                                                selectedOrder.shipping_fee
                                                            )}
                                                        </span>
                                                    </div>

                                                    <div className="border-t border-dashed border-gray-200 pt-3">
                                                        <div className="flex justify-between gap-4">
                                                            <span className="font-bold text-cyprus">
                                                                Total Amount
                                                            </span>
                                                            <span className="text-xl font-bold text-ocean-green">
                                                                {formatCurrency(
                                                                    selectedOrder.total_amount
                                                                )}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </section>

                                        {/* Update Status */}
                                        <section>
                                            <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-cyprus">
                                                <i className="fa-solid fa-arrows-rotate text-ocean-green" />
                                                Update Order Status
                                            </h3>

                                            {terminalOrder ? (
                                                <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                                                    This order is{" "}
                                                    <strong>
                                                        {formatStatus(
                                                            selectedOrder.order_status
                                                        )}
                                                    </strong>
                                                    . Its status cannot be changed further.
                                                </div>
                                            ) : (
                                                <form
                                                    onSubmit={handleStatusUpdate}
                                                    className="rounded-xl border border-gray-100 p-4 sm:p-5"
                                                >
                                                    <label
                                                        htmlFor="order-status"
                                                        className="mb-2 block text-sm font-semibold text-cyprus"
                                                    >
                                                        New Status
                                                    </label>

                                                    <select
                                                        id="order-status"
                                                        value={selectedStatus}
                                                        onChange={(event) => {
                                                            setSelectedStatus(
                                                                event.target.value
                                                            );
                                                            setStatusMessage("");
                                                            setStatusMessageType("");
                                                        }}
                                                        disabled={updatingStatus}
                                                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm text-cyprus outline-none focus:border-ocean-green focus:ring-2 focus:ring-ocean-green/10"
                                                    >
                                                        {ORDER_STATUSES.map((status) => {
                                                            const allowed =
                                                                status === currentOrderStatus ||
                                                                status === "cancelled" ||
                                                                isStatusChangeAllowed(
                                                                    currentOrderStatus,
                                                                    status
                                                                );

                                                            return (
                                                                <option
                                                                    key={status}
                                                                    value={status}
                                                                    disabled={!allowed}
                                                                >
                                                                    {formatStatus(status)}
                                                                </option>
                                                            );
                                                        })}
                                                    </select>

                                                    <label
                                                        htmlFor="status-note"
                                                        className="mb-2 mt-4 block text-sm font-semibold text-cyprus"
                                                    >
                                                        Note (Optional)
                                                    </label>

                                                    <textarea
                                                        id="status-note"
                                                        rows={3}
                                                        maxLength={2000}
                                                        value={statusNote}
                                                        onChange={(event) =>
                                                            setStatusNote(
                                                                event.target.value
                                                            )
                                                        }
                                                        disabled={updatingStatus}
                                                        placeholder="Add a note about this status change..."
                                                        className="w-full resize-y rounded-lg border border-gray-200 px-3 py-3 text-sm text-cyprus outline-none placeholder:text-text-grey focus:border-ocean-green focus:ring-2 focus:ring-ocean-green/10"
                                                    />

                                                    {statusMessage && (
                                                        <div
                                                            role="status"
                                                            className={`mt-3 rounded-lg border p-3 text-sm ${
                                                                statusMessageType === "success"
                                                                    ? "border-green-200 bg-green-50 text-green-700"
                                                                    : "border-red-200 bg-red-50 text-red-700"
                                                            }`}
                                                        >
                                                            {statusMessage}
                                                        </div>
                                                    )}

                                                    <button
                                                        type="submit"
                                                        disabled={
                                                            updatingStatus ||
                                                            selectedStatus === currentOrderStatus ||
                                                            !isStatusChangeAllowed(
                                                                currentOrderStatus,
                                                                selectedStatus
                                                            )
                                                        }
                                                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-ocean-green px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyprus disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                                                    >
                                                        {updatingStatus ? (
                                                            <>
                                                                <i className="fa-solid fa-spinner fa-spin" />
                                                                Updating...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <i className="fa-solid fa-check" />
                                                                Update Status
                                                            </>
                                                        )}
                                                    </button>
                                                </form>
                                            )}
                                        </section>

                                        {/* Order Status History */}
                                        <section>
                                            <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-cyprus">
                                                <i className="fa-solid fa-clock-rotate-left text-ocean-green" />
                                                Order Status History
                                            </h3>

                                            {Array.isArray(selectedOrder.status_history) &&
                                            selectedOrder.status_history.length > 0 ? (
                                                <div className="rounded-xl border border-gray-100 p-4 sm:p-5">
                                                    <div className="space-y-5">
                                                        {selectedOrder.status_history.map(
                                                            (history, index) => (
                                                                <div
                                                                    key={
                                                                        history.id ||
                                                                        `${getHistoryDate(
                                                                            history
                                                                        )}-${index}`
                                                                    }
                                                                    className="relative flex gap-3"
                                                                >
                                                                    <div className="flex flex-col items-center">
                                                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aqua-spring text-ocean-green">
                                                                            <i className="fa-solid fa-check text-sm" />
                                                                        </span>

                                                                        {index !==
                                                                            selectedOrder.status_history.length -
                                                                                1 && (
                                                                            <span className="mt-1 h-full min-h-6 w-px bg-gray-200" />
                                                                        )}
                                                                    </div>

                                                                    <div className="min-w-0 flex-1 pb-2">
                                                                        <p className="text-sm font-semibold text-cyprus">
                                                                            {formatStatus(
                                                                                getHistoryStatus(
                                                                                    history
                                                                                )
                                                                            )}
                                                                        </p>

                                                                        <p className="mt-1 text-xs text-text-grey">
                                                                            {formatDateTime(
                                                                                getHistoryDate(
                                                                                    history
                                                                                )
                                                                            )}
                                                                        </p>

                                                                        {history.note && (
                                                                            <p className="mt-2 break-words text-sm text-text-grey">
                                                                                {history.note}
                                                                            </p>
                                                                        )}

                                                                        {(history.changed_by_name ||
                                                                            history.admin_name) && (
                                                                            <p className="mt-1 text-xs text-text-grey">
                                                                                Updated by:{" "}
                                                                                {history.changed_by_name ||
                                                                                    history.admin_name}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="rounded-xl border border-gray-100 p-5 text-center">
                                                    <i className="fa-solid fa-clock-rotate-left text-2xl text-ocean-green" />
                                                    <p className="mt-2 text-sm text-text-grey">
                                                        No status history available.
                                                    </p>
                                                </div>
                                            )}
                                        </section>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="flex shrink-0 justify-end border-t border-gray-100 bg-white px-5 py-4 sm:px-7">
                                <button
                                    type="button"
                                    onClick={closeOrderDetails}
                                    disabled={updatingStatus}
                                    className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-semibold text-cyprus transition hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PendingOrders;