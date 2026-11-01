import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import UserDashboardLayout from "../layouts/UserDashboardLayout";

const API_BASE_URL = "http://192.168.1.10:5000/api";
const SERVER_URL = "http://192.168.1.10:5000";

function UserDashboard() {
    const [user, setUser] = useState(() => {
        try {
            return JSON.parse(
                localStorage.getItem("shopsphereUser") || "null"
            );
        } catch {
            return null;
        }
    });

    const [orders, setOrders] = useState([]);
    const [cartItems, setCartItems] = useState([]);
    const [wishlistItems, setWishlistItems] = useState([]);
    const [products, setProducts] = useState([]);
    const [recentlyViewed, setRecentlyViewed] = useState([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(""); 

    const token =
        localStorage.getItem("token") ||
        localStorage.getItem("shopsphereToken");

    const userName = user?.name || "ShopSphere User";

    // Format currency
    const formatPrice = (price) => {
        return `₹${Number(price || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    };

    // Format date
    const formatDate = (date) => {
        if (!date) return "N/A";

        const parsedDate = new Date(date);

        if (Number.isNaN(parsedDate.getTime())) {
            return "N/A";
        }

        return parsedDate.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    // Get product image URL
    const getImageUrl = (product) => {
        const image =
            product?.image_url ||
            product?.image ||
            product?.images?.[0]?.image_url ||
            product?.images?.[0]?.url ||
            "";

        if (!image) return "";

        if (image.startsWith("http://") || image.startsWith("https://")) {
            return image;
        }

        return `${SERVER_URL}${image.startsWith("/") ? "" : "/"}${image}`;
    };

    // Load dashboard APIs
    useEffect(() => {
        let isMounted = true;

        const fetchDashboardData = async () => {
            if (!token) {
                if (isMounted) {
                    setError("Please login to view your dashboard.");
                    setLoading(false);
                }
                return;
            }

            const headers = {
                Authorization: `Bearer ${token}`,
            };

            try {
                setLoading(true);
                setError("");

                const endpoints = [
                    `${API_BASE_URL}/auth/profile`,
                    `${API_BASE_URL}/orders`,
                    `${API_BASE_URL}/cart`,
                    `${API_BASE_URL}/wishlist`,
                    `${API_BASE_URL}/products`,
                ];

                const responses = await Promise.all(
                    endpoints.map((url) =>
                        fetch(url, {
                            method: "GET",
                            headers,
                        })
                    )
                );

                const responseData = await Promise.all(
                    responses.map(async (response) => {
                        const data = await response.json();

                        if (!response.ok || data.success === false) {
                            throw new Error(
                                data.message || "Failed to load dashboard data."
                            );
                        }

                        return data;
                    })
                );

                const [
                    profileData,
                    ordersData,
                    cartData,
                    wishlistData,
                    productsData,
                ] = responseData;

                if (!isMounted) return;

                // Profile
                if (profileData.user) {
                    setUser(profileData.user);

                    localStorage.setItem(
                        "shopsphereUser",
                        JSON.stringify(profileData.user)
                    );
                }

                // Orders API: { success: true, data: [...] }
                setOrders(
                    Array.isArray(ordersData.data)
                        ? ordersData.data
                        : []
                );

                // Cart API: { success: true, data: { items: [...] } }
                setCartItems(
                    Array.isArray(cartData.data?.items)
                        ? cartData.data.items
                        : []
                );

                // Wishlist API: { success: true, data: { items: [...] } }
                setWishlistItems(
                    Array.isArray(wishlistData.data?.items)
                        ? wishlistData.data.items
                        : []
                );

                // Products API: { success: true, products: [...] }
                setProducts(
                    Array.isArray(productsData.products)
                        ? productsData.products
                        : []
                );

                // Recently Viewed Products from localStorage
                let viewedProducts = [];

                const storageKeys = [
                    "recentlyViewed",
                    "shopsphereRecentlyViewed",
                ];

                for (const key of storageKeys) {
                    try {
                        const saved = JSON.parse(
                            localStorage.getItem(key) || "null"
                        );

                        if (Array.isArray(saved)) {
                            viewedProducts = saved;
                            break;
                        }
                    } catch {
                        // Try the next supported key.
                    }
                }

                setRecentlyViewed(viewedProducts);
            } catch (err) {
                if (isMounted) {
                    setError(
                        err.message ||
                        "Unable to load dashboard data. Please try again."
                    );
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchDashboardData();

        return () => {
            isMounted = false;
        };
    }, [token]);

    // Calculate order statistics
    const pendingStatuses = [
        "pending",
        "confirmed",
        "processing",
    ];

    const pendingOrders = orders.filter((order) =>
        pendingStatuses.includes(
            String(order.order_status || "").toLowerCase()
        )
    );

    // Statistics
    const stats = [
        {
            title: "Total Orders",
            value: orders.length,
            icon: "fa-solid fa-box",
            bg: "bg-aqua-spring",
            iconColor: "text-ocean-green",
            link: "/orders",
        },
        {
            title: "Pending Orders",
            value: pendingOrders.length,
            icon: "fa-solid fa-clock",
            bg: "bg-yellow-50",
            iconColor: "text-pending",
            link: "/orders",
        },
        {
            title: "Wishlist",
            value: wishlistItems.length,
            icon: "fa-solid fa-heart",
            bg: "bg-red-50",
            iconColor: "text-error",
            link: "/wishlist",
        },
        {
            title: "Cart Items",
            value: cartItems.reduce(
                (total, item) => total + Number(item.quantity || 1),
                0
            ),
            icon: "fa-solid fa-cart-shopping",
            bg: "bg-blue-50",
            iconColor: "text-brand-primary",
            link: "/cart",
        },
    ];

    // Quick Actions
    const quickActions = [
        {
            title: "Shop Products",
            description: "Explore our latest products",
            icon: "fa-solid fa-bag-shopping",
            link: "/products",
        },
        {
            title: "My Orders",
            description: "Track your recent orders",
            icon: "fa-solid fa-box",
            link: "/orders",
        },
        {
            title: "My Wishlist",
            description: "View your saved products",
            icon: "fa-solid fa-heart",
            link: "/wishlist",
        },
        {
            title: "My Profile",
            description: "Manage your account",
            icon: "fa-solid fa-user",
            link: "/profile",
        },
    ];

    // Recent Orders: latest three orders
    const recentOrders = [...orders]
        .sort(
            (a, b) =>
                new Date(b.created_at) - new Date(a.created_at)
        )
        .slice(0, 3)
        .map((order) => ({
            id: order.order_number || `#${order.id}`,
            product: `Order #${order.id}`,
            date: formatDate(order.created_at),
            amount: formatPrice(order.total_amount),
            status: order.order_status || "Pending",
        }));

    // Recommended Products
    const recommendedProducts = products.slice(0, 4).map((product) => ({
        id: product.id,
        name: product.title || product.name || "Product",
        price: formatPrice(
            product.sale_price ?? product.base_price ?? 0
        ),
        oldPrice:
            Number(product.base_price || 0) >
                Number(product.sale_price ?? product.base_price ?? 0)
                ? formatPrice(product.base_price)
                : "",
        image: getImageUrl(product),
    }));

    // Recently Viewed: supports common stored product formats
    const normalizedRecentlyViewed = recentlyViewed
        .map((product, index) => {
            const productId =
                product.id ??
                product.product_id ??
                product.productId ??
                index;

            return {
                id: productId,
                name:
                    product.title ||
                    product.name ||
                    product.product_name ||
                    "Product",
                price: formatPrice(
                    product.sale_price ??
                    product.price ??
                    product.base_price ??
                    0
                ),
                image: getImageUrl(product),
                link: product.slug
                    ? `/products/${product.slug}`
                    : `/products/${productId}`,
            };
        })
        .slice(0, 3);

    // Order status styles
    const getStatusStyle = (status) => {
        switch (String(status).toLowerCase()) {
            case "delivered":
                return "bg-success/10 text-success";

            case "cancelled":
                return "bg-red-50 text-red-600";

            case "processing":
                return "bg-blue-50 text-blue-700";

            case "shipped":
                return "bg-purple-50 text-purple-700";

            case "confirmed":
                return "bg-aqua-spring text-cyprus";

            case "pending":
            default:
                return "bg-pending/10 text-cyprus";
        }
    };

    return (
        <UserDashboardLayout>
            <div className="min-h-full p-4 sm:p-6 lg:p-8">
                {/* PAGE HEADER */}
                <section>
                    <p className="text-sm font-bold uppercase tracking-[2px] text-ocean-green">
                        My Account
                    </p>

                    <p className="mt-2 text-sm text-text-grey">
                        Manage your orders, wishlist, profile and shopping activity.
                    </p>
                </section>

                {/* LOADING */}
                {loading && (
                    <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white p-6">
                        <i className="fa-solid fa-spinner animate-spin text-ocean-green" />
                        <p className="text-sm text-text-grey">
                            Loading your dashboard...
                        </p>
                    </div>
                )}

                {/* ERROR */}
                {!loading && error && (
                    <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
                        <div className="flex items-start gap-3">
                            <i className="fa-solid fa-circle-exclamation mt-1 text-red-600" />

                            <div>
                                <p className="text-sm font-bold text-red-700">
                                    Unable to load dashboard
                                </p>

                                <p className="mt-1 text-sm text-red-600">
                                    {error}
                                </p>

                                <button
                                    type="button"
                                    onClick={() => window.location.reload()}
                                    className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700"
                                >
                                    Try Again
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* DASHBOARD CONTENT */}
                {!loading && !error && (
                    <>
                        {/* WELCOME CARD */}
                        <section className="mt-6 overflow-hidden rounded-2xl bg-cyprus shadow-sm">
                            <div className="flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <p className="text-sm font-medium text-surf-crest">
                                        Welcome back
                                    </p>

                                    <h2 className="mt-1 break-words text-2xl font-bold text-white sm:text-3xl">
                                        Hello, {userName} 👋
                                    </h2>

                                    <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">
                                        Discover new products, track your orders and
                                        manage your ShopSphere account from one place.
                                    </p>

                                    <Link
                                        to="/products"
                                        className="mt-5 inline-flex items-center rounded-full bg-ocean-green px-6 py-3 text-xs font-bold text-white transition hover:bg-surf-crest hover:text-cyprus"
                                    >
                                        Start Shopping
                                        <i className="fa-solid fa-arrow-right ml-2" />
                                    </Link>
                                </div>

                                <div className="hidden h-32 w-32 shrink-0 items-center justify-center rounded-full bg-surf-crest/10 lg:flex">
                                    <i className="fa-solid fa-bag-shopping text-5xl text-surf-crest" />
                                </div>
                            </div>
                        </section>

                        {/* STATISTICS */}
                        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            {stats.map((stat) => (
                                <Link
                                    key={stat.title}
                                    to={stat.link}
                                    className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div
                                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${stat.bg} ${stat.iconColor}`}
                                        >
                                            <i className={stat.icon} />
                                        </div>

                                        <span className="text-2xl font-bold text-cyprus">
                                            {stat.value}
                                        </span>
                                    </div>

                                    <p className="mt-4 text-sm font-medium text-text-grey">
                                        {stat.title}
                                    </p>
                                </Link>
                            ))}
                        </section>

                        {/* QUICK ACTIONS */}
                        <section className="mt-8">
                            <h2 className="text-xl font-bold text-cyprus">
                                Quick Actions
                            </h2>

                            <p className="mt-1 text-sm text-text-grey">
                                Quickly access your account sections.
                            </p>

                            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                {quickActions.map((action) => (
                                    <Link
                                        key={action.title}
                                        to={action.link}
                                        className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-ocean-green hover:shadow-md"
                                    >
                                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-aqua-spring text-ocean-green transition group-hover:bg-ocean-green group-hover:text-white">
                                            <i className={action.icon} />
                                        </div>

                                        <h3 className="mt-4 text-sm font-bold text-cyprus">
                                            {action.title}
                                        </h3>

                                        <p className="mt-1 text-xs leading-5 text-text-grey">
                                            {action.description}
                                        </p>

                                        <span className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-ocean-green">
                                            Open
                                            <i className="fa-solid fa-arrow-right" />
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </section>

                        {/* RECENT ORDERS */}
                        <section className="mt-8">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-cyprus">
                                        Recent Orders
                                    </h2>

                                    <p className="mt-1 text-sm text-text-grey">
                                        Check the latest status of your orders.
                                    </p>
                                </div>

                                <Link
                                    to="/orders"
                                    className="text-xs font-bold text-ocean-green hover:text-cyprus"
                                >
                                    View All Orders →
                                </Link>
                            </div>

                            <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                                <div className="hidden grid-cols-5 border-b border-gray-200 bg-aqua-spring px-5 py-3 text-xs font-bold text-cyprus md:grid">
                                    <span>Order</span>
                                    <span>Product</span>
                                    <span>Date</span>
                                    <span>Amount</span>
                                    <span>Status</span>
                                </div>

                                {recentOrders.length > 0 ? (
                                    recentOrders.map((order) => (
                                        <div
                                            key={order.id}
                                            className="grid grid-cols-2 gap-3 border-b border-gray-100 px-5 py-4 last:border-b-0 sm:grid-cols-3 md:grid-cols-5 md:items-center"
                                        >
                                            <div className="min-w-0">
                                                <p className="text-[10px] text-text-grey md:hidden">
                                                    Order
                                                </p>

                                                <p className="break-words text-xs font-bold text-cyprus">
                                                    {order.id}
                                                </p>
                                            </div>

                                            <div className="col-span-2 min-w-0 sm:col-span-1">
                                                <p className="text-[10px] text-text-grey md:hidden">
                                                    Product
                                                </p>

                                                <p className="text-sm font-medium text-cyprus">
                                                    {order.product}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-[10px] text-text-grey md:hidden">
                                                    Date
                                                </p>

                                                <p className="text-xs text-text-grey">
                                                    {order.date}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-[10px] text-text-grey md:hidden">
                                                    Amount
                                                </p>

                                                <p className="break-words text-sm font-bold text-cyprus">
                                                    {order.amount}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="mb-1 text-[10px] text-text-grey md:hidden">
                                                    Status
                                                </p>

                                                <span
                                                    className={`inline-flex max-w-full rounded-full px-3 py-1 text-[10px] font-bold capitalize ${getStatusStyle(
                                                        order.status
                                                    )}`}
                                                >
                                                    {order.status}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-8 text-center">
                                        <i className="fa-solid fa-box-open text-3xl text-gray-300" />

                                        <p className="mt-3 text-sm font-medium text-cyprus">
                                            No orders yet
                                        </p>

                                        <p className="mt-1 text-xs text-text-grey">
                                            Your recent orders will appear here.
                                        </p>

                                        <Link
                                            to="/products"
                                            className="mt-4 inline-flex rounded-full bg-ocean-green px-5 py-2.5 text-xs font-bold text-white hover:bg-cyprus"
                                        >
                                            Start Shopping
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* RECOMMENDED PRODUCTS */}
                        <section className="mt-8">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-cyprus">
                                        Recommended For You
                                    </h2>

                                    <p className="mt-1 text-sm text-text-grey">
                                        Products you may like.
                                    </p>
                                </div>

                                <Link
                                    to="/products"
                                    className="text-xs font-bold text-ocean-green hover:text-cyprus"
                                >
                                    View More →
                                </Link>
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                                {recommendedProducts.length > 0 ? (
                                    recommendedProducts.map((product) => (
                                        <div
                                            key={product.id}
                                            className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md"
                                        >
                                            <Link
                                                to={`/products/${product.id}`}
                                                className="block"
                                            >
                                                <div className="relative flex h-48 items-center justify-center overflow-hidden bg-gray-50">
                                                    {product.image ? (
                                                        <img
                                                            src={product.image}
                                                            alt={product.name}
                                                            loading="lazy"
                                                            onError={(event) => {
                                                                event.currentTarget.style.display =
                                                                    "none";
                                                            }}
                                                            className="h-full w-full object-contain p-3 transition duration-500 group-hover:scale-105"
                                                        />
                                                    ) : (
                                                        <i className="fa-solid fa-image text-4xl text-gray-300" />
                                                    )}
                                                </div>

                                                <div className="p-4">
                                                    <h3 className="truncate text-sm font-bold text-cyprus">
                                                        {product.name}
                                                    </h3>

                                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                                        <span className="text-base font-bold text-ocean-green">
                                                            {product.price}
                                                        </span>

                                                        {product.oldPrice && (
                                                            <span className="text-xs text-gray-400 line-through">
                                                                {product.oldPrice}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <span className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-ocean-green">
                                                        View Product
                                                        <i className="fa-solid fa-arrow-right" />
                                                    </span>
                                                </div>
                                            </Link>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-full rounded-2xl border border-gray-200 bg-white p-8 text-center">
                                        <p className="text-sm text-text-grey">
                                            No products available right now.
                                        </p>

                                        <Link
                                            to="/products"
                                            className="mt-3 inline-block text-sm font-bold text-ocean-green"
                                        >
                                            Browse Products →
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* RECENTLY VIEWED */}
                        <section className="mt-8">
                            <h2 className="text-xl font-bold text-cyprus">
                                Recently Viewed
                            </h2>

                            <p className="mt-1 text-sm text-text-grey">
                                Products you viewed recently.
                            </p>

                            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {normalizedRecentlyViewed.length > 0 ? (
                                    normalizedRecentlyViewed.map((product) => (
                                        <Link
                                            key={product.id}
                                            to={product.link}
                                            className="group flex min-w-0 items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                                        >
                                            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-aqua-spring">
                                                {product.image ? (
                                                    <img
                                                        src={product.image}
                                                        alt={product.name}
                                                        loading="lazy"
                                                        onError={(event) => {
                                                            event.currentTarget.style.display =
                                                                "none";
                                                        }}
                                                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                                    />
                                                ) : (
                                                    <i className="fa-solid fa-image text-2xl text-ocean-green" />
                                                )}
                                            </div>

                                            <div className="min-w-0">
                                                <h3 className="truncate text-sm font-bold text-cyprus">
                                                    {product.name}
                                                </h3>

                                                <p className="mt-2 text-sm font-bold text-ocean-green">
                                                    {product.price}
                                                </p>

                                                <p className="mt-1 text-[10px] text-text-grey">
                                                    View Product →
                                                </p>
                                            </div>
                                        </Link>
                                    ))
                                ) : (
                                    <div className="col-span-full rounded-2xl border border-gray-200 bg-white p-6">
                                        <p className="text-sm text-text-grey">
                                            Products you view will appear here.
                                        </p>

                                        <Link
                                            to="/products"
                                            className="mt-3 inline-block text-xs font-bold text-ocean-green hover:text-cyprus"
                                        >
                                            Explore Products →
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </section>
                    </>
                )}
            </div>
        </UserDashboardLayout>
    );
}

export default UserDashboard;