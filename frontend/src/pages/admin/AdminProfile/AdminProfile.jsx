import React, { useState } from "react";

function AdminProfile() {
    const [admin, setAdmin] = useState({
        name: "Admin",
        email: "admin@shopsphere.com",
        phone: "",
        role: "Administrator",
        status: "Active",
    });

    const [isEditing, setIsEditing] = useState(false);
    const [message, setMessage] = useState("");

    const handleChange = (e) => {
        const { name, value } = e.target;

        setAdmin((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSave = (e) => {
        e.preventDefault();

        setIsEditing(false);
        setMessage("Profile updated successfully!");

        setTimeout(() => {
            setMessage("");
        }, 3000);
    };

    return (
        <div className="min-h-full bg-aqua-spring p-4 sm:p-6 lg:p-8">

            {/* Page Header */}
            <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-cyprus">
                        My Profile
                    </h1>

                    <p className="mt-1 text-sm text-text-grey">
                        Manage your administrator account information.
                    </p>
                </div>

                {!isEditing && (
                    <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="flex items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                    >
                        <i className="fa-solid fa-pen-to-square"></i>
                        Edit Profile
                    </button>
                )}
            </div>

            {/* Success Message */}
            {message && (
                <div className="mb-5 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                    <i className="fa-solid fa-circle-check"></i>
                    {message}
                </div>
            )}

            {/* Profile Layout */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">

                {/* Profile Card */}
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                    <div className="flex flex-col items-center text-center">

                        {/* Avatar */}
                        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-ocean-green text-4xl font-bold text-white ring-4 ring-aqua-spring">
                            {admin.name.charAt(0).toUpperCase() || "A"}
                        </div>

                        <h2 className="mt-4 text-xl font-bold text-cyprus">
                            {admin.name || "Admin"}
                        </h2>

                        <p className="mt-1 text-sm text-text-grey">
                            {admin.role}
                        </p>

                        <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                            <span className="h-2 w-2 rounded-full bg-success"></span>
                            {admin.status}
                        </span>
                    </div>

                    <div className="my-6 border-t border-gray-100"></div>

                    {/* Account Information */}
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <i className="fa-regular fa-envelope mt-1 text-ocean-green"></i>

                            <div className="min-w-0">
                                <p className="text-xs text-text-grey">
                                    Email Address
                                </p>

                                <p className="break-all text-sm font-medium text-cyprus">
                                    {admin.email}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <i className="fa-solid fa-phone mt-1 text-ocean-green"></i>

                            <div>
                                <p className="text-xs text-text-grey">
                                    Phone Number
                                </p>

                                <p className="text-sm font-medium text-cyprus">
                                    {admin.phone || "Not added"}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Profile Form */}
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7 xl:col-span-2">
                    <div className="mb-6">
                        <h2 className="text-lg font-bold text-cyprus">
                            Personal Information
                        </h2>

                        <p className="mt-1 text-sm text-text-grey">
                            Update your profile details below.
                        </p>
                    </div>

                    <form onSubmit={handleSave}>
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

                            {/* Full Name */}
                            <div>
                                <label className="mb-2 block text-sm font-medium text-cyprus">
                                    Full Name
                                </label>

                                <input
                                    type="text"
                                    name="name"
                                    value={admin.name}
                                    onChange={handleChange}
                                    disabled={!isEditing}
                                    required
                                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-brand-primary disabled:bg-gray-50 disabled:text-text-grey"
                                    placeholder="Enter full name"
                                />
                            </div>

                            {/* Email */}
                            <div>
                                <label className="mb-2 block text-sm font-medium text-cyprus">
                                    Email Address
                                </label>

                                <input
                                    type="email"
                                    name="email"
                                    value={admin.email}
                                    onChange={handleChange}
                                    disabled={!isEditing}
                                    required
                                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-brand-primary disabled:bg-gray-50 disabled:text-text-grey"
                                    placeholder="Enter email address"
                                />
                            </div>

                            {/* Phone */}
                            <div>
                                <label className="mb-2 block text-sm font-medium text-cyprus">
                                    Phone Number
                                </label>

                                <input
                                    type="tel"
                                    name="phone"
                                    value={admin.phone}
                                    onChange={handleChange}
                                    disabled={!isEditing}
                                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-brand-primary disabled:bg-gray-50 disabled:text-text-grey"
                                    placeholder="Enter phone number"
                                />
                            </div>

                            {/* Role */}
                            <div>
                                <label className="mb-2 block text-sm font-medium text-cyprus">
                                    Role
                                </label>

                                <input
                                    type="text"
                                    value={admin.role}
                                    disabled
                                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-text-grey outline-none"
                                />
                            </div>
                        </div>

                        {/* Form Buttons */}
                        {isEditing && (
                            <div className="mt-7 flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-5">

                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsEditing(false);
                                        setMessage("");
                                    }}
                                    className="rounded-lg border border-gray-200 px-5 py-3 text-sm font-semibold text-text-grey transition hover:bg-gray-50"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="flex items-center gap-2 rounded-lg bg-brand-primary px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                                >
                                    <i className="fa-solid fa-floppy-disk"></i>
                                    Save Changes
                                </button>
                            </div>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
}

export default AdminProfile;