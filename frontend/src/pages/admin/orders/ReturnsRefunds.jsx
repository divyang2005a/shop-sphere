import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import { Link } from "react-router-dom";
import OrdersPagination from "./OrdersPagination";

const API_BASE_URL = "http://192.168.1.20:5000/api/admin";
const ORDERS_PER_PAGE = 10;

// Format date
function formatDate(date) {
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
}

// Format amount
function formatAmount(amount) {
    return Number(amount || 0).toLocaleString("en-IN", {
        maximumFractionDigits: 2,
    });
}

// Normalize status
function normalizeStatus(status) {
    const value = String(status || "Requested")
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ");

    const statusMap = {
        requested: "Requested",
        request: "Requested",
        pending: "Requested",
        "return requested": "Requested",
        "refund requested": "Requested",

        approved: "Approved",
        accepted: "Approved",

        processing: "Processing",
        "refund processing": "Processing",
        "return processing": "Processing",

        completed: "Completed",
        refunded: "Completed",
        "refund completed": "Completed",
        "return completed": "Completed",

        rejected: "Rejected",
        cancelled: "Rejected",
        canceled: "Rejected",
        declined: "Rejected",

        failed: "Failed",
        failure: "Failed",
    };

    return (
        statusMap[value] ||
        value.charAt(0).toUpperCase() + value.slice(1)
    );
}

// Normalize request type
function normalizeType(type) {
    const value = String(type || "Return")
        .trim()
        .toLowerCase();

    return value.includes("refund") ? "Refund" : "Return";
}

// Normalize API request data
function normalizeRequest(request, index, type) {
    const order = request.order || {};
    const customer = request.customer || {};
    const product = request.product || {};

    const items = Array.isArray(request.items)
        ? request.items
        : [];

    const firstItem = items[0] || {};

    const requestId =
        request.return_id ??
        request.refund_id ??
        request.request_id ??
        request.id ??
        `REQ-${index + 1}`;

    const orderId =
        request.order_number ??
        request.order_id ??
        order.order_number ??
        order.order_id ??
        "—";

    const customerName =
        request.customer_name ??
        customer.name ??
        order.customer_name ??
        request.name ??
        "Unknown Customer";

    const customerEmail =
        request.customer_email ??
        customer.email ??
        order.customer_email ??
        request.email ??
        "—";

    const productName =
        request.product_name ??
        product.name ??
        firstItem.product_name ??
        firstItem.name ??
        (items.length > 1
            ? `${items.length} products`
            : "—");

    const rawType =
        type ??
        request.type ??
        request.request_type ??
        request.return_type ??
        (request.refund_id != null ? "Refund" : "Return");

    const rawStatus =
        request.status ??
        request.request_status ??
        request.refund_status ??
        request.return_status ??
        "Requested";

    const amount =
        request.amount ??
        request.refund_amount ??
        request.total_amount ??
        request.price ??
        firstItem.subtotal ??
        firstItem.price ??
        0;

    const normalizedOrderId = String(orderId);

    return {
        ...request,

        // Unique identity for the table and list
        id: String(requestId).startsWith("#")
            ? String(requestId)
            : `#${requestId}`,

        rawId: requestId,

        // Keep the order identifier separate from the request identifier
        orderId:
            orderId === "—"
                ? orderId
                : normalizedOrderId.startsWith("#")
                    ? normalizedOrderId
                    : `#${normalizedOrderId}`,

        customer: customerName,
        email: customerEmail,
        product: productName,

        amount: Number(amount) || 0,

        type: normalizeType(rawType),
        status: normalizeStatus(rawStatus),

        reason:
            request.reason ??
            request.return_reason ??
            request.refund_reason ??
            request.cancellation_reason ??
            "Not provided",

        date: formatDate(
            request.created_at ??
            request.request_date ??
            request.requested_at ??
            request.date
        ),
    };
}

// Extract list from common API response formats
function extractList(payload, keys) {
    if (Array.isArray(payload)) {
        return payload;
    }

    const containers = [
        payload,
        payload?.data,
        payload?.data?.data,
        payload?.result,
    ];

    for (const container of containers) {
        if (Array.isArray(container)) {
            return container;
        }

        if (
            container &&
            typeof container === "object"
        ) {
            for (const key of keys) {
                if (Array.isArray(container[key])) {
                    return container[key];
                }
            }
        }
    }

    return [];
}

