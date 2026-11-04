import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function Register() {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        mobile: "",
        password: "",
        dateOfBirth: "",
    });

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);

    const API_URL =
        "http://localhost:5000/api/auth/register";

    // Input change
    const handleChange = (e) => {
        const { name, value } = e.target;

        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));

        setError("");
        setSuccess("");
    };

    // Register API
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (loading) return;

        const name = formData.name.trim();
        const email = formData.email.trim().toLowerCase();
        const mobile = formData.mobile.trim();
        const password = formData.password;
        const dateOfBirth = formData.dateOfBirth;

        // Validation
        if (!name || !email || !mobile || !password || !dateOfBirth) {
            setError("Please fill all fields.");
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError("Please enter a valid email address.");
            return;
        }

        if (!/^[0-9]{10}$/.test(mobile)) {
            setError("Please enter a valid 10 digit mobile number.");
            return;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }

        setError("");
        setSuccess("");
        setLoading(true);

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name,
                    email,
                    mobile,
                    password,
                    date_of_birth: dateOfBirth,
                }),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    data.error ||
                    (Array.isArray(data.errors)
                        ? data.errors.map((item) => item.msg || item.message).join(", ")
                        : "") ||
                    `Registration failed (${response.status}).`
                );
            }

            setSuccess(
                data.message || "Account created successfully!"
            );

            setFormData({
                name: "",
                email: "",
                mobile: "",
                password: "",
                dateOfBirth: "",
            });

            // Navigate after showing the success message.
            setTimeout(() => {
                navigate("/login");
            }, 1500);

        } catch (err) {
            if (err instanceof TypeError) {
                setError(
                    "Unable to connect to the server. Check your backend, IP address, and CORS settings."
                );
            } else {
                setError(err.message || "Something went wrong.");
            }
        } finally {
            setLoading(false);
        }   
    };

    return (
        <div className="min-h-screen bg-aqua-spring">
            <div className="grid min-h-screen lg:grid-cols-2">

                {/* LEFT SIDE */}
                <div className="relative hidden overflow-hidden bg-cyprus lg:flex">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyprus via-cyprus to-ocean-green opacity-90" />

                    <div className="relative z-10 flex w-full flex-col justify-center px-12 xl:px-20">
                        <div className="mb-8">
                            <h1 className="text-4xl font-bold tracking-tight text-white">
                                Join
                                <span className="text-surf-crest">
                                    {" "}ShopSphere
                                </span>
                            </h1>

                            <div className="mt-3 h-1 w-16 rounded-full bg-surf-crest" />
                        </div>

                        <p className="max-w-md text-base leading-7 text-white/70">
                            Create your account and start discovering
                            amazing products, exclusive deals and
                            exciting offers.
                        </p>

                        <div className="mt-10 space-y-5">
                            {[
                                "Discover thousands of products",
                                "Get exclusive deals and offers",
                                "Easy and secure shopping",
                            ].map((item) => (
                                <div
                                    key={item}
                                    className="flex items-center gap-3"
                                >
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surf-crest text-cyprus">
                                        <i className="fa-solid fa-check" />
                                    </div>

                                    <p className="text-sm text-white/80">
                                        {item}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* RIGHT SIDE */}
                <div className="flex min-h-screen items-center justify-center bg-white px-5 py-8 sm:px-8 lg:px-12">
                    <div className="mx-auto w-full max-w-2xl">

                        {/* Logo */}
                        <Link
                            to="/"
                            className="text-3xl font-bold tracking-tight"
                        >
                            <span className="text-ocean-green">
                                Shop
                            </span>
                            <span className="text-cyprus">
                                Sphere
                            </span>
                        </Link>

                        {/* Heading */}
                        <div className="mt-5">
                            <h2 className="text-2xl font-bold text-cyprus sm:text-3xl">
                                Create Account
                            </h2>

                            <p className="mt-1 text-sm text-text-grey">
                                Create your ShopSphere account to get started.
                            </p>
                        </div>

                        {/* Error */}
                        {error && (
                            <div
                                role="alert"
                                className="mt-4 rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error"
                            >
                                <i className="fa-solid fa-circle-exclamation mr-2" />
                                {error}
                            </div>
                        )}

                        {/* Success */}
                        {success && (
                            <div
                                role="status"
                                className="mt-4 rounded-xl border border-success/20 bg-success/10 px-4 py-3 text-sm text-success"
                            >
                                <i className="fa-solid fa-circle-check mr-2" />
                                {success}
                                <p className="mt-1 text-xs">
                                    Redirecting to login...
                                </p>
                            </div>
                        )}

                        {/* Form */}
                        <form
                            onSubmit={handleSubmit}
                            className="mt-5 space-y-3"
                        >
                            {/* Full Name */}
                            <div>
                                <label
                                    htmlFor="name"
                                    className="mb-1 block text-sm font-medium text-cyprus"
                                >
                                    Full Name
                                </label>

                                <input
                                    id="name"
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Enter your full name"
                                    autoComplete="name"
                                    required
                                    disabled={loading}
                                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-cyprus outline-none transition focus:border-ocean-green focus:ring-2 focus:ring-ocean-green/10 disabled:bg-gray-100"
                                />
                            </div>

                            {/* Email */}
                            <div>
                                <label
                                    htmlFor="email"
                                    className="mb-1 block text-sm font-medium text-cyprus"
                                >
                                    Email Address
                                </label>

                                <input
                                    id="email"
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="Enter your email"
                                    autoComplete="email"
                                    required
                                    disabled={loading}
                                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-cyprus outline-none transition focus:border-ocean-green focus:ring-2 focus:ring-ocean-green/10 disabled:bg-gray-100"
                                />
                            </div>

                            {/* Mobile */}
                            <div>
                                <label
                                    htmlFor="mobile"
                                    className="mb-1 block text-sm font-medium text-cyprus"
                                >
                                    Mobile Number
                                </label>

                                <input
                                    id="mobile"
                                    type="tel"
                                    name="mobile"
                                    value={formData.mobile}
                                    onChange={handleChange}
                                    placeholder="10 digit mobile number"
                                    autoComplete="tel"
                                    inputMode="numeric"
                                    maxLength={10}
                                    pattern="[0-9]{10}"
                                    required
                                    disabled={loading}
                                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-cyprus outline-none transition focus:border-ocean-green focus:ring-2 focus:ring-ocean-green/10 disabled:bg-gray-100"
                                />
                            </div>

                            {/* Password */}
                            <div>
                                <label
                                    htmlFor="password"
                                    className="mb-1 block text-sm font-medium text-cyprus"
                                >
                                    Password
                                </label>

                                <input
                                    id="password"
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="Enter password (minimum 6 characters)"
                                    autoComplete="new-password"
                                    minLength={6}
                                    required
                                    disabled={loading}
                                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-cyprus outline-none transition focus:border-ocean-green focus:ring-2 focus:ring-ocean-green/10 disabled:bg-gray-100"
                                />
                            </div>

                            {/* Date of Birth */}
                            <div>
                                <label
                                    htmlFor="dateOfBirth"
                                    className="mb-1 block text-sm font-medium text-cyprus"
                                >
                                    Date of Birth
                                </label>

                                <input
                                    id="dateOfBirth"
                                    type="date"
                                    name="dateOfBirth"
                                    value={formData.dateOfBirth}
                                    onChange={handleChange}
                                    autoComplete="bday"
                                    max={new Date().toISOString().split("T")[0]}
                                    required
                                    disabled={loading}
                                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-cyprus outline-none transition focus:border-ocean-green focus:ring-2 focus:ring-ocean-green/10 disabled:bg-gray-100"
                                />
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-ocean-green px-5 py-3.5 text-sm font-bold text-white transition duration-300 hover:bg-cyprus disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {loading ? (
                                    <>
                                        <i className="fa-solid fa-spinner fa-spin" />
                                        Creating Account...
                                    </>
                                ) : (
                                    <>
                                        Create Account
                                        <i className="fa-solid fa-arrow-right" />
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Login */}
                        <p className="mt-5 text-center text-sm text-text-grey">
                            Already have an account?
                            <Link
                                to="/login"
                                className="ml-1 font-bold text-ocean-green hover:text-cyprus"
                            >
                                Login
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Register;
