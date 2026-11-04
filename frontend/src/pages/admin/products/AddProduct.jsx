
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const BASE_URL = "http://localhost:5000";
const API_URL = `${BASE_URL}/api/admin/products`;
const CATEGORY_URL = `${BASE_URL}/api/admin/categories`;
const BRAND_URL = `${BASE_URL}/api/admin/brands`;
const GST_URL = `${BASE_URL}/api/admin/gst-rates`;

const initialFormData = {
    title: "",
    category_id: "",
    brand_id: "",
    short_description: "",
    description: "",
    base_price: "",
    sale_price: "",
    discount_percentage: "0",
    tax_percentage: "",
    stock_quantity: "0",
    low_stock_threshold: "5",
    stock_status: "in_stock",
    featured: false,
    bestseller: false,
    new_arrival: false,
    status: "active",
    meta_title: "",
    meta_description: "",
};

function AddProduct() {
    const navigate = useNavigate();
    const token = localStorage.getItem("shopsphereToken");

    const [formData, setFormData] = useState(initialFormData);
    const [categories, setCategories] = useState([]);
    const [brands, setBrands] = useState([]);
    const [gstRates, setGstRates] = useState([]);

    // Multiple images
    const [images, setImages] = useState([]);
    const [previews, setPreviews] = useState([]);

    const [loading, setLoading] = useState(false);
    const [dataLoading, setDataLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Load categories, brands and GST rates
    useEffect(() => {
        const controller = new AbortController();

        async function fetchDropdownData() {
            setDataLoading(true);
            setError("");

            try {
                if (!token) {
                    throw new Error("Please login again.");
                }

                const headers = {
                    Accept: "application/json",
                    Authorization: `Bearer ${token}`,
                };

                const responses = await Promise.all([
                    fetch(CATEGORY_URL, {
                        headers,
                        signal: controller.signal,
                    }),
                    fetch(BRAND_URL, {
                        headers,
                        signal: controller.signal,
                    }),
                    fetch(GST_URL, {
                        headers,
                        signal: controller.signal,
                    }),
                ]);

                const [categoryResponse, brandResponse, gstResponse] =
                    responses;

                const [categoryData, brandData, gstData] =
                    await Promise.all(
                        responses.map(async (response) => {
                            return response.json().catch(() => ({}));
                        })
                    );

                if (!categoryResponse.ok || !categoryData.success) {
                    throw new Error(
                        categoryData.message || "Failed to load categories."
                    );
                }

                if (!brandResponse.ok || !brandData.success) {
                    throw new Error(
                        brandData.message || "Failed to load brands."
                    );
                }

                if (!gstResponse.ok || !gstData.success) {
                    throw new Error(
                        gstData.message || "Failed to load GST rates."
                    );
                }

                if (controller.signal.aborted) return;

                setCategories(categoryData.categories || []);
                setBrands(brandData.brands || []);

                const rates =
                    gstData.gst_rates ||
                    gstData.gst ||
                    gstData.tax_rates ||
                    [];

                setGstRates(
                    rates.filter(
                        (gst) => Number(gst.status ?? 1) === 1
                    )
                );
            } catch (err) {
                if (err.name !== "AbortError") {
                    setError(err.message || "Unable to load form data.");
                }
            } finally {
                if (!controller.signal.aborted) {
                    setDataLoading(false);
                }
            }
        }

        fetchDropdownData();

        return () => controller.abort();
    }, [token]);

    // Automatically calculate discount
    useEffect(() => {
        const basePrice = Number(formData.base_price);
        const salePrice = Number(formData.sale_price);

        let discount = 0;

        if (
            formData.base_price !== "" &&
            formData.sale_price !== "" &&
            basePrice > 0 &&
            salePrice >= 0 &&
            salePrice < basePrice
        ) {
            discount = ((basePrice - salePrice) / basePrice) * 100;
        }

        setFormData((previous) => ({
            ...previous,
            discount_percentage: discount.toFixed(2),
        }));
    }, [formData.base_price, formData.sale_price]);

    // Form inputs
    const handleChange = (event) => {
        const { name, value, type, checked } = event.target;

        setFormData((previous) => ({
            ...previous,
            [name]: type === "checkbox" ? checked : value,
        }));
    };

    // Select multiple images
    const handleImageChange = (event) => {
        const selectedFiles = Array.from(event.target.files || []);

        setError("");
        setSuccess("");

        if (selectedFiles.length === 0) return;

        const invalidFile = selectedFiles.find(
            (file) => !file.type.startsWith("image/")
        );

        if (invalidFile) {
            setError("Please select only valid image files.");
            event.target.value = "";
            return;
        }

        const oversizedFile = selectedFiles.find(
            (file) => file.size > 5 * 1024 * 1024
        );

        if (oversizedFile) {
            setError(
                `Each image must be 5 MB or less: ${oversizedFile.name}`
            );
            event.target.value = "";
            return;
        }

        // Avoid selecting the same file more than once
        setImages((previous) => {
            const existingKeys = new Set(
                previous.map(
                    (file) =>
                        `${file.name}-${file.size}-${file.lastModified}`
                )
            );

            const newFiles = selectedFiles.filter((file) => {
                const key =
                    `${file.name}-${file.size}-${file.lastModified}`;

                return !existingKeys.has(key);
            });

            return [...previous, ...newFiles];
        });

        // Allow selecting the same file again after removing it
        event.target.value = "";
    };

    // Generate image previews and clean up URLs
    useEffect(() => {
        const urls = images.map((file) => URL.createObjectURL(file));

        setPreviews(urls);

        return () => {
            urls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [images]);

    // Remove selected image
    const removeImage = (indexToRemove) => {
        setImages((previous) =>
            previous.filter((_, index) => index !== indexToRemove)
        );
    };

    // Create product and upload images
    const handleSubmit = async (event) => {
        event.preventDefault();

        if (loading) return;

        setError("");
        setSuccess("");

        if (!token) {
            setError("Please login again.");
            return;
        }

        if (!formData.title.trim()) {
            setError("Product title is required.");
            return;
        }

        const selectedCategory = categories.find(
            (category) =>
                String(category.id) === String(formData.category_id)
        );

        if (!selectedCategory) {
            setError("Please select a valid category.");
            return;
        }

        const selectedBrand = brands.find(
            (brand) =>
                String(brand.id) === String(formData.brand_id)
        );

        if (!selectedBrand) {
            setError("Please select a valid brand.");
            return;
        }

        const basePrice = Number(formData.base_price);
        const salePrice = Number(formData.sale_price);
        const stockQuantity = Number(formData.stock_quantity);
        const lowStockThreshold = Number(formData.low_stock_threshold);

        if (
            formData.base_price === "" ||
            !Number.isFinite(basePrice) ||
            basePrice <= 0
        ) {
            setError("Base price must be greater than zero.");
            return;
        }

        if (
            formData.sale_price === "" ||
            !Number.isFinite(salePrice) ||
            salePrice < 0
        ) {
            setError("Please enter a valid sale price.");
            return;
        }

        if (salePrice > basePrice) {
            setError("Sale price cannot be greater than base price.");
            return;
        }

        if (formData.tax_percentage === "") {
            setError("Please select a GST percentage.");
            return;
        }

        const selectedGst = gstRates.find(
            (gst) =>
                Number(gst.gst_percentage) ===
                Number(formData.tax_percentage)
        );

        if (!selectedGst) {
            setError("Please select a valid GST rate.");
            return;
        }

        if (
            formData.stock_quantity === "" ||
            !Number.isInteger(stockQuantity) ||
            stockQuantity < 0
        ) {
            setError("Please enter a valid stock quantity.");
            return;
        }

        if (
            formData.low_stock_threshold === "" ||
            !Number.isInteger(lowStockThreshold) ||
            lowStockThreshold < 0
        ) {
            setError("Low stock threshold must be a valid non-negative integer.");
            return;
        }

        setLoading(true);

        // Used to distinguish product-creation failures from image-upload failures.
        let createdProductId = null;
        let imageUploadWarning = "";

        try {
            const productPayload = {
                category_name: selectedCategory.name,
                brand_name: selectedBrand.name,
                title: formData.title.trim(),

                short_description: formData.short_description,
                full_description: formData.description,

                base_price: basePrice,
                sale_price: salePrice,
                discount_percentage: Number(
                    formData.discount_percentage
                ),

                tax_percentage: Number(selectedGst.gst_percentage),

                stock_quantity: stockQuantity,
                low_stock_threshold: lowStockThreshold,
                stock_status: formData.stock_status,

                featured: formData.featured ? 1 : 0,
                bestseller: formData.bestseller ? 1 : 0,
                new_arrival: formData.new_arrival ? 1 : 0,

                status: formData.status,
                meta_title: formData.meta_title,
                meta_description: formData.meta_description,
            };

            // Step 1: Create the product
            const response = await fetch(API_URL, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(productPayload),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok || data.success === false) {
                throw new Error(
                    data.message || "Failed to create product."
                );
            }

            createdProductId =
                data.product?.product_id ??
                data.product?.id ??
                data.product_id ??
                data.id;

            // Step 2: Upload images one by one.
            // This uses the existing single-image backend endpoint.
            if (images.length > 0) {
                if (!createdProductId) {
                    imageUploadWarning =
                        "The product was created, but the API did not return its ID. Images could not be uploaded.";
                } else {
                    const failedImages = [];

                    for (const file of images) {
                        try {
                            const imageFormData = new FormData();

                            // Existing backend endpoint expects "image".
                            imageFormData.append("image", file);

                            const imageResponse = await fetch(
                                `${API_URL}/${encodeURIComponent(
                                    createdProductId
                                )}/images`,
                                {
                                    method: "POST",
                                    headers: {
                                        Authorization: `Bearer ${token}`,
                                        Accept: "application/json",
                                    },
                                    body: imageFormData,
                                }
                            );

                            const imageData =
                                await imageResponse.json().catch(() => ({}));

                            if (
                                !imageResponse.ok ||
                                imageData.success === false
                            ) {
                                failedImages.push(file.name);
                            }
                        } catch (uploadError) {
                            failedImages.push(file.name);
                        }
                    }

                    if (failedImages.length > 0) {
                        imageUploadWarning =
                            `Product created, but ${failedImages.length} image(s) failed to upload: ${failedImages.join(", ")}.`;
                    }
                }
            }

            // Step 3: Navigate even if only an image upload failed.
            // Do not create the product again just because an image failed.
            navigate("/admin/products", {
                replace: true,
                state: {
                    productAdded: true,
                    message: imageUploadWarning
                        ? "Product created successfully. " + imageUploadWarning
                        : "Product and images created successfully.",
                    warning: Boolean(imageUploadWarning),
                    productId: createdProductId,
                },
            });

            return;
        } catch (err) {
            console.error("Add product error:", err);

            // If product creation already succeeded, don't encourage
            // creating a duplicate product by submitting the form again.
            if (createdProductId) {
                navigate("/admin/products", {
                    replace: true,
                    state: {
                        productAdded: true,
                        warning: true,
                        productId: createdProductId,
                        message:
                            "Product was created, but a later step failed. Check the product and its images in the Products page.",
                    },
                });

                return;
            }

            setError(err.message || "Something went wrong.");
        } finally {
            setLoading(false);
        }
    };

    const inputClass =
        "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-ocean-green focus:ring-2 focus:ring-ocean-green/20";

    const labelClass =
        "mb-1.5 block text-sm font-medium text-gray-700";

    const sectionClass =
        "rounded-xl border border-gray-200 bg-white p-5 shadow-sm";

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-6xl">
                {/* Header */}
                <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-cyprus sm:text-3xl">
                            Add Product
                        </h1>

                        <p className="mt-1 text-sm text-gray-500">
                            Add a new product to your ShopSphere store.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => navigate("/admin/products")}
                        disabled={loading}
                        className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
                    >
                        Back to Products
                    </button>
                </div>

                {error && (
                    <div
                        role="alert"
                        className="mb-5 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                    >
                        <span>{error}</span>

                        <button
                            type="button"
                            onClick={() => setError("")}
                            aria-label="Close error"
                            className="font-bold"
                        >
                            ×
                        </button>
                    </div>
                )}

                {success && (
                    <div
                        role="status"
                        className="mb-5 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700"
                    >
                        {success}
                    </div>
                )}

                {dataLoading ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-500">
                        Loading categories, brands and GST rates...
                    </div>
                ) : (
                    <form
                        onSubmit={handleSubmit}
                        className="space-y-6"
                    >
                        {/* Basic Information */}
                        <section className={sectionClass}>
                            <h2 className="mb-5 text-lg font-semibold text-cyprus">
                                Basic Information
                            </h2>

                            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                <div className="md:col-span-2">
                                    <label className={labelClass}>
                                        Product Title *
                                    </label>

                                    <input
                                        type="text"
                                        name="title"
                                        value={formData.title}
                                        onChange={handleChange}
                                        placeholder="Enter product title"
                                        className={inputClass}
                                        required
                                        maxLength={255}
                                    />
                                </div>

                                <div>
                                    <label className={labelClass}>
                                        Category *
                                    </label>

                                    <select
                                        name="category_id"
                                        value={formData.category_id}
                                        onChange={handleChange}
                                        className={inputClass}
                                        required
                                    >
                                        <option value="">
                                            Select Category
                                        </option>

                                        {categories.map((category) => (
                                            <option
                                                key={category.id}
                                                value={category.id}
                                            >
                                                {category.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className={labelClass}>
                                        Brand *
                                    </label>

                                    <select
                                        name="brand_id"
                                        value={formData.brand_id}
                                        onChange={handleChange}
                                        className={inputClass}
                                        required
                                    >
                                        <option value="">
                                            Select Brand
                                        </option>

                                        {brands.map((brand) => (
                                            <option
                                                key={brand.id}
                                                value={brand.id}
                                            >
                                                {brand.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="md:col-span-2">
                                    <label className={labelClass}>
                                        Short Description
                                    </label>

                                    <textarea
                                        name="short_description"
                                        value={formData.short_description}
                                        onChange={handleChange}
                                        placeholder="Enter short description"
                                        rows={2}
                                        className={inputClass}
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className={labelClass}>
                                        Full Description
                                    </label>

                                    <textarea
                                        name="description"
                                        value={formData.description}
                                        onChange={handleChange}
                                        placeholder="Enter full product description"
                                        rows={4}
                                        className={inputClass}
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Pricing and GST */}
                        <section className={sectionClass}>
                            <h2 className="mb-5 text-lg font-semibold text-cyprus">
                                Pricing & GST
                            </h2>

                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                                <div>
                                    <label className={labelClass}>
                                        Base Price (₹) *
                                    </label>

                                    <input
                                        type="number"
                                        name="base_price"
                                        value={formData.base_price}
                                        onChange={handleChange}
                                        min="0.01"
                                        step="0.01"
                                        placeholder="0.00"
                                        className={inputClass}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className={labelClass}>
                                        Sale Price (₹) *
                                    </label>

                                    <input
                                        type="number"
                                        name="sale_price"
                                        value={formData.sale_price}
                                        onChange={handleChange}
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                        className={inputClass}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className={labelClass}>
                                        Discount (%)
                                    </label>

                                    <input
                                        type="number"
                                        name="discount_percentage"
                                        value={formData.discount_percentage}
                                        className={`${inputClass} cursor-not-allowed bg-gray-100`}
                                        readOnly
                                    />

                                    <p className="mt-1 text-xs text-gray-500">
                                        Automatically calculated
                                    </p>
                                </div>

                                <div>
                                    <label className={labelClass}>
                                        GST Percentage *
                                    </label>

                                    <select
                                        name="tax_percentage"
                                        value={formData.tax_percentage}
                                        onChange={handleChange}
                                        className={inputClass}
                                        required
                                    >
                                        <option value="">
                                            Select GST
                                        </option>

                                        {gstRates.map((gst) => (
                                            <option
                                                key={gst.id ?? gst.hsn_code}
                                                value={gst.gst_percentage}
                                            >
                                                {gst.hsn_code || "GST"} —{" "}
                                                {gst.gst_percentage}%
                                            </option>
                                        ))}
                                    </select>

                                    {formData.tax_percentage !== "" && (
                                        <p className="mt-1 text-xs text-gray-500">
                                            {
                                                gstRates.find(
                                                    (gst) =>
                                                        Number(
                                                            gst.gst_percentage
                                                        ) ===
                                                        Number(
                                                            formData.tax_percentage
                                                        )
                                                )?.description
                                            }
                                        </p>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* Inventory */}
                        <section className={sectionClass}>
                            <h2 className="mb-5 text-lg font-semibold text-cyprus">
                                Inventory
                            </h2>

                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                                <div>
                                    <label className={labelClass}>
                                        Stock Quantity *
                                    </label>

                                    <input
                                        type="number"
                                        name="stock_quantity"
                                        value={formData.stock_quantity}
                                        onChange={handleChange}
                                        min="0"
                                        step="1"
                                        className={inputClass}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className={labelClass}>
                                        Low Stock Threshold
                                    </label>

                                    <input
                                        type="number"
                                        name="low_stock_threshold"
                                        value={formData.low_stock_threshold}
                                        onChange={handleChange}
                                        min="0"
                                        step="1"
                                        className={inputClass}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className={labelClass}>
                                        Stock Status
                                    </label>

                                    <select
                                        name="stock_status"
                                        value={formData.stock_status}
                                        onChange={handleChange}
                                        className={inputClass}
                                    >
                                        <option value="in_stock">
                                            In Stock
                                        </option>
                                        <option value="out_of_stock">
                                            Out of Stock
                                        </option>
                                        <option value="pre_order">
                                            Pre Order
                                        </option>
                                    </select>
                                </div>
                            </div>
                        </section>

                        {/* Multiple Product Images */}
                        <section className={sectionClass}>
                            <h2 className="mb-2 text-lg font-semibold text-cyprus">
                                Product Images
                            </h2>

                            <p className="mb-5 text-sm text-gray-500">
                                Select multiple images. Each image can be
                                up to 5 MB.
                            </p>

                            <label className={labelClass}>
                                Upload Images
                            </label>

                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleImageChange}
                                disabled={loading}
                                className={`${inputClass} file:mr-4 file:rounded-md file:border-0 file:bg-aqua-spring file:px-3 file:py-2 file:text-sm file:font-medium file:text-cyprus`}
                            />

                            <p className="mt-2 text-xs text-gray-500">
                                You can select files again to add more images.
                            </p>

                            {images.length > 0 && (
                                <div className="mt-5">
                                    <div className="mb-3 flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-gray-700">
                                            Selected Images ({images.length})
                                        </h3>

                                        <button
                                            type="button"
                                            disabled={loading}
                                            onClick={() => setImages([])}
                                            className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                                        >
                                            Remove All
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                                        {images.map((file, index) => (
                                            <div
                                                key={`${file.name}-${file.size}-${file.lastModified}`}
                                                className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                                            >
                                                <div className="relative aspect-square bg-white">
                                                    {previews[index] && (
                                                        <img
                                                            src={previews[index]}
                                                            alt={file.name}
                                                            className="h-full w-full object-contain p-2"
                                                        />
                                                    )}

                                                    <button
                                                        type="button"
                                                        disabled={loading}
                                                        onClick={() =>
                                                            removeImage(index)
                                                        }
                                                        aria-label={`Remove ${file.name}`}
                                                        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg text-red-600 shadow transition hover:bg-red-50 disabled:opacity-50"
                                                    >
                                                        ×
                                                    </button>
                                                </div>

                                                <div className="p-3">
                                                    <p className="truncate text-xs font-medium text-gray-700">
                                                        {file.name}
                                                    </p>

                                                    <p className="mt-1 text-xs text-gray-500">
                                                        {(
                                                            file.size /
                                                            (1024 * 1024)
                                                        ).toFixed(2)}{" "}
                                                        MB
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* Product Settings */}
                        <section className={sectionClass}>
                            <h2 className="mb-5 text-lg font-semibold text-cyprus">
                                Product Settings
                            </h2>

                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                <div>
                                    <label className={labelClass}>
                                        Product Status
                                    </label>

                                    <select
                                        name="status"
                                        value={formData.status}
                                        onChange={handleChange}
                                        className={inputClass}
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                        <option value="draft">Draft</option>
                                    </select>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2 sm:pt-7">
                                    <label className="flex items-center gap-2 text-sm text-gray-700">
                                        <input
                                            type="checkbox"
                                            name="featured"
                                            checked={formData.featured}
                                            onChange={handleChange}
                                            className="h-4 w-4 accent-ocean-green"
                                        />
                                        Featured
                                    </label>

                                    <label className="flex items-center gap-2 text-sm text-gray-700">
                                        <input
                                            type="checkbox"
                                            name="bestseller"
                                            checked={formData.bestseller}
                                            onChange={handleChange}
                                            className="h-4 w-4 accent-ocean-green"
                                        />
                                        Bestseller
                                    </label>

                                    <label className="flex items-center gap-2 text-sm text-gray-700">
                                        <input
                                            type="checkbox"
                                            name="new_arrival"
                                            checked={formData.new_arrival}
                                            onChange={handleChange}
                                            className="h-4 w-4 accent-ocean-green"
                                        />
                                        New Arrival
                                    </label>
                                </div>
                            </div>
                        </section>

                        {/* SEO */}
                        <section className={sectionClass}>
                            <h2 className="mb-5 text-lg font-semibold text-cyprus">
                                SEO Information
                            </h2>

                            <div className="grid grid-cols-1 gap-5">
                                <div>
                                    <label className={labelClass}>
                                        Meta Title
                                    </label>

                                    <input
                                        type="text"
                                        name="meta_title"
                                        value={formData.meta_title}
                                        onChange={handleChange}
                                        placeholder="Enter meta title"
                                        className={inputClass}
                                    />
                                </div>

                                <div>
                                    <label className={labelClass}>
                                        Meta Description
                                    </label>

                                    <textarea
                                        name="meta_description"
                                        value={formData.meta_description}
                                        onChange={handleChange}
                                        placeholder="Enter meta description"
                                        rows={3}
                                        className={inputClass}
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Actions */}
                        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() =>
                                    navigate("/admin/products")
                                }
                                disabled={loading}
                                className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                disabled={loading || dataLoading}
                                className="rounded-lg bg-ocean-green px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {loading
                                    ? "Creating Product & Uploading Images..."
                                    : "Add Product"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

export default AddProduct;
