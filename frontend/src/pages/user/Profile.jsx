
import React, { useState, useEffect, useRef } from "react";
import UserDashboardLayout from "../../layouts/UserDashboardLayout";

const API_URL = "http://192.168.1.10:5000/api/auth/profile";
const SERVER_URL = "http://192.168.1.10:5000";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const TODAY_YYYY_MM_DD = new Date().toISOString().slice(0, 10);

function getImageUrl(image) {
    if (!image) return "";

    if (image.startsWith("http://") || image.startsWith("https://")) {
        return image;
    }

    return `${SERVER_URL}${image.startsWith("/") ? "" : "/"}${image}`;
}

function Profile() {
    const fileInputRef = useRef(null);

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        mobile: "",
        profile_image: "",
        date_of_birth: "",
    });

    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState("");
    const [imageError, setImageError] = useState(false);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");

    const getToken = () =>
        localStorage.getItem("token") ||
        localStorage.getItem("shopsphereToken") ||
        "";

    // Create instant preview for selected image.
    useEffect(() => {
        if (!selectedFile) {
            setPreviewUrl("");
            return;
        }

        const objectUrl = URL.createObjectURL(selectedFile);
        setPreviewUrl(objectUrl);

        return () => URL.revokeObjectURL(objectUrl);
    }, [selectedFile]);

    // Fetch logged-in user's profile.
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const token = getToken();

                if (!token) {
                    throw new Error(
                        "Authentication token not found. Please login again."
                    );
                }

                const response = await fetch(API_URL, {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(
                        result.message || "Failed to fetch profile."
                    );
                }

                const user = result.user;

                const profileData = {
                    name: user.name || "",
                    email: user.email || "",
                    mobile: user.mobile || "",
                    profile_image: user.profile_image || "",
                    date_of_birth: user.date_of_birth
                        ? String(user.date_of_birth).slice(0, 10)
                        : "",
                };

                setFormData(profileData);
                setImageError(false);

                const savedUser = JSON.parse(
                    localStorage.getItem("shopsphereUser") || "{}"
                );

                localStorage.setItem(
                    "shopsphereUser",
                    JSON.stringify({
                        ...savedUser,
                        ...profileData,
                        user_id: user.user_id,
                        status: user.status,
                    })
                );
            } catch (err) {
                setError(err.message || "Failed to load profile.");
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;

        setFormData((previous) => ({
            ...previous,
            [name]: value,
        }));

        setSuccess("");
        setError("");
    };

    // Choose image from computer.
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];

        setSuccess("");
        setError("");

        if (!file) return;

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
        ];

        if (!allowedTypes.includes(file.type)) {
            setError("Please select a JPG, PNG or WEBP image.");
            e.target.value = "";
            return;
        }

        if (file.size > MAX_IMAGE_SIZE) {
            setError("Image size must not exceed 5 MB.");
            e.target.value = "";
            return;
        }

        setSelectedFile(file);
        setImageError(false);
    };

    const handleRemoveSelection = () => {
        setSelectedFile(null);
        setImageError(false);
        setSuccess("");
        setError("");

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    // Save profile and selected image.
    const handleSubmit = async (e) => {
        e.preventDefault();

        setSuccess("");
        setError("");

        if (
            !formData.name.trim() ||
            !formData.email.trim() ||
            !formData.mobile.trim()
        ) {
            setError(
                "Please fill in your name, email and mobile number."
            );
            return;
        }

        if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                formData.email.trim()
            )
        ) {
            setError("Please enter a valid email address.");
            return;
        }

        if (!/^[0-9]{7,15}$/.test(formData.mobile.trim())) {
            setError("Please enter a valid mobile number (7–15 digits).");
            return;
        }

        const token = getToken();

        if (!token) {
            setError(
                "Authentication token not found. Please login again."
            );
            return;
        }

        setSaving(true);

        try {
            const payload = new FormData();

            payload.append("name", formData.name.trim());
            payload.append("email", formData.email.trim());
            payload.append("mobile", formData.mobile.trim());
            payload.append("date_of_birth", formData.date_of_birth);

            if (selectedFile) {
                payload.append("profile_image", selectedFile);
            }

            const response = await fetch(API_URL, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: payload,
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Failed to update profile."
                );
            }

            const updatedUser = result.user || {};

            const profileData = {
                name: updatedUser.name ?? formData.name.trim(),
                email: updatedUser.email ?? formData.email.trim(),
                mobile: updatedUser.mobile ?? formData.mobile.trim(),
                profile_image:
                    updatedUser.profile_image ??
                    formData.profile_image,
                date_of_birth: updatedUser.date_of_birth
                    ? String(updatedUser.date_of_birth).slice(0, 10)
                    : formData.date_of_birth,
            };

            setFormData(profileData);
            setSelectedFile(null);
            setImageError(false);

            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }

            const savedUser = JSON.parse(
                localStorage.getItem("shopsphereUser") || "{}"
            );

            localStorage.setItem(
                "shopsphereUser",
                JSON.stringify({
                    ...savedUser,
                    ...profileData,
                    user_id: updatedUser.user_id || savedUser.user_id,
                })
            );

            setSuccess(
                result.message || "Profile updated successfully."
            );
        } catch (err) {
            setError(err.message || "Failed to update profile.");
        } finally {
            setSaving(false);
        }
    };

    const imageToDisplay =
        previewUrl || getImageUrl(formData.profile_image);

    return (
        <UserDashboardLayout>
            <div className="min-h-full bg-gray-50 p-4 sm:p-6 lg:p-8">
                {/* Page Header */}
                <div className="mb-6">
                    <p className="text-xs font-bold uppercase tracking-[2px] text-ocean-green">
                        Account Settings
                    </p>

                    <h1 className="mt-1 text-2xl font-bold text-cyprus sm:text-3xl">
                        My Profile
                    </h1>

                    <p className="mt-1 text-sm text-text-grey">
                        Manage your personal account information.
                    </p>
                </div>

                {loading ? (
                    <div className="flex min-h-64 items-center justify-center rounded-2xl border border-gray-200 bg-white">
                        <div className="text-center">
                            <i className="fa-solid fa-spinner fa-spin text-3xl text-ocean-green" />
                            <p className="mt-3 text-sm text-text-grey">
                                Loading your profile...
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
                        {/* Profile Card */}
                        <div className="h-fit rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                            <div className="flex flex-col items-center text-center">
                                {/* Profile Image */}
                                <div className="relative">
                                    {imageToDisplay && !imageError ? (
                                        <img
                                            key={imageToDisplay}
                                            src={imageToDisplay}
                                            alt="Profile"
                                            onError={() => setImageError(true)}
                                            className="h-28 w-28 rounded-full border-4 border-aqua-spring object-cover shadow-sm"
                                        />
                                    ) : (
                                        <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-aqua-spring bg-aqua-spring text-4xl text-ocean-green">
                                            <i className="fa-solid fa-user" />
                                        </div>
                                    )}

                                    {/* Camera button */}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            fileInputRef.current?.click()
                                        }
                                        aria-label="Choose profile image"
                                        title="Choose profile image"
                                        className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-ocean-green text-white shadow-md transition hover:bg-cyprus focus:outline-none focus:ring-2 focus:ring-ocean-green focus:ring-offset-2"
                                    >
                                        <i className="fa-solid fa-camera" />
                                    </button>

                                    {/* Hidden file input */}
                                    <input
                                        ref={fileInputRef}
                                        id="profile-image"
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                </div>

                                <h2 className="mt-4 max-w-full break-words text-lg font-bold text-cyprus">
                                    {formData.name || "My Account"}
                                </h2>

                                <p className="mt-1 break-all text-xs text-text-grey">
                                    {formData.email || "No email available"}
                                </p>

                                <div className="mt-4 rounded-full bg-success/10 px-4 py-2 text-xs font-bold text-success">
                                    <i className="fa-solid fa-circle-check mr-1" />
                                    Active
                                </div>

                                <p className="mt-4 text-xs text-text-grey">
                                    JPG, PNG or WEBP · Maximum 5 MB
                                </p>

                                {/* Choose File button */}
                                <button
                                    type="button"
                                    onClick={() =>
                                        fileInputRef.current?.click()
                                    }
                                    className="mt-3 inline-flex items-center justify-center gap-2 rounded-full border border-ocean-green px-5 py-2.5 text-xs font-bold text-ocean-green transition hover:bg-aqua-spring"
                                >
                                    <i className="fa-solid fa-upload" />
                                    Choose File
                                </button>

                                {selectedFile && (
                                    <div className="mt-3 w-full">
                                        <p className="break-all text-xs text-text-grey">
                                            {selectedFile.name}
                                        </p>

                                        <button
                                            type="button"
                                            onClick={handleRemoveSelection}
                                            className="mt-2 text-xs font-semibold text-error hover:underline"
                                        >
                                            Remove selected image
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Personal Information Form */}
                        <div className="min-w-0 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                            <div className="mb-6 border-b border-gray-200 pb-5">
                                <h2 className="text-xl font-bold text-cyprus">
                                    Personal Information
                                </h2>

                                <p className="mt-1 text-sm text-text-grey">
                                    Update your personal information below.
                                </p>
                            </div>

                            {success && (
                                <div
                                    role="status"
                                    className="mb-5 rounded-xl bg-success/10 px-4 py-3 text-sm font-medium text-success"
                                >
                                    <i className="fa-solid fa-circle-check mr-2" />
                                    {success}
                                </div>
                            )}

                            {error && (
                                <div
                                    role="alert"
                                    className="mb-5 break-words rounded-xl bg-error/10 px-4 py-3 text-sm font-medium text-error"
                                >
                                    <i className="fa-solid fa-circle-exclamation mr-2" />
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit}>
                                <div className="grid gap-5 sm:grid-cols-2">
                                    {/* Full Name */}
                                    <div>
                                        <label
                                            htmlFor="profile-name"
                                            className="mb-2 block text-xs font-bold text-cyprus"
                                        >
                                            Full Name
                                        </label>

                                        <input
                                            id="profile-name"
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            placeholder="Enter your full name"
                                            autoComplete="name"
                                            required
                                            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-cyprus outline-none transition focus:border-ocean-green focus:ring-2 focus:ring-ocean-green/20"
                                        />
                                    </div>

                                    {/* Email */}
                                    <div>
                                        <label
                                            htmlFor="profile-email"
                                            className="mb-2 block text-xs font-bold text-cyprus"
                                        >
                                            Email Address
                                        </label>

                                        <input
                                            id="profile-email"
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            placeholder="Enter your email"
                                            autoComplete="email"
                                            required
                                            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-cyprus outline-none transition focus:border-ocean-green focus:ring-2 focus:ring-ocean-green/20"
                                        />
                                    </div>

                                    {/* Mobile */}
                                    <div>
                                        <label
                                            htmlFor="profile-mobile"
                                            className="mb-2 block text-xs font-bold text-cyprus"
                                        >
                                            Mobile Number
                                        </label>

                                        <input
                                            id="profile-mobile"
                                            type="tel"
                                            name="mobile"
                                            value={formData.mobile}
                                            onChange={handleChange}
                                            placeholder="Enter mobile number"
                                            maxLength={15}
                                            inputMode="numeric"
                                            autoComplete="tel"
                                            required
                                            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-cyprus outline-none transition focus:border-ocean-green focus:ring-2 focus:ring-ocean-green/20"
                                        />
                                    </div>

                                    {/* Date of Birth */}
                                    <div>
                                        <label
                                            htmlFor="profile-dob"
                                            className="mb-2 block text-xs font-bold text-cyprus"
                                        >
                                            Date of Birth
                                        </label>

                                        <input
                                            id="profile-dob"
                                            type="date"
                                            name="date_of_birth"
                                            value={formData.date_of_birth}
                                            onChange={handleChange}
                                            max={TODAY_YYYY_MM_DD}
                                            autoComplete="bday"
                                            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-cyprus outline-none transition focus:border-ocean-green focus:ring-2 focus:ring-ocean-green/20"
                                        />
                                    </div>
                                </div>

                                {/* Save Button */}
                                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="inline-flex items-center justify-center rounded-full bg-ocean-green px-6 py-3 text-xs font-bold text-white transition hover:bg-cyprus focus:outline-none focus:ring-2 focus:ring-ocean-green focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {saving ? (
                                            <>
                                                <i className="fa-solid fa-spinner fa-spin mr-2" />
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <i className="fa-solid fa-floppy-disk mr-2" />
                                                Save Changes
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </UserDashboardLayout>
    );
}

export default Profile;