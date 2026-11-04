import React, { useCallback, useEffect, useState } from "react";

const API_BASE_URL = "http://192.168.1.20:5000/api";

const ORDER_STATUSES = [
    "confirmed",
    "processing",
    "packed",
    "shipped",
    "delivered",
    "cancelled",
];

function ProcessingOrders() {
    const [search, setSearch] = useState("");
    const [paymentStatus, setPaymentStatus] = useState("All");

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showDetails, setShowDetails] = useState(false);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState("");

    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [statusNote, setStatusNote] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    const [originalStatus, setOriginalStatus] = useState("");

    // API request helper
    const requestJSON = useCallback(async (url, options = {}) => {
        const token = localStorage.getItem("shopsphereToken");

        const response = await fetch(`${API_BASE_URL}${url}`, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(token
                    ? { Authorization: `Bearer ${token}` }
                    : {}),
                ...options.headers,
            },
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || data.success === false) {
            if (response.status === 401) {
                throw new Error(
                    "Session expired or token is missing. Please log in again."
                );
            }

            if (response.status === 403) {
                throw new Error(
                    "You do not have permission to perform this action."
                );
            }

            throw new Error(
                data.message || "Something went wrong. Please try again."
            );
        }

        return data;
    }, []);

    // Format date
    const formatDate = (date) => {
        if (!date) return "—";

        const parsedDate = new Date(date);

        if (Number.isNaN(parsedDate.getTime())) {
            return String(date);
        }

        return parsedDate.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    // Format currency
    const formatCurrency = (amount) => {
        const value = Number(amount ?? 0);

        return `₹${(Number.isFinite(value) ? value : 0).toLocaleString(
            "en-IN",
            {
                maximumFractionDigits: 2,
            }
        )}`;
    };

    // Normalize payment status
    const getPaymentStatus = (status) => {
        const value = String(status || "").toLowerCase();

        if (
            ["paid", "completed", "success", "successful"].includes(value)
        ) {
            return "Paid";
        }

        if (["refunded", "refund"].includes(value)) {
            return "Refunded";
        }

        if (["failed", "cancelled", "canceled"].includes(value)) {
            return "Failed";
        }

        return "Pending";
    };

    // Payment badge styling
    const getPaymentClass = (status) => {
        switch (getPaymentStatus(status)) {
            case "Paid":
                return "bg-green-100 text-green-700";

            case "Refunded":
                return "bg-red-100 text-red-700";

            case "Failed":
                return "bg-rose-100 text-rose-700";

            default:
                return "bg-yellow-100 text-yellow-700";
        }
    };

    // Status badge styling
    const getStatusClass = (status) => {
        const value = String(status || "").toLowerCase();

        const classes = {
            confirmed: "bg-indigo-100 text-indigo-700",
            processing: "bg-blue-100 text-blue-700",
            packed: "bg-purple-100 text-purple-700",
            shipped: "bg-orange-100 text-orange-700",
            delivered: "bg-green-100 text-green-700",
            cancelled: "bg-red-100 text-red-700",
            pending: "bg-yellow-100 text-yellow-700",
        };

        return classes[value] || "bg-gray-100 text-gray-700";
    };

    // Normalize order from backend
    const normalizeOrder = (order) => {
        const orderId = order.order_id ?? order.id;

        const rawItems = Array.isArray(order.items)
            ? order.items
            : Number(order.item_count ?? order.total_items ?? 0);

        return {
            ...order,
            id: orderId,
            orderNumber:
                order.order_number ||
                (orderId ? `#ORD-${orderId}` : "—"),
            customer:
                order.customer_name ||
                order.name ||
                order.user_name ||
                "Unknown Customer",
            email:
                order.customer_email ||
                order.email ||
                "—",
            date: formatDate(order.created_at),
            items: rawItems,
            total: Number(
                order.total_amount ??
                order.total ??
                order.grand_total ??
                0
            ),
            payment: getPaymentStatus(
                order.payment_status ?? order.payment?.status
            ),
            status: String(
                order.order_status || order.status || "processing"
            ).toLowerCase(),
        };
    };

    // Fetch processing orders
    const fetchOrders = useCallback(
        async (searchText = "") => {
            setLoading(true);
            setError("");

            try {
                const params = new URLSearchParams({
                    status: "processing",
                });

                if (searchText.trim()) {
                    params.set("search", searchText.trim());
                }

                const data = await requestJSON(
                    `/admin/orders?${params.toString()}`
                );

                const orderList = Array.isArray(data.orders)
                    ? data.orders
                    : Array.isArray(data.data?.orders)
                    ? data.data.orders
                    : [];

                setOrders(orderList.map(normalizeOrder));
            } catch (err) {
                setError(
                    err.message || "Unable to load processing orders."
                );
                setOrders([]);
            } finally {
                setLoading(false);
            }
        },
        [requestJSON]
    );

    // Load orders and search when search text changes
    useEffect(() => {
        const timeout = setTimeout(() => {
            fetchOrders(search);
        }, 300);

        return () => clearTimeout(timeout);
    }, [search, fetchOrders]);

    // Open order details
    const handleViewOrder = async (orderId) => {
        if (!orderId) {
            setDetailsError("Invalid order ID.");
            setShowDetails(true);
            return;
        }

        setShowDetails(true);
        setDetailsLoading(true);
        setDetailsError("");
        setSelectedOrder(null);
        setOriginalStatus("");
        setStatusNote("");
        setSuccessMessage("");

        try {
            const data = await requestJSON(
                `/admin/orders/${orderId}`
            );

            const orderData = data.order || data.data?.order;

            if (!orderData) {
                throw new Error(
                    "Order details were not returned by the server."
                );
            }

            const normalizedOrder = normalizeOrder(orderData);

            setSelectedOrder(normalizedOrder);
            setOriginalStatus(normalizedOrder.status);
        } catch (err) {
            setDetailsError(
                err.message || "Unable to load order details."
            );
        } finally {
            setDetailsLoading(false);
        }
    };

    // Update order status
    const handleStatusUpdate = async (event) => {
        event.preventDefault();

        if (!selectedOrder?.id) {
            setDetailsError("Order ID is missing.");
            return;
        }

        if (!selectedOrder.status) {
            setDetailsError("Please select an order status.");
            return;
        }

        if (selectedOrder.status === originalStatus) {
            setDetailsError("Please select a different status.");
            return;
        }

        setUpdatingStatus(true);
        setDetailsError("");
        setSuccessMessage("");

        try {
            await requestJSON(
                `/admin/orders/${selectedOrder.id}/status`,
                {
                    method: "PATCH",
                    body: JSON.stringify({
                        status: selectedOrder.status,
                        note: statusNote.trim(),
                    }),
                }
            );

            setSuccessMessage("Order status updated successfully.");

            // Refresh the list
            await fetchOrders(search);

            // Refresh order details
            try {
                const refreshedData = await requestJSON(
                    `/admin/orders/${selectedOrder.id}`
                );

                const refreshedOrder =
                    refreshedData.order ||
                    refreshedData.data?.order;

                if (refreshedOrder) {
                    const normalizedOrder = normalizeOrder(refreshedOrder);

                    setSelectedOrder(normalizedOrder);
                    setOriginalStatus(normalizedOrder.status);
                } else {
                    setOriginalStatus(selectedOrder.status);
                }
            } catch {
                // Status update succeeded. Keep the updated status visible
                // even if refreshing the details fails.
                setOriginalStatus(selectedOrder.status);
            }

            setStatusNote("");
        } catch (err) {
            setDetailsError(
                err.message || "Unable to update order status."
            );
        } finally {
            setUpdatingStatus(false);
        }
    };

    // Close details modal
    const closeDetails = () => {
        if (updatingStatus) return;

        setShowDetails(false);
        setSelectedOrder(null);
        setDetailsError("");
        setSuccessMessage("");
        setStatusNote("");
        setOriginalStatus("");
    };

    // Close modal with Escape key
    useEffect(() => {
        if (!showDetails) return undefined;

        const handleEscape = (event) => {
            if (event.key === "Escape" && !updatingStatus) {
                closeDetails();
            }
        };

        window.addEventListener("keydown", handleEscape);

        return () => {
            window.removeEventListener("keydown", handleEscape);
        };
    }, [showDetails, updatingStatus]);

    // Filter by payment status
    const filteredOrders = orders.filter((order) => {
        return (
            paymentStatus === "All" ||
            order.payment === paymentStatus
        );
    });

    const paidOrders = orders.filter(
        (order) => order.payment === "Paid"
    ).length;

    const totalValue = orders.reduce(
        (total, order) => total + order.total,
        0
    );

    const itemCount = (order) => {
        if (Array.isArray(order.items)) {
            return order.items.length;
        }

        return Number(order.items || 0);
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
                            Processing Orders
                        </h1>

                        <p className="mt-1 text-sm text-text-grey">
                            Manage orders that are currently being processed.
                        </p>
                    </div>

                    <div className="flex h-10 w-fit items-center gap-2 rounded-lg bg-blue-50 px-4 text-sm font-semibold text-blue-700">
                        <i className="fa-solid fa-box"></i>
                        Processing
                    </div>
                </div>
            </div>

            {/* API Error */}
            {error && (
                <div className="mb-5 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
                    <p>
                        <i className="fa-solid fa-circle-exclamation mr-2"></i>
                        {error}
                    </p>

                    <button
                        type="button"
                        onClick={() => fetchOrders(search)}
                        className="w-fit rounded-lg bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-700"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Stats */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-text-grey">
                                Processing Orders
                            </p>

                            <h2 className="mt-2 text-2xl font-bold text-cyprus">
                                {loading ? "—" : orders.length}
                            </h2>
                        </div>

                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                            <i className="fa-solid fa-box text-lg"></i>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-text-grey">
                                Paid Orders
                            </p>

                            <h2 className="mt-2 text-2xl font-bold text-cyprus">
                                {loading ? "—" : paidOrders}
                            </h2>
                        </div>

                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-600">
                            <i className="fa-solid fa-circle-check text-lg"></i>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-text-grey">
                                Processing Value
                            </p>

                            <h2 className="mt-2 text-2xl font-bold text-cyprus">
                                {loading ? "—" : formatCurrency(totalValue)}
                            </h2>
                        </div>

                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-aqua-spring text-ocean-green">
                            <i className="fa-solid fa-indian-rupee-sign text-lg"></i>
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
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder="Order ID, customer, email..."
                                className="w-full bg-transparent text-sm text-cyprus outline-none placeholder:text-text-grey"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-semibold text-cyprus">
                            Payment Status
                        </label>

                        <select
                            value={paymentStatus}
                            onChange={(event) =>
                                setPaymentStatus(event.target.value)
                            }
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

            {/* Orders Table */}
            <div className="hidden overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm lg:block">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px]">
                        <thead className="border-b border-gray-100 bg-gray-50">
                            <tr>
                                {[
                                    "Order",
                                    "Customer",
                                    "Date",
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
                            {!loading &&
                                filteredOrders.map((order) => (
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

                                        <td className="px-5 py-4 text-sm font-medium text-cyprus">
                                            {itemCount(order)}
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
                                                    onClick={() =>
                                                        handleViewOrder(order.id)
                                                    }
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

                {loading && (
                    <div className="px-6 py-16 text-center text-sm text-text-grey">
                        <i className="fa-solid fa-spinner mr-2 animate-spin"></i>
                        Loading processing orders...
                    </div>
                )}

                {!loading && filteredOrders.length === 0 && (
                    <div className="px-6 py-16 text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-aqua-spring text-ocean-green">
                            <i className="fa-solid fa-box-open text-2xl"></i>
                        </div>

                        <h3 className="mt-4 text-lg font-bold text-cyprus">
                            No processing orders found
                        </h3>

                        <p className="mt-2 text-sm text-text-grey">
                            Try changing your search or payment filter.
                        </p>
                    </div>
                )}
            </div>

            {/* Mobile Cards */}
            <div className="space-y-4 lg:hidden">
                {loading && (
                    <div className="rounded-xl border border-gray-100 bg-white px-6 py-12 text-center text-sm text-text-grey shadow-sm">
                        <i className="fa-solid fa-spinner mr-2 animate-spin"></i>
                        Loading processing orders...
                    </div>
                )}

                {!loading &&
                    filteredOrders.map((order) => (
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
                                    className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getStatusClass(
                                        order.status
                                    )}`}
                                >
                                    {order.status}
                                </span>
                            </div>

                            <div className="my-4 border-t border-gray-100"></div>

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
                                        {itemCount(order)}
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
                                <i className="fa-solid fa-eye"></i>
                                View Order Details
                            </button>
                        </div>
                    ))}

                {!loading && filteredOrders.length === 0 && (
                    <div className="rounded-xl border border-gray-100 bg-white px-6 py-16 text-center shadow-sm">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-aqua-spring text-ocean-green">
                            <i className="fa-solid fa-box-open text-2xl"></i>
                        </div>

                        <h3 className="mt-4 text-lg font-bold text-cyprus">
                            No processing orders found
                        </h3>

                        <p className="mt-2 text-sm text-text-grey">
                            Try changing your filters.
                        </p>
                    </div>
                )}
            </div>

            {/* Order Details Modal */}
            {showDetails && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 sm:p-5"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closeDetails();
                        }
                    }}
                >
                    <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                        {/* Modal Header */}
                        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4 sm:px-6">
                            <div>
                                <h2 className="text-lg font-bold text-cyprus sm:text-xl">
                                    Order Details
                                </h2>

                                <p className="mt-1 text-sm text-text-grey">
                                    View order information and update its status.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={closeDetails}
                                disabled={updatingStatus}
                                aria-label="Close order details"
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-cyprus disabled:opacity-50"
                            >
                                <i className="fa-solid fa-xmark text-lg"></i>
                            </button>
                        </div>

                        {/* Scrollable Modal Body */}
                        <div className="overflow-y-auto p-5 sm:p-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                            {detailsLoading && (
                                <div className="py-16 text-center text-sm text-text-grey">
                                    <i className="fa-solid fa-spinner mr-2 animate-spin"></i>
                                    Loading order details...
                                </div>
                            )}

                            {detailsError && (
                                <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                                    <i className="fa-solid fa-circle-exclamation mr-2"></i>
                                    {detailsError}
                                </div>
                            )}

                            {!detailsLoading && !selectedOrder && (
                                <div className="py-6 text-center">
                                    <button
                                        type="button"
                                        onClick={closeDetails}
                                        className="rounded-lg bg-ocean-green px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                                    >
                                        Close
                                    </button>
                                </div>
                            )}

                            {!detailsLoading && selectedOrder && (
                                <div className="space-y-6">
                                    {/* Order Summary */}
                                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wide text-text-grey">
                                                    Order Number
                                                </p>

                                                <h3 className="mt-1 text-lg font-bold text-cyprus">
                                                    {selectedOrder.orderNumber}
                                                </h3>

                                                <p className="mt-1 text-sm text-text-grey">
                                                    Placed on {selectedOrder.date}
                                                </p>
                                            </div>

                                            <span
                                                className={`w-fit rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${getStatusClass(
                                                    selectedOrder.status
                                                )}`}
                                            >
                                                {selectedOrder.status}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Customer and Payment */}
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div className="rounded-xl border border-gray-100 p-4">
                                            <h3 className="mb-3 font-bold text-cyprus">
                                                <i className="fa-solid fa-user mr-2 text-ocean-green"></i>
                                                Customer
                                            </h3>

                                            <p className="text-sm font-semibold text-cyprus">
                                                {selectedOrder.customer}
                                            </p>

                                            <p className="mt-1 break-all text-sm text-text-grey">
                                                {selectedOrder.email}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-gray-100 p-4">
                                            <h3 className="mb-3 font-bold text-cyprus">
                                                <i className="fa-solid fa-credit-card mr-2 text-ocean-green"></i>
                                                Payment
                                            </h3>

                                            <span
                                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getPaymentClass(
                                                    selectedOrder.payment
                                                )}`}
                                            >
                                                {selectedOrder.payment}
                                            </span>

                                            <p className="mt-3 text-sm text-text-grey">
                                                Order Total
                                            </p>

                                            <p className="mt-1 text-xl font-bold text-cyprus">
                                                {formatCurrency(selectedOrder.total)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Order Items */}
                                    <div className="rounded-xl border border-gray-100 p-4">
                                        <h3 className="mb-4 font-bold text-cyprus">
                                            <i className="fa-solid fa-box-open mr-2 text-ocean-green"></i>
                                            Order Items
                                        </h3>

                                        {Array.isArray(selectedOrder.items) &&
                                        selectedOrder.items.length > 0 ? (
                                            <div className="space-y-3">
                                                {selectedOrder.items.map(
                                                    (item, index) => (
                                                        <div
                                                            key={
                                                                item.order_item_id ||
                                                                item.id ||
                                                                index
                                                            }
                                                            className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3 last:border-0 last:pb-0"
                                                        >
                                                            <div className="min-w-0">
                                                                <p className="break-words text-sm font-semibold text-cyprus">
                                                                    {item.product_name ||
                                                                        item.name ||
                                                                        item.product?.name ||
                                                                        `Product ${
                                                                            index + 1
                                                                        }`}
                                                                </p>

                                                                <p className="mt-1 text-xs text-text-grey">
                                                                    Quantity:{" "}
                                                                    {item.quantity || 1}
                                                                </p>
                                                            </div>

                                                            <p className="shrink-0 text-sm font-bold text-cyprus">
                                                                {formatCurrency(
                                                                    item.subtotal ??
                                                                    item.total_price ??
                                                                    Number(
                                                                        item.price ??
                                                                        item.unit_price ??
                                                                        0
                                                                    ) *
                                                                    Number(
                                                                        item.quantity || 1
                                                                    )
                                                                )}
                                                            </p>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-text-grey">
                                                {typeof selectedOrder.items ===
                                                "number"
                                                    ? `${selectedOrder.items} item(s) in this order. Item details are not available in the response.`
                                                    : "No item details available."}
                                            </p>
                                        )}
                                    </div>

                                    {/* Price Breakdown */}
                                    <div className="rounded-xl border border-gray-100 p-4">
                                        <h3 className="mb-4 font-bold text-cyprus">
                                            Price Summary
                                        </h3>

                                        <div className="space-y-3 text-sm">
                                            <div className="flex justify-between gap-4">
                                                <span className="text-text-grey">
                                                    Subtotal
                                                </span>

                                                <span className="font-medium text-cyprus">
                                                    {formatCurrency(
                                                        selectedOrder.subtotal
                                                    )}
                                                </span>
                                            </div>

                                            <div className="flex justify-between gap-4">
                                                <span className="text-text-grey">
                                                    Discount
                                                </span>

                                                <span className="font-medium text-green-600">
                                                    −
                                                    {formatCurrency(
                                                        Number(
                                                            selectedOrder.discount || 0
                                                        ) +
                                                        Number(
                                                            selectedOrder.coupon_discount ||
                                                            0
                                                        )
                                                    )}
                                                </span>
                                            </div>

                                            <div className="flex justify-between gap-4">
                                                <span className="text-text-grey">
                                                    Tax
                                                </span>

                                                <span className="font-medium text-cyprus">
                                                    {formatCurrency(
                                                        selectedOrder.tax
                                                    )}
                                                </span>
                                            </div>

                                            <div className="flex justify-between gap-4">
                                                <span className="text-text-grey">
                                                    Shipping Fee
                                                </span>

                                                <span className="font-medium text-cyprus">
                                                    {formatCurrency(
                                                        selectedOrder.shipping_fee
                                                    )}
                                                </span>
                                            </div>

                                            <div className="border-t border-gray-100 pt-3">
                                                <div className="flex justify-between gap-4">
                                                    <span className="font-bold text-cyprus">
                                                        Total
                                                    </span>

                                                    <span className="text-lg font-bold text-ocean-green">
                                                        {formatCurrency(
                                                            selectedOrder.total
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Update Status */}
                                    <form
                                        onSubmit={handleStatusUpdate}
                                        className="rounded-xl border border-gray-100 p-4"
                                    >
                                        <h3 className="mb-4 font-bold text-cyprus">
                                            <i className="fa-solid fa-arrows-rotate mr-2 text-ocean-green"></i>
                                            Update Order Status
                                        </h3>

                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                            <div>
                                                <label
                                                    htmlFor="processing-order-status"
                                                    className="mb-2 block text-sm font-semibold text-cyprus"
                                                >
                                                    New Status
                                                </label>

                                                <select
                                                    id="processing-order-status"
                                                    value={selectedOrder.status}
                                                    disabled={updatingStatus}
                                                    onChange={(event) => {
                                                        setSelectedOrder(
                                                            (prev) => ({
                                                                ...prev,
                                                                status: event.target.value,
                                                            })
                                                        );

                                                        setDetailsError("");
                                                        setSuccessMessage("");
                                                    }}
                                                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-cyprus outline-none focus:border-ocean-green disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    {ORDER_STATUSES.map(
                                                        (status) => (
                                                            <option
                                                                key={status}
                                                                value={status}
                                                            >
                                                                {status
                                                                    .charAt(0)
                                                                    .toUpperCase() +
                                                                    status.slice(
                                                                        1
                                                                    )}
                                                            </option>
                                                        )
                                                    )}
                                                </select>
                                            </div>

                                            <div>
                                                <label
                                                    htmlFor="processing-status-note"
                                                    className="mb-2 block text-sm font-semibold text-cyprus"
                                                >
                                                    Note (Optional)
                                                </label>

                                                <input
                                                    id="processing-status-note"
                                                    type="text"
                                                    value={statusNote}
                                                    onChange={(event) =>
                                                        setStatusNote(
                                                            event.target.value
                                                        )
                                                    }
                                                    placeholder="Add an update note..."
                                                    maxLength={500}
                                                    disabled={updatingStatus}
                                                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-cyprus outline-none focus:border-ocean-green disabled:opacity-60"
                                                />
                                            </div>
                                        </div>

                                        {successMessage && (
                                            <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm font-medium text-green-700">
                                                <i className="fa-solid fa-circle-check mr-2"></i>
                                                {successMessage}
                                            </p>
                                        )}

                                        <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                            <button
                                                type="button"
                                                onClick={closeDetails}
                                                disabled={updatingStatus}
                                                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-cyprus transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Close
                                            </button>

                                            <button
                                                type="submit"
                                                disabled={
                                                    updatingStatus ||
                                                    selectedOrder.status ===
                                                        originalStatus
                                                }
                                                className="rounded-lg bg-ocean-green px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                {updatingStatus ? (
                                                    <>
                                                        <i className="fa-solid fa-spinner mr-2 animate-spin"></i>
                                                        Updating...
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className="fa-solid fa-check mr-2"></i>
                                                        Update Status
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </form>

                                    {/* Status History */}
                                    {Array.isArray(
                                        selectedOrder.status_history
                                    ) &&
                                        selectedOrder.status_history.length >
                                            0 && (
                                            <div className="rounded-xl border border-gray-100 p-4">
                                                <h3 className="mb-4 font-bold text-cyprus">
                                                    <i className="fa-solid fa-clock-rotate-left mr-2 text-ocean-green"></i>
                                                    Status History
                                                </h3>

                                                <div className="space-y-4">
                                                    {selectedOrder.status_history.map(
                                                        (history, index) => (
                                                            <div
                                                                key={
                                                                    history.id ||
                                                                    history.history_id ||
                                                                    index
                                                                }
                                                                className="flex gap-3"
                                                            >
                                                                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-aqua-spring text-ocean-green">
                                                                    <i className="fa-solid fa-check text-xs"></i>
                                                                </div>

                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-sm font-semibold capitalize text-cyprus">
                                                                        {history.status ||
                                                                            history.new_status ||
                                                                            "Status updated"}
                                                                    </p>

                                                                    {history.note && (
                                                                        <p className="mt-1 break-words text-sm text-text-grey">
                                                                            {
                                                                                history.note
                                                                            }
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
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ProcessingOrders;