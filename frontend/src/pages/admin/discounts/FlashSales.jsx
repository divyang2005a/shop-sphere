import React, { useState } from "react";

function FlashSales() {

    const [flashSales, setFlashSales] = useState([
        {
            id: 1,
            name: "Weekend Flash Sale",
            product: "Samsung Galaxy S25",
            discount: "35%",
            originalPrice: 79999,
            salePrice: 51999,
            stock: 25,
            sold: 18,
            startTime: "2026-10-10 10:00",
            endTime: "2026-10-10 22:00",
            status: "Active",
        },
        {
            id: 2,
            name: "Fashion Flash Deal",
            product: "Nike Air Max Shoes",
            discount: "40%",
            originalPrice: 12999,
            salePrice: 7799,
            stock: 40,
            sold: 27,
            startTime: "2026-10-11 09:00",
            endTime: "2026-10-11 21:00",
            status: "Scheduled",
        },
        {
            id: 3,
            name: "Electronics Flash Sale",
            product: "Sony Wireless Headphones",
            discount: "30%",
            originalPrice: 9999,
            salePrice: 6999,
            stock: 30,
            sold: 30,
            startTime: "2026-10-05 10:00",
            endTime: "2026-10-05 20:00",
            status: "Sold Out",
        },
        {
            id: 4,
            name: "Home Essentials Deal",
            product: "Philips Air Fryer",
            discount: "25%",
            originalPrice: 8999,
            salePrice: 6749,
            stock: 50,
            sold: 42,
            startTime: "2026-10-12 12:00",
            endTime: "2026-10-12 23:00",
            status: "Scheduled",
        },
        {
            id: 5,
            name: "Beauty Mega Deal",
            product: "Mamaearth Face Kit",
            discount: "45%",
            originalPrice: 2499,
            salePrice: 1374,
            stock: 60,
            sold: 60,
            startTime: "2026-10-01 10:00",
            endTime: "2026-10-01 22:00",
            status: "Ended",
        },
    ]);

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [showForm, setShowForm] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        product: "",
        discount: "",
        originalPrice: "",
        salePrice: "",
        stock: "",
        startTime: "",
        endTime: "",
        status: "Scheduled",
    });


    const handleChange = (e) => {

        const { name, value } = e.target;

        setFormData({
            ...formData,
            [name]: value,
        });
    };


    const handleAddFlashSale = (e) => {

        e.preventDefault();

        if (
            !formData.name ||
            !formData.product ||
            !formData.discount ||
            !formData.originalPrice ||
            !formData.salePrice ||
            !formData.stock ||
            !formData.startTime ||
            !formData.endTime
        ) {
            alert("Please fill all required fields.");
            return;
        }


        const newFlashSale = {
            id: Date.now(),
            name: formData.name,
            product: formData.product,
            discount: `${formData.discount}%`,
            originalPrice: Number(formData.originalPrice),
            salePrice: Number(formData.salePrice),
            stock: Number(formData.stock),
            sold: 0,
            startTime: formData.startTime,
            endTime: formData.endTime,
            status: formData.status,
        };


        setFlashSales([
            newFlashSale,
            ...flashSales,
        ]);


        setFormData({
            name: "",
            product: "",
            discount: "",
            originalPrice: "",
            salePrice: "",
            stock: "",
            startTime: "",
            endTime: "",
            status: "Scheduled",
        });


        setShowForm(false);

        alert("Flash sale added successfully.");
    };


    const handleDelete = (id) => {

        const confirmDelete = window.confirm(
            "Are you sure you want to delete this flash sale?"
        );

        if (!confirmDelete) {
            return;
        }

        setFlashSales(
            flashSales.filter(
                (sale) => sale.id !== id
            )
        );
    };


    const filteredFlashSales = flashSales.filter((sale) => {

        const searchMatch =
            sale.name
                .toLowerCase()
                .includes(search.toLowerCase()) ||
            sale.product
                .toLowerCase()
                .includes(search.toLowerCase());

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
                                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-ocean-green"
                            />

                        </div>


                        {/* Product */}

                        <div>

                            <label className="mb-2 block text-sm font-medium text-cyprus">
                                Product
                            </label>

                            <input
                                type="text"
                                name="product"
                                value={formData.product}
                                onChange={handleChange}
                                placeholder="Product name"
                                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-ocean-green"
                            />

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
                                onChange={handleChange}
                                placeholder="e.g. 30"
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
                                onChange={handleChange}
                                placeholder="e.g. 9999"
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
                                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-ocean-green"
                            />

                        </div>


                        {/* Status */}

                        <div>

                            <label className="mb-2 block text-sm font-medium text-cyprus">
                                Status
                            </label>

                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-ocean-green"
                            >

                                <option value="Scheduled">
                                    Scheduled
                                </option>

                                <option value="Active">
                                    Active
                                </option>

                            </select>

                        </div>


                        {/* Buttons */}

                        <div className="flex items-end gap-3 md:col-span-2 xl:col-span-3">

                            <button
                                type="submit"
                                className="rounded-lg bg-ocean-green px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
                            >
                                Save Flash Sale
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
                                                className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-aqua-spring hover:text-ocean-green"
                                                title="Edit"
                                            >
                                                <i className="fa-solid fa-pen"></i>
                                            </button>

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
                                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-semibold text-cyprus hover:bg-aqua-spring"
                            >
                                <i className="fa-solid fa-pen"></i>
                                Edit
                            </button>


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