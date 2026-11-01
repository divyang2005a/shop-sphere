import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

function AdminDashboard() {
    // API States
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [dashboardInfo, setDashboardInfo] = useState(null);

    // Dashboard API
    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                setLoading(true);
                setError("");

                const token = localStorage.getItem("shopsphereToken");

                if (!token) {
                    throw new Error(
                        "Login session not found. Please login again."
                    );
                }

                const response = await fetch(
                    "http://192.168.1.10:5000/api/admin/dashboard",
                    {
                        method: "GET",
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "application/json",
                        },
                    }
                );

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(
                        data.message || "Failed to load admin dashboard."
                    );
                }

                setDashboardInfo(data);
            } catch (err) {
                setError(
                    err.message || "Something went wrong while loading dashboard."
                );
            } finally {
                setLoading(false);
            }
        };

        fetchDashboard();
    }, []);

    // Dashboard Stats (Currently Demo Data)
    const stats = [
        {
            title: "Total Revenue",
            value: "$48,250",
            change: "+12.5%",
            icon: "fa-solid fa-dollar-sign",
            bg: "bg-green-50",
            color: "text-success",
        },
        {
            title: "Total Orders",
            value: "1,248",
            change: "+8.2%",
            icon: "fa-solid fa-cart-shopping",
            bg: "bg-blue-50",
            color: "text-brand-primary",
        },
        {
            title: "Customers",
            value: "856",
            change: "+5.4%",
            icon: "fa-solid fa-users",
            bg: "bg-yellow-50",
            color: "text-pending",
        },
        {
            title: "Products",
            value: "248",
            change: "+3.1%",
            icon: "fa-solid fa-boxes-stacked",
            bg: "bg-aqua-spring",
            color: "text-ocean-green",
        },
    ];

    const recentOrders = [
        {
            id: "#SS10245",
            customer: "Rahul Patel",
            product: "Wireless Headphones",
            amount: "$49.99",
            status: "Delivered",
        },
        {
            id: "#SS10244",
            customer: "Amit Shah",
            product: "Smart Watch",
            amount: "$79.99",
            status: "Processing",
        },
        {
            id: "#SS10243",
            customer: "Neha Patel",
            product: "Running Shoes",
            amount: "$59.99",
            status: "Pending",
        },
        {
            id: "#SS10242",
            customer: "Jay Mehta",
            product: "Travel Backpack",
            amount: "$39.99",
            status: "Delivered",
        },
        {
            id: "#SS10241",
            customer: "Priya Shah",
            product: "Bluetooth Speaker",
            amount: "$34.99",
            status: "Shipped",
        },
    ];

    const topProducts = [
        {
            name: "Wireless Headphones",
            category: "Electronics",
            sold: 184,
            revenue: "$9,198",
        },
        {
            name: "Smart Watch",
            category: "Electronics",
            sold: 156,
            revenue: "$12,480",
        },
        {
            name: "Running Shoes",
            category: "Fashion",
            sold: 132,
            revenue: "$7,920",
        },
        {
            name: "Travel Backpack",
            category: "Fashion",
            sold: 98,
            revenue: "$3,920",
        },
    ];

    const lowStockProducts = [
        {
            name: "Wireless Mouse",
            sku: "WM-1024",
            stock: 4,
        },
        {
            name: "USB-C Cable",
            sku: "UC-2045",
            stock: 7,
        },
        {
            name: "Smart Watch",
            sku: "SW-3042",
            stock: 9,
        },
        {
            name: "Laptop Stand",
            sku: "LS-4021",
            stock: 5,
        },
    ];

    const salesData = [
        { month: "Jan", value: 55 },
        { month: "Feb", value: 70 },
        { month: "Mar", value: 48 },
        { month: "Apr", value: 82 },
        { month: "May", value: 65 },
        { month: "Jun", value: 92 },
        { month: "Jul", value: 78 },
        { month: "Aug", value: 88 },
        { month: "Sep", value: 96 },
        { month: "Oct", value: 84 },
        { month: "Nov", value: 100 },
        { month: "Dec", value: 90 },
    ];

    return (
        <div className="p-4 sm:p-6 lg:p-8">

            {/* API Loading */}
            {loading && (
                <div className="mb-4 rounded-xl bg-aqua-spring p-4 text-sm text-cyprus">
                    <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                    Loading dashboard...
                </div>
            )}

            {/* API Error */}
            {error && (
                <div
                    role="alert"
                    className="mb-4 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                    <p className="text-sm text-error">
                        <i className="fa-solid fa-circle-exclamation mr-2"></i>
                        {error}
                    </p>

                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="w-fit rounded-lg bg-error px-4 py-2 text-xs font-bold text-white hover:opacity-90"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* API Success Information */}
            {dashboardInfo && (
                <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4">
                    <p className="text-sm font-bold text-cyprus">
                        <i className="fa-solid fa-circle-check mr-2 text-success"></i>
                        {dashboardInfo.message}
                    </p>

                    <p className="mt-1 text-xs text-text-grey">
                        Admin User ID: {dashboardInfo.user_id}
                    </p>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[2px] text-ocean-green">
                        Overview
                    </p>

                    <h1 className="mt-1 text-2xl font-bold text-cyprus sm:text-3xl">
                        Admin Dashboard
                    </h1>

                    <p className="mt-2 text-sm text-text-grey">
                        Monitor and manage your ShopSphere store.
                    </p>
                </div>

                <Link
                    to="/admin/products/add"
                    className="flex w-fit items-center gap-2 rounded-full bg-ocean-green px-5 py-2.5 text-xs font-bold text-white transition hover:bg-cyprus"
                >
                    <i className="fa-solid fa-plus"></i>
                    Add Product
                </Link>
            </div>

            {/* Stats */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map((stat) => (
                    <div
                        key={stat.title}
                        className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                    >
                        <div className="flex items-start justify-between">
                            <div
                                className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.bg} ${stat.color}`}
                            >
                                <i className={stat.icon}></i>
                            </div>

                            <span className="rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-bold text-success">
                                {stat.change}
                            </span>
                        </div>

                        <p className="mt-5 text-sm text-text-grey">
                            {stat.title}
                        </p>

                        <h2 className="mt-1 text-2xl font-bold text-cyprus">
                            {stat.value}
                        </h2>
                    </div>
                ))}
            </div>

            {/* Sales + Order Summary */}
            <div className="mt-8 grid gap-6 xl:grid-cols-3">

                {/* Sales Graph */}
                <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm xl:col-span-2">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-cyprus">
                                Sales Overview
                            </h2>

                            <p className="mt-1 text-xs text-text-grey">
                                Monthly sales performance
                            </p>
                        </div>

                        <select
                            aria-label="Select sales year"
                            className="w-fit rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-cyprus outline-none"
                        >
                            <option>2026</option>
                            <option>2025</option>
                            <option>2024</option>
                        </select>
                    </div>

                    <div className="mt-8">
                        <div className="flex h-64 items-end gap-2 sm:gap-4">
                            {salesData.map((item) => (
                                <div
                                    key={item.month}
                                    className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                                >
                                    <div className="flex h-full w-full items-end">
                                        <div
                                            className="w-full rounded-t-lg bg-ocean-green transition hover:bg-cyprus"
                                            style={{
                                                height: `${item.value}%`,
                                            }}
                                        ></div>
                                    </div>

                                    <span className="text-[10px] text-text-grey">
                                        {item.month}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Order Summary */}
                <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-cyprus">
                                Order Summary
                            </h2>

                            <p className="mt-1 text-xs text-text-grey">
                                Current order status
                            </p>
                        </div>

                        <i className="fa-solid fa-chart-pie text-xl text-ocean-green"></i>
                    </div>

                    <div className="mt-6 space-y-5">
                        {[
                            {
                                label: "Pending",
                                count: 86,
                                width: "30%",
                                color: "bg-pending",
                            },
                            {
                                label: "Processing",
                                count: 124,
                                width: "45%",
                                color: "bg-brand-primary",
                            },
                            {
                                label: "Shipped",
                                count: 92,
                                width: "35%",
                                color: "bg-ocean-green",
                            },
                            {
                                label: "Delivered",
                                count: 856,
                                width: "85%",
                                color: "bg-success",
                            },
                            {
                                label: "Cancelled",
                                count: 90,
                                width: "25%",
                                color: "bg-error",
                            },
                        ].map((item) => (
                            <div key={item.label}>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-text-grey">
                                        {item.label}
                                    </span>

                                    <span className="font-bold text-cyprus">
                                        {item.count}
                                    </span>
                                </div>

                                <div className="mt-2 h-2 rounded-full bg-gray-100">
                                    <div
                                        className={`h-2 rounded-full ${item.color}`}
                                        style={{ width: item.width }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {/* Recent Orders */}
            <section className="mt-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-cyprus">
                            Recent Orders
                        </h2>

                        <p className="mt-1 text-sm text-text-grey">
                            Latest orders from your customers.
                        </p>
                    </div>

                    <Link
                        to="/admin/orders"
                        className="text-xs font-bold text-ocean-green hover:text-cyprus"
                    >
                        View All
                    </Link>
                </div>

                <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="hidden grid-cols-5 border-b border-gray-200 bg-aqua-spring px-5 py-3 text-xs font-bold text-cyprus md:grid">
                        <span>Order ID</span>
                        <span>Customer</span>
                        <span>Product</span>
                        <span>Amount</span>
                        <span>Status</span>
                    </div>

                    {recentOrders.map((order) => (
                        <div
                            key={order.id}
                            className="grid gap-3 border-b border-gray-100 px-5 py-4 last:border-b-0 md:grid-cols-5 md:items-center"
                        >
                            <div>
                                <p className="text-xs font-bold text-cyprus">
                                    {order.id}
                                </p>
                            </div>

                            <div>
                                <p className="text-sm text-cyprus">
                                    {order.customer}
                                </p>
                            </div>

                            <div>
                                <p className="text-sm text-cyprus">
                                    {order.product}
                                </p>
                            </div>

                            <div>
                                <p className="text-sm font-bold text-cyprus">
                                    {order.amount}
                                </p>
                            </div>

                            <span
                                className={`w-fit rounded-full px-3 py-1 text-[10px] font-bold ${
                                    order.status === "Delivered"
                                        ? "bg-success/10 text-success"
                                        : order.status === "Processing"
                                            ? "bg-brand-primary/10 text-brand-primary"
                                            : order.status === "Shipped"
                                                ? "bg-ocean-green/10 text-ocean-green"
                                                : "bg-pending/10 text-pending"
                                }`}
                            >
                                {order.status}
                            </span>
                        </div>
                    ))}
                </div>
            </section>

            {/* Top Products + Low Stock */}
            <div className="mt-8 grid gap-6 xl:grid-cols-2">

                {/* Top Products */}
                <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-cyprus">
                                Top Products
                            </h2>

                            <p className="mt-1 text-xs text-text-grey">
                                Best selling products
                            </p>
                        </div>

                        <Link
                            to="/admin/products"
                            className="text-xs font-bold text-ocean-green hover:text-cyprus"
                        >
                            View All
                        </Link>
                    </div>

                    <div className="mt-5 space-y-4">
                        {topProducts.map((product, index) => (
                            <div
                                key={product.name}
                                className="flex items-center gap-4 rounded-xl border border-gray-100 p-3"
                            >
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-aqua-spring text-ocean-green">
                                    <i className="fa-solid fa-box"></i>
                                </div>

                                <div className="min-w-0 flex-1">
                                    <h3 className="truncate text-sm font-bold text-cyprus">
                                        {product.name}
                                    </h3>

                                    <p className="mt-1 text-[11px] text-text-grey">
                                        {product.category}
                                    </p>
                                </div>

                                <div className="text-right">
                                    <p className="text-sm font-bold text-cyprus">
                                        {product.revenue}
                                    </p>

                                    <p className="mt-1 text-[10px] text-text-grey">
                                        {product.sold} sold
                                    </p>
                                </div>

                                <span className="hidden h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-cyprus sm:flex">
                                    #{index + 1}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Low Stock */}
                <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-cyprus">
                                Low Stock
                            </h2>

                            <p className="mt-1 text-xs text-text-grey">
                                Products that need restocking
                            </p>
                        </div>

                        <Link
                            to="/admin/inventory"
                            className="text-xs font-bold text-ocean-green hover:text-cyprus"
                        >
                            Inventory
                        </Link>
                    </div>

                    <div className="mt-5 space-y-4">
                        {lowStockProducts.map((product) => (
                            <div
                                key={product.sku}
                                className="flex items-center gap-4 rounded-xl border border-gray-100 p-3"
                            >
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-error">
                                    <i className="fa-solid fa-triangle-exclamation"></i>
                                </div>

                                <div className="min-w-0 flex-1">
                                    <h3 className="truncate text-sm font-bold text-cyprus">
                                        {product.name}
                                    </h3>

                                    <p className="mt-1 text-[11px] text-text-grey">
                                        SKU: {product.sku}
                                    </p>
                                </div>

                                <div className="text-right">
                                    <p className="text-lg font-bold text-error">
                                        {product.stock}
                                    </p>

                                    <p className="text-[10px] text-text-grey">
                                        units left
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {/* Quick Management */}
            <section className="mt-8">
                <div>
                    <h2 className="text-xl font-bold text-cyprus">
                        Quick Management
                    </h2>

                    <p className="mt-1 text-sm text-text-grey">
                        Frequently used admin actions.
                    </p>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Link
                        to="/admin/products/add"
                        className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                    >
                        <i className="fa-solid fa-plus text-2xl text-ocean-green"></i>

                        <h3 className="mt-4 text-sm font-bold text-cyprus">
                            Add Product
                        </h3>

                        <p className="mt-1 text-xs text-text-grey">
                            Add a new product to your store.
                        </p>
                    </Link>

                    <Link
                        to="/admin/orders"
                        className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                    >
                        <i className="fa-solid fa-cart-shopping text-2xl text-brand-primary"></i>

                        <h3 className="mt-4 text-sm font-bold text-cyprus">
                            Manage Orders
                        </h3>

                        <p className="mt-1 text-xs text-text-grey">
                            View and manage customer orders.
                        </p>
                    </Link>

                    <Link
                        to="/admin/customers"
                        className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                    >
                        <i className="fa-solid fa-users text-2xl text-pending"></i>

                        <h3 className="mt-4 text-sm font-bold text-cyprus">
                            Customers
                        </h3>

                        <p className="mt-1 text-xs text-text-grey">
                            View and manage customers.
                        </p>
                    </Link>

                    <Link
                        to="/admin/reports"
                        className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                    >
                        <i className="fa-solid fa-chart-column text-2xl text-success"></i>

                        <h3 className="mt-4 text-sm font-bold text-cyprus">
                            Reports
                        </h3>

                        <p className="mt-1 text-xs text-text-grey">
                            View store reports and analytics.
                        </p>
                    </Link>
                </div>
            </section>

            {/* Store Overview */}
            <section className="mt-8">
                <div className="rounded-2xl bg-cyprus p-6 sm:p-8">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[2px] text-surf-crest">
                                ShopSphere Admin
                            </p>

                            <h2 className="mt-2 text-2xl font-bold text-white">
                                Manage your entire store
                            </h2>

                            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
                                Manage products, orders, customers, payments,
                                shipping, marketing, reports and all other
                                store operations from your admin panel.
                            </p>
                        </div>

                        <Link
                            to="/"
                            className="w-fit shrink-0 rounded-full bg-surf-crest px-6 py-3 text-xs font-bold text-cyprus transition hover:bg-ocean-green hover:text-white"
                        >
                            View Store
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}

export default AdminDashboard;