import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import UserDashboardLayout from "../../layouts/UserDashboardLayout";

const API_URL = "http://192.168.1.10:5000/api/orders";
const SHIPMENTS_API = "http://192.168.1.10:5000/api/shipments";
const ITEMS_PER_PAGE = 5;

function normalizeOrder(order) {
    const databaseId = order.id ?? order.order_id;

    const orderNumber =
        order.order_number ??
        order.order_code ??
        order.order_id ??
        order.id ??
        "N/A";

    return {
        ...order,
        databaseId,
        id: orderNumber,
        orderNumber,
        status: String(
            order.order_status ?? order.status ?? "pending"
        ).toLowerCase(),
        paymentStatus: String(
            order.payment_status ?? order.paymentStatus ?? "pending"
        ).toLowerCase(),
        total: Number(
            order.total_amount ?? order.total ?? order.grand_total ?? 0
        ),
        subtotal: Number(order.subtotal ?? 0),
        discount: Number(order.discount ?? 0),
        couponDiscount: Number(order.coupon_discount ?? 0),
        tax: Number(order.tax ?? 0),
        shippingFee: Number(order.shipping_fee ?? 0),
        createdAt: order.created_at ?? order.createdAt ?? null,
        items: Array.isArray(order.items)
            ? order.items
            : Array.isArray(order.order_items)
                ? order.order_items
                : [],
    };
}

function formatCurrency(amount) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
}

function formatDateTime(value) {
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
}

