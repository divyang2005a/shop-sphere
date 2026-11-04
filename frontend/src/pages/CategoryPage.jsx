
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ProductCard from "../components/ProductCard";

const API_BASE_URL = "http://localhost:5000";

// Frontend category slug -> Backend category
const categoryMap = {
    "for-you": "",
    mobiles: "mobile",
    mobile: "mobile",
    fashion: "fashion",
    electronics: "electronics",
    beauty: "beauty",
    appliances: "appliances",
    "2-wheelers": "2-wheeler",
    "toys-baby": "toys",
    toys: "toys",
    "food-health": "food",
    food: "food",
    "auto-accessories": "auto-accessories",
    sports: "sports",
    furniture: "furniture",
    books: "books",
    grocery: "grocery",
};

// Category display name
function getCategoryName(slug = "") {
    const names = {
        "for-you": "For You",
        fashion: "Fashion",
        mobiles: "Mobiles",
        mobile: "Mobiles",
        electronics: "Electronics",
        beauty: "Beauty",
        appliances: "Appliances",
        "2-wheelers": "2 Wheelers",
        "toys-baby": "Toys & Baby",
        toys: "Toys & Baby",
        "food-health": "Food & Health",
        food: "Food & Health",
        "auto-accessories": "Auto Accessories",
        sports: "Sports",
        furniture: "Furniture",
        books: "Books",
        grocery: "Grocery",
    };

    return names[slug.toLowerCase()] || slug.replaceAll("-", " ");
}

// Product name
function getProductName(product) {
    return (
        product?.name ||
        product?.product_name ||
        product?.title ||
        product?.productName ||
        "Unnamed Product"
    );
}

// Product price
function getProductPrice(product) {
    return Number(
        product?.sale_price ??
        product?.selling_price ??
        product?.sellingPrice ??
        product?.discount_price ??
        product?.price ??
        product?.base_price ??
        0
    );
}

// Extract products or images from API responses
function getProductList(responseData) {
    if (Array.isArray(responseData)) {
        return responseData;
    }

    if (Array.isArray(responseData?.products)) {
        return responseData.products;
    }

    if (Array.isArray(responseData?.data?.products)) {
        return responseData.data.products;
    }

    if (Array.isArray(responseData?.data)) {
        return responseData.data;
    }

    if (Array.isArray(responseData?.result)) {
        return responseData.result;
    }

    if (Array.isArray(responseData?.rows)) {
        return responseData.rows;
    }

    if (Array.isArray(responseData?.images)) {
        return responseData.images;
    }

    if (Array.isArray(responseData?.data?.images)) {
        return responseData.data.images;
    }

    return [];
}

// Product ID
function getProductId(product) {
    return (
        product?.product_id ??
        product?.productId ??
        product?.id ??
        product?._id
    );
}

// Authentication headers
function getAuthHeaders(includeJson = false) {
    const headers = {
        Accept: "application/json",
    };

    if (includeJson) {
        headers["Content-Type"] = "application/json";
    }

    const token = localStorage.getItem("shopsphereToken");

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return headers;
}

// Normalize image URL
function getImageUrl(image) {
    if (!image) return "";

    if (typeof image === "object") {
        image =
            image.image_url ||
            image.imageUrl ||
            image.url ||
            image.image ||
            image.path ||
            image.file_path;
    }

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

    return `${API_BASE_URL}/${image.replace(/^\/+/, "")}`;
}

// Check if product already contains an image
function hasProductImage(product) {
    return Boolean(
        product?.image ||
        product?.image_url ||
        product?.imageUrl ||
        product?.thumbnail ||
        product?.primary_image ||
        product?.images?.length ||
        product?.product_images?.length
    );
}

