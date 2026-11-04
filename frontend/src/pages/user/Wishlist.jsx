
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import UserDashboardLayout from "../../layouts/UserDashboardLayout";

const API_BASE_URL = "http://192.168.1.20:5000";

// Get product ID
const getProductId = (product) =>
    product.product_id ??
    product.product?.product_id ??
    product.product?.id ??
    product.id;

// Get product name
const getProductName = (product) =>
    product.title ||
    product.product_name ||
    product.name ||
    product.product?.title ||
    product.product?.name ||
    "Product";

// Get product price
const getProductPrice = (product) =>
    Number(
        product.sale_price ??
        product.selling_price ??
        product.price ??
        product.base_price ??
        product.product?.sale_price ??
        product.product?.price ??
        product.product?.base_price ??
        0
    );

// Convert image path to full URL
const normalizeImageUrl = (image) => {
    if (typeof image !== "string" || !image.trim()) {
        return "";
    }

    const path = image.trim();

    if (
        path.startsWith("http://") ||
        path.startsWith("https://") ||
        path.startsWith("data:") ||
        path.startsWith("blob:")
    ) {
        return path;
    }

    return `${API_BASE_URL}/${path.replace(/^\/+/, "")}`;
};

// Get image URL from a product or image API response
const getImageUrl = (image) => {
    if (typeof image === "string") {
        return normalizeImageUrl(image);
    }

    if (!image || typeof image !== "object") {
        return "";
    }

    const path =
        image.image_url ||
        image.image_path ||
        image.image ||
        image.url ||
        image.path ||
        image.file_path ||
        image.file_url ||
        image.thumbnail ||
        "";

    return normalizeImageUrl(path);
};

// Extract image array from common API response formats
const getImagesFromResponse = (result) => {
    const candidates = [
        result?.data?.images,
        result?.data?.items,
        result?.data,
        result?.images,
        result?.items,
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
            return candidate;
        }
    }

    // API may return a single image object
    const singleImage =
        result?.data?.image ||
        result?.image;

    if (singleImage) {
        return [singleImage];
    }

    return [];
};

// Format price
const formatPrice = (price) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
    }).format(Number(price || 0));