function formatStatus(status) {
    if (!status) return "Pending";

    return String(status)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getStatusClasses(status) {
    const classes = {
        pending: "bg-amber-50 text-amber-700 ring-amber-200",
        confirmed: "bg-blue-50 text-blue-700 ring-blue-200",
        processing: "bg-blue-50 text-blue-700 ring-blue-200",
        packed: "bg-indigo-50 text-indigo-700 ring-indigo-200",
        ready_to_ship: "bg-indigo-50 text-indigo-700 ring-indigo-200",
        shipped: "bg-indigo-50 text-indigo-700 ring-indigo-200",
        in_transit: "bg-indigo-50 text-indigo-700 ring-indigo-200",
        out_for_delivery: "bg-indigo-50 text-indigo-700 ring-indigo-200",
        delivered: "bg-emerald-50 text-emerald-700 ring-emerald-200",
        cancelled: "bg-red-50 text-red-700 ring-red-200",
        canceled: "bg-red-50 text-red-700 ring-red-200",
        failed_delivery: "bg-red-50 text-red-700 ring-red-200",
        returned: "bg-purple-50 text-purple-700 ring-purple-200",
        refunded: "bg-purple-50 text-purple-700 ring-purple-200",
    };

    return (
        classes[String(status || "").toLowerCase()] ||
        "bg-gray-100 text-gray-700 ring-gray-200"
    );
}

function getPaymentClasses(status) {
    const value = String(status || "").toLowerCase();

    if (value === "paid") {
        return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    }

    if (value === "failed" || value === "refunded") {
        return "bg-red-50 text-red-700 ring-red-200";
    }

    return "bg-amber-50 text-amber-700 ring-amber-200";
}

function canCancelOrder(order) {
    return (
        order?.status === "pending" &&
        order?.paymentStatus !== "paid" &&
        Number.isInteger(Number(order?.databaseId)) &&
        Number(order?.databaseId) > 0
    );
}

function getToken() {
    return (
        localStorage.getItem("shopsphereToken") ||
        localStorage.getItem("token")
    );
}

function getErrorMessage(result, fallback) {
    return result?.message || result?.error || fallback;
}

/*
 * API response wrappers ને handle કરે છે.
 *
 * Supported examples:
 * { success: true, data: { shipments: [...] } }
 * { success: true, data: { shipment: {...} } }
 * { success: true, data: {...shipmentFields} }
 * Direct shipment object
 */
function extractShipment(result) {
    if (!result || typeof result !== "object") {
        return null;
    }

    const value = result.data ?? result;

    if (Array.isArray(value)) {
        return value[0] ?? null;
    }

    if (!value || typeof value !== "object") {
        return null;
    }

    if (Array.isArray(value.shipments)) {
        return value.shipments[0] ?? null;
    }

    if (value.shipment && typeof value.shipment === "object") {
        return value.shipment;
    }

    if (
        value.tracking_number ||
        value.trackingNumber ||
        value.shipment_id ||
        value.shipmentId ||
        value.shipment_status ||
        value.courier_name
    ) {
        return value;
    }

    return null;
}

/*
 * Tracking API response માંથી tracking object મેળવે છે.
 */
function extractTracking(result) {
    if (!result || typeof result !== "object") {
        return null;
    }

    const value = result.data ?? result;

    if (Array.isArray(value)) {
        return value[0] ?? null;
    }

    if (!value || typeof value !== "object") {
        return null;
    }

    if (value.tracking && typeof value.tracking === "object") {
        return value.tracking;
    }

    return value;
}

/*
 * Tracking history અલગ અલગ response shapes માંથી મેળવે છે.
 */
function getTrackingHistory(tracking, shipment) {
    const candidates = [
        tracking?.tracking_history,
        tracking?.trackingHistory,
        tracking?.history,

        tracking?.data?.tracking_history,
        tracking?.data?.trackingHistory,

        tracking?.shipment?.tracking_history,
        tracking?.shipment?.trackingHistory,

        tracking?.shipment?.tracking?.tracking_history,

        shipment?.tracking_history,
        shipment?.trackingHistory,
        shipment?.tracking?.tracking_history,
    ];

    return candidates.find(Array.isArray) ?? [];
}

function getShippingAddress(shipment, order) {
    const address =
        shipment?.shipping_address ??
        shipment?.delivery_address ??
        shipment?.address ??
        order?.shipping_address ??
        order?.delivery_address;

    if (typeof address === "string") {
        return address;
    }

    if (address && typeof address === "object") {
        return [
            address.full_name ?? address.name,
            address.phone ?? address.mobile,
            address.address_line1 ?? address.addressLine1 ?? address.address,
            address.address_line2 ?? address.addressLine2,
            address.landmark,
            address.city,
            address.state,
            address.pincode ?? address.postal_code ?? address.zip_code,
            address.country,
        ]
            .filter(Boolean)
            .join(", ");
    }

    return [
        shipment?.recipient_name,
        shipment?.address_line1,
        shipment?.address_line2,
        shipment?.city,
        shipment?.state,
        shipment?.pincode ?? shipment?.postal_code,
        shipment?.country,
    ]
        .filter(Boolean)
        .join(", ");
}

function StatCard({ title, count, icon, iconClass, description }) {
    return (
        <div className="group rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md sm:p-5">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-500">
                        {title}
                    </p>

                    <p className="mt-3 text-2xl font-bold tracking-tight text-cyprus sm:text-3xl">
                        {count}
                    </p>

                    <p className="mt-1 text-xs text-gray-400">
                        {description}
                    </p>
                </div>

                <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg transition group-hover:scale-105 ${iconClass}`}
                >
                    <i className={`fa-solid ${icon}`} />
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status, payment = false }) {
    const normalizedStatus = String(status || "").toLowerCase();

    return (
        <span
            className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${
                payment
                    ? getPaymentClasses(normalizedStatus)
                    : getStatusClasses(normalizedStatus)
            }`}
        >
            <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    payment
                        ? normalizedStatus === "paid"
                            ? "bg-emerald-500"
                            : ["failed", "refunded"].includes(normalizedStatus)
                                ? "bg-red-500"
                                : "bg-amber-500"
                        : normalizedStatus === "delivered"
                            ? "bg-emerald-500"
                            : ["cancelled", "canceled", "failed_delivery"].includes(
                                normalizedStatus
                            )
                                ? "bg-red-500"
                                : [
                                    "processing",
                                    "confirmed",
                                    "packed",
                                    "ready_to_ship",
                                    "shipped",
                                    "in_transit",
                                    "out_for_delivery",
                                ].includes(normalizedStatus)
                                    ? "bg-blue-500"
                                    : "bg-amber-500"
                }`}
            />

            {formatStatus(normalizedStatus)}
        </span>
    );
}

function ModalHeader({ title, subtitle, icon, onClose }) {
    return (
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-gray-100 bg-white px-5 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-aqua-spring text-lg text-ocean-green">
                    <i className={`fa-solid ${icon}`} />
                </div>

                <div className="min-w-0">
                    <h2 className="text-lg font-bold text-cyprus sm:text-xl">
                        {title}
                    </h2>

                    <p className="mt-1 break-all text-sm text-gray-500">
                        {subtitle}
                    </p>
                </div>
            </div>

            <button
                type="button"
                aria-label={`Close ${title}`}
                onClick={onClose}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600 transition hover:bg-gray-200"
            >
                <i className="fa-solid fa-xmark" />
            </button>
        </div>
    );
}

function ModalLoading() {
    return (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500">
            <i className="fa-solid fa-spinner fa-spin text-3xl text-ocean-green" />
            <p className="text-sm">Loading information...</p>
        </div>
    );
}

function ModalError({ message }) {
    return (
        <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700"
        >
            <i className="fa-solid fa-circle-exclamation mr-2" />
            {message}
        </div>
    );
}

function Orders() {
    const navigate = useNavigate();

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [paymentFilter, setPaymentFilter] = useState("all");
    const [sortOrder, setSortOrder] = useState("newest");
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedOrder, setSelectedOrder] = useState(null);

    const [orderToCancel, setOrderToCancel] = useState(null);
    const [cancelLoading, setCancelLoading] = useState(false);
    const [cancelError, setCancelError] = useState("");
    const [cancelMessage, setCancelMessage] = useState("");

    const [shippingModal, setShippingModal] = useState({
        open: false,
        order: null,
        shipment: null,
        loading: false,
        error: "",
    });

    const [trackingModal, setTrackingModal] = useState({
        open: false,
        order: null,
        shipment: null,
        tracking: null,
        loading: false,
        error: "",
    });

    const closeShippingModal = () => {
        setShippingModal({
            open: false,
            order: null,
            shipment: null,
            loading: false,
            error: "",
        });
    };

    const closeTrackingModal = () => {
        setTrackingModal({
            open: false,
            order: null,
            shipment: null,
            tracking: null,
            loading: false,
            error: "",
        });
    };

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const token = getToken();

            if (!token) {
                setOrders([]);
                setError("Please login to view your orders.");
                return;
            }

            const response = await fetch(API_URL, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok || result.success === false) {
                throw new Error(
                    getErrorMessage(result, "Unable to load your orders.")
                );
            }

            const orderData = Array.isArray(result)
                ? result
                : Array.isArray(result.data)
                    ? result.data
                    : Array.isArray(result.orders)
                        ? result.orders
                        : Array.isArray(result.data?.orders)
                            ? result.data.orders
                            : Array.isArray(result.results)
                                ? result.results
                                : [];

            setOrders(orderData.map(normalizeOrder));
        } catch (err) {
            setError(
                err.message || "Something went wrong while loading orders."
            );
            setOrders([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    /*
     * GET /api/shipments/orders/:orderId
     */
    const fetchShipmentForOrder = async (order) => {
        const token = getToken();

        if (!token) {
            throw new Error("Please login to view shipment details.");
        }

        const databaseId = Number(order?.databaseId);

        if (!Number.isInteger(databaseId) || databaseId <= 0) {
            throw new Error("Order database ID is missing or invalid.");
        }

        const response = await fetch(
            `${SHIPMENTS_API}/orders/${databaseId}`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            }
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok || result.success === false) {
            throw new Error(
                getErrorMessage(result, "Unable to load shipment details.")
            );
        }

        const shipment = extractShipment(result);

        if (!shipment) {
            throw new Error(
                "Shipment has not been created for this order yet."
            );
        }

        return shipment;
    };

    const handleOpenShipping = async (order) => {
        setShippingModal({
            open: true,
            order,
            shipment: null,
            loading: true,
            error: "",
        });

        try {
            const shipment = await fetchShipmentForOrder(order);

            setShippingModal((previous) => ({
                ...previous,
                shipment,
                loading: false,
                error: "",
            }));
        } catch (err) {
            setShippingModal((previous) => ({
                ...previous,
                loading: false,
                error: err.message || "Unable to load shipping details.",
            }));
        }
    };

    /*
     * Tracking data ફરીથી લાવવા માટે common function.
     * Modal ખુલ્લો હોય ત્યારે Refresh Tracking આ function વાપરે છે.
     */
    const loadTrackingForOrder = async (order) => {
        const shipment = await fetchShipmentForOrder(order);

        const trackingNumber =
            shipment?.tracking_number ??
            shipment?.trackingNumber ??
            order?.tracking_number ??
            order?.trackingNumber ??
            order?.shipment?.tracking_number;

        if (!trackingNumber) {
            throw new Error(
                "Tracking number is not available for this order yet."
            );
        }

        const token = getToken();

        if (!token) {
            throw new Error("Please login to view tracking information.");
        }

        const response = await fetch(
            `${SHIPMENTS_API}/tracking/${encodeURIComponent(trackingNumber)}`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                cache: "no-store",
            }
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok || result.success === false) {
            throw new Error(
                getErrorMessage(result, "Unable to load tracking information.")
            );
        }

        const tracking = extractTracking(result);

        if (!tracking) {
            throw new Error("Tracking information was not found.");
        }

        return { shipment, tracking };
    };

    const handleOpenTracking = async (order) => {
        setTrackingModal({
            open: true,
            order,
            shipment: null,
            tracking: null,
            loading: true,
            error: "",
        });

        try {
            const { shipment, tracking } = await loadTrackingForOrder(order);

            setTrackingModal((previous) => ({
                ...previous,
                shipment,
                tracking,
                loading: false,
                error: "",
            }));
        } catch (err) {
            setTrackingModal((previous) => ({
                ...previous,
                loading: false,
                error: err.message || "Unable to load tracking information.",
            }));
        }
    };

    const handleRefreshTracking = async () => {
        const order = trackingModal.order;

        if (!order || trackingModal.loading) return;

        setTrackingModal((previous) => ({
            ...previous,
            loading: true,
            error: "",
        }));

        try {
            const { shipment, tracking } = await loadTrackingForOrder(order);

            setTrackingModal((previous) => ({
                ...previous,
                shipment,
                tracking,
                loading: false,
                error: "",
            }));
        } catch (err) {
            setTrackingModal((previous) => ({
                ...previous,
                loading: false,
                error: err.message || "Unable to refresh tracking information.",
            }));
        }
    };

    const handleCancelOrder = async () => {
        if (!orderToCancel || cancelLoading) return;

        setCancelLoading(true);
        setCancelError("");
        setCancelMessage("");

        try {
            const token = getToken();

            if (!token) {
                throw new Error("Please login to cancel your order.");
            }

            const databaseId = Number(orderToCancel.databaseId);

            if (!Number.isInteger(databaseId) || databaseId <= 0) {
                throw new Error(
                    "The database order ID is missing. Please refresh your orders."
                );
            }

            const response = await fetch(
                `${API_URL}/${databaseId}/cancel`,
                {
                    method: "PATCH",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            const result = await response.json().catch(() => ({}));

            if (!response.ok || result.success === false) {
                throw new Error(
                    getErrorMessage(result, "Failed to cancel this order.")
                );
            }

            setCancelMessage(
                result.message || "Order cancelled successfully."
            );

            setOrderToCancel(null);
            setSelectedOrder(null);

            await fetchOrders();
        } catch (err) {
            setCancelError(err.message || "Unable to cancel this order.");
        } finally {
            setCancelLoading(false);
        }
    };

    const filteredOrders = useMemo(() => {
        let result = [...orders];
        const search = searchTerm.trim().toLowerCase();

        if (search) {
            result = result.filter((order) =>
                [
                    order.orderNumber,
                    order.status,
                    order.paymentStatus,
                ].some((value) =>
                    String(value ?? "").toLowerCase().includes(search)
                )
            );
        }

        if (statusFilter !== "all") {
            result = result.filter((order) => order.status === statusFilter);
        }

        if (paymentFilter !== "all") {
            result = result.filter(
                (order) => order.paymentStatus === paymentFilter
            );
        }

        result.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0).getTime();
            const dateB = new Date(b.createdAt || 0).getTime();

            if (sortOrder === "oldest") return dateA - dateB;
            if (sortOrder === "amount-high") return b.total - a.total;
            if (sortOrder === "amount-low") return a.total - b.total;

            return dateB - dateA;
        });

        return result;
    }, [orders, searchTerm, statusFilter, paymentFilter, sortOrder]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, paymentFilter, sortOrder]);

    const totalPages = Math.max(
        1,
        Math.ceil(filteredOrders.length / ITEMS_PER_PAGE)
    );

    const safePage = Math.min(currentPage, totalPages);

    const paginatedOrders = filteredOrders.slice(
        (safePage - 1) * ITEMS_PER_PAGE,
        safePage * ITEMS_PER_PAGE
    );

    const orderStats = useMemo(
        () => ({
            total: orders.length,
            pending: orders.filter((order) => order.status === "pending").length,
            delivered: orders.filter((order) => order.status === "delivered").length,
            cancelled: orders.filter((order) =>
                ["cancelled", "canceled"].includes(order.status)
            ).length,
        }),
        [orders]
    );

    const clearFilters = () => {
        setSearchTerm("");
        setStatusFilter("all");
        setPaymentFilter("all");
        setSortOrder("newest");
        setCurrentPage(1);
    };

    const closeCancelModal = () => {
        if (cancelLoading) return;
        setOrderToCancel(null);
        setCancelError("");
    };

    return (
        <UserDashboardLayout>
            <div className="w-full min-w-0 space-y-6 p-4 pb-8">
                {/* Header */}
                <div className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-aqua-spring text-xl text-ocean-green">
                            <i className="fa-solid fa-boxes-stacked" />
                        </div>

                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-cyprus sm:text-3xl">
                                My Orders
                            </h1>
                            <p className="mt-1 text-sm leading-6 text-gray-500">
                                Track your purchases and manage your orders.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={fetchOrders}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-cyprus transition hover:border-ocean-green hover:bg-aqua-spring/30 disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
                    >
                        <i className={`fa-solid fa-rotate-right ${loading ? "fa-spin" : ""}`} />
                        Refresh Orders
                    </button>
                </div>

                {/* Cancellation success */}
                {cancelMessage && (
                    <div
                        role="status"
                        className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
                    >
                        <i className="fa-solid fa-circle-check mt-0.5 text-lg" />
                        <p className="flex-1 font-medium">{cancelMessage}</p>
                        <button
                            type="button"
                            onClick={() => setCancelMessage("")}
                            aria-label="Dismiss success message"
                        >
                            <i className="fa-solid fa-xmark" />
                        </button>
                    </div>
                )}

                {/* Fetch error */}
                {error && (
                    <div
                        role="alert"
                        className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"
                    >
                        <p>
                            <i className="fa-solid fa-circle-exclamation mr-2" />
                            {error}
                        </p>
                        <button
                            type="button"
                            onClick={fetchOrders}
                            className="self-start font-bold underline sm:self-auto"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {/* Summary cards */}
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                    <StatCard
                        title="Total Orders"
                        count={orderStats.total}
                        icon="fa-box"
                        iconClass="bg-aqua-spring text-ocean-green"
                        description="All purchases"
                    />
                    <StatCard
                        title="Pending"
                        count={orderStats.pending}
                        icon="fa-clock"
                        iconClass="bg-amber-50 text-amber-600"
                        description="Awaiting processing"
                    />
                    <StatCard
                        title="Delivered"
                        count={orderStats.delivered}
                        icon="fa-truck-fast"
                        iconClass="bg-emerald-50 text-emerald-600"
                        description="Successfully received"
                    />
                    <StatCard
                        title="Cancelled"
                        count={orderStats.cancelled}
                        icon="fa-ban"
                        iconClass="bg-red-50 text-red-600"
                        description="Cancelled purchases"
                    />
                </div>

                {/* Search and filters */}
                <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
                    <div className="mb-4 flex items-center gap-2">
                        <i className="fa-solid fa-sliders text-ocean-green" />
                        <h2 className="font-bold text-cyprus">Search & Filters</h2>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="relative min-w-0">
                            <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="Search order number..."
                                className="w-full rounded-xl border border-gray-200 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-ocean-green focus:ring-2 focus:ring-ocean-green/10"
                            />
                        </div>

                        <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value)}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-cyprus outline-none focus:border-ocean-green"
                        >
                            <option value="all">All Order Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="processing">Processing</option>
                            <option value="packed">Packed</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="canceled">Canceled</option>
                            <option value="returned">Returned</option>
                            <option value="refunded">Refunded</option>
                        </select>

                        <select
                            value={paymentFilter}
                            onChange={(event) => setPaymentFilter(event.target.value)}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-cyprus outline-none focus:border-ocean-green"
                        >
                            <option value="all">All Payment Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="paid">Paid</option>
                            <option value="failed">Failed</option>
                            <option value="refunded">Refunded</option>
                        </select>

                        <select
                            value={sortOrder}
                            onChange={(event) => setSortOrder(event.target.value)}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-cyprus outline-none focus:border-ocean-green"
                        >
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                            <option value="amount-high">Amount: High to Low</option>
                            <option value="amount-low">Amount: Low to High</option>
                        </select>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-gray-500">
                            Showing{" "}
                            <span className="font-semibold text-cyprus">
                                {filteredOrders.length === 0
                                    ? 0
                                    : (safePage - 1) * ITEMS_PER_PAGE + 1}
                                {"–"}
                                {Math.min(
                                    safePage * ITEMS_PER_PAGE,
                                    filteredOrders.length
                                )}
                            </span>{" "}
                            of{" "}
                            <span className="font-semibold text-cyprus">
                                {filteredOrders.length}
                            </span>{" "}
                            orders
                        </p>

                        <button
                            type="button"
                            onClick={clearFilters}
                            className="self-start font-semibold text-ocean-green transition hover:underline sm:self-auto"
                        >
                            <i className="fa-solid fa-filter-circle-xmark mr-2" />
                            Clear Filters
                        </button>
                    </div>
                </section>

                {/* Order History */}
                <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                    <div className="flex flex-col gap-2 border-b border-gray-100 bg-gradient-to-r from-white to-gray-50/70 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <div>
                            <h2 className="text-lg font-bold text-cyprus">Order History</h2>
                            <p className="mt-1 text-sm text-gray-500">
                                Review your orders, payment status and totals.
                            </p>
                        </div>

                        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-aqua-spring px-3 py-1.5 text-xs font-bold text-ocean-green">
                            <i className="fa-solid fa-receipt" />
                            {filteredOrders.length} Orders
                        </span>
                    </div>

                    {loading ? (
                        <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-gray-500">
                            <i className="fa-solid fa-spinner fa-spin text-3xl text-ocean-green" />
                            <p className="text-sm">Loading your orders...</p>
                        </div>
                    ) : paginatedOrders.length === 0 ? (
                        <div className="flex min-h-72 flex-col items-center justify-center px-5 py-12 text-center">
                            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-aqua-spring text-3xl text-ocean-green">
                                <i className="fa-solid fa-box-open" />
                            </div>

                            <h3 className="mt-5 text-lg font-bold text-cyprus">No orders found</h3>

                            <p className="mt-2 max-w-sm text-sm leading-6 text-gray-500">
                                {orders.length === 0
                                    ? "You haven't placed any orders yet. Your purchases will appear here."
                                    : "No orders match your current filters. Try changing your search or filters."}
                            </p>

                            {orders.length === 0 ? (
                                <button
                                    type="button"
                                    onClick={() => navigate("/products")}
                                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-ocean-green px-5 py-3 text-sm font-bold text-white transition hover:opacity-90"
                                >
                                    <i className="fa-solid fa-bag-shopping" />
                                    Explore Products
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="mt-5 rounded-xl bg-ocean-green px-5 py-3 text-sm font-bold text-white transition hover:opacity-90"
                                >
                                    Clear Filters
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="space-y-4 bg-gray-50/50 p-3 sm:p-5">
                                {paginatedOrders.map((order, index) => (
                                    <article
                                        key={order.databaseId ?? `${order.orderNumber}-${index}`}
                                        className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition duration-300 hover:border-ocean-green/30 hover:shadow-md"
                                    >
                                        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
                                            <div className="flex min-w-0 items-start gap-3">
                                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-aqua-spring text-lg text-ocean-green">
                                                    <i className="fa-solid fa-box" />
                                                </div>

                                                <div className="min-w-0">
                                                    <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                                                        Order Number
                                                    </p>
                                                    <h3 className="mt-1 break-all text-base font-bold text-cyprus">
                                                        #{order.orderNumber}
                                                    </h3>
                                                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                                                        <i className="fa-regular fa-calendar" />
                                                        {formatDateTime(order.createdAt)}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                                <StatusBadge status={order.status} />
                                                <StatusBadge status={order.paymentStatus} payment />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:px-5 sm:py-5">
                                            <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 sm:p-4">
                                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                                    <i className="fa-solid fa-indian-rupee-sign text-ocean-green" />
                                                    Total Amount
                                                </div>
                                                <p className="mt-2 break-words text-lg font-bold text-cyprus sm:text-xl">
                                                    {formatCurrency(order.total)}
                                                </p>
                                            </div>

                                            <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 sm:p-4">
                                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                                    <i className="fa-solid fa-credit-card text-ocean-green" />
                                                    Payment Status
                                                </div>
                                                <div className="mt-2">
                                                    <StatusBadge status={order.paymentStatus} payment />
                                                </div>
                                            </div>

                                            <div className="col-span-2 rounded-xl border border-gray-100 bg-gray-50/80 p-3 sm:col-span-1 sm:p-4">
                                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                                    <i className="fa-solid fa-fingerprint text-ocean-green" />
                                                    Order ID
                                                </div>
                                                <p className="mt-2 break-all text-sm font-bold text-cyprus">
                                                    {order.databaseId ?? "—"}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2 border-t border-gray-100 bg-white p-4 sm:px-5">
                                            <p className="text-xs text-gray-500">
                                                <i className="fa-solid fa-shield-halved mr-1.5 text-ocean-green" />
                                                Order details and shipment information
                                            </p>

                                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedOrder(order);
                                                        setCancelError("");
                                                        setCancelMessage("");
                                                    }}
                                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-cyprus transition hover:border-ocean-green hover:bg-aqua-spring/20 hover:text-ocean-green"
                                                >
                                                    <i className="fa-regular fa-eye" />
                                                    View Details
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenShipping(order)}
                                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-cyprus transition hover:border-ocean-green hover:bg-aqua-spring/20 hover:text-ocean-green"
                                                >
                                                    <i className="fa-solid fa-truck" />
                                                    Shipping
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenTracking(order)}
                                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
                                                >
                                                    <i className="fa-solid fa-location-dot" />
                                                    Shipment Tracking
                                                </button>

                                                {canCancelOrder(order) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setCancelError("");
                                                            setCancelMessage("");
                                                            setOrderToCancel(order);
                                                        }}
                                                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                                                    >
                                                        <i className="fa-solid fa-ban" />
                                                        Cancel Order
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>

                            <div className="flex flex-col items-center justify-center gap-4 border-t border-gray-100 px-4 py-5 sm:flex-row sm:justify-between sm:px-6">
                                <p className="text-sm text-gray-500">
                                    Page{" "}
                                    <span className="font-bold text-cyprus">{safePage}</span>
                                    {" "}of{" "}
                                    <span className="font-bold text-cyprus">{totalPages}</span>
                                </p>

                                <div className="flex w-full items-center justify-center gap-3 sm:w-auto">
                                    <button
                                        type="button"
                                        disabled={safePage <= 1}
                                        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-cyprus transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 sm:px-5"
                                    >
                                        <i className="fa-solid fa-arrow-left" />
                                        Previous
                                    </button>

                                    <button
                                        type="button"
                                        disabled={safePage >= totalPages}
                                        onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-ocean-green px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        Next
                                        <i className="fa-solid fa-arrow-right" />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </section>

                {/* Shipping Details Modal */}
                {shippingModal.open && (
                    <div
                        className="fixed inset-0 z-[130] flex items-center justify-center overflow-y-auto bg-black/50 p-3 backdrop-blur-sm sm:p-5"
                        onClick={closeShippingModal}
                    >
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="shippingModalTitle"
                            className="my-auto max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <ModalHeader
                                title="Shipping Details"
                                subtitle={`Order #${shippingModal.order?.orderNumber ?? ""}`}
                                icon="fa-truck"
                                onClose={closeShippingModal}
                            />

                            <div className="space-y-4 p-5">
                                {shippingModal.loading ? (
                                    <ModalLoading />
                                ) : shippingModal.error ? (
                                    <ModalError message={shippingModal.error} />
                                ) : shippingModal.shipment ? (
                                    <>
                                        {(() => {
                                            const shipment = shippingModal.shipment;
                                            const address = getShippingAddress(
                                                shipment,
                                                shippingModal.order
                                            );

                                            const details = [
                                                {
                                                    label: "Shipment Status",
                                                    value: formatStatus(
                                                        shipment.status ??
                                                        shipment.shipment_status ??
                                                        "pending"
                                                    ),
                                                    icon: "fa-box",
                                                },
                                                {
                                                    label: "Courier / Shipping Method",
                                                    value:
                                                        shipment.courier_name ??
                                                        shipment.shipping_method ??
                                                        shipment.courier ??
                                                        "Not available",
                                                    icon: "fa-truck-fast",
                                                },
                                                {
                                                    label: "Tracking Number",
                                                    value:
                                                        shipment.tracking_number ??
                                                        shipment.trackingNumber ??
                                                        "Not assigned",
                                                    icon: "fa-barcode",
                                                },
                                                {
                                                    label: "Shipping Fee",
                                                    value: formatCurrency(
                                                        shipment.shipping_fee ??
                                                        shipment.shipping_cost ??
                                                        shippingModal.order?.shippingFee ??
                                                        0
                                                    ),
                                                    icon: "fa-indian-rupee-sign",
                                                },
                                                {
                                                    label: "Expected Delivery",
                                                    value: shipment.expected_delivery_date
                                                        ? formatDateTime(shipment.expected_delivery_date)
                                                        : "Not available",
                                                    icon: "fa-calendar-check",
                                                },
                                            ];

                                            return (
                                                <>
                                                    <div className="rounded-xl bg-aqua-spring/30 p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-xl text-ocean-green shadow-sm">
                                                                <i className="fa-solid fa-location-dot" />
                                                            </div>
                                                            <div>
                                                                <h3 className="font-bold text-cyprus">
                                                                    Delivery Address
                                                                </h3>
                                                                <p className="mt-1 text-xs text-gray-500">
                                                                    Shipping destination
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <p className="mt-4 break-words text-sm leading-6 text-gray-700">
                                                            {address || "Address is not included in the shipment API response."}
                                                        </p>
                                                    </div>

                                                    <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                                                        {details.map((detail) => (
                                                            <div
                                                                key={detail.label}
                                                                className="flex items-start gap-3 p-4"
                                                            >
                                                                <i className={`fa-solid ${detail.icon} mt-1 w-5 text-center text-ocean-green`} />
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-xs text-gray-500">
                                                                        {detail.label}
                                                                    </p>
                                                                    <p className="mt-1 break-words text-sm font-semibold text-cyprus">
                                                                        {detail.value}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </>
                                ) : (
                                    <p className="text-sm text-gray-500">
                                        Shipping information is not available.
                                    </p>
                                )}

                                <button
                                    type="button"
                                    onClick={closeShippingModal}
                                    className="w-full rounded-xl bg-ocean-green px-5 py-3 text-sm font-bold text-white transition hover:opacity-90"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Shipment Tracking Modal */}
                {trackingModal.open && (
                    <div
                        className="fixed inset-0 z-[140] flex items-center justify-center overflow-y-auto bg-black/50 p-3 backdrop-blur-sm sm:p-5"
                        onClick={closeTrackingModal}
                    >
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="trackingModalTitle"
                            className="my-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <ModalHeader
                                title="Shipment Tracking"
                                subtitle={`Order #${trackingModal.order?.orderNumber ?? ""}`}
                                icon="fa-location-crosshairs"
                                onClose={closeTrackingModal}
                            />

                            <div className="space-y-5 p-5">
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={handleRefreshTracking}
                                        disabled={trackingModal.loading}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-cyprus transition hover:border-ocean-green hover:bg-aqua-spring/30 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <i
                                            className={`fa-solid fa-rotate-right ${
                                                trackingModal.loading ? "fa-spin" : ""
                                            }`}
                                        />
                                        Refresh Tracking
                                    </button>
                                </div>

                                {trackingModal.loading ? (
                                    <ModalLoading />
                                ) : trackingModal.error ? (
                                    <ModalError message={trackingModal.error} />
                                ) : trackingModal.tracking ? (
                                    <>
                                        {(() => {
                                            const tracking = trackingModal.tracking;
                                            const shipment = trackingModal.shipment;

                                            const shipmentData =
                                                tracking?.shipment ??
                                                tracking?.data?.shipment ??
                                                tracking;

                                            const history = getTrackingHistory(
                                                tracking,
                                                shipment
                                            );

                                            const currentStatus =
                                                shipmentData?.current_status ??
                                                shipmentData?.shipment_status ??
                                                shipmentData?.status ??
                                                shipment?.current_status ??
                                                shipment?.shipment_status ??
                                                shipment?.status ??
                                                "pending";

                                            const trackingNumber =
                                                shipmentData?.tracking_number ??
                                                shipmentData?.trackingNumber ??
                                                shipment?.tracking_number ??
                                                shipment?.trackingNumber ??
                                                "Not available";

                                            const courier =
                                                shipmentData?.courier_name ??
                                                shipmentData?.courier ??
                                                shipmentData?.shipping_method ??
                                                shipment?.courier_name ??
                                                shipment?.courier ??
                                                "Not available";

                                            const sortedHistory = [...history].sort(
                                                (a, b) => {
                                                    const dateA = new Date(
                                                        a.tracked_at ??
                                                        a.created_at ??
                                                        a.date ??
                                                        0
                                                    ).getTime();

                                                    const dateB = new Date(
                                                        b.tracked_at ??
                                                        b.created_at ??
                                                        b.date ??
                                                        0
                                                    ).getTime();

                                                    return dateA - dateB;
                                                }
                                            );

                                            return (
                                                <>
                                                    <div className="rounded-2xl bg-gradient-to-r from-ocean-green to-cyprus p-5 text-white">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div>
                                                                <p className="text-sm text-white/75">
                                                                    Current Shipment Status
                                                                </p>
                                                                <h3 className="mt-2 text-2xl font-bold">
                                                                    {formatStatus(currentStatus)}
                                                                </h3>
                                                            </div>

                                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 text-xl">
                                                                <i className="fa-solid fa-truck-fast" />
                                                            </div>
                                                        </div>

                                                        <div className="mt-5 grid grid-cols-1 gap-4 border-t border-white/20 pt-4 sm:grid-cols-2">
                                                            <div>
                                                                <p className="text-xs text-white/70">
                                                                    Tracking Number
                                                                </p>
                                                                <p className="mt-1 break-all font-semibold">
                                                                    {trackingNumber}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-white/70">
                                                                    Courier
                                                                </p>
                                                                <p className="mt-1 break-words font-semibold">
                                                                    {courier}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="rounded-2xl border border-gray-100 p-4 sm:p-5">
                                                        <h3 className="font-bold text-cyprus">
                                                            <i className="fa-solid fa-route mr-2 text-ocean-green" />
                                                            Tracking History
                                                        </h3>

                                                        {sortedHistory.length > 0 ? (
                                                            <div className="mt-5">
                                                                {sortedHistory.map((entry, index) => (
                                                                    <div
                                                                        key={
                                                                            entry.id ??
                                                                            `${entry.status ?? entry.shipment_status}-${entry.tracked_at ?? entry.created_at ?? index}`
                                                                        }
                                                                        className="relative flex gap-4 pb-6 last:pb-0"
                                                                    >
                                                                        {index !== sortedHistory.length - 1 && (
                                                                            <span className="absolute bottom-0 left-[11px] top-6 w-0.5 bg-gray-200" />
                                                                        )}

                                                                        <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-aqua-spring text-xs text-ocean-green ring-4 ring-white">
                                                                            <i className="fa-solid fa-check" />
                                                                        </div>

                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                                                                <p className="break-words text-sm font-bold text-cyprus">
                                                                                    {formatStatus(
                                                                                        entry.status ??
                                                                                        entry.shipment_status ??
                                                                                        "Update"
                                                                                    )}
                                                                                </p>
                                                                                <p className="text-xs text-gray-400">
                                                                                    {formatDateTime(
                                                                                        entry.tracked_at ??
                                                                                        entry.created_at ??
                                                                                        entry.date
                                                                                    )}
                                                                                </p>
                                                                            </div>

                                                                            {(entry.location || entry.description) && (
                                                                                <p className="mt-1 break-words text-sm leading-6 text-gray-500">
                                                                                    {[
                                                                                        entry.location,
                                                                                        entry.description,
                                                                                    ]
                                                                                        .filter(Boolean)
                                                                                        .join(" — ")}
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm leading-6 text-gray-500">
                                                                Tracking history is not available yet. The latest shipment status is shown above.
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </>
                                ) : (
                                    <p className="text-sm text-gray-500">
                                        Tracking information is not available.
                                    </p>
                                )}

                                <button
                                    type="button"
                                    onClick={closeTrackingModal}
                                    className="w-full rounded-xl bg-ocean-green px-5 py-3 text-sm font-bold text-white transition hover:opacity-90"
                                >
                                    Close Tracking
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Order Details Modal */}
                {selectedOrder && (
                    <div
                        className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50 p-3 backdrop-blur-sm sm:p-5"
                        onClick={() => setSelectedOrder(null)}
                    >
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="orderDetailsTitle"
                            className="my-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-gray-100 bg-white px-5 py-4 sm:px-6">
                                <div className="min-w-0">
                                    <h2
                                        id="orderDetailsTitle"
                                        className="text-lg font-bold text-cyprus sm:text-xl"
                                    >
                                        Order Details
                                    </h2>
                                    <p className="mt-1 break-all text-sm text-gray-500">
                                        Order #{selectedOrder.orderNumber}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    aria-label="Close order details"
                                    onClick={() => setSelectedOrder(null)}
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600 transition hover:bg-gray-200"
                                >
                                    <i className="fa-solid fa-xmark" />
                                </button>
                            </div>

                            <div className="space-y-5 p-4 sm:p-6">
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div className="rounded-xl border border-gray-100 p-4">
                                        <p className="text-xs text-gray-500">Order Status</p>
                                        <div className="mt-2">
                                            <StatusBadge status={selectedOrder.status} />
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-gray-100 p-4">
                                        <p className="text-xs text-gray-500">Payment Status</p>
                                        <div className="mt-2">
                                            <StatusBadge status={selectedOrder.paymentStatus} payment />
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-gray-100 p-4">
                                        <p className="text-xs text-gray-500">Order Date & Time</p>
                                        <p className="mt-2 break-words text-sm font-semibold text-cyprus">
                                            {formatDateTime(selectedOrder.createdAt)}
                                        </p>
                                    </div>

                                    <div className="rounded-xl border border-gray-100 p-4">
                                        <p className="text-xs text-gray-500">Database Order ID</p>
                                        <p className="mt-2 break-all text-sm font-semibold text-cyprus">
                                            {selectedOrder.databaseId ?? "—"}
                                        </p>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-gray-100 p-4 sm:p-5">
                                    <h3 className="font-bold text-cyprus">Price Summary</h3>

                                    <div className="mt-4 space-y-3 text-sm">
                                        <div className="flex items-center justify-between gap-4">
                                            <span className="text-gray-500">Subtotal</span>
                                            <span className="font-medium text-cyprus">
                                                {formatCurrency(selectedOrder.subtotal)}
                                            </span>
                                        </div>

                                        {selectedOrder.discount > 0 && (
                                            <div className="flex items-center justify-between gap-4">
                                                <span className="text-gray-500">Discount</span>
                                                <span className="font-medium text-emerald-600">
                                                    -{formatCurrency(selectedOrder.discount)}
                                                </span>
                                            </div>
                                        )}

                                        {selectedOrder.couponDiscount > 0 && (
                                            <div className="flex items-center justify-between gap-4">
                                                <span className="text-gray-500">Coupon Discount</span>
                                                <span className="font-medium text-emerald-600">
                                                    -{formatCurrency(selectedOrder.couponDiscount)}
                                                </span>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between gap-4">
                                            <span className="text-gray-500">Tax</span>
                                            <span className="font-medium text-cyprus">
                                                {formatCurrency(selectedOrder.tax)}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between gap-4">
                                            <span className="text-gray-500">Shipping Fee</span>
                                            <span className="font-medium text-cyprus">
                                                {formatCurrency(selectedOrder.shippingFee)}
                                            </span>
                                        </div>

                                        <div className="border-t border-dashed border-gray-200 pt-4">
                                            <div className="flex items-center justify-between gap-4">
                                                <span className="font-bold text-cyprus">Total Amount</span>
                                                <span className="text-lg font-bold text-ocean-green">
                                                    {formatCurrency(selectedOrder.total)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-gray-100 p-4 sm:p-5">
                                    <h3 className="font-bold text-cyprus">Order Items</h3>

                                    {selectedOrder.items.length > 0 ? (
                                        <div className="mt-3 divide-y divide-gray-100">
                                            {selectedOrder.items.map((item, index) => (
                                                <div
                                                    key={item.id ?? item.product_id ?? index}
                                                    className="flex items-start justify-between gap-4 py-3"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="break-words text-sm font-semibold text-cyprus">
                                                            {item.product_name ?? item.name ?? item.title ?? `Product ${index + 1}`}
                                                        </p>
                                                        <p className="mt-1 text-xs text-gray-500">
                                                            Quantity: {item.quantity ?? 1}
                                                        </p>
                                                    </div>

                                                    <p className="shrink-0 text-sm font-semibold text-cyprus">
                                                        {formatCurrency(
                                                            item.subtotal ??
                                                            item.total_price ??
                                                            item.price ??
                                                            0
                                                        )}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="mt-3 rounded-xl bg-gray-50 p-4 text-sm leading-6 text-gray-500">
                                            Item-level details are not included in the orders list API response. The order status, date, payment information and total amount are shown above.
                                        </p>
                                    )}
                                </div>

                                {canCancelOrder(selectedOrder) && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCancelError("");
                                            setCancelMessage("");
                                            setOrderToCancel(selectedOrder);
                                        }}
                                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-bold text-red-600 transition hover:bg-red-50"
                                    >
                                        <i className="fa-solid fa-ban" />
                                        Cancel Order
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={() => setSelectedOrder(null)}
                                    className="w-full rounded-xl bg-ocean-green px-5 py-3 text-sm font-bold text-white transition hover:opacity-90"
                                >
                                    Close Details
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Cancel Confirmation Modal */}
                {orderToCancel && (
                    <div
                        className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
                        onClick={closeCancelModal}
                    >
                        <div
                            role="alertdialog"
                            aria-modal="true"
                            aria-labelledby="cancelOrderTitle"
                            aria-describedby="cancelOrderDescription"
                            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-7"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-2xl text-red-600">
                                <i className="fa-solid fa-triangle-exclamation" />
                            </div>

                            <h2
                                id="cancelOrderTitle"
                                className="mt-5 text-center text-xl font-bold text-cyprus"
                            >
                                Cancel This Order?
                            </h2>

                            <p
                                id="cancelOrderDescription"
                                className="mt-3 text-center text-sm leading-6 text-gray-500"
                            >
                                Are you sure you want to cancel order{" "}
                                <span className="font-bold text-cyprus">
                                    #{orderToCancel.orderNumber}
                                </span>
                                ? This action cannot be undone.
                            </p>

                            <div className="mt-5 rounded-xl bg-gray-50 p-4">
                                <div className="flex items-center justify-between gap-3 text-sm">
                                    <span className="text-gray-500">Order Amount</span>
                                    <span className="font-bold text-cyprus">
                                        {formatCurrency(orderToCancel.total)}
                                    </span>
                                </div>

                                <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                                    <span className="text-gray-500">Payment Status</span>
                                    <span className="font-semibold text-cyprus">
                                        {formatStatus(orderToCancel.paymentStatus)}
                                    </span>
                                </div>
                            </div>

                            {cancelError && (
                                <p
                                    role="alert"
                                    className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-700"
                                >
                                    <i className="fa-solid fa-circle-exclamation mr-2" />
                                    {cancelError}
                                </p>
                            )}

                            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
                                <button
                                    type="button"
                                    disabled={cancelLoading}
                                    onClick={closeCancelModal}
                                    className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-cyprus transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Keep Order
                                </button>

                                <button
                                    type="button"
                                    disabled={cancelLoading}
                                    onClick={handleCancelOrder}
                                    className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {cancelLoading ? (
                                        <>
                                            <i className="fa-solid fa-spinner fa-spin mr-2" />
                                            Cancelling...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-ban mr-2" />
                                            Yes, Cancel Order
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </UserDashboardLayout>
    );
}

export default Orders;