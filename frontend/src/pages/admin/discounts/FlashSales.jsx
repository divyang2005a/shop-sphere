import React, { useEffect, useState } from "react";

const API_BASE_URL = "http://192.168.1.20:5000/api";

const toFlashSale = (sale) => {
    const now = Date.now();
    const start = new Date(sale.start_time).getTime();
    const end = new Date(sale.end_time).getTime();
    let status = "Scheduled";

    if (sale.status !== "active") {
        status = "Inactive";
    } else if (Number(sale.sold_quantity) >= Number(sale.stock_limit)) {
        status = "Sold Out";
    } else if (end <= now) {
        status = "Ended";
    } else if (start <= now) {
        status = "Active";
    }

    return {
        id: sale.id,
        name: sale.name,
        product_id: sale.product_id,
        product: sale.product_title,
        discount: `${Math.round(Number(sale.discount_percentage))}%`,
        originalPrice: Number(sale.original_price),
        salePrice: Number(sale.sale_price),
        stock: Number(sale.stock_limit),
        sold: Number(sale.sold_quantity),
        startTime: new Date(sale.start_time).toLocaleString(),
        endTime: new Date(sale.end_time).toLocaleString(),
        status,
    };
};

function FlashSales() {
    const [flashSales, setFlashSales] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [showForm, setShowForm] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        product_id: "",
        discount: "",
        originalPrice: "",
        salePrice: "",
        stock: "",
        startTime: "",
        endTime: "",
    });

    const token = localStorage.getItem("shopsphereToken");
    const adminHeaders = { Authorization: `Bearer ${token}` };

    const loadData = async () => {
        setLoading(true);

        try {
            const [salesResponse, productsResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/admin/flash-sales`, {
                    headers: adminHeaders,
                }),
                fetch(`${API_BASE_URL}/admin/products`, {
                    headers: adminHeaders,
                }),
            ]);
            const [salesData, productsData] = await Promise.all([
                salesResponse.json(),
                productsResponse.json(),
            ]);

            if (!salesResponse.ok || !salesData.success) {
                throw new Error(salesData.message || "Failed to fetch flash sales");
            }
            if (!productsResponse.ok || !productsData.success) {
                throw new Error(productsData.message || "Failed to fetch products");
            }

            setFlashSales(
                Array.isArray(salesData.flash_sales)
                    ? salesData.flash_sales.map(toFlashSale)
                    : []
            );
            setProducts(
                Array.isArray(productsData.products)
                    ? productsData.products.filter(
                          (product) =>
                              String(product.status).toLowerCase() === "active"
                      )
                    : []
            );
            setError("");
        } catch (loadError) {
            setError(loadError.message || "Unable to load flash sales.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // Load once when the admin screen opens.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === "product_id") {
            const product = products.find(
                (item) => String(item.id) === value
            );
            const originalPrice = product
                ? Number(product.sale_price ?? product.base_price)
                : "";
            setFormData((previous) => ({
                ...previous,
                product_id: value,
                originalPrice,
                salePrice: "",
                discount: "",
            }));
            return;
        }

        if (name === "salePrice") {
            const original = Number(formData.originalPrice);
            const sale = Number(value);
            setFormData((previous) => ({
                ...previous,
                salePrice: value,
                discount:
                    original > 0 && sale > 0 && sale < original
                        ? String(Math.round((1 - sale / original) * 100))
                        : "",
            }));
            return;
        }

        setFormData((previous) => ({ ...previous, [name]: value }));
    };

    const handleAddFlashSale = async (e) => {
        e.preventDefault();

        if (
            !formData.name ||
            !formData.product_id ||
            !formData.originalPrice ||
            !formData.salePrice ||
            !formData.stock ||
            !formData.startTime ||
            !formData.endTime
        ) {
            setError("Please fill all required fields.");
            return;
        }

        if (Number(formData.salePrice) >= Number(formData.originalPrice)) {
            setError("Sale price must be lower than the product price.");
            return;
        }
        if (new Date(formData.endTime) <= new Date(formData.startTime)) {
            setError("End time must be after start time.");
            return;
        }

        setSaving(true);
        setError("");
        try {
            const response = await fetch(`${API_BASE_URL}/admin/flash-sales`, {
                method: "POST",
                headers: { ...adminHeaders, "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: formData.name,
                    product_id: Number(formData.product_id),
                    sale_price: Number(formData.salePrice),
                    stock_limit: Number(formData.stock),
                    start_time: new Date(formData.startTime).toISOString(),
                    end_time: new Date(formData.endTime).toISOString(),
                }),
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Failed to create flash sale");
            }

            setFormData({
                name: "",
                product_id: "",
                discount: "",
                originalPrice: "",
                salePrice: "",
                stock: "",
                startTime: "",
                endTime: "",
            });
            setShowForm(false);
            await loadData();
        } catch (saveError) {
            setError(saveError.message || "Unable to create flash sale.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this flash sale?")) {
            return;
        }

        try {
            const response = await fetch(
                `${API_BASE_URL}/admin/flash-sales/${id}`,
                { method: "DELETE", headers: adminHeaders }
            );
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Failed to delete flash sale");
            }
            await loadData();
        } catch (deleteError) {
            setError(deleteError.message || "Unable to delete flash sale.");
        }
    };


    const filteredFlashSales = flashSales.filter((sale) => {

        const searchMatch =
            sale.name.toLowerCase().includes(search.toLowerCase()) ||
            sale.product.toLowerCase().includes(search.toLowerCase());

        const statusMatch =
            statusFilter === "All" ||
            sale.status === statusFilter;

        return searchMatch && statusMatch;
    });


    const activeSales = flashSales.filter(
        (sale) => sale.status === "Active"
    ).length;


    const scheduledSales = flashSales.filter(
        (sale) => sale.status === "Scheduled"
    ).length;


    const soldOutSales = flashSales.filter(
        (sale) => sale.status === "Sold Out"
    ).length;


    const endedSales = flashSales.filter(
        (sale) => sale.status === "Ended"
    ).length;


    const getStatusClass = (status) => {

        if (status === "Active") {
            return "bg-green-100 text-green-700";
        }

        if (status === "Sold Out") {
            return "bg-red-100 text-red-700";
        }

        if (status === "Ended") {
            return "bg-gray-100 text-gray-600";
        }

        return "bg-yellow-100 text-yellow-700";
    };


    const getSoldPercentage = (sold, stock) => {

        if (stock === 0) {
            return 0;
        }

        return Math.min(
            (sold / stock) * 100,
            100
        );
    };


    return (
        <div className="min-h-screen bg-aqua-spring p-4 sm:p-6 lg:p-8">

            {/* Header */}

            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                <div>

                    <h1 className="text-2xl font-bold text-cyprus sm:text-3xl">
                        Flash Sales
                    </h1>

                    <p className="mt-1 text-sm text-text-grey">
                        Manage limited-time flash sale campaigns
                    </p>

                </div>


                <button
                    onClick={() => setShowForm(!showForm)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-ocean-green px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                >
                    <i className="fa-solid fa-bolt"></i>

                    Add Flash Sale
                </button>

            </div>

            {error && (
                <div
                    role="alert"
                    className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                    {error}
                </div>
            )}
            {loading && (
                <p className="mb-5 text-sm text-text-grey">
                    Loading flash sales...
                </p>
            )}

            {/* Stats */}

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">

                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

                    <p className="text-sm text-text-grey">
                        Total Sales
                    </p>

                    <div className="mt-3 flex items-center justify-between">

                        <h2 className="text-2xl font-bold text-cyprus">
                            {flashSales.length}
                        </h2>

                        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-aqua-spring text-ocean-green">
                            <i className="fa-solid fa-bolt"></i>
                        </div>

                    </div>

                </div>


                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

                    <p className="text-sm text-text-grey">
                        Active
                    </p>

                    <div className="mt-3 flex items-center justify-between">

                        <h2 className="text-2xl font-bold text-green-600">
                            {activeSales}
                        </h2>

                        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-green-50 text-green-600">
                            <i className="fa-solid fa-circle-play"></i>
                        </div>

                    </div>

                </div>


                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

                    <p className="text-sm text-text-grey">
                        Scheduled
                    </p>

                    <div className="mt-3 flex items-center justify-between">

                        <h2 className="text-2xl font-bold text-yellow-600">
                            {scheduledSales}
                        </h2>

                        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-yellow-50 text-yellow-600">
                            <i className="fa-solid fa-calendar-days"></i>
                        </div>

                    </div>

                </div>


                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

                    <p className="text-sm text-text-grey">
                        Sold Out
                    </p>

                    <div className="mt-3 flex items-center justify-between">

                        <h2 className="text-2xl font-bold text-red-600">
                            {soldOutSales}
                        </h2>

                        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-red-50 text-red-600">
                            <i className="fa-solid fa-box-open"></i>
                        </div>

                    </div>

                </div>


                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

                    <p className="text-sm text-text-grey">
                        Ended
                    </p>

                    <div className="mt-3 flex items-center justify-between">

                        <h2 className="text-2xl font-bold text-gray-600">
                            {endedSales}
                        </h2>

                        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                            <i className="fa-solid fa-clock-rotate-left"></i>
                        </div>

                    </div>

                </div>

            </div>


            {/* Add Flash Sale Form */}

            {showForm && (

                <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

                    <div className="mb-5 flex items-center justify-between">

                        <div>

                            <h2 className="text-lg font-bold text-cyprus">
                                Add New Flash Sale
                            </h2>

                            <p className="text-sm text-text-grey">
                                Create a limited-time product deal
                            </p>

                        </div>


                        <button
                            onClick={() => setShowForm(false)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"
                        >
                            <i className="fa-solid fa-xmark"></i>
                        </button>

                    </div>


                    <form
                        onSubmit={handleAddFlashSale}
                        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
                    >

                        {/* Name */}

                        <div>

                            <label className="mb-2 block text-sm font-medium text-cyprus">
                                Sale Name
                            </label>

                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="e.g. Weekend Flash Sale"
                                required
                                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-ocean-green"
                            />

                        </div>


                        {/* Product */}

                        <div>

                            <label className="mb-2 block text-sm font-medium text-cyprus">
                                Product
                            </label>

                            <select
                                name="product_id"
                                value={formData.product_id}
                                onChange={handleChange}
                                required
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-ocean-green"
                            >
                                <option value="">Select a product</option>
                                {products.map((product) => (
                                    <option key={product.id} value={product.id}>
                                        {product.title} — ₹
                                        {Number(
                                            product.sale_price ?? product.base_price
                                        ).toLocaleString("en-IN")}
                                    </option>
                                ))}
                            </select>

                        </div>


                        {/* Discount */}

                        <div>

                            <label className="mb-2 block text-sm font-medium text-cyprus">
                                Discount (%)
                            </label>

                            <input
                                type="number"
                                name="discount"
                                value={formData.discount}
                                readOnly
                                placeholder="Select product and sale price"
                                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-ocean-green"
                            />

                        </div>


                        {/* Original Price */}

                        <div>

                            <label className="mb-2 block text-sm font-medium text-cyprus">
                                Original Price
                            </label>

                            <input
                                type="number"
                                name="originalPrice"
                                value={formData.originalPrice}
                                readOnly
                                placeholder="Select a product"
                                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-ocean-green"
                            />

                        </div>


                        {/* Sale Price */}

                        <div>

                            <label className="mb-2 block text-sm font-medium text-cyprus">
                                Sale Price
                            </label>

                            <input
                                type="number"
                                name="salePrice"
                                value={formData.salePrice}
                                onChange={handleChange}
                                placeholder="e.g. 6999"
                                min="0.01"
                                step="0.01"
                                required
                                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-ocean-green"
                            />

                        </div>


                        {/* Stock */}

                        <div>

                            <label className="mb-2 block text-sm font-medium text-cyprus">
                                Stock
                            </label>

                            <input
                                type="number"
                                name="stock"
                                value={formData.stock}
                                onChange={handleChange}
                                placeholder="e.g. 50"
                                min="1"
                                step="1"
                                required
                                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-ocean-green"
                            />

                        </div>


                        {/* Start */}

                        <div>

                            <label className="mb-2 block text-sm font-medium text-cyprus">
                                Start Time
                            </label>

                            <input
                                type="datetime-local"
                                name="startTime"
                                value={formData.startTime}
                                onChange={handleChange}
                                required
                                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-ocean-green"
                            />

                        </div>


                        {/* End */}

                        <div>

                            <label className="mb-2 block text-sm font-medium text-cyprus">
                                End Time
                            </label>

                            <input
                                type="datetime-local"
                                name="endTime"
                                value={formData.endTime}
                                onChange={handleChange}
                                min={formData.startTime || undefined}
                                required
                                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-ocean-green"
                            />

                        </div>


                        {/* Buttons */}

                        <div className="flex items-end gap-3 md:col-span-2 xl:col-span-3">

                            <button
                                type="submit"
                                disabled={saving || products.length === 0}
                                className="rounded-lg bg-ocean-green px-6 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {saving ? "Saving..." : "Save Flash Sale"}
                            </button>

                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="rounded-lg border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-cyprus hover:bg-gray-50"
                            >
                                Cancel
                            </button>

                        </div>

                    </form>

                </div>

            )}


            {/* Search & Filter */}

            <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                    <div className="relative">

                        <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-sm text-text-grey"></i>

                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search sale or product..."
                            className="w-full rounded-lg border border-gray-200 py-3 pl-11 pr-4 text-sm outline-none focus:border-ocean-green"
                        />

                    </div>


                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-ocean-green"
                    >

                        <option value="All">
                            All Status
                        </option>

                        <option value="Active">
                            Active
                        </option>

                        <option value="Scheduled">
                            Scheduled
                        </option>

                        <option value="Sold Out">
                            Sold Out
                        </option>

                        <option value="Ended">
                            Ended
                        </option>

                    </select>

                </div>

            </div>


            {/* Desktop Table */}

            <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:block">

                <div className="overflow-x-auto">

                    <table className="w-full">

                        <thead className="bg-gray-50">

                            <tr>

                                <th className="px-6 py-4 text-left text-xs font-semibold uppercase text-text-grey">
                                    Sale
                                </th>

                                <th className="px-6 py-4 text-left text-xs font-semibold uppercase text-text-grey">
                                    Product
                                </th>

                                <th className="px-6 py-4 text-left text-xs font-semibold uppercase text-text-grey">
                                    Pricing
                                </th>

                                <th className="px-6 py-4 text-left text-xs font-semibold uppercase text-text-grey">
                                    Stock
                                </th>

                                <th className="px-6 py-4 text-left text-xs font-semibold uppercase text-text-grey">
                                    Duration
                                </th>

                                <th className="px-6 py-4 text-left text-xs font-semibold uppercase text-text-grey">
                                    Status
                                </th>

                                <th className="px-6 py-4 text-right text-xs font-semibold uppercase text-text-grey">
                                    Action
                                </th>

                            </tr>

                        </thead>


                        <tbody className="divide-y divide-gray-100">

                            {filteredFlashSales.map((sale) => (

                                <tr
                                    key={sale.id}
                                    className="hover:bg-gray-50"
                                >

                                    {/* Sale */}

                                    <td className="px-6 py-4">

                                        <p className="font-bold text-cyprus">
                                            {sale.name}
                                        </p>

                                        <span className="mt-1 inline-block rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-500">
                                            {sale.discount} OFF
                                        </span>

                                    </td>


                                    {/* Product */}

                                    <td className="px-6 py-4">

                                        <p className="max-w-48 text-sm font-semibold text-cyprus">
                                            {sale.product}
                                        </p>

                                    </td>


                                    {/* Pricing */}

                                    <td className="px-6 py-4">

                                        <p className="font-bold text-ocean-green">
                                            ₹{sale.salePrice.toLocaleString()}
                                        </p>

                                        <p className="text-xs text-text-grey line-through">
                                            ₹{sale.originalPrice.toLocaleString()}
                                        </p>

                                    </td>


                                    {/* Stock */}

                                    <td className="px-6 py-4">

                                        <div className="min-w-32">

                                            <div className="mb-1 flex justify-between text-xs">

                                                <span className="text-text-grey">
                                                    {sale.sold} sold
                                                </span>

                                                <span className="font-semibold text-cyprus">
                                                    {sale.stock}
                                                </span>

                                            </div>


                                            <div className="h-2 overflow-hidden rounded-full bg-gray-100">

                                                <div
                                                    className="h-full rounded-full bg-ocean-green"
                                                    style={{
                                                        width: `${getSoldPercentage(
                                                            sale.sold,
                                                            sale.stock
                                                        )}%`,
                                                    }}
                                                ></div>

                                            </div>

                                        </div>

                                    </td>


                                    {/* Duration */}

                                    <td className="px-6 py-4">

                                        <p className="text-xs font-semibold text-cyprus">
                                            {sale.startTime}
                                        </p>

                                        <p className="mt-1 text-xs text-text-grey">
                                            to {sale.endTime}
                                        </p>

                                    </td>


                                    {/* Status */}

                                    <td className="px-6 py-4">

                                        <span
                                            className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                                                sale.status
                                            )}`}
                                        >
                                            {sale.status}
                                        </span>

                                    </td>


                                    {/* Actions */}

                                    <td className="px-6 py-4">

                                        <div className="flex justify-end gap-2">

                                            <button
                                                onClick={() =>
                                                    handleDelete(sale.id)
                                                }
                                                className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100"
                                                title="Delete"
                                            >
                                                <i className="fa-solid fa-trash"></i>
                                            </button>

                                        </div>

                                    </td>

                                </tr>

                            ))}

                        </tbody>

                    </table>

                </div>

            </div>


            {/* Mobile Cards */}

            <div className="space-y-4 lg:hidden">

                {filteredFlashSales.map((sale) => (

                    <div
                        key={sale.id}
                        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                    >

                        <div className="flex items-start justify-between gap-3">

                            <div>

                                <h3 className="font-bold text-cyprus">
                                    {sale.name}
                                </h3>

                                <p className="mt-1 text-sm text-text-grey">
                                    {sale.product}
                                </p>

                            </div>


                            <span
                                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                                    sale.status
                                )}`}
                            >
                                {sale.status}
                            </span>

                        </div>


                        <div className="mt-4 flex items-center justify-between">

                            <div>

                                <p className="text-xs text-text-grey">
                                    Sale Price
                                </p>

                                <p className="mt-1 text-lg font-bold text-ocean-green">
                                    ₹{sale.salePrice.toLocaleString()}
                                </p>

                            </div>


                            <div className="text-right">

                                <p className="text-xs text-text-grey">
                                    Original
                                </p>

                                <p className="mt-1 text-sm text-text-grey line-through">
                                    ₹{sale.originalPrice.toLocaleString()}
                                </p>

                            </div>

                        </div>


                        <div className="mt-4 grid grid-cols-2 gap-4">

                            <div>

                                <p className="text-xs text-text-grey">
                                    Discount
                                </p>

                                <p className="mt-1 font-bold text-red-500">
                                    {sale.discount}
                                </p>

                            </div>


                            <div>

                                <p className="text-xs text-text-grey">
                                    Stock
                                </p>

                                <p className="mt-1 font-semibold text-cyprus">
                                    {sale.sold} / {sale.stock} sold
                                </p>

                            </div>


                            <div>

                                <p className="text-xs text-text-grey">
                                    Start
                                </p>

                                <p className="mt-1 text-xs font-semibold text-cyprus">
                                    {sale.startTime}
                                </p>

                            </div>


                            <div>

                                <p className="text-xs text-text-grey">
                                    End
                                </p>

                                <p className="mt-1 text-xs font-semibold text-cyprus">
                                    {sale.endTime}
                                </p>

                            </div>

                        </div>


                        <div className="mt-4">

                            <div className="mb-1 flex justify-between text-xs">

                                <span className="text-text-grey">
                                    Sale Progress
                                </span>

                                <span className="font-semibold text-cyprus">
                                    {Math.round(
                                        getSoldPercentage(
                                            sale.sold,
                                            sale.stock
                                        )
                                    )}%
                                </span>

                            </div>


                            <div className="h-2 overflow-hidden rounded-full bg-gray-100">

                                <div
                                    className="h-full rounded-full bg-ocean-green"
                                    style={{
                                        width: `${getSoldPercentage(
                                            sale.sold,
                                            sale.stock
                                        )}%`,
                                    }}
                                ></div>

                            </div>

                        </div>


                        <div className="mt-5 flex gap-2 border-t border-gray-100 pt-4">

                            <button
                                onClick={() =>
                                    handleDelete(sale.id)
                                }
                                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-100"
                            >
                                <i className="fa-solid fa-trash"></i>
                                Delete
                            </button>

                        </div>

                    </div>

                ))}

            </div>


            {/* Empty State */}

            {filteredFlashSales.length === 0 && (

                <div className="rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm">

                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-aqua-spring text-2xl text-ocean-green">
                        <i className="fa-solid fa-bolt"></i>
                    </div>

                    <h3 className="mt-4 text-lg font-bold text-cyprus">
                        No Flash Sales Found
                    </h3>

                    <p className="mt-1 text-sm text-text-grey">
                        Try changing your search or filter.
                    </p>

                </div>

            )}

        </div>
    );
}

export default FlashSales;