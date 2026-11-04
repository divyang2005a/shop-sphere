
import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import UserDashboardLayout from "../../layouts/UserDashboardLayout";

const API_URL = "http://192.168.1.20:5000/api/cart";
const IMAGE_API_URL = "http://192.168.1.20:5000/api/products";
const CHECKOUT_SUMMARY_URL =
    "http://192.168.1.20:5000/api/orders/checkout-summary";
const SERVER_URL = "http://192.168.1.20:5000";

// Format price
const formatPrice = (price) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
    }).format(Number(price) || 0);

// Convert relative image path to full URL
function getImageUrl(image) {
    if (!image || typeof image !== "string") {
        return "";
    }

    if (
        image.startsWith("http://") ||
        image.startsWith("https://") ||
        image.startsWith("data:")
    ) {
        return image;
    }

    return `${SERVER_URL}/${image.replace(/^\/+/, "")}`;
}

// Product image component
function ProductImage({ productId, title, fallbackImage }) {
    const [imageUrl, setImageUrl] = useState("");
    const [imageError, setImageError] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const fetchImage = async () => {
            setImageUrl("");
            setImageError(false);
            setImageLoading(true);

            try {
                if (fallbackImage) {
                    const existingUrl = getImageUrl(fallbackImage);

                    if (!cancelled) {
                        setImageUrl(existingUrl);
                        setImageLoading(false);
                    }

                    return;
                }

                if (!productId) {
                    throw new Error("Product ID not found.");
                }

                const token = localStorage.getItem("shopsphereToken");

                if (!token) {
                    throw new Error("Login token not found.");
                }

                const response = await fetch(
                    `${IMAGE_API_URL}/${productId}/images`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                const data = await response.json();

                if (!response.ok || data.success === false) {
                    throw new Error(
                        data.message || "Unable to fetch product images."
                    );
                }

                const images = Array.isArray(data.images)
                    ? data.images
                    : Array.isArray(data.data?.images)
                    ? data.data.images
                    : Array.isArray(data.data)
                    ? data.data
                    : [];

                const selectedImage =
                    images.find(
                        (image) => Number(image.is_primary) === 1
                    ) || images[0];

                const imagePath =
                    typeof selectedImage === "string"
                        ? selectedImage
                        : selectedImage?.image_url ||
                          selectedImage?.image ||
                          selectedImage?.image_path;

                if (!imagePath) {
                    throw new Error("Product image not found.");
                }

                if (!cancelled) {
                    setImageUrl(getImageUrl(imagePath));
                }
            } catch (err) {
                console.error("Cart image error:", err);

                if (!cancelled) {
                    setImageError(true);
                }
            } finally {
                if (!cancelled) {
                    setImageLoading(false);
                }
            }
        };

        fetchImage();

        return () => {
            cancelled = true;
        };
    }, [productId, fallbackImage]);

    if (imageLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <i className="fa-solid fa-spinner fa-spin text-xl text-ocean-green" />
            </div>
        );
    }

    if (imageError || !imageUrl) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <i className="fa-solid fa-box text-2xl text-ocean-green" />
            </div>
        );
    }

    return (
        <img
            src={imageUrl}
            alt={title || "Product"}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setImageError(true)}
        />
    );
}

