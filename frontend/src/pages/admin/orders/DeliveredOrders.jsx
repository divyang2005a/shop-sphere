import React, { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL = "http://192.168.1.10:5000/api";

// Format date
const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

// Format currency
const formatCurrency = (value) => {
    return `₹${Number(value ?? 0).toLocaleString("en-IN", {
        maximumFractionDigits: 2,
    })}`;
};

// Normalize payment status
const normalizePayment = (value) => {
    const status = String(value || "").toLowerCase();

    if (["paid", "completed", "success", "successful"].includes(status)) {
        return "Paid";
    }

    if (["refunded", "refund"].includes(status)) {
        return "Refunded";
    }

    if (
        ["failed", "failure", "cancelled", "canceled"].includes(status)
    ) {
        return "Failed";
    }

    return "Pending";
};

// Normalize API order
const normalizeOrder = (order = {}) => {
    const items = Array.isArray(order.items) ? order.items : [];

    const statusHistory = Array.isArray(order.status_history)
        ? order.status_history
        : Array.isArray(order.statusHistory)
        ? order.statusHistory
        : [];

    const deliveredHistory = statusHistory.find((item) => {
        const status = String(
            item.status || item.new_status || ""
        ).toLowerCase();

        return status === "delivered";
    });

    const databaseId = order.order_id ?? order.id ?? null;

    const orderNumber =
        order.order_number ||
        (databaseId !== null ? `#ORD-${databaseId}` : "—");

    const itemCount =
        order.item_count ??
        order.total_items ??
        items.reduce(
            (total, item) => total + Number(item.quantity ?? 1),
            0
        );

    const orderStatus = String(
        order.order_status || order.status || "delivered"
    ).toLowerCase();

    const deliveredDateValue =
        order.delivered_at ||
        deliveredHistory?.created_at ||
        deliveredHistory?.changed_at ||
        (orderStatus === "delivered" ? order.updated_at : null);

    return {
        ...order,

        // Database ID is used for API requests.
        orderId: databaseId,

        // Display value can be the formatted order number.
        id: orderNumber,
        orderNumber,

        customer:
            order.customer_name ||
            order.name ||
            order.user?.name ||
            "Unknown Customer",

        email:
            order.customer_email ||
            order.email ||
            order.user?.email ||
            "—",

        date: formatDate(order.created_at || order.order_date),

        deliveredDate: formatDate(deliveredDateValue),

        items: Number(itemCount || 0),

        total: Number(order.total_amount ?? order.total ?? 0),

        subtotal: Number(
            order.subtotal ??
                order.sub_total ??
                order.total_amount ??
                order.total ??
                0
        ),

        discount: Number(order.discount ?? 0),

        coupon_discount: Number(order.coupon_discount ?? 0),

        tax: Number(order.tax ?? order.tax_amount ?? 0),

        shipping_fee: Number(
            order.shipping_fee ?? order.shipping_amount ?? 0
        ),

        payment: normalizePayment(order.payment_status),

        orderStatus,

        orderItems: items,

        statusHistory,
    };
};

function DeliveredOrders() {
    const [search, setSearch] = useState("");
    const [paymentStatus, setPaymentStatus] = useState("All");

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [selectedOrder, setSelectedOrder] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState("");

    const [detailsRequestId, setDetailsRequestId] = useState(0);

    // API request helper
    const requestJSON = useCallback(async (url, options = {}) => {
        const token = localStorage.getItem("shopsphereToken");

        const response = await fetch(`${API_BASE_URL}${url}`, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...options.headers,
            },
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || data.success === false) {
            throw new Error(
                data.message || `Request failed (${response.status})`
            );
        }

        return data;
    }, []);

    // Fetch delivered orders
    const fetchOrders = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const params = new URLSearchParams({
                status: "delivered",
            });

            if (search.trim()) {
                params.set("search", search.trim());
            }

            const data = await requestJSON(
                `/admin/orders?${params.toString()}`
            );

            const ordersData = Array.isArray(data.orders)
                ? data.orders
                : Array.isArray(data.data?.orders)
                ? data.data.orders
                : [];

            setOrders(ordersData.map(normalizeOrder));
        } catch (err) {
            setError(err.message || "Failed to load delivered orders.");
            setOrders([]);
        } finally {
            setLoading(false);
        }
    }, [requestJSON, search]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchOrders();
        }, 300);

        return () => clearTimeout(timer);
    }, [fetchOrders]);

    // View order details
    const handleViewOrder = async (order) => {
        const orderId =
            typeof order === "object"
                ? order?.orderId
                : order;

        if (orderId === null || orderId === undefined || orderId === "") {
            setDetailsError("A valid order ID was not found.");
            return;
        }

        const requestId = Date.now();

        setDetailsRequestId(requestId);
        setSelectedOrder(
            typeof order === "object" ? order : null
        );
        setDetailsLoading(true);
        setDetailsError("");

        try {
            const data = await requestJSON(
                `/admin/orders/${encodeURIComponent(orderId)}`
            );

            // Ignore stale responses from previous modal requests.
            if (requestId !== detailsRequestId && detailsRequestId !== 0) {
                // The latest request ID is checked again below by state
                // only when the component has received the latest request.
            }

            const detailedOrder = data.order || data.data?.order || data;

            if (!detailedOrder || typeof detailedOrder !== "object") {
                throw new Error("Order details were not returned by the server.");
            }

            setSelectedOrder(normalizeOrder(detailedOrder));
        } catch (err) {
            setDetailsError(
                err.message || "Unable to load order details."
            );
        } finally {
            setDetailsLoading(false);
        }
    };

    // Close details modal
    const closeDetails = () => {
        setSelectedOrder(null);
        setDetailsError("");
        setDetailsLoading(false);
        setDetailsRequestId(0);
    };

    // Close modal using Escape key
    useEffect(() => {
        if (!selectedOrder) return;

        const handleEscape = (event) => {
            if (event.key === "Escape") {
                closeDetails();
            }
        };

        window.addEventListener("keydown", handleEscape);

        return () => {
            window.removeEventListener("keydown", handleEscape);
        };
    }, [selectedOrder]);

    // Payment badge
    const getPaymentClass = (value) => {
        switch (value) {
            case "Paid":
                return "bg-green-100 text-green-700";

            case "Pending":
                return "bg-yellow-100 text-yellow-700";

            case "Refunded":
                return "bg-red-100 text-red-700";

            case "Failed":
                return "bg-rose-100 text-rose-700";

            default:
                return "bg-gray-100 text-gray-700";
        }
    };

    // Search and payment filter
    const filteredOrders = useMemo(() => {
        return orders.filter((order) => {
            const searchText = search.trim().toLowerCase();

            const matchesSearch =
                String(order.id || "")
                    .toLowerCase()
                    .includes(searchText) ||
                String(order.orderId || "")
                    .toLowerCase()
                    .includes(searchText) ||
                String(order.customer || "")
                    .toLowerCase()
                    .includes(searchText) ||
                String(order.email || "")
                    .toLowerCase()
                    .includes(searchText);

            const matchesPayment =
                paymentStatus === "All" ||
                order.payment === paymentStatus;

            return matchesSearch && matchesPayment;
        });
    }, [orders, search, paymentStatus]);

    // Statistics
    const totalRevenue = orders.reduce(
        (total, order) => total + Number(order.total || 0),
        0
    );

    const averageOrderValue =
        orders.length > 0
            ? totalRevenue / orders.length
            : 0;

    // Retry order details
    const retryOrderDetails = () => {
        if (selectedOrder?.orderId) {
            handleViewOrder(selectedOrder);
        }
    };

    return (
        <div className="min-h-full bg-aqua-spring p-4 sm:p-6 lg:p-8">
            {/* Header */}
            <div className="mb-6">
                <p className="text-sm font-medium text-ocean-green">
                    Order Management
                </p>

                <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-cyprus sm:text-3xl">
                            Delivered Orders
                        </h1>

                        <p className="mt-1 text-sm text-text-grey">
                            View orders that have been successfully delivered.
                        </p>
                    </div>

                    <div className="flex h-10 w-fit items-center gap-2 rounded-lg bg-green-50 px-4 text-sm font-semibold text-green-700">
                        <i className="fa-solid fa-circle-check"></i>
                        Delivered
                    </div>
                </div>
            </div>

            {/* Statistics */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm text-text-grey">
                                Delivered Orders
                            </p>

                            <h2 className="mt-2 text-2xl font-bold text-cyprus">
                                {loading ? "..." : orders.length}
                            </h2>
                        </div>

                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-600">
                            <i className="fa-solid fa-circle-check text-lg"></i>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm text-text-grey">
                                Delivered Revenue
                            </p>

                            <h2 className="mt-2 text-2xl font-bold text-cyprus">
                                {loading ? "..." : formatCurrency(totalRevenue)}
                            </h2>
                        </div>

                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-aqua-spring text-ocean-green">
                            <i className="fa-solid fa-indian-rupee-sign text-lg"></i>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm text-text-grey">
                                Average Order Value
                            </p>

                            <h2 className="mt-2 text-2xl font-bold text-cyprus">
                                {loading ? "..." : formatCurrency(averageOrderValue)}
                            </h2>
                        </div>

                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                            <i className="fa-solid fa-chart-line text-lg"></i>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="mb-6 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <label className="mb-2 block text-sm font-semibold text-cyprus">
                            Search Order
                        </label>

                        <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5">
                            <i className="fa-solid fa-magnifying-glass text-sm text-text-grey"></i>

                            <input
                                type="text"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Order ID, customer, email..."
                                className="w-full bg-transparent text-sm text-cyprus outline-none placeholder:text-text-grey"
                            />

                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch("")}
                                    title="Clear search"
                                    aria-label="Clear search"
                                    className="text-text-grey transition hover:text-cyprus"
                                >
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-semibold text-cyprus">
                            Payment Status
                        </label>

                        <select
                            value={paymentStatus}
                            onChange={(event) => setPaymentStatus(event.target.value)}
                            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-cyprus outline-none focus:border-ocean-green"
                        >
                            <option value="All">All Payments</option>
                            <option value="Paid">Paid</option>
                            <option value="Pending">Pending</option>
                            <option value="Refunded">Refunded</option>
                            <option value="Failed">Failed</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="rounded-xl border border-gray-100 bg-white px-6 py-16 text-center shadow-sm">
                    <i className="fa-solid fa-spinner fa-spin text-3xl text-ocean-green"></i>

                    <p className="mt-4 text-sm font-medium text-text-grey">
                        Loading delivered orders...
                    </p>
                </div>
            )}

            {/* API Error */}
            {!loading && error && (
                <div className="rounded-xl border border-red-100 bg-white p-6 text-center shadow-sm">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
                        <i className="fa-solid fa-triangle-exclamation text-xl"></i>
                    </div>

                    <h3 className="mt-4 text-lg font-bold text-cyprus">
                        Unable to load delivered orders
                    </h3>

                    <p className="mt-2 break-words text-sm text-text-grey">
                        {error}
                    </p>

                    <button
                        type="button"
                        onClick={fetchOrders}
                        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-ocean-green px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                    >
                        <i className="fa-solid fa-rotate-right"></i>
                        Try Again
                    </button>
                </div>
            )}

            {/* Orders Content */}
            {!loading && !error && (
                <>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-text-grey">
                            Showing{" "}
                            <span className="font-semibold text-cyprus">
                                {filteredOrders.length}
                            </span>{" "}
                            of{" "}
                            <span className="font-semibold text-cyprus">
                                {orders.length}
                            </span>{" "}
                            delivered orders
                        </p>

                        <button
                            type="button"
                            onClick={fetchOrders}
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-cyprus transition hover:border-ocean-green hover:text-ocean-green"
                        >
                            <i className="fa-solid fa-rotate-right"></i>
                            Refresh
                        </button>
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm lg:block">
                        <div className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                            <table className="w-full min-w-[1000px]">
                                <thead className="border-b border-gray-100 bg-gray-50">
                                    <tr>
                                        {[
                                            "Order",
                                            "Customer",
                                            "Order Date",
                                            "Delivered",
                                            "Items",
                                            "Total",
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
                                    {filteredOrders.map((order, index) => (
                                        <tr
                                            key={order.orderId ?? order.id ?? index}
                                            className="transition hover:bg-gray-50"
                                        >
                                            <td className="px-5 py-4">
                                                <p className="text-sm font-bold text-cyprus">
                                                    {order.id}
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

                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2">
                                                    <i className="fa-solid fa-circle-check text-sm text-green-600"></i>

                                                    <span className="text-sm font-medium text-cyprus">
                                                        {order.deliveredDate}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="px-5 py-4 text-sm font-medium text-cyprus">
                                                {order.items}
                                            </td>

                                            <td className="px-5 py-4 text-sm font-bold text-cyprus">
                                                {formatCurrency(order.total)}
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
                                                        title="View Order"
                                                        onClick={() => handleViewOrder(order)}
                                                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-aqua-spring text-ocean-green transition hover:bg-ocean-green hover:text-white"
                                                    >
                                                        <i className="fa-solid fa-eye text-sm"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {filteredOrders.length === 0 && <EmptyOrders />}
                    </div>

                    {/* Mobile Cards */}
                    <div className="space-y-4 lg:hidden">
                        {filteredOrders.map((order, index) => (
                            <div
                                key={order.orderId ?? order.id ?? index}
                                className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="break-words text-sm font-bold text-cyprus">
                                            {order.id}
                                        </p>

                                        <p className="mt-1 text-xs text-text-grey">
                                            Ordered: {order.date}
                                        </p>
                                    </div>

                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                                        <i className="fa-solid fa-check"></i>
                                        Delivered
                                    </span>
                                </div>

                                <div className="my-4 border-t border-gray-100"></div>

                                <div>
                                    <p className="text-xs text-text-grey">Customer</p>

                                    <p className="mt-1 text-sm font-semibold text-cyprus">
                                        {order.customer}
                                    </p>

                                    <p className="mt-1 break-all text-xs text-text-grey">
                                        {order.email}
                                    </p>
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-text-grey">Items</p>

                                        <p className="mt-1 text-sm font-bold text-cyprus">
                                            {order.items}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs text-text-grey">Total</p>

                                        <p className="mt-1 text-sm font-bold text-cyprus">
                                            {formatCurrency(order.total)}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <p className="text-xs text-text-grey">
                                        Delivered Date
                                    </p>

                                    <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-green-600">
                                        <i className="fa-solid fa-circle-check"></i>
                                        {order.deliveredDate}
                                    </p>
                                </div>

                                <div className="mt-4">
                                    <p className="text-xs text-text-grey">Payment</p>

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
                                    onClick={() => handleViewOrder(order)}
                                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-aqua-spring px-4 py-2.5 text-sm font-semibold text-ocean-green transition hover:bg-ocean-green hover:text-white"
                                >
                                    <i className="fa-solid fa-eye"></i>
                                    View Order Details
                                </button>
                            </div>
                        ))}

                        {filteredOrders.length === 0 && <EmptyOrders />}
                    </div>
                </>
            )}

            {/* Order Details Modal */}
            {selectedOrder && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 sm:p-5"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closeDetails();
                        }
                    }}
                >
                    <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                        {/* Modal Header */}
                        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:px-6">
                            <div className="min-w-0">
                                <h2 className="text-lg font-bold text-cyprus sm:text-xl">
                                    Order Details
                                </h2>

                                <p className="mt-1 break-words text-sm text-text-grey">
                                    {selectedOrder.id}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={closeDetails}
                                title="Close"
                                aria-label="Close order details"
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition hover:bg-red-50 hover:text-red-600"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="overflow-y-auto p-5 sm:p-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                            {detailsLoading ? (
                                <div className="py-14 text-center">
                                    <i className="fa-solid fa-spinner fa-spin text-3xl text-ocean-green"></i>

                                    <p className="mt-4 text-sm text-text-grey">
                                        Loading order details...
                                    </p>
                                </div>
                            ) : detailsError ? (
                                <div className="py-10 text-center">
                                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
                                        <i className="fa-solid fa-triangle-exclamation text-xl"></i>
                                    </div>

                                    <p className="mt-4 break-words text-sm text-text-grey">
                                        {detailsError}
                                    </p>

                                    <button
                                        type="button"
                                        onClick={retryOrderDetails}
                                        className="mt-5 rounded-lg bg-ocean-green px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {/* Status */}
                                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-100 bg-green-50 p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-green-600">
                                                <i className="fa-solid fa-circle-check text-xl"></i>
                                            </div>

                                            <div>
                                                <p className="font-bold text-green-800">
                                                    Order Delivered
                                                </p>

                                                <p className="mt-1 text-xs text-green-700">
                                                    {selectedOrder.deliveredDate}
                                                </p>
                                            </div>
                                        </div>

                                        <span
                                            className={`rounded-full px-3 py-1 text-xs font-semibold ${getPaymentClass(
                                                selectedOrder.payment
                                            )}`}
                                        >
                                            {selectedOrder.payment}
                                        </span>
                                    </div>

                                    {/* Customer and Order Information */}
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div className="rounded-xl border border-gray-100 p-4">
                                            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-cyprus">
                                                <i className="fa-solid fa-user text-ocean-green"></i>
                                                Customer Information
                                            </h3>

                                            <p className="text-sm font-semibold text-cyprus">
                                                {selectedOrder.customer}
                                            </p>

                                            <p className="mt-2 break-all text-sm text-text-grey">
                                                {selectedOrder.email}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-gray-100 p-4">
                                            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-cyprus">
                                                <i className="fa-solid fa-receipt text-ocean-green"></i>
                                                Order Information
                                            </h3>

                                            <p className="text-sm text-text-grey">
                                                Order ID
                                            </p>

                                            <p className="mt-1 break-words text-sm font-semibold text-cyprus">
                                                {selectedOrder.id}
                                            </p>

                                            <p className="mt-3 text-sm text-text-grey">
                                                Order Date
                                            </p>

                                            <p className="mt-1 text-sm font-semibold text-cyprus">
                                                {selectedOrder.date}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Order Items */}
                                    <div className="mt-6">
                                        <h3 className="mb-3 text-base font-bold text-cyprus">
                                            Order Items
                                        </h3>

                                        {selectedOrder.orderItems.length > 0 ? (
                                            <div className="overflow-hidden rounded-xl border border-gray-100">
                                                <div className="divide-y divide-gray-100">
                                                    {selectedOrder.orderItems.map(
                                                        (item, index) => {
                                                            const itemName =
                                                                item.product_name ||
                                                                item.name ||
                                                                item.title ||
                                                                item.product?.name ||
                                                                "Product";

                                                            const quantity = Number(
                                                                item.quantity ?? 1
                                                            );

                                                            const price = Number(
                                                                item.price ??
                                                                    item.sale_price ??
                                                                    item.unit_price ??
                                                                    0
                                                            );

                                                            const image =
                                                                item.image ||
                                                                item.image_url ||
                                                                item.product_image ||
                                                                item.product?.image;

                                                            return (
                                                                <div
                                                                    key={
                                                                        item.order_item_id ||
                                                                        item.id ||
                                                                        index
                                                                    }
                                                                    className="flex items-center gap-3 p-4"
                                                                >
                                                                    {image ? (
                                                                        <img
                                                                            src={image}
                                                                            alt={itemName}
                                                                            className="h-14 w-14 shrink-0 rounded-lg border border-gray-100 object-cover"
                                                                            onError={(event) => {
                                                                                event.currentTarget.style.display =
                                                                                    "none";
                                                                            }}
                                                                        />
                                                                    ) : (
                                                                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-aqua-spring text-ocean-green">
                                                                            <i className="fa-solid fa-box text-xl"></i>
                                                                        </div>
                                                                    )}

                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="break-words text-sm font-semibold text-cyprus">
                                                                            {itemName}
                                                                        </p>

                                                                        <p className="mt-1 text-xs text-text-grey">
                                                                            Qty: {quantity}
                                                                        </p>
                                                                    </div>

                                                                    <p className="shrink-0 text-sm font-bold text-cyprus">
                                                                        {formatCurrency(
                                                                            Number(
                                                                                item.subtotal ??
                                                                                    item.total_price ??
                                                                                    price * quantity
                                                                            )
                                                                        )}
                                                                    </p>
                                                                </div>
                                                            );
                                                        }
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center">
                                                <i className="fa-solid fa-box-open text-2xl text-text-grey"></i>

                                                <p className="mt-2 text-sm text-text-grey">
                                                    No item details were returned by the API.
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Payment Summary */}
                                    <div className="mt-6 rounded-xl border border-gray-100 p-4 sm:p-5">
                                        <h3 className="mb-4 text-base font-bold text-cyprus">
                                            Payment Summary
                                        </h3>

                                        <div className="space-y-3 text-sm">
                                            <div className="flex justify-between gap-4">
                                                <span className="text-text-grey">
                                                    Subtotal
                                                </span>

                                                <span className="font-medium text-cyprus">
                                                    {formatCurrency(selectedOrder.subtotal)}
                                                </span>
                                            </div>

                                            {(selectedOrder.discount > 0 ||
                                                selectedOrder.coupon_discount > 0) && (
                                                <div className="flex justify-between gap-4">
                                                    <span className="text-text-grey">
                                                        Discount
                                                    </span>

                                                    <span className="font-medium text-green-600">
                                                        −
                                                        {formatCurrency(
                                                            selectedOrder.discount +
                                                                selectedOrder.coupon_discount
                                                        )}
                                                    </span>
                                                </div>
                                            )}

                                            <div className="flex justify-between gap-4">
                                                <span className="text-text-grey">
                                                    Tax
                                                </span>

                                                <span className="font-medium text-cyprus">
                                                    {formatCurrency(selectedOrder.tax)}
                                                </span>
                                            </div>

                                            <div className="flex justify-between gap-4">
                                                <span className="text-text-grey">
                                                    Shipping Fee
                                                </span>

                                                <span className="font-medium text-cyprus">
                                                    {formatCurrency(selectedOrder.shipping_fee)}
                                                </span>
                                            </div>

                                            <div className="border-t border-dashed border-gray-200 pt-3">
                                                <div className="flex justify-between gap-4">
                                                    <span className="font-bold text-cyprus">
                                                        Total Amount
                                                    </span>

                                                    <span className="text-lg font-bold text-ocean-green">
                                                        {formatCurrency(selectedOrder.total)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Status History */}
                                    {selectedOrder.statusHistory.length > 0 && (
                                        <div className="mt-6">
                                            <h3 className="mb-3 text-base font-bold text-cyprus">
                                                Order Status History
                                            </h3>

                                            <div className="space-y-3">
                                                {selectedOrder.statusHistory.map(
                                                    (history, index) => (
                                                        <div
                                                            key={
                                                                history.id ||
                                                                history.history_id ||
                                                                index
                                                            }
                                                            className="flex items-start gap-3"
                                                        >
                                                            <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-aqua-spring text-ocean-green">
                                                                <i className="fa-solid fa-check text-xs"></i>
                                                            </div>

                                                            <div className="min-w-0 flex-1 rounded-lg bg-gray-50 p-3">
                                                                <p className="break-words text-sm font-semibold capitalize text-cyprus">
                                                                    {String(
                                                                        history.status ||
                                                                            history.new_status ||
                                                                            "Updated"
                                                                    ).replace(/_/g, " ")}
                                                                </p>

                                                                {history.note && (
                                                                    <p className="mt-1 break-words text-sm text-text-grey">
                                                                        {history.note}
                                                                    </p>
                                                                )}

                                                                <p className="mt-1 text-xs text-text-grey">
                                                                    {formatDate(
                                                                        history.created_at ||
                                                                            history.changed_at
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex shrink-0 justify-end border-t border-gray-100 px-5 py-4 sm:px-6">
                            <button
                                type="button"
                                onClick={closeDetails}
                                className="rounded-lg bg-ocean-green px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                            >
                                Close
                            </button>
                        </div>
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
                <i className="fa-solid fa-box-open text-2xl"></i>
            </div>

            <h3 className="mt-4 text-lg font-bold text-cyprus">
                No delivered orders found
            </h3>

            <p className="mt-2 text-sm text-text-grey">
                Try changing your search or payment filter.
            </p>
        </div>
    );
}

export default DeliveredOrders;