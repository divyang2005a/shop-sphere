import React, { useEffect, useMemo, useState } from "react";

const API_URL = "http://localhost:5000/api/shipments/admin";

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

const STATUS_STYLES = {
    pending: "bg-amber-50 text-amber-700",
    ready_to_ship: "bg-blue-50 text-blue-700",
    shipped: "bg-indigo-50 text-indigo-700",
    in_transit: "bg-purple-50 text-purple-700",
    out_for_delivery: "bg-orange-50 text-orange-700",
    delivered: "bg-green-50 text-green-700",
    failed_delivery: "bg-red-50 text-red-700",
    returned: "bg-pink-50 text-pink-700",
    cancelled: "bg-gray-100 text-gray-600",
};

const getStatusLabel = (status) => {
    const normalizedStatus = String(status || "")
        .toLowerCase()
        .replaceAll(" ", "_")
        .replaceAll("-", "_");

    return (
        STATUS_OPTIONS.find(
            (option) => option.value === normalizedStatus
        )?.label || status || "Unknown"
    );
};

const getStatusValue = (status) => {
    const normalizedStatus = String(status || "")
        .toLowerCase()
        .replaceAll(" ", "_")
        .replaceAll("-", "_");

    return STATUS_OPTIONS.some(
        (option) => option.value === normalizedStatus
    )
        ? normalizedStatus
        : "pending";
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

const getShipmentId = (shipment) =>
    shipment.id ?? shipment.shipment_id;

const getOrderNumber = (shipment) =>
    shipment.order_number ??
    shipment.order_id ??
    shipment.orderId ??
    "—";

const getCustomerName = (shipment) =>
    shipment.customer_name ??
    shipment.name ??
    "Customer";

const getCourierName = (shipment) =>
    shipment.courier_name ??
    shipment.courier ??
    shipment.shipping_method_name ??
    "Not Assigned";

const getTrackingNumber = (shipment) =>
    shipment.tracking_number ??
    shipment.tracking_number_value ??
    shipment.trackingId ??
    "Not Assigned";

const getShipmentStatus = (shipment) =>
    getStatusValue(
        shipment.status ??
        shipment.shipment_status
    );

function Shipping() {
    const [shipments, setShipments] = useState([]);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState(null);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Fetch shipments from backend
    const fetchShipments = async () => {
        try {
            setLoading(true);
            setError("");

            const token = localStorage.getItem("shopsphereToken");

            if (!token) {
                throw new Error(
                    "Authentication token not found. Please login again."
                );
            }

            const response = await fetch(API_URL, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || "Failed to fetch shipments."
                );
            }

            const shipmentList =
                result.shipments ??
                result.data?.shipments ??
                result.data ??
                [];

            if (!Array.isArray(shipmentList)) {
                throw new Error(
                    "Invalid shipment data received from server."
                );
            }

            setShipments(shipmentList);
        } catch (err) {
            setError(err.message || "Something went wrong.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchShipments();
    }, []);

    // Update shipment status in backend
    const updateStatus = async (shipment, newStatus) => {
        const shipmentId = getShipmentId(shipment);

        if (!shipmentId) {
            setError("Shipment ID is missing.");
            return;
        }

        const currentStatus = getShipmentStatus(shipment);

        if (currentStatus === newStatus) {
            return;
        }

        try {
            setUpdatingId(shipmentId);
            setError("");
            setSuccess("");

            const token = localStorage.getItem("shopsphereToken");

            if (!token) {
                throw new Error(
                    "Authentication token not found. Please login again."
                );
            }

            const response = await fetch(
                `${API_URL}/${shipmentId}/status`,
                {
                    method: "PATCH",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        status: newStatus,
                        description: `Shipment status updated to ${getStatusLabel(
                            newStatus
                        )}`,
                    }),
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || "Failed to update shipment status."
                );
            }

            // Update the UI after a successful backend response
            setShipments((previousShipments) =>
                previousShipments.map((item) =>
                    String(getShipmentId(item)) === String(shipmentId)
                        ? {
                              ...item,
                              status: newStatus,
                              shipment_status: newStatus,
                          }
                        : item
                )
            );

            setSuccess(
                `Shipment status updated to ${getStatusLabel(newStatus)}.`
            );
        } catch (err) {
            setError(err.message || "Failed to update shipment status.");
        } finally {
            setUpdatingId(null);
        }
    };

    // Search and status filtering
    const filteredShipments = useMemo(() => {
        const searchValue = search.trim().toLowerCase();

        return shipments.filter((shipment) => {
            const orderNumber = String(getOrderNumber(shipment));
            const customerName = String(getCustomerName(shipment));
            const trackingNumber = String(getTrackingNumber(shipment));
            const courierName = String(getCourierName(shipment));

            const matchesSearch =
                orderNumber.toLowerCase().includes(searchValue) ||
                customerName.toLowerCase().includes(searchValue) ||
                trackingNumber.toLowerCase().includes(searchValue) ||
                courierName.toLowerCase().includes(searchValue);

            const matchesStatus =
                statusFilter === "all" ||
                getShipmentStatus(shipment) === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [shipments, search, statusFilter]);

    // Dashboard statistics
    const stats = useMemo(() => {
        const countStatus = (status) =>
            shipments.filter(
                (shipment) => getShipmentStatus(shipment) === status
            ).length;

        return [
            {
                label: "Total Shipments",
                value: shipments.length,
                color: "text-cyprus",
                bg: "bg-aqua-spring",
            },
            {
                label: "In Transit",
                value: countStatus("in_transit") +
                    countStatus("shipped"),
                color: "text-purple-700",
                bg: "bg-purple-50",
            },
            {
                label: "Out for Delivery",
                value: countStatus("out_for_delivery"),
                color: "text-orange-700",
                bg: "bg-orange-50",
            },
            {
                label: "Delivered",
                value: countStatus("delivered"),
                color: "text-green-700",
                bg: "bg-green-50",
            },
        ];
    }, [shipments]);

    const renderStatus = (status) => {
        const normalizedStatus = getStatusValue(status);

        return (
            <span
                className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                    STATUS_STYLES[normalizedStatus] ||
                    "bg-gray-100 text-gray-600"
                }`}
            >
                {getStatusLabel(normalizedStatus)}
            </span>
        );
    };

    return (
        <div className="min-h-screen space-y-6 bg-gray-50 p-4 sm:p-6 lg:p-8">
            {/* Page Header */}
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-cyprus sm:text-3xl">
                        Shipping Management
                    </h1>

                    <p className="mt-1 text-sm text-text-grey">
                        Manage shipments and update delivery status.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={fetchShipments}
                    disabled={loading}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-cyprus shadow-sm transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {loading ? "Loading..." : "↻ Refresh"}
                </button>
            </div>

            {/* Success Message */}
            {success && (
                <div
                    role="status"
                    className="flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
                >
                    <span>{success}</span>

                    <button
                        type="button"
                        onClick={() => setSuccess("")}
                        className="font-bold"
                        aria-label="Dismiss success message"
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div
                    role="alert"
                    className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                    <span>{error}</span>

                    <button
                        type="button"
                        onClick={() => setError("")}
                        className="font-bold"
                        aria-label="Dismiss error message"
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
                                className={`flex h-10 w-10 items-center justify-center rounded-lg text-lg ${stat.bg} ${stat.color}`}
                            >
                                {stat.label === "Total Shipments"
                                    ? "▤"
                                    : stat.label === "In Transit"
                                      ? "↗"
                                      : stat.label === "Out for Delivery"
                                        ? "➜"
                                        : "✓"}
                            </span>
                        </div>

                        <h2 className="mt-3 text-3xl font-bold text-cyprus">
                            {stat.value}
                        </h2>
                    </div>
                ))}
            </div>

            {/* Search and Filter */}
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-3 md:flex-row">
                    <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            ⌕
                        </span>

                        <input
                            type="text"
                            value={search}
                            onChange={(event) =>
                                setSearch(event.target.value)
                            }
                            placeholder="Search order, customer, tracking ID..."
                            className="w-full rounded-lg border border-gray-200 bg-white py-3 pl-9 pr-4 text-sm outline-none transition focus:border-cyprus focus:ring-2 focus:ring-cyprus/10"
                        />
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(event) =>
                            setStatusFilter(event.target.value)
                        }
                        className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyprus md:w-56"
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
            </div>

            {/* Shipment List */}
            <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                <div className="flex flex-col gap-1 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="font-semibold text-cyprus">
                        Shipment List
                    </h2>

                    <p className="text-sm text-text-grey">
                        Showing {filteredShipments.length} of{" "}
                        {shipments.length} shipments
                    </p>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center px-4 py-16">
                        <div className="h-9 w-9 animate-spin rounded-full border-4 border-gray-200 border-t-cyprus" />

                        <p className="mt-4 text-sm text-text-grey">
                            Loading shipments...
                        </p>
                    </div>
                ) : filteredShipments.length === 0 ? (
                    <div className="px-4 py-16 text-center">
                        <div className="text-4xl text-gray-300">▤</div>

                        <h3 className="mt-3 font-semibold text-cyprus">
                            No shipments found
                        </h3>

                        <p className="mt-1 text-sm text-text-grey">
                            Try changing your search or status filter.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden overflow-x-auto lg:block">
                            <table className="w-full min-w-[1000px] text-left text-sm">
                                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-text-grey">
                                    <tr>
                                        <th className="px-5 py-4 font-semibold">
                                            Order
                                        </th>
                                        <th className="px-5 py-4 font-semibold">
                                            Customer
                                        </th>
                                        <th className="px-5 py-4 font-semibold">
                                            Courier
                                        </th>
                                        <th className="px-5 py-4 font-semibold">
                                            Tracking ID
                                        </th>
                                        <th className="px-5 py-4 font-semibold">
                                            Date
                                        </th>
                                        <th className="px-5 py-4 font-semibold">
                                            Status
                                        </th>
                                        <th className="px-5 py-4 font-semibold">
                                            Update Status
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-100">
                                    {filteredShipments.map((shipment) => {
                                        const shipmentId =
                                            getShipmentId(shipment);

                                        const currentStatus =
                                            getShipmentStatus(shipment);

                                        const isUpdating =
                                            String(updatingId) ===
                                            String(shipmentId);

                                        const isLocked = [
                                            "delivered",
                                            "cancelled",
                                        ].includes(currentStatus);

                                        return (
                                            <tr
                                                key={shipmentId}
                                                className="transition hover:bg-gray-50"
                                            >
                                                <td className="px-5 py-4 font-semibold text-cyprus">
                                                    #{getOrderNumber(shipment)}
                                                </td>

                                                <td className="px-5 py-4">
                                                    <p className="font-medium text-gray-800">
                                                        {getCustomerName(
                                                            shipment
                                                        )}
                                                    </p>

                                                    {shipment.customer_email && (
                                                        <p className="mt-1 text-xs text-text-grey">
                                                            {
                                                                shipment.customer_email
                                                            }
                                                        </p>
                                                    )}
                                                </td>

                                                <td className="px-5 py-4 text-gray-700">
                                                    {getCourierName(shipment)}
                                                </td>

                                                <td className="px-5 py-4">
                                                    <span className="font-mono text-xs text-gray-600">
                                                        {getTrackingNumber(
                                                            shipment
                                                        )}
                                                    </span>
                                                </td>

                                                <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                                                    {formatDate(
                                                        shipment.created_at ??
                                                        shipment.shipment_date ??
                                                        shipment.order_created_at
                                                    )}
                                                </td>

                                                <td className="px-5 py-4">
                                                    {renderStatus(currentStatus)}
                                                </td>

                                                <td className="px-5 py-4">
                                                    <select
                                                        value={currentStatus}
                                                        disabled={
                                                            isUpdating ||
                                                            isLocked
                                                        }
                                                        onChange={(event) =>
                                                            updateStatus(
                                                                shipment,
                                                                event.target.value
                                                            )
                                                        }
                                                        className="max-w-48 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:border-cyprus disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-60"
                                                    >
                                                        {STATUS_OPTIONS.map(
                                                            (option) => (
                                                                <option
                                                                    key={
                                                                        option.value
                                                                    }
                                                                    value={
                                                                        option.value
                                                                    }
                                                                >
                                                                    {
                                                                        option.label
                                                                    }
                                                                </option>
                                                            )
                                                        )}
                                                    </select>

                                                    {isUpdating && (
                                                        <p className="mt-1 text-xs text-text-grey">
                                                            Updating...
                                                        </p>
                                                    )}

                                                    {isLocked && (
                                                        <p className="mt-1 text-xs text-text-grey">
                                                            Final status
                                                        </p>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile and Tablet Cards */}
                        <div className="grid grid-cols-1 gap-4 p-4 lg:hidden">
                            {filteredShipments.map((shipment) => {
                                const shipmentId =
                                    getShipmentId(shipment);

                                const currentStatus =
                                    getShipmentStatus(shipment);

                                const isUpdating =
                                    String(updatingId) ===
                                    String(shipmentId);

                                const isLocked = [
                                    "delivered",
                                    "cancelled",
                                ].includes(currentStatus);

                                return (
                                    <div
                                        key={shipmentId}
                                        className="rounded-xl border border-gray-200 p-4 transition hover:border-gray-300 hover:shadow-sm"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-xs text-text-grey">
                                                    Order
                                                </p>

                                                <h3 className="mt-1 font-bold text-cyprus">
                                                    #{getOrderNumber(shipment)}
                                                </h3>
                                            </div>

                                            {renderStatus(currentStatus)}
                                        </div>

                                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                            <div>
                                                <p className="text-xs text-text-grey">
                                                    Customer
                                                </p>

                                                <p className="mt-1 break-words text-sm font-medium text-gray-800">
                                                    {getCustomerName(
                                                        shipment
                                                    )}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-xs text-text-grey">
                                                    Courier
                                                </p>

                                                <p className="mt-1 break-words text-sm text-gray-800">
                                                    {getCourierName(shipment)}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-xs text-text-grey">
                                                    Tracking ID
                                                </p>

                                                <p className="mt-1 break-all font-mono text-xs text-gray-700">
                                                    {getTrackingNumber(
                                                        shipment
                                                    )}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-xs text-text-grey">
                                                    Shipment Date
                                                </p>

                                                <p className="mt-1 text-sm text-gray-700">
                                                    {formatDate(
                                                        shipment.created_at ??
                                                        shipment.shipment_date ??
                                                        shipment.order_created_at
                                                    )}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-4 border-t border-gray-100 pt-4">
                                            <label
                                                htmlFor={`status-${shipmentId}`}
                                                className="mb-2 block text-xs font-semibold text-gray-600"
                                            >
                                                Update Shipment Status
                                            </label>

                                            <select
                                                id={`status-${shipmentId}`}
                                                value={currentStatus}
                                                disabled={
                                                    isUpdating || isLocked
                                                }
                                                onChange={(event) =>
                                                    updateStatus(
                                                        shipment,
                                                        event.target.value
                                                    )
                                                }
                                                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyprus disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-60"
                                            >
                                                {STATUS_OPTIONS.map(
                                                    (option) => (
                                                        <option
                                                            key={option.value}
                                                            value={option.value}
                                                        >
                                                            {option.label}
                                                        </option>
                                                    )
                                                )}
                                            </select>

                                            {isUpdating && (
                                                <p className="mt-2 text-xs text-text-grey">
                                                    Updating status...
                                                </p>
                                            )}

                                            {isLocked && (
                                                <p className="mt-2 text-xs text-text-grey">
                                                    This shipment has a final
                                                    status.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default Shipping;