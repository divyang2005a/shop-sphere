import React, { useCallback, useEffect, useMemo, useState } from "react";
import Pagination from "../../../components/Pagination";

const API_URL = "http://192.168.1.20:5000/api/admin/shipping-methods";
const PAGE_SIZE = 10;

const EMPTY_FORM = {
    name: "",
    type: "",
    charge: "",
    deliveryTime: "",
    status: "active",
};

function ShippingMethods() {
    const [methods, setMethods] = useState([]);
    const [formData, setFormData] = useState(EMPTY_FORM);

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);

    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [updatingId, setUpdatingId] = useState(null);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const getToken = () => localStorage.getItem("shopsphereToken");

    const getHeaders = () => {
        const token = getToken();

        if (!token) {
            throw new Error(
                "Login token not found. Please login again."
            );
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

    // GET: Fetch shipping methods
    const fetchMethods = useCallback(async () => {
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
                result.shipping_methods ??
                result.data?.shipping_methods ??
                result.data ??
                [];

            if (!Array.isArray(data)) {
                throw new Error(
                    "Invalid shipping methods data received."
                );
            }

            setMethods(data);
        } catch (err) {
            setError(err.message || "Failed to load shipping methods.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMethods();
    }, [fetchMethods]);

    // Open form for adding a new method
    const openAddForm = () => {
        setEditingId(null);
        setFormData(EMPTY_FORM);
        setError("");
        setSuccess("");
        setShowForm(true);
    };

    // Open form for editing an existing method
    const openEditForm = (method) => {
        setEditingId(method.id);

        setFormData({
            name: method.name ?? "",
            type: method.type ?? method.description ?? "",
            charge: method.charge ?? method.price ?? "",
            deliveryTime:
                method.deliveryTime ?? method.estimated_days ?? "",
            status: method.status ?? "active",
        });

        setError("");
        setSuccess("");
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingId(null);
        setFormData(EMPTY_FORM);
    };

    const handleChange = (event) => {
        const { name, value } = event.target;

        setFormData((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    // POST: Create or PATCH: Update shipping method
    const handleSubmit = async (event) => {
        event.preventDefault();

        setError("");
        setSuccess("");

        if (!formData.name.trim()) {
            setError("Shipping method name is required.");
            return;
        }

        if (
            formData.charge === "" ||
            !Number.isFinite(Number(formData.charge)) ||
            Number(formData.charge) < 0
        ) {
            setError("Enter a valid shipping charge.");
            return;
        }

        if (
            formData.deliveryTime.trim().length > 50
        ) {
            setError("Delivery time must be at most 50 characters.");
            return;
        }

        try {
            setSaving(true);

            const isEditing = editingId !== null;

            const url = isEditing
                ? `${API_URL}/${editingId}`
                : API_URL;

            const response = await fetch(url, {
                method: isEditing ? "PATCH" : "POST",
                headers: getHeaders(),
                body: JSON.stringify({
                    name: formData.name.trim(),
                    type: formData.type.trim(),
                    charge: Number(formData.charge),
                    deliveryTime: formData.deliveryTime.trim(),
                    status: formData.status,
                }),
            });

            if (!response.ok) {
                throw new Error(await getErrorMessage(response));
            }

            const result = await response.json();

            closeForm();

            setSuccess(
                result.message ||
                    (isEditing
                        ? "Shipping method updated successfully."
                        : "Shipping method added successfully.")
            );

            await fetchMethods();
        } catch (err) {
            setError(err.message || "Failed to save shipping method.");
        } finally {
            setSaving(false);
        }
    };

    // PATCH: Toggle active/inactive status
    const toggleStatus = async (method) => {
        const newStatus =
            String(method.status).toLowerCase() === "active"
                ? "inactive"
                : "active";

        setError("");
        setSuccess("");

        try {
            setUpdatingId(method.id);

            const response = await fetch(
                `${API_URL}/${method.id}`,
                {
                    method: "PATCH",
                    headers: getHeaders(),
                    body: JSON.stringify({
                        status: newStatus,
                    }),
                }
            );

            if (!response.ok) {
                throw new Error(await getErrorMessage(response));
            }

            const result = await response.json();

            setMethods((previous) =>
                previous.map((item) =>
                    String(item.id) === String(method.id)
                        ? { ...item, status: newStatus }
                        : item
                )
            );

            setSuccess(
                result.message ||
                    `Shipping method marked ${newStatus}.`
            );
        } catch (err) {
            setError(err.message || "Failed to update status.");
        } finally {
            setUpdatingId(null);
        }
    };

    // Search and filter
    const filteredMethods = useMemo(() => {
        const searchValue = search.trim().toLowerCase();

        return methods.filter((method) => {
            const matchesSearch =
                String(method.name ?? "")
                    .toLowerCase()
                    .includes(searchValue) ||
                String(method.type ?? method.description ?? "")
                    .toLowerCase()
                    .includes(searchValue);

            const matchesStatus =
                statusFilter === "all" ||
                String(method.status).toLowerCase() === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [methods, search, statusFilter]);
    const totalPages = Math.max(1, Math.ceil(filteredMethods.length / PAGE_SIZE));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const currentMethods = filteredMethods.slice(
        (safeCurrentPage - 1) * PAGE_SIZE,
        safeCurrentPage * PAGE_SIZE
    );

    // Statistics
    const stats = useMemo(() => {
        const active = methods.filter(
            (method) =>
                String(method.status).toLowerCase() === "active"
        ).length;

        const inactive = methods.length - active;

        return [
            {
                label: "Total Methods",
                value: methods.length,
                color: "text-cyprus",
                bg: "bg-aqua-spring",
                icon: "▤",
            },
            {
                label: "Active Methods",
                value: active,
                color: "text-green-700",
                bg: "bg-green-50",
                icon: "✓",
            },
            {
                label: "Inactive Methods",
                value: inactive,
                color: "text-red-700",
                bg: "bg-red-50",
                icon: "○",
            },
        ];
    }, [methods]);

    const formatPrice = (price) =>
        `₹${Number(price ?? 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;

    const renderStatus = (status) => {
        const active = String(status).toLowerCase() === "active";

        return (
            <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    active
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-700"
                }`}
            >
                {active ? "Active" : "Inactive"}
            </span>
        );
    };

    return (
        <div className="min-h-screen space-y-6 bg-gray-50 p-4 sm:p-6 lg:p-8">
            {/* Header */}
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-cyprus sm:text-3xl">
                        Shipping Methods
                    </h1>

                    <p className="mt-1 text-sm text-text-grey">
                        Manage shipping providers, charges and delivery estimates.
                    </p>
                </div>

                <div className="flex flex-wrap gap-3">
                    <button
                        type="button"
                        onClick={fetchMethods}
                        disabled={loading}
                        className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-cyprus transition hover:bg-gray-100 disabled:opacity-60"
                    >
                        ↻ Refresh
                    </button>

                    <button
                        type="button"
                        onClick={openAddForm}
                        className="rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                    >
                        + Add Shipping Method
                    </button>
                </div>
            </div>

            {/* Messages */}
            {success && (
                <div
                    role="status"
                    className="flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
                >
                    <span>{success}</span>

                    <button
                        type="button"
                        onClick={() => setSuccess("")}
                        aria-label="Dismiss success message"
                        className="font-bold"
                    >
                        ×
                    </button>
                </div>
            )}

            {error && (
                <div
                    role="alert"
                    className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                    <span>{error}</span>

                    <button
                        type="button"
                        onClick={() => setError("")}
                        aria-label="Dismiss error message"
                        className="font-bold"
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Add/Edit Form */}
            {showForm && (
                <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
                    <div className="mb-5 flex items-center justify-between gap-3">
                        <h2 className="text-lg font-bold text-cyprus">
                            {editingId !== null
                                ? "Edit Shipping Method"
                                : "Add Shipping Method"}
                        </h2>

                        <button
                            type="button"
                            onClick={closeForm}
                            className="rounded-lg px-3 py-1 text-xl text-gray-500 transition hover:bg-gray-100"
                            aria-label="Close form"
                        >
                            ×
                        </button>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            <div>
                                <label
                                    htmlFor="name"
                                    className="mb-2 block text-sm font-medium text-gray-700"
                                >
                                    Method Name *
                                </label>

                                <input
                                    id="name"
                                    name="name"
                                    type="text"
                                    maxLength={150}
                                    required
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="e.g. Blue Dart Express"
                                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-cyprus"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="type"
                                    className="mb-2 block text-sm font-medium text-gray-700"
                                >
                                    Type / Description
                                </label>

                                <input
                                    id="type"
                                    name="type"
                                    type="text"
                                    value={formData.type}
                                    onChange={handleChange}
                                    placeholder="e.g. Express Delivery"
                                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-cyprus"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="charge"
                                    className="mb-2 block text-sm font-medium text-gray-700"
                                >
                                    Shipping Charge (₹) *
                                </label>

                                <input
                                    id="charge"
                                    name="charge"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    required
                                    value={formData.charge}
                                    onChange={handleChange}
                                    placeholder="e.g. 80"
                                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-cyprus"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="deliveryTime"
                                    className="mb-2 block text-sm font-medium text-gray-700"
                                >
                                    Estimated Delivery
                                </label>

                                <input
                                    id="deliveryTime"
                                    name="deliveryTime"
                                    type="text"
                                    maxLength={50}
                                    value={formData.deliveryTime}
                                    onChange={handleChange}
                                    placeholder="e.g. 2-3 days"
                                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-cyprus"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="status"
                                    className="mb-2 block text-sm font-medium text-gray-700"
                                >
                                    Status
                                </label>

                                <select
                                    id="status"
                                    name="status"
                                    value={formData.status}
                                    onChange={handleChange}
                                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyprus"
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={closeForm}
                                disabled={saving}
                                className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                disabled={saving}
                                className="rounded-lg bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {saving
                                    ? "Saving..."
                                    : editingId !== null
                                      ? "Update Method"
                                      : "Save Method"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Statistics */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                        setCurrentPage(1);
                        setSearch(event.target.value);
                    }}
                    placeholder="Search shipping methods..."
                    className="min-w-0 flex-1 rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-cyprus"
                />

                <select
                    value={statusFilter}
                    onChange={(event) => {
                        setCurrentPage(1);
                        setStatusFilter(event.target.value);
                    }}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyprus sm:w-52"
                >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
            </div>

            {/* Methods Table / Cards */}
            <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                <div className="flex flex-col gap-1 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="font-semibold text-cyprus">
                        All Shipping Methods
                    </h2>

                    <p className="text-sm text-text-grey">
                        Showing {filteredMethods.length} of {methods.length}
                    </p>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <div className="h-9 w-9 animate-spin rounded-full border-4 border-gray-200 border-t-cyprus" />

                        <p className="mt-4 text-sm text-text-grey">
                            Loading shipping methods...
                        </p>
                    </div>
                ) : filteredMethods.length === 0 ? (
                    <div className="px-4 py-16 text-center">
                        <div className="text-4xl text-gray-300">▤</div>

                        <h3 className="mt-3 font-semibold text-cyprus">
                            No shipping methods found
                        </h3>

                        <p className="mt-1 text-sm text-text-grey">
                            Try another search or add a shipping method.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden overflow-x-auto lg:block">
                            <table className="w-full min-w-[850px] text-left text-sm">
                                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-text-grey">
                                    <tr>
                                        <th className="px-5 py-4 font-semibold">
                                            Method
                                        </th>
                                        <th className="px-5 py-4 font-semibold">
                                            Type
                                        </th>
                                        <th className="px-5 py-4 font-semibold">
                                            Charge
                                        </th>
                                        <th className="px-5 py-4 font-semibold">
                                            Delivery Time
                                        </th>
                                        <th className="px-5 py-4 font-semibold">
                                            Status
                                        </th>
                                        <th className="px-5 py-4 text-right font-semibold">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-100">
                                    {currentMethods.map((method) => (
                                        <tr
                                            key={method.id}
                                            className="transition hover:bg-gray-50"
                                        >
                                            <td className="px-5 py-4 font-semibold text-cyprus">
                                                {method.name}
                                            </td>

                                            <td className="px-5 py-4 text-gray-600">
                                                {method.type ??
                                                    method.description ??
                                                    "—"}
                                            </td>

                                            <td className="whitespace-nowrap px-5 py-4 font-semibold text-gray-800">
                                                {formatPrice(
                                                    method.charge ??
                                                        method.price
                                                )}
                                            </td>

                                            <td className="px-5 py-4 text-gray-600">
                                                {method.deliveryTime ??
                                                    method.estimated_days ??
                                                    "—"}
                                            </td>

                                            <td className="px-5 py-4">
                                                {renderStatus(method.status)}
                                            </td>

                                            <td className="px-5 py-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            openEditForm(method)
                                                        }
                                                        className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-cyprus transition hover:bg-gray-100"
                                                    >
                                                        Edit
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            toggleStatus(method)
                                                        }
                                                        disabled={
                                                            updatingId ===
                                                            method.id
                                                        }
                                                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                                                            String(
                                                                method.status
                                                            ).toLowerCase() ===
                                                            "active"
                                                                ? "bg-red-50 text-red-700 hover:bg-red-100"
                                                                : "bg-green-50 text-green-700 hover:bg-green-100"
                                                        }`}
                                                    >
                                                        {updatingId ===
                                                        method.id
                                                            ? "Updating..."
                                                            : String(
                                                                  method.status
                                                              ).toLowerCase() ===
                                                              "active"
                                                              ? "Deactivate"
                                                              : "Activate"}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile / Tablet Cards */}
                        <div className="grid grid-cols-1 gap-4 p-4 lg:hidden">
                            {currentMethods.map((method) => (
                                <div
                                    key={method.id}
                                    className="rounded-xl border border-gray-200 p-4 transition hover:border-gray-300 hover:shadow-sm"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <h3 className="break-words font-semibold text-cyprus">
                                                {method.name}
                                            </h3>

                                            <p className="mt-1 break-words text-sm text-text-grey">
                                                {method.type ??
                                                    method.description ??
                                                    "No description"}
                                            </p>
                                        </div>

                                        {renderStatus(method.status)}
                                    </div>

                                    <div className="mt-4 grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-text-grey">
                                                Shipping Charge
                                            </p>

                                            <p className="mt-1 font-semibold text-gray-800">
                                                {formatPrice(
                                                    method.charge ??
                                                        method.price
                                                )}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs text-text-grey">
                                                Delivery Time
                                            </p>

                                            <p className="mt-1 text-sm text-gray-800">
                                                {method.deliveryTime ??
                                                    method.estimated_days ??
                                                    "—"}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                openEditForm(method)
                                            }
                                            className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-semibold text-cyprus transition hover:bg-gray-50"
                                        >
                                            Edit
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                toggleStatus(method)
                                            }
                                            disabled={
                                                updatingId === method.id
                                            }
                                            className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
                                                String(
                                                    method.status
                                                ).toLowerCase() === "active"
                                                    ? "bg-red-50 text-red-700 hover:bg-red-100"
                                                    : "bg-green-50 text-green-700 hover:bg-green-100"
                                            }`}
                                        >
                                            {updatingId === method.id
                                                ? "Updating..."
                                                : String(
                                                      method.status
                                                  ).toLowerCase() === "active"
                                                  ? "Deactivate"
                                                  : "Activate"}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
                {!loading && !error && filteredMethods.length > 0 && (
                    <Pagination
                        page={safeCurrentPage}
                        totalPages={totalPages}
                        totalItems={filteredMethods.length}
                        pageSize={PAGE_SIZE}
                        itemLabel="shipping methods"
                        onPageChange={setCurrentPage}
                    />
                )}
            </div>
        </div>
    );
}

export default ShippingMethods;