import React, { useEffect, useState } from "react";
import Pagination from "../../../components/Pagination";

const API_URL = "http://192.168.1.20:5000/api";
const PAGE_SIZE = 10;

const initialFormData = {
    code: "",
    discount_type: "percentage",
    discount_value: "",
    minimum_cart_value: "0",
    maximum_discount: "",
    start_date: "",
    end_date: "",
    usage_limit: "",
    user_limit: "",
    per_user_limit: "1",
    first_order_only: false,
    status: "active",
};

function Coupons() {
    const [coupons, setCoupons] = useState([]);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [currentPage, setCurrentPage] = useState(1);

    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ ...initialFormData });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [updatingId, setUpdatingId] = useState(null);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Center confirmation modal state
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [selectedCoupon, setSelectedCoupon] = useState(null);

    const getToken = () => localStorage.getItem("shopsphereToken");

    const getHeaders = () => ({
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
    });

    // --------------------------------------------------
    // DATE HELPERS
    // --------------------------------------------------

    const formatDateInput = (value) => {
        if (!value) return "";

        const dateString = String(value);

        // Handle MySQL DATE strings and ISO date strings safely.
        const datePart = dateString.slice(0, 10);

        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
            return datePart;
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0"),
        ].join("-");
    };

    const formatDate = (value) => {
        if (!value) return "—";

        const dateString = formatDateInput(value);

        if (!dateString) return "—";

        const date = new Date(`${dateString}T00:00:00`);

        if (Number.isNaN(date.getTime())) return "—";

        return date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    // --------------------------------------------------
    // CURRENCY HELPER
    // --------------------------------------------------

    const formatCurrency = (value) => {
        const amount = Number(value);

        return `₹${(
            Number.isFinite(amount) ? amount : 0
        ).toLocaleString("en-IN", {
            maximumFractionDigits: 2,
        })}`;
    };

    // --------------------------------------------------
    // COUPON STATUS
    // --------------------------------------------------

    const getCouponStatus = (coupon) => {
        const backendStatus = String(coupon.status || "").toLowerCase();

        if (backendStatus === "inactive") {
            return "Inactive";
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startDate = coupon.start_date
            ? new Date(`${formatDateInput(coupon.start_date)}T00:00:00`)
            : null;

        const endDate = coupon.end_date
            ? new Date(`${formatDateInput(coupon.end_date)}T00:00:00`)
            : null;

        if (
            endDate &&
            !Number.isNaN(endDate.getTime()) &&
            endDate < today
        ) {
            return "Expired";
        }

        if (
            startDate &&
            !Number.isNaN(startDate.getTime()) &&
            startDate > today
        ) {
            return "Scheduled";
        }

        return "Active";
    };

    const getStatusClass = (status) => {
        switch (status) {
            case "Active":
                return "bg-green-100 text-green-700";

            case "Inactive":
                return "bg-red-100 text-red-600";

            case "Expired":
                return "bg-red-100 text-red-700";

            case "Scheduled":
                return "bg-yellow-100 text-yellow-700";

            default:
                return "bg-gray-100 text-gray-600";
        }
    };

    // --------------------------------------------------
    // GET COUPONS
    // --------------------------------------------------

    const fetchCoupons = async () => {
        setLoading(true);
        setError("");

        try {
            const token = getToken();

            if (!token) {
                throw new Error(
                    "Authentication token not found. Please log in again."
                );
            }

            const response = await fetch(`${API_URL}/admin/coupons`, {
                method: "GET",
                headers: getHeaders(),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to fetch coupons."
                );
            }

            setCoupons(
                Array.isArray(data.coupons) ? data.coupons : []
            );
        } catch (err) {
            setError(
                err.message || "Something went wrong while loading coupons."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCoupons();
    }, []);

    // --------------------------------------------------
    // FORM INPUT HANDLER
    // --------------------------------------------------

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;

        setFormData((previous) => ({
            ...previous,
            [name]: type === "checkbox" ? checked : value,
        }));
    };

    // --------------------------------------------------
    // CREATE COUPON
    // --------------------------------------------------

    const handleAddCoupon = async (e) => {
        e.preventDefault();

        setError("");
        setSuccess("");

        const code = formData.code.trim().toUpperCase();
        const discountValue = Number(formData.discount_value);
        const minimumCartValue = Number(formData.minimum_cart_value);

        const maximumDiscount =
            formData.maximum_discount === ""
                ? null
                : Number(formData.maximum_discount);

        const usageLimit =
            formData.usage_limit === ""
                ? null
                : Number(formData.usage_limit);

        const userLimit =
            formData.user_limit === ""
                ? null
                : Number(formData.user_limit);

        const perUserLimit =
            formData.per_user_limit === ""
                ? null
                : Number(formData.per_user_limit);

        // Validate coupon code
        if (!code) {
            setError("Please enter a coupon code.");
            return;
        }

        if (!/^[A-Z0-9_-]{1,100}$/.test(code)) {
            setError(
                "Coupon code may contain only letters, numbers, hyphens and underscores."
            );
            return;
        }

        // Validate discount
        if (
            !Number.isFinite(discountValue) ||
            discountValue <= 0 ||
            (
                formData.discount_type === "percentage" &&
                discountValue > 100
            )
        ) {
            setError(
                formData.discount_type === "percentage"
                    ? "Percentage discount must be between 1 and 100."
                    : "Please enter a valid fixed discount amount."
            );
            return;
        }

        // Validate minimum cart value
        if (
            !Number.isFinite(minimumCartValue) ||
            minimumCartValue < 0
        ) {
            setError("Minimum cart value must be zero or more.");
            return;
        }

        // Validate maximum discount
        if (
            maximumDiscount !== null &&
            (
                !Number.isFinite(maximumDiscount) ||
                maximumDiscount < 0
            )
        ) {
            setError("Maximum discount must be zero or more.");
            return;
        }

        // Validate usage limits
        const limits = [
            {
                value: usageLimit,
                label: "Usage limit",
            },
            {
                value: userLimit,
                label: "User limit",
            },
            {
                value: perUserLimit,
                label: "Per-user limit",
            },
        ];

        for (const limit of limits) {
            if (
                limit.value !== null &&
                (
                    !Number.isSafeInteger(limit.value) ||
                    limit.value < 0
                )
            ) {
                setError(
                    `${limit.label} must be a non-negative whole number.`
                );
                return;
            }
        }

        // Validate dates
        if (!formData.start_date || !formData.end_date) {
            setError("Please select both start date and end date.");
            return;
        }

        if (formData.start_date >= formData.end_date) {
            setError("End date must be after start date.");
            return;
        }

        // API payload matches createCoupon controller
        const payload = {
            code,
            discount_type: formData.discount_type,
            discount_value: discountValue,
            minimum_cart_value: minimumCartValue,
            maximum_discount: maximumDiscount,
            start_date: formData.start_date,
            end_date: formData.end_date,
            usage_limit: usageLimit,
            user_limit: userLimit,
            per_user_limit: perUserLimit,
            first_order_only: formData.first_order_only,
            status: formData.status,
        };

        setSaving(true);

        try {
            const response = await fetch(`${API_URL}/admin/coupons`, {
                method: "POST",
                headers: getHeaders(),
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to create coupon."
                );
            }

            setFormData({ ...initialFormData });
            setShowForm(false);

            setSuccess(
                data.message || "Coupon created successfully."
            );

            await fetchCoupons();
        } catch (err) {
            setError(err.message || "Could not create coupon.");
        } finally {
            setSaving(false);
        }
    };

    // --------------------------------------------------
    // OPEN STATUS CONFIRMATION MODAL
    // --------------------------------------------------

    const openStatusModal = (coupon) => {
        setError("");
        setSuccess("");

        setSelectedCoupon(coupon);
        setShowStatusModal(true);
    };

    const closeStatusModal = () => {
        if (updatingId !== null) return;

        setShowStatusModal(false);
        setSelectedCoupon(null);
    };

    // --------------------------------------------------
    // UPDATE COUPON STATUS
    // --------------------------------------------------

    const handleToggleStatus = async () => {
        if (!selectedCoupon) return;

        const coupon = selectedCoupon;

        const currentStatus = String(
            coupon.status || ""
        ).toLowerCase();

        const newStatus =
            currentStatus === "active" ? "inactive" : "active";

        setError("");
        setSuccess("");
        setUpdatingId(coupon.id);

        try {
            const response = await fetch(
                `${API_URL}/admin/coupons/${coupon.id}/status`,
                {
                    method: "PATCH",
                    headers: getHeaders(),
                    body: JSON.stringify({
                        status: newStatus,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to update coupon status."
                );
            }

            setCoupons((previous) =>
                previous.map((item) =>
                    String(item.id) === String(coupon.id)
                        ? {
                              ...item,
                              status: newStatus,
                          }
                        : item
                )
            );

            setSuccess(
                data.message || "Coupon status updated successfully."
            );

            setShowStatusModal(false);
            setSelectedCoupon(null);
        } catch (err) {
            setError(
                err.message || "Could not update coupon status."
            );
        } finally {
            setUpdatingId(null);
        }
    };

    // --------------------------------------------------
    // SEARCH AND FILTER
    // --------------------------------------------------

    const filteredCoupons = coupons.filter((coupon) => {
        const searchMatch = String(coupon.code || "")
            .toLowerCase()
            .includes(search.toLowerCase().trim());

        const displayStatus = getCouponStatus(coupon);

        const statusMatch =
            statusFilter === "All" ||
            displayStatus === statusFilter;

        return searchMatch && statusMatch;
    });
    const totalPages = Math.max(1, Math.ceil(filteredCoupons.length / PAGE_SIZE));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const currentCoupons = filteredCoupons.slice(
        (safeCurrentPage - 1) * PAGE_SIZE,
        safeCurrentPage * PAGE_SIZE
    );

    // --------------------------------------------------
    // SUMMARY COUNTS
    // --------------------------------------------------

    const activeCoupons = coupons.filter(
        (coupon) => getCouponStatus(coupon) === "Active"
    ).length;

    const scheduledCoupons = coupons.filter(
        (coupon) => getCouponStatus(coupon) === "Scheduled"
    ).length;

    const expiredCoupons = coupons.filter(
        (coupon) => getCouponStatus(coupon) === "Expired"
    ).length;

    const inactiveCoupons = coupons.filter(
        (coupon) => getCouponStatus(coupon) === "Inactive"
    ).length;

    const totalUsage = coupons.reduce(
        (total, coupon) => total + Math.max(0, Number(coupon.usage_count) || 0),
        0
    );

    // --------------------------------------------------
    // DISCOUNT HELPERS
    // --------------------------------------------------

    const getDiscountLabel = (coupon) => {
        const type = String(
            coupon.discount_type || ""
        ).toLowerCase();

        const value = Number(coupon.discount_value || 0);

        if (["percentage", "percent", "%"].includes(type)) {
            return `${value}%`;
        }

        return formatCurrency(value);
    };

    const getDiscountTypeLabel = (coupon) => {
        const type = String(
            coupon.discount_type || ""
        ).toLowerCase();

        return ["percentage", "percent", "%"].includes(type)
            ? "Percentage"
            : "Fixed Amount";
    };

    // --------------------------------------------------
    // USAGE LIMIT HELPERS
    // --------------------------------------------------

    const getUsageLimit = (coupon) => {
        if (
            coupon.usage_limit === null ||
            coupon.usage_limit === undefined ||
            coupon.usage_limit === ""
        ) {
            return null;
        }

        return Math.max(0, Number(coupon.usage_limit) || 0);
    };

    const getUsageCount = (coupon) => {
        return Math.max(0, Number(coupon.usage_count) || 0);
    };

    const getUsagePercentage = (coupon) => {
        const limit = getUsageLimit(coupon);
        const used = getUsageCount(coupon);

        if (limit === null || limit === 0) {
            return 0;
        }

        return Math.min(100, Math.round((used / limit) * 100));
    };

    const getUsageBarClass = (coupon) => {
        const limit = getUsageLimit(coupon);
        const percentage = getUsagePercentage(coupon);

        if (limit === 0) {
            return "bg-red-500";
        }

        if (percentage >= 90) {
            return "bg-red-500";
        }

        if (percentage >= 70) {
            return "bg-yellow-500";
        }

        return "bg-ocean-green";
    };

    // Usage count and progress bar
    const renderUsage = (coupon, compact = false) => {
        const limit = getUsageLimit(coupon);
        const used = getUsageCount(coupon);
        const percentage = getUsagePercentage(coupon);

        // Unlimited coupon
        if (limit === null) {
            return (
                <div className={compact ? "min-w-0" : "min-w-[145px]"}>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-cyprus">
                            {used.toLocaleString("en-IN")} used
                        </span>

                        <span className="text-xs font-medium text-text-grey">
                            Unlimited
                        </span>
                    </div>

                    <div
                        className="h-2 w-full overflow-hidden rounded-full bg-gray-100"
                        title={`${used} uses; no total usage limit`}
                    >
                        <div className="h-full w-full rounded-full bg-gray-300" />
                    </div>

                    <p className="mt-1 text-xs text-text-grey">
                        No usage limit
                    </p>
                </div>
            );
        }

        const remaining = Math.max(0, limit - used);

        return (
            <div className={compact ? "min-w-0" : "min-w-[145px]"}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="whitespace-nowrap text-sm font-semibold text-cyprus">
                        {used.toLocaleString("en-IN")} /{" "}
                        {limit.toLocaleString("en-IN")}
                    </span>

                    <span className="text-xs font-semibold text-text-grey">
                        {percentage}%
                    </span>
                </div>

                <div
                    className="h-2 w-full overflow-hidden rounded-full bg-gray-100"
                    role="progressbar"
                    aria-valuenow={Math.min(used, limit)}
                    aria-valuemin={0}
                    aria-valuemax={limit}
                    aria-label={`Coupon ${coupon.code} usage`}
                >
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${getUsageBarClass(
                            coupon
                        )}`}
                        style={{
                            width: `${percentage}%`,
                        }}
                    />
                </div>

                <p className="mt-1 text-xs text-text-grey">
                    {remaining.toLocaleString("en-IN")} remaining
                </p>
            </div>
        );
    };

    // --------------------------------------------------
    // REUSABLE STATUS BUTTON
    // --------------------------------------------------

    const renderStatusButton = (coupon, mobile = false) => {
        const isActive =
            String(coupon.status || "").toLowerCase() === "active";

        const isUpdating = updatingId === coupon.id;

        return (
            <button
                type="button"
                disabled={isUpdating}
                onClick={() => openStatusModal(coupon)}
                title={
                    isActive
                        ? "Deactivate coupon"
                        : "Activate coupon"
                }
                className={`flex ${
                    mobile ? "w-full" : ""
                } items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    isActive
                        ? "bg-red-50 text-red-600 hover:bg-red-100"
                        : "bg-green-50 text-green-700 hover:bg-green-100"
                }`}
            >
                {isUpdating ? (
                    <i className="fa-solid fa-spinner animate-spin" />
                ) : (
                    <i
                        className={`fa-solid ${
                            isActive
                                ? "fa-ban"
                                : "fa-circle-check"
                        }`}
                    />
                )}

                {isActive
                    ? mobile
                        ? "Deactivate Coupon"
                        : "Deactivate"
                    : mobile
                      ? "Activate Coupon"
                      : "Activate"}
            </button>
        );
    };

    // --------------------------------------------------
    // UI
    // --------------------------------------------------

    return (
        <div className="min-h-screen bg-aqua-spring p-4 sm:p-6 lg:p-8">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-cyprus sm:text-3xl">
                        Coupons
                    </h1>

                    <p className="mt-1 text-sm text-text-grey">
                        Create and manage discount coupons
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => {
                        setShowForm((previous) => !previous);
                        setError("");
                        setSuccess("");
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-ocean-green px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                >
                    <i
                        className={`fa-solid ${
                            showForm ? "fa-xmark" : "fa-plus"
                        }`}
                    />

                    {showForm ? "Close Form" : "Add Coupon"}
                </button>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <i className="fa-solid fa-circle-exclamation mt-0.5" />

                    <p className="flex-1">{error}</p>

                    <button
                        type="button"
                        onClick={() => setError("")}
                        className="text-red-500 hover:text-red-700"
                        aria-label="Dismiss error"
                    >
                        <i className="fa-solid fa-xmark" />
                    </button>
                </div>
            )}

            {/* Success Message */}
            {success && (
                <div className="mb-5 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                    <i className="fa-solid fa-circle-check mt-0.5" />

                    <p className="flex-1">{success}</p>

                    <button
                        type="button"
                        onClick={() => setSuccess("")}
                        className="text-green-600 hover:text-green-800"
                        aria-label="Dismiss message"
                    >
                        <i className="fa-solid fa-xmark" />
                    </button>
                </div>
            )}

            {/* Summary Cards */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {/* Total Coupons */}
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-text-grey">
                                Total Coupons
                            </p>

                            <h2 className="mt-2 text-2xl font-bold text-cyprus">
                                {coupons.length}
                            </h2>
                        </div>

                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-aqua-spring text-ocean-green">
                            <i className="fa-solid fa-ticket text-lg" />
                        </div>
                    </div>
                </div>

                {/* Active Coupons */}
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-text-grey">
                                Active Coupons
                            </p>

                            <h2 className="mt-2 text-2xl font-bold text-green-600">
                                {activeCoupons}
                            </h2>
                        </div>

                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-50 text-green-600">
                            <i className="fa-solid fa-circle-check text-lg" />
                        </div>
                    </div>
                </div>

                {/* Scheduled Coupons */}
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-text-grey">
                                Scheduled Coupons
                            </p>

                            <h2 className="mt-2 text-2xl font-bold text-yellow-600">
                                {scheduledCoupons}
                            </h2>
                        </div>

                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-50 text-yellow-600">
                            <i className="fa-solid fa-clock text-lg" />
                        </div>
                    </div>
                </div>

                {/* Usage Summary */}
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-text-grey">
                                Total Coupon Usage
                            </p>

                            <h2 className="mt-2 text-2xl font-bold text-ocean-green">
                                {totalUsage.toLocaleString("en-IN")}
                            </h2>

                            <p className="mt-1 text-xs text-text-grey">
                                {inactiveCoupons} inactive · {expiredCoupons} expired
                            </p>
                        </div>

                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-aqua-spring text-ocean-green">
                            <i className="fa-solid fa-chart-simple text-lg" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Coupon Form */}
            {showForm && (
                <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="mb-5 flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-bold text-cyprus">
                                Add New Coupon
                            </h2>

                            <p className="text-sm text-text-grey">
                                Create a discount coupon for customers
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowForm(false)}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"
                            aria-label="Close form"
                        >
                            <i className="fa-solid fa-xmark" />
                        </button>
                    </div>

                    <form
                        onSubmit={handleAddCoupon}
                        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
                    >
                        {/* Coupon Code */}
                        <div>
                            <label className="mb-2 block text-sm font-medium text-cyprus">
                                Coupon Code *
                            </label>

                            <input
                                type="text"
                                name="code"
                                value={formData.code}
                                onChange={handleChange}
                                placeholder="e.g. SAVE20"
                                maxLength={100}
                                required
                                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm uppercase outline-none focus:border-ocean-green"
                            />
                        </div>

                        {/* Discount Type */}
                        <div>
                            <label className="mb-2 block text-sm font-medium text-cyprus">
                                Discount Type *
                            </label>

                            <select
                                name="discount_type"
                                value={formData.discount_type}
                                onChange={handleChange}
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-ocean-green"
                            >
                                <option value="percentage">
                                    Percentage
                                </option>

                                <option value="fixed">
                                    Fixed Amount
                                </option>
                            </select>
                        </div>

                        {/* Discount Value */}
                        <div>
                            <label className="mb-2 block text-sm font-medium text-cyprus">
                                Discount Value *
                            </label>

                            <input
                                type="number"
                                name="discount_value"
                                value={formData.discount_value}
                                onChange={handleChange}
                                placeholder={
                                    formData.discount_type === "percentage"
                                        ? "e.g. 10"
                                        : "e.g. 500"
                                }
                                min="0.01"
                                max={
                                    formData.discount_type === "percentage"
                                        ? "100"
                                        : undefined
                                }
                                step="0.01"
                                required
                                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-ocean-green"
                            />
                        </div>

                        {/* Minimum Cart Value */}
                        <div>
                            <label className="mb-2 block text-sm font-medium text-cyprus">
                                Minimum Cart Value *
                            </label>

                            <input
                                type="number"
                                name="minimum_cart_value"
                                value={formData.minimum_cart_value}
                                onChange={handleChange}
                                min="0"
                                step="0.01"
                                required
                                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-ocean-green"
                            />
                        </div>

                        {/* Maximum Discount */}
                        <div>
                            <label className="mb-2 block text-sm font-medium text-cyprus">
                                Maximum Discount
                            </label>

                            <input
                                type="number"
                                name="maximum_discount"
                                value={formData.maximum_discount}
                                onChange={handleChange}
                                min="0"
                                step="0.01"
                                placeholder="Optional"
                                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-ocean-green"
                            />
                        </div>

                        {/* Total Usage Limit */}
                        <div>
                            <label className="mb-2 block text-sm font-medium text-cyprus">
                                Total Usage Limit
                            </label>

                            <input
                                type="number"
                                name="usage_limit"
                                value={formData.usage_limit}
                                onChange={handleChange}
                                min="0"
                                step="1"
                                placeholder="Blank = Unlimited"
                                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-ocean-green"
                            />
                        </div>

                        {/* Unique User Limit */}
                        <div>
                            <label className="mb-2 block text-sm font-medium text-cyprus">
                                Unique User Limit
                            </label>

                            <input
                                type="number"
                                name="user_limit"
                                value={formData.user_limit}
                                onChange={handleChange}
                                min="0"
                                step="1"
                                placeholder="Blank = Unlimited"
                                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-ocean-green"
                            />
                        </div>

                        {/* Per User Limit */}
                        <div>
                            <label className="mb-2 block text-sm font-medium text-cyprus">
                                Per User Limit
                            </label>

                            <input
                                type="number"
                                name="per_user_limit"
                                value={formData.per_user_limit}
                                onChange={handleChange}
                                min="0"
                                step="1"
                                placeholder="e.g. 1"
                                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-ocean-green"
                            />
                        </div>

                        {/* Start Date */}
                        <div>
                            <label className="mb-2 block text-sm font-medium text-cyprus">
                                Start Date *
                            </label>

                            <input
                                type="date"
                                name="start_date"
                                value={formData.start_date}
                                onChange={handleChange}
                                required
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-ocean-green"
                            />
                        </div>

                        {/* End Date */}
                        <div>
                            <label className="mb-2 block text-sm font-medium text-cyprus">
                                End Date *
                            </label>

                            <input
                                type="date"
                                name="end_date"
                                value={formData.end_date}
                                onChange={handleChange}
                                min={formData.start_date || undefined}
                                required
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-ocean-green"
                            />
                        </div>

                        {/* Status */}
                        <div>
                            <label className="mb-2 block text-sm font-medium text-cyprus">
                                Status
                            </label>

                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-ocean-green"
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>

                        {/* First Order Only */}
                        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-3">
                            <input
                                type="checkbox"
                                name="first_order_only"
                                checked={formData.first_order_only}
                                onChange={handleChange}
                                className="h-4 w-4 accent-ocean-green"
                            />

                            <span className="text-sm font-medium text-cyprus">
                                First order only
                            </span>
                        </label>

                        {/* Form Buttons */}
                        <div className="flex flex-wrap items-end gap-3 md:col-span-2 xl:col-span-3">
                            <button
                                type="submit"
                                disabled={saving}
                                className="rounded-lg bg-ocean-green px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {saving ? (
                                    <>
                                        <i className="fa-solid fa-spinner mr-2 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-floppy-disk mr-2" />
                                        Save Coupon
                                    </>
                                )}
                            </button>

                            <button
                                type="button"
                                disabled={saving}
                                onClick={() => {
                                    setShowForm(false);
                                    setFormData({ ...initialFormData });
                                }}
                                className="rounded-lg border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-cyprus hover:bg-gray-50 disabled:opacity-60"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Search and Filters */}
            <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="relative">
                        <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-sm text-text-grey" />

                        <input
                            type="text"
                            placeholder="Search coupon code..."
                            value={search}
                            onChange={(e) => {
                                setCurrentPage(1);
                                setSearch(e.target.value);
                            }}
                            className="w-full rounded-lg border border-gray-200 py-3 pl-11 pr-4 text-sm outline-none focus:border-ocean-green"
                        />
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(e) => {
                            setCurrentPage(1);
                            setStatusFilter(e.target.value);
                        }}
                        className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-ocean-green"
                    >
                        <option value="All">All Status</option>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Scheduled">Scheduled</option>
                        <option value="Expired">Expired</option>
                    </select>
                </div>
            </div>

            {/* Loading */}
            {loading ? (
                <div className="rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm">
                    <i className="fa-solid fa-spinner animate-spin text-3xl text-ocean-green" />

                    <p className="mt-4 text-sm text-text-grey">
                        Loading coupons...
                    </p>
                </div>
            ) : (
                <>
                    {/* Desktop Table */}
                    <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:block">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {[
                                            "Coupon",
                                            "Discount",
                                            "Min Cart",
                                            "Usage",
                                            "Start Date",
                                            "Expiry",
                                            "Status",
                                            "Action",
                                        ].map((heading) => (
                                            <th
                                                key={heading}
                                                className={`whitespace-nowrap px-5 py-4 text-left text-xs font-semibold uppercase text-text-grey ${
                                                    heading === "Action"
                                                        ? "text-right"
                                                        : ""
                                                }`}
                                            >
                                                {heading}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-100">
                                    {currentCoupons.map((coupon) => {
                                        const status = getCouponStatus(coupon);

                                        return (
                                            <tr
                                                key={coupon.id}
                                                className="transition hover:bg-gray-50"
                                            >
                                                {/* Coupon */}
                                                <td className="px-5 py-4">
                                                    <p className="font-bold text-cyprus">
                                                        {coupon.code}
                                                    </p>

                                                    <p className="mt-1 text-xs text-text-grey">
                                                        {getDiscountTypeLabel(
                                                            coupon
                                                        )}
                                                    </p>
                                                </td>

                                                {/* Discount */}
                                                <td className="whitespace-nowrap px-5 py-4 font-semibold text-ocean-green">
                                                    <div>
                                                        {getDiscountLabel(
                                                            coupon
                                                        )}
                                                    </div>

                                                    {coupon.maximum_discount !=
                                                        null && (
                                                        <p className="mt-1 text-xs font-normal text-text-grey">
                                                            Max{" "}
                                                            {formatCurrency(
                                                                coupon.maximum_discount
                                                            )}
                                                        </p>
                                                    )}
                                                </td>

                                                {/* Minimum Cart */}
                                                <td className="whitespace-nowrap px-5 py-4 text-sm text-cyprus">
                                                    {formatCurrency(
                                                        coupon.minimum_cart_value
                                                    )}
                                                </td>

                                                {/* Usage Progress Bar */}
                                                <td className="px-5 py-4">
                                                    {renderUsage(coupon)}
                                                </td>

                                                {/* Start Date */}
                                                <td className="whitespace-nowrap px-5 py-4 text-sm text-cyprus">
                                                    {formatDate(
                                                        coupon.start_date
                                                    )}
                                                </td>

                                                {/* Expiry */}
                                                <td className="whitespace-nowrap px-5 py-4 text-sm text-cyprus">
                                                    {formatDate(
                                                        coupon.end_date
                                                    )}
                                                </td>

                                                {/* Status */}
                                                <td className="px-5 py-4">
                                                    <span
                                                        className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                                                            status
                                                        )}`}
                                                    >
                                                        {status}
                                                    </span>
                                                </td>

                                                {/* Action */}
                                                <td className="px-5 py-4">
                                                    <div className="flex justify-end">
                                                        {renderStatusButton(
                                                            coupon
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile and Tablet Cards */}
                    <div className="space-y-4 lg:hidden">
                        {currentCoupons.map((coupon) => {
                            const status = getCouponStatus(coupon);

                            return (
                                <div
                                    key={coupon.id}
                                    className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                                >
                                    {/* Card Header */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <h3 className="break-all font-bold text-cyprus">
                                                {coupon.code}
                                            </h3>

                                            <p className="mt-1 text-xs text-text-grey">
                                                {getDiscountTypeLabel(
                                                    coupon
                                                )}
                                            </p>
                                        </div>

                                        <span
                                            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                                                status
                                            )}`}
                                        >
                                            {status}
                                        </span>
                                    </div>

                                    {/* Coupon Information */}
                                    <div className="mt-5 grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-text-grey">
                                                Discount
                                            </p>

                                            <p className="mt-1 font-bold text-ocean-green">
                                                {getDiscountLabel(coupon)}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs text-text-grey">
                                                Minimum Cart
                                            </p>

                                            <p className="mt-1 font-semibold text-cyprus">
                                                {formatCurrency(
                                                    coupon.minimum_cart_value
                                                )}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs text-text-grey">
                                                Maximum Discount
                                            </p>

                                            <p className="mt-1 font-semibold text-cyprus">
                                                {coupon.maximum_discount == null
                                                    ? "No limit"
                                                    : formatCurrency(
                                                          coupon.maximum_discount
                                                      )}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs text-text-grey">
                                                Per User Limit
                                            </p>

                                            <p className="mt-1 font-semibold text-cyprus">
                                                {coupon.per_user_limit == null
                                                    ? "Unlimited"
                                                    : coupon.per_user_limit}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs text-text-grey">
                                                Start Date
                                            </p>

                                            <p className="mt-1 text-sm font-semibold text-cyprus">
                                                {formatDate(
                                                    coupon.start_date
                                                )}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs text-text-grey">
                                                Expiry Date
                                            </p>

                                            <p className="mt-1 text-sm font-semibold text-cyprus">
                                                {formatDate(coupon.end_date)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Usage Progress Bar */}
                                    <div className="mt-5 rounded-lg bg-gray-50 p-3">
                                        <div className="mb-3 flex items-center gap-2">
                                            <i className="fa-solid fa-chart-simple text-ocean-green" />

                                            <p className="text-sm font-semibold text-cyprus">
                                                Coupon Usage
                                            </p>
                                        </div>

                                        {renderUsage(coupon, true)}
                                    </div>

                                    {/* Status Action */}
                                    <div className="mt-5 border-t border-gray-100 pt-4">
                                        {renderStatusButton(coupon, true)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {filteredCoupons.length > 0 && (
                        <Pagination
                            page={safeCurrentPage}
                            totalPages={totalPages}
                            totalItems={filteredCoupons.length}
                            pageSize={PAGE_SIZE}
                            itemLabel="coupons"
                            onPageChange={setCurrentPage}
                        />
                    )}

                    {/* Empty State */}
                    {filteredCoupons.length === 0 && (
                        <div className="rounded-xl border border-gray-200 bg-white px-4 py-16 text-center shadow-sm">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-aqua-spring text-2xl text-ocean-green">
                                <i className="fa-solid fa-ticket" />
                            </div>

                            <h3 className="mt-4 text-lg font-bold text-cyprus">
                                No Coupons Found
                            </h3>

                            <p className="mt-1 text-sm text-text-grey">
                                {search || statusFilter !== "All"
                                    ? "Try changing your search or filter."
                                    : "No coupons have been added yet. Create your first coupon."}
                            </p>

                            {!search && statusFilter === "All" && (
                                <button
                                    type="button"
                                    onClick={() => setShowForm(true)}
                                    className="mt-5 rounded-lg bg-ocean-green px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
                                >
                                    <i className="fa-solid fa-plus mr-2" />
                                    Add First Coupon
                                </button>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* --------------------------------------------------
                CENTERED STATUS CONFIRMATION MODAL
            -------------------------------------------------- */}
            {showStatusModal && selectedCoupon && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
                    onMouseDown={(e) => {
                        if (
                            e.target === e.currentTarget &&
                            updatingId === null
                        ) {
                            closeStatusModal();
                        }
                    }}
                    onKeyDown={(e) => {
                        if (
                            e.key === "Escape" &&
                            updatingId === null
                        ) {
                            closeStatusModal();
                        }
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="coupon-status-title"
                        className="w-full max-w-md animate-[modalIn_0.2s_ease-out] overflow-hidden rounded-2xl bg-white shadow-2xl"
                    >
                        {/* Modal Header */}
                        <div className="flex items-start gap-4 border-b border-gray-100 p-5 sm:p-6">
                            <div
                                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                                    String(
                                        selectedCoupon.status
                                    ).toLowerCase() === "active"
                                        ? "bg-red-100 text-red-600"
                                        : "bg-green-100 text-green-600"
                                }`}
                            >
                                <i
                                    className={`fa-solid text-xl ${
                                        String(
                                            selectedCoupon.status
                                        ).toLowerCase() === "active"
                                            ? "fa-ban"
                                            : "fa-circle-check"
                                    }`}
                                />
                            </div>

                            <div className="min-w-0 flex-1">
                                <h2
                                    id="coupon-status-title"
                                    className="text-lg font-bold text-cyprus sm:text-xl"
                                >
                                    {String(
                                        selectedCoupon.status
                                    ).toLowerCase() === "active"
                                        ? "Deactivate Coupon?"
                                        : "Activate Coupon?"}
                                </h2>

                                <p className="mt-1 text-sm leading-6 text-text-grey">
                                    {String(
                                        selectedCoupon.status
                                    ).toLowerCase() === "active"
                                        ? "This coupon will no longer be available for new orders."
                                        : "This coupon will become available according to its validity dates and usage limits."}
                                </p>
                            </div>

                            <button
                                type="button"
                                disabled={updatingId !== null}
                                onClick={closeStatusModal}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                                aria-label="Close confirmation"
                            >
                                <i className="fa-solid fa-xmark text-lg" />
                            </button>
                        </div>

                        {/* Coupon Details */}
                        <div className="p-5 sm:p-6">
                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                                <p className="text-xs font-medium uppercase tracking-wide text-text-grey">
                                    Selected Coupon
                                </p>

                                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                                    <span className="break-all text-lg font-bold tracking-wide text-cyprus">
                                        {selectedCoupon.code}
                                    </span>

                                    <span className="rounded-full bg-aqua-spring px-3 py-1 text-sm font-bold text-ocean-green">
                                        {getDiscountLabel(selectedCoupon)}
                                    </span>
                                </div>

                                <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-3">
                                    <span className="text-sm text-text-grey">
                                        Current Status
                                    </span>

                                    <span
                                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                                            getCouponStatus(selectedCoupon)
                                        )}`}
                                    >
                                        {getCouponStatus(selectedCoupon)}
                                    </span>
                                </div>
                            </div>

                            <p className="mt-4 text-sm leading-6 text-text-grey">
                                Are you sure you want to{" "}
                                <span className="font-semibold text-cyprus">
                                    {String(
                                        selectedCoupon.status
                                    ).toLowerCase() === "active"
                                        ? "deactivate"
                                        : "activate"}
                                </span>{" "}
                                this coupon?
                            </p>

                            {/* Modal Buttons */}
                            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    disabled={updatingId !== null}
                                    onClick={closeStatusModal}
                                    className="rounded-lg border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-cyprus transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    disabled={updatingId !== null}
                                    onClick={handleToggleStatus}
                                    className={`rounded-lg px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                        String(
                                            selectedCoupon.status
                                        ).toLowerCase() === "active"
                                            ? "bg-red-600 hover:bg-red-700"
                                            : "bg-ocean-green hover:opacity-90"
                                    }`}
                                >
                                    {updatingId !== null ? (
                                        <>
                                            <i className="fa-solid fa-spinner mr-2 animate-spin" />
                                            Updating...
                                        </>
                                    ) : (
                                        <>
                                            <i
                                                className={`fa-solid ${
                                                    String(
                                                        selectedCoupon.status
                                                    ).toLowerCase() === "active"
                                                        ? "fa-ban"
                                                        : "fa-circle-check"
                                                } mr-2`}
                                            />

                                            {String(
                                                selectedCoupon.status
                                            ).toLowerCase() === "active"
                                                ? "Confirm Deactivate"
                                                : "Confirm Activate"}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Coupons;