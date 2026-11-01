
import React, { useEffect, useMemo, useState } from "react";

const API_URL = "http://192.168.1.10:5000/api/admin/products";
const IMAGE_API_URL = "http://192.168.1.10:5000/api/admin/products";
const SERVER_URL = "http://192.168.1.10:5000";

// Product Image Component
const ProductImage = ({ productId, title }) => {
    const [imageUrl, setImageUrl] = useState("");
    const [imageError, setImageError] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const fetchImage = async () => {
            try {
                const token = localStorage.getItem("shopsphereToken");

                if (!token) {
                    throw new Error("Token not found");
                }

                const response = await fetch(
                    `${IMAGE_API_URL}/${productId}/images`,
                    {
                        method: "GET",
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                const data = await response.json();

                if (!response.ok || data.success !== true) {
                    throw new Error(
                        data.message || "Unable to fetch product images"
                    );
                }

                const images = Array.isArray(data.images)
                    ? data.images
                    : [];

                if (images.length === 0) {
                    throw new Error("No product images found");
                }

                const selectedImage =
                    images.find(
                        (item) => Number(item.is_primary) === 1
                    ) || images[0];

                if (!selectedImage?.image) {
                    throw new Error("Image path not found");
                }

                const imagePath = selectedImage.image;

                const fullImageUrl = imagePath.startsWith("http")
                    ? imagePath
                    : `${SERVER_URL}/${imagePath.replace(/^\/+/, "")}`;

                if (!cancelled) {
                    setImageUrl(fullImageUrl);
                    setImageError(false);
                }
            } catch (error) {
                console.error(
                    `Product image error for product ${productId}:`,
                    error
                );

                if (!cancelled) {
                    setImageUrl("");
                    setImageError(true);
                }
            }
        };

        fetchImage();

        return () => {
            cancelled = true;
        };
    }, [productId]);

    if (imageError || !imageUrl) {
        return (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-aqua-spring text-ocean-green">
                <i className="fa-solid fa-box text-xl" />
            </div>
        );
    }

    return (
        <img
            src={imageUrl}
            alt={title || "Product"}
            onError={() => setImageError(true)}
            className="h-12 w-12 shrink-0 rounded-lg border border-gray-100 object-cover"
        />
    );
};

