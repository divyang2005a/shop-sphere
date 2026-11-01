import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import UserDashboardLayout from "../layouts/UserDashboardLayout";

const API_BASE_URL = "http://192.168.1.10:5000";

const ADDRESSES_URL = `${API_BASE_URL}/api/addresses`;
const CHECKOUT_SUMMARY_URL = `${API_BASE_URL}/api/orders/checkout-summary`;
const ORDERS_URL = `${API_BASE_URL}/api/orders`;

const EMPTY_ADDRESS = {
    name: "",
    mobile: "",
    address_line1: "",
    address_line2: "",
    landmark: "",
    city: "",
    state: "",
    pincode: "",
    address_type: "Home",
};

function getToken() {
    return (
        localStorage.getItem("shopsphereToken") ||
        localStorage.getItem("token") ||
        ""
    );
}

function formatPrice(value) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
    }).format(Number(value) || 0);
}

function getErrorMessage(data, fallback) {
    return data?.message || data?.error || fallback;
}

function getAddressId(address) {
    return address?.id ?? address?.address_id;
}

function getAddressText(address) {
    return [
        address?.address_line1 || address?.address,
        address?.address_line2,
        address?.landmark,
        address?.city,
        address?.state,
        address?.pincode || address?.postal_code,
    ]
        .filter(Boolean)
        .join(", ");
}

function getAddressesFromResponse(result) {
    if (Array.isArray(result?.data)) {
        return result.data;
    }

    if (Array.isArray(result?.data?.addresses)) {
        return result.data.addresses;
    }

    if (Array.isArray(result?.addresses)) {
        return result.addresses;
    }

    if (Array.isArray(result?.addresses?.data)) {
        return result.addresses.data;
    }

    if (result?.data?.address) {
        return [result.data.address];
    }

    if (result?.data && getAddressId(result.data) != null) {
        return [result.data];
    }

    if (result?.address && getAddressId(result.address) != null) {
        return [result.address];
    }

    return [];
}

function getSummaryFromResponse(result) {
    return (
        result?.data?.summary ??
        result?.data ??
        result?.summary ??
        result
    );
}

function getPaymentMethodId(method) {
    return method?.id ?? method?.payment_method_id;
}

function getPaymentMethodName(method) {
    return (
        method?.name ??
        method?.method_name ??
        method?.payment_method ??
        "Payment Method"
    );
}