function Wishlist() {
    const [wishlist, setWishlist] = useState([]);
    const [imageMap, setImageMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [removingId, setRemovingId] = useState(null);
    const [movingId, setMovingId] = useState(null);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const getToken = () =>
        localStorage.getItem("shopsphereToken");

    // Fetch images for each product
    const fetchProductImages = async (items, token) => {
        const imageEntries = await Promise.all(
            items.map(async (item) => {
                const productId = getProductId(item);

                if (!productId) {
                    return [null, ""];
                }

                // First use image already available in wishlist data
                const existingImage =
                    getImageUrl(item.image) ||
                    getImageUrl(item.image_url) ||
                    getImageUrl(item.thumbnail) ||
                    getImageUrl(item.product_image) ||
                    getImageUrl(item.product?.image) ||
                    getImageUrl(item.product?.image_url) ||
                    getImageUrl(item.images?.[0]) ||
                    getImageUrl(item.product?.images?.[0]);

                try {
                    const response = await fetch(
                        `${API_BASE_URL}/api/products/${productId}/images`,
                        {
                            method: "GET",
                            headers: {
                                Authorization: `Bearer ${token}`,
                                "Content-Type": "application/json",
                            },
                        }
                    );

                    if (!response.ok) {
                        if (existingImage) {
                            return [String(productId), existingImage];
                        }

                        console.error(
                            `Image API failed for product ${productId}:`,
                            response.status
                        );

                        return [String(productId), ""];
                    }

                    const result = await response.json();

                    if (result.success === false) {
                        return [String(productId), existingImage];
                    }

                    const images = getImagesFromResponse(result);

                    // Prefer the primary/default image if API provides one
                    const selectedImage =
                        images.find(
                            (img) =>
                                img?.is_primary === true ||
                                img?.is_primary === 1 ||
                                img?.is_default === true
                        ) || images[0];

                    const apiImage = getImageUrl(selectedImage);

                    return [
                        String(productId),
                        apiImage || existingImage,
                    ];
                } catch (err) {
                    console.error(
                        `Unable to load image for product ${productId}:`,
                        err
                    );

                    return [String(productId), existingImage];
                }
            })
        );

        const nextImageMap = {};

        imageEntries.forEach(([productId, imageUrl]) => {
            if (productId) {
                nextImageMap[productId] = imageUrl;
            }
        });

        setImageMap(nextImageMap);
    };

    // Fetch wishlist and product images
    const fetchWishlist = useCallback(async () => {
        const token = getToken();

        if (!token) {
            setError("Please log in to view your wishlist.");
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError("");

            const response = await fetch(
                `${API_BASE_URL}/api/wishlist`,
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            const result = await response.json();

            if (!response.ok || result.success === false) {
                throw new Error(
                    result.message || "Unable to load wishlist."
                );
            }

            const items =
                result.data?.items ||
                result.items ||
                [];

            const safeItems = Array.isArray(items) ? items : [];

            setWishlist(safeItems);

            // Load product images from the images API
            await fetchProductImages(safeItems, token);
        } catch (err) {
            console.error("Fetch wishlist error:", err);

            setError(
                err.message ||
                "Unable to load wishlist. Please try again."
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWishlist();
    }, [fetchWishlist]);

    // Remove product from wishlist
    const removeFromWishlist = async (item) => {
        const itemId = item.wishlist_item_id ?? item.id;

        if (!itemId) {
            setError("Wishlist item ID is missing.");
            return;
        }

        const token = getToken();

        if (!token) {
            setError("Please log in to manage your wishlist.");
            return;
        }

        try {
            setRemovingId(itemId);
            setError("");
            setMessage("");

            const response = await fetch(
                `${API_BASE_URL}/api/wishlist/items/${itemId}`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const result = await response.json();

            if (!response.ok || result.success === false) {
                throw new Error(
                    result.message || "Unable to remove product."
                );
            }

            // Update wishlist and image map
            setWishlist((currentItems) =>
                currentItems.filter(
                    (currentItem) =>
                        String(
                            currentItem.wishlist_item_id ??
                            currentItem.id
                        ) !== String(itemId)
                )
            );

            const productId = getProductId(item);

            if (productId) {
                setImageMap((current) => {
                    const updated = { ...current };
                    delete updated[String(productId)];
                    return updated;
                });
            }

            setMessage("Product removed from your wishlist.");
        } catch (err) {
            console.error("Remove wishlist product error:", err);

            setError(
                err.message || "Unable to remove product."
            );
        } finally {
            setRemovingId(null);
        }
    };

    // Move product to cart and refresh wishlist
    const moveToCart = async (item) => {
        const itemId = item.wishlist_item_id ?? item.id;

        if (!itemId) {
            setError("Wishlist item ID is missing.");
            return;
        }

        const token = getToken();

        if (!token) {
            setError("Please log in to move products to your cart.");
            return;
        }

        try {
            setMovingId(itemId);
            setError("");
            setMessage("");

            const response = await fetch(
                `${API_BASE_URL}/api/wishlist/items/${itemId}/move-to-cart`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            const result = await response.json();

            if (!response.ok || result.success === false) {
                throw new Error(
                    result.message || "Unable to move product to cart."
                );
            }

            // Refresh wishlist and image data from backend
            await fetchWishlist();

            setMessage(
                result.message ||
                "Product moved to cart successfully."
            );
        } catch (err) {
            console.error("Move to cart error:", err);

            setError(
                err.message || "Unable to move product to cart."
            );
        } finally {
            setMovingId(null);
        }
    };

    return (
        <UserDashboardLayout>
            <div className="min-h-full bg-gray-50 p-4 sm:p-6 lg:p-8">

                {/* Header */}
                <div className="mb-6">
                    <p className="text-xs font-bold uppercase tracking-[2px] text-ocean-green">
                        Saved Products
                    </p>

                    <h1 className="mt-1 text-2xl font-bold text-cyprus sm:text-3xl">
                        My Wishlist
                    </h1>

                    <p className="mt-1 text-sm text-text-grey">
                        Products you saved for later.
                    </p>

                    {!loading && !error && (
                        <p className="mt-2 text-sm font-medium text-gray-500">
                            {wishlist.length} saved{" "}
                            {wishlist.length === 1 ? "product" : "products"}
                        </p>
                    )}
                </div>

                {/* Success Message */}
                {message && (
                    <div
                        role="status"
                        className="mb-5 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700"
                    >
                        <i className="fa-solid fa-circle-check" />
                        <span>{message}</span>

                        <button
                            type="button"
                            onClick={() => setMessage("")}
                            className="ml-auto"
                            aria-label="Dismiss message"
                        >
                            <i className="fa-solid fa-xmark" />
                        </button>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div
                        role="alert"
                        className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                    >
                        <div className="flex items-start gap-2">
                            <i className="fa-solid fa-circle-exclamation mt-0.5" />
                            <p>{error}</p>
                        </div>

                        <button
                            type="button"
                            onClick={fetchWishlist}
                            className="mt-3 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {/* Loading */}
                {loading ? (
                    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white">
                        <i className="fa-solid fa-spinner fa-spin text-3xl text-ocean-green" />

                        <p className="mt-4 text-sm text-text-grey">
                            Loading your wishlist...
                        </p>
                    </div>
                ) : wishlist.length === 0 && !error ? (
                    /* Empty Wishlist */
                    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                        <div className="flex min-h-[370px] flex-col items-center justify-center p-6 text-center">
                            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-aqua-spring text-3xl text-ocean-green">
                                <i className="fa-regular fa-heart" />
                            </div>

                            <h2 className="mt-5 text-xl font-bold text-cyprus">
                                Your Wishlist is Empty
                            </h2>

                            <p className="mt-2 text-sm text-text-grey">
                                Save your favorite products here for later.
                            </p>

                            <Link
                                to="/products"
                                className="mt-6 inline-flex items-center gap-2 rounded-full bg-ocean-green px-6 py-3 text-xs font-bold text-white transition hover:bg-cyprus"
                            >
                                <i className="fa-solid fa-bag-shopping" />
                                Explore Products
                            </Link>
                        </div>
                    </div>
                ) : (
                    /* Wishlist Product Cards */
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {wishlist.map((item) => {
                            const productId = getProductId(item);
                            const itemId =
                                item.wishlist_item_id ?? item.id;

                            const productName = getProductName(item);
                            const price = getProductPrice(item);

                            const productImage =
                                imageMap[String(productId)] ||
                                getImageUrl(item.image) ||
                                getImageUrl(item.image_url) ||
                                getImageUrl(item.thumbnail) ||
                                getImageUrl(item.product_image) ||
                                getImageUrl(item.product?.image) ||
                                getImageUrl(item.images?.[0]) ||
                                getImageUrl(item.product?.images?.[0]);

                            const originalPrice = Number(
                                item.base_price ??
                                item.original_price ??
                                item.regular_price ??
                                item.product?.base_price ??
                                item.product?.original_price ??
                                0
                            );

                            return (
                                <article
                                    key={itemId ?? productId}
                                    className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
                                >
                                    {/* Product Image */}
                                    <div className="relative flex h-52 items-center justify-center overflow-hidden bg-white p-4">
                                        {productImage ? (
                                            <img
                                                src={productImage}
                                                alt={productName}
                                                loading="lazy"
                                                onError={(event) => {
                                                    event.currentTarget.style.display = "none";
                                                }}
                                                className="h-full w-full object-contain transition duration-500 group-hover:scale-105"
                                            />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center bg-gray-50 text-gray-300">
                                                <i className="fa-regular fa-image text-4xl" />
                                            </div>
                                        )}

                                        {/* Remove Button */}
                                        <button
                                            type="button"
                                            onClick={() =>
                                                removeFromWishlist(item)
                                            }
                                            disabled={
                                                removingId === itemId ||
                                                movingId === itemId
                                            }
                                            aria-label={`Remove ${productName} from wishlist`}
                                            title="Remove from wishlist"
                                            className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-error shadow-md transition hover:bg-error hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {removingId === itemId ? (
                                                <i className="fa-solid fa-spinner fa-spin" />
                                            ) : (
                                                <i className="fa-solid fa-trash-can" />
                                            )}
                                        </button>
                                    </div>

                                    {/* Product Details */}
                                    <div className="flex flex-1 flex-col p-4">
                                        <h3 className="min-h-12 line-clamp-2 text-base font-bold text-cyprus">
                                            {productName}
                                        </h3>

                                        {/* Stock Status */}
                                        {item.stock_status && (
                                            <p
                                                className={`mt-2 text-xs font-semibold ${
                                                    String(item.stock_status)
                                                        .toLowerCase()
                                                        .includes("out")
                                                        ? "text-error"
                                                        : "text-green-600"
                                                }`}
                                            >
                                                {String(item.stock_status).replace(/_/g, " ")}
                                            </p>
                                        )}

                                        {/* Price */}
                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                            <span className="text-lg font-bold text-ocean-green">
                                                {formatPrice(price)}
                                            </span>

                                            {originalPrice > price && (
                                                <span className="text-xs text-gray-400 line-through">
                                                    {formatPrice(originalPrice)}
                                                </span>
                                            )}
                                        </div>

                                        {/* Move to Cart */}
                                        <button
                                            type="button"
                                            onClick={() => moveToCart(item)}
                                            disabled={
                                                movingId === itemId ||
                                                removingId === itemId
                                            }
                                            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-ocean-green px-4 py-3 text-xs font-bold text-white transition hover:bg-cyprus disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {movingId === itemId ? (
                                                <>
                                                    <i className="fa-solid fa-spinner fa-spin" />
                                                    Moving to Cart...
                                                </>
                                            ) : (
                                                <>
                                                    <i className="fa-solid fa-cart-shopping" />
                                                    Move to Cart
                                                </>
                                            )}
                                        </button>

                                        {/* View Product */}
                                        <Link
                                            to={`/product/${productId}`}
                                            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-cyprus px-4 py-3 text-xs font-bold text-cyprus transition hover:bg-cyprus hover:text-white"
                                        >
                                            <i className="fa-regular fa-eye" />
                                            View Product
                                        </Link>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>
        </UserDashboardLayout>
    );
}

export default Wishlist;
