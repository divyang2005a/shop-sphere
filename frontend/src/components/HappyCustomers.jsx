import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = "http://192.168.1.10:5000/api";

function HappyCustomers() {
    const navigate = useNavigate();

    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [showModal, setShowModal] = useState(false);
    const [modalReviews, setModalReviews] = useState([]);
    const [modalLoading, setModalLoading] = useState(false);

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const [rating, setRating] = useState(5);
    const [reviewText, setReviewText] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [formError, setFormError] = useState("");

    const [showReviewForm, setShowReviewForm] = useState(false);

    const token = localStorage.getItem("shopsphereToken");

    // Fetch reviews from backend
    const fetchReviews = async (currentPage = 1, isModal = false) => {
        try {
            if (isModal) {
                setModalLoading(true);
            } else {
                setLoading(true);
            }

            setError("");

            const response = await fetch(
                `${API_URL}/reviews/site?page=${currentPage}&limit=6`
            );

            const result = await response.json();

            if (!response.ok || result.success === false) {
                throw new Error(
                    result.message || "Unable to load customer reviews."
                );
            }

            const fetchedReviews = result.data?.reviews || [];

            // Latest reviews first
            const sortedReviews = [...fetchedReviews].sort((a, b) => {
                const dateDifference =
                    new Date(b.created_at || 0) -
                    new Date(a.created_at || 0);

                if (dateDifference !== 0) {
                    return dateDifference;
                }

                return Number(b.id || 0) - Number(a.id || 0);
            });

            if (isModal) {
                setModalReviews(sortedReviews);
                setTotalPages(
                    Math.max(
                        1,
                        Number(result.data?.pagination?.total_pages || 1)
                    )
                );
            } else {
                setReviews(sortedReviews);
            }
        } catch (err) {
            if (isModal) {
                setFormError(err.message || "Unable to load reviews.");
            } else {
                setError(err.message || "Unable to load customer reviews.");
            }
        } finally {
            setLoading(false);
            setModalLoading(false);
        }
    };

    // Load latest reviews on homepage
    useEffect(() => {
        fetchReviews(1, false);
    }, []);

    // Load reviews for selected modal page
    useEffect(() => {
        if (showModal) {
            fetchReviews(page, true);
        }
    }, [showModal, page]);

    // Open review popup
    const handleGetStarted = () => {
        setShowModal(true);
        setPage(1);
        setShowReviewForm(false);
        setSuccessMessage("");
        setFormError("");
    };

    // Close review popup
    const closeModal = () => {
        setShowModal(false);
        setShowReviewForm(false);
        setReviewText("");
        setRating(5);
        setSuccessMessage("");
        setFormError("");
    };

    // Submit a new site review
    const handleSubmitReview = async (event) => {
        event.preventDefault();

        setFormError("");
        setSuccessMessage("");

        const currentToken = localStorage.getItem("shopsphereToken");

        if (!currentToken) {
            closeModal();
            navigate("/login");
            return;
        }

        const trimmedReview = reviewText.trim();
        const selectedRating = Number(rating);

        if (!Number.isInteger(selectedRating) ||
            selectedRating < 1 ||
            selectedRating > 5) {
            setFormError("Please select a rating from 1 to 5 stars.");
            return;
        }

        if (!trimmedReview) {
            setFormError("Please write your review.");
            return;
        }

        try {
            setSubmitting(true);

            const response = await fetch(`${API_URL}/reviews/site`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${currentToken}`,
                },
                body: JSON.stringify({
                    rating: selectedRating,
                    review: trimmedReview,
                }),
            });

            const result = await response.json();

            if (!response.ok || result.success === false) {
                throw new Error(
                    result.message || "Unable to submit your review."
                );
            }

            setSuccessMessage(
                result.message || "Your review was submitted successfully!"
            );
            setReviewText("");
            setRating(5);
            setShowReviewForm(false);

            // Refresh homepage and modal reviews to show the latest review
            await fetchReviews(1, false);
            setPage(1);
            await fetchReviews(1, true);
        } catch (err) {
            setFormError(
                err.message || "Something went wrong. Please try again."
            );
        } finally {
            setSubmitting(false);
        }
    };

    // Format review date
    const formatDate = (date) => {
        if (!date) return "";

        const parsedDate = new Date(date);

        if (Number.isNaN(parsedDate.getTime())) {
            return "";
        }

        return parsedDate.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    };

    // Render stars
    const renderStars = (value) => {
        const numberOfStars = Math.max(
            0,
            Math.min(5, Number(value) || 0)
        );

        return (
            <span
                className="text-yellow-400"
                aria-label={`${numberOfStars} out of 5 stars`}
            >
                {"★".repeat(numberOfStars)}
                <span className="text-gray-300">
                    {"★".repeat(5 - numberOfStars)}
                </span>
            </span>
        );
    };

    // Render one review card
    const renderReviewCard = (review, index) => (
        <article
            key={review.id ?? `${review.user_id}-${index}`}
            className={`flex h-full flex-col rounded-2xl border border-ocean-green/10 p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md sm:p-6 ${
                index % 3 === 1 ? "bg-surf-crest" : "bg-aqua-spring"
            }`}
        >
            <div className="text-4xl leading-none text-ocean-green">
                “
            </div>

            <p className="mt-2 flex-1 whitespace-pre-wrap break-words text-sm leading-6 text-cyprus">
                {review.review}
            </p>

            <div className="mt-4 flex items-center gap-2">
                {renderStars(review.rating)}
                <span className="text-xs text-text-grey">
                    {Number(review.rating || 0).toFixed(1)}
                </span>
            </div>

            <div className="mt-5 border-t border-ocean-green/10 pt-4">
                <h3 className="truncate text-sm font-bold text-cyprus">
                    {review.reviewer_name || "Verified Customer"}
                </h3>

                <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1 text-[10px] text-text-grey">
                        <i className="fa-solid fa-circle-check text-ocean-green"></i>
                        Customer Review
                    </span>

                    {review.created_at && (
                        <span className="text-[10px] text-text-grey">
                            {formatDate(review.created_at)}
                        </span>
                    )}
                </div>
            </div>
        </article>
    );

    return (
        <>
            <section className="bg-white py-10 sm:py-12 lg:py-16">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-2xl text-center">
                        <p className="text-xs font-bold uppercase tracking-[2px] text-ocean-green">
                            Customer Reviews
                        </p>

                        <h2 className="mt-2 text-3xl font-bold text-ocean-green sm:text-4xl">
                            Our Happy Customers
                        </h2>

                        <p className="mt-3 text-sm leading-6 text-text-grey sm:text-base">
                            Don't just take our word for it — see how our
                            products and services have delighted customers
                            across the globe.
                        </p>
                    </div>

                    {loading ? (
                        <div className="py-12 text-center text-sm text-text-grey">
                            Loading customer reviews...
                        </div>
                    ) : error ? (
                        <div className="py-12 text-center">
                            <p className="text-sm text-red-600">{error}</p>

                            <button
                                type="button"
                                onClick={() => fetchReviews(1, false)}
                                className="mt-3 rounded-full bg-cyprus px-5 py-2 text-sm font-semibold text-white hover:bg-ocean-green"
                            >
                                Try Again
                            </button>
                        </div>
                    ) : reviews.length === 0 ? (
                        <div className="mt-8 rounded-2xl border border-dashed border-ocean-green/20 px-5 py-10 text-center">
                            <i className="fa-regular fa-comments text-3xl text-ocean-green"></i>

                            <p className="mt-3 font-semibold text-cyprus">
                                No reviews yet
                            </p>

                            <p className="mt-1 text-sm text-text-grey">
                                Be the first to share your experience!
                            </p>
                        </div>
                    ) : (
                        <div className="mt-8 grid gap-5 md:grid-cols-3">
                            {reviews.slice(0, 3).map((review, index) =>
                                renderReviewCard(review, index)
                            )}
                        </div>
                    )}

                    <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                        <button
                            type="button"
                            onClick={handleGetStarted}
                            className="inline-flex items-center rounded-full bg-cyprus px-7 py-3 text-xs font-bold text-white transition duration-300 hover:bg-ocean-green"
                        >
                            GET STARTED
                            <span className="ml-2 text-sm">
                                <i className="fa-solid fa-angle-right"></i>
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setShowModal(true);
                                setPage(1);
                                setShowReviewForm(true);
                            }}
                            className="inline-flex items-center rounded-full border border-cyprus px-7 py-3 text-xs font-bold text-cyprus transition duration-300 hover:bg-aqua-spring"
                        >
                            WRITE A REVIEW
                            <i className="fa-solid fa-pen ml-2"></i>
                        </button>
                    </div>
                </div>
            </section>

            {/* Reviews Modal */}
            {showModal && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-5"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closeModal();
                        }
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="customer-reviews-title"
                        className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:rounded-3xl"
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4 sm:px-6 sm:py-5">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[2px] text-ocean-green sm:text-xs">
                                    ShopSphere Community
                                </p>

                                <h2
                                    id="customer-reviews-title"
                                    className="mt-1 text-xl font-bold text-cyprus sm:text-2xl"
                                >
                                    Customer Reviews
                                </h2>

                                <p className="mt-1 text-xs text-text-grey sm:text-sm">
                                    Real experiences from our customers
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={closeModal}
                                aria-label="Close reviews"
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-red-50 hover:text-red-600"
                            >
                                <i className="fa-solid fa-xmark text-lg"></i>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
                            {successMessage && (
                                <div
                                    role="status"
                                    className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
                                >
                                    <i className="fa-solid fa-circle-check mr-2"></i>
                                    {successMessage}
                                </div>
                            )}

                            {/* Review Form Toggle */}
                            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h3 className="font-bold text-cyprus">
                                        What our customers say
                                    </h3>
                                    <p className="mt-1 text-xs text-text-grey">
                                        Page {page} of {totalPages}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowReviewForm((previous) => !previous);
                                        setFormError("");
                                    }}
                                    className="inline-flex items-center justify-center rounded-full bg-cyprus px-5 py-2.5 text-xs font-bold text-white transition hover:bg-ocean-green"
                                >
                                    <i className="fa-solid fa-pen mr-2"></i>
                                    {showReviewForm
                                        ? "CANCEL REVIEW"
                                        : "WRITE A REVIEW"}
                                </button>
                            </div>

                            {/* Review Form */}
                            {showReviewForm && (
                                <form
                                    onSubmit={handleSubmitReview}
                                    className="mb-7 rounded-2xl border border-ocean-green/15 bg-aqua-spring/50 p-4 sm:p-6"
                                >
                                    <h3 className="text-lg font-bold text-cyprus">
                                        Share Your Experience
                                    </h3>

                                    <p className="mt-1 text-xs leading-5 text-text-grey">
                                        Tell us about your experience with ShopSphere.
                                    </p>

                                    {!token && (
                                        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                                            Please log in before submitting a review.
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    closeModal();
                                                    navigate("/login");
                                                }}
                                                className="ml-1 font-bold underline"
                                            >
                                                Login
                                            </button>
                                        </div>
                                    )}

                                    <div className="mt-5">
                                        <label className="block text-sm font-semibold text-cyprus">
                                            Your Rating
                                        </label>

                                        <div className="mt-2 flex items-center gap-1">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <button
                                                    key={star}
                                                    type="button"
                                                    onClick={() => setRating(star)}
                                                    aria-label={`Rate ${star} out of 5 stars`}
                                                    aria-pressed={rating >= star}
                                                    className={`text-3xl transition hover:scale-110 ${
                                                        rating >= star
                                                            ? "text-yellow-400"
                                                            : "text-gray-300"
                                                    }`}
                                                >
                                                    ★
                                                </button>
                                            ))}

                                            <span className="ml-2 text-xs text-text-grey">
                                                {rating}/5
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-4">
                                        <label
                                            htmlFor="customer-review"
                                            className="block text-sm font-semibold text-cyprus"
                                        >
                                            Your Review
                                        </label>

                                        <textarea
                                            id="customer-review"
                                            value={reviewText}
                                            onChange={(event) =>
                                                setReviewText(event.target.value)
                                            }
                                            placeholder="Write about your shopping experience..."
                                            rows={4}
                                            maxLength={2000}
                                            required
                                            className="mt-2 w-full resize-y rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-cyprus outline-none transition placeholder:text-gray-400 focus:border-ocean-green focus:ring-2 focus:ring-ocean-green/10"
                                        />

                                        <p className="mt-1 text-right text-[10px] text-text-grey">
                                            {reviewText.length}/2000
                                        </p>
                                    </div>

                                    {formError && (
                                        <p
                                            role="alert"
                                            className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600"
                                        >
                                            {formError}
                                        </p>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={submitting || !token}
                                        className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-cyprus px-6 py-3 text-sm font-bold text-white transition hover:bg-ocean-green disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                                    >
                                        {submitting ? (
                                            <>
                                                <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                                                SUBMITTING...
                                            </>
                                        ) : (
                                            <>
                                                SUBMIT REVIEW
                                                <i className="fa-solid fa-paper-plane ml-2"></i>
                                            </>
                                        )}
                                    </button>
                                </form>
                            )}

                            {/* Review List */}
                            {modalLoading ? (
                                <div className="py-12 text-center text-sm text-text-grey">
                                    <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                                    Loading reviews...
                                </div>
                            ) : formError && modalReviews.length === 0 ? (
                                <div className="py-8 text-center">
                                    <p className="text-sm text-red-600">
                                        {formError}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => fetchReviews(page, true)}
                                        className="mt-3 rounded-full bg-cyprus px-5 py-2 text-sm font-semibold text-white hover:bg-ocean-green"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            ) : modalReviews.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-ocean-green/20 px-5 py-10 text-center">
                                    <i className="fa-regular fa-comments text-3xl text-ocean-green"></i>
                                    <p className="mt-3 font-semibold text-cyprus">
                                        No reviews yet
                                    </p>
                                    <p className="mt-1 text-sm text-text-grey">
                                        Be the first to share your experience!
                                    </p>
                                </div>
                            ) : (
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {modalReviews.map((review, index) =>
                                        renderReviewCard(review, index)
                                    )}
                                </div>
                            )}

                            {/* Pagination */}
                            {!modalLoading && totalPages > 1 && (
                                <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                                    <button
                                        type="button"
                                        disabled={page <= 1}
                                        onClick={() => setPage((previous) => previous - 1)}
                                        className="rounded-full border border-cyprus/20 px-5 py-2.5 text-xs font-bold text-cyprus transition hover:bg-aqua-spring disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <i className="fa-solid fa-angle-left mr-2"></i>
                                        PREVIOUS
                                    </button>

                                    <div className="flex items-center gap-1">
                                        {Array.from(
                                            { length: totalPages },
                                            (_, index) => index + 1
                                        )
                                            .filter((number) =>
                                                number === 1 ||
                                                number === totalPages ||
                                                Math.abs(number - page) <= 1
                                            )
                                            .map((number, index, visiblePages) => (
                                                <React.Fragment key={number}>
                                                    {index > 0 &&
                                                        number - visiblePages[index - 1] > 1 && (
                                                            <span className="px-1 text-gray-400">
                                                                …
                                                            </span>
                                                        )}

                                                    <button
                                                        type="button"
                                                        onClick={() => setPage(number)}
                                                        aria-current={
                                                            page === number
                                                                ? "page"
                                                                : undefined
                                                        }
                                                        className={`h-9 min-w-9 rounded-full px-3 text-xs font-bold transition ${
                                                            page === number
                                                                ? "bg-cyprus text-white"
                                                                : "text-cyprus hover:bg-aqua-spring"
                                                        }`}
                                                    >
                                                        {number}
                                                    </button>
                                                </React.Fragment>
                                            ))}
                                    </div>

                                    <button
                                        type="button"
                                        disabled={page >= totalPages}
                                        onClick={() => setPage((previous) => previous + 1)}
                                        className="rounded-full border border-cyprus/20 px-5 py-2.5 text-xs font-bold text-cyprus transition hover:bg-aqua-spring disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        NEXT
                                        <i className="fa-solid fa-angle-right ml-2"></i>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex justify-end border-t border-gray-100 px-4 py-3 sm:px-6">
                            <button
                                type="button"
                                onClick={closeModal}
                                className="rounded-full bg-gray-100 px-5 py-2.5 text-xs font-bold text-gray-700 transition hover:bg-gray-200"
                            >
                                CLOSE
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default HappyCustomers;