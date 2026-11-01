
import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

function AdminSidebar({ mobileOpen, setMobileOpen }) {
    const location = useLocation();

    const [openMenu, setOpenMenu] = useState(() => {
        if (location.pathname.startsWith("/admin/products")) return "products";
        if (location.pathname.startsWith("/admin/orders")) return "orders";
        if (location.pathname.startsWith("/admin/discounts")) return "discounts";
        if (location.pathname.startsWith("/admin/shipping")) return "shipping";
        return "";
    });

    useEffect(() => {
        setMobileOpen(false);

        if (location.pathname.startsWith("/admin/products")) {
            setOpenMenu("products");
        } else if (location.pathname.startsWith("/admin/orders")) {
            setOpenMenu("orders");
        } else if (location.pathname.startsWith("/admin/discounts")) {
            setOpenMenu("discounts");
        } else if (location.pathname.startsWith("/admin/shipping")) {
            setOpenMenu("shipping");
        }
    }, [location.pathname, setMobileOpen]);

    useEffect(() => {
        if (!mobileOpen) return;

        const handleEscape = (event) => {
            if (event.key === "Escape") setMobileOpen(false);
        };

        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [mobileOpen, setMobileOpen]);

    const toggleMenu = (menu) => {
        setOpenMenu((previous) => previous === menu ? "" : menu);
    };

    const isActive = (path) => location.pathname === path;

    const linkClass = (path) =>
        `block rounded-lg px-3 py-2 text-xs transition ${
            isActive(path)
                ? "bg-ocean-green text-white"
                : "text-white/60 hover:bg-white/10 hover:text-white"
        }`;

    const menuClass = (active) =>
        `flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition ${
            active
                ? "bg-white/10 text-white"
                : "text-white/70 hover:bg-white/10 hover:text-white"
        }`;

    const directLinkClass = (path, startsWith = false) => {
        const active = startsWith
            ? location.pathname.startsWith(path)
            : isActive(path);

        return `mb-1 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
            active
                ? "bg-ocean-green text-white"
                : "text-white/70 hover:bg-white/10 hover:text-white"
        }`;
    };

    const closeMobile = () => setMobileOpen(false);

    const navLinkClass = (path, startsWith = false) =>
        `${directLinkClass(path, startsWith)}`;

    return (
        <>
            {/* Mobile backdrop */}
            {mobileOpen && (
                <button
                    type="button"
                    aria-label="Close sidebar"
                    onClick={closeMobile}
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                />
            )}

            <aside
                className={`fixed left-0 top-0 z-50 flex h-dvh w-72 max-w-[85vw] shrink-0 flex-col bg-cyprus text-white transition-transform duration-300 lg:z-40 lg:h-screen lg:w-64 lg:translate-x-0 ${
                    mobileOpen ? "translate-x-0" : "-translate-x-full"
                }`}
            >
                {/* Logo and mobile close button */}
                <div className="flex h-15 shrink-0 items-center justify-between border-b border-white/10 px-5">
                    <Link to="/admin" onClick={closeMobile}>
                        <h1 className="text-2xl font-bold">
                            Shop<span className="text-surf-crest">Sphere</span>
                        </h1>
                        <p className="mt-0.5 text-[10px] uppercase tracking-[2px] text-white/50">
                            Admin Panel
                        </p>
                    </Link>

                    <button
                        type="button"
                        onClick={closeMobile}
                        aria-label="Close menu"
                        className="rounded-lg p-2 text-white/80 hover:bg-white/10 lg:hidden"
                    >
                        <i className="fa-solid fa-xmark text-xl"></i>
                    </button>
                </div>

                {/* Sidebar Menu */}
                <div className="admin-sidebar-scroll flex-1 overflow-y-auto px-3 py-5">
                    <Link to="/admin" onClick={closeMobile}
                        className={`${navLinkClass("/admin")} mb-2`}>
                        <i className="fa-solid fa-chart-line w-5"></i>
                        <span>Dashboard</span>
                    </Link>

                    {/* Products */}
                    <div className="mb-1">
                        <button type="button"
                            onClick={() => toggleMenu("products")}
                            className={menuClass(
                                location.pathname.startsWith("/admin/products") ||
                                ["/admin/categories", "/admin/brands", "/admin/inventory"].includes(location.pathname)
                            )}>
                            <span className="flex items-center gap-3">
                                <i className="fa-solid fa-box w-5"></i>
                                Products
                            </span>
                            <i className={`fa-solid fa-chevron-down text-xs transition-transform ${openMenu === "products" ? "rotate-180" : ""}`}></i>
                        </button>

                        {openMenu === "products" && (
                            <div className="ml-8 space-y-1 py-1">
                                <Link to="/admin/products" onClick={closeMobile} className={linkClass("/admin/products")}>All Products</Link>
                                <Link to="/admin/products/add" onClick={closeMobile} className={linkClass("/admin/products/add")}>Add Product</Link>
                                <Link to="/admin/categories" onClick={closeMobile} className={linkClass("/admin/categories")}>Categories</Link>
                                <Link to="/admin/brands" onClick={closeMobile} className={linkClass("/admin/brands")}>Brands</Link>
                                <Link to="/admin/inventory" onClick={closeMobile} className={linkClass("/admin/inventory")}>Inventory</Link>
                            </div>
                        )}
                    </div>

                    {/* Orders */}
                    <div className="mb-1">
                        <button type="button"
                            onClick={() => toggleMenu("orders")}
                            className={menuClass(location.pathname.startsWith("/admin/orders"))}>
                            <span className="flex items-center gap-3">
                                <i className="fa-solid fa-cart-shopping w-5"></i>
                                Orders
                            </span>
                            <i className={`fa-solid fa-chevron-down text-xs transition-transform ${openMenu === "orders" ? "rotate-180" : ""}`}></i>
                        </button>

                        {openMenu === "orders" && (
                            <div className="ml-8 space-y-1 py-1">
                                <Link to="/admin/orders" onClick={closeMobile} className={linkClass("/admin/orders")}>All Orders</Link>
                                <Link to="/admin/orders/pending" onClick={closeMobile} className={linkClass("/admin/orders/pending")}>Pending</Link>
                                <Link to="/admin/orders/processing" onClick={closeMobile} className={linkClass("/admin/orders/processing")}>Processing</Link>
                                <Link to="/admin/orders/shipped" onClick={closeMobile} className={linkClass("/admin/orders/shipped")}>Shipped</Link>
                                <Link to="/admin/orders/delivered" onClick={closeMobile} className={linkClass("/admin/orders/delivered")}>Delivered</Link>
                                <Link to="/admin/orders/cancelled" onClick={closeMobile} className={linkClass("/admin/orders/cancelled")}>Cancelled</Link>
                                <Link to="/admin/orders/returns" onClick={closeMobile} className={linkClass("/admin/orders/returns")}>Returns / Refunds</Link>
                            </div>
                        )}
                    </div>

                    <Link to="/admin/customers" onClick={closeMobile} className={navLinkClass("/admin/customers", true)}>
                        <i className="fa-solid fa-users w-5"></i> Customers
                    </Link>

                    {/* Discounts */}
                    <div className="mb-1">
                        <button type="button"
                            onClick={() => toggleMenu("discounts")}
                            className={menuClass(location.pathname.startsWith("/admin/discounts"))}>
                            <span className="flex items-center gap-3">
                                <i className="fa-solid fa-tags w-5"></i>
                                Coupons & Discounts
                            </span>
                            <i className={`fa-solid fa-chevron-down text-xs transition-transform ${openMenu === "discounts" ? "rotate-180" : ""}`}></i>
                        </button>

                        {openMenu === "discounts" && (
                            <div className="ml-8 space-y-1 py-1">
                                <Link to="/admin/discounts/coupons" onClick={closeMobile} className={linkClass("/admin/discounts/coupons")}>Coupons</Link>
                                <Link to="/admin/discounts/flash-sales" onClick={closeMobile} className={linkClass("/admin/discounts/flash-sales")}>Flash Sales</Link>
                            </div>
                        )}
                    </div>

                    <Link to="/admin/payments" onClick={closeMobile} className={navLinkClass("/admin/payments", true)}>
                        <i className="fa-solid fa-credit-card w-5"></i> Payments
                    </Link>

                    {/* Shipping */}
                    <div className="mb-1">
                        <button type="button"
                            onClick={() => toggleMenu("shipping")}
                            className={menuClass(location.pathname.startsWith("/admin/shipping"))}>
                            <span className="flex items-center gap-3">
                                <i className="fa-solid fa-truck w-5"></i> Shipping
                            </span>
                            <i className={`fa-solid fa-chevron-down text-xs transition-transform ${openMenu === "shipping" ? "rotate-180" : ""}`}></i>
                        </button>

                        {openMenu === "shipping" && (
                            <div className="ml-8 space-y-1 py-1">
                                <Link to="/admin/shipping" onClick={closeMobile} className={linkClass("/admin/shipping")}>Shipments</Link>
                                <Link to="/admin/shipping/methods" onClick={closeMobile} className={linkClass("/admin/shipping/methods")}>Shipping Methods</Link>
                                <Link to="/admin/shipping/areas" onClick={closeMobile} className={linkClass("/admin/shipping/areas")}>Delivery Areas</Link>
                                <Link to="/admin/shipping/tracking" onClick={closeMobile} className={linkClass("/admin/shipping/tracking")}>Tracking</Link>
                            </div>
                        )}
                    </div>

                    <Link to="/admin/reviews" onClick={closeMobile} className={navLinkClass("/admin/reviews", true)}>
                        <i className="fa-solid fa-star w-5"></i> Reviews
                    </Link>
                    <Link to="/admin/reports" onClick={closeMobile} className={navLinkClass("/admin/reports", true)}>
                        <i className="fa-solid fa-chart-pie w-5"></i> Reports & Analytics
                    </Link>
                    <Link to="/admin/content" onClick={closeMobile} className={navLinkClass("/admin/content", true)}>
                        <i className="fa-solid fa-file-lines w-5"></i> Content Management
                    </Link>
                    <Link to="/admin/support" onClick={closeMobile} className={navLinkClass("/admin/support", true)}>
                        <i className="fa-solid fa-headset w-5"></i> Support
                    </Link>
                    <Link to="/admin/users" onClick={closeMobile} className={navLinkClass("/admin/users", true)}>
                        <i className="fa-solid fa-user-shield w-5"></i> Users & Roles
                    </Link>
                    <Link to="/admin/notifications" onClick={closeMobile} className={navLinkClass("/admin/notifications", true)}>
                        <i className="fa-solid fa-bell w-5"></i> Notifications
                    </Link>
                    <Link to="/admin/activity-logs" onClick={closeMobile} className={navLinkClass("/admin/activity-logs", true)}>
                        <i className="fa-solid fa-clock-rotate-left w-5"></i> Activity Logs
                    </Link>
                    <Link to="/admin/settings" onClick={closeMobile} className={navLinkClass("/admin/settings", true)}>
                        <i className="fa-solid fa-gear w-5"></i> Settings
                    </Link>

                    <div className="my-4 border-t border-white/10"></div>

                    <button
                        type="button"
                        onClick={() => {
                            localStorage.removeItem("shopsphereLoggedIn");
                            localStorage.removeItem("shopsphereCurrentUser");
                            window.location.href = "/login";
                        }}
                        className="mb-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-300 transition hover:bg-red-500/10 hover:text-red-200">
                        <i className="fa-solid fa-right-from-bracket w-5"></i>
                        Logout
                    </button>
                </div>
            </aside>
        </>
    );
}

export default AdminSidebar;
