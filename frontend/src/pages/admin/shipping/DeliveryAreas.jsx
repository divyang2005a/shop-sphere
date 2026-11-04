import React, { useCallback, useEffect, useMemo, useState } from "react";

const API_URL = "http://192.168.1.20:5000/api/admin/delivery-areas";

const EMPTY_FORM = {
    name: "",
    pincode: "",
    charge: "",
    free_shipping_threshold: "",
    status: "active",
};

function DeliveryAreas() {
    const [areas, setAreas] = useState([]);
    const [formData, setFormData] = useState(EMPTY_FORM);

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

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

    // GET: Fetch delivery areas
    const fetchAreas = useCallback(async () => {
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
                result.delivery_areas ??
                result.data?.delivery_areas ??
                result.data ??
                [];

            if (!Array.isArray(data)) {
                throw new Error(
                    "Invalid delivery areas data received."
                );
            }

            setAreas(data);
        } catch (err) {
            setError(err.message || "Failed to load delivery areas.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchAreas();
    }, [fetchAreas]);

    const openAddForm = () => {
        setEditingId(null);
        setFormData(EMPTY_FORM);
        setError("");
        setSuccess("");
        setShowForm(true);
    };

    const openEditForm = (area) => {
        const pincodes = Array.isArray(area.pincodes)
            ? area.pincodes.join(", ")
            : area.pincode ?? "";

        setEditingId(area.id);

        setFormData({
            name: area.name ?? "",
            pincode: pincodes,
            charge: area.charge ?? area.shipping_fee ?? "",
            free_shipping_threshold:
                area.free_shipping_threshold ?? "",
            status: area.status ?? "active",
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

    // Validate PIN codes before sending to backend
    const validatePincodes = (value) => {
        const pincodes = value
            .split(",")
            .map((pincode) => pincode.trim())
            .filter(Boolean);

        if (pincodes.length === 0) {
            return "Enter at least one PIN code.";
        }

        if (pincodes.some((pincode) => pincode.length > 20)) {
            return "Each PIN code must be at most 20 characters.";
        }

        const uniquePincodes = [
            ...new Set(pincodes.map((pincode) => pincode.toUpperCase())),
        ];

        if (uniquePincodes.length !== pincodes.length) {
            return "Duplicate PIN codes are not allowed.";
        }

        if (
            pincodes.some(
                (pincode) => !/^[A-Z0-9][A-Z0-9 -]*$/i.test(pincode)
            )
        ) {
            return "PIN codes may contain letters, numbers, spaces and hyphens.";
        }

        return "";
    };

    // POST: Create or PATCH: Update delivery area
    const handleSubmit = async (event) => {
        event.preventDefault();

        setError("");
        setSuccess("");

        if (!formData.name.trim()) {
            setError("Delivery area name is required.");
            return;
        }

        const pincodeError = validatePincodes(formData.pincode);

        if (pincodeError) {
            setError(pincodeError);
            return;
        }

        if (
            formData.charge === "" ||
            !Number.isFinite(Number(formData.charge)) ||
            Number(formData.charge) < 0
        ) {
            setError("Enter a valid shipping fee.");
            return;
        }

        if (
            formData.free_shipping_threshold !== "" &&
            (
                !Number.isFinite(
                    Number(formData.free_shipping_threshold)
                ) ||
                Number(formData.free_shipping_threshold) < 0
            )
        ) {
            setError("Enter a valid free-shipping threshold.");
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
                    pincodes: formData.pincode
                        .split(",")
                        .map((pincode) => pincode.trim())
                        .filter(Boolean),
                    shipping_fee: Number(formData.charge),
                    free_shipping_threshold:
                        formData.free_shipping_threshold === ""
                            ? null
                            : Number(formData.free_shipping_threshold),
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
                    (
                        isEditing
                            ? "Delivery area updated successfully."
                            : "Delivery area added successfully."
                    )
            );

            await fetchAreas();
        } catch (err) {
            setError(err.message || "Failed to save delivery area.");
        } finally {
            setSaving(false);
        }
    };

    // PATCH: Toggle active/inactive status
    const toggleStatus = async (area) => {
        const newStatus =
            String(area.status).toLowerCase() === "active"
                ? "inactive"
                : "active";

        setError("");
        setSuccess("");

        try {
            setUpdatingId(area.id);

            const response = await fetch(`${API_URL}/${area.id}`, {
                method: "PATCH",
                headers: getHeaders(),
                body: JSON.stringify({
                    status: newStatus,
                }),
            });

            if (!response.ok) {
                throw new Error(await getErrorMessage(response));
            }

            const result = await response.json();

            setAreas((previous) =>
                previous.map((item) =>
                    String(item.id) === String(area.id)
                        ? { ...item, status: newStatus }
                        : item
                )
            );

            setSuccess(
                result.message ||
                    `Delivery area marked ${newStatus}.`
            );
        } catch (err) {
            setError(err.message || "Failed to update delivery area.");
        } finally {
            setUpdatingId(null);
        }
    };

    // Search and filter
    const filteredAreas = useMemo(() => {
        const searchValue = search.trim().toLowerCase();

        return areas.filter((area) => {
            const pincodes = Array.isArray(area.pincodes)
                ? area.pincodes.join(", ")
                : area.pincode ?? "";

            const matchesSearch =
                String(area.name ?? "")
                    .toLowerCase()
                    .includes(searchValue) ||
                String(pincodes)
                    .toLowerCase()
                    .includes(searchValue);

            const matchesStatus =
                statusFilter === "all" ||
                String(area.status).toLowerCase() === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [areas, search, statusFilter]);

    // Statistics
    const stats = useMemo(() => {
        const active = areas.filter(
            (area) => String(area.status).toLowerCase() === "active"
        ).length;

        return [
            {
                label: "Total Delivery Areas",
                value: areas.length,
                color: "text-cyprus",
                bg: "bg-aqua-spring",
                icon: "⌖",
            },
            {
                label: "Active Areas",
                value: active,
                color: "text-green-700",
                bg: "bg-green-50",
                icon: "✓",
            },
            {
                label: "Inactive Areas",
                value: areas.length - active,
                color: "text-red-700",
                bg: "bg-red-50",
                icon: "○",
            },
        ];
    }, [areas]);

    const formatPrice = (price) =>
        `₹${Number(price ?? 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;

    const getPincodes = (area) =>
        Array.isArray(area.pincodes)
            ? area.pincodes.join(", ")
            : area.pincode ?? "—";

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
                        Delivery Areas
                    </h1>

                    <p className="mt-1 text-sm text-text-grey">
                        Manage serviceable PIN codes and delivery charges.
                    </p>
                </div>

                <div className="flex flex-wrap gap-3">
                    <button
                        type="button"
                        onClick={fetchAreas}
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
                        + Add Delivery Area
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
                                ? "Edit Delivery Area"
                                : "Add Delivery Area"}
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
                                    htmlFor="areaName"
                                    className="mb-2 block text-sm font-medium text-gray-700"
                                >
                                    Area Name *
                                </label>

                                <input
                                    id="areaName"
                                    name="name"
                                    type="text"
                                    maxLength={150}
                                    required
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="e.g. Vadodara, Gujarat"
                                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-cyprus"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="pincode"
                                    className="mb-2 block text-sm font-medium text-gray-700"
                                >
                                    PIN Code(s) *
                                </label>

                                <input
                                    id="pincode"
                                    name="pincode"
                                    type="text"
                                    required
                                    value={formData.pincode}
                                    onChange={handleChange}
                                    placeholder="e.g. 390001, 390002"
                                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-cyprus"
                                />

                                <p className="mt-1 text-xs text-text-grey">
                                    Separate multiple PIN codes with commas.
                                </p>
                            </div>

                            <div>
                                <label
                                    htmlFor="charge"
                                    className="mb-2 block text-sm font-medium text-gray-700"
                                >
                                    Shipping Fee (₹) *
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
                                    placeholder="e.g. 50"
                                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-cyprus"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="free_shipping_threshold"
                                    className="mb-2 block text-sm font-medium text-gray-700"
                                >
                                    Free Shipping Threshold (₹)
                                </label>

                                <input
                                    id="free_shipping_threshold"
                                    name="free_shipping_threshold"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.free_shipping_threshold}
                                    onChange={handleChange}
                                    placeholder="e.g. 999"
                                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-cyprus"
                                />

                                <p className="mt-1 text-xs text-text-grey">
                                    Leave empty if not applicable.
                                </p>
                            </div>

                            <div>
                                <label
                                    htmlFor="areaStatus"
                                    className="mb-2 block text-sm font-medium text-gray-700"
                                >
                                    Status
                                </label>

                                <select
                                    id="areaStatus"
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
                                      ? "Update Area"
                                      : "Save Area"}
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
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by area name or PIN code..."
                    className="min-w-0 flex-1 rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-cyprus"
                />

                <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyprus sm:w-52"
                >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
            </div>

            {/* Delivery Areas */}
            <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                <div className="flex flex-col gap-1 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="font-semibold text-cyprus">
                        All Delivery Areas
                    </h2>

                    <p className="text-sm text-text-grey">
                        Showing {filteredAreas.length} of {areas.length}
                    </p>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <div className="h-9 w-9 animate-spin rounded-full border-4 border-gray-200 border-t-cyprus" />

                        <p className="mt-4 text-sm text-text-grey">
                            Loading delivery areas...
                        </p>
                    </div>
                ) : filteredAreas.length === 0 ? (
                    <div className="px-4 py-16 text-center">
                        <div className="text-4xl text-gray-300">⌖</div>

                        <h3 className="mt-3 font-semibold text-cyprus">
                            No delivery areas found
                        </h3>

                        <p className="mt-1 text-sm text-text-grey">
                            Try another search or add a delivery area.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden overflow-x-auto lg:block">
                            <table className="w-full min-w-[900px] text-left text-sm">
                                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-text-grey">
                                    <tr>
                                        <th className="px-5 py-4 font-semibold">
                                            Area Name
                                        </th>
                                        <th className="px-5 py-4 font-semibold">
                                            PIN Code(s)
                                        </th>
                                        <th className="px-5 py-4 font-semibold">
                                            Shipping Fee
                                        </th>
                                        <th className="px-5 py-4 font-semibold">
                                            Free Shipping From
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
                                    {filteredAreas.map((area) => (
                                        <tr
                                            key={area.id}
                                            className="transition hover:bg-gray-50"
                                        >
                                            <td className="px-5 py-4 font-semibold text-cyprus">
                                                {area.name}
                                            </td>

                                            <td className="max-w-xs px-5 py-4">
                                                <span className="break-words font-mono text-xs text-gray-600">
                                                    {getPincodes(area)}
                                                </span>
                                            </td>

                                            <td className="whitespace-nowrap px-5 py-4 font-semibold text-gray-800">
                                                {formatPrice(
                                                    area.charge ??
                                                        area.shipping_fee
                                                )}
                                            </td>

                                            <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                                                {area.free_shipping_threshold == null
                                                    ? "—"
                                                    : formatPrice(
                                                          area.free_shipping_threshold
                                                      )}
                                            </td>

                                            <td className="px-5 py-4">
                                                {renderStatus(area.status)}
                                            </td>

                                            <td className="px-5 py-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            openEditForm(area)
                                                        }
                                                        className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-cyprus transition hover:bg-gray-100"
                                                    >
                                                        Edit
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            toggleStatus(area)
                                                        }
                                                        disabled={
                                                            updatingId ===
                                                            area.id
                                                        }
                                                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                                                            String(
                                                                area.status
                                                            ).toLowerCase() ===
                                                            "active"
                                                                ? "bg-red-50 text-red-700 hover:bg-red-100"
                                                                : "bg-green-50 text-green-700 hover:bg-green-100"
                                                        }`}
                                                    >
                                                        {updatingId === area.id
                                                            ? "Updating..."
                                                            : String(
                                                                  area.status
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
                            {filteredAreas.map((area) => (
                                <div
                                    key={area.id}
                                    className="rounded-xl border border-gray-200 p-4 transition hover:border-gray-300 hover:shadow-sm"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <h3 className="break-words font-semibold text-cyprus">
                                                {area.name}
                                            </h3>

                                            <p className="mt-2 break-words font-mono text-xs text-text-grey">
                                                PIN: {getPincodes(area)}
                                            </p>
                                        </div>

                                        {renderStatus(area.status)}
                                    </div>

                                    <div className="mt-4 grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-text-grey">
                                                Shipping Fee
                                            </p>

                                            <p className="mt-1 font-semibold text-gray-800">
                                                {formatPrice(
                                                    area.charge ??
                                                        area.shipping_fee
                                                )}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs text-text-grey">
                                                Free Shipping From
                                            </p>

                                            <p className="mt-1 font-semibold text-gray-800">
                                                {area.free_shipping_threshold == null
                                                    ? "—"
                                                    : formatPrice(
                                                          area.free_shipping_threshold
                                                      )}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => openEditForm(area)}
                                            className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-semibold text-cyprus transition hover:bg-gray-50"
                                        >
                                            Edit
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => toggleStatus(area)}
                                            disabled={updatingId === area.id}
                                            className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
                                                String(
                                                    area.status
                                                ).toLowerCase() === "active"
                                                    ? "bg-red-50 text-red-700 hover:bg-red-100"
                                                    : "bg-green-50 text-green-700 hover:bg-green-100"
                                            }`}
                                        >
                                            {updatingId === area.id
                                                ? "Updating..."
                                                : String(
                                                      area.status
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
            </div>
        </div>
    );
}

export default DeliveryAreas;