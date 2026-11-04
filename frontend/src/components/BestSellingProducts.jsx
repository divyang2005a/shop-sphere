import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const API_BASE_URL = "http://192.168.1.20:5000";

function getImageUrl(image) {
    if (image && typeof image === "object") {
        image =
            image.image_url ??
            image.imageUrl ??
            image.url ??
            image.image ??
            image.path ??
            image.file_path;
    }

    if (typeof image !== "string" || !image.trim()) {
        return "https://placehold.co/900x600?text=Product";
    }

    const trimmedImage = image.trim();
    if (/^(https?:\/\/|data:|blob:)/i.test(trimmedImage)) {
        return trimmedImage;
    }

    return `${API_BASE_URL}/${trimmedImage.replace(/^\/+/, "")}`;
}

function formatPrice(value) {
    return `₹${Number(value || 0).toLocaleString("en-IN", {
        maximumFractionDigits: 2,
    })}`;
}

function BestSellingProducts() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const controller = new AbortController();

        async function loadBestSellers() {
            try {
                const response = await fetch(
                    `${API_BASE_URL}/api/products/best-selling?limit=4`,
                    { signal: controller.signal }
                );

                if (!response.ok) {
                    throw new Error(
                        `Unable to load best-selling products (${response.status}).`
                    );
                }

                const result = await response.json();
                if (!Array.isArray(result.products)) {
                    throw new Error("Best-selling products response is invalid.");
                }

                setProducts(result.products);
            } catch (fetchError) {
                if (fetchError.name !== "AbortError") {
                    console.error("Best-selling products error:", fetchError);
                    setError("Best-selling products could not be loaded.");
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        loadBestSellers();

        return () => controller.abort();
    }, []);

    return (
        <section className="bg-white py-10 sm:py-12 lg:py-16">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[2px] text-ocean-green">
                            Customer Favorites
                        </p>

                        <h2 className="mt-1 text-2xl font-bold text-cyprus sm:text-3xl">
                            Best Selling Product
                        </h2>
                    </div>

                    <Link
                        to="/products"
                        className="rounded-full border border-cyprus px-4 py-2 text-xs font-bold text-cyprus transition hover:bg-cyprus hover:text-white sm:px-5"
                    >
                        View All
                    </Link>
                </div>

                {loading ? (
                    <div className="grid gap-5 md:grid-cols-2">
                        {Array.from({ length: 4 }, (_, index) => (
                            <div
                                key={`best-seller-skeleton-${index}`}
                                className="min-h-[300px] animate-pulse rounded-2xl bg-gray-100"
                            />
                        ))}
                    </div>
                ) : error ? (
                    <p className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500">
                        {error}
                    </p>
                ) : products.length === 0 ? (
                    <p className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500">
                        No best-selling products are available right now.
                    </p>
                ) : (
                    <div className="grid gap-5 md:grid-cols-2">
                        {products.map((product, index) => {
                            const basePrice = Number(
                                product.base_price ?? product.sale_price ?? 0
                            );
                            const currentPrice = Number(
                                product.sale_price ?? product.base_price ?? 0
                            );
                            const hasDiscount = basePrice > currentPrice;
                            const discount = hasDiscount
                                ? Math.round(
                                      ((basePrice - currentPrice) / basePrice) * 100
                                  )
                                : 0;
                            const productLink = `/product/${product.id}`;

                            return (
                                <div
                                    key={product.id}
                                    className={`group relative overflow-hidden rounded-2xl bg-cyprus ${
                                        index === 0
                                            ? "min-h-[360px]"
                                            : "min-h-[300px]"
                                    }`}
                                >
                                    <img
                                        src={getImageUrl(product.image)}
                                        alt={product.title}
                                        loading="lazy"
                                        className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                                        onError={(event) => {
                                            event.currentTarget.onerror = null;
                                            event.currentTarget.src =
                                                "https://placehold.co/900x600?text=Product";
                                        }}
                                    />

                                    <div className="absolute inset-0 bg-gradient-to-r from-cyprus/95 via-cyprus/60 to-transparent" />

                                    {(product.flash_sale_active || discount > 0) && (
                                        <div className="absolute right-4 top-4 rounded-full bg-error px-3 py-1.5 text-[10px] font-bold text-white">
                                            {product.flash_sale_active
                                                ? "FLASH SALE"
                                                : `${discount}% OFF`}
                                        </div>
                                    )}

                                    <div className="relative z-10 flex min-h-[300px] max-w-[430px] flex-col justify-center p-6 sm:p-8">
                                        <p className="text-xs font-bold uppercase tracking-[1.5px] text-surf-crest">
                                            Best Seller
                                        </p>

                                        <h3 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                                            {product.title}
                                        </h3>

                                        {product.short_description && (
                                            <p className="mt-2 max-w-sm text-sm leading-6 text-white/70">
                                                {product.short_description}
                                            </p>
                                        )}

                                        <div className="mt-4 flex items-center gap-3">
                                            <span className="text-xl font-bold text-surf-crest">
                                                {formatPrice(currentPrice)}
                                            </span>

                                            {hasDiscount && (
                                                <span className="text-sm text-white/50 line-through">
                                                    {formatPrice(basePrice)}
                                                </span>
                                            )}
                                        </div>

                                        <Link
                                            to={productLink}
                                            className="mt-5 inline-flex w-fit items-center rounded-full bg-surf-crest px-6 py-3 text-xs font-bold text-cyprus transition duration-300 hover:bg-white"
                                        >
                                            Shop Now
                                            <span className="ml-2 text-sm">→</span>
                                        </Link>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
}

export default BestSellingProducts;