// Extract wishlist items
function getWishlistItems(response) {
    if (Array.isArray(response?.items)) {
        return response.items;
    }

    if (Array.isArray(response?.data?.items)) {
        return response.data.items;
    }

    if (Array.isArray(response?.wishlists)) {
        return response.wishlists.flatMap((wishlist) =>
            Array.isArray(wishlist.items) ? wishlist.items : []
        );
    }

    if (Array.isArray(response?.data?.wishlists)) {
        return response.data.wishlists.flatMap((wishlist) =>
            Array.isArray(wishlist.items) ? wishlist.items : []
        );
    }

    return [];
}

// Create a product-ID -> wishlist-item map
function createWishlistMap(items) {
    const map = {};

    items.forEach((item) => {
        const productId =
            item?.product_id ??
            item?.productId ??
            item?.product?.product_id ??
            item?.product?.id;

        const wishlistItemId =
            item?.wishlist_item_id ??
            item?.item_id ??
            item?.wishlistItemId ??
            item?.id;

        if (productId != null) {
            map[String(productId)] = {
                wishlistItemId,
            };
        }
    });

    return map;
}

function CategoryPage() {
    const { categorySlug = "" } = useParams();
    const navigate = useNavigate();

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [sortBy, setSortBy] = useState("default");

    // Wishlist state
    const [wishlistItems, setWishlistItems] = useState({});
    const [wishlistLoading, setWishlistLoading] = useState({});
    const [wishlistError, setWishlistError] = useState("");

    const normalizedSlug = categorySlug.toLowerCase().trim();
    const categoryName = getCategoryName(normalizedSlug);

    // --------------------------------------------------
    // FETCH PRODUCTS
    // --------------------------------------------------
    useEffect(() => {
        const controller = new AbortController();

        async function fetchProducts() {
            try {
                setLoading(true);
                setError("");
                setProducts([]);

                if (!normalizedSlug) {
                    throw new Error(
                        "Category is missing from the URL."
                    );
                }

                const apiCategory =
                    Object.prototype.hasOwnProperty.call(
                        categoryMap,
                        normalizedSlug
                    )
                        ? categoryMap[normalizedSlug]
                        : normalizedSlug;

                const apiUrl = apiCategory
                    ? `${API_BASE_URL}/api/products?category=${encodeURIComponent(
                          apiCategory
                      )}`
                    : `${API_BASE_URL}/api/products`;

                console.log("Category slug:", normalizedSlug);
                console.log("Backend category:", apiCategory);
                console.log("Products API:", apiUrl);

                const response = await fetch(apiUrl, {
                    signal: controller.signal,
                    headers: {
                        Accept: "application/json",
                    },
                });

                if (!response.ok) {
                    throw new Error(
                        `Unable to load products. Status: ${response.status}`
                    );
                }

                const responseData = await response.json();
                const productList = getProductList(responseData);

                console.log("Products API response:", responseData);

                if (
                    !Array.isArray(responseData) &&
                    productList.length === 0
                ) {
                    console.warn(
                        "No products array found. Check the API response structure."
                    );
                }

                if (controller.signal.aborted) return;

                // Show products immediately
                setProducts(productList);

                // Fetch missing images separately
                const productsWithImages = await Promise.all(
                    productList.map(async (product) => {
                        if (hasProductImage(product)) {
                            const existingImage =
                                product.image ||
                                product.image_url ||
                                product.imageUrl ||
                                product.thumbnail ||
                                product.images?.[0] ||
                                product.product_images?.[0] ||
                                product.primary_image;

                            return {
                                ...product,
                                image: getImageUrl(existingImage),
                            };
                        }

                        const productId = getProductId(product);

                        if (productId == null) {
                            return product;
                        }

                        try {
                            const imageResponse = await fetch(
                                `${API_BASE_URL}/api/products/${encodeURIComponent(
                                    productId
                                )}/images`,
                                {
                                    signal: controller.signal,
                                    headers: getAuthHeaders(),
                                }
                            );

                            if (!imageResponse.ok) {
                                console.warn(
                                    `Images unavailable for product ${productId}:`,
                                    imageResponse.status
                                );

                                return product;
                            }

                            const imageData =
                                await imageResponse.json();

                            const images = getProductList(imageData);

                            const firstImage =
                                images[0] ||
                                imageData?.image ||
                                imageData?.image_url ||
                                imageData?.data?.image ||
                                imageData?.data?.image_url;

                            if (!firstImage) {
                                return product;
                            }

                            return {
                                ...product,
                                image: getImageUrl(firstImage),
                                images,
                            };
                        } catch (imageError) {
                            if (imageError.name !== "AbortError") {
                                console.error(
                                    `Image fetch failed for product ${productId}:`,
                                    imageError
                                );
                            }

                            return product;
                        }
                    })
                );

                if (!controller.signal.aborted) {
                    setProducts(productsWithImages);
                }
            } catch (err) {
                if (err.name !== "AbortError") {
                    console.error("Products fetch error:", err);
                    setError(
                        err.message || "Unable to load products."
                    );
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        fetchProducts();

        return () => controller.abort();
    }, [normalizedSlug]);

    // --------------------------------------------------
    // FETCH WISHLIST
    // --------------------------------------------------
    useEffect(() => {
        const controller = new AbortController();

        async function fetchWishlist() {
            const token = localStorage.getItem("shopsphereToken");

            if (!token) {
                setWishlistItems({});
                return;
            }

            try {
                const response = await fetch(
                    `${API_BASE_URL}/api/wishlist`,
                    {
                        signal: controller.signal,
                        headers: getAuthHeaders(),
                    }
                );

                if (!response.ok) {
                    if (response.status === 401) {
                        setWishlistItems({});
                        return;
                    }

                    throw new Error(
                        `Wishlist request failed: ${response.status}`
                    );
                }

                const result = await response.json();

                if (!controller.signal.aborted) {
                    setWishlistItems(
                        createWishlistMap(getWishlistItems(result))
                    );
                }
            } catch (err) {
                if (err.name !== "AbortError") {
                    console.error("Wishlist fetch error:", err);
                }
            }
        }

        fetchWishlist();

        return () => controller.abort();
    }, []);

    // --------------------------------------------------
    // ADD / REMOVE WISHLIST
    // --------------------------------------------------
    async function toggleWishlist(product) {
        const productId = getProductId(product);

        if (productId == null) {
            setWishlistError("Product ID not found.");
            return;
        }

        const token = localStorage.getItem("shopsphereToken");

        if (!token) {
            setWishlistError(
                "Please log in to add products to your wishlist."
            );
            return;
        }

        const key = String(productId);
        const existingItem = wishlistItems[key];

        setWishlistError("");

        setWishlistLoading((previous) => ({
            ...previous,
            [key]: true,
        }));

        try {
            let response;

            if (existingItem) {
                const wishlistItemId =
                    existingItem.wishlistItemId;

                if (wishlistItemId == null) {
                    throw new Error(
                        "Wishlist item ID not found. Refresh the page and try again."
                    );
                }

                response = await fetch(
                    `${API_BASE_URL}/api/wishlist/items/${encodeURIComponent(
                        wishlistItemId
                    )}`,
                    {
                        method: "DELETE",
                        headers: getAuthHeaders(),
                    }
                );
            } else {
                response = await fetch(
                    `${API_BASE_URL}/api/wishlist/items`,
                    {
                        method: "POST",
                        headers: getAuthHeaders(true),
                        body: JSON.stringify({
                            product_id: productId,
                        }),
                    }
                );
            }

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    result?.message ||
                        `Wishlist update failed: ${response.status}`
                );
            }

            if (existingItem) {
                setWishlistItems((previous) => {
                    const updated = { ...previous };
                    delete updated[key];
                    return updated;
                });
            } else {
                // Reload wishlist to obtain the actual item ID
                const wishlistResponse = await fetch(
                    `${API_BASE_URL}/api/wishlist`,
                    {
                        headers: getAuthHeaders(),
                    }
                );

                if (wishlistResponse.ok) {
                    const wishlistData =
                        await wishlistResponse.json();

                    setWishlistItems(
                        createWishlistMap(
                            getWishlistItems(wishlistData)
                        )
                    );
                } else {
                    setWishlistItems((previous) => ({
                        ...previous,
                        [key]: {
                            wishlistItemId:
                                result?.data?.wishlist_item_id ??
                                result?.wishlist_item_id ??
                                null,
                        },
                    }));
                }
            }
        } catch (err) {
            console.error("Wishlist update error:", err);
            setWishlistError(
                err.message || "Unable to update wishlist."
            );
        } finally {
            setWishlistLoading((previous) => ({
                ...previous,
                [key]: false,
            }));
        }
    }

    // --------------------------------------------------
    // VIEW PRODUCT DETAILS
    // --------------------------------------------------
    function handleViewProduct(product) {
        const productId = getProductId(product);

        if (productId == null) {
            setWishlistError(
                "Product ID not found. Unable to open product details."
            );
            return;
        }

        navigate(`/product/${encodeURIComponent(productId)}`);
    }

    // --------------------------------------------------
    // SEARCH AND SORT
    // --------------------------------------------------
    const filteredProducts = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    const productArray = Array.isArray(products)
        ? products
        : [];

    let result = productArray.filter((product) => {
            const name = getProductName(product).toLowerCase();

            const description = String(
                product?.short_description ??
                product?.shortDescription ??
                product?.description ??
                product?.long_description ??
                product?.product_description ??
                ""
            ).toLowerCase();

            const sku = String(product?.sku || "").toLowerCase();

            return (
                name.includes(searchText) ||
                description.includes(searchText) ||
                sku.includes(searchText)
            );
        });

        if (sortBy === "price-low") {
            result = [...result].sort(
                (a, b) => getProductPrice(a) - getProductPrice(b)
            );
        } else if (sortBy === "price-high") {
            result = [...result].sort(
                (a, b) => getProductPrice(b) - getProductPrice(a)
            );
        } else if (sortBy === "name") {
            result = [...result].sort((a, b) =>
                getProductName(a).localeCompare(getProductName(b))
            );
        }

        return result;
    }, [products, search, sortBy]);

    // --------------------------------------------------
    // RENDER
    // --------------------------------------------------
    return (
        <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-[1500px]">

                {/* CATEGORY HEADING */}
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-sm font-semibold text-emerald-600">
                            Shop by Category
                        </p>

                        <h1 className="mt-1 text-2xl font-bold capitalize text-gray-900 sm:text-3xl">
                            {categoryName}
                        </h1>

                        <p className="mt-2 text-sm text-gray-500">
                            Explore products in {categoryName}.
                        </p>
                    </div>

                    {!loading && !error && (
                        <p className="text-sm text-gray-500">
                            {filteredProducts.length} products
                        </p>
                    )}
                </div>

                {/* SEARCH AND SORT */}
                <div className="mb-6 flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 sm:flex-row">
                    <div className="flex-1">
                        <input
                            type="search"
                            value={search}
                            onChange={(event) =>
                                setSearch(event.target.value)
                            }
                            placeholder="Search products in this category..."
                            aria-label="Search products"
                            className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        />
                    </div>

                    <select
                        value={sortBy}
                        onChange={(event) =>
                            setSortBy(event.target.value)
                        }
                        aria-label="Sort products"
                        className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500"
                    >
                        <option value="default">
                            Default sorting
                        </option>
                        <option value="price-low">
                            Price: Low to High
                        </option>
                        <option value="price-high">
                            Price: High to Low
                        </option>
                        <option value="name">
                            Name: A to Z
                        </option>
                    </select>
                </div>

                {/* WISHLIST / PRODUCT ERROR */}
                {wishlistError && (
                    <div
                        role="alert"
                        className="mb-5 flex items-center justify-between gap-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
                    >
                        <span>{wishlistError}</span>

                        <button
                            type="button"
                            onClick={() => setWishlistError("")}
                            aria-label="Close message"
                            className="text-xl"
                        >
                            ×
                        </button>
                    </div>
                )}

                {/* LOADING */}
                {loading && (
                    <div className="flex min-h-64 items-center justify-center rounded-xl bg-white">
                        <div className="text-center">
                            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-emerald-600" />

                            <p className="mt-4 text-sm text-gray-500">
                                Loading {categoryName} products...
                            </p>
                        </div>
                    </div>
                )}

                {/* ERROR */}
                {!loading && error && (
                    <div className="rounded-xl border border-red-100 bg-white p-8 text-center">
                        <p className="font-semibold text-red-600">
                            Unable to load products
                        </p>

                        <p className="mt-2 text-sm text-gray-500">
                            {error}
                        </p>

                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="mt-4 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {/* NO PRODUCTS */}
                {!loading &&
                    !error &&
                    filteredProducts.length === 0 && (
                        <div className="rounded-xl border border-gray-100 bg-white px-5 py-16 text-center">
                            <i className="fa-solid fa-box-open text-5xl text-gray-300" />

                            <h2 className="mt-4 text-lg font-semibold text-gray-800">
                                No Products Found
                            </h2>

                            <p className="mt-2 text-sm text-gray-500">
                                No products match this category or search.
                            </p>

                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch("")}
                                    className="mt-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700"
                                >
                                    Clear Search
                                </button>
                            )}
                        </div>
                    )}

                {/* PRODUCT GRID */}
                {!loading &&
                    !error &&
                    filteredProducts.length > 0 && (
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                            {filteredProducts.map((product, index) => {
                                const productId = getProductId(product);

                                const key =
                                    productId ?? `product-${index}`;

                                const wishlistKey =
                                    productId != null
                                        ? String(productId)
                                        : "";

                                const image =
                                    getImageUrl(
                                        product.image ||
                                        product.image_url ||
                                        product.imageUrl ||
                                        product.thumbnail ||
                                        product.images?.[0] ||
                                        product.product_images?.[0] ||
                                        product.primary_image
                                    );

                                const productForCard = {
                                    ...product,
                                    image: image || product.image || "",
                                };

                                return (
                                    <div
                                        key={key}
                                        className="relative flex flex-col"
                                    >
                                        {/* WISHLIST BUTTON */}
                                        <button
                                            type="button"
                                            disabled={
                                                productId == null ||
                                                Boolean(
                                                    wishlistLoading[
                                                        wishlistKey
                                                    ]
                                                )
                                            }
                                            onClick={() =>
                                                toggleWishlist(product)
                                            }
                                            aria-label={
                                                wishlistItems[wishlistKey]
                                                    ? "Remove from wishlist"
                                                    : "Add to wishlist"
                                            }
                                            title={
                                                wishlistItems[wishlistKey]
                                                    ? "Remove from wishlist"
                                                    : "Add to wishlist"
                                            }
                                            className={`absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md transition hover:scale-110 disabled:opacity-50 ${
                                                wishlistItems[wishlistKey]
                                                    ? "text-red-500"
                                                    : "text-gray-500 hover:text-red-500"
                                            }`}
                                        >
                                            {wishlistLoading[
                                                wishlistKey
                                            ] ? (
                                                <i className="fa-solid fa-spinner animate-spin" />
                                            ) : (
                                                <i
                                                    className={`${
                                                        wishlistItems[
                                                            wishlistKey
                                                        ]
                                                            ? "fa-solid"
                                                            : "fa-regular"
                                                    } fa-heart`}
                                                />
                                            )}
                                        </button>

                                        {/* EXISTING REUSABLE PRODUCT CARD */}
                                        <div className="flex-1">
                                            <ProductCard
                                                product={productForCard}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
            </div>
        </main>
    );
}

export default CategoryPage;