function Cart() {
    const navigate = useNavigate();

    const [cartItems, setCartItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [summaryLoading, setSummaryLoading] = useState(true);
    const [summaryError, setSummaryError] = useState("");
    const [checkoutSummary, setCheckoutSummary] = useState(null);

    const [error, setError] = useState("");
    const [updatingId, setUpdatingId] = useState(null);
    const [clearing, setClearing] = useState(false);
    const [notice, setNotice] = useState("");

    // Normalize backend cart item
    const normalizeItem = (item) => {
        const product =
            item.product ||
            item.product_details ||
            {};

        return {
            ...item,

            id:
                item.cart_item_id ??
                item.id ??
                item.cartItemId,

            productId:
                item.product_id ??
                item.productId ??
                item.productId_fk ??
                product.product_id ??
                product.id ??
                item.product_details?.product_id ??
                item.product_details?.id,

            title:
                item.product_name ??
                item.title ??
                item.name ??
                product.name ??
                product.product_name ??
                "Product",

            price: Number(
                item.sale_price ??
                item.price ??
                item.unit_price ??
                item.product_price ??
                product.sale_price ??
                product.price ??
                0
            ),

            quantity: Number(item.quantity ?? item.qty ?? 1),

            image:
                item.product_image ??
                item.image ??
                item.image_url ??
                product.image ??
                product.image_url ??
                product.images?.[0]?.image_url ??
                product.images?.[0]?.image ??
                "",
        };
    };

    // Save cart locally
    const saveCart = (items) => {
        localStorage.setItem("shopsphereCart", JSON.stringify(items));
    };

    // Fetch cart
    const fetchCart = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const token = localStorage.getItem("shopsphereToken");

            if (!token) {
                throw new Error("Please login to view your cart.");
            }

            const response = await fetch(API_URL, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(data.message || "Failed to load cart.");
            }

            let items = [];

            if (Array.isArray(data)) {
                items = data;
            } else if (Array.isArray(data.cart)) {
                items = data.cart;
            } else if (Array.isArray(data.items)) {
                items = data.items;
            } else if (Array.isArray(data.data)) {
                items = data.data;
            } else if (Array.isArray(data.data?.items)) {
                items = data.data.items;
            } else if (Array.isArray(data.data?.cart)) {
                items = data.data.cart;
            } else {
                throw new Error(
                    "Unexpected cart API response. Please check the backend response."
                );
            }

            const normalizedItems = items.map(normalizeItem);

            setCartItems(normalizedItems);
            saveCart(normalizedItems);
        } catch (err) {
            console.error("Fetch cart error:", err);
            setError(err.message || "Unable to load your cart.");
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch checkout summary from backend
    const fetchCheckoutSummary = useCallback(async () => {
        try {
            setSummaryLoading(true);
            setSummaryError("");

            const token = localStorage.getItem("shopsphereToken");

            if (!token) {
                throw new Error("Please login to view checkout summary.");
            }

            const response = await fetch(CHECKOUT_SUMMARY_URL, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            const result = await response.json();

            if (!response.ok || result.success === false) {
                throw new Error(
                    result.message || "Unable to load checkout summary."
                );
            }

            // Support common backend response structures
            const summary =
                result.summary ??
                result.data?.summary ??
                result.data ??
                result.checkout_summary ??
                result;

            setCheckoutSummary(summary);
        } catch (err) {
            console.error("Checkout summary error:", err);
            setSummaryError(
                err.message || "Unable to load checkout summary."
            );
            setCheckoutSummary(null);
        } finally {
            setSummaryLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCart();
        fetchCheckoutSummary();
    }, [fetchCart, fetchCheckoutSummary]);

    // Update quantity
    const updateQuantity = async (item, change) => {
        const id = item.id;
        const newQuantity = Number(item.quantity) + change;

        if (!id || newQuantity < 1) return;

        try {
            setUpdatingId(id);
            setError("");
            setNotice("");

            const token = localStorage.getItem("shopsphereToken");

            if (!token) {
                throw new Error("Please login again.");
            }

            const response = await fetch(`${API_URL}/${id}`, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    quantity: newQuantity,
                }),
            });

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(
                    data.message || "Unable to update quantity."
                );
            }

            const updatedItem =
                data.cart_item ||
                data.item ||
                data.data?.cart_item ||
                data.data?.item;

            if (updatedItem) {
                const normalized = normalizeItem(updatedItem);

                setCartItems((items) => {
                    const updated = items.map((current) =>
                        String(current.id) === String(id)
                            ? {
                                  ...current,
                                  ...normalized,
                                  quantity: newQuantity,
                              }
                            : current
                    );

                    saveCart(updated);
                    return updated;
                });
            } else {
                await fetchCart();
            }

            // Refresh backend summary after quantity changes
            await fetchCheckoutSummary();

            setNotice("Quantity updated successfully.");
        } catch (err) {
            setError(err.message || "Unable to update quantity.");
        } finally {
            setUpdatingId(null);
        }
    };

    // Remove one product from cart
    const removeFromCart = async (id) => {
        if (!id) return;

        try {
            setUpdatingId(id);
            setError("");
            setNotice("");

            const token = localStorage.getItem("shopsphereToken");

            if (!token) {
                throw new Error("Please login again.");
            }

            const response = await fetch(`${API_URL}/${id}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(data.message || "Unable to remove product.");
            }

            setCartItems((items) => {
                const updated = items.filter(
                    (item) => String(item.id) !== String(id)
                );

                saveCart(updated);
                return updated;
            });

            await fetchCheckoutSummary();

            setNotice("Product removed from cart.");
        } catch (err) {
            setError(err.message || "Unable to remove product.");
        } finally {
            setUpdatingId(null);
        }
    };

    // Clear complete cart
    const clearCart = async () => {
        if (cartItems.length === 0) return;

        if (!window.confirm("Are you sure you want to clear your cart?")) {
            return;
        }

        try {
            setClearing(true);
            setError("");
            setNotice("");

            const token = localStorage.getItem("shopsphereToken");

            if (!token) {
                throw new Error("Please login again.");
            }

            const response = await fetch(`${API_URL}/clear`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(data.message || "Unable to clear cart.");
            }

            setCartItems([]);
            saveCart([]);

            await fetchCheckoutSummary();

            setNotice("Your cart has been cleared.");
        } catch (err) {
            setError(err.message || "Unable to clear cart.");
        } finally {
            setClearing(false);
        }
    };

    // Read possible values from backend summary
    const getSummaryValue = (keys, fallback) => {
        if (!checkoutSummary) return fallback;

        for (const key of keys) {
            const value = checkoutSummary[key];

            if (value !== undefined && value !== null && value !== "") {
                const number = Number(value);

                if (Number.isFinite(number)) {
                    return number;
                }
            }
        }

        return fallback;
    };

    // Fallback values are used only when a summary field is not provided
    const calculatedSubtotal = cartItems.reduce(
        (total, item) =>
            total +
            (Number(item.price) || 0) *
                (Number(item.quantity) || 1),
        0
    );

    const subtotal = getSummaryValue(
        ["subtotal", "sub_total", "cart_subtotal", "items_subtotal"],
        calculatedSubtotal
    );

    const shipping = getSummaryValue(
        ["shipping", "shipping_cost", "shipping_fee", "delivery_charge"],
        subtotal === 0 || subtotal > 100 ? 0 : 10
    );

    const tax = getSummaryValue(
        ["tax", "tax_amount", "gst_amount", "total_tax"],
        subtotal * 0.05
    );

    const discount = getSummaryValue(
        ["discount", "discount_amount", "coupon_discount"],
        0
    );

    const total = getSummaryValue(
        ["total", "grand_total", "order_total", "total_amount", "payable_amount"],
        Math.max(0, subtotal + shipping + tax - discount)
    );

    const totalQuantity = cartItems.reduce(
        (sum, item) => sum + (Number(item.quantity) || 1),
        0
    );

    return (
        <UserDashboardLayout>
            <div className="min-h-full w-full min-w-0 overflow-x-hidden bg-gray-50 p-3 sm:p-6 lg:p-8">

                {/* Header */}
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[2px] text-ocean-green">
                            Shopping Bag
                        </p>

                        <h1 className="mt-1 text-2xl font-bold text-cyprus sm:text-3xl">
                            My Cart
                        </h1>

                        <p className="mt-1 text-sm text-text-grey">
                            Review your items before checkout.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                fetchCart();
                                fetchCheckoutSummary();
                            }}
                            disabled={loading || summaryLoading}
                            className="inline-flex items-center rounded-full border border-gray-200 bg-white px-4 py-3 text-xs font-bold text-cyprus hover:bg-aqua-spring disabled:opacity-50"
                        >
                            <i className="fa-solid fa-rotate-right mr-2" />
                            Refresh
                        </button>

                        <Link
                            to="/products"
                            className="inline-flex w-fit items-center rounded-full border border-cyprus px-5 py-3 text-xs font-bold text-cyprus transition hover:bg-cyprus hover:text-white"
                        >
                            <i className="fa-solid fa-arrow-left mr-2" />
                            Continue Shopping
                        </Link>
                    </div>
                </div>

                {/* Success Message */}
                {notice && (
                    <div
                        role="status"
                        className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
                    >
                        <i className="fa-solid fa-circle-check mr-2" />
                        {notice}
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div
                        role="alert"
                        className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                    >
                        <i className="fa-solid fa-circle-exclamation mr-2" />
                        {error}

                        <button
                            type="button"
                            onClick={() => setError("")}
                            className="ml-3 font-bold underline"
                        >
                            Dismiss
                        </button>
                    </div>
                )}

                {/* Cart Loading */}
                {loading ? (
                    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white">
                        <i className="fa-solid fa-spinner fa-spin text-3xl text-ocean-green" />
                        <p className="mt-3 text-sm text-text-grey">
                            Loading your cart...
                        </p>
                    </div>
                ) : cartItems.length === 0 ? (
                    /* Empty Cart */
                    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                        <div className="flex min-h-[350px] flex-col items-center justify-center p-6 text-center">
                            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-aqua-spring text-3xl text-ocean-green">
                                <i className="fa-solid fa-cart-shopping" />
                            </div>

                            <h2 className="mt-5 text-xl font-bold text-cyprus">
                                Your Cart is Empty
                            </h2>

                            <p className="mt-2 max-w-sm text-sm text-text-grey">
                                Add some products to your cart and they will appear here.
                            </p>

                            <Link
                                to="/products"
                                className="mt-6 rounded-full bg-ocean-green px-6 py-3 text-xs font-bold text-white transition hover:bg-cyprus"
                            >
                                Start Shopping
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">

                        {/* Cart Items */}
                        <section className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-4 sm:p-6">
                                <div>
                                    <h2 className="text-lg font-bold text-cyprus">
                                        Cart Items ({cartItems.length})
                                    </h2>

                                    <p className="mt-1 text-xs text-text-grey">
                                        {totalQuantity} item(s) in your cart
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={clearCart}
                                    disabled={clearing || updatingId !== null}
                                    className="shrink-0 text-xs font-bold text-error transition hover:underline disabled:opacity-50"
                                >
                                    {clearing ? (
                                        <>
                                            <i className="fa-solid fa-spinner fa-spin mr-2" />
                                            Clearing...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-regular fa-trash-can mr-1" />
                                            Clear Cart
                                        </>
                                    )}
                                </button>
                            </div>

                            <div className="divide-y divide-gray-200">
                                {cartItems.map((item, index) => {
                                    const price = Number(item.price) || 0;
                                    const quantity = Number(item.quantity) || 1;

                                    const isUpdating =
                                        String(updatingId) === String(item.id);

                                    return (
                                        <div
                                            key={item.id ?? index}
                                            className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-6"
                                        >
                                            {/* Product Image */}
                                            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
                                                <ProductImage
                                                    productId={item.productId}
                                                    title={item.title}
                                                    fallbackImage={item.image}
                                                />
                                            </div>

                                            {/* Product Details */}
                                            <div className="min-w-0 flex-1">
                                                <h3 className="break-words text-base font-bold text-cyprus">
                                                    {item.title}
                                                </h3>

                                                <p className="mt-2 text-sm font-bold text-ocean-green">
                                                    {formatPrice(price)}
                                                </p>

                                                <button
                                                    type="button"
                                                    onClick={() => removeFromCart(item.id)}
                                                    disabled={isUpdating || clearing}
                                                    className="mt-3 text-xs font-medium text-error transition hover:underline disabled:opacity-50"
                                                >
                                                    {isUpdating ? (
                                                        <i className="fa-solid fa-spinner fa-spin mr-1" />
                                                    ) : (
                                                        <i className="fa-regular fa-trash-can mr-1" />
                                                    )}
                                                    Remove
                                                </button>
                                            </div>

                                            {/* Quantity Controls */}
                                            <div className="flex items-center justify-between gap-4 sm:justify-center">
                                                <div className="flex items-center rounded-full border border-gray-200">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateQuantity(item, -1)}
                                                        disabled={
                                                            quantity <= 1 ||
                                                            isUpdating ||
                                                            clearing
                                                        }
                                                        aria-label="Decrease quantity"
                                                        className="flex h-9 w-9 items-center justify-center rounded-l-full text-cyprus hover:bg-aqua-spring disabled:cursor-not-allowed disabled:opacity-40"
                                                    >
                                                        −
                                                    </button>

                                                    <span className="w-8 text-center text-sm font-bold text-cyprus">
                                                        {quantity}
                                                    </span>

                                                    <button
                                                        type="button"
                                                        onClick={() => updateQuantity(item, 1)}
                                                        disabled={isUpdating || clearing}
                                                        aria-label="Increase quantity"
                                                        className="flex h-9 w-9 items-center justify-center rounded-r-full text-cyprus hover:bg-aqua-spring disabled:opacity-40"
                                                    >
                                                        +
                                                    </button>
                                                </div>

                                                {isUpdating && (
                                                    <i className="fa-solid fa-spinner fa-spin text-sm text-ocean-green" />
                                                )}
                                            </div>

                                            {/* Item Total */}
                                            <div className="text-right sm:min-w-28">
                                                <p className="text-xs text-text-grey">
                                                    Item Total
                                                </p>

                                                <p className="mt-1 text-base font-bold text-cyprus">
                                                    {formatPrice(price * quantity)}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Order Summary */}
                        <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-20">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-aqua-spring text-ocean-green">
                                    <i className="fa-solid fa-receipt text-lg" />
                                </div>

                                <div>
                                    <h2 className="text-lg font-bold text-cyprus">
                                        Order Summary
                                    </h2>
                                    <p className="text-xs text-text-grey">
                                        Price details
                                    </p>
                                </div>
                            </div>

                            {/* Summary API Loading */}
                            {summaryLoading && (
                                <div className="mt-4 flex items-center gap-2 rounded-xl bg-gray-50 p-3 text-sm text-text-grey">
                                    <i className="fa-solid fa-spinner fa-spin text-ocean-green" />
                                    Updating order summary...
                                </div>
                            )}

                            {/* Summary API Error */}
                            {summaryError && !summaryLoading && (
                                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                                    <p>{summaryError}</p>
                                    <button
                                        type="button"
                                        onClick={fetchCheckoutSummary}
                                        className="mt-2 font-bold underline"
                                    >
                                        Retry summary
                                    </button>
                                </div>
                            )}

                            <div className="mt-5 rounded-xl bg-gray-50 p-4">
                                <div className="flex justify-between gap-3 text-sm">
                                    <span className="text-text-grey">
                                        Products ({totalQuantity})
                                    </span>
                                    <span className="font-bold text-cyprus">
                                        {formatPrice(subtotal)}
                                    </span>
                                </div>

                                <div className="mt-4 flex justify-between gap-3 text-sm">
                                    <span className="text-text-grey">
                                        Shipping
                                    </span>
                                    <span className={`font-bold ${shipping === 0 ? "text-green-600" : "text-cyprus"}`}>
                                        {shipping === 0 ? "FREE" : formatPrice(shipping)}
                                    </span>
                                </div>

                                <div className="mt-4 flex justify-between gap-3 text-sm">
                                    <span className="text-text-grey">
                                        Tax
                                    </span>
                                    <span className="font-bold text-cyprus">
                                        {formatPrice(tax)}
                                    </span>
                                </div>

                                {discount > 0 && (
                                    <div className="mt-4 flex justify-between gap-3 text-sm">
                                        <span className="text-text-grey">
                                            Discount
                                        </span>
                                        <span className="font-bold text-green-600">
                                            -{formatPrice(discount)}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="mt-5 flex items-center justify-between gap-3 border-t border-gray-200 pt-5">
                                <span className="font-bold text-cyprus">
                                    Total
                                </span>

                                <span className="text-xl font-bold text-ocean-green">
                                    {formatPrice(total)}
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={() => navigate("/checkout")}
                                disabled={
                                    cartItems.length === 0 ||
                                    updatingId !== null ||
                                    clearing
                                }
                                className="mt-5 w-full rounded-full bg-ocean-green px-5 py-3.5 text-sm font-bold text-white transition hover:bg-cyprus disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Proceed to Checkout
                                <i className="fa-solid fa-arrow-right ml-2" />
                            </button>

                            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-text-grey">
                                <i className="fa-solid fa-shield-halved text-ocean-green" />
                                Secure checkout
                            </div>

                            <Link
                                to="/products"
                                className="mt-4 block text-center text-xs font-bold text-cyprus hover:text-ocean-green"
                            >
                                Continue Shopping
                            </Link>
                        </aside>
                    </div>
                )}
            </div>
        </UserDashboardLayout>
    );
}

export default Cart;
