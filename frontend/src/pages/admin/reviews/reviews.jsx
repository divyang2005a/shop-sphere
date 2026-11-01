import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

const API_BASE_URL = "http://192.168.1.10:5000/api";
const PRODUCT_REVIEW_LIMIT = 6;
const SITE_REVIEW_LIMIT = 6;

function Reviews() {
    // =========================
    // PRODUCT REVIEW STATES
    // =========================
    const [reviews, setReviews] = useState([]);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [ratingFilter, setRatingFilter] = useState("All");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [actionLoading, setActionLoading] = useState(null);
    const [notice, setNotice] = useState("");

    const [pagination, setPagination] = useState({
        page: 1,
        limit: PRODUCT_REVIEW_LIMIT,
        total: 0,
        total_pages: 0,
    });

    // ============================
    // CUSTOMER SITE REVIEW STATES
    // ============================
    const [siteReviews, setSiteReviews] = useState([]);
    const [siteReviewsLoading, setSiteReviewsLoading] =
        useState(false);
    const [siteReviewsError, setSiteReviewsError] = useState("");
    const [siteReviewsNotice, setSiteReviewsNotice] = useState("");
    const [siteReviewDeleting, setSiteReviewDeleting] = useState(null);
    const [siteReviewPage, setSiteReviewPage] = useState(1);

    const [siteReviewPagination, setSiteReviewPagination] = useState({
        page: 1,
        limit: SITE_REVIEW_LIMIT,
        total: 0,
        total_pages: 1,
    });

    // =========================
    // CENTER POPUP STATE
    // =========================
    const [popup, setPopup] = useState({
        open: false,
        type: "success",
        title: "",
        message: "",
        confirmText: "Confirm",
        cancelText: "Cancel",
        onConfirm: null,
        showCancel: false,
    });

    const [popupLoading, setPopupLoading] = useState(false);

    const closePopup = () => {
        if (popupLoading) return;

        setPopup((previous) => ({
            ...previous,
            open: false,
            onConfirm: null,
            showCancel: false,
        }));
    };

    const showPopup = ({
        type = "success",
        title = "",
        message = "",
        confirmText = "OK",
        cancelText = "Cancel",
        onConfirm = null,
        showCancel = false,
    }) => {
        setPopup({
            open: true,
            type,
            title,
            message,
            confirmText,
            cancelText,
            onConfirm,
            showCancel,
        });
    };

    const showSuccessPopup = (message) => {
        showPopup({
            type: "success",
            title: "Success!",
            message,
            confirmText: "OK",
        });
    };

    const showErrorPopup = (message) => {
        showPopup({
            type: "error",
            title: "Something went wrong!",
            message,
            confirmText: "OK",
        });
    };

    // =========================
    // COMMON FUNCTIONS
    // =========================
    const getToken = () => {
        const token = localStorage.getItem("shopsphereToken");

        if (!token) {
            throw new Error(
                "Authentication token not found. Please log in again."
            );
        }

        return token;
    };

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

    const renderStars = (rating) => {
        const safeRating = Math.min(
            5,
            Math.max(0, Number(rating) || 0)
        );

        return (
            <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <i
                        key={star}
                        className={`fa-solid fa-star text-xs ${
                            star <= safeRating
                                ? "text-yellow-400"
                                : "text-gray-200"
                        }`}
                    />
                ))}

                <span className="ml-1 whitespace-nowrap text-xs text-text-grey">
                    {safeRating}/5
                </span>
            </div>
        );
    };

    // =========================
    // PRODUCT REVIEW HELPERS
    // =========================
    const normalizeStatus = (status) => {
        const value = String(status || "pending").toLowerCase();

        if (value === "approved") return "Approved";
        if (value === "rejected") return "Rejected";

        return "Pending";
    };

    const normalizeReview = (review) => {
        const rawCustomer =
            review.reviewer_name ||
            review.customer?.name ||
            review.customer?.full_name ||
            review.user?.name ||
            review.user?.full_name ||
            review.user_name ||
            review.customer_name ||
            review.full_name ||
            review.name ||
            (typeof review.customer === "string"
                ? review.customer
                : "") ||
            (typeof review.user === "string"
                ? review.user
                : "");

        const customer =
            typeof rawCustomer === "string"
                ? rawCustomer.trim()
                : "";

        const product =
            review.product?.name ||
            review.product?.product_name ||
            review.product_name ||
            review.product_title ||
            (typeof review.product === "string"
                ? review.product
                : "") ||
            "Product";

        const rawRating =
            review.rating ??
            review.stars ??
            review.review_rating ??
            0;

        const rating = Math.min(
            5,
            Math.max(0, Number(rawRating) || 0)
        );

        return {
            ...review,

            id: review.id ?? review.review_id ?? review.reviewId,

            customer: customer || "Customer",

            product:
                typeof product === "object"
                    ? product.name ||
                      product.product_name ||
                      "Product"
                    : String(product),

            rating,

            comment:
                review.comment ||
                review.review ||
                review.review_text ||
                review.description ||
                "",

            date:
                review.created_at ||
                review.createdAt ||
                review.review_date ||
                review.date ||
                "",

            status: normalizeStatus(review.status),
        };
    };

    const getStatusStyle = (status) => {
        if (status === "Approved") {
            return "bg-green-100 text-green-700";
        }

        if (status === "Rejected") {
            return "bg-red-100 text-red-700";
        }

        return "bg-yellow-100 text-yellow-700";
    };

    // =========================
    // FETCH PRODUCT REVIEWS
    // =========================
    const fetchReviews = useCallback(
        async (page = 1, status = statusFilter) => {
            setLoading(true);
            setError("");

            try {
                const token = getToken();

                const params = new URLSearchParams({
                    page: String(page),
                    limit: String(PRODUCT_REVIEW_LIMIT),
                    status:
                        status === "All"
                            ? "all"
                            : status.toLowerCase(),
                });

                const response = await fetch(
                    `${API_BASE_URL}/reviews/admin?${params.toString()}`,
                    {
                        method: "GET",
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "application/json",
                        },
                    }
                );

                const result = await response
                    .json()
                    .catch(() => ({}));

                if (!response.ok || result.success === false) {
                    throw new Error(
                        result.message ||
                            "Failed to fetch product reviews."
                    );
                }

                const data = result.data || {};

                const list = Array.isArray(data.reviews)
                    ? data.reviews
                    : Array.isArray(data)
                      ? data
                      : [];

                const normalizedReviews = list.map(normalizeReview);

                setReviews(normalizedReviews);

                setPagination({
                    page: Number(data.pagination?.page) || page,
                    limit:
                        Number(data.pagination?.limit) ||
                        PRODUCT_REVIEW_LIMIT,
                    total:
                        data.pagination?.total != null
                            ? Number(data.pagination.total)
                            : normalizedReviews.length,
                    total_pages:
                        Number(data.pagination?.total_pages) || 0,
                });
            } catch (err) {
                setReviews([]);

                setError(
                    err.message ||
                        "Something went wrong while loading product reviews."
                );
            } finally {
                setLoading(false);
            }
        },
        [statusFilter]
    );

    useEffect(() => {
        fetchReviews(1, statusFilter);
    }, [fetchReviews, statusFilter]);

    // =========================
    // APPROVE / REJECT PRODUCT REVIEW
    // =========================
    const updateStatus = async (id, status) => {
        if (!id) {
            showErrorPopup("Review ID is missing.");
            return;
        }

        const apiStatus = status.toLowerCase();

        if (!["approved", "rejected"].includes(apiStatus)) {
            showErrorPopup(
                "Status must be approved or rejected."
            );
            return;
        }

        setActionLoading(`${id}-${apiStatus}`);
        setError("");
        setNotice("");

        try {
            const token = getToken();

            const response = await fetch(
                `${API_BASE_URL}/reviews/admin/${id}/status`,
                {
                    method: "PATCH",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        status: apiStatus,
                    }),
                }
            );

            const result = await response
                .json()
                .catch(() => ({}));

            if (!response.ok || result.success === false) {
                throw new Error(
                    result.message ||
                        "Failed to update review status."
                );
            }

            setNotice(
                `Product review ${apiStatus} successfully.`
            );

            await fetchReviews(pagination.page, statusFilter);

            showSuccessPopup(
                `Product review ${apiStatus} successfully.`
            );
        } catch (err) {
            showErrorPopup(
                err.message || "Failed to update product review."
            );
        } finally {
            setActionLoading(null);
        }
    };

    // =========================
    // CONFIRM DELETE PRODUCT REVIEW
    // =========================
    const deleteReview = (id) => {
        if (!id) {
            showErrorPopup(
                "Review ID is missing. Cannot delete this review."
            );
            return;
        }

        showPopup({
            type: "confirm",
            title: "Delete Product Review?",
            message:
                "Are you sure you want to delete this product review? This action cannot be undone.",
            confirmText: "Yes, Delete",
            cancelText: "Cancel",
            showCancel: true,
            onConfirm: async () => {
                setPopupLoading(true);
                setActionLoading(`${id}-delete`);
                setError("");
                setNotice("");

                try {
                    const token = getToken();

                    const response = await fetch(
                        `${API_BASE_URL}/admin/reviews/${id}`,
                        {
                            method: "DELETE",
                            headers: {
                                Authorization: `Bearer ${token}`,
                                "Content-Type": "application/json",
                            },
                        }
                    );

                    const result = await response
                        .json()
                        .catch(() => ({}));

                    if (
                        !response.ok ||
                        result.success === false
                    ) {
                        throw new Error(
                            result.message ||
                                "Failed to delete product review."
                        );
                    }

                    setNotice(
                        "Product review deleted successfully."
                    );

                    const nextPage =
                        reviews.length === 1 &&
                        pagination.page > 1
                            ? pagination.page - 1
                            : pagination.page;

                    setPopupLoading(false);
                    setPopup((previous) => ({
                        ...previous,
                        open: false,
                    }));

                    await fetchReviews(nextPage, statusFilter);

                    showSuccessPopup(
                        "Product review deleted successfully."
                    );
                } catch (err) {
                    setPopupLoading(false);

                    showErrorPopup(
                        err.message ||
                            "Failed to delete product review."
                    );
                } finally {
                    setActionLoading(null);
                }
            },
        });
    };

    // =========================
    // PRODUCT REVIEW SEARCH / FILTER
    // =========================
    const filteredReviews = useMemo(() => {
        const term = search.trim().toLowerCase();

        return reviews.filter((review) => {
            const matchesSearch =
                String(review.customer || "")
                    .toLowerCase()
                    .includes(term) ||
                String(review.product || "")
                    .toLowerCase()
                    .includes(term) ||
                String(review.comment || "")
                    .toLowerCase()
                    .includes(term);

            const matchesStatus =
                statusFilter === "All" ||
                review.status === statusFilter;

            const matchesRating =
                ratingFilter === "All" ||
                review.rating === Number(ratingFilter);

            return (
                matchesSearch &&
                matchesStatus &&
                matchesRating
            );
        });
    }, [reviews, search, statusFilter, ratingFilter]);

    const approvedCount = reviews.filter(
        (review) => review.status === "Approved"
    ).length;

    const rejectedCount = reviews.filter(
        (review) => review.status === "Rejected"
    ).length;

    const pendingCount = reviews.filter(
        (review) => review.status === "Pending"
    ).length;

    const changeStatusFilter = (value) => {
        setStatusFilter(value);
        setPagination((previous) => ({
            ...previous,
            page: 1,
        }));
    };

    // =========================
    // FETCH CUSTOMER SITE REVIEWS
    // =========================
    const fetchSiteReviews = useCallback(async (page = 1) => {
        setSiteReviewsLoading(true);
        setSiteReviewsError("");

        try {
            const token = getToken();

            const params = new URLSearchParams({
                page: String(page),
                limit: String(SITE_REVIEW_LIMIT),
            });

            const response = await fetch(
                `${API_BASE_URL}/reviews/site?${params.toString()}`,
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            const result = await response
                .json()
                .catch(() => ({}));

            if (!response.ok || result.success === false) {
                throw new Error(
                    result.message ||
                        "Failed to load customer site reviews."
                );
            }

            const data = result.data || {};

            const list = Array.isArray(data.reviews)
                ? data.reviews
                : [];

            const totalPages = Math.max(
                1,
                Number(data.pagination?.total_pages) || 1
            );

            setSiteReviews(list);

            setSiteReviewPagination({
                page: Number(data.pagination?.page) || page,
                limit:
                    Number(data.pagination?.limit) ||
                    SITE_REVIEW_LIMIT,
                total:
                    data.pagination?.total != null
                        ? Number(data.pagination.total)
                        : 0,
                total_pages: totalPages,
            });
        } catch (err) {
            setSiteReviews([]);

            setSiteReviewsError(
                err.message ||
                    "Failed to load customer site reviews."
            );
        } finally {
            setSiteReviewsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSiteReviews(siteReviewPage);
    }, [fetchSiteReviews, siteReviewPage]);

    // =========================
    // CONFIRM DELETE CUSTOMER SITE REVIEW
    // =========================
    const deleteSiteReview = (reviewId) => {
        if (!reviewId) {
            showErrorPopup("Site review ID is missing.");
            return;
        }

        showPopup({
            type: "confirm",
            title: "Delete Customer Review?",
            message:
                "Are you sure you want to delete this customer site review? This action cannot be undone.",
            confirmText: "Yes, Delete",
            cancelText: "Cancel",
            showCancel: true,
            onConfirm: async () => {
                setPopupLoading(true);
                setSiteReviewDeleting(reviewId);
                setSiteReviewsError("");
                setSiteReviewsNotice("");

                try {
                    const token = getToken();

                    const response = await fetch(
                        `${API_BASE_URL}/admin/site-reviews/${reviewId}`,
                        {
                            method: "DELETE",
                            headers: {
                                Authorization: `Bearer ${token}`,
                                "Content-Type": "application/json",
                            },
                        }
                    );

                    const result = await response
                        .json()
                        .catch(() => ({}));

                    if (
                        !response.ok ||
                        result.success === false
                    ) {
                        throw new Error(
                            result.message ||
                                "Failed to delete customer site review."
                        );
                    }

                    setSiteReviewsNotice(
                        "Customer site review deleted successfully."
                    );

                    const nextPage =
                        siteReviews.length === 1 &&
                        siteReviewPage > 1
                            ? siteReviewPage - 1
                            : siteReviewPage;

                    setPopupLoading(false);
                    setPopup((previous) => ({
                        ...previous,
                        open: false,
                    }));

                    setSiteReviewPage(nextPage);
                    await fetchSiteReviews(nextPage);

                    showSuccessPopup(
                        "Customer site review deleted successfully."
                    );
                } catch (err) {
                    setPopupLoading(false);

                    showErrorPopup(
                        err.message ||
                            "Failed to delete customer site review."
                    );
                } finally {
                    setSiteReviewDeleting(null);
                }
            },
        });
    };

    // =========================
    // MAIN UI
    // =========================
    return (
        <div className="min-h-screen bg-aqua-spring p-4 sm:p-6 lg:p-8">
            {/* =========================
                CENTER POPUP
            ========================= */}
            {popup.open && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                    onMouseDown={(event) => {
                        if (
                            event.target === event.currentTarget &&
                            !popupLoading
                        ) {
                            closePopup();
                        }
                    }}
                    role="presentation"
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="review-popup-title"
                        className="w-full max-w-md animate-[popupIn_0.2s_ease-out] overflow-hidden rounded-2xl bg-white shadow-2xl"
                    >
                        <div className="p-6 text-center sm:p-8">
                            <div
                                className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
                                    popup.type === "success"
                                        ? "bg-green-100 text-green-600"
                                        : popup.type === "error"
                                          ? "bg-red-100 text-red-600"
                                          : popup.type === "confirm"
                                            ? "bg-orange-100 text-orange-600"
                                            : "bg-blue-100 text-blue-600"
                                }`}
                            >
                                <i
                                    className={`fa-solid text-2xl ${
                                        popup.type === "success"
                                            ? "fa-circle-check"
                                            : popup.type === "error"
                                              ? "fa-circle-exclamation"
                                              : popup.type === "confirm"
                                                ? "fa-trash-can"
                                                : "fa-circle-info"
                                    }`}
                                />
                            </div>

                            <h2
                                id="review-popup-title"
                                className="mt-5 text-xl font-bold text-cyprus"
                            >
                                {popup.title}
                            </h2>

                            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-gray-600">
                                {popup.message}
                            </p>

                            <div className="mt-7 flex flex-col-reverse justify-center gap-3 sm:flex-row">
                                {popup.showCancel && (
                                    <button
                                        type="button"
                                        onClick={closePopup}
                                        disabled={popupLoading}
                                        className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        {popup.cancelText}
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (popup.onConfirm) {
                                            await popup.onConfirm();
                                        } else {
                                            closePopup();
                                        }
                                    }}
                                    disabled={popupLoading}
                                    className={`rounded-xl px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                        popup.type === "error"
                                            ? "bg-red-600 hover:bg-red-700"
                                            : popup.type === "confirm"
                                              ? "bg-red-600 hover:bg-red-700"
                                              : "bg-cyprus hover:opacity-90"
                                    }`}
                                >
                                    {popupLoading ? (
                                        <>
                                            <i className="fa-solid fa-spinner mr-2 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        popup.confirmText
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PAGE HEADER */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-cyprus sm:text-3xl">
                        Product Reviews
                    </h1>

                    <p className="mt-1 text-sm text-text-grey">
                        Review customer feedback and manage review approvals.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => {
                        fetchReviews(pagination.page, statusFilter);
                        fetchSiteReviews(siteReviewPage);
                    }}
                    disabled={loading || siteReviewsLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyprus px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <i
                        className={`fa-solid fa-rotate-right ${
                            loading || siteReviewsLoading
                                ? "animate-spin"
                                : ""
                        }`}
                    />
                    Refresh All
                </button>
            </div>

            {/* PRODUCT REVIEW NOTIFICATIONS */}
            {error && (
                <div
                    role="alert"
                    className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                >
                    <i className="fa-solid fa-circle-exclamation mt-0.5" />

                    <div className="flex-1">{error}</div>

                    <button
                        type="button"
                        onClick={() => setError("")}
                        aria-label="Dismiss error"
                    >
                        <i className="fa-solid fa-xmark" />
                    </button>
                </div>
            )}

            {notice && (
                <div
                    role="status"
                    className="mb-5 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700"
                >
                    <i className="fa-solid fa-circle-check" />
                    {notice}
                </div>
            )}

            {/* PRODUCT REVIEW STATISTICS */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl bg-white p-5 shadow-sm">
                    <p className="text-sm text-text-grey">Total Reviews</p>
                    <h2 className="mt-2 text-3xl font-bold text-cyprus">
                        {pagination.total}
                    </h2>
                </div>

                <div className="rounded-xl bg-white p-5 shadow-sm">
                    <p className="text-sm text-text-grey">Pending Reviews</p>
                    <h2 className="mt-2 text-3xl font-bold text-yellow-600">
                        {pendingCount}
                    </h2>
                </div>

                <div className="rounded-xl bg-white p-5 shadow-sm">
                    <p className="text-sm text-text-grey">Approved Reviews</p>
                    <h2 className="mt-2 text-3xl font-bold text-success">
                        {approvedCount}
                    </h2>
                </div>

                <div className="rounded-xl bg-white p-5 shadow-sm">
                    <p className="text-sm text-text-grey">Rejected Reviews</p>
                    <h2 className="mt-2 text-3xl font-bold text-error">
                        {rejectedCount}
                    </h2>
                </div>
            </div>

            {/* PRODUCT REVIEW SEARCH AND FILTERS */}
            <div className="mb-5 flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm lg:flex-row">
                <div className="relative flex-1">
                    <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-text-grey" />

                    <input
                        value={search}
                        onChange={(event) =>
                            setSearch(event.target.value)
                        }
                        placeholder="Search customer, product or comment..."
                        className="w-full rounded-lg border border-gray-200 py-3 pl-11 pr-4 outline-none focus:border-brand-primary"
                    />
                </div>

                <select
                    value={statusFilter}
                    onChange={(event) =>
                        changeStatusFilter(event.target.value)
                    }
                    className="rounded-lg border border-gray-200 bg-white px-4 py-3 outline-none focus:border-brand-primary"
                    aria-label="Filter by review status"
                >
                    <option value="All">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                </select>

                <select
                    value={ratingFilter}
                    onChange={(event) =>
                        setRatingFilter(event.target.value)
                    }
                    className="rounded-lg border border-gray-200 bg-white px-4 py-3 outline-none focus:border-brand-primary"
                    aria-label="Filter by rating"
                >
                    <option value="All">All Ratings</option>
                    <option value="5">5 Stars</option>
                    <option value="4">4 Stars</option>
                    <option value="3">3 Stars</option>
                    <option value="2">2 Stars</option>
                    <option value="1">1 Star</option>
                </select>
            </div>

            {/* PRODUCT REVIEW LIST */}
            {loading ? (
                <div className="rounded-xl bg-white px-4 py-14 text-center shadow-sm">
                    <i className="fa-solid fa-spinner animate-spin text-3xl text-cyprus" />

                    <p className="mt-3 text-sm text-text-grey">
                        Loading product reviews...
                    </p>
                </div>
            ) : (
                <>
                    {/* DESKTOP PRODUCT REVIEW TABLE */}
                    <div className="hidden overflow-hidden rounded-xl bg-white shadow-sm lg:block">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-text-grey">
                                    <tr>
                                        <th className="px-5 py-4">Customer</th>
                                        <th className="px-5 py-4">Product</th>
                                        <th className="px-5 py-4">Rating</th>
                                        <th className="px-5 py-4">Comment</th>
                                        <th className="px-5 py-4">Date</th>
                                        <th className="px-5 py-4">Status</th>
                                        <th className="px-5 py-4">Actions</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-100">
                                    {filteredReviews.map((review) => (
                                        <tr
                                            key={review.id}
                                            className="transition hover:bg-gray-50"
                                        >
                                            <td className="px-5 py-4 font-semibold text-cyprus">
                                                {review.customer}
                                            </td>

                                            <td className="px-5 py-4 text-cyprus">
                                                {review.product}
                                            </td>

                                            <td className="px-5 py-4">
                                                {renderStars(review.rating)}
                                            </td>

                                            <td className="max-w-xs px-5 py-4 text-text-grey">
                                                <p className="line-clamp-3">
                                                    {review.comment || "—"}
                                                </p>
                                            </td>

                                            <td className="whitespace-nowrap px-5 py-4 text-text-grey">
                                                {formatDate(review.date)}
                                            </td>

                                            <td className="px-5 py-4">
                                                <span
                                                    className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(review.status)}`}
                                                >
                                                    {review.status}
                                                </span>
                                            </td>

                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2">
                                                    {review.status !== "Approved" && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                updateStatus(
                                                                    review.id,
                                                                    "Approved"
                                                                )
                                                            }
                                                            disabled={actionLoading !== null}
                                                            title="Approve review"
                                                            aria-label="Approve review"
                                                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-success hover:bg-green-100 disabled:opacity-50"
                                                        >
                                                            <i className="fa-solid fa-check" />
                                                        </button>
                                                    )}

                                                    {review.status !== "Rejected" && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                updateStatus(
                                                                    review.id,
                                                                    "Rejected"
                                                                )
                                                            }
                                                            disabled={actionLoading !== null}
                                                            title="Reject review"
                                                            aria-label="Reject review"
                                                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-error hover:bg-red-100 disabled:opacity-50"
                                                        >
                                                            <i className="fa-solid fa-xmark" />
                                                        </button>
                                                    )}

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            deleteReview(review.id)
                                                        }
                                                        disabled={actionLoading !== null}
                                                        title="Delete review"
                                                        aria-label="Delete review"
                                                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50"
                                                    >
                                                        <i className="fa-regular fa-trash-can" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* MOBILE PRODUCT REVIEW CARDS */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:hidden">
                        {filteredReviews.map((review) => (
                            <div
                                key={review.id}
                                className="rounded-xl bg-white p-5 shadow-sm"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h3 className="break-words font-bold text-cyprus">
                                            {review.customer}
                                        </h3>

                                        <p className="mt-1 break-words text-sm text-text-grey">
                                            {review.product}
                                        </p>
                                    </div>

                                    <span
                                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(review.status)}`}
                                    >
                                        {review.status}
                                    </span>
                                </div>

                                <div className="mt-3">
                                    {renderStars(review.rating)}
                                </div>

                                <p className="mt-3 break-words text-sm leading-6 text-text-grey">
                                    {review.comment || "No comment provided."}
                                </p>

                                <p className="mt-3 text-xs text-text-grey">
                                    <i className="fa-regular fa-calendar mr-2" />
                                    {formatDate(review.date)}
                                </p>

                                <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                                    {review.status !== "Approved" && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                updateStatus(
                                                    review.id,
                                                    "Approved"
                                                )
                                            }
                                            disabled={actionLoading !== null}
                                            className="rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-success disabled:opacity-50"
                                        >
                                            <i className="fa-solid fa-check mr-1" />
                                            Approve
                                        </button>
                                    )}

                                    {review.status !== "Rejected" && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                updateStatus(
                                                    review.id,
                                                    "Rejected"
                                                )
                                            }
                                            disabled={actionLoading !== null}
                                            className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-error disabled:opacity-50"
                                        >
                                            <i className="fa-solid fa-xmark mr-1" />
                                            Reject
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() =>
                                            deleteReview(review.id)
                                        }
                                        disabled={actionLoading !== null}
                                        className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600 disabled:opacity-50"
                                    >
                                        <i className="fa-regular fa-trash-can mr-1" />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* PRODUCT REVIEW EMPTY STATE */}
                    {filteredReviews.length === 0 && (
                        <div className="rounded-xl bg-white px-4 py-12 text-center shadow-sm">
                            <i className="fa-regular fa-star text-4xl text-gray-300" />

                            <h3 className="mt-4 font-semibold text-cyprus">
                                No product reviews found
                            </h3>

                            <p className="mt-1 text-sm text-text-grey">
                                Try changing the search or filters.
                            </p>
                        </div>
                    )}

                    {/* PRODUCT REVIEW PAGINATION */}
                    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-text-grey">
                            Showing {filteredReviews.length} of{" "}
                            {pagination.total} product reviews
                        </p>

                        <div className="flex items-center justify-center gap-3">
                            <button
                                type="button"
                                disabled={
                                    loading ||
                                    pagination.page <= 1
                                }
                                onClick={() =>
                                    fetchReviews(
                                        pagination.page - 1,
                                        statusFilter
                                    )
                                }
                                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-cyprus hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <i className="fa-solid fa-chevron-left mr-2" />
                                Previous
                            </button>

                            <span className="text-sm text-text-grey">
                                Page {pagination.page}
                                {pagination.total_pages > 0
                                    ? ` of ${pagination.total_pages}`
                                    : ""}
                            </span>

                            <button
                                type="button"
                                disabled={
                                    loading ||
                                    pagination.total_pages === 0 ||
                                    pagination.page >=
                                        pagination.total_pages
                                }
                                onClick={() =>
                                    fetchReviews(
                                        pagination.page + 1,
                                        statusFilter
                                    )
                                }
                                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-cyprus hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Next
                                <i className="fa-solid fa-chevron-right ml-2" />
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* =================================================
                CUSTOMER SITE REVIEWS SECTION
            ================================================= */}
            <section className="mt-8 overflow-hidden rounded-xl bg-white shadow-sm">
                {/* SITE REVIEW HEADER */}
                <div className="flex flex-col gap-3 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-aqua-spring text-cyprus">
                            <i className="fa-solid fa-comments text-lg" />
                        </div>

                        <div>
                            <h2 className="text-lg font-bold text-cyprus sm:text-xl">
                                Customer Site Reviews
                            </h2>

                            <p className="mt-1 text-sm text-text-grey">
                                Manage reviews submitted on the homepage.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() =>
                            fetchSiteReviews(siteReviewPage)
                        }
                        disabled={siteReviewsLoading}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyprus px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <i
                            className={`fa-solid fa-rotate-right ${
                                siteReviewsLoading
                                    ? "animate-spin"
                                    : ""
                            }`}
                        />
                        Refresh
                    </button>
                </div>

                {/* SITE REVIEW NOTIFICATIONS */}
                <div className="px-5">
                    {siteReviewsError && (
                        <div
                            role="alert"
                            className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                        >
                            <i className="fa-solid fa-circle-exclamation mt-0.5" />

                            <span className="flex-1">
                                {siteReviewsError}
                            </span>

                            <button
                                type="button"
                                onClick={() =>
                                    setSiteReviewsError("")
                                }
                                aria-label="Dismiss error"
                            >
                                <i className="fa-solid fa-xmark" />
                            </button>
                        </div>
                    )}

                    {siteReviewsNotice && (
                        <div
                            role="status"
                            className="mt-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700"
                        >
                            <i className="fa-solid fa-circle-check" />
                            {siteReviewsNotice}
                        </div>
                    )}
                </div>

                {/* SITE REVIEW COUNT */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
                    <p className="text-sm text-text-grey">
                        Total Customer Reviews:{" "}
                        <span className="font-bold text-cyprus">
                            {siteReviewPagination.total}
                        </span>
                    </p>

                    <span className="rounded-full bg-aqua-spring px-3 py-1 text-xs font-semibold text-cyprus">
                        Page {siteReviewPage} of{" "}
                        {siteReviewPagination.total_pages}
                    </span>
                </div>

                {/* SITE REVIEW LOADING / EMPTY / LIST */}
                {siteReviewsLoading ? (
                    <div className="px-4 py-12 text-center">
                        <i className="fa-solid fa-spinner animate-spin text-2xl text-cyprus" />

                        <p className="mt-3 text-sm text-text-grey">
                            Loading customer site reviews...
                        </p>
                    </div>
                ) : siteReviews.length === 0 ? (
                    <div className="px-4 py-12 text-center">
                        <i className="fa-regular fa-comments text-4xl text-gray-300" />

                        <h3 className="mt-3 font-semibold text-cyprus">
                            No customer site reviews
                        </h3>

                        <p className="mt-1 text-sm text-text-grey">
                            Reviews submitted on the homepage will appear here.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* DESKTOP SITE REVIEW TABLE */}
                        <div className="hidden overflow-x-auto lg:block">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-text-grey">
                                    <tr>
                                        <th className="px-5 py-4">Customer</th>
                                        <th className="px-5 py-4">Rating</th>
                                        <th className="px-5 py-4">Review</th>
                                        <th className="px-5 py-4">Date</th>
                                        <th className="px-5 py-4 text-center">
                                            Action
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-100">
                                    {siteReviews.map((review) => (
                                        <tr
                                            key={review.id}
                                            className="transition hover:bg-gray-50"
                                        >
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-aqua-spring font-bold text-cyprus">
                                                        {(
                                                            review.reviewer_name ||
                                                            "C"
                                                        )
                                                            .charAt(0)
                                                            .toUpperCase()}
                                                    </div>

                                                    <span className="font-semibold text-cyprus">
                                                        {review.reviewer_name ||
                                                            "Customer"}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="whitespace-nowrap px-5 py-4">
                                                {renderStars(review.rating)}
                                            </td>

                                            <td className="max-w-md px-5 py-4 text-text-grey">
                                                <p className="whitespace-pre-wrap break-words">
                                                    {review.review || "—"}
                                                </p>
                                            </td>

                                            <td className="whitespace-nowrap px-5 py-4 text-text-grey">
                                                {formatDate(review.created_at)}
                                            </td>

                                            <td className="px-5 py-4 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        deleteSiteReview(
                                                            review.id
                                                        )
                                                    }
                                                    disabled={
                                                        siteReviewDeleting !== null
                                                    }
                                                    title="Delete customer review"
                                                    aria-label="Delete customer review"
                                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    {siteReviewDeleting ===
                                                    review.id ? (
                                                        <i className="fa-solid fa-spinner animate-spin" />
                                                    ) : (
                                                        <i className="fa-regular fa-trash-can" />
                                                    )}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* MOBILE / TABLET SITE REVIEW CARDS */}
                        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:hidden">
                            {siteReviews.map((review) => (
                                <article
                                    key={review.id}
                                    className="rounded-xl border border-gray-100 p-4 transition hover:border-ocean-green/30 hover:shadow-sm"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-aqua-spring font-bold text-cyprus">
                                            {(
                                                review.reviewer_name || "C"
                                            )
                                                .charAt(0)
                                                .toUpperCase()}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <h3 className="break-words font-bold text-cyprus">
                                                {review.reviewer_name ||
                                                    "Customer"}
                                            </h3>

                                            <p className="mt-1 text-xs text-text-grey">
                                                {formatDate(review.created_at)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-3">
                                        {renderStars(review.rating)}
                                    </div>

                                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-text-grey">
                                        {review.review ||
                                            "No comment provided."}
                                    </p>

                                    <div className="mt-4 border-t border-gray-100 pt-3">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                deleteSiteReview(
                                                    review.id
                                                )
                                            }
                                            disabled={
                                                siteReviewDeleting !== null
                                            }
                                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                                        >
                                            {siteReviewDeleting ===
                                            review.id ? (
                                                <i className="fa-solid fa-spinner animate-spin" />
                                            ) : (
                                                <i className="fa-regular fa-trash-can" />
                                            )}

                                            Delete Review
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>

                        {/* SITE REVIEW PAGINATION */}
                        <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                            <p className="text-center text-xs text-text-grey sm:text-left">
                                Showing {siteReviews.length} of{" "}
                                {siteReviewPagination.total} customer reviews
                            </p>

                            <div className="flex items-center justify-center gap-3">
                                <button
                                    type="button"
                                    disabled={
                                        siteReviewsLoading ||
                                        siteReviewPage <= 1
                                    }
                                    onClick={() =>
                                        setSiteReviewPage((previous) =>
                                            Math.max(1, previous - 1)
                                        )
                                    }
                                    className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-cyprus transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <i className="fa-solid fa-chevron-left mr-2" />
                                    Previous
                                </button>

                                <span className="whitespace-nowrap text-xs font-semibold text-cyprus">
                                    {siteReviewPage} /{" "}
                                    {siteReviewPagination.total_pages}
                                </span>

                                <button
                                    type="button"
                                    disabled={
                                        siteReviewsLoading ||
                                        siteReviewPage >=
                                            siteReviewPagination.total_pages
                                    }
                                    onClick={() =>
                                        setSiteReviewPage((previous) =>
                                            Math.min(
                                                siteReviewPagination.total_pages,
                                                previous + 1
                                            )
                                        )
                                    }
                                    className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-cyprus transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Next
                                    <i className="fa-solid fa-chevron-right ml-2" />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}

export default Reviews;