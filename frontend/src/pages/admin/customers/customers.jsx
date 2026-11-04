import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const API_BASE_URL = "http://192.168.1.20:5000/api";
const API_SERVER_URL = "http://192.168.1.20:5000";

// Customer profile image with initials fallback
function CustomerAvatar({ customer, size = "h-11 w-11" }) {
    const [imageError, setImageError] = useState(false);

    const profileImage = customer?.profile_image;

    const imageUrl = profileImage
        ? profileImage.startsWith("http")
            ? profileImage
            : `${API_SERVER_URL}${
                  profileImage.startsWith("/") ? "" : "/"
              }${profileImage}`
        : "";

    const initials = (customer?.name || "Customer")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join("");

    if (!imageUrl || imageError) {
        return (
            <div
                className={`${size} flex shrink-0 items-center justify-center rounded-full bg-aqua-spring font-bold text-cyprus`}
            >
                {initials}
            </div>
        );
    }

    return (
        <img
            src={imageUrl}
            alt={customer?.name || "Customer"}
            className={`${size} shrink-0 rounded-full border border-gray-200 object-cover`}
            onError={() => setImageError(true)}
        />
    );
}

function Customers() {
    const [customers, setCustomers] = useState([]);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [updatingId, setUpdatingId] = useState(null);

    // Confirmation modal state
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    const getToken = () => localStorage.getItem("shopsphereToken");

    const getHeaders = () => ({
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": "application/json",
    });

    // Fetch customers from backend
    const fetchCustomers = async () => {
        setLoading(true);
        setError("");

        const token = getToken();

        if (!token) {
            setError(
                "Authentication token not found. Please log in again."
            );
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/admin/users`, {
                method: "GET",
                headers: getHeaders(),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to load customers."
                );
            }

            const users = Array.isArray(data.users) ? data.users : [];

            setCustomers(users);
        } catch (err) {
            setError(
                err.message ||
                    "Unable to connect to the server. Please try again."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCustomers();
    }, []);

    // Normalize status
    const getStatus = (status) => {
        return String(status || "").toLowerCase() === "active"
            ? "Active"
            : "Inactive";
    };

    // Format date
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

    // Customer initials
    const getInitials = (name) => {
        return (name || "Customer")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((word) => word.charAt(0).toUpperCase())
            .join("");
    };

    // Filter customers
    const filteredCustomers = useMemo(() => {
        const query = search.trim().toLowerCase();

        return customers.filter((customer) => {
            const name = String(customer.name || "").toLowerCase();
            const email = String(customer.email || "").toLowerCase();
            const mobile = String(customer.mobile || "").toLowerCase();

            const matchesSearch =
                name.includes(query) ||
                email.includes(query) ||
                mobile.includes(query);

            const matchesStatus =
                statusFilter === "All" ||
                getStatus(customer.status) === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [customers, search, statusFilter]);

    // Summary cards
    const totalCustomers = customers.length;

    const activeCustomers = customers.filter(
        (customer) => getStatus(customer.status) === "Active"
    ).length;

    const inactiveCustomers = totalCustomers - activeCustomers;

    // Open confirmation modal
    const handleStatusToggle = (customer) => {
        setError("");
        setSelectedCustomer(customer);
    };

    // Confirm status change
    const confirmStatusChange = async () => {
        if (!selectedCustomer) return;

        const customer = selectedCustomer;

        const newStatus =
            getStatus(customer.status) === "Active"
                ? "inactive"
                : "active";

        const token = getToken();

        if (!token) {
            setError(
                "Authentication token not found. Please log in again."
            );
            setSelectedCustomer(null);
            return;
        }

        setUpdatingId(customer.id);
        setError("");

        try {
            const response = await fetch(
                `${API_BASE_URL}/admin/users/${customer.id}/status`,
                {
                    method: "PUT",
                    headers: getHeaders(),
                    body: JSON.stringify({ status: newStatus }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                        "Unable to update customer status."
                );
            }

            setCustomers((previousCustomers) =>
                previousCustomers.map((item) =>
                    String(item.id) === String(customer.id)
                        ? { ...item, status: newStatus }
                        : item
                )
            );

            setSelectedCustomer(null);
        } catch (err) {
            setError(
                err.message || "Unable to update customer status."
            );
            setSelectedCustomer(null);
        } finally {
            setUpdatingId(null);
        }
    };

    // Close modal
    const closeModal = () => {
        if (updatingId !== null) return;
        setSelectedCustomer(null);
    };

    // Status badge
    const renderStatus = (status) => {
        const active = getStatus(status) === "Active";

        return (
            <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                    active
                        ? "bg-success/10 text-success"
                        : "bg-error/10 text-error"
                }`}
            >
                <span
                    className={`h-1.5 w-1.5 rounded-full ${
                        active ? "bg-success" : "bg-error"
                    }`}
                />

                {active ? "Active" : "Inactive"}
            </span>
        );
    };

    return (
        <div className="min-h-screen space-y-6 bg-aqua-spring/20 p-4 sm:p-6 lg:p-8">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-text-grey">
                        <Link
                            to="/admin-dashboard"
                            className="transition hover:text-ocean-green"
                        >
                            Dashboard
                        </Link>

                        <span>/</span>

                        <span className="font-medium text-cyprus">
                            Customers
                        </span>
                    </div>

                    <h1 className="text-2xl font-bold text-cyprus sm:text-3xl">
                        Customers
                    </h1>

                    <p className="mt-1 text-sm text-text-grey">
                        Manage and view your registered customers.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={fetchCustomers}
                    disabled={loading}
                    className="rounded-xl bg-ocean-green px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {loading ? "Loading..." : "Refresh Customers"}
                </button>
            </div>

            {/* Error message */}
            {error && (
                <div
                    role="alert"
                    className="flex flex-col gap-3 rounded-xl border border-error/20 bg-error/5 p-4 text-sm text-error sm:flex-row sm:items-center sm:justify-between"
                >
                    <span>{error}</span>

                    <button
                        type="button"
                        onClick={fetchCustomers}
                        className="self-start font-semibold underline sm:self-auto"
                    >
                        Try Again
                    </button>
                </div>
            )}

            {/* Statistics */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <p className="text-sm text-text-grey">
                        Total Customers
                    </p>

                    <h2 className="mt-3 text-3xl font-bold text-cyprus">
                        {totalCustomers}
                    </h2>

                    <p className="mt-2 text-xs text-text-grey">
                        Registered customers
                    </p>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <p className="text-sm text-text-grey">
                        Active Customers
                    </p>

                    <h2 className="mt-3 text-3xl font-bold text-success">
                        {activeCustomers}
                    </h2>

                    <p className="mt-2 text-xs text-text-grey">
                        Currently active
                    </p>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <p className="text-sm text-text-grey">
                        Inactive Customers
                    </p>

                    <h2 className="mt-3 text-3xl font-bold text-error">
                        {inactiveCustomers}
                    </h2>

                    <p className="mt-2 text-xs text-text-grey">
                        Currently inactive
                    </p>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <p className="text-sm text-text-grey">
                        Customer Orders
                    </p>

                    <h2 className="mt-3 text-3xl font-bold text-cyprus">
                        —
                    </h2>

                    <p className="mt-2 text-xs text-text-grey">
                        Order summary API required
                    </p>
                </div>
            </div>

            {/* Customer list */}
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="border-b border-gray-100 p-4 sm:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-cyprus">
                                All Customers
                            </h2>

                            <p className="mt-1 text-sm text-text-grey">
                                {filteredCustomers.length} customers found
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row">
                            <input
                                type="search"
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder="Search name, email, mobile..."
                                aria-label="Search customers"
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-ocean-green sm:w-72"
                            />

                            <select
                                value={statusFilter}
                                onChange={(event) =>
                                    setStatusFilter(event.target.value)
                                }
                                aria-label="Filter customers by status"
                                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-ocean-green"
                            >
                                <option value="All">All Status</option>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="p-12 text-center">
                        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-gray-200 border-t-ocean-green" />

                        <p className="mt-4 text-sm text-text-grey">
                            Loading customers...
                        </p>
                    </div>
                ) : filteredCustomers.length === 0 ? (
                    <div className="px-4 py-14 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-aqua-spring text-2xl">
                            👥
                        </div>

                        <h3 className="mt-4 font-semibold text-cyprus">
                            No customers found
                        </h3>

                        <p className="mt-2 text-sm text-text-grey">
                            Try changing your search or status filter.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Desktop table */}
                        <div className="hidden overflow-x-auto lg:block">
                            <table className="w-full min-w-[900px] text-left">
                                <thead className="bg-gray-50">
                                    <tr className="text-xs uppercase tracking-wide text-text-grey">
                                        <th className="px-6 py-4 font-semibold">
                                            Customer
                                        </th>

                                        <th className="px-6 py-4 font-semibold">
                                            Contact
                                        </th>

                                        <th className="px-6 py-4 font-semibold">
                                            Joined Date
                                        </th>

                                        <th className="px-6 py-4 font-semibold">
                                            Status
                                        </th>

                                        <th className="px-6 py-4 text-right font-semibold">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-100">
                                    {filteredCustomers.map((customer) => (
                                        <tr
                                            key={customer.id}
                                            className="transition hover:bg-gray-50/70"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <CustomerAvatar
                                                        customer={customer}
                                                        size="h-11 w-11"
                                                    />

                                                    <div className="min-w-0">
                                                        <p className="truncate font-semibold text-cyprus">
                                                            {customer.name ||
                                                                "Unnamed Customer"}
                                                        </p>

                                                        <p className="mt-1 text-xs text-text-grey">
                                                            ID: {customer.id}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-6 py-4">
                                                <p className="text-sm text-cyprus">
                                                    {customer.email || "—"}
                                                </p>

                                                <p className="mt-1 text-xs text-text-grey">
                                                    {customer.mobile || "—"}
                                                </p>
                                            </td>

                                            <td className="px-6 py-4 text-sm text-text-grey">
                                                {formatDate(customer.created_at)}
                                            </td>

                                            <td className="px-6 py-4">
                                                {renderStatus(customer.status)}
                                            </td>

                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Link
                                                        to={`/admin/customers/${customer.id}`}
                                                        className="rounded-lg border border-ocean-green/20 px-3 py-2 text-xs font-semibold text-ocean-green transition hover:bg-aqua-spring"
                                                    >
                                                        View
                                                    </Link>

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleStatusToggle(
                                                                customer
                                                            )
                                                        }
                                                        disabled={
                                                            updatingId ===
                                                            customer.id
                                                        }
                                                        className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-cyprus transition hover:bg-gray-50 disabled:opacity-50"
                                                    >
                                                        {updatingId ===
                                                        customer.id
                                                            ? "Saving..."
                                                            : getStatus(
                                                                  customer.status
                                                              ) === "Active"
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

                        {/* Mobile cards */}
                        <div className="space-y-3 p-4 lg:hidden">
                            {filteredCustomers.map((customer) => (
                                <div
                                    key={customer.id}
                                    className="rounded-xl border border-gray-100 p-4"
                                >
                                    <div className="flex items-start gap-3">
                                        <CustomerAvatar
                                            customer={customer}
                                            size="h-12 w-12"
                                        />

                                        <div className="min-w-0 flex-1">
                                            <p className="break-words font-semibold text-cyprus">
                                                {customer.name ||
                                                    "Unnamed Customer"}
                                            </p>

                                            <p className="mt-1 break-all text-sm text-text-grey">
                                                {customer.email || "—"}
                                            </p>

                                            <p className="mt-1 text-sm text-text-grey">
                                                {customer.mobile || "—"}
                                            </p>

                                            <div className="mt-3">
                                                {renderStatus(customer.status)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
                                        <p className="text-xs text-text-grey">
                                            Joined:{" "}
                                            {formatDate(customer.created_at)}
                                        </p>

                                        <div className="flex gap-2">
                                            <Link
                                                to={`/admin/customers/${customer.id}`}
                                                className="rounded-lg border border-ocean-green/20 px-3 py-2 text-xs font-semibold text-ocean-green"
                                            >
                                                View
                                            </Link>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleStatusToggle(customer)
                                                }
                                                disabled={
                                                    updatingId === customer.id
                                                }
                                                className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-cyprus disabled:opacity-50"
                                            >
                                                {updatingId === customer.id
                                                    ? "Saving..."
                                                    : getStatus(
                                                          customer.status
                                                      ) === "Active"
                                                      ? "Deactivate"
                                                      : "Activate"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Center Confirmation Modal */}
            {selectedCustomer && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closeModal();
                        }
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="customer-status-title"
                        className="w-full max-w-md animate-[modalIn_0.2s_ease-out] rounded-2xl bg-white p-6 shadow-2xl sm:p-7"
                    >
                        {/* Modal icon */}
                        <div
                            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
                                getStatus(selectedCustomer.status) === "Active"
                                    ? "bg-red-50 text-red-600"
                                    : "bg-green-50 text-green-600"
                            }`}
                        >
                            {getStatus(selectedCustomer.status) === "Active" ? (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-8 w-8"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={1.8}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M12 9v3.75m0 3h.008M10.29 3.86 1.82 18.1A1.9 1.9 0 0 0 3.45 21h17.1a1.9 1.9 0 0 0 1.63-2.9L13.71 3.86a2 2 0 0 0-3.42 0Z"
                                    />
                                </svg>
                            ) : (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-8 w-8"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={1.8}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="m5 12 4 4L19 6"
                                    />
                                </svg>
                            )}
                        </div>

                        {/* Modal text */}
                        <div className="mt-5 text-center">
                            <h2
                                id="customer-status-title"
                                className="text-xl font-bold text-cyprus sm:text-2xl"
                            >
                                {getStatus(selectedCustomer.status) === "Active"
                                    ? "Deactivate Customer?"
                                    : "Activate Customer?"}
                            </h2>

                            <p className="mt-3 text-sm leading-6 text-text-grey">
                                Are you sure you want to{" "}
                                <span
                                    className={`font-semibold ${
                                        getStatus(selectedCustomer.status) ===
                                        "Active"
                                            ? "text-red-600"
                                            : "text-green-600"
                                    }`}
                                >
                                    {getStatus(selectedCustomer.status) ===
                                    "Active"
                                        ? "deactivate"
                                        : "activate"}
                                </span>{" "}
                                <span className="font-semibold text-cyprus">
                                    {selectedCustomer.name || "this customer"}
                                </span>
                                ?
                            </p>

                            <p className="mt-2 text-xs leading-5 text-text-grey">
                                {getStatus(selectedCustomer.status) === "Active"
                                    ? "This customer will be marked as inactive."
                                    : "This customer will be marked as active again."}
                            </p>
                        </div>

                        {/* Modal buttons */}
                        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
                            <button
                                type="button"
                                onClick={closeModal}
                                disabled={updatingId !== null}
                                className="rounded-xl border border-gray-200 px-6 py-3 text-sm font-semibold text-cyprus transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-32"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={confirmStatusChange}
                                disabled={updatingId !== null}
                                className={`rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-36 ${
                                    getStatus(selectedCustomer.status) ===
                                    "Active"
                                        ? "bg-red-600 hover:bg-red-700"
                                        : "bg-green-600 hover:bg-green-700"
                                }`}
                            >
                                {updatingId !== null
                                    ? "Please wait..."
                                    : getStatus(selectedCustomer.status) ===
                                      "Active"
                                      ? "Yes, Deactivate"
                                      : "Yes, Activate"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal animation */}
            <style>{`
                @keyframes modalIn {
                    from {
                        opacity: 0;
                        transform: translateY(12px) scale(0.96);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
            `}</style>
        </div>
    );
}

export default Customers;