const Products = () => {
    const [products, setProducts] = useState([]);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [stockFilter, setStockFilter] = useState("all");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Delete confirmation state
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // Fetch All Products
    const fetchProducts = async () => {
        try {
            setLoading(true);
            setError("");

            const token = localStorage.getItem("shopsphereToken");

            if (!token) {
                throw new Error("Token not found. Please login again.");
            }

            const response = await fetch(API_URL, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            const data = await response.json();

            if (!response.ok || data.success !== true) {
                throw new Error(
                    data.message || "Failed to load products."
                );
            }

            setProducts(
                Array.isArray(data.products) ? data.products : []
            );
        } catch (err) {
            console.error("Fetch products error:", err);
            setError(err.message || "Something went wrong.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    // Open Delete Confirmation
    const openDeleteModal = (product) => {
        setSelectedProduct(product);
        setDeleteError("");
        setSuccessMessage("");
    };

    // Close Delete Confirmation
    const closeDeleteModal = () => {
        if (deleting) return;

        setSelectedProduct(null);
        setDeleteError("");
    };

    // Delete Product API
    const handleDeleteProduct = async () => {
        if (!selectedProduct || deleting) return;

        try {
            setDeleting(true);
            setDeleteError("");
            setSuccessMessage("");

            const token = localStorage.getItem("shopsphereToken");

            if (!token) {
                throw new Error("Token not found. Please login again.");
            }

            const response = await fetch(
                `${API_URL}/${selectedProduct.id}`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            const data = await response.json();

            if (!response.ok || data.success !== true) {
                throw new Error(
                    data.message || "Failed to delete product."
                );
            }

            // Remove the deleted product from the current list
            setProducts((previousProducts) =>
                previousProducts.filter(
                    (product) =>
                        String(product.id) !==
                        String(selectedProduct.id)
                )
            );

            setSuccessMessage(
                data.message || "Product deleted successfully."
            );

            setSelectedProduct(null);
        } catch (err) {
            console.error("Delete product error:", err);
            setDeleteError(
                err.message || "Unable to delete this product."
            );
        } finally {
            setDeleting(false);
        }
    };

    // Price Format
    const formatPrice = (price) => {
        if (price === null || price === undefined || price === "") {
            return "—";
        }

        const amount = Number(price);

        if (!Number.isFinite(amount)) {
            return "—";
        }

        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 2,
        }).format(amount);
    };

    // Product Stock Status
    const getStockStatus = (product) => {
        const quantity = Number(product.stock_quantity ?? 0);
        const threshold = Number(product.low_stock_threshold ?? 5);

        if (
            product.stock_status === "out_of_stock" ||
            quantity <= 0
        ) {
            return {
                label: "Out of Stock",
                className: "bg-red-100 text-red-700",
            };
        }

        if (
            product.stock_status === "low_stock" ||
            quantity <= threshold
        ) {
            return {
                label: "Low Stock",
                className: "bg-yellow-100 text-yellow-700",
            };
        }

        return {
            label: "In Stock",
            className: "bg-green-100 text-green-700",
        };
    };

    // Search and Filters
    const filteredProducts = useMemo(() => {
        const searchText = search.trim().toLowerCase();

        return products.filter((product) => {
            const matchesSearch = [
                product.title,
                product.sku,
                product.product_code,
                product.slug,
            ].some((value) =>
                String(value ?? "")
                    .toLowerCase()
                    .includes(searchText)
            );

            const matchesStatus =
                statusFilter === "all" ||
                product.status === statusFilter;

            const stock = getStockStatus(product).label;

            const matchesStock =
                stockFilter === "all" ||
                stock === stockFilter;

            return (
                matchesSearch &&
                matchesStatus &&
                matchesStock
            );
        });
    }, [products, search, statusFilter, stockFilter]);

    const activeProducts = products.filter(
        (product) => product.status === "active"
    ).length;

    const outOfStockProducts = products.filter(
        (product) =>
            Number(product.stock_quantity ?? 0) <= 0 ||
            product.stock_status === "out_of_stock"
    ).length;

    const lowStockProducts = products.filter((product) => {
        const quantity = Number(product.stock_quantity ?? 0);
        const threshold = Number(product.low_stock_threshold ?? 5);

        return (
            quantity > 0 &&
            (
                product.stock_status === "low_stock" ||
                quantity <= threshold
            )
        );
    }).length;

    // Loading Screen
    if (loading) {
        return (
            <div className="flex min-h-96 items-center justify-center bg-aqua-spring/30">
                <div className="text-center">
                    <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-ocean-green border-t-transparent" />
                    <p className="mt-4 text-sm text-text-grey">
                        Loading products...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-aqua-spring/30 p-4 sm:p-6 lg:p-8">

            {/* Page Header */}
            <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-cyprus sm:text-3xl">
                        All Products
                    </h1>
                    <p className="mt-1 text-sm text-text-grey">
                        Manage and monitor your store products.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={fetchProducts}
                    className="rounded-lg bg-ocean-green px-5 py-3 font-semibold text-white transition hover:bg-cyprus"
                >
                    <i className="fa-solid fa-rotate-right mr-2" />
                    Refresh Products
                </button>
            </div>

            {/* Success Message */}
            {successMessage && (
                <div className="mb-6 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-green-700">
                    <i className="fa-solid fa-circle-check text-xl" />
                    <p>{successMessage}</p>
                    <button
                        type="button"
                        onClick={() => setSuccessMessage("")}
                        className="ml-auto text-lg"
                        aria-label="Dismiss success message"
                    >
                        <i className="fa-solid fa-xmark" />
                    </button>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <p>
                            <i className="fa-solid fa-circle-exclamation mr-2" />
                            {error}
                        </p>
                        <button
                            type="button"
                            onClick={fetchProducts}
                            className="font-semibold underline"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            )}

            {!error && (
                <>
                    {/* Summary Cards */}
                    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

                        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-text-grey">
                                        Total Products
                                    </p>
                                    <h2 className="mt-2 text-2xl font-bold text-cyprus">
                                        {products.length}
                                    </h2>
                                </div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-aqua-spring text-ocean-green">
                                    <i className="fa-solid fa-boxes-stacked text-xl" />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-text-grey">
                                        Active Products
                                    </p>
                                    <h2 className="mt-2 text-2xl font-bold text-green-600">
                                        {activeProducts}
                                    </h2>
                                </div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-600">
                                    <i className="fa-solid fa-circle-check text-xl" />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-text-grey">
                                        Low Stock
                                    </p>
                                    <h2 className="mt-2 text-2xl font-bold text-yellow-600">
                                        {lowStockProducts}
                                    </h2>
                                </div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-100 text-yellow-600">
                                    <i className="fa-solid fa-triangle-exclamation text-xl" />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-text-grey">
                                        Out of Stock
                                    </p>
                                    <h2 className="mt-2 text-2xl font-bold text-red-600">
                                        {outOfStockProducts}
                                    </h2>
                                </div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-600">
                                    <i className="fa-solid fa-box-open text-xl" />
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Search and Filters */}
                    <div className="mb-6 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

                            <div className="relative md:col-span-1">
                                <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-text-grey" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) =>
                                        setSearch(e.target.value)
                                    }
                                    placeholder="Search products, SKU, code..."
                                    className="w-full rounded-lg border border-gray-200 py-3 pl-11 pr-4 outline-none transition focus:border-ocean-green focus:ring-2 focus:ring-ocean-green/20"
                                />
                            </div>

                            <select
                                value={statusFilter}
                                onChange={(e) =>
                                    setStatusFilter(e.target.value)
                                }
                                className="rounded-lg border border-gray-200 bg-white px-4 py-3 outline-none focus:border-ocean-green"
                            >
                                <option value="all">All Statuses</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="draft">Draft</option>
                            </select>

                            <select
                                value={stockFilter}
                                onChange={(e) =>
                                    setStockFilter(e.target.value)
                                }
                                className="rounded-lg border border-gray-200 bg-white px-4 py-3 outline-none focus:border-ocean-green"
                            >
                                <option value="all">All Stock</option>
                                <option value="In Stock">In Stock</option>
                                <option value="Low Stock">Low Stock</option>
                                <option value="Out of Stock">Out of Stock</option>
                            </select>

                        </div>
                    </div>

                    {/* Product Table */}
                    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">

                        <div className="flex flex-col gap-2 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="font-bold text-cyprus">
                                    Product List
                                </h2>
                                <p className="mt-1 text-sm text-text-grey">
                                    Product information from your API.
                                </p>
                            </div>

                            <span className="text-sm text-text-grey">
                                Showing {filteredProducts.length} of{" "}
                                {products.length} products
                            </span>
                        </div>

                        {filteredProducts.length === 0 ? (
                            <div className="px-4 py-16 text-center">
                                <i className="fa-solid fa-box-open text-4xl text-gray-300" />
                                <h3 className="mt-4 font-semibold text-cyprus">
                                    No products found
                                </h3>
                                <p className="mt-1 text-sm text-text-grey">
                                    Try changing your search or filters.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1150px] text-left">
                                    <thead className="bg-gray-50 text-xs uppercase tracking-wider text-text-grey">
                                        <tr>
                                            <th className="px-5 py-4">Product</th>
                                            <th className="px-5 py-4">SKU</th>
                                            <th className="px-5 py-4">Category ID</th>
                                            <th className="px-5 py-4">Price</th>
                                            <th className="px-5 py-4">Stock</th>
                                            <th className="px-5 py-4">Stock Status</th>
                                            <th className="px-5 py-4">Product Status</th>
                                            <th className="px-5 py-4">Created</th>
                                            <th className="px-5 py-4 text-center">Action</th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-gray-100">
                                        {filteredProducts.map((product) => {
                                            const stockStatus =
                                                getStockStatus(product);

                                            return (
                                                <tr
                                                    key={product.id}
                                                    className="transition hover:bg-aqua-spring/30"
                                                >
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <ProductImage
                                                                productId={product.id}
                                                                title={product.title}
                                                            />
                                                            <div>
                                                                <p className="max-w-56 font-semibold text-cyprus">
                                                                    {product.title}
                                                                </p>
                                                                <p className="mt-1 text-xs text-text-grey">
                                                                    Code:{" "}
                                                                    {product.product_code || "—"}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="px-5 py-4 text-sm text-text-grey">
                                                        {product.sku || "—"}
                                                    </td>

                                                    <td className="px-5 py-4 text-sm text-text-grey">
                                                        {product.category_id ?? "—"}
                                                    </td>

                                                    <td className="px-5 py-4">
                                                        <p className="font-semibold text-cyprus">
                                                            {formatPrice(
                                                                product.sale_price ??
                                                                product.base_price
                                                            )}
                                                        </p>

                                                        {product.sale_price != null &&
                                                            Number(product.sale_price) <
                                                            Number(product.base_price) && (
                                                                <p className="mt-1 text-xs text-text-grey line-through">
                                                                    {formatPrice(product.base_price)}
                                                                </p>
                                                            )}
                                                    </td>

                                                    <td className="px-5 py-4 text-sm font-semibold text-cyprus">
                                                        {product.stock_quantity ?? 0}
                                                    </td>

                                                    <td className="px-5 py-4">
                                                        <span
                                                            className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${stockStatus.className}`}
                                                        >
                                                            {stockStatus.label}
                                                        </span>
                                                    </td>

                                                    <td className="px-5 py-4">
                                                        <span
                                                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                                                product.status === "active"
                                                                    ? "bg-green-100 text-green-700"
                                                                    : product.status === "draft"
                                                                    ? "bg-yellow-100 text-yellow-700"
                                                                    : "bg-gray-100 text-gray-600"
                                                            }`}
                                                        >
                                                            {product.status || "Unknown"}
                                                        </span>
                                                    </td>

                                                    <td className="whitespace-nowrap px-5 py-4 text-sm text-text-grey">
                                                        {product.created_at
                                                            ? new Date(
                                                                product.created_at
                                                            ).toLocaleDateString("en-IN")
                                                            : "—"}
                                                    </td>

                                                    {/* Delete Button */}
                                                    <td className="px-5 py-4 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                openDeleteModal(product)
                                                            }
                                                            title="Delete Product"
                                                            aria-label={`Delete ${product.title}`}
                                                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-300"
                                                        >
                                                            <i className="fa-solid fa-trash-can" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Delete Confirmation Modal */}
            {selectedProduct && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) {
                            closeDeleteModal();
                        }
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-product-title"
                        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
                    >
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                                <i className="fa-solid fa-trash-can text-xl" />
                            </div>

                            <div className="flex-1">
                                <h2
                                    id="delete-product-title"
                                    className="text-xl font-bold text-cyprus"
                                >
                                    Delete Product?
                                </h2>

                                <p className="mt-2 text-sm leading-6 text-text-grey">
                                    Are you sure you want to delete{" "}
                                    <span className="font-semibold text-cyprus">
                                        {selectedProduct.title}
                                    </span>
                                    ? This action cannot be undone.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={closeDeleteModal}
                                disabled={deleting}
                                aria-label="Close dialog"
                                className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed"
                            >
                                <i className="fa-solid fa-xmark text-lg" />
                            </button>
                        </div>

                        {/* Delete API Error */}
                        {deleteError && (
                            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                <i className="fa-solid fa-circle-exclamation mr-2" />
                                {deleteError}
                            </div>
                        )}

                        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={closeDeleteModal}
                                disabled={deleting}
                                className="rounded-lg border border-gray-200 px-5 py-3 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={handleDeleteProduct}
                                disabled={deleting}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {deleting ? (
                                    <>
                                        <i className="fa-solid fa-spinner animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-trash-can" />
                                        Delete Product
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Products;