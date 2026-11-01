
import React, { useState } from "react";

const initialSettings = {
    profile: {
        name: "Mohit Sharma",
        email: "admin@shopsphere.com",
        mobile: "9876543210",
        role: "Administrator",
    },
    store: {
        name: "ShopSphere",
        email: "support@shopsphere.com",
        mobile: "9876543210",
        address: "Surat, Gujarat, India",
        currency: "INR",
        timezone: "Asia/Kolkata",
    },
    preferences: {
        language: "English",
        theme: "Light",
        emailNotifications: true,
        orderNotifications: true,
        stockNotifications: true,
    },
};

function Settings() {
    const [activeTab, setActiveTab] = useState("profile");
    const [settings, setSettings] = useState(initialSettings);
    const [savedMessage, setSavedMessage] = useState("");
    const [passwords, setPasswords] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    });

    const updateField = (section, name, value) => {
        setSettings((previous) => ({
            ...previous,
            [section]: {
                ...previous[section],
                [name]: value,
            },
        }));

        setSavedMessage("");
    };

    const handlePasswordChange = (e) => {
        setPasswords((previous) => ({
            ...previous,
            [e.target.name]: e.target.value,
        }));

        setSavedMessage("");
    };

    const handleSave = (e) => {
        e.preventDefault();
        setSavedMessage("Settings saved in the current session.");
    };

    const handlePasswordSubmit = (e) => {
        e.preventDefault();

        if (passwords.newPassword.length < 8) {
            setSavedMessage("New password must be at least 8 characters.");
            return;
        }

        if (passwords.newPassword !== passwords.confirmPassword) {
            setSavedMessage("New password and confirm password do not match.");
            return;
        }

        setSavedMessage(
            "Demo only: connect the backend to change your password securely."
        );

        setPasswords({
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        });
    };

    const tabs = [
        { id: "profile", label: "My Profile", icon: "fa-user" },
        { id: "store", label: "Store Information", icon: "fa-store" },
        { id: "preferences", label: "Preferences", icon: "fa-sliders" },
        { id: "security", label: "Security", icon: "fa-shield-halved" },
    ];

    return (
        <div className="min-h-full bg-aqua-spring p-4 sm:p-6 lg:p-8">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-cyprus sm:text-3xl">
                    Settings
                </h1>

                <p className="mt-1 text-sm text-text-grey">
                    Manage your account, store information and preferences.
                </p>
            </div>

            {/* Profile summary */}
            <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surf-crest text-2xl font-bold text-cyprus">
                    {settings.profile.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-bold text-cyprus">
                        {settings.profile.name}
                    </h2>

                    <p className="mt-1 break-all text-sm text-gray-500">
                        {settings.profile.email}
                    </p>

                    <span className="mt-2 inline-flex rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                        <i className="fa-solid fa-shield-halved mr-2"></i>
                        {settings.profile.role}
                    </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-green-700">
                    <i className="fa-solid fa-circle-check"></i>
                    Admin Account
                </div>
            </div>

            {/* Settings layout */}
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
                {/* Sidebar tabs */}
                <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
                    <h3 className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">
                        General Settings
                    </h3>

                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => {
                                    setActiveTab(tab.id);
                                    setSavedMessage("");
                                }}
                                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${
                                    activeTab === tab.id
                                        ? "bg-brand-primary text-white"
                                        : "text-gray-600 hover:bg-gray-50"
                                }`}
                            >
                                <i className={`fa-solid ${tab.icon} w-5 text-center`}></i>
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="min-w-0 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
                    {savedMessage && (
                        <div
                            role="status"
                            className="mb-5 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700"
                        >
                            <i className="fa-solid fa-circle-info mt-0.5"></i>
                            <p>{savedMessage}</p>
                        </div>
                    )}

                    {/* Profile */}
                    {activeTab === "profile" && (
                        <form onSubmit={handleSave}>
                            <SectionHeading
                                title="My Profile"
                                description="Update your administrator account information."
                            />

                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                <FormField label="Full Name">
                                    <input
                                        required
                                        value={settings.profile.name}
                                        onChange={(e) =>
                                            updateField("profile", "name", e.target.value)
                                        }
                                        className="settings-input"
                                        placeholder="Enter your full name"
                                    />
                                </FormField>

                                <FormField label="Email Address">
                                    <input
                                        required
                                        type="email"
                                        value={settings.profile.email}
                                        onChange={(e) =>
                                            updateField("profile", "email", e.target.value)
                                        }
                                        className="settings-input"
                                        placeholder="Enter email address"
                                    />
                                </FormField>

                                <FormField label="Mobile Number">
                                    <input
                                        required
                                        type="tel"
                                        pattern="[0-9]{10}"
                                        title="Enter a 10-digit mobile number"
                                        value={settings.profile.mobile}
                                        onChange={(e) =>
                                            updateField("profile", "mobile", e.target.value)
                                        }
                                        className="settings-input"
                                        placeholder="10-digit mobile number"
                                    />
                                </FormField>

                                <FormField label="Account Role">
                                    <input
                                        value={settings.profile.role}
                                        readOnly
                                        className="settings-input cursor-not-allowed bg-gray-50"
                                    />
                                </FormField>
                            </div>

                            <SaveButton />
                        </form>
                    )}

                    {/* Store Information */}
                    {activeTab === "store" && (
                        <form onSubmit={handleSave}>
                            <SectionHeading
                                title="Store Information"
                                description="Manage the basic details of your online store."
                            />

                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                <FormField label="Store Name">
                                    <input
                                        required
                                        value={settings.store.name}
                                        onChange={(e) =>
                                            updateField("store", "name", e.target.value)
                                        }
                                        className="settings-input"
                                    />
                                </FormField>

                                <FormField label="Support Email">
                                    <input
                                        required
                                        type="email"
                                        value={settings.store.email}
                                        onChange={(e) =>
                                            updateField("store", "email", e.target.value)
                                        }
                                        className="settings-input"
                                    />
                                </FormField>

                                <FormField label="Store Mobile">
                                    <input
                                        required
                                        type="tel"
                                        pattern="[0-9]{10}"
                                        value={settings.store.mobile}
                                        onChange={(e) =>
                                            updateField("store", "mobile", e.target.value)
                                        }
                                        className="settings-input"
                                    />
                                </FormField>

                                <FormField label="Currency">
                                    <select
                                        value={settings.store.currency}
                                        onChange={(e) =>
                                            updateField("store", "currency", e.target.value)
                                        }
                                        className="settings-input"
                                    >
                                        <option value="INR">INR - Indian Rupee</option>
                                        <option value="USD">USD - US Dollar</option>
                                        <option value="EUR">EUR - Euro</option>
                                        <option value="GBP">GBP - British Pound</option>
                                    </select>
                                </FormField>

                                <FormField label="Store Address">
                                    <textarea
                                        required
                                        rows={3}
                                        value={settings.store.address}
                                        onChange={(e) =>
                                            updateField("store", "address", e.target.value)
                                        }
                                        className="settings-input resize-y"
                                    />
                                </FormField>

                                <FormField label="Timezone">
                                    <select
                                        value={settings.store.timezone}
                                        onChange={(e) =>
                                            updateField("store", "timezone", e.target.value)
                                        }
                                        className="settings-input"
                                    >
                                        <option value="Asia/Kolkata">
                                            India Standard Time
                                        </option>
                                        <option value="UTC">
                                            Coordinated Universal Time (UTC)
                                        </option>
                                        <option value="America/New_York">
                                            Eastern Time
                                        </option>
                                        <option value="Europe/London">
                                            London Time
                                        </option>
                                    </select>
                                </FormField>
                            </div>

                            <SaveButton />
                        </form>
                    )}

                    {/* Preferences */}
                    {activeTab === "preferences" && (
                        <form onSubmit={handleSave}>
                            <SectionHeading
                                title="Preferences"
                                description="Choose your dashboard display and notification preferences."
                            />

                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                <FormField label="Language">
                                    <select
                                        value={settings.preferences.language}
                                        onChange={(e) =>
                                            updateField("preferences", "language", e.target.value)
                                        }
                                        className="settings-input"
                                    >
                                        <option value="English">English</option>
                                        <option value="Gujarati">Gujarati</option>
                                        <option value="Hindi">Hindi</option>
                                    </select>
                                </FormField>

                                <FormField label="Dashboard Theme">
                                    <select
                                        value={settings.preferences.theme}
                                        onChange={(e) =>
                                            updateField("preferences", "theme", e.target.value)
                                        }
                                        className="settings-input"
                                    >
                                        <option value="Light">Light</option>
                                        <option value="Dark">Dark</option>
                                        <option value="System">System Default</option>
                                    </select>
                                </FormField>
                            </div>

                            <div className="mt-7">
                                <h3 className="mb-1 font-bold text-cyprus">
                                    Notification Preferences
                                </h3>

                                <p className="mb-4 text-sm text-gray-500">
                                    Choose which types of notifications you want to receive.
                                </p>

                                <div className="divide-y divide-gray-100">
                                    <ToggleRow
                                        title="Email Notifications"
                                        description="Receive general updates by email."
                                        checked={settings.preferences.emailNotifications}
                                        onChange={(value) =>
                                            updateField("preferences", "emailNotifications", value)
                                        }
                                    />

                                    <ToggleRow
                                        title="Order Notifications"
                                        description="Receive updates about new and changed orders."
                                        checked={settings.preferences.orderNotifications}
                                        onChange={(value) =>
                                            updateField("preferences", "orderNotifications", value)
                                        }
                                    />

                                    <ToggleRow
                                        title="Low Stock Alerts"
                                        description="Get notified about products with low stock."
                                        checked={settings.preferences.stockNotifications}
                                        onChange={(value) =>
                                            updateField("preferences", "stockNotifications", value)
                                        }
                                    />
                                </div>
                            </div>

                            <SaveButton />
                        </form>
                    )}

                    {/* Security */}
                    {activeTab === "security" && (
                        <form onSubmit={handlePasswordSubmit}>
                            <SectionHeading
                                title="Security"
                                description="Password changes require a secure backend implementation."
                            />

                            <div className="mb-6 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                                <div className="flex items-start gap-3">
                                    <i className="fa-solid fa-triangle-exclamation mt-1 text-yellow-600"></i>
                                    <div>
                                        <p className="font-semibold text-yellow-800">
                                            Demo Security Form
                                        </p>
                                        <p className="mt-1 text-sm text-yellow-700">
                                            This form only validates the fields in your browser.
                                            It does not change your real account password.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="max-w-xl space-y-5">
                                <FormField label="Current Password">
                                    <input
                                        required
                                        type="password"
                                        name="currentPassword"
                                        autoComplete="current-password"
                                        value={passwords.currentPassword}
                                        onChange={handlePasswordChange}
                                        className="settings-input"
                                        placeholder="Enter current password"
                                    />
                                </FormField>

                                <FormField label="New Password">
                                    <input
                                        required
                                        type="password"
                                        name="newPassword"
                                        autoComplete="new-password"
                                        minLength={8}
                                        value={passwords.newPassword}
                                        onChange={handlePasswordChange}
                                        className="settings-input"
                                        placeholder="At least 8 characters"
                                    />
                                </FormField>

                                <FormField label="Confirm New Password">
                                    <input
                                        required
                                        type="password"
                                        name="confirmPassword"
                                        autoComplete="new-password"
                                        minLength={8}
                                        value={passwords.confirmPassword}
                                        onChange={handlePasswordChange}
                                        className="settings-input"
                                        placeholder="Re-enter new password"
                                    />
                                </FormField>
                            </div>

                            <div className="mt-6">
                                <button
                                    type="submit"
                                    className="flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 py-3 font-semibold text-white hover:opacity-90"
                                >
                                    <i className="fa-solid fa-lock"></i>
                                    Validate Password Form
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

function SectionHeading({ title, description }) {
    return (
        <div className="mb-6 border-b border-gray-100 pb-5">
            <h2 className="text-xl font-bold text-cyprus">{title}</h2>
            <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
    );
}

function FormField({ label, children }) {
    return (
        <div className="min-w-0">
            <label className="mb-2 block text-sm font-semibold text-gray-700">
                {label}
            </label>
            {children}
        </div>
    );
}

function ToggleRow({ title, description, checked, onChange }) {
    return (
        <div className="flex items-center justify-between gap-4 py-4">
            <div>
                <p className="font-semibold text-gray-800">{title}</p>
                <p className="mt-1 text-sm text-gray-500">{description}</p>
            </div>

            <button
                type="button"
                role="switch"
                aria-checked={checked}
                onClick={() => onChange(!checked)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                    checked ? "bg-brand-primary" : "bg-gray-300"
                }`}
            >
                <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                        checked ? "left-6" : "left-1"
                    }`}
                />
            </button>
        </div>
    );
}

function SaveButton() {
    return (
        <div className="mt-7 flex justify-end border-t border-gray-100 pt-5">
            <button
                type="submit"
                className="flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-6 py-3 font-semibold text-white transition hover:opacity-90"
            >
                <i className="fa-solid fa-floppy-disk"></i>
                Save Changes
            </button>
        </div>
    );
}

export default Settings;