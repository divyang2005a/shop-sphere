import React, { useState, useEffect, useCallback } from "react";

const API_BASE_URL = "http://192.168.1.10:5000/api";
const ORDERS_API = `${API_BASE_URL}/admin/orders`;

const ORDER_STATUSES = [
"confirmed",
"processing",
"packed",
"shipped",
"delivered",
"cancelled",
];

const ORDERS_PER_PAGE = 5;

function Orders() {
const [search, setSearch] = useState("");
const [status, setStatus] = useState("All");
const [paymentStatus, setPaymentStatus] = useState("All");

const [orders, setOrders] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState("");

const [selectedOrder, setSelectedOrder] = useState(null);
const [detailsLoading, setDetailsLoading] = useState(false);
const [detailsError, setDetailsError] = useState("");

const [selectedStatus, setSelectedStatus] = useState("");
const [statusNote, setStatusNote] = useState("");
const [actionMessage, setActionMessage] = useState("");
const [updating, setUpdating] = useState(false);

// COD cash confirmation state
const [cashReceived, setCashReceived] = useState(false);

// Confirmation modal state
const [showConfirmModal, setShowConfirmModal] = useState(false);

// Success/error notification modal
const [notification, setNotification] = useState(null);

// Pagination state
const [currentPage, setCurrentPage] = useState(1);

const getToken = () => {
    return (
        localStorage.getItem("shopsphereToken") ||
        localStorage.getItem("token")
    );
};

// Format status
const formatStatus = (value) => {
    if (!value) return "Unknown";

    return String(value)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

// Format payment
const formatPayment = (value) => {
    if (!value) return "Unknown";

    return String(value)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

// Format date
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

// Format currency
const formatCurrency = (value) => {
    const amount = Number(value || 0);

    return `₹${amount.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

// Check whether the selected order uses Cash on Delivery
const isCodOrder = (order) => {
    const paymentMethod = String(
        order?.payment_method || order?.payment_type || ""
    )
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");

    return [
        "cod",
        "cash_on_delivery",
        "cashondelivery",
    ].includes(paymentMethod);
};

// Normalize API order
const normalizeOrder = (order) => ({
    id: order.order_id ?? order.id,
    orderNumber:
        order.order_number || `ORD-${order.order_id ?? order.id}`,
    customer: order.customer_name || "Unknown Customer",
    email: order.customer_email || "—",
    mobile: order.customer_mobile || "—",
    date: formatDate(order.created_at),
    items: Number(order.items_count || 0),
    total: Number(order.total_amount || 0),
    status: formatStatus(order.order_status),
    rawStatus: String(order.order_status || "").toLowerCase(),
    payment: formatPayment(order.payment_status),
    rawPayment: String(order.payment_status || "").toLowerCase(),
});

// Fetch orders from backend
const fetchOrders = useCallback(async () => {
    try {
        setLoading(true);
        setError("");

        const token = getToken();

        if (!token) {
            throw new Error(
                "Authentication token not found. Please log in again."
            );
        }

        const params = new URLSearchParams();

        if (search.trim()) {
            params.set("search", search.trim());
        }

        if (status !== "All") {
            params.set("status", status.toLowerCase());
        }

        const queryString = params.toString();

        const url = queryString
            ? `${ORDERS_API}?${queryString}`
            : ORDERS_API;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            if (response.status === 401 || response.status === 403) {
                throw new Error(
                    "You are not authorized to access orders. Please log in again with your admin account."
                );
            }

            throw new Error(data.message || "Failed to fetch orders.");
        }

        const apiOrders = Array.isArray(data.orders)
            ? data.orders
            : [];

        setOrders(apiOrders.map(normalizeOrder));
    } catch (err) {
        setError(
            err.message || "Unable to load orders. Please try again."
        );
    } finally {
        setLoading(false);
    }
}, [search, status]);

// Load orders when filters change
useEffect(() => {
    const timer = setTimeout(
        () => {
            fetchOrders();
        },
        search.trim() ? 350 : 0
    );

    return () => clearTimeout(timer);
}, [fetchOrders, search]);

// Reset pagination when filters change
useEffect(() => {
    setCurrentPage(1);
}, [search, status, paymentStatus]);

// Status badge colors
const getStatusClass = (value) => {
    const normalized = String(value || "").toLowerCase();

    if (normalized === "delivered") {
        return "bg-green-100 text-green-700";
    }

    if (normalized === "processing") {
        return "bg-blue-100 text-blue-700";
    }

    if (normalized === "pending") {
        return "bg-yellow-100 text-yellow-700";
    }

    if (normalized === "confirmed") {
        return "bg-cyan-100 text-cyan-700";
    }

    if (normalized === "packed") {
        return "bg-indigo-100 text-indigo-700";
    }

    if (normalized === "shipped") {
        return "bg-purple-100 text-purple-700";
    }

    if (normalized === "cancelled") {
        return "bg-red-100 text-red-700";
    }

    return "bg-gray-100 text-gray-700";
};

// Payment badge colors
const getPaymentClass = (value) => {
    const normalized = String(value || "").toLowerCase();

    if (
        ["paid", "completed", "success", "successful"].includes(normalized)
    ) {
        return "bg-green-100 text-green-700";
    }

    if (["pending", "unpaid"].includes(normalized)) {
        return "bg-yellow-100 text-yellow-700";
    }

    if (["refunded", "failed", "cancelled"].includes(normalized)) {
        return "bg-red-100 text-red-700";
    }

    return "bg-gray-100 text-gray-700";
};

// Filter orders by payment status
const filteredOrders = orders.filter((order) => {
    if (paymentStatus === "All") {
        return true;
    }

    return order.rawPayment === paymentStatus.toLowerCase();
});

// Pagination calculations
const totalFilteredOrders = filteredOrders.length;

const totalPages = Math.max(
    1,
    Math.ceil(totalFilteredOrders / ORDERS_PER_PAGE)
);

const safeCurrentPage = Math.min(currentPage, totalPages);

const startIndex = (safeCurrentPage - 1) * ORDERS_PER_PAGE;

const endIndex = Math.min(
    startIndex + ORDERS_PER_PAGE,
    totalFilteredOrders
);

const currentOrders = filteredOrders.slice(startIndex, endIndex);

// Statistics
const totalOrders = orders.length;

const pendingOrders = orders.filter(
    (order) => order.rawStatus === "pending"
).length;

const processingOrders = orders.filter(
    (order) => order.rawStatus === "processing"
).length;

const deliveredOrders = orders.filter(
    (order) => order.rawStatus === "delivered"
).length;

// Fetch one order's details
const handleViewOrder = async (orderId) => {
    try {
        setDetailsLoading(true);
        setDetailsError("");
        setActionMessage("");
        setSelectedOrder(null);
        setSelectedStatus("");
        setStatusNote("");
        setCashReceived(false);
        setShowConfirmModal(false);

        const token = getToken();

        if (!token) {
            throw new Error("Please log in again.");
        }

        const response = await fetch(`${ORDERS_API}/${orderId}`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || "Failed to load order details."
            );
        }

        setSelectedOrder(data.order);

        setSelectedStatus(
            String(data.order.order_status || "").toLowerCase()
        );
    } catch (err) {
        setDetailsError(
            err.message || "Unable to load order details."
        );
    } finally {
        setDetailsLoading(false);
    }
};

// Open custom confirmation modal
const handleUpdateStatus = (e) => {
    e.preventDefault();

    if (!selectedOrder) return;

    const currentStatus = String(
        selectedOrder.order_status || ""
    ).toLowerCase();

    if (selectedStatus === currentStatus) {
        setActionMessage("Please select a different order status.");
        return;
    }

    setActionMessage("");
    setDetailsError("");
    setShowConfirmModal(true);
};

// Perform status update after confirmation
const confirmStatusUpdate = async () => {
    if (!selectedOrder) return;

    const orderId = selectedOrder.order_id ?? selectedOrder.id;

    // Order status and shipment status have different values.
    const shipmentStatusMap = {
        packed: "ready_to_ship",
        shipped: "shipped",
        delivered: "delivered",
        cancelled: "cancelled",
    };

    const shipmentStatus = shipmentStatusMap[selectedStatus];

    // COD delivery requires a boolean cash_received value.
    const requiresCashConfirmation =
        selectedStatus === "delivered" && isCodOrder(selectedOrder);

    try {
        setUpdating(true);
        setShowConfirmModal(false);
        setActionMessage("");
        setDetailsError("");

        const token = getToken();

        if (!token) {
            throw new Error("Please log in again.");
        }

        // Reusable API request helper
        const apiRequest = async (url, options = {}) => {
            const response = await fetch(url, {
                ...options,
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                    ...options.headers,
                },
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Something went wrong."
                );
            }

            return data;
        };

        // Step 1: Update shipment when a shipping milestone changes.
        if (shipmentStatus) {
            const shipmentData = await apiRequest(
                `${API_BASE_URL}/shipments/admin`,
                {
                    method: "GET",
                }
            );

            const shipments = Array.isArray(shipmentData.shipments)
                ? shipmentData.shipments
                : [];

            const shipment = shipments.find(
                (item) =>
                    Number(item.order_id) === Number(orderId)
            );

            if (!shipment) {
                throw new Error(
                    "No shipment found for this order. Please create a shipment before updating its shipping status."
                );
            }

            // Build shipment request body.
            const shipmentRequestBody = {
                status: shipmentStatus,
                location: null,
                description:
                    statusNote.trim() ||
                    `Shipment status updated to ${shipmentStatus.replace(
                        /_/g,
                        " "
                    )}`,
            };

            // IMPORTANT:
            // The backend requires cash_received to be a boolean
            // when a COD order is being marked as delivered.
            if (requiresCashConfirmation) {
                shipmentRequestBody.cash_received = Boolean(cashReceived);
            }

            // Update shipment status and create tracking history.
            await apiRequest(
                `${API_BASE_URL}/shipments/admin/${shipment.id}/status`,
                {
                    method: "PATCH",
                    body: JSON.stringify(shipmentRequestBody),
                }
            );
        }

        // Step 2:
        // The shipment controller synchronizes order status
        // for shipped and delivered.
        // For packed and cancelled, update the order separately.
        const shipmentHandlesOrderStatus = [
            "shipped",
            "delivered",
        ].includes(selectedStatus);

        if (!shipmentHandlesOrderStatus) {
            await apiRequest(`${ORDERS_API}/${orderId}/status`, {
                method: "PATCH",
                body: JSON.stringify({
                    status: selectedStatus,
                    note: statusNote.trim(),
                }),
            });
        }

        // Step 3: Refresh order details.
        const detailData = await apiRequest(
            `${ORDERS_API}/${orderId}`,
            {
                method: "GET",
            }
        );

        setSelectedOrder(detailData.order);

        setSelectedStatus(
            String(
                detailData.order.order_status || ""
            ).toLowerCase()
        );

        // Step 4: Refresh order table and statistics.
        await fetchOrders();

        setActionMessage(
            "Order and shipment status updated successfully."
        );

        setNotification({
            type: "success",
            title: "Status Updated Successfully!",
            message: `Order status changed to ${formatStatus(
                selectedStatus
            )}. Shipment tracking history has also been updated where applicable.`,
        });
    } catch (err) {
        console.error("Order/shipment status update error:", err);

        setDetailsError(
            err.message || "Unable to update order status."
        );

        setNotification({
            type: "error",
            title: "Status Update Failed",
            message:
                err.message ||
                "Unable to update order and shipment status.",
        });
    } finally {
        setUpdating(false);
    }
};

// Reset filters
const handleReset = () => {
    setSearch("");
    setStatus("All");
    setPaymentStatus("All");
    setCurrentPage(1);
    setError("");
};

// Pagination button
const changePage = (page) => {
    if (page < 1 || page > totalPages) return;

    setCurrentPage(page);

    document
        .getElementById("orders-list")
        ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
};

// Close order details modal
const closeDetailsModal = () => {
    if (updating) return;

    setSelectedOrder(null);
    setDetailsError("");
    setActionMessage("");
    setShowConfirmModal(false);
    setCashReceived(false);
};

return (
    <div className="min-h-full bg-aqua-spring p-4 sm:p-6 lg:p-8">
        <style>{`
            .shopsphere-no-scrollbar {
                scrollbar-width: none;
                -ms-overflow-style: none;
            }

            .shopsphere-no-scrollbar::-webkit-scrollbar {
                display: none;
                width: 0;
                height: 0;
            }

            .shopsphere-modal-open {
                overflow: hidden;
            }
        `}</style>

        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
                <p className="text-sm font-medium text-ocean-green">
                    Order Management
                </p>

                <h1 className="mt-1 text-2xl font-bold text-cyprus sm:text-3xl">
                    All Orders
                </h1>

                <p className="mt-1 text-sm text-text-grey">
                    Manage and track all customer orders.
                </p>
            </div>

            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={handleReset}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-cyprus transition hover:bg-gray-50"
                >
                    <i className="fa-solid fa-rotate-left mr-2" />
                    Reset
                </button>

                <button
                    type="button"
                    onClick={fetchOrders}
                    disabled={loading}
                    className="rounded-lg bg-ocean-green px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyprus disabled:opacity-60"
                >
                    <i
                        className={`fa-solid ${
                            loading
                                ? "fa-spinner fa-spin"
                                : "fa-rotate"
                        } mr-2`}
                    />
                    Refresh
                </button>
            </div>
        </div>

        {/* Statistics */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
                {
                    label: "Total Orders",
                    count: totalOrders,
                    icon: "fa-cart-shopping",
                    iconClass: "bg-aqua-spring text-ocean-green",
                },
                {
                    label: "Pending",
                    count: pendingOrders,
                    icon: "fa-clock",
                    iconClass: "bg-yellow-50 text-yellow-600",
                },
                {
                    label: "Processing",
                    count: processingOrders,
                    icon: "fa-box",
                    iconClass: "bg-blue-50 text-blue-600",
                },
                {
                    label: "Delivered",
                    count: deliveredOrders,
                    icon: "fa-circle-check",
                    iconClass: "bg-green-50 text-green-600",
                },
            ].map((item) => (
                <div
                    key={item.label}
                    className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-text-grey">
                                {item.label}
                            </p>

                            <h2 className="mt-2 text-2xl font-bold text-cyprus">
                                {item.count}
                            </h2>
                        </div>

                        <div
                            className={`flex h-12 w-12 items-center justify-center rounded-xl ${item.iconClass}`}
                        >
                            <i className={`fa-solid ${item.icon} text-lg`} />
                        </div>
                    </div>
                </div>
            ))}
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                    <label className="mb-2 block text-sm font-semibold text-cyprus">
                        Search Orders
                    </label>

                    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5">
                        <i className="fa-solid fa-magnifying-glass text-sm text-text-grey" />

                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Order ID, customer, email..."
                            className="w-full bg-transparent text-sm text-cyprus outline-none placeholder:text-text-grey"
                        />
                    </div>
                </div>

                <div>
                    <label className="mb-2 block text-sm font-semibold text-cyprus">
                        Order Status
                    </label>

                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-cyprus outline-none focus:border-ocean-green"
                    >
                        <option value="All">All Status</option>
                        <option value="pending">Pending</option>

                        {ORDER_STATUSES.map((item) => (
                            <option key={item} value={item}>
                                {formatStatus(item)}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="mb-2 block text-sm font-semibold text-cyprus">
                        Payment Status
                    </label>

                    <select
                        value={paymentStatus}
                        onChange={(e) => setPaymentStatus(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-cyprus outline-none focus:border-ocean-green"
                    >
                        <option value="All">All Payments</option>
                        <option value="paid">Paid</option>
                        <option value="pending">Pending</option>
                        <option value="unpaid">Unpaid</option>
                        <option value="refunded">Refunded</option>
                        <option value="failed">Failed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>
            </div>
        </div>

        {/* API Error */}
        {error && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <i className="fa-solid fa-circle-exclamation mt-0.5" />

                <div className="flex-1">
                    <p className="font-semibold">
                        Unable to load orders
                    </p>

                    <p className="mt-1">{error}</p>

                    <button
                        type="button"
                        onClick={fetchOrders}
                        className="mt-2 font-semibold underline"
                    >
                        Try again
                    </button>
                </div>
            </div>
        )}

        {/* Orders List */}
        <div id="orders-list" className="scroll-mt-6">
            {!loading && !error && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-text-grey">
                        Showing{" "}
                        <span className="font-semibold text-cyprus">
                            {totalFilteredOrders === 0 ? 0 : startIndex + 1}
                            –{endIndex}
                        </span>{" "}
                        of{" "}
                        <span className="font-semibold text-cyprus">
                            {totalFilteredOrders}
                        </span>{" "}
                        orders
                    </p>

                    <p className="text-xs text-text-grey">
                        5 orders per page
                    </p>
                </div>
            )}

            {/* Desktop Table */}
            <div className="hidden overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm lg:block">
                <div className="shopsphere-no-scrollbar overflow-x-auto">
                    <table className="w-full min-w-[1000px]">
                        <thead className="border-b border-gray-100 bg-gray-50">
                            <tr>
                                {[
                                    "Order",
                                    "Customer",
                                    "Date",
                                    "Items",
                                    "Total",
                                    "Status",
                                    "Payment",
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
                            {loading && (
                                <tr>
                                    <td
                                        colSpan="8"
                                        className="px-6 py-16 text-center"
                                    >
                                        <i className="fa-solid fa-spinner fa-spin text-3xl text-ocean-green" />
                                        <p className="mt-4 text-sm text-text-grey">
                                            Loading orders...
                                        </p>
                                    </td>
                                </tr>
                            )}

                            {!loading &&
                                !error &&
                                currentOrders.map((order) => (
                                    <tr
                                        key={order.id}
                                        className="transition hover:bg-gray-50"
                                    >
                                        <td className="px-5 py-4">
                                            <p className="text-sm font-bold text-cyprus">
                                                {order.orderNumber}
                                            </p>
                                        </td>

                                        <td className="px-5 py-4">
                                            <p className="text-sm font-semibold text-cyprus">
                                                {order.customer}
                                            </p>
                                            <p className="mt-1 text-xs text-text-grey">
                                                {order.email}
                                            </p>
                                        </td>

                                        <td className="px-5 py-4 text-sm text-text-grey">
                                            {order.date}
                                        </td>

                                        <td className="px-5 py-4 text-sm text-cyprus">
                                            {order.items}
                                        </td>

                                        <td className="px-5 py-4">
                                            <p className="text-sm font-bold text-cyprus">
                                                {formatCurrency(order.total)}
                                            </p>
                                        </td>

                                        <td className="px-5 py-4">
                                            <span
                                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                                                    order.status
                                                )}`}
                                            >
                                                {order.status}
                                            </span>
                                        </td>

                                        <td className="px-5 py-4">
                                            <span
                                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getPaymentClass(
                                                    order.payment
                                                )}`}
                                            >
                                                {order.payment}
                                            </span>
                                        </td>

                                        <td className="px-5 py-4">
                                            <div className="flex items-center justify-center">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleViewOrder(order.id)
                                                    }
                                                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-aqua-spring text-ocean-green transition hover:bg-ocean-green hover:text-white"
                                                    title="View Order"
                                                >
                                                    <i className="fa-solid fa-eye text-sm" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>

                {!loading &&
                    !error &&
                    filteredOrders.length === 0 && <EmptyOrders />}
            </div>

            {/* Mobile Order Cards */}
            <div className="space-y-4 lg:hidden">
                {loading && (
                    <div className="rounded-xl bg-white px-6 py-16 text-center shadow-sm">
                        <i className="fa-solid fa-spinner fa-spin text-3xl text-ocean-green" />
                        <p className="mt-4 text-sm text-text-grey">
                            Loading orders...
                        </p>
                    </div>
                )}

                {!loading &&
                    !error &&
                    currentOrders.map((order) => (
                        <div
                            key={order.id}
                            className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-bold text-cyprus">
                                        {order.orderNumber}
                                    </p>
                                    <p className="mt-1 text-xs text-text-grey">
                                        {order.date}
                                    </p>
                                </div>

                                <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                                        order.status
                                    )}`}
                                >
                                    {order.status}
                                </span>
                            </div>

                            <div className="my-4 border-t border-gray-100" />

                            <div>
                                <p className="text-xs text-text-grey">
                                    Customer
                                </p>
                                <p className="mt-1 text-sm font-semibold text-cyprus">
                                    {order.customer}
                                </p>
                                <p className="mt-1 break-all text-xs text-text-grey">
                                    {order.email}
                                </p>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-text-grey">
                                        Items
                                    </p>
                                    <p className="mt-1 text-sm font-bold text-cyprus">
                                        {order.items}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs text-text-grey">
                                        Total
                                    </p>
                                    <p className="mt-1 text-sm font-bold text-cyprus">
                                        {formatCurrency(order.total)}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4">
                                <p className="text-xs text-text-grey">
                                    Payment
                                </p>
                                <span
                                    className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getPaymentClass(
                                        order.payment
                                    )}`}
                                >
                                    {order.payment}
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={() => handleViewOrder(order.id)}
                                className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-aqua-spring px-4 py-2.5 text-sm font-semibold text-ocean-green transition hover:bg-ocean-green hover:text-white"
                            >
                                <i className="fa-solid fa-eye" />
                                View Order
                            </button>
                        </div>
                    ))}

                {!loading &&
                    !error &&
                    filteredOrders.length === 0 && <EmptyOrders />}
            </div>

            {/* Pagination */}
            {!loading && !error && totalFilteredOrders > 0 && (
                <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row">
                    <p className="text-sm text-text-grey">
                        Page{" "}
                        <span className="font-semibold text-cyprus">
                            {safeCurrentPage}
                        </span>{" "}
                        of{" "}
                        <span className="font-semibold text-cyprus">
                            {totalPages}
                        </span>
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                            type="button"
                            onClick={() => changePage(safeCurrentPage - 1)}
                            disabled={safeCurrentPage === 1}
                            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-cyprus transition hover:border-ocean-green hover:text-ocean-green disabled:cursor-not-allowed disabled:opacity-40"
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
                                onClick={() => changePage(page)}
                                aria-current={
                                    page === safeCurrentPage
                                        ? "page"
                                        : undefined
                                }
                                className={`flex h-10 min-w-10 items-center justify-center rounded-lg px-3 text-sm font-semibold transition ${
                                    page === safeCurrentPage
                                        ? "bg-ocean-green text-white"
                                        : "border border-gray-200 bg-white text-cyprus hover:border-ocean-green hover:text-ocean-green"
                                }`}
                            >
                                {page}
                            </button>
                        ))}

                        <button
                            type="button"
                            onClick={() => changePage(safeCurrentPage + 1)}
                            disabled={safeCurrentPage === totalPages}
                            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-cyprus transition hover:border-ocean-green hover:text-ocean-green disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Next
                            <i className="fa-solid fa-chevron-right text-xs" />
                        </button>
                    </div>
                </div>
            )}
        </div>

        {/* Order Details Modal */}
        {(detailsLoading || detailsError || selectedOrder) && (
            <div
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
                onClick={closeDetailsModal}
            >
                <div
                    className="shopsphere-no-scrollbar max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Modal Header */}
                    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white p-5">
                        <div>
                            <h2 className="text-xl font-bold text-cyprus">
                                Order Details
                            </h2>

                            {selectedOrder && (
                                <p className="mt-1 text-sm text-text-grey">
                                    {selectedOrder.order_number}
                                </p>
                            )}
                        </div>

                        <button
                            type="button"
                            disabled={updating}
                            onClick={closeDetailsModal}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-text-grey transition hover:bg-gray-100 disabled:opacity-50"
                            aria-label="Close order details"
                        >
                            <i className="fa-solid fa-xmark text-lg" />
                        </button>
                    </div>

                    <div className="p-5 sm:p-6">
                        {detailsLoading && (
                            <div className="py-12 text-center">
                                <i className="fa-solid fa-spinner fa-spin text-3xl text-ocean-green" />
                                <p className="mt-3 text-sm text-text-grey">
                                    Loading order details...
                                </p>
                            </div>
                        )}

                        {detailsError && (
                            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                {detailsError}
                            </div>
                        )}

                        {selectedOrder && (
                            <>
                                {/* Customer Information */}
                                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                    <h3 className="font-bold text-cyprus">
                                        Customer Information
                                    </h3>

                                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <InfoItem
                                            label="Name"
                                            value={
                                                selectedOrder.customer_name || "—"
                                            }
                                        />

                                        <InfoItem
                                            label="Email"
                                            value={
                                                selectedOrder.customer_email || "—"
                                            }
                                        />

                                        <InfoItem
                                            label="Mobile"
                                            value={
                                                selectedOrder.customer_mobile || "—"
                                            }
                                        />

                                        <InfoItem
                                            label="Order Date"
                                            value={formatDate(
                                                selectedOrder.created_at
                                            )}
                                        />
                                    </div>
                                </div>

                                {/* Order Summary */}
                                <div className="mt-4 rounded-xl border border-gray-100 p-4">
                                    <h3 className="font-bold text-cyprus">
                                        Order Summary
                                    </h3>

                                    <div className="mt-3 space-y-3 text-sm">
                                        {[
                                            ["Subtotal", selectedOrder.subtotal],
                                            ["Discount", selectedOrder.discount],
                                            [
                                                "Coupon Discount",
                                                selectedOrder.coupon_discount,
                                            ],
                                            ["Tax", selectedOrder.tax],
                                            [
                                                "Shipping Fee",
                                                selectedOrder.shipping_fee,
                                            ],
                                        ].map(([label, amount]) => (
                                            <div
                                                key={label}
                                                className="flex justify-between gap-3"
                                            >
                                                <span className="text-text-grey">
                                                    {label}
                                                </span>
                                                <span className="font-medium text-cyprus">
                                                    {formatCurrency(amount)}
                                                </span>
                                            </div>
                                        ))}

                                        <div className="flex justify-between gap-3 border-t border-gray-100 pt-3">
                                            <span className="font-bold text-cyprus">
                                                Total
                                            </span>
                                            <span className="text-lg font-bold text-ocean-green">
                                                {formatCurrency(
                                                    selectedOrder.total_amount
                                                )}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <span
                                            className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                                                selectedOrder.order_status
                                            )}`}
                                        >
                                            {formatStatus(
                                                selectedOrder.order_status
                                            )}
                                        </span>

                                        <span
                                            className={`rounded-full px-3 py-1 text-xs font-semibold ${getPaymentClass(
                                                selectedOrder.payment_status
                                            )}`}
                                        >
                                            Payment:{" "}
                                            {formatPayment(
                                                selectedOrder.payment_status
                                            )}
                                        </span>
                                    </div>
                                </div>

                                {/* Order Items */}
                                <div className="mt-4 rounded-xl border border-gray-100 p-4">
                                    <h3 className="font-bold text-cyprus">
                                        Order Items (
                                        {Array.isArray(selectedOrder.items)
                                            ? selectedOrder.items.length
                                            : 0}
                                        )
                                    </h3>

                                    {Array.isArray(selectedOrder.items) &&
                                    selectedOrder.items.length > 0 ? (
                                        <div className="mt-3 space-y-3">
                                            {selectedOrder.items.map(
                                                (item, index) => (
                                                    <div
                                                        key={
                                                            item.id ??
                                                            `${item.product_id}-${index}`
                                                        }
                                                        className="flex items-start justify-between gap-4 border-b border-gray-100 pb-3 last:border-0 last:pb-0"
                                                    >
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold text-cyprus">
                                                                {item.product_name ||
                                                                    "Product"}
                                                            </p>

                                                            <p className="mt-1 text-xs text-text-grey">
                                                                SKU:{" "}
                                                                {item.sku || "—"}
                                                            </p>

                                                            <p className="mt-1 text-xs text-text-grey">
                                                                Quantity:{" "}
                                                                {item.quantity}
                                                            </p>
                                                        </div>

                                                        <p className="shrink-0 text-sm font-bold text-cyprus">
                                                            {formatCurrency(
                                                                item.total
                                                            )}
                                                        </p>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    ) : (
                                        <p className="mt-3 text-sm text-text-grey">
                                            No order items found.
                                        </p>
                                    )}
                                </div>

                                {/* Status History */}
                                <div className="mt-4 rounded-xl border border-gray-100 p-4">
                                    <h3 className="font-bold text-cyprus">
                                        Status History
                                    </h3>

                                    {Array.isArray(
                                        selectedOrder.status_history
                                    ) &&
                                    selectedOrder.status_history.length > 0 ? (
                                        <div className="mt-4 space-y-4">
                                            {selectedOrder.status_history.map(
                                                (history, index) => (
                                                    <div
                                                        key={
                                                            history.id ??
                                                            `${history.status}-${index}`
                                                        }
                                                        className="flex gap-3"
                                                    >
                                                        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-aqua-spring text-ocean-green">
                                                            <i className="fa-solid fa-clock-rotate-left text-xs" />
                                                        </div>

                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold text-cyprus">
                                                                {formatStatus(
                                                                    history.status
                                                                )}
                                                            </p>

                                                            {history.note && (
                                                                <p className="mt-1 text-sm text-text-grey">
                                                                    {history.note}
                                                                </p>
                                                            )}

                                                            <p className="mt-1 text-xs text-text-grey">
                                                                {formatDate(
                                                                    history.created_at
                                                                )}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    ) : (
                                        <p className="mt-3 text-sm text-text-grey">
                                            No status history available.
                                        </p>
                                    )}
                                </div>

                                {/* Update Status Form */}
                                <form
                                    onSubmit={handleUpdateStatus}
                                    className="mt-4 rounded-xl border border-gray-100 p-4"
                                >
                                    <h3 className="font-bold text-cyprus">
                                        Update Order Status
                                    </h3>

                                    <div className="mt-4">
                                        <label className="mb-2 block text-sm font-semibold text-cyprus">
                                            New Status
                                        </label>

                                        <select
                                            value={selectedStatus}
                                            onChange={(e) => {
                                                setSelectedStatus(
                                                    e.target.value
                                                );
                                                setActionMessage("");
                                                setCashReceived(false);
                                            }}
                                            disabled={updating}
                                            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-cyprus outline-none focus:border-ocean-green disabled:opacity-60"
                                        >
                                            {ORDER_STATUSES.map((item) => (
                                                <option
                                                    key={item}
                                                    value={item}
                                                >
                                                    {formatStatus(item)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* COD Cash Received Confirmation */}
                                    {selectedStatus === "delivered" &&
                                        isCodOrder(selectedOrder) && (
                                            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                                                <div className="flex items-start gap-3">
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                                                        <i className="fa-solid fa-money-bill-wave" />
                                                    </div>

                                                    <div>
                                                        <h4 className="text-sm font-bold text-amber-900">
                                                            Cash on Delivery
                                                        </h4>

                                                        <p className="mt-1 text-sm text-amber-800">
                                                            Confirm whether the delivery agent collected cash from the customer.
                                                        </p>
                                                    </div>
                                                </div>

                                                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-amber-200 bg-white p-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={cashReceived}
                                                        onChange={(e) =>
                                                            setCashReceived(
                                                                e.target.checked
                                                            )
                                                        }
                                                        disabled={updating}
                                                        className="mt-1 h-4 w-4 accent-green-600"
                                                    />

                                                    <span>
                                                        <span className="block text-sm font-semibold text-cyprus">
                                                            Cash received from customer
                                                        </span>

                                                        <span className="mt-1 block text-xs text-text-grey">
                                                            Check this only if the payment was actually collected.
                                                        </span>
                                                    </span>
                                                </label>

                                                <p className="mt-2 text-xs text-amber-800">
                                                    {cashReceived
                                                        ? "Cash will be recorded as received."
                                                        : "Cash will be recorded as not received."}
                                                </p>
                                            </div>
                                        )}

                                    <div className="mt-4">
                                        <label className="mb-2 block text-sm font-semibold text-cyprus">
                                            Note (Optional)
                                        </label>

                                        <textarea
                                            value={statusNote}
                                            onChange={(e) =>
                                                setStatusNote(e.target.value)
                                            }
                                            maxLength={2000}
                                            rows={3}
                                            placeholder="Enter a note about this status change..."
                                            disabled={updating}
                                            className="shopsphere-no-scrollbar w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-cyprus outline-none focus:border-ocean-green disabled:opacity-60"
                                        />

                                        <p className="mt-1 text-right text-xs text-text-grey">
                                            {statusNote.length}/2000
                                        </p>
                                    </div>

                                    {actionMessage && (
                                        <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                                            {actionMessage}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={
                                            updating ||
                                            selectedStatus ===
                                                String(
                                                    selectedOrder.order_status ||
                                                        ""
                                                ).toLowerCase()
                                        }
                                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-ocean-green px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyprus disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {updating ? (
                                            <>
                                                <i className="fa-solid fa-spinner fa-spin" />
                                                Updating Status...
                                            </>
                                        ) : (
                                            <>
                                                <i className="fa-solid fa-check" />
                                                Update Status
                                            </>
                                        )}
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* Center Confirmation Modal */}
        {showConfirmModal && selectedOrder && (
            <div
                className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
                onClick={() => {
                    if (!updating) setShowConfirmModal(false);
                }}
            >
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="confirm-status-title"
                    className="w-full max-w-md animate-[fadeIn_0.2s_ease-out] rounded-2xl bg-white p-6 shadow-2xl sm:p-7"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-500">
                        <i className="fa-solid fa-circle-question text-3xl" />
                    </div>

                    <h2
                        id="confirm-status-title"
                        className="mt-5 text-center text-xl font-bold text-cyprus"
                    >
                        Confirm Status Update
                    </h2>

                    <p className="mt-2 text-center text-sm leading-6 text-text-grey">
                        Are you sure you want to change the status of order{" "}
                        <span className="font-bold text-cyprus">
                            {selectedOrder.order_number || "this order"}
                        </span>
                        ?
                    </p>

                    <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <p className="text-center text-xs font-medium uppercase tracking-wide text-text-grey">
                            New order status
                        </p>

                        <div className="mt-3 flex items-center justify-center gap-3">
                            <span
                                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${getStatusClass(
                                    selectedStatus
                                )}`}
                            >
                                {formatStatus(selectedStatus)}
                            </span>
                        </div>

                        {selectedStatus === "delivered" &&
                            isCodOrder(selectedOrder) && (
                                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                                    <p className="text-sm font-semibold text-amber-900">
                                        COD Cash Confirmation
                                    </p>

                                    <p className="mt-1 text-sm text-amber-800">
                                        {cashReceived
                                            ? "Cash received: Yes"
                                            : "Cash received: No"}
                                    </p>
                                </div>
                            )}

                        {statusNote.trim() && (
                            <p className="mt-3 break-words text-center text-xs text-text-grey">
                                Note: {statusNote.trim()}
                            </p>
                        )}
                    </div>

                    <p className="mt-4 text-center text-xs text-text-grey">
                        This action will update the order status.
                    </p>

                    <div className="mt-6 grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            disabled={updating}
                            onClick={() => setShowConfirmModal(false)}
                            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-cyprus transition hover:bg-gray-50 disabled:opacity-50"
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            disabled={updating}
                            onClick={confirmStatusUpdate}
                            className="flex items-center justify-center gap-2 rounded-xl bg-ocean-green px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyprus disabled:opacity-50"
                        >
                            {updating ? (
                                <>
                                    <i className="fa-solid fa-spinner fa-spin" />
                                    Updating...
                                </>
                            ) : (
                                <>
                                    <i className="fa-solid fa-check" />
                                    Yes, Confirm
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Success / Error Notification Modal */}
        {notification && (
            <div
                className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                onClick={() => setNotification(null)}
            >
                <div
                    role="alertdialog"
                    aria-modal="true"
                    className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div
                        className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
                            notification.type === "success"
                                ? "bg-green-50 text-green-600"
                                : "bg-red-50 text-red-600"
                        }`}
                    >
                        <i
                            className={`fa-solid ${
                                notification.type === "success"
                                    ? "fa-circle-check"
                                    : "fa-circle-exclamation"
                            } text-3xl`}
                        />
                    </div>

                    <h2 className="mt-4 text-xl font-bold text-cyprus">
                        {notification.title}
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-text-grey">
                        {notification.message}
                    </p>

                    <button
                        type="button"
                        onClick={() => setNotification(null)}
                        className="mt-6 w-full rounded-xl bg-ocean-green px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyprus"
                    >
                        OK
                    </button>
                </div>
            </div>
        )}
    </div>
);

}

// Reusable empty state
function EmptyOrders() {
return (
<div className="rounded-xl border border-gray-100 bg-white px-6 py-16 text-center shadow-sm">
<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-aqua-spring text-ocean-green">
<i className="fa-solid fa-box-open text-2xl" />
</div>

        <h3 className="mt-4 text-lg font-bold text-cyprus">
            No orders found
        </h3>

        <p className="mt-2 text-sm text-text-grey">
            Try changing your search or filters.
        </p>
    </div>
);

}

// Reusable customer information item
function InfoItem({ label, value }) {
return (
<div>
<p className="text-xs text-text-grey">{label}</p>
<p className="mt-1 break-words text-sm font-semibold text-cyprus">
{value}
</p>
</div>
);
}

export default Orders;