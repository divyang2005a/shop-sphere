import React, { useCallback, useEffect, useMemo, useState } from "react";
import Pagination from "../../../components/Pagination";

const API_URL = "http://192.168.1.20:5000/api/shipments/admin";
const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
    { value: "pending", label: "Pending" },
    { value: "ready_to_ship", label: "Ready to Ship" },
    { value: "shipped", label: "Shipped" },
    { value: "in_transit", label: "In Transit" },
    { value: "out_for_delivery", label: "Out for Delivery" },
    { value: "delivered", label: "Delivered" },
    { value: "failed_delivery", label: "Failed Delivery" },
    { value: "returned", label: "Returned" },
    { value: "cancelled", label: "Cancelled" },
];

function Tracking() {
    const [shipments, setShipments] = useState([]);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);

    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState(null);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [expandedId, setExpandedId] = useState(null);
    const [selectedStatus, setSelectedStatus] = useState({});
    const [locationInputs, setLocationInputs] = useState({});
    const [descriptionInputs, setDescriptionInputs] = useState({});

    const getHeaders = () => {
        const token = localStorage.getItem("shopsphereToken");

        if (!token) {
            throw new Error("Login session not found. Please login again.");
        }

        return {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        };
    };

    const getErrorMessage = async (response) => {
        try {
            const result = await response.json();
            return result.message || "Something went wrong.";
        } catch {
            return "Something went wrong.";
        }
    };

    const getShipmentId = (shipment) =>
        shipment.id ?? shipment.shipment_id;

    const getOrderNumber = (shipment) =>
        shipment.order_number ??
        shipment.order_id ??
        "N/A";

    const getTrackingNumber = (shipment) =>
        shipment.tracking_number ??
        shipment.trackingNumber ??
        "Not assigned";

    const getCustomerName = (shipment) =>
        shipment.customer_name ??
        shipment.customer ??
        "Customer";

    const getCourierName = (shipment) =>
        shipment.courier_name ??
        shipment.shipping_method_name ??
        "Not assigned";

    const getStatusLabel = (status) => {
        const option = STATUS_OPTIONS.find(
            (item) => item.value === String(status).toLowerCase()
        );

        if (option) return option.label;

        return String(status || "Pending")
            .replaceAll("_", " ")
            .replace(/\b\w/g, (character) => character.toUpperCase());
    };

    const getStatusStyle = (status) => {
        switch (String(status).toLowerCase()) {
            case "delivered":
                return "bg-green-50 text-green-700";

            case "shipped":
            case "in_transit":
                return "bg-blue-50 text-blue-700";

            case "out_for_delivery":
            case "ready_to_ship":
                return "bg-amber-50 text-amber-700";

            case "failed_delivery":
            case "returned":
            case "cancelled":
                return "bg-red-50 text-red-700";

            default:
                return "bg-gray-100 text-gray-700";
        }
    };

    const formatDate = (date) => {
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

    // Fetch shipments from backend
    const fetchShipments = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const response = await fetch(API_URL, {
                method: "GET",
                headers: getHeaders(),
            });

            if (!response.ok) {
                throw new Error(await getErrorMessage(response));
            }

            const result = await response.json();

            const data =
                result.shipments ??
                result.data?.shipments ??
                result.data ??
                [];

            if (!Array.isArray(data)) {
                throw new Error("Invalid shipment data received.");
            }

            setShipments(data);

            setSelectedStatus((previous) => {
                const next = { ...previous };

                data.forEach((shipment) => {
                    const id = getShipmentId(shipment);

                    if (id != null && next[id] === undefined) {
                        next[id] = String(
                            shipment.status || "pending"
                        ).toLowerCase();
                    }
                });

                return next;
            });
        } catch (err) {
            setError(err.message || "Failed to load tracking data.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchShipments();
    }, [fetchShipments]);

    // Search and filter
    const filteredShipments = useMemo(() => {
        const searchValue = search.trim().toLowerCase();

        return shipments.filter((shipment) => {
            const orderNumber = String(
                getOrderNumber(shipment)
            ).toLowerCase();

            const trackingNumber = String(
                getTrackingNumber(shipment)
            ).toLowerCase();

            const customerName = String(
                getCustomerName(shipment)
            ).toLowerCase();

            const courierName = String(
                getCourierName(shipment)
            ).toLowerCase();

            const matchesSearch =
                orderNumber.includes(searchValue) ||
                trackingNumber.includes(searchValue) ||
                customerName.includes(searchValue) ||
                courierName.includes(searchValue);

            const matchesStatus =
                statusFilter === "all" ||
                String(shipment.status).toLowerCase() === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [shipments, search, statusFilter]);

    const totalPages = Math.max(
        1,
        Math.ceil(filteredShipments.length / PAGE_SIZE)
    );
    const safeCurrentPage = Math.max(1, Math.min(currentPage, totalPages));

    const paginatedShipments = useMemo(() => {
        const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
        return filteredShipments.slice(startIndex, startIndex + PAGE_SIZE);
    }, [filteredShipments, safeCurrentPage]);

    // Dashboard statistics
    const stats = useMemo(() => {
        const countStatus = (status) =>
            shipments.filter(
                (shipment) =>
                    String(shipment.status).toLowerCase() === status
            ).length;

        return [
            {
                label: "Total Shipments",
                value: shipments.length,
                icon: "📦",
                style: "bg-aqua-spring text-cyprus",
            },
            {
                label: "In Transit",
                value: countStatus("in_transit") + countStatus("shipped"),
                icon: "🚚",
                style: "bg-blue-50 text-blue-700",
            },
            {
                label: "Out for Delivery",
                value: countStatus("out_for_delivery"),
                icon: "🛵",
                style: "bg-amber-50 text-amber-700",
            },
            {
                label: "Delivered",
                value: countStatus("delivered"),
                icon: "✓",
                style: "bg-green-50 text-green-700",
            },
        ];
    }, [shipments]);

    const isFinalStatus = (status) =>
        ["delivered", "cancelled"].includes(
            String(status).toLowerCase()
        );

    // Update shipment status
    const handleStatusUpdate = async (shipment) => {
        const shipmentId = getShipmentId(shipment);

        if (shipmentId == null) {
            setError("Shipment ID is missing.");
            return;
        }

        const newStatus = selectedStatus[shipmentId];

        if (!newStatus) {
            setError("Please select a shipment status.");
            return;
        }

        if (newStatus === String(shipment.status).toLowerCase()) {
            setError("Please select a different status.");
            return;
        }

        if (isFinalStatus(shipment.status)) {
            setError(
                "Delivered or cancelled shipments cannot be updated."
            );
            return;
        }

        try {
            setUpdatingId(shipmentId);
            setError("");
            setSuccess("");

            const response = await fetch(
                `${API_URL}/${shipmentId}/status`,
                {
                    method: "PATCH",
                    headers: getHeaders(),
                    body: JSON.stringify({
                        status: newStatus,
                        location:
                            locationInputs[shipmentId]?.trim() || undefined,
                        description:
                            descriptionInputs[shipmentId]?.trim() ||
                            undefined,
                    }),
                }
            );

            if (!response.ok) {
                throw new Error(await getErrorMessage(response));
            }

            const result = await response.json();

            setSuccess(
                result.message || "Shipment status updated successfully."
            );

            await fetchShipments();
        } catch (err) {
            setError(err.message || "Failed to update shipment status.");
        } finally {
            setUpdatingId(null);
        }
    };

    const getHistory = (shipment) => {
        const history = shipment.tracking_history;

        if (Array.isArray(history)) {
            return [...history].sort(
                (a, b) =>
                    new Date(b.tracked_at || b.created_at || 0) -
                    new Date(a.tracked_at || a.created_at || 0)
            );
        }

        return [];
    };

    const renderStatus = (status) => (
        <span
            className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(
                status
            )}`}
        >
            {getStatusLabel(status)}
        </span>
    );

    const renderTrackingHistory = (shipment) => {
        const history = getHistory(shipment);

        if (history.length === 0) {
            return (
                <p className="py-5 text-sm text-text-grey">
                    No tracking history available yet.
                </p>
            );
        }

        return (
            <div className="relative ml-2 space-y-5 border-l-2 border-gray-200 pl-6">
                {history.map((item, index) => (
                    <div
                        key={item.id ?? `${item.status}-${index}`}
                        className="relative"
                    >
                        <span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-primary ring-2 ring-aqua-spring" />

                        <div className="flex flex-col justify-between gap-1 sm:flex-row sm:gap-4">
                            <div>
                                <p className="font-semibold text-cyprus">
                                    {getStatusLabel(item.status)}
                                </p>

                                {item.location && (
                                    <p className="mt-1 text-sm text-gray-600">
                                        📍 {item.location}
                                    </p>
                                )}

                                {item.description && (
                                    <p className="mt-1 text-sm text-text-grey">
                                        {item.description}
                                    </p>
                                )}
                            </div>

                            <p className="shrink-0 text-xs text-text-grey">
                                {formatDate(
                                    item.tracked_at ?? item.created_at
                                )}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderUpdateForm = (shipment) => {
        const shipmentId = getShipmentId(shipment);

        if (isFinalStatus(shipment.status)) {
            return (
                <p className="mt-4 rounded-lg bg-gray-100 p-3 text-sm text-text-grey">
                    This shipment is {getStatusLabel(shipment.status).toLowerCase()}
                    . Status updates are disabled.
                </p>
            );
        }

        return (
            <div className="mt-5 rounded-xl border border-gray-200 bg-white p-4">
                <h4 className="font-semibold text-cyprus">
                    Update Shipment Status
                </h4>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-600">
                            New Status
                        </label>

                        <select
                            value={
                                selectedStatus[shipmentId] ??
                                String(shipment.status || "pending").toLowerCase()
                            }
                            onChange={(event) =>
                                setSelectedStatus((previous) => ({
                                    ...previous,
                                    [shipmentId]: event.target.value,
                                }))
                            }
                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyprus"
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
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-600">
                            Current Location
                        </label>

                        <input
                            type="text"
                            value={locationInputs[shipmentId] ?? ""}
                            onChange={(event) =>
                                setLocationInputs((previous) => ({
                                    ...previous,
                                    [shipmentId]: event.target.value,
                                }))
                            }
                            placeholder="e.g. Vadodara Hub"
                            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-cyprus"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-600">
                            Tracking Note
                        </label>

                        <input
                            type="text"
                            value={descriptionInputs[shipmentId] ?? ""}
                            onChange={(event) =>
                                setDescriptionInputs((previous) => ({
                                    ...previous,
                                    [shipmentId]: event.target.value,
                                }))
                            }
                            placeholder="e.g. Package reached hub"
                            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-cyprus"
                        />
                    </div>
                </div>

                <div className="mt-4 flex justify-end">
                    <button
                        type="button"
                        onClick={() => handleStatusUpdate(shipment)}
                        disabled={updatingId === shipmentId}
                        className="rounded-lg bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {updatingId === shipmentId
                            ? "Updating..."
                            : "Update Status"}
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen space-y-6 bg-gray-50 p-4 sm:p-6 lg:p-8">
            {/* Header */}
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-cyprus sm:text-3xl">
                        Shipment Tracking
                    </h1>

                    <p className="mt-1 text-sm text-text-grey">
                        Track shipments, review history, and update delivery status.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={fetchShipments}
                    disabled={loading}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-cyprus transition hover:bg-gray-100 disabled:opacity-60"
                >
                    ↻ Refresh
                </button>
            </div>

            {/* Alerts */}
            {error && (
                <div
                    role="alert"
                    className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                    <span>{error}</span>

                    <button
                        type="button"
                        onClick={() => setError("")}
                        className="font-bold"
                        aria-label="Dismiss error"
                    >
                        ×
                    </button>
                </div>
            )}

            {success && (
                <div
                    role="status"
                    className="flex items-start justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
                >
                    <span>{success}</span>

                    <button
                        type="button"
                        onClick={() => setSuccess("")}
                        className="font-bold"
                        aria-label="Dismiss success"
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Statistics */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map((stat) => (
                    <div
                        key={stat.label}
                        className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-sm text-text-grey">
                                {stat.label}
                            </p>

                            <span
                                className={`flex h-10 w-10 items-center justify-center rounded-lg text-lg ${stat.style}`}
                            >
                                {stat.icon}
                            </span>
                        </div>

                        <h2 className="mt-3 text-3xl font-bold text-cyprus">
                            {stat.value}
                        </h2>
                    </div>
                ))}
            </div>

            {/* Search and Filter */}
            <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:p-5">
                <input
                    type="text"
                    value={search}
                    onChange={(event) => {
                        setSearch(event.target.value);
                        setCurrentPage(1);
                    }}
                    placeholder="Search order, tracking number, customer, courier..."
                    className="min-w-0 flex-1 rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-cyprus"
                />

                <select
                    value={statusFilter}
                    onChange={(event) => {
                        setStatusFilter(event.target.value);
                        setCurrentPage(1);
                    }}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyprus sm:w-56"
                >
                    <option value="all">All Statuses</option>

                    {STATUS_OPTIONS.map((option) => (
                        <option
                            key={option.value}
                            value={option.value}
                        >
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Shipment List */}
            <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                <div className="flex flex-col gap-1 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="font-semibold text-cyprus">
                        Shipment Records
                    </h2>

                    <p className="text-sm text-text-grey">
                        {filteredShipments.length} shipments found
                    </p>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <div className="h-9 w-9 animate-spin rounded-full border-4 border-gray-200 border-t-cyprus" />

                        <p className="mt-4 text-sm text-text-grey">
                            Loading shipments...
                        </p>
                    </div>
                ) : filteredShipments.length === 0 ? (
                    <div className="px-4 py-16 text-center">
                        <div className="text-4xl">📦</div>

                        <h3 className="mt-3 font-semibold text-cyprus">
                            No shipments found
                        </h3>

                        <p className="mt-1 text-sm text-text-grey">
                            Try changing your search or status filter.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {paginatedShipments.map((shipment) => {
                            const shipmentId = getShipmentId(shipment);
                            const isExpanded = expandedId === shipmentId;

                            return (
                                <div
                                    key={shipmentId}
                                    className="p-4 transition hover:bg-gray-50/70 sm:p-5"
                                >
                                    {/* Shipment Summary */}
                                    <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
                                        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                            <div>
                                                <p className="text-xs text-text-grey">
                                                    Order Number
                                                </p>

                                                <p className="mt-1 font-semibold text-cyprus">
                                                    #{getOrderNumber(shipment)}
                                                </p>

                                                <p className="mt-1 text-xs text-text-grey">
                                                    Shipment ID: {shipmentId}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-xs text-text-grey">
                                                    Customer
                                                </p>

                                                <p className="mt-1 font-semibold text-gray-800">
                                                    {getCustomerName(shipment)}
                                                </p>

                                                <p className="mt-1 break-all text-xs text-text-grey">
                                                    {shipment.customer_email ?? ""}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-xs text-text-grey">
                                                    Tracking Number
                                                </p>

                                                <p className="mt-1 break-all font-mono text-sm font-semibold text-cyprus">
                                                    {getTrackingNumber(shipment)}
                                                </p>

                                                <p className="mt-1 text-xs text-text-grey">
                                                    {getCourierName(shipment)}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-xs text-text-grey">
                                                    Status
                                                </p>

                                                <div className="mt-2">
                                                    {renderStatus(shipment.status)}
                                                </div>

                                                <p className="mt-2 text-xs text-text-grey">
                                                    Updated:{" "}
                                                    {formatDate(
                                                        shipment.updated_at ??
                                                            shipment.created_at
                                                    )}
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setExpandedId(
                                                    isExpanded
                                                        ? null
                                                        : shipmentId
                                                )
                                            }
                                            className="shrink-0 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-cyprus transition hover:bg-gray-100"
                                        >
                                            {isExpanded
                                                ? "Hide Details ↑"
                                                : "View Tracking ↓"}
                                        </button>
                                    </div>

                                    {/* Expanded Tracking Details */}
                                    {isExpanded && (
                                        <div className="mt-5 rounded-xl bg-gray-50 p-4 sm:p-5">
                                            <div className="grid grid-cols-1 gap-4 border-b border-gray-200 pb-5 sm:grid-cols-2 xl:grid-cols-3">
                                                <div>
                                                    <p className="text-xs text-text-grey">
                                                        Shipment Created
                                                    </p>

                                                    <p className="mt-1 text-sm font-medium text-gray-800">
                                                        {formatDate(
                                                            shipment.created_at
                                                        )}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs text-text-grey">
                                                        Expected Delivery
                                                    </p>

                                                    <p className="mt-1 text-sm font-medium text-gray-800">
                                                        {formatDate(
                                                            shipment.expected_delivery_date
                                                        )}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs text-text-grey">
                                                        Courier
                                                    </p>

                                                    <p className="mt-1 text-sm font-medium text-gray-800">
                                                        {getCourierName(shipment)}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="mt-5">
                                                <h3 className="mb-5 font-semibold text-cyprus">
                                                    Tracking History
                                                </h3>

                                                {renderTrackingHistory(shipment)}
                                            </div>

                                            {renderUpdateForm(shipment)}
                                        </div>
                                    )}

                                </div>
                            );
                        })}
                    </div>
                )}

                {!loading && filteredShipments.length > 0 && (
                    <Pagination
                        page={safeCurrentPage}
                        totalPages={totalPages}
                        totalItems={filteredShipments.length}
                        pageSize={PAGE_SIZE}
                        itemLabel="shipments"
                        onPageChange={(page) =>
                            setCurrentPage(
                                Math.max(1, Math.min(page, totalPages))
                            )
                        }
                    />
                )}
            </div>
        </div>
    );
}

export default Tracking;