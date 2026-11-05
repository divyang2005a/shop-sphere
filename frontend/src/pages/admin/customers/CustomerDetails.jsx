import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Pagination from "../../../components/Pagination";

const API_BASE_URL = "http://192.168.1.20:5000/api";

// Backend server URL for customer profile images
const API_SERVER_URL = "http://192.168.1.20:5000";

// Order status options.
// Backend માં આ જ status values supported હોવા જોઈએ.
const ORDER_STATUSES = [
    "pending",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
];

function CustomerDetails() {
    const { id } = useParams();

    const [customer, setCustomer] = useState(null);
    const [orders, setOrders] = useState([]);
    const [ordersPage, setOrdersPage] = useState(1);

    const [loading, setLoading] = useState(true);
    const [ordersLoading, setOrdersLoading] = useState(true);

    const [error, setError] = useState("");
    const [orderError, setOrderError] = useState("");

    const [updatingOrderId, setUpdatingOrderId] = useState(null);

    // Order status confirmation modal
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [newOrderStatus, setNewOrderStatus] = useState("");

    const ordersPageSize = 10;
    const ordersTotalPages = Math.ceil(orders.length / ordersPageSize);
    const currentOrdersPage = Math.min(
        ordersPage,
        Math.max(1, ordersTotalPages)
    );
    const paginatedOrders = orders.slice(
        (currentOrdersPage - 1) * ordersPageSize,
        currentOrdersPage * ordersPageSize
    );

    const getHeaders = useCallback(
        () => ({
            Authorization: `Bearer ${localStorage.getItem("shopsphereToken")}`,
            "Content-Type": "application/json",
        }),
        []
    );

    // ----------------------------------
    // Helper functions
    // ----------------------------------

    const getCustomerName = (user) => {
        return (
            user?.name ||
            user?.full_name ||
            user?.username ||
            "Customer"
        );
    };

    const getInitials = (name) => {
        return String(name || "Customer")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((word) => word.charAt(0).toUpperCase())
            .join("");
    };

    // Convert backend image path to a usable URL.
    // Supports full URLs, /uploads/image.jpg and uploads/image.jpg.
    const getProfileImageUrl = (user) => {
        const rawImage =
            user?.profile_image ||
            user?.profileImage ||
            user?.avatar ||
            user?.image ||
            user?.image_url ||
            "";

        if (typeof rawImage !== "string" || !rawImage.trim()) {
            return "";
        }

        const imagePath = rawImage.trim();

        // Full URL: http://... or https://...
        if (/^https?:\/\//i.test(imagePath)) {
            return imagePath;
        }

        // Protocol-relative URL: //example.com/image.jpg
        if (imagePath.startsWith("//")) {
            return `${window.location.protocol}${imagePath}`;
        }

        // Relative backend image path
        return `${API_SERVER_URL}/${imagePath.replace(/^\/+/, "")}`;
    };

    const formatDate = (date) => {
        if (!date) return "—";

        const parsedDate = new Date(date);

        if (Number.isNaN(parsedDate.getTime())) {
            return "—";
        }

        return parsedDate.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    const formatDateTime = (date) => {
        if (!date) return "—";

        const parsedDate = new Date(date);

        if (Number.isNaN(parsedDate.getTime())) {
            return "—";
        }

        return parsedDate.toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const formatCurrency = (amount) => {
        if (amount === null || amount === undefined || amount === "") {
            return "—";
        }

        const value = Number(amount);

        if (!Number.isFinite(value)) {
            return "—";
        }

        return value.toLocaleString("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 2,
        });
    };

    const normalizeStatus = (status) => {
        return String(status || "pending")
            .trim()
            .toLowerCase()
            .replace(/[\s-]+/g, "_");
    };

    const formatStatus = (status) => {
        return normalizeStatus(status)
            .split("_")
            .map(
                (word) =>
                    word.charAt(0).toUpperCase() + word.slice(1)
            )
            .join(" ");
    };

    const getOrderStatusClass = (status) => {
        const normalized = normalizeStatus(status);

        const statusClasses = {
            pending: "bg-amber-50 text-amber-700 ring-amber-200",
            processing: "bg-blue-50 text-blue-700 ring-blue-200",
            shipped: "bg-indigo-50 text-indigo-700 ring-indigo-200",
            delivered: "bg-green-50 text-green-700 ring-green-200",
            cancelled: "bg-red-50 text-red-700 ring-red-200",
            returned: "bg-purple-50 text-purple-700 ring-purple-200",
            refunded: "bg-pink-50 text-pink-700 ring-pink-200",
        };

        return (
            statusClasses[normalized] ||
            "bg-gray-100 text-gray-700 ring-gray-200"
        );
    };

    const getCustomerStatusClass = (status) => {
        const active = String(status || "").toLowerCase() === "active";

        return active
            ? "bg-success/10 text-success"
            : "bg-error/10 text-error";
    };

    // ----------------------------------
    // Customer details API
    // GET /api/admin/users/:id
    // ----------------------------------

    const fetchCustomer = useCallback(async () => {
        setLoading(true);
        setError("");

        const currentToken = localStorage.getItem("shopsphereToken");

        if (!currentToken) {
            setError("Authentication token not found. Please log in again.");
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(
                `${API_BASE_URL}/admin/users/${id}`,
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${currentToken}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Unable to load customer details."
                );
            }

            const user =
                data.user ||
                data.customer ||
                data.data?.user ||
                data.data?.customer ||
                data.data;

            if (!user || typeof user !== "object" || Array.isArray(user)) {
                throw new Error(
                    "Customer details were not found in the API response."
                );
            }

            setCustomer(user);
        } catch (err) {
            setError(
                err.message || "Unable to load customer details."
            );
        } finally {
            setLoading(false);
        }
    }, [id]);

    // ----------------------------------
    // Orders API
    // GET /api/admin/orders
    // ----------------------------------

    const fetchCustomerOrders = useCallback(async () => {
        setOrdersLoading(true);
        setOrderError("");

        const currentToken = localStorage.getItem("shopsphereToken");

        if (!currentToken) {
            setOrderError("Authentication token not found. Please log in again.");
            setOrdersLoading(false);
            return;
        }

        try {
            const response = await fetch(
                `${API_BASE_URL}/admin/orders`,
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${currentToken}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Unable to load customer orders."
                );
            }

            const allOrders = Array.isArray(data.orders)
                ? data.orders
                : Array.isArray(data.data?.orders)
                    ? data.data.orders
                    : Array.isArray(data.data)
                        ? data.data
                        : [];

            const customerOrders = allOrders.filter((order) => {
                const possibleCustomerIds = [
                    order.user_id,
                    order.customer_id,
                    order.userId,
                    order.customerId,
                    order.user?.id,
                    order.customer?.id,
                    order.user?.user_id,
                    order.customer?.user_id,
                ];

                return possibleCustomerIds.some(
                    (customerId) =>
                        customerId !== undefined &&
                        customerId !== null &&
                        String(customerId) === String(id)
                );
            });

            setOrders(customerOrders);
            setOrdersPage(1);
        } catch (err) {
            setOrderError(
                err.message || "Unable to load customer orders."
            );
        } finally {
            setOrdersLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchCustomer();
        fetchCustomerOrders();
    }, [fetchCustomer, fetchCustomerOrders]);

    // ----------------------------------
    // Calculate customer order summary
    // ----------------------------------

    const orderSummary = useMemo(() => {
        const totalOrders = orders.length;

        const totalSpent = orders.reduce((total, order) => {
            const status = normalizeStatus(order.status || order.order_status);

            if (status === "cancelled") {
                return total;
            }

            const amount = Number(
                order.total_amount ??
                order.total_price ??
                order.grand_total ??
                order.amount ??
                0
            );

            return total + (Number.isFinite(amount) ? amount : 0);
        }, 0);

        const deliveredOrders = orders.filter(
            (order) =>
                normalizeStatus(order.status || order.order_status) ===
                "delivered"
        ).length;

        const pendingOrders = orders.filter((order) =>
            ["pending", "processing"].includes(
                normalizeStatus(order.status || order.order_status)
            )
        ).length;

        return {
            totalOrders,
            totalSpent,
            deliveredOrders,
            pendingOrders,
        };
    }, [orders]);

    // ----------------------------------
    // Order display helpers
    // ----------------------------------

    const getOrderId = (order) => {
        return (
            order.order_id ??
            order.id ??
            order.order_number ??
            "—"
        );
    };

    const getOrderDate = (order) => {
        return (
            order.created_at ||
            order.order_date ||
            order.createdAt ||
            order.date ||
            null
        );
    };

    const getOrderAmount = (order) => {
        return (
            order.total_amount ??
            order.total_price ??
            order.grand_total ??
            order.amount ??
            null
        );
    };

    const getOrderStatus = (order) => {
        return order.status || order.order_status || "pending";
    };

    const getOrderItemsCount = (order) => {
        if (Array.isArray(order.items)) {
            return order.items.reduce(
                (total, item) =>
                    total + Number(item.quantity || 1),
                0
            );
        }

        if (Array.isArray(order.order_items)) {
            return order.order_items.reduce(
                (total, item) =>
                    total + Number(item.quantity || 1),
                0
            );
        }

        if (order.items_count !== undefined) {
            return order.items_count;
        }

        return "—";
    };

    // ----------------------------------
    // Order status modal
    // ----------------------------------

    const openStatusModal = (order, status) => {
        setSelectedOrder(order);
        setNewOrderStatus(status);
        setOrderError("");
    };

    const closeStatusModal = () => {
        if (updatingOrderId !== null) return;

        setSelectedOrder(null);
        setNewOrderStatus("");
    };

    // ----------------------------------
    // Update order status
    // PATCH /api/admin/orders/:order_id/status
    // ----------------------------------

    const confirmOrderStatusUpdate = async () => {
        if (!selectedOrder) return;

        const orderId = getOrderId(selectedOrder);
        const currentStatus = normalizeStatus(getOrderStatus(selectedOrder));

        if (String(newOrderStatus) === currentStatus) {
            closeStatusModal();
            return;
        }

        const currentToken = localStorage.getItem("shopsphereToken");

        if (!currentToken) {
            setOrderError("Authentication token not found. Please log in again.");
            return;
        }

        setUpdatingOrderId(orderId);
        setOrderError("");

        try {
            const response = await fetch(
                `${API_BASE_URL}/admin/orders/${orderId}/status`,
                {
                    method: "PATCH",
                    headers: {
                        Authorization: `Bearer ${currentToken}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        status: newOrderStatus,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Unable to update order status."
                );
            }

            setOrders((previousOrders) =>
                previousOrders.map((order) =>
                    String(getOrderId(order)) === String(orderId)
                        ? {
                            ...order,
                            status: newOrderStatus,
                            order_status: newOrderStatus,
                        }
                        : order
                )
            );

            setSelectedOrder(null);
            setNewOrderStatus("");
        } catch (err) {
            setOrderError(
                err.message || "Unable to update order status."
            );
        } finally {
            setUpdatingOrderId(null);
        }
    };

    // ----------------------------------
    // Loading customer details
    // ----------------------------------

    if (loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center bg-aqua-spring/20 p-6">
                <div className="text-center">
                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-ocean-green" />

                    <p className="mt-4 text-sm font-medium text-text-grey">
                        Loading customer details...
                    </p>
                </div>
            </div>
        );
    }

    if (error || !customer) {
        return (
            <div className="min-h-screen bg-aqua-spring/20 p-4 sm:p-8">
                <div className="mx-auto max-w-3xl rounded-2xl border border-red-100 bg-white p-6 shadow-sm sm:p-8">
                    <div className="text-3xl">⚠️</div>

                    <h2 className="mt-3 text-xl font-bold text-cyprus">
                        Unable to load customer
                    </h2>

                    <p className="mt-2 text-sm text-error">
                        {error || "Customer not found."}
                    </p>

                    <div className="mt-6 flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={fetchCustomer}
                            className="rounded-xl bg-ocean-green px-5 py-3 text-sm font-semibold text-white"
                        >
                            Try Again
                        </button>

                        <Link
                            to="/admin/customers"
                            className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-cyprus"
                        >
                            Back to Customers
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // ----------------------------------
    // Customer profile fields
    // ----------------------------------

    const customerName = getCustomerName(customer);
    const profileImage = getProfileImageUrl(customer);

    const customerAddress =
        customer.address ||
        customer.full_address ||
        customer.shipping_address ||
        customer.billing_address ||
        null;

    const addressText =
        typeof customerAddress === "string"
            ? customerAddress
            : customerAddress
                ? [
                    customerAddress.address_line1 ||
                    customerAddress.address_line_1 ||
                    customerAddress.street,
                    customerAddress.address_line2 ||
                    customerAddress.address_line_2,
                    customerAddress.city,
                    customerAddress.state,
                    customerAddress.postal_code ||
                    customerAddress.pincode ||
                    customerAddress.zip,
                    customerAddress.country,
                ]
                    .filter(Boolean)
                    .join(", ")
                : "";

    const customerStatus =
        String(customer.status || "").toLowerCase() === "active"
            ? "Active"
            : "Inactive";

    return (
        <div className="min-h-screen space-y-6 bg-aqua-spring/20 p-4 sm:p-6 lg:p-8">
            {/* Breadcrumb */}
            <div>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-text-grey">
                    <Link
                        to="/admin-dashboard"
                        className="transition hover:text-ocean-green"
                    >
                        Dashboard
                    </Link>

                    <span>/</span>

                    <Link
                        to="/admin/customers"
                        className="transition hover:text-ocean-green"
                    >
                        Customers
                    </Link>

                    <span>/</span>

                    <span className="font-medium text-cyprus">
                        Customer Details
                    </span>
                </div>

                <h1 className="text-2xl font-bold text-cyprus sm:text-3xl">
                    Customer Details
                </h1>

                <p className="mt-1 text-sm text-text-grey">
                    View customer profile, account information and order history.
                </p>
            </div>

            {/* Customer Profile Header */}
            <section className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm transition-shadow duration-300 hover:shadow-md">
                {/* Cover Background */}
                <div className="relative h-32 overflow-hidden bg-gradient-to-r from-ocean-green via-cyprus to-teal-700 sm:h-40">
                    <div className="absolute -right-10 -top-20 h-52 w-52 rounded-full border-[25px] border-white/10" />
                    <div className="absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
                    <div className="absolute -left-10 top-10 h-32 w-32 rounded-full bg-white/10 blur-xl" />

                    <div className="absolute left-5 top-5 sm:left-7 sm:top-6">
                        <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1.5 text-xs font-semibold tracking-wide text-white backdrop-blur-md">
                            CUSTOMER PROFILE
                        </span>
                    </div>
                </div>

                {/* Profile Content */}
                <div className="px-5 pb-6 sm:px-7 sm:pb-7">
                    <div className="-mt-12 flex flex-col gap-5 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
                        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
                            {/* Profile Image */}
                            <div className="relative h-24 w-24 shrink-0 sm:h-28 sm:w-28">
                                {profileImage && (
                                    <img
                                        src={profileImage}
                                        alt={customerName}
                                        onError={(event) => {
                                            event.currentTarget.onerror = null;
                                            event.currentTarget.style.display = "none";
                                            event.currentTarget.nextElementSibling?.classList.remove("hidden");
                                        }}
                                        className="h-full w-full rounded-2xl border-4 border-white bg-gray-100 object-cover shadow-lg"
                                    />
                                )}

                                {/* Fallback Avatar */}
                                <div
                                    className={`${profileImage ? "hidden" : "flex"
                                        } absolute inset-0 items-center justify-center rounded-2xl border-4 border-white bg-gradient-to-br from-aqua-spring to-emerald-100 text-3xl font-bold text-cyprus shadow-lg sm:text-4xl`}
                                >
                                    {getInitials(customerName)}
                                </div>

                                {/* Online-style Indicator */}
                                <span
                                    className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-[3px] border-white ${String(customer.status).toLowerCase() === "active"
                                        ? "bg-emerald-500"
                                        : "bg-gray-400"
                                        }`}
                                    title={customerStatus}
                                />
                            </div>

                            {/* Name and Details */}
                            <div className="min-w-0 sm:pb-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="break-words text-xl font-bold tracking-tight text-cyprus sm:text-2xl">
                                        {customerName}
                                    </h2>

                                    <span
                                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${getCustomerStatusClass(
                                            customer.status
                                        )}`}
                                    >
                                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                        {customerStatus}
                                    </span>
                                </div>

                                <p className="mt-2 flex min-w-0 items-center gap-2 text-sm text-text-grey">
                                    <svg
                                        className="h-4 w-4 shrink-0"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M3 7l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                        />
                                    </svg>

                                    <span className="break-all">
                                        {customer.email || "Email not provided"}
                                    </span>
                                </p>

                                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-grey">
                                    <span className="inline-flex items-center gap-1.5">
                                        <svg
                                            className="h-4 w-4"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth="1.8"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M16 18l2 2 4-4M12 14a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0"
                                            />
                                        </svg>
                                        Customer ID: #{customer.id ?? id}
                                    </span>

                                    {customer.created_at && (
                                        <span className="inline-flex items-center gap-1.5">
                                            <svg
                                                className="h-4 w-4"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth="1.8"
                                            >
                                                <rect
                                                    x="3"
                                                    y="5"
                                                    width="18"
                                                    height="16"
                                                    rx="2"
                                                />
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M16 3v4M8 3v4M3 11h18"
                                                />
                                            </svg>

                                            Joined{" "}
                                            {new Date(customer.created_at).toLocaleDateString(
                                                "en-IN",
                                                {
                                                    day: "2-digit",
                                                    month: "short",
                                                    year: "numeric",
                                                }
                                            )}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Back Button */}
                        <div className="flex shrink-0 items-center gap-3 sm:pb-1">
                            <Link
                                to="/admin/customers"
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-cyprus shadow-sm transition duration-200 hover:border-cyprus/30 hover:bg-gray-50 active:scale-[0.98] sm:w-auto"
                            >
                                <svg
                                    className="h-4 w-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M15 19l-7-7 7-7"
                                    />
                                </svg>
                                Back to Customers
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Customer summary */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <p className="text-sm text-text-grey">Total Orders</p>
                    <h3 className="mt-3 text-3xl font-bold text-cyprus">
                        {ordersLoading ? "..." : orderSummary.totalOrders}
                    </h3>
                    <p className="mt-2 text-xs text-text-grey">
                        Orders associated with this customer
                    </p>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <p className="text-sm text-text-grey">Total Spending</p>
                    <h3 className="mt-3 text-3xl font-bold text-ocean-green">
                        {ordersLoading
                            ? "..."
                            : formatCurrency(orderSummary.totalSpent)}
                    </h3>
                    <p className="mt-2 text-xs text-text-grey">
                        Excludes cancelled orders
                    </p>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <p className="text-sm text-text-grey">Delivered Orders</p>
                    <h3 className="mt-3 text-3xl font-bold text-success">
                        {ordersLoading ? "..." : orderSummary.deliveredOrders}
                    </h3>
                    <p className="mt-2 text-xs text-text-grey">
                        Successfully delivered
                    </p>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <p className="text-sm text-text-grey">Pending / Processing</p>
                    <h3 className="mt-3 text-3xl font-bold text-amber-600">
                        {ordersLoading ? "..." : orderSummary.pendingOrders}
                    </h3>
                    <p className="mt-2 text-xs text-text-grey">
                        Orders awaiting completion
                    </p>
                </div>
            </section>

            {/* Profile Information */}
            <section className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">

                {/* Contact Information */}
                <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-md">

                    {/* Header */}
                    <div className="flex items-center gap-4 border-b border-gray-100 bg-gradient-to-r from-aqua-spring/30 to-white px-4 py-5 sm:px-6">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-cyprus shadow-sm ring-1 ring-gray-200/70">
                            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>

                        <div className="min-w-0 flex-1">
                            <h2 className="text-base font-bold tracking-tight text-cyprus sm:text-lg">
                                Contact Information
                            </h2>
                            <p className="mt-1 text-xs leading-5 text-text-grey sm:text-sm">
                                Customer's registered personal details
                            </p>
                        </div>

                        <span className="hidden shrink-0 items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-ocean-green sm:inline-flex">
                            Personal
                        </span>
                    </div>

                    {/* Contact Details */}
                    <div className="p-4 sm:p-6">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                            {/* Full Name */}
                            <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 sm:col-span-2">
                                <p className="mb-2 text-xs font-medium text-text-grey">
                                    Full Name
                                </p>
                                <p className="break-words text-sm font-semibold leading-6 text-cyprus sm:text-base">
                                    {customerName || "Not available"}
                                </p>
                            </div>

                            {/* Email - Full Width */}
                            <div className="min-w-0 rounded-xl border border-gray-100 p-4 transition-colors hover:bg-gray-50/80 sm:col-span-2">
                                <p className="mb-2 text-xs font-medium text-text-grey">
                                    Email Address
                                </p>

                                <p className="break-all text-sm font-semibold leading-6 text-cyprus sm:text-base">
                                    {customer.email || "Not available"}
                                </p>
                            </div>

                            {/* Mobile */}
                            <div className="min-w-0 rounded-xl border border-gray-100 p-4 transition-colors hover:bg-gray-50/80">
                                <p className="mb-2 text-xs font-medium text-text-grey">
                                    Mobile Number
                                </p>
                                <p className="break-words text-sm font-semibold leading-6 text-cyprus">
                                    {customer.mobile || customer.phone || "Not available"}
                                </p>
                            </div>

                            {/* Date of Birth */}
                            <div className="min-w-0 rounded-xl border border-gray-100 p-4 transition-colors hover:bg-gray-50/80">
                                <p className="mb-2 text-xs font-medium text-text-grey">
                                    Date of Birth
                                </p>
                                <p className="break-words text-sm font-semibold leading-6 text-cyprus">
                                    {formatDate(
                                        customer.date_of_birth || customer.dateOfBirth
                                    ) || "Not available"}
                                </p>
                            </div>

                            {/* Joined Date */}
                            <div className="min-w-0 rounded-xl border border-gray-100 p-4 transition-colors hover:bg-gray-50/80">
                                <p className="mb-2 text-xs font-medium text-text-grey">
                                    Joined Date
                                </p>
                                <p className="break-words text-sm font-semibold leading-6 text-cyprus">
                                    {formatDate(
                                        customer.created_at ||
                                        customer.joined ||
                                        customer.joined_at
                                    ) || "Not available"}
                                </p>
                            </div>

                            {/* Last Updated */}
                            <div className="min-w-0 rounded-xl border border-gray-100 p-4 transition-colors hover:bg-gray-50/80">
                                <p className="mb-2 text-xs font-medium text-text-grey">
                                    Last Updated
                                </p>
                                <p className="break-words text-sm font-semibold leading-6 text-cyprus">
                                    {formatDate(
                                        customer.updated_at || customer.updatedAt
                                    ) || "Not available"}
                                </p>
                            </div>

                        </div>
                    </div>
                </div>

                {/* Address Information */}
                <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-md">

                    {/* Header */}
                    <div className="flex items-center gap-4 border-b border-gray-100 bg-gradient-to-r from-aqua-spring/30 to-white px-4 py-5 sm:px-6">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-cyprus shadow-sm ring-1 ring-gray-200/70">
                            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                                <circle cx="12" cy="11" r="2.5" />
                            </svg>
                        </div>

                        <div className="min-w-0 flex-1">
                            <h2 className="text-base font-bold tracking-tight text-cyprus sm:text-lg">
                                Address Information
                            </h2>
                            <p className="mt-1 text-xs leading-5 text-text-grey sm:text-sm">
                                Customer's location and address details
                            </p>
                        </div>

                        <span className="hidden shrink-0 items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-ocean-green sm:inline-flex">
                            Location
                        </span>
                    </div>

                    {/* Address Details */}
                    <div className="p-4 sm:p-6">

                        {/* Primary Address */}
                        {addressText ? (
                            <div className="rounded-xl border border-ocean-green/15 bg-aqua-spring/20 p-4 sm:p-5">
                                <div className="mb-3 flex items-center gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-cyprus shadow-sm">
                                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10l9-7 9 7v10a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V10z" />
                                        </svg>
                                    </div>

                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-cyprus">
                                            Primary Address
                                        </p>
                                        <p className="mt-0.5 text-xs text-text-grey">
                                            Registered residential address
                                        </p>
                                    </div>
                                </div>

                                <p className="break-words text-sm leading-7 text-cyprus">
                                    {addressText}
                                </p>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/70 px-5 py-8 text-center">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white text-2xl shadow-sm ring-1 ring-gray-100">
                                    🏠
                                </div>
                                <h3 className="mt-3 text-sm font-semibold text-cyprus">
                                    No Address Available
                                </h3>
                                <p className="mx-auto mt-1.5 max-w-xs text-xs leading-5 text-text-grey">
                                    Address information has not been provided by the API.
                                </p>
                            </div>
                        )}

                        {/* Location Details */}
                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">

                            {/* City */}
                            <div className="min-w-0 rounded-xl border border-gray-100 p-4 transition-colors hover:bg-gray-50/80">
                                <p className="mb-2 text-xs font-medium text-text-grey">
                                    City
                                </p>
                                <p className="break-words text-sm font-semibold leading-6 text-cyprus">
                                    {customer.city ||
                                        customer.address?.city ||
                                        "Not available"}
                                </p>
                            </div>

                            {/* State */}
                            <div className="min-w-0 rounded-xl border border-gray-100 p-4 transition-colors hover:bg-gray-50/80">
                                <p className="mb-2 text-xs font-medium text-text-grey">
                                    State
                                </p>
                                <p className="break-words text-sm font-semibold leading-6 text-cyprus">
                                    {customer.state ||
                                        customer.address?.state ||
                                        "Not available"}
                                </p>
                            </div>

                            {/* Postal Code */}
                            <div className="min-w-0 rounded-xl border border-gray-100 p-4 transition-colors hover:bg-gray-50/80">
                                <p className="mb-2 text-xs font-medium text-text-grey">
                                    Postal Code
                                </p>
                                <p className="break-words text-sm font-semibold leading-6 text-cyprus">
                                    {customer.postal_code ||
                                        customer.pincode ||
                                        customer.address?.postal_code ||
                                        customer.address?.pincode ||
                                        "Not available"}
                                </p>
                            </div>

                            {/* Country */}
                            <div className="min-w-0 rounded-xl border border-gray-100 p-4 transition-colors hover:bg-gray-50/80">
                                <p className="mb-2 text-xs font-medium text-text-grey">
                                    Country
                                </p>
                                <p className="break-words text-sm font-semibold leading-6 text-cyprus">
                                    {customer.country ||
                                        customer.address?.country ||
                                        "Not available"}
                                </p>
                            </div>

                        </div>
                    </div>
                </div>

            </section>

            {/* Order history */}
            <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="flex flex-col gap-4 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div>
                        <h2 className="text-lg font-bold text-cyprus">
                            Order History
                        </h2>
                        <p className="mt-1 text-sm text-text-grey">
                            All orders belonging to {customerName}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={fetchCustomerOrders}
                        disabled={ordersLoading}
                        className="rounded-xl border border-ocean-green/20 px-4 py-2.5 text-sm font-semibold text-ocean-green transition hover:bg-aqua-spring disabled:opacity-50"
                    >
                        {ordersLoading ? "Loading..." : "Refresh Orders"}
                    </button>
                </div>

                {orderError && (
                    <div
                        role="alert"
                        className="m-4 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700 sm:m-6"
                    >
                        <p>{orderError}</p>
                        <button
                            type="button"
                            onClick={fetchCustomerOrders}
                            className="mt-2 font-semibold underline"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {ordersLoading ? (
                    <div className="p-12 text-center">
                        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-gray-200 border-t-ocean-green" />
                        <p className="mt-4 text-sm text-text-grey">
                            Loading order history...
                        </p>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="px-4 py-14 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-aqua-spring text-2xl">
                            🛍️
                        </div>
                        <h3 className="mt-4 font-semibold text-cyprus">
                            No orders found
                        </h3>
                        <p className="mt-2 text-sm text-text-grey">
                            No orders associated with this customer were returned by the API.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Desktop order table */}
                        <div className="hidden overflow-x-auto lg:block">
                            <table className="w-full min-w-[950px] text-left">
                                <thead className="bg-gray-50">
                                    <tr className="text-xs uppercase tracking-wide text-text-grey">
                                        <th className="px-6 py-4 font-semibold">Order ID</th>
                                        <th className="px-6 py-4 font-semibold">Order Date</th>
                                        <th className="px-6 py-4 font-semibold">Items</th>
                                        <th className="px-6 py-4 font-semibold">Amount</th>
                                        <th className="px-6 py-4 font-semibold">Status</th>
                                        <th className="px-6 py-4 font-semibold">Update Status</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-100">
                                    {paginatedOrders.map((order) => (
                                        <tr
                                            key={getOrderId(order)}
                                            className="transition hover:bg-gray-50/70"
                                        >
                                            <td className="px-6 py-4">
                                                <p className="font-semibold text-cyprus">
                                                    #{getOrderId(order)}
                                                </p>
                                            </td>

                                            <td className="px-6 py-4 text-sm text-text-grey">
                                                {formatDateTime(getOrderDate(order))}
                                            </td>

                                            <td className="px-6 py-4 text-sm text-cyprus">
                                                {getOrderItemsCount(order)}
                                            </td>

                                            <td className="px-6 py-4 text-sm font-semibold text-cyprus">
                                                {formatCurrency(getOrderAmount(order))}
                                            </td>

                                            <td className="px-6 py-4">
                                                <span
                                                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${getOrderStatusClass(
                                                        getOrderStatus(order)
                                                    )}`}
                                                >
                                                    {formatStatus(getOrderStatus(order))}
                                                </span>
                                            </td>

                                            <td className="px-6 py-4">
                                                <select
                                                    value={normalizeStatus(getOrderStatus(order))}
                                                    onChange={(event) =>
                                                        openStatusModal(order, event.target.value)
                                                    }
                                                    disabled={updatingOrderId !== null}
                                                    aria-label={`Update status for order ${getOrderId(order)}`}
                                                    className="w-36 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-cyprus outline-none focus:border-ocean-green disabled:opacity-50"
                                                >
                                                    {!ORDER_STATUSES.includes(
                                                        normalizeStatus(getOrderStatus(order))
                                                    ) && (
                                                            <option value={normalizeStatus(getOrderStatus(order))}>
                                                                {formatStatus(getOrderStatus(order))}
                                                            </option>
                                                        )}

                                                    {ORDER_STATUSES.map((status) => (
                                                        <option key={status} value={status}>
                                                            {formatStatus(status)}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile order cards */}
                        <div className="space-y-3 p-4 lg:hidden">
                            {paginatedOrders.map((order) => (
                                <div
                                    key={getOrderId(order)}
                                    className="rounded-xl border border-gray-100 p-4"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <p className="font-bold text-cyprus">
                                                Order #{getOrderId(order)}
                                            </p>
                                            <p className="mt-1 text-xs text-text-grey">
                                                {formatDateTime(getOrderDate(order))}
                                            </p>
                                        </div>

                                        <span
                                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${getOrderStatusClass(
                                                getOrderStatus(order)
                                            )}`}
                                        >
                                            {formatStatus(getOrderStatus(order))}
                                        </span>
                                    </div>

                                    <div className="mt-4 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                                        <div>
                                            <p className="text-xs text-text-grey">Items</p>
                                            <p className="mt-1 font-semibold text-cyprus">
                                                {getOrderItemsCount(order)}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs text-text-grey">Amount</p>
                                            <p className="mt-1 font-semibold text-cyprus">
                                                {formatCurrency(getOrderAmount(order))}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-4 border-t border-gray-100 pt-4">
                                        <label
                                            htmlFor={`order-status-${getOrderId(order)}`}
                                            className="mb-2 block text-xs font-semibold text-text-grey"
                                        >
                                            Update Order Status
                                        </label>

                                        <select
                                            id={`order-status-${getOrderId(order)}`}
                                            value={normalizeStatus(getOrderStatus(order))}
                                            onChange={(event) =>
                                                openStatusModal(order, event.target.value)
                                            }
                                            disabled={updatingOrderId !== null}
                                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-cyprus outline-none focus:border-ocean-green disabled:opacity-50"
                                        >
                                            {!ORDER_STATUSES.includes(
                                                normalizeStatus(getOrderStatus(order))
                                            ) && (
                                                    <option value={normalizeStatus(getOrderStatus(order))}>
                                                        {formatStatus(getOrderStatus(order))}
                                                    </option>
                                                )}

                                            {ORDER_STATUSES.map((status) => (
                                                <option key={status} value={status}>
                                                    {formatStatus(status)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Pagination
                            page={currentOrdersPage}
                            totalPages={ordersTotalPages}
                            totalItems={orders.length}
                            pageSize={ordersPageSize}
                            itemLabel="orders"
                            onPageChange={setOrdersPage}
                        />
                    </>
                )}
            </section>

            {/* Confirmation modal */}
            {selectedOrder && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closeStatusModal();
                        }
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="order-status-modal-title"
                        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-7"
                    >
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-aqua-spring text-2xl">
                            📦
                        </div>

                        <div className="mt-4 text-center">
                            <h2
                                id="order-status-modal-title"
                                className="text-xl font-bold text-cyprus"
                            >
                                Update Order Status?
                            </h2>

                            <p className="mt-3 text-sm leading-6 text-text-grey">
                                Change order{" "}
                                <span className="font-semibold text-cyprus">
                                    #{getOrderId(selectedOrder)}
                                </span>{" "}
                                to{" "}
                                <span className="font-semibold text-ocean-green">
                                    {formatStatus(newOrderStatus)}
                                </span>
                                ?
                            </p>
                        </div>

                        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
                            <button
                                type="button"
                                onClick={closeStatusModal}
                                disabled={updatingOrderId !== null}
                                className="rounded-xl border border-gray-200 px-6 py-3 text-sm font-semibold text-cyprus transition hover:bg-gray-50 disabled:opacity-50"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={confirmOrderStatusUpdate}
                                disabled={updatingOrderId !== null}
                                className="rounded-xl bg-ocean-green px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                            >
                                {updatingOrderId !== null
                                    ? "Updating..."
                                    : "Confirm Update"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Reusable read-only information row
function InfoRow({ label, value }) {
    const displayValue =
        value === null ||
            value === undefined ||
            String(value).trim() === ""
            ? "—"
            : String(value);

    return (
        <div className="flex flex-col gap-1 border-b border-gray-100 pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <p className="shrink-0 text-sm text-text-grey">
                {label}
            </p>

            <p className="break-words text-sm font-medium text-cyprus sm:text-right">
                {displayValue}
            </p>
        </div>
    );
}

export default CustomerDetails;