// Check API response
async function fetchJSON(url, headers) {
    const response = await fetch(url, {
        method: "GET",
        headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success === false) {
        throw new Error(
            data.message ||
            data.error ||
            `Request failed (${response.status}).`
        );
    }

    return data;
}

function ReturnsRefunds() {
    const [orders, setOrders] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);

    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [selectedRequest, setSelectedRequest] = useState(null);

    // Fetch returns and refunds
    const fetchRequests = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const token = localStorage.getItem("shopsphereToken");

            if (!token) {
                throw new Error(
                    "Authentication token not found. Please log in again."
                );
            }

            const headers = {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            };

            const [returnsData, refundsData] = await Promise.all([
                fetchJSON(
                    `${API_BASE_URL}/returns`,
                    headers
                ),

                fetchJSON(
                    `${API_BASE_URL}/refunds`,
                    headers
                ),
            ]);

            const returnList = extractList(returnsData, [
                "returns",
                "return_requests",
                "requests",
                "data",
            ]);

            const refundList = extractList(refundsData, [
                "refunds",
                "refund_requests",
                "requests",
                "data",
            ]);

            const normalizedReturns = returnList.map(
                (request, index) =>
                    normalizeRequest(request, index, "Return")
            );

            const normalizedRefunds = refundList.map(
                (request, index) =>
                    normalizeRequest(request, index, "Refund")
            );

            setOrders([
                ...normalizedReturns,
                ...normalizedRefunds,
            ]);
        } catch (err) {
            setError(
                err.message ||
                "Unable to load Returns & Refunds. Please try again."
            );

            setOrders([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    // Search and filters
    const filteredOrders = useMemo(() => {
        const searchText = search.trim().toLowerCase();

        return orders.filter((order) => {
            const matchesSearch = [
                order.id,
                order.rawId,
                order.orderId,
                order.customer,
                order.email,
                order.product,
                order.reason,
                order.type,
                order.status,
            ].some((value) =>
                String(value ?? "")
                    .toLowerCase()
                    .includes(searchText)
            );

            const matchesType =
                typeFilter === "All" ||
                order.type === typeFilter;

            const matchesStatus =
                statusFilter === "All" ||
                order.status === statusFilter;

            return (
                matchesSearch &&
                matchesType &&
                matchesStatus
            );
        });
    }, [orders, search, typeFilter, statusFilter]);
    const totalPages = Math.max(
        1,
        Math.ceil(filteredOrders.length / ORDERS_PER_PAGE)
    );
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const currentOrders = filteredOrders.slice(
        (safeCurrentPage - 1) * ORDERS_PER_PAGE,
        safeCurrentPage * ORDERS_PER_PAGE
    );

    // Statistics
    const totalRequests = orders.length;

    const returnRequests = orders.filter(
        (order) => order.type === "Return"
    ).length;

    const refundRequests = orders.filter(
        (order) => order.type === "Refund"
    ).length;

    const totalAmount = orders.reduce(
        (total, order) => total + Number(order.amount || 0),
        0
    );

    // Reset filters
    const resetFilters = () => {
        setSearch("");
        setTypeFilter("All");
        setStatusFilter("All");
        setCurrentPage(1);
    };

    // Status badge styles
    const getStatusClass = (status) => {
        if (
            status === "Completed" ||
            status === "Approved"
        ) {
            return "bg-success/10 text-success";
        }

        if (status === "Processing") {
            return "bg-pending/10 text-yellow-700";
        }

        if (
            status === "Rejected" ||
            status === "Failed"
        ) {
            return "bg-error/10 text-error";
        }

        return "bg-brand-primary/10 text-brand-primary";
    };

    // Type badge styles
    const getTypeClass = (type) => {
        if (type === "Return") {
            return "bg-ocean-green/10 text-ocean-green";
        }

        return "bg-brand-primary/10 text-brand-primary";
    };

    // Close modal
    const closeModal = useCallback(() => {
        setSelectedRequest(null);
    }, []);

    // Close modal with Escape key
    useEffect(() => {
        if (!selectedRequest) return;

        const handleEscape = (event) => {
            if (event.key === "Escape") {
                closeModal();
            }
        };

        window.addEventListener("keydown", handleEscape);

        return () => {
            window.removeEventListener("keydown", handleEscape);
        };
    }, [selectedRequest, closeModal]);

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

                        <span className="text-cyprus">
                            Returns & Refunds
                        </span>
                    </div>

                    <h1 className="text-2xl font-bold text-cyprus sm:text-3xl">
                        Returns & Refunds
                    </h1>

                    <p className="mt-1 text-sm text-text-grey">
                        Manage customer return requests and refunds.
                    </p>
                </div>

                <Link
                    to="/admin/orders"
                    className="inline-flex w-fit items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-cyprus transition hover:border-ocean-green hover:text-ocean-green"
                >
                    <i className="fa-solid fa-arrow-left"></i>
                    All Orders
                </Link>
            </div>

            {/* Statistics */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {/* Total Requests */}
                <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm text-text-grey">
                                Total Requests
                            </p>

                            <h2 className="mt-2 text-2xl font-bold text-cyprus">
                                {loading ? "—" : totalRequests}
                            </h2>
                        </div>

                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ocean-green/10 text-ocean-green">
                            <i className="fa-solid fa-rotate-left text-lg"></i>
                        </div>
                    </div>
                </div>

                {/* Return Requests */}
                <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm text-text-grey">
                                Return Requests
                            </p>

                            <h2 className="mt-2 text-2xl font-bold text-cyprus">
                                {loading ? "—" : returnRequests}
                            </h2>
                        </div>

                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
                            <i className="fa-solid fa-box-open text-lg"></i>
                        </div>
                    </div>
                </div>

                {/* Refund Requests */}
                <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm text-text-grey">
                                Refund Requests
                            </p>

                            <h2 className="mt-2 text-2xl font-bold text-cyprus">
                                {loading ? "—" : refundRequests}
                            </h2>
                        </div>

                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
                            <i className="fa-solid fa-money-bill-transfer text-lg"></i>
                        </div>
                    </div>
                </div>

                {/* Total Amount */}
                <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm text-text-grey">
                                Total Amount
                            </p>

                            <h2 className="mt-2 break-words text-2xl font-bold text-cyprus">
                                {loading
                                    ? "—"
                                    : `₹${formatAmount(totalAmount)}`}
                            </h2>
                        </div>

                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-pending/10 text-yellow-700">
                            <i className="fa-solid fa-indian-rupee-sign text-lg"></i>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="mb-6 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    {/* Search */}
                    <div className="relative w-full xl:max-w-md">
                        <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-sm text-text-grey"></i>

                        <input
                            type="text"
                            value={search}
                            onChange={(event) => {
                                setCurrentPage(1);
                                setSearch(event.target.value)
                            }}
                            placeholder="Search request, order, customer or product..."
                            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm text-cyprus outline-none transition focus:border-ocean-green focus:bg-white"
                        />
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <select
                            value={typeFilter}
                            onChange={(event) => {
                                setCurrentPage(1);
                                setTypeFilter(event.target.value)
                            }}
                            className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-cyprus outline-none focus:border-ocean-green"
                        >
                            <option value="All">All Types</option>
                            <option value="Return">Returns</option>
                            <option value="Refund">Refunds</option>
                        </select>

                        <select
                            value={statusFilter}
                            onChange={(event) => {
                                setCurrentPage(1);
                                setStatusFilter(event.target.value)
                            }}
                            className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-cyprus outline-none focus:border-ocean-green"
                        >
                            <option value="All">All Status</option>
                            <option value="Requested">Requested</option>
                            <option value="Approved">Approved</option>
                            <option value="Processing">Processing</option>
                            <option value="Completed">Completed</option>
                            <option value="Rejected">Rejected</option>
                            <option value="Failed">Failed</option>
                        </select>

                        <button
                            type="button"
                            onClick={resetFilters}
                            className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-cyprus transition hover:border-ocean-green hover:text-ocean-green"
                        >
                            <i className="fa-solid fa-rotate-right mr-2"></i>
                            Reset
                        </button>
                    </div>
                </div>
            </div>

            {/* Refresh and Results Count */}
            {!loading && !error && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-text-grey">
                        Showing{" "}
                        <span className="font-semibold text-cyprus">
                            {filteredOrders.length}
                        </span>{" "}
                        of{" "}
                        <span className="font-semibold text-cyprus">
                            {orders.length}
                        </span>{" "}
                        requests
                    </p>

                    <button
                        type="button"
                        onClick={fetchRequests}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-cyprus transition hover:border-ocean-green hover:text-ocean-green"
                    >
                        <i className="fa-solid fa-rotate-right"></i>
                        Refresh
                    </button>
                </div>
            )}

            {/* Error State */}
            {!loading && error && (
                <div className="mb-6 flex flex-col gap-3 rounded-xl border border-error/20 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <i className="fa-solid fa-circle-exclamation mt-1 text-error"></i>

                        <div>
                            <h3 className="font-semibold text-cyprus">
                                Unable to load requests
                            </h3>

                            <p className="mt-1 break-words text-sm text-text-grey">
                                {error}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={fetchRequests}
                        className="w-fit rounded-lg bg-ocean-green px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyprus"
                    >
                        <i className="fa-solid fa-rotate-right mr-2"></i>
                        Try Again
                    </button>
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="rounded-xl border border-gray-100 bg-white px-6 py-16 text-center shadow-sm">
                    <i className="fa-solid fa-spinner fa-spin text-3xl text-ocean-green"></i>

                    <p className="mt-4 text-sm text-text-grey">
                        Loading Returns & Refunds...
                    </p>
                </div>
            )}

            {/* Desktop Table */}
            {!loading &&
                !error &&
                filteredOrders.length > 0 && (
                    <div className="hidden overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm lg:block">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1150px]">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-gray-50">
                                        {[
                                            "Request",
                                            "Customer",
                                            "Product",
                                            "Type",
                                            "Amount",
                                            "Reason",
                                            "Status",
                                            "Date",
                                            "Action",
                                        ].map((heading) => (
                                            <th
                                                key={heading}
                                                className={`px-5 py-4 text-xs font-semibold uppercase tracking-wide text-text-grey ${
                                                    heading === "Action"
                                                        ? "text-right"
                                                        : "text-left"
                                                }`}
                                            >
                                                {heading}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-100">
                                    {currentOrders.map((order) => (
                                        <tr
                                            key={`${order.type}-${order.rawId}`}
                                            className="transition hover:bg-gray-50"
                                        >
                                            <td className="px-5 py-4">
                                                <p className="text-sm font-bold text-cyprus">
                                                    {order.id}
                                                </p>

                                                <p className="mt-1 text-xs text-text-grey">
                                                    {order.orderId}
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

                                            <td className="px-5 py-4">
                                                <p className="max-w-[180px] truncate text-sm text-cyprus">
                                                    {order.product}
                                                </p>
                                            </td>

                                            <td className="px-5 py-4">
                                                <span
                                                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getTypeClass(order.type)}`}
                                                >
                                                    {order.type}
                                                </span>
                                            </td>

                                            <td className="whitespace-nowrap px-5 py-4 text-sm font-bold text-cyprus">
                                                ₹{formatAmount(order.amount)}
                                            </td>

                                            <td className="px-5 py-4">
                                                <span className="text-sm text-text-grey">
                                                    {order.reason}
                                                </span>
                                            </td>

                                            <td className="px-5 py-4">
                                                <span
                                                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(order.status)}`}
                                                >
                                                    {order.status}
                                                </span>
                                            </td>

                                            <td className="whitespace-nowrap px-5 py-4 text-sm text-text-grey">
                                                {order.date}
                                            </td>

                                            <td className="px-5 py-4">
                                                <div className="flex justify-end">
                                                    <button
                                                        type="button"
                                                        title="View Request"
                                                        aria-label={`View ${order.id}`}
                                                        onClick={() =>
                                                            setSelectedRequest(order)
                                                        }
                                                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-aqua-spring text-cyprus transition hover:bg-ocean-green hover:text-white"
                                                    >
                                                        <i className="fa-regular fa-eye text-sm"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            {/* Mobile Cards */}
            {!loading &&
                !error &&
                filteredOrders.length > 0 && (
                    <div className="space-y-4 lg:hidden">
                        {currentOrders.map((order) => (
                            <div
                                key={`${order.type}-${order.rawId}`}
                                className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="break-all text-sm font-bold text-cyprus">
                                            {order.id}
                                        </p>

                                        <p className="mt-1 text-xs text-text-grey">
                                            Order: {order.orderId}
                                        </p>
                                    </div>

                                    <span
                                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(order.status)}`}
                                    >
                                        {order.status}
                                    </span>
                                </div>

                                <div className="mt-4 space-y-4">
                                    <div>
                                        <p className="text-xs text-text-grey">
                                            Customer
                                        </p>

                                        <p className="mt-1 break-words text-sm font-semibold text-cyprus">
                                            {order.customer}
                                        </p>

                                        <p className="mt-1 break-all text-xs text-text-grey">
                                            {order.email}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs text-text-grey">
                                            Product
                                        </p>

                                        <p className="mt-1 text-sm text-cyprus">
                                            {order.product}
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-text-grey">
                                                Type
                                            </p>

                                            <span
                                                className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getTypeClass(order.type)}`}
                                            >
                                                {order.type}
                                            </span>
                                        </div>

                                        <div>
                                            <p className="text-xs text-text-grey">
                                                Amount
                                            </p>

                                            <p className="mt-1 text-sm font-bold text-cyprus">
                                                ₹{formatAmount(order.amount)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-text-grey">
                                                Reason
                                            </p>

                                            <p className="mt-1 break-words text-sm text-cyprus">
                                                {order.reason}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs text-text-grey">
                                                Date
                                            </p>

                                            <p className="mt-1 text-sm text-cyprus">
                                                {order.date}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 border-t border-gray-100 pt-4">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setSelectedRequest(order)
                                        }
                                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-aqua-spring px-4 py-2.5 text-sm font-semibold text-cyprus transition hover:bg-ocean-green hover:text-white"
                                    >
                                        <i className="fa-regular fa-eye"></i>
                                        View Request
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

            {!loading && !error && (
                <OrdersPagination
                    page={safeCurrentPage}
                    totalPages={totalPages}
                    totalItems={filteredOrders.length}
                    pageSize={ORDERS_PER_PAGE}
                    onPageChange={setCurrentPage}
                />
            )}

            {/* Empty State */}
            {!loading &&
                !error &&
                filteredOrders.length === 0 && (
                    <div className="rounded-xl border border-gray-100 bg-white px-6 py-16 text-center shadow-sm">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-aqua-spring text-ocean-green">
                            <i className="fa-solid fa-rotate-left text-2xl"></i>
                        </div>

                        <h2 className="mt-5 text-lg font-bold text-cyprus">
                            No Returns or Refunds Found
                        </h2>

                        <p className="mx-auto mt-2 max-w-md text-sm text-text-grey">
                            No return or refund requests match your current
                            search and filters.
                        </p>

                        <button
                            type="button"
                            onClick={resetFilters}
                            className="mt-5 rounded-lg bg-ocean-green px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyprus"
                        >
                            Reset Filters
                        </button>
                    </div>
                )}

            {/* Request Details Modal */}
            {selectedRequest && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closeModal();
                        }
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="request-modal-title"
                        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                    >
                        {/* Modal Header */}
                        <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-gray-100 bg-white px-5 py-4">
                            <div className="min-w-0">
                                <h2
                                    id="request-modal-title"
                                    className="text-lg font-bold text-cyprus"
                                >
                                    Request Details
                                </h2>

                                <p className="mt-1 break-all text-sm text-text-grey">
                                    {selectedRequest.id}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={closeModal}
                                aria-label="Close request details"
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-text-grey transition hover:bg-error/10 hover:text-error"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="space-y-5 p-5">
                            <div className="flex flex-wrap items-center gap-2">
                                <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${getTypeClass(selectedRequest.type)}`}
                                >
                                    {selectedRequest.type}
                                </span>

                                <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(selectedRequest.status)}`}
                                >
                                    {selectedRequest.status}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="rounded-lg bg-gray-50 p-4">
                                    <p className="text-xs text-text-grey">
                                        Order ID
                                    </p>

                                    <p className="mt-1 break-all text-sm font-semibold text-cyprus">
                                        {selectedRequest.orderId}
                                    </p>
                                </div>

                                <div className="rounded-lg bg-gray-50 p-4">
                                    <p className="text-xs text-text-grey">
                                        Request Date
                                    </p>

                                    <p className="mt-1 text-sm font-semibold text-cyprus">
                                        {selectedRequest.date}
                                    </p>
                                </div>

                                <div className="rounded-lg bg-gray-50 p-4">
                                    <p className="text-xs text-text-grey">
                                        Customer
                                    </p>

                                    <p className="mt-1 break-words text-sm font-semibold text-cyprus">
                                        {selectedRequest.customer}
                                    </p>

                                    <p className="mt-1 break-all text-xs text-text-grey">
                                        {selectedRequest.email}
                                    </p>
                                </div>

                                <div className="rounded-lg bg-gray-50 p-4">
                                    <p className="text-xs text-text-grey">
                                        Amount
                                    </p>

                                    <p className="mt-1 text-lg font-bold text-cyprus">
                                        ₹{formatAmount(selectedRequest.amount)}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-text-grey">
                                    Product
                                </p>

                                <p className="mt-1 break-words text-sm text-cyprus">
                                    {selectedRequest.product}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-text-grey">
                                    Reason
                                </p>

                                <p className="mt-1 break-words text-sm text-cyprus">
                                    {selectedRequest.reason}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-text-grey">
                                    Request Information
                                </p>

                                <p className="mt-1 break-words text-sm text-text-grey">
                                    {selectedRequest.description ||
                                        selectedRequest.notes ||
                                        selectedRequest.admin_note ||
                                        "No additional information available."}
                                </p>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="border-t border-gray-100 bg-white p-5">
                            <button
                                type="button"
                                onClick={closeModal}
                                className="w-full rounded-lg bg-ocean-green px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyprus"
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

export default ReturnsRefunds;