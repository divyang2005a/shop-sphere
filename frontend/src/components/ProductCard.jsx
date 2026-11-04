import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = "http://192.168.1.20:5000";

function normalizeDescription(value) {
    if (value == null) return "";

    if (typeof value === "string") {
        return value.trim();
    }

    if (Array.isArray(value)) {
        return value
            .map((item) => normalizeDescription(item))
            .filter(Boolean)
            .join(" ");
    }

    if (typeof value === "object") {
        const nested =
            value.text ??
            value.value ??
            value.description ??
            value.short_description ??
            value.long_description ??
            value.product_description ??
            value.content ??
            "";

        return normalizeDescription(nested);
    }

    return String(value).trim();
}

function ProductCard({ product }) {
    const navigate = useNavigate();
    const [isWishlisted, setIsWishlisted] = useState(false);

    // Product image
    const getImage = () => {
        let image =
            product?.image ||
            product?.image_url ||
            product?.imageUrl ||
            product?.main_image ||
            product?.primary_image ||
            product?.thumbnail ||
            product?.product_image ||
            product?.images?.[0];

        if (image && typeof image === "object") {
            image =
                image.image_url ||
                image.imageUrl ||
                image.image ||
                image.url ||
                image.path ||
                image.file_path;
        }

        if (typeof image !== "string" || !image.trim()) {
            return "https://placehold.co/400x400?text=Product";
        }

        image = image.trim();

        if (
            image.startsWith("http://") ||
            image.startsWith("https://") ||
            image.startsWith("data:")
        ) {
            return image;
        }

        return `${API_BASE_URL}/${image.replace(/^\/+/, "")}`;
    };

    const image = getImage();

    // Product name
    const name =
        product?.name ||
        product?.product_name ||
        product?.title ||
        "Product";

    // Short description
    const description =
        normalizeDescription(
            product?.short_description ??
            product?.shortDescription ??
            product?.description ??
            product?.long_description ??
            product?.product_description
        ) || "No description available.";

    // Prices
    const originalPrice = Number(
        product?.base_price ??
        product?.original_price ??
        product?.oldPrice ??
        product?.regular_price ??
        0
    );

    const price = Number(
        product?.sale_price ??
        product?.selling_price ??
        product?.price ??
        product?.base_price ??
        product?.regular_price ??
        0
    );

    // Discount percentage
    const apiDiscount = Number(product?.discount_percentage);

    const discount =
        originalPrice > 0 && price < originalPrice
            ? Math.round(
                  ((originalPrice - price) / originalPrice) * 100
              )
            : apiDiscount > 0
              ? Math.round(apiDiscount)
              : 0;

    const hasDiscount =
        discount > 0 && originalPrice > price;
    const isFlashSale = Boolean(Number(product?.flash_sale_active));

    // Format price
    const formatPrice = (value) =>
        `₹${Number(value || 0).toLocaleString("en-IN", {
            maximumFractionDigits: 2,
        })}`;

    // Product ID
    const productId =
        product?.id ??
        product?.product_id;

    // Wishlist toggle
    const handleWishlist = () => {
        setIsWishlisted((previous) => !previous);
    };

    // Navigate to product details
    const handleViewProduct = () => {
        if (!productId) {
            alert("Product ID is not available.");
            return;
        }

        navigate(`/product/${productId}`);
    };

    return (
        <article className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-gray-200 hover:shadow-xl">

            {/* PRODUCT IMAGE */}
            <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-gray-50 p-4 sm:p-5">

                <img
                    src={image}
                    alt={name}
                    loading="lazy"
                    className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
                    onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src =
                            "https://placehold.co/400x400?text=Product";
                    }}
                />

                {/* DISCOUNT BADGE */}
                {isFlashSale ? (
                    <span className="absolute left-3 top-3 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm sm:text-xs">
                        FLASH SALE{hasDiscount ? ` · ${discount}% OFF` : ""}
                    </span>
                ) : hasDiscount ? (
                    <span className="absolute left-3 top-3 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm sm:text-xs">
                        {discount}% OFF
                    </span>
                ) : null}

                {/* WISHLIST BUTTON */}
                <button
                    type="button"
                    onClick={handleWishlist}
                    aria-label={
                        isWishlisted
                            ? "Remove from wishlist"
                            : "Add to wishlist"
                    }
                    aria-pressed={isWishlisted}
                    className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md transition-all duration-200 hover:scale-110 ${
                        isWishlisted
                            ? "text-red-500"
                            : "text-gray-500 hover:text-red-500"
                    }`}
                >
                    <i
                        className={`${
                            isWishlisted
                                ? "fa-solid"
                                : "fa-regular"
                        } fa-heart text-lg`}
                    />
                </button>
            </div>

            {/* PRODUCT DETAILS */}
            <div className="flex flex-1 flex-col p-3 sm:p-4">

                {/* BRAND */}
                {product?.brand_name && (
                    <p className="mb-1 truncate text-[10px] font-semibold uppercase tracking-wider text-gray-400 sm:text-xs">
                        {product.brand_name}
                    </p>
                )}

                {/* PRODUCT NAME */}
                <h3
                    title={name}
                    className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-cyprus transition-colors group-hover:text-ocean-green sm:min-h-12 sm:text-base sm:leading-6"
                >
                    {name}
                </h3>

                {/* SHORT DESCRIPTION */}
                <p
                    title={description}
                    className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-gray-500 sm:text-sm"
                >
                    {description}
                </p>

                {/* PRICE */}
                <div className="mt-3 flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-base font-bold text-ocean-green sm:text-lg">
                        {formatPrice(price)}
                    </span>

                    {hasDiscount && (
                        <span className="text-xs text-gray-400 line-through sm:text-sm">
                            {formatPrice(originalPrice)}
                        </span>
                    )}
                </div>

                {/* DISCOUNT AND SAVINGS */}
                {hasDiscount && (
                    <div className="mt-1">
                        <p className="text-[11px] font-semibold text-emerald-600 sm:text-xs">
                            Discount: {discount}%
                        </p>

                        <p className="mt-1 text-[11px] text-gray-500 sm:text-xs">
                            You save{" "}
                            {formatPrice(originalPrice - price)}
                        </p>
                    </div>
                )}

                {/* VIEW PRODUCT BUTTON */}
                <button
                    type="button"
                    onClick={handleViewProduct}
                    className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-cyprus px-3 py-2.5 text-xs font-semibold text-white transition-all duration-300 hover:bg-ocean-green active:scale-[0.98] sm:mt-4 sm:py-3 sm:text-sm"
                >
                    <span>View Product</span>
                    <i className="fa-solid fa-arrow-right text-xs transition-transform duration-300 group-hover:translate-x-1" />
                </button>
            </div>
        </article>
    );
}

export default ProductCard;