function Checkout() {
    const navigate = useNavigate();
    const token = getToken();

    const authHeaders = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
    };

    const [addresses, setAddresses] = useState([]);
    const [selectedAddressId, setSelectedAddressId] = useState("");

    const [showAddressForm, setShowAddressForm] = useState(false);
    const [newAddress, setNewAddress] = useState(EMPTY_ADDRESS);
    const [savingAddress, setSavingAddress] = useState(false);
    const [addressesLoading, setAddressesLoading] = useState(true);
    const [addressError, setAddressError] = useState("");

    const [shippingMethods, setShippingMethods] = useState([]);
    const [shippingMethodId, setShippingMethodId] = useState("");

    const [paymentMethods, setPaymentMethods] = useState([]);
    const [paymentMethodId, setPaymentMethodId] = useState("");
    const [paymentMethodsLoading, setPaymentMethodsLoading] =
        useState(true);
    const [paymentMethodsError, setPaymentMethodsError] = useState("");

    const [couponCode, setCouponCode] = useState("");
    const [appliedCoupon, setAppliedCoupon] = useState("");

    const [summary, setSummary] = useState(null);
    const [summaryLoading, setSummaryLoading] = useState(true);
    const [summaryError, setSummaryError] = useState("");

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    const selectedAddress =
        addresses.find(
            (address) =>
                String(getAddressId(address)) ===
                String(selectedAddressId)
        ) || null;

    const selectedPaymentMethod =
        paymentMethods.find(
            (method) =>
                String(getPaymentMethodId(method)) ===
                String(paymentMethodId)
        ) || null;

    const isCashOnDelivery = /cash.?on.?delivery|\bcod\b/i.test(
        selectedPaymentMethod
            ? getPaymentMethodName(selectedPaymentMethod)
            : ""
    );

    // --------------------------------------------------
    // LOAD ADDRESSES
    // --------------------------------------------------

    const fetchAddresses = useCallback(async () => {
        setAddressesLoading(true);
        setAddressError("");

        try {
            if (!token) {
                throw new Error("Please log in before checkout.");
            }

            const response = await fetch(ADDRESSES_URL, {
                method: "GET",
                headers: authHeaders,
            });

            const result = await response.json();

            if (!response.ok || result.success === false) {
                throw new Error(
                    getErrorMessage(result, "Unable to load addresses.")
                );
            }

            const list = getAddressesFromResponse(result).filter(
                (address) => getAddressId(address) != null
            );

            setAddresses(list);

            setSelectedAddressId((previous) => {
                const stillExists = list.some(
                    (address) =>
                        String(getAddressId(address)) ===
                        String(previous)
                );

                return stillExists ? previous : "";
            });
        } catch (err) {
            setAddresses([]);
            setSelectedAddressId("");
            setAddressError(
                err.message || "Unable to load addresses."
            );
        } finally {
            setAddressesLoading(false);
        }
    }, [token]);

    // --------------------------------------------------
    // LOAD CHECKOUT SUMMARY
    // Payment and shipping methods both come from summary.
    // --------------------------------------------------

    const fetchCheckoutSummary = useCallback(async () => {
        setSummaryLoading(true);
        setSummaryError("");

        try {
            if (!token) {
                throw new Error("Please log in before checkout.");
            }

            const params = new URLSearchParams();

            if (shippingMethodId) {
                params.set("shipping_method_id", shippingMethodId);
            }

            if (appliedCoupon.trim()) {
                params.set("coupon_code", appliedCoupon.trim());
            }

            const query = params.toString();

            const url = query
                ? `${CHECKOUT_SUMMARY_URL}?${query}`
                : CHECKOUT_SUMMARY_URL;

            const response = await fetch(url, {
                method: "GET",
                headers: authHeaders,
            });

            const result = await response.json();

            if (!response.ok || result.success === false) {
                throw new Error(
                    getErrorMessage(
                        result,
                        "Unable to calculate checkout summary."
                    )
                );
            }

            const data = getSummaryFromResponse(result);

            setSummary(data);

            const availableShippingMethods = Array.isArray(
                data?.available_shipping_methods
            )
                ? data.available_shipping_methods
                : [];

            const availablePaymentMethods = Array.isArray(
                data?.available_payment_methods
            )
                ? data.available_payment_methods
                : [];

            setShippingMethods(availableShippingMethods);

            setPaymentMethods(availablePaymentMethods);

            // Keep the selected shipping method only if it still exists.
            if (
                shippingMethodId &&
                !availableShippingMethods.some(
                    (method) =>
                        String(method.id) ===
                        String(shippingMethodId)
                )
            ) {
                setShippingMethodId("");
            }

            // Keep the selected payment method only if it still exists.
            setPaymentMethodId((previous) => {
                const exists = availablePaymentMethods.some(
                    (method) =>
                        String(getPaymentMethodId(method)) ===
                        String(previous)
                );

                return exists ? previous : "";
            });

            setPaymentMethodsError(
                availablePaymentMethods.length === 0
                    ? "No active payment methods are available."
                    : ""
            );
        } catch (err) {
            setSummaryError(
                err.message || "Unable to load checkout summary."
            );
        } finally {
            setSummaryLoading(false);
            setPaymentMethodsLoading(false);
        }
    }, [token, shippingMethodId, appliedCoupon]);

    useEffect(() => {
        fetchAddresses();
    }, [fetchAddresses]);

    useEffect(() => {
        fetchCheckoutSummary();
    }, [fetchCheckoutSummary]);

    // --------------------------------------------------
    // ADDRESS FORM
    // --------------------------------------------------

    const handleAddressChange = (event) => {
        const { name, value } = event.target;

        setNewAddress((previous) => ({
            ...previous,
            [name]: value,
        }));

        setAddressError("");
        setError("");
    };

    const handleAddAddress = async (event) => {
        event.preventDefault();

        setAddressError("");
        setError("");
        setSuccessMessage("");

        if (!token) {
            setAddressError("Please log in before adding an address.");
            return;
        }

        if (
            !newAddress.name.trim() ||
            !/^[0-9]{10}$/.test(newAddress.mobile.trim()) ||
            !newAddress.address_line1.trim() ||
            !newAddress.city.trim() ||
            !newAddress.state.trim() ||
            !/^[0-9]{6}$/.test(newAddress.pincode.trim())
        ) {
            setAddressError(
                "Enter your name, valid 10-digit mobile number, address, city, state and 6-digit pincode."
            );
            return;
        }

        setSavingAddress(true);

        try {
            const payload = {
                name: newAddress.name.trim(),
                mobile: newAddress.mobile.trim(),
                address_line1: newAddress.address_line1.trim(),
                address_line2: newAddress.address_line2.trim(),
                landmark: newAddress.landmark.trim(),
                city: newAddress.city.trim(),
                state: newAddress.state.trim(),
                pincode: newAddress.pincode.trim(),
                address_type: newAddress.address_type,
            };

            const response = await fetch(ADDRESSES_URL, {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok || result.success === false) {
                throw new Error(
                    getErrorMessage(result, "Unable to save address.")
                );
            }

            const createdAddress =
                result?.data?.address ??
                result?.address ??
                result?.data;

            const createdId = getAddressId(createdAddress);

            // Reload addresses after creating a new address.
            const refreshedResponse = await fetch(ADDRESSES_URL, {
                method: "GET",
                headers: authHeaders,
            });

            const refreshedResult = await refreshedResponse.json();

            if (
                !refreshedResponse.ok ||
                refreshedResult.success === false
            ) {
                throw new Error(
                    getErrorMessage(
                        refreshedResult,
                        "Address saved, but refreshing addresses failed."
                    )
                );
            }

            const refreshedAddresses = getAddressesFromResponse(
                refreshedResult
            ).filter((address) => getAddressId(address) != null);

            setAddresses(refreshedAddresses);

            if (createdId != null) {
                setSelectedAddressId(String(createdId));
            } else {
                setSelectedAddressId("");
            }

            setNewAddress(EMPTY_ADDRESS);
            setShowAddressForm(false);

            setSuccessMessage(
                createdId != null
                    ? "Address added and selected for this order."
                    : "Address saved. Please select it from the address list."
            );
        } catch (err) {
            setAddressError(
                err.message || "Unable to save your address."
            );
        } finally {
            setSavingAddress(false);
        }
    };

    // --------------------------------------------------
    // SHIPPING METHOD
    // Backend requires shipping_method_id.
    // Therefore, the user must select a shipping method.
    // --------------------------------------------------

    const handleShippingMethodChange = (methodId) => {
        setShippingMethodId(String(methodId));
        setError("");
    };

    // --------------------------------------------------
    // COUPON
    // --------------------------------------------------

    const handleApplyCoupon = () => {
        const code = couponCode.trim();

        if (!code) {
            setError("Please enter a coupon code.");
            return;
        }

        setError("");
        setAppliedCoupon(code);
    };

    const handleRemoveCoupon = () => {
        setCouponCode("");
        setAppliedCoupon("");
        setError("");
    };

    // --------------------------------------------------
    // SUMMARY VALUES
    // --------------------------------------------------

    const subtotal = Number(summary?.subtotal ?? 0);
    const tax = Number(summary?.tax ?? 0);
    const shipping = Number(summary?.shipping_fee ?? 0);
    const discount = Number(summary?.coupon_discount ?? 0);

    const total = Number(
        summary?.total ??
            subtotal + tax + shipping - discount
    );

    const summaryItems = Array.isArray(summary?.items)
        ? summary.items
        : [];

    // --------------------------------------------------
    // PLACE ORDER
    // --------------------------------------------------

    const handleSubmit = async (event) => {
        event.preventDefault();

        setError("");
        setSuccessMessage("");

        if (!token) {
            setError("Please log in before placing your order.");
            return;
        }

        if (addressesLoading || savingAddress) {
            setError("Please wait until address processing is complete.");
            return;
        }

        if (!selectedAddress) {
            setError("Please add and select a delivery address.");
            return;
        }

        if (summaryLoading) {
            setError("Please wait while your order total is calculated.");
            return;
        }

        if (summaryError || !summary) {
            setError("Checkout summary is unavailable. Please retry.");
            return;
        }

        if (summaryItems.length === 0) {
            setError("Your cart is empty. Please add products first.");
            return;
        }

        if (!shippingMethodId) {
            setError("Please select a delivery method.");
            return;
        }

        if (paymentMethodsLoading) {
            setError("Please wait while payment methods are loading.");
            return;
        }

        if (!selectedPaymentMethod || !paymentMethodId) {
            setError("Please select a valid payment method.");
            return;
        }

        const addressId = getAddressId(selectedAddress);

        if (!Number.isSafeInteger(Number(addressId)) || Number(addressId) <= 0) {
            setError("Please select a valid saved address.");
            return;
        }

        if (
            !Number.isSafeInteger(Number(shippingMethodId)) ||
            Number(shippingMethodId) <= 0
        ) {
            setError("Please select a valid delivery method.");
            return;
        }

        if (
            !Number.isSafeInteger(Number(paymentMethodId)) ||
            Number(paymentMethodId) <= 0
        ) {
            setError("Please select a valid payment method.");
            return;
        }

        setSubmitting(true);

        try {
            // Verify the latest summary before creating the order.
            const params = new URLSearchParams();

            params.set("shipping_method_id", shippingMethodId);

            if (appliedCoupon.trim()) {
                params.set("coupon_code", appliedCoupon.trim());
            }

            const summaryResponse = await fetch(
                `${CHECKOUT_SUMMARY_URL}?${params.toString()}`,
                {
                    method: "GET",
                    headers: authHeaders,
                }
            );

            const summaryResult = await summaryResponse.json();

            if (
                !summaryResponse.ok ||
                summaryResult.success === false
            ) {
                throw new Error(
                    getErrorMessage(
                        summaryResult,
                        "Unable to verify checkout summary."
                    )
                );
            }

            const latestSummary = getSummaryFromResponse(summaryResult);

            if (
                !Array.isArray(latestSummary?.items) ||
                latestSummary.items.length === 0
            ) {
                throw new Error(
                    "Your cart is empty. Please add products first."
                );
            }

            // IMPORTANT:
            // Backend requires all four IDs.
            // This selected address is used for billing and shipping.
            const payload = {
                billing_address_id: Number(addressId),
                shipping_address_id: Number(addressId),
                shipping_method_id: Number(shippingMethodId),
                payment_method_id: Number(paymentMethodId),
            };

            if (appliedCoupon.trim()) {
                payload.coupon_code = appliedCoupon.trim();
            }

            const response = await fetch(ORDERS_URL, {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok || result.success === false) {
                throw new Error(
                    getErrorMessage(result, "Failed to place your order.")
                );
            }

            const order =
                result?.data?.order ??
                result?.data ??
                result?.order ??
                {};

            const demoPayment = {
                payment_method_id: Number(paymentMethodId),
                payment_method: getPaymentMethodName(
                    selectedPaymentMethod
                ),
                payment_status: "pending",
                demoPayment: true,
            };

            // Save the last order for the frontend.
            try {
                localStorage.setItem(
                    "shopsphereLastOrder",
                    JSON.stringify({
                        ...order,
                        ...demoPayment,
                        deliveryDetails: selectedAddress,
                        createdAt: new Date().toISOString(),
                    })
                );

                localStorage.removeItem("shopsphereCart");
            } catch (storageError) {
                console.error(
                    "Could not update local storage:",
                    storageError
                );
            }

            const message = isCashOnDelivery
                ? "Order placed successfully! Payment will be collected on delivery."
                : "Order created successfully. Demo checkout only; no real payment was processed.";

            navigate("/orders", {
                state: {
                    message,
                    order,
                    demoPayment,
                },
            });
        } catch (err) {
            setError(
                err.message || "Unable to place your order."
            );
        } finally {
            setSubmitting(false);
        }
    };

    // --------------------------------------------------
    // UI
    // --------------------------------------------------

    return (
        <UserDashboardLayout>
            <div className="min-h-full bg-gray-50 p-4 sm:p-6 lg:p-8">
                <div className="mb-6">
                    <p className="text-xs font-bold uppercase tracking-[2px] text-ocean-green">
                        Secure Checkout
                    </p>

                    <h1 className="mt-1 text-2xl font-bold text-cyprus sm:text-3xl">
                        Checkout
                    </h1>

                    <p className="mt-1 text-sm text-text-grey">
                        Select your address, delivery method and payment method.
                    </p>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"
                >
                    <div className="min-w-0 space-y-6">
                        {/* GENERAL ERRORS */}
                        {error && (
                            <div
                                role="alert"
                                className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                            >
                                <i className="fa-solid fa-circle-exclamation mr-2" />
                                {error}
                            </div>
                        )}

                        {successMessage && (
                            <div
                                role="status"
                                className="rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700"
                            >
                                {successMessage}
                            </div>
                        )}

                        {/* DELIVERY ADDRESS */}
                        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-bold text-cyprus">
                                        <i className="fa-solid fa-location-dot mr-2 text-ocean-green" />
                                        Delivery Address
                                    </h2>

                                    <p className="mt-1 text-sm text-text-grey">
                                        Select an existing address or add a new one.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddressForm((previous) => !previous);
                                        setAddressError("");
                                    }}
                                    className="rounded-full bg-ocean-green px-4 py-2.5 text-sm font-bold text-white transition hover:bg-cyprus"
                                >
                                    <i
                                        className={`fa-solid ${
                                            showAddressForm
                                                ? "fa-xmark"
                                                : "fa-plus"
                                        } mr-2`}
                                    />
                                    {showAddressForm ? "Cancel" : "Add Address"}
                                </button>
                            </div>

                            {addressError && (
                                <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                                    {addressError}
                                </div>
                            )}

                            {showAddressForm && (
                                <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
                                    <h3 className="mb-4 font-bold text-cyprus">
                                        Add New Address
                                    </h3>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="mb-2 block text-xs font-bold text-cyprus">
                                                Address Type
                                            </label>

                                            <select
                                                name="address_type"
                                                value={newAddress.address_type}
                                                onChange={handleAddressChange}
                                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-ocean-green"
                                            >
                                                <option value="Home">Home</option>
                                                <option value="Work">Work</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-xs font-bold text-cyprus">
                                                Full Name *
                                            </label>

                                            <input
                                                name="name"
                                                value={newAddress.name}
                                                onChange={handleAddressChange}
                                                autoComplete="name"
                                                required
                                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-ocean-green"
                                                placeholder="Your full name"
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-xs font-bold text-cyprus">
                                                Mobile Number *
                                            </label>

                                            <input
                                                name="mobile"
                                                type="tel"
                                                value={newAddress.mobile}
                                                onChange={handleAddressChange}
                                                maxLength={10}
                                                inputMode="numeric"
                                                autoComplete="tel"
                                                required
                                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-ocean-green"
                                                placeholder="10 digit mobile"
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-xs font-bold text-cyprus">
                                                Pincode *
                                            </label>

                                            <input
                                                name="pincode"
                                                value={newAddress.pincode}
                                                onChange={handleAddressChange}
                                                maxLength={6}
                                                inputMode="numeric"
                                                autoComplete="postal-code"
                                                required
                                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-ocean-green"
                                                placeholder="6 digit pincode"
                                            />
                                        </div>

                                        <div className="sm:col-span-2">
                                            <label className="mb-2 block text-xs font-bold text-cyprus">
                                                Address Line 1 *
                                            </label>

                                            <textarea
                                                name="address_line1"
                                                value={newAddress.address_line1}
                                                onChange={handleAddressChange}
                                                rows={2}
                                                autoComplete="street-address"
                                                required
                                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-ocean-green"
                                                placeholder="House number, street, area..."
                                            />
                                        </div>

                                        <div className="sm:col-span-2">
                                            <label className="mb-2 block text-xs font-bold text-cyprus">
                                                Address Line 2
                                            </label>

                                            <input
                                                name="address_line2"
                                                value={newAddress.address_line2}
                                                onChange={handleAddressChange}
                                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-ocean-green"
                                                placeholder="Apartment, floor, etc. (optional)"
                                            />
                                        </div>

                                        <div className="sm:col-span-2">
                                            <label className="mb-2 block text-xs font-bold text-cyprus">
                                                Landmark
                                            </label>

                                            <input
                                                name="landmark"
                                                value={newAddress.landmark}
                                                onChange={handleAddressChange}
                                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-ocean-green"
                                                placeholder="Nearby landmark (optional)"
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-xs font-bold text-cyprus">
                                                City *
                                            </label>

                                            <input
                                                name="city"
                                                value={newAddress.city}
                                                onChange={handleAddressChange}
                                                autoComplete="address-level2"
                                                required
                                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-ocean-green"
                                                placeholder="City"
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-xs font-bold text-cyprus">
                                                State *
                                            </label>

                                            <input
                                                name="state"
                                                value={newAddress.state}
                                                onChange={handleAddressChange}
                                                autoComplete="address-level1"
                                                required
                                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-ocean-green"
                                                placeholder="State"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        disabled={savingAddress}
                                        onClick={handleAddAddress}
                                        className="mt-5 w-full rounded-full bg-ocean-green px-5 py-3 text-sm font-bold text-white transition hover:bg-cyprus disabled:opacity-50 sm:w-auto"
                                    >
                                        {savingAddress
                                            ? "Saving Address..."
                                            : "Save Address"}
                                    </button>
                                </div>
                            )}

                            <div className="mt-5">
                                {addressesLoading ? (
                                    <p className="py-4 text-sm text-text-grey">
                                        Loading your addresses...
                                    </p>
                                ) : addresses.length > 0 ? (
                                    <div className="space-y-3">
                                        {addresses.map((address) => {
                                            const id = getAddressId(address);

                                            const isSelected =
                                                String(selectedAddressId) ===
                                                String(id);

                                            return (
                                                <label
                                                    key={id}
                                                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                                                        isSelected
                                                            ? "border-ocean-green bg-green-50 ring-1 ring-ocean-green"
                                                            : "border-gray-200 hover:border-ocean-green"
                                                    }`}
                                                >
                                                    <input
                                                        type="radio"
                                                        name="savedAddress"
                                                        value={id}
                                                        checked={isSelected}
                                                        onChange={() => {
                                                            setSelectedAddressId(String(id));
                                                            setError("");
                                                        }}
                                                        className="mt-1 accent-emerald-700"
                                                    />

                                                    <span className="min-w-0 flex-1">
                                                        <span className="block font-bold text-cyprus">
                                                            {address.name ||
                                                                address.full_name ||
                                                                "Saved Address"}
                                                        </span>

                                                        {address.mobile && (
                                                            <span className="mt-1 block text-sm text-text-grey">
                                                                {address.mobile}
                                                            </span>
                                                        )}

                                                        <span className="mt-1 block text-sm text-text-grey">
                                                            {getAddressText(address)}
                                                        </span>

                                                        {address.address_type && (
                                                            <span className="mt-2 inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-cyprus">
                                                                {address.address_type}
                                                            </span>
                                                        )}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-dashed border-gray-300 p-5 text-center">
                                        <p className="font-bold text-cyprus">
                                            No saved addresses yet
                                        </p>

                                        <p className="mt-1 text-sm text-text-grey">
                                            Click Add Address to enter your delivery details.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* SHIPPING METHOD */}
                        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                            <h2 className="text-lg font-bold text-cyprus">
                                <i className="fa-solid fa-truck mr-2 text-ocean-green" />
                                Delivery Method *
                            </h2>

                            <p className="mt-1 text-sm text-text-grey">
                                Choose a delivery method to continue.
                            </p>

                            {shippingMethods.length > 0 ? (
                                <div className="mt-4 space-y-3">
                                    {shippingMethods.map((method) => {
                                        const isSelected =
                                            String(shippingMethodId) ===
                                            String(method.id);

                                        return (
                                            <label
                                                key={method.id}
                                                className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-4 transition ${
                                                    isSelected
                                                        ? "border-ocean-green bg-green-50 ring-1 ring-ocean-green"
                                                        : "border-gray-200 hover:border-ocean-green"
                                                }`}
                                            >
                                                <span className="flex min-w-0 items-start gap-3">
                                                    <input
                                                        type="radio"
                                                        name="shippingMethod"
                                                        value={method.id}
                                                        checked={isSelected}
                                                        onChange={() =>
                                                            handleShippingMethodChange(method.id)
                                                        }
                                                        className="mt-1 accent-emerald-700"
                                                    />

                                                    <span className="min-w-0">
                                                        <span className="block font-bold text-cyprus">
                                                            {method.name ||
                                                                method.method_name ||
                                                                "Standard Delivery"}
                                                        </span>

                                                        {method.description && (
                                                            <span className="mt-1 block text-xs text-text-grey">
                                                                {method.description}
                                                            </span>
                                                        )}

                                                        {method.estimated_days && (
                                                            <span className="mt-1 block text-xs text-text-grey">
                                                                Estimated delivery: {method.estimated_days} days
                                                            </span>
                                                        )}
                                                    </span>
                                                </span>

                                                <span className="shrink-0 text-sm font-bold text-cyprus">
                                                    {Number(method.price) === 0
                                                        ? "FREE"
                                                        : formatPrice(method.price)}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-text-grey">
                                    {summaryLoading
                                        ? "Loading delivery methods..."
                                        : "No delivery methods are available."}

                                    <button
                                        type="button"
                                        onClick={fetchCheckoutSummary}
                                        className="ml-2 font-bold text-ocean-green"
                                    >
                                        Retry
                                    </button>
                                </div>
                            )}
                        </section>

                        {/* PAYMENT METHOD */}
                        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                            <h2 className="text-lg font-bold text-cyprus">
                                <i className="fa-solid fa-wallet mr-2 text-ocean-green" />
                                Payment Method *
                            </h2>

                            <p className="mt-1 text-sm text-text-grey">
                                Select an active payment method.
                            </p>

                            <div className="mt-5">
                                <label
                                    htmlFor="paymentMethod"
                                    className="mb-2 block text-sm font-semibold text-cyprus"
                                >
                                    Choose Payment Method
                                </label>

                                <select
                                    id="paymentMethod"
                                    value={paymentMethodId}
                                    onChange={(event) => {
                                        setPaymentMethodId(event.target.value);
                                        setError("");
                                    }}
                                    disabled={
                                        paymentMethodsLoading ||
                                        paymentMethods.length === 0
                                    }
                                    required
                                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-cyprus outline-none focus:border-ocean-green disabled:bg-gray-100"
                                >
                                    <option value="">
                                        {paymentMethodsLoading
                                            ? "Loading payment methods..."
                                            : "-- Select Payment Method --"}
                                    </option>

                                    {paymentMethods.map((method) => (
                                        <option
                                            key={getPaymentMethodId(method)}
                                            value={getPaymentMethodId(method)}
                                        >
                                            {getPaymentMethodName(method)}
                                        </option>
                                    ))}
                                </select>

                                {paymentMethodsError && (
                                    <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                                        {paymentMethodsError}

                                        <button
                                            type="button"
                                            onClick={fetchCheckoutSummary}
                                            className="ml-2 font-bold underline"
                                        >
                                            Retry
                                        </button>
                                    </div>
                                )}

                                {selectedPaymentMethod && (
                                    <p className="mt-3 rounded-lg bg-gray-50 p-3 text-xs leading-5 text-text-grey">
                                        <i className="fa-solid fa-circle-info mr-2 text-ocean-green" />

                                        {isCashOnDelivery
                                            ? "Payment will be collected when your order is delivered."
                                            : "Demo checkout only. No real payment will be processed."}
                                    </p>
                                )}
                            </div>
                        </section>
                    </div>

                    {/* ORDER SUMMARY */}
                    <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-6">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-lg font-bold text-cyprus">
                                Order Summary
                            </h2>

                            <button
                                type="button"
                                onClick={fetchCheckoutSummary}
                                disabled={summaryLoading}
                                className="text-xs font-bold text-ocean-green disabled:opacity-50"
                            >
                                <i
                                    className={`fa-solid fa-rotate-right mr-1 ${
                                        summaryLoading ? "animate-spin" : ""
                                    }`}
                                />
                                Refresh
                            </button>
                        </div>

                        {/* COUPON */}
                        <div className="mt-5">
                            <label
                                htmlFor="couponCode"
                                className="mb-2 block text-xs font-bold text-cyprus"
                            >
                                Coupon Code
                            </label>

                            <div className="flex gap-2">
                                <input
                                    id="couponCode"
                                    type="text"
                                    value={couponCode}
                                    onChange={(event) =>
                                        setCouponCode(event.target.value)
                                    }
                                    placeholder="Enter coupon"
                                    disabled={Boolean(appliedCoupon)}
                                    className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm uppercase text-cyprus outline-none focus:border-ocean-green"
                                />

                                {appliedCoupon ? (
                                    <button
                                        type="button"
                                        onClick={handleRemoveCoupon}
                                        className="rounded-xl border border-gray-200 px-3 text-xs font-bold text-red-600"
                                    >
                                        Remove
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleApplyCoupon}
                                        disabled={summaryLoading}
                                        className="rounded-xl bg-ocean-green px-4 text-xs font-bold text-white hover:bg-cyprus disabled:opacity-50"
                                    >
                                        Apply
                                    </button>
                                )}
                            </div>

                            {appliedCoupon && (
                                <p className="mt-2 text-xs font-medium text-ocean-green">
                                    Coupon: {summary?.coupon_code || appliedCoupon}
                                </p>
                            )}
                        </div>

                        {summaryError && (
                            <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                                <p>{summaryError}</p>

                                <button
                                    type="button"
                                    onClick={fetchCheckoutSummary}
                                    className="mt-2 font-bold underline"
                                >
                                    Retry
                                </button>
                            </div>
                        )}

                        {summaryLoading ? (
                            <div className="py-8 text-center text-sm text-text-grey">
                                <i className="fa-solid fa-spinner mr-2 animate-spin" />
                                Calculating your order...
                            </div>
                        ) : summaryItems.length > 0 ? (
                            <>
                                <div className="mt-5 max-h-64 space-y-4 overflow-y-auto">
                                    {summaryItems.map((item, index) => (
                                        <div
                                            key={`${item.product_id ?? index}-${item.variant_id ?? "default"}`}
                                            className="flex items-start justify-between gap-3"
                                        >
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-cyprus">
                                                    {item.title ||
                                                        item.product_name ||
                                                        item.name ||
                                                        "Product"}
                                                </p>

                                                <p className="mt-1 text-xs text-text-grey">
                                                    Qty: {item.quantity || 1}
                                                    {" × "}
                                                    {formatPrice(item.unit_price)}
                                                </p>
                                            </div>

                                            <span className="shrink-0 text-sm font-bold text-cyprus">
                                                {formatPrice(
                                                    item.subtotal ??
                                                        Number(item.unit_price || 0) *
                                                            Number(item.quantity || 1)
                                                )}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-5 space-y-4 border-y border-gray-200 py-5">
                                    <div className="flex justify-between gap-3 text-sm">
                                        <span className="text-text-grey">
                                            Subtotal
                                        </span>

                                        <span className="font-bold text-cyprus">
                                            {formatPrice(subtotal)}
                                        </span>
                                    </div>

                                    <div className="flex justify-between gap-3 text-sm">
                                        <span className="text-text-grey">
                                            Tax
                                        </span>

                                        <span className="font-bold text-cyprus">
                                            {formatPrice(tax)}
                                        </span>
                                    </div>

                                    <div className="flex justify-between gap-3 text-sm">
                                        <span className="text-text-grey">
                                            Delivery
                                        </span>

                                        <span className="font-bold text-cyprus">
                                            {formatPrice(shipping)}
                                        </span>
                                    </div>

                                    {discount > 0 && (
                                        <div className="flex justify-between gap-3 text-sm">
                                            <span className="text-green-700">
                                                Coupon Discount
                                            </span>

                                            <span className="font-bold text-green-700">
                                                -{formatPrice(discount)}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-5 flex items-center justify-between gap-3">
                                    <span className="font-bold text-cyprus">
                                        Total
                                    </span>

                                    <span className="text-xl font-extrabold text-ocean-green">
                                        {formatPrice(total)}
                                    </span>
                                </div>

                                <button
                                    type="submit"
                                    disabled={
                                        submitting ||
                                        summaryLoading ||
                                        addressesLoading ||
                                        savingAddress ||
                                        paymentMethodsLoading
                                    }
                                    className="mt-6 w-full rounded-full bg-ocean-green px-5 py-3.5 text-sm font-bold text-white transition hover:bg-cyprus disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {submitting ? (
                                        <>
                                            <i className="fa-solid fa-spinner mr-2 animate-spin" />
                                            Placing Order...
                                        </>
                                    ) : (
                                        <>
                                            Place Order
                                            <i className="fa-solid fa-arrow-right ml-2" />
                                        </>
                                    )}
                                </button>

                                <p className="mt-3 text-center text-xs leading-5 text-text-grey">
                                    Demo checkout only. No real payment will be processed.
                                </p>
                            </>
                        ) : (
                            <div className="py-8 text-center">
                                <i className="fa-solid fa-cart-shopping text-3xl text-gray-300" />

                                <p className="mt-3 font-bold text-cyprus">
                                    No items found
                                </p>

                                <p className="mt-1 text-sm text-text-grey">
                                    Add products to your cart before checkout.
                                </p>

                                <button
                                    type="button"
                                    onClick={() => navigate("/")}
                                    className="mt-4 rounded-full bg-ocean-green px-5 py-2.5 text-sm font-bold text-white hover:bg-cyprus"
                                >
                                    Continue Shopping
                                </button>
                            </div>
                        )}
                    </aside>
                </form>
            </div>
        </UserDashboardLayout>
    );
}

export default Checkout;