import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ProductCard from "./ProductCard";

const API_URL = "http://192.168.1.20:5000/api";

function TrendingProducts() {
    const navigate = useNavigate();

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Wishlist states
    const [wishlistItems, setWishlistItems] = useState({});
    const [wishlistLoading, setWishlistLoading] = useState({});

    // Fetch Trending Products
    useEffect(() => {
        const controller = new AbortController();

        const loadTrendingProducts = async () => {
            try {
                const response = await fetch(
                    `${API_URL}/products/recommended?limit=3`,
                    { signal: controller.signal }
                );

                if (!response.ok) {
                    throw new Error(
                        `Unable to load trending products (${response.status}).`
                    );
                }

                const result = await response.json();
                const productList =
                    result.products ?? result.data?.products;

                if (!Array.isArray(productList)) {
                    throw new Error("Trending products response is invalid.");
                }

                setProducts(productList);
            } catch (fetchError) {
                if (fetchError.name !== "AbortError") {
                    console.error("Trending products error:", fetchError);
                    setError("Trending products could not be loaded.");
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        loadTrendingProducts();

        return () => controller.abort();
    }, []);

    // Fetch Wishlist
    const fetchWishlist = async () => {
        const token = localStorage.getItem("shopsphereToken");

        if (!token) {
            setWishlistItems({});
            return;
        }

        try {
            const response = await fetch(`${API_URL}/wishlist`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error("Unable to load wishlist.");
            }

            const result = await response.json();

            const items =
                result.data?.items || result.items || [];

            const wishlistMap = {};

            items.forEach((item) => {
                const productId = Number(
                    item.product_id ?? item.product?.id
                );

                const wishlistItemId =
                    item.wishlist_item_id ?? item.id;

                if (productId && wishlistItemId) {
                    wishlistMap[productId] = wishlistItemId;
                }
            });

            setWishlistItems(wishlistMap);
        } catch (error) {
            console.error("Wishlist fetch error:", error);
        }
    };

    useEffect(() => {
        fetchWishlist();
    }, []);

    // Add / Remove Wishlist
    const handleWishlist = async (product) => {
        const token = localStorage.getItem("shopsphereToken");

        if (!token) {
            navigate("/login");
            return;
        }

        const productId = Number(product.id ?? product.product_id);

        if (!productId) {
            console.error("Invalid product ID:", product);
            return;
        }

        if (wishlistLoading[productId]) return;

        setWishlistLoading((previous) => ({
            ...previous,
            [productId]: true,
        }));

        try {
            const wishlistItemId = wishlistItems[productId];

            // Remove from Wishlist
            if (wishlistItemId) {
                const response = await fetch(
                    `${API_URL}/wishlist/items/${wishlistItemId}`,
                    {
                        method: "DELETE",
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(
                        result.message || "Failed to remove from wishlist."
                    );
                }

                setWishlistItems((previous) => {
                    const updated = { ...previous };
                    delete updated[productId];
                    return updated;
                });
            }

            // Add to Wishlist
            else {
                const response = await fetch(
                    `${API_URL}/wishlist/items`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                            product_id: productId,
                        }),
                    }
                );

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(
                        result.message || "Failed to add to wishlist."
                    );
                }

                const newWishlistItemId =
                    result.data?.wishlist_item_id;

                if (newWishlistItemId) {
                    setWishlistItems((previous) => ({
                        ...previous,
                        [productId]: newWishlistItemId,
                    }));
                }
            }
        } catch (error) {
            console.error("Wishlist error:", error);
            alert(error.message || "Something went wrong.");
        } finally {
            setWishlistLoading((previous) => ({
                ...previous,
                [productId]: false,
            }));
        }
    };

    return (
        <section className="bg-white py-10 sm:py-12 lg:py-16">

            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

                <div className="mb-6 flex items-center justify-between">

                    <div>
                        <p className="text-xs font-bold uppercase tracking-[2px] text-ocean-green">
                            Trending Now
                        </p>

                        <h2 className="mt-1 text-2xl font-bold text-cyprus sm:text-3xl">
                            Trending Product
                        </h2>
                    </div>

                </div>

                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

                    {products.map((product) => {
                        const productId = Number(
                            product.id ?? product.product_id
                        );

                        return (
                            <ProductCard
                                key={productId}
                                product={product}
                                isWishlisted={Boolean(
                                    wishlistItems[productId]
                                )}
                                onWishlistToggle={() =>
                                    handleWishlist(product)
                                }
                                wishlistLoading={Boolean(
                                    wishlistLoading[productId]
                                )}
                            />
                        );
                    })}

                    {loading &&
                        Array.from({ length: 3 }, (_, index) => (
                            <div
                                key={`trending-skeleton-${index}`}
                                className="animate-pulse overflow-hidden rounded-2xl border border-gray-100"
                                aria-hidden="true"
                            >
                                <div className="aspect-square bg-gray-100" />

                                <div className="space-y-3 p-4">
                                    <div className="h-4 w-3/4 rounded bg-gray-100" />
                                    <div className="h-4 w-full rounded bg-gray-100" />
                                    <div className="h-5 w-1/3 rounded bg-gray-100" />
                                </div>
                            </div>
                        ))}

                    {!loading && error && (
                        <p className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500 sm:col-span-2 lg:col-span-3">
                            {error}
                        </p>
                    )}

                    <div className="group relative min-h-[450px] overflow-hidden rounded-xl bg-cyprus">

                        <img
                            src="https://images.unsplash.com/photo-1488161628813-04466f872be2?auto=format&fit=crop&w=700&q=85"
                            alt="Trend collection for men"
                            className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                        />

                        <div className="absolute inset-0 bg-gradient-to-t from-cyprus via-cyprus/50 to-transparent"></div>

                        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">

                            <p className="text-xs font-bold uppercase tracking-[2px] text-surf-crest">
                                New Collection
                            </p>

                            <h3 className="mt-2 text-2xl font-bold text-white">
                                Trend Collection
                                <br />
                                For Men
                            </h3>

                            <p className="mt-2 text-sm leading-5 text-white/70">
                                Discover the latest styles designed for
                                modern everyday looks.
                            </p>

                            <Link
                                to="/products"
                                className="mt-5 inline-flex items-center rounded-full bg-surf-crest px-5 py-2.5 text-xs font-bold text-cyprus transition hover:bg-white"
                            >
                                Explore Now

                                <span className="ml-2 text-sm">
                                    →
                                </span>
                            </Link>

                        </div>

                    </div>

                </div>

            </div>

        </section>
    );
}

export default TrendingProducts;