// File: src/pages/admin/ContentManagement.jsx

import React, { useEffect, useMemo, useState } from "react";
import {
    faPlus,
    faPenToSquare,
    faTrash,
    faImage,
    faGear,
    faMagnifyingGlass,
    faXmark,
    faSpinner,
    faArrowLeft,
    faArrowRight,
    faEye,
    faCheck,
    faBan,
    faLink,
    faCalendarDays,
    faLayerGroup,
    faRotateRight,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const API_BASE = "http://192.168.1.20:5000/api/admin";
const ITEMS_PER_PAGE = 5;

const emptyBanner = {
    title: "",
    image: "",
    link: "",
    start_date: "",
    end_date: "",
    status: "active",
    sort_order: 0,
};

const emptySetting = {
    key: "",
    value: "",
    type: "",
    description: "",
};

function ContentManagement() {
    const [activeTab, setActiveTab] = useState("banners");

    const [banners, setBanners] = useState([]);
    const [settings, setSettings] = useState([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);

    const [bannerModal, setBannerModal] = useState(false);
    const [settingModal, setSettingModal] = useState(false);
    const [deleteModal, setDeleteModal] = useState(false);
    const [previewModal, setPreviewModal] = useState(false);

    const [editingBanner, setEditingBanner] = useState(null);
    const [editingSetting, setEditingSetting] = useState(null);

    const [selectedBanner, setSelectedBanner] = useState(null);
    const [selectedSetting, setSelectedSetting] = useState(null);

    const [bannerForm, setBannerForm] = useState(emptyBanner);
    const [settingForm, setSettingForm] = useState(emptySetting);
    const [bannerFile, setBannerFile] = useState(null);
    const [imagePreview, setImagePreview] = useState("");

    const [message, setMessage] = useState({
        type: "",
        text: "",
    });

    const token = localStorage.getItem("shopsphereToken");

    const getHeaders = () => ({
        Authorization: `Bearer ${token}`,
    });

    const getJsonHeaders = () => ({
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
    });

    const showMessage = (type, text) => {
        setMessage({ type, text });

        window.setTimeout(() => {
            setMessage({ type: "", text: "" });
        }, 3500);
    };

    // ============================
    // FETCH DATA
    // ============================

    const fetchBanners = async () => {
        const response = await fetch(`${API_BASE}/banners`, {
            headers: getHeaders(),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Failed to fetch banners");
        }

        setBanners(Array.isArray(result.banners) ? result.banners : []);
    };

    const fetchSettings = async () => {
        const response = await fetch(`${API_BASE}/settings`, {
            headers: getHeaders(),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Failed to fetch settings");
        }

        setSettings(Array.isArray(result.settings) ? result.settings : []);
    };

    const fetchAllData = async () => {
        setLoading(true);

        try {
            await Promise.all([
                fetchBanners(),
                fetchSettings(),
            ]);
        } catch (error) {
            showMessage("error", error.message || "Unable to load content");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
        // Initial data load only.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ============================
    // FILTERING AND PAGINATION
    // ============================

    const filteredBanners = useMemo(() => {
        const query = search.trim().toLowerCase();

        return banners.filter((banner) => {
            const matchesSearch =
                !query ||
                banner.title?.toLowerCase().includes(query) ||
                banner.link?.toLowerCase().includes(query);

            const matchesStatus =
                statusFilter === "all" ||
                banner.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [banners, search, statusFilter]);

    const filteredSettings = useMemo(() => {
        const query = search.trim().toLowerCase();

        return settings.filter((setting) => {
            return (
                !query ||
                setting.key?.toLowerCase().includes(query) ||
                setting.value?.toLowerCase().includes(query) ||
                setting.type?.toLowerCase().includes(query) ||
                setting.description?.toLowerCase().includes(query)
            );
        });
    }, [settings, search]);

    const activeItems =
        activeTab === "banners" ? filteredBanners : filteredSettings;

    const totalPages = Math.max(
        1,
        Math.ceil(activeItems.length / ITEMS_PER_PAGE)
    );

    const safePage = Math.min(currentPage, totalPages);

    const paginatedItems = activeItems.slice(
        (safePage - 1) * ITEMS_PER_PAGE,
        safePage * ITEMS_PER_PAGE
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, search, statusFilter]);

    // ============================
    // BANNER FORM
    // ============================

    const openCreateBanner = () => {
        setEditingBanner(null);
        setBannerForm({ ...emptyBanner });
        setBannerFile(null);
        setImagePreview("");
        setBannerModal(true);
    };

    const openEditBanner = (banner) => {
        setEditingBanner(banner);

        setBannerForm({
            title: banner.title || "",
            image: banner.image || "",
            link: banner.link || "",
            start_date: toDateTimeLocal(banner.start_date),
            end_date: toDateTimeLocal(banner.end_date),
            status: banner.status || "active",
            sort_order: banner.sort_order ?? 0,
        });

        setBannerFile(null);
        setImagePreview(toImageUrl(banner.image));
        setBannerModal(true);
    };

    const closeBannerModal = () => {
        if (saving) return;

        setBannerModal(false);
        setEditingBanner(null);
        setBannerFile(null);
        setImagePreview("");
        setBannerForm({ ...emptyBanner });
    };

    const handleBannerInput = (event) => {
        const { name, value } = event.target;

        setBannerForm((previous) => ({
            ...previous,
            [name]: name === "sort_order" ? value : value,
        }));
    };

    const handleImageChange = (event) => {
        const file = event.target.files?.[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {
            showMessage("error", "Please select a valid image file");
            event.target.value = "";
            return;
        }

        setBannerFile(file);
        setImagePreview(URL.createObjectURL(file));
    };

    const saveBanner = async (event) => {
        event.preventDefault();

        if (!bannerForm.title.trim()) {
            showMessage("error", "Banner title is required");
            return;
        }

        if (!editingBanner && !bannerFile && !bannerForm.image.trim()) {
            showMessage("error", "Please select a banner image");
            return;
        }

        if (
            bannerForm.start_date &&
            bannerForm.end_date &&
            new Date(bannerForm.end_date) < new Date(bannerForm.start_date)
        ) {
            showMessage("error", "End date cannot be earlier than start date");
            return;
        }

        const formData = new FormData();

        formData.append("title", bannerForm.title.trim());
        formData.append("link", bannerForm.link.trim());
        formData.append("status", bannerForm.status);
        formData.append("sort_order", String(bannerForm.sort_order || 0));

        formData.append(
            "start_date",
            bannerForm.start_date
                ? new Date(bannerForm.start_date).toISOString()
                : ""
        );

        formData.append(
            "end_date",
            bannerForm.end_date
                ? new Date(bannerForm.end_date).toISOString()
                : ""
        );

        if (bannerFile) {
            formData.append("image", bannerFile);
        } else if (bannerForm.image) {
            formData.append("image", bannerForm.image);
        }

        const isEditing = Boolean(editingBanner);

        setSaving(true);

        try {
            const url = isEditing
                ? `${API_BASE}/banners/${editingBanner.id}`
                : `${API_BASE}/banners`;

            const response = await fetch(url, {
                method: isEditing ? "PUT" : "POST",
                headers: getHeaders(),
                body: formData,
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Failed to save banner");
            }

            await fetchBanners();

            closeBannerModal();

            showMessage(
                "success",
                result.message ||
                    (isEditing
                        ? "Banner updated successfully"
                        : "Banner created successfully")
            );
        } catch (error) {
            showMessage("error", error.message || "Unable to save banner");
        } finally {
            setSaving(false);
        }
    };

    // ============================
    // SETTINGS FORM
    // ============================

    const openCreateSetting = () => {
        setEditingSetting(null);
        setSettingForm({ ...emptySetting });
        setSettingModal(true);
    };

    const openEditSetting = (setting) => {
        setEditingSetting(setting);

        setSettingForm({
            key: setting.key || "",
            value: setting.value ?? "",
            type: setting.type || "",
            description: setting.description || "",
        });

        setSettingModal(true);
    };

    const closeSettingModal = () => {
        if (saving) return;

        setSettingModal(false);
        setEditingSetting(null);
        setSettingForm({ ...emptySetting });
    };

    const handleSettingInput = (event) => {
        const { name, value } = event.target;

        setSettingForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    const saveSetting = async (event) => {
        event.preventDefault();

        if (!settingForm.key.trim()) {
            showMessage("error", "Setting key is required");
            return;
        }

        const payload = {
            key: settingForm.key.trim(),
            value: settingForm.value === "" ? null : settingForm.value,
            type: settingForm.type.trim() || null,
            description: settingForm.description.trim() || null,
        };

        const isEditing = Boolean(editingSetting);

        setSaving(true);

        try {
            const url = isEditing
                ? `${API_BASE}/settings/${editingSetting.id}`
                : `${API_BASE}/settings`;

            const response = await fetch(url, {
                method: isEditing ? "PUT" : "POST",
                headers: getJsonHeaders(),
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Failed to save setting");
            }

            await fetchSettings();

            closeSettingModal();

            showMessage(
                "success",
                result.message ||
                    (isEditing
                        ? "Setting updated successfully"
                        : "Setting created successfully")
            );
        } catch (error) {
            showMessage("error", error.message || "Unable to save setting");
        } finally {
            setSaving(false);
        }
    };

    // ============================
    // DELETE
    // ============================

    const openDeleteBanner = (banner) => {
        setSelectedBanner(banner);
        setSelectedSetting(null);
        setDeleteModal(true);
    };

    const openDeleteSetting = (setting) => {
        setSelectedSetting(setting);
        setSelectedBanner(null);
        setDeleteModal(true);
    };

    const closeDeleteModal = () => {
        if (saving) return;

        setDeleteModal(false);
        setSelectedBanner(null);
        setSelectedSetting(null);
    };

    const deleteItem = async () => {
        const isBanner = Boolean(selectedBanner);
        const selected = selectedBanner || selectedSetting;

        if (!selected) return;

        setSaving(true);

        try {
            const endpoint = isBanner
                ? `${API_BASE}/banners/${selected.id}`
                : `${API_BASE}/settings/${selected.id}`;

            const response = await fetch(endpoint, {
                method: "DELETE",
                headers: getHeaders(),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Failed to delete item");
            }

            if (isBanner) {
                await fetchBanners();
            } else {
                await fetchSettings();
            }

            closeDeleteModal();

            showMessage(
                "success",
                result.message || "Deleted successfully"
            );
        } catch (error) {
            showMessage("error", error.message || "Unable to delete item");
        } finally {
            setSaving(false);
        }
    };

    // ============================
    // HELPERS
    // ============================

    function toDateTimeLocal(value) {
        if (!value) return "";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return "";

        const localDate = new Date(
            date.getTime() - date.getTimezoneOffset() * 60000
        );

        return localDate.toISOString().slice(0, 16);
    }

    function toImageUrl(image) {
        if (!image) return "";

        if (/^https?:\/\//i.test(image) || image.startsWith("data:")) {
            return image;
        }

        const serverBase = API_BASE.replace("/api/admin", "");

        return `${serverBase}${image.startsWith("/") ? "" : "/"}${image}`;
    }

    function formatDate(value) {
        if (!value) return "Not scheduled";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return "—";

        return date.toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    const resetSearch = () => {
        setSearch("");
        setStatusFilter("all");
        setCurrentPage(1);
    };

    // ============================
    // UI
    // ============================

    return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl space-y-6">

                {/* HEADER */}

                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-ocean-green">
                            <FontAwesomeIcon icon={faLayerGroup} />
                            Admin / Content Management
                        </div>

                        <h1 className="text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">
                            Content Management
                        </h1>

                        <p className="mt-2 text-sm text-slate-500 sm:text-base">
                            Manage website banners and configuration settings.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={fetchAllData}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:opacity-60"
                    >
                        <FontAwesomeIcon
                            icon={faRotateRight}
                            className={loading ? "animate-spin" : ""}
                        />
                        Refresh
                    </button>
                </div>

                {/* ALERT */}

                {message.text && (
                    <div
                        role="status"
                        className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-sm font-medium ${
                            message.type === "success"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-rose-200 bg-rose-50 text-rose-700"
                        }`}
                    >
                        <span>{message.text}</span>

                        <button
                            type="button"
                            onClick={() => setMessage({ type: "", text: "" })}
                            aria-label="Close message"
                        >
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    </div>
                )}

                {/* SUMMARY CARDS */}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard
                        title="Total Banners"
                        value={banners.length}
                        icon={faImage}
                        iconClass="bg-emerald-50 text-emerald-600"
                    />

                    <SummaryCard
                        title="Active Banners"
                        value={banners.filter((item) => item.status === "active").length}
                        icon={faCheck}
                        iconClass="bg-blue-50 text-blue-600"
                    />

                    <SummaryCard
                        title="Inactive Banners"
                        value={banners.filter((item) => item.status === "inactive").length}
                        icon={faBan}
                        iconClass="bg-rose-50 text-rose-600"
                    />

                    <SummaryCard
                        title="Website Settings"
                        value={settings.length}
                        icon={faGear}
                        iconClass="bg-violet-50 text-violet-600"
                    />
                </div>

                {/* MAIN CONTENT */}

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                    {/* TABS */}

                    <div className="flex flex-col justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:px-6">
                        <div className="flex gap-2">
                            <TabButton
                                active={activeTab === "banners"}
                                onClick={() => setActiveTab("banners")}
                                icon={faImage}
                            >
                                Banners
                            </TabButton>

                            <TabButton
                                active={activeTab === "settings"}
                                onClick={() => setActiveTab("settings")}
                                icon={faGear}
                            >
                                Settings
                            </TabButton>
                        </div>

                        <button
                            type="button"
                            onClick={
                                activeTab === "banners"
                                    ? openCreateBanner
                                    : openCreateSetting
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-ocean-green px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            {activeTab === "banners" ? "Add Banner" : "Add Setting"}
                        </button>
                    </div>

                    {/* FILTERS */}

                    <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:px-6">
                        <div className="relative flex-1">
                            <FontAwesomeIcon
                                icon={faMagnifyingGlass}
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                            />

                            <input
                                type="text"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder={
                                    activeTab === "banners"
                                        ? "Search banner title or link..."
                                        : "Search setting key, value or type..."
                                }
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-ocean-green focus:bg-white focus:ring-2 focus:ring-emerald-100"
                            />
                        </div>

                        {activeTab === "banners" && (
                            <select
                                value={statusFilter}
                                onChange={(event) => setStatusFilter(event.target.value)}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-ocean-green"
                            >
                                <option value="all">All Statuses</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        )}

                        <button
                            type="button"
                            onClick={resetSearch}
                            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                        >
                            Reset
                        </button>
                    </div>

                    {/* TABLE */}

                    {loading ? (
                        <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-slate-500">
                            <FontAwesomeIcon
                                icon={faSpinner}
                                className="animate-spin text-3xl text-ocean-green"
                            />
                            <p className="text-sm">Loading content...</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                {activeTab === "banners" ? (
                                    <table className="w-full min-w-[850px] text-left">
                                        <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                                            <tr>
                                                <th className="px-6 py-4 font-semibold">Banner</th>
                                                <th className="px-6 py-4 font-semibold">Schedule</th>
                                                <th className="px-6 py-4 font-semibold">Order</th>
                                                <th className="px-6 py-4 font-semibold">Status</th>
                                                <th className="px-6 py-4 text-right font-semibold">Actions</th>
                                            </tr>
                                        </thead>

                                        <tbody className="divide-y divide-slate-100">
                                            {paginatedItems.map((banner) => (
                                                <tr
                                                    key={banner.id}
                                                    className="transition hover:bg-slate-50/70"
                                                >
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                                                                {banner.image ? (
                                                                    <img
                                                                        src={toImageUrl(banner.image)}
                                                                        alt={banner.title}
                                                                        className="h-full w-full object-cover"
                                                                        onError={(event) => {
                                                                            event.currentTarget.style.display = "none";
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <FontAwesomeIcon
                                                                        icon={faImage}
                                                                        className="text-xl text-slate-400"
                                                                    />
                                                                )}
                                                            </div>

                                                            <div className="min-w-0">
                                                                <p className="max-w-xs truncate font-semibold text-slate-800">
                                                                    {banner.title}
                                                                </p>

                                                                <p className="mt-1 max-w-xs truncate text-xs text-slate-500">
                                                                    {banner.link || "No destination link"}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="px-6 py-4">
                                                        <p className="text-xs text-slate-600">
                                                            <span className="font-semibold">Start:</span>{" "}
                                                            {formatDate(banner.start_date)}
                                                        </p>

                                                        <p className="mt-1 text-xs text-slate-600">
                                                            <span className="font-semibold">End:</span>{" "}
                                                            {formatDate(banner.end_date)}
                                                        </p>
                                                    </td>

                                                    <td className="px-6 py-4">
                                                        <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">
                                                            {banner.sort_order ?? 0}
                                                        </span>
                                                    </td>

                                                    <td className="px-6 py-4">
                                                        <StatusBadge status={banner.status} />
                                                    </td>

                                                    <td className="px-6 py-4">
                                                        <div className="flex justify-end gap-2">
                                                            <ActionButton
                                                                title="Preview banner"
                                                                icon={faEye}
                                                                onClick={() => {
                                                                    setSelectedBanner(banner);
                                                                    setPreviewModal(true);
                                                                }}
                                                                className="text-blue-600 hover:bg-blue-50"
                                                            />

                                                            <ActionButton
                                                                title="Edit banner"
                                                                icon={faPenToSquare}
                                                                onClick={() => openEditBanner(banner)}
                                                                className="text-emerald-600 hover:bg-emerald-50"
                                                            />

                                                            <ActionButton
                                                                title="Delete banner"
                                                                icon={faTrash}
                                                                onClick={() => openDeleteBanner(banner)}
                                                                className="text-rose-600 hover:bg-rose-50"
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <table className="w-full min-w-[800px] text-left">
                                        <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                                            <tr>
                                                <th className="px-6 py-4 font-semibold">Setting Key</th>
                                                <th className="px-6 py-4 font-semibold">Value</th>
                                                <th className="px-6 py-4 font-semibold">Type</th>
                                                <th className="px-6 py-4 font-semibold">Updated</th>
                                                <th className="px-6 py-4 text-right font-semibold">Actions</th>
                                            </tr>
                                        </thead>

                                        <tbody className="divide-y divide-slate-100">
                                            {paginatedItems.map((setting) => (
                                                <tr
                                                    key={setting.id}
                                                    className="transition hover:bg-slate-50/70"
                                                >
                                                    <td className="px-6 py-4">
                                                        <p className="font-semibold text-slate-800">
                                                            {setting.key}
                                                        </p>

                                                        <p className="mt-1 max-w-xs truncate text-xs text-slate-500">
                                                            {setting.description || "No description"}
                                                        </p>
                                                    </td>

                                                    <td className="max-w-xs px-6 py-4">
                                                        <p className="max-w-xs break-words text-sm text-slate-600">
                                                            {setting.value ?? "—"}
                                                        </p>
                                                    </td>

                                                    <td className="px-6 py-4">
                                                        <span className="rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
                                                            {setting.type || "General"}
                                                        </span>
                                                    </td>

                                                    <td className="px-6 py-4 text-xs text-slate-500">
                                                        {formatDate(setting.updated_at)}
                                                    </td>

                                                    <td className="px-6 py-4">
                                                        <div className="flex justify-end gap-2">
                                                            <ActionButton
                                                                title="Edit setting"
                                                                icon={faPenToSquare}
                                                                onClick={() => openEditSetting(setting)}
                                                                className="text-emerald-600 hover:bg-emerald-50"
                                                            />

                                                            <ActionButton
                                                                title="Delete setting"
                                                                icon={faTrash}
                                                                onClick={() => openDeleteSetting(setting)}
                                                                className="text-rose-600 hover:bg-rose-50"
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}

                                {paginatedItems.length === 0 && (
                                    <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
                                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-400">
                                            <FontAwesomeIcon
                                                icon={activeTab === "banners" ? faImage : faGear}
                                            />
                                        </div>

                                        <h3 className="font-semibold text-slate-800">
                                            No {activeTab === "banners" ? "banners" : "settings"} found
                                        </h3>

                                        <p className="mt-1 text-sm text-slate-500">
                                            Try another search or create a new item.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* PAGINATION */}

                            <div className="flex flex-col gap-4 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                                <p className="text-center text-sm text-slate-500 sm:text-left">
                                    {activeItems.length > 0 ? (
                                        <>
                                            Showing{" "}
                                            <span className="font-semibold text-slate-700">
                                                {(safePage - 1) * ITEMS_PER_PAGE + 1}
                                            </span>
                                            {" – "}
                                            <span className="font-semibold text-slate-700">
                                                {Math.min(safePage * ITEMS_PER_PAGE, activeItems.length)}
                                            </span>
                                            {" of "}
                                            <span className="font-semibold text-slate-700">
                                                {activeItems.length}
                                            </span>
                                        </>
                                    ) : (
                                        "No records"
                                    )}
                                </p>

                                <div className="flex items-center justify-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                        disabled={safePage === 1}
                                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <FontAwesomeIcon icon={faArrowLeft} />
                                        Previous
                                    </button>

                                    <span className="rounded-lg bg-ocean-green px-4 py-2 text-sm font-semibold text-white">
                                        {safePage} / {totalPages}
                                    </span>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setCurrentPage((page) => Math.min(totalPages, page + 1))
                                        }
                                        disabled={safePage === totalPages}
                                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        Next
                                        <FontAwesomeIcon icon={faArrowRight} />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </section>

                <p className="text-center text-xs text-slate-400">
                    ShopSphere Admin • Content Management
                </p>
            </div>

            {/* ============================ */}
            {/* CREATE / EDIT BANNER MODAL */}
            {/* ============================ */}

            {bannerModal && (
                <ModalShell
                    onClose={closeBannerModal}
                    title={editingBanner ? "Edit Banner" : "Create Banner"}
                    subtitle="Manage the banner shown on your website."
                    icon={faImage}
                    wide
                >
                    <form onSubmit={saveBanner} className="space-y-5">
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <div className="space-y-4">
                                <FormField label="Banner Title" required>
                                    <input
                                        name="title"
                                        value={bannerForm.title}
                                        onChange={handleBannerInput}
                                        maxLength={255}
                                        required
                                        placeholder="Enter banner title"
                                        className={inputClass}
                                    />
                                </FormField>

                                <FormField label="Destination Link">
                                    <div className="relative">
                                        <FontAwesomeIcon
                                            icon={faLink}
                                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                        />

                                        <input
                                            name="link"
                                            value={bannerForm.link}
                                            onChange={handleBannerInput}
                                            maxLength={500}
                                            placeholder="https://example.com/product"
                                            className={`${inputClass} pl-10`}
                                        />
                                    </div>
                                </FormField>

                                <FormField label="Banner Image" required={!editingBanner}>
                                    <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition hover:border-emerald-400 hover:bg-emerald-50/40">
                                        <FontAwesomeIcon
                                            icon={faImage}
                                            className="mb-2 text-2xl text-slate-400"
                                        />

                                        <span className="text-sm font-semibold text-slate-700">
                                            Click to upload image
                                        </span>

                                        <span className="mt-1 text-xs text-slate-500">
                                            PNG, JPG, WEBP
                                        </span>

                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageChange}
                                            className="hidden"
                                        />
                                    </label>

                                    {bannerFile && (
                                        <p className="mt-2 break-all text-xs text-emerald-700">
                                            Selected: {bannerFile.name}
                                        </p>
                                    )}
                                </FormField>
                            </div>

                            <div className="space-y-4">
                                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                                    <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Image Preview
                                        </span>

                                        <FontAwesomeIcon
                                            icon={faEye}
                                            className="text-slate-400"
                                        />
                                    </div>

                                    <div className="flex min-h-44 items-center justify-center p-3">
                                        {imagePreview ? (
                                            <img
                                                src={imagePreview}
                                                alt="Banner preview"
                                                className="max-h-52 w-full rounded-lg object-contain"
                                            />
                                        ) : (
                                            <div className="py-8 text-center text-slate-400">
                                                <FontAwesomeIcon
                                                    icon={faImage}
                                                    className="mb-2 text-4xl"
                                                />
                                                <p className="text-sm">No image selected</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <FormField label="Start Date">
                                    <div className="relative">
                                        <FontAwesomeIcon
                                            icon={faCalendarDays}
                                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                        />

                                        <input
                                            type="datetime-local"
                                            name="start_date"
                                            value={bannerForm.start_date}
                                            onChange={handleBannerInput}
                                            className={`${inputClass} pl-10`}
                                        />
                                    </div>
                                </FormField>

                                <FormField label="End Date">
                                    <div className="relative">
                                        <FontAwesomeIcon
                                            icon={faCalendarDays}
                                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                        />

                                        <input
                                            type="datetime-local"
                                            name="end_date"
                                            value={bannerForm.end_date}
                                            onChange={handleBannerInput}
                                            min={bannerForm.start_date || undefined}
                                            className={`${inputClass} pl-10`}
                                        />
                                    </div>
                                </FormField>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <FormField label="Status" required>
                                <select
                                    name="status"
                                    value={bannerForm.status}
                                    onChange={handleBannerInput}
                                    className={inputClass}
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </FormField>

                            <FormField label="Sort Order" required>
                                <input
                                    type="number"
                                    name="sort_order"
                                    value={bannerForm.sort_order}
                                    onChange={handleBannerInput}
                                    min="0"
                                    step="1"
                                    required
                                    className={inputClass}
                                />
                            </FormField>
                        </div>

                        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={closeBannerModal}
                                disabled={saving}
                                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                disabled={saving}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-ocean-green px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                            >
                                {saving && (
                                    <FontAwesomeIcon
                                        icon={faSpinner}
                                        className="animate-spin"
                                    />
                                )}

                                {editingBanner ? "Save Changes" : "Create Banner"}
                            </button>
                        </div>
                    </form>
                </ModalShell>
            )}

            {/* ============================ */}
            {/* CREATE / EDIT SETTINGS MODAL */}
            {/* ============================ */}

            {settingModal && (
                <ModalShell
                    onClose={closeSettingModal}
                    title={editingSetting ? "Edit Setting" : "Create Setting"}
                    subtitle="Configure a website setting."
                    icon={faGear}
                >
                    <form onSubmit={saveSetting} className="space-y-4">
                        <FormField label="Setting Key" required>
                            <input
                                name="key"
                                value={settingForm.key}
                                onChange={handleSettingInput}
                                maxLength={191}
                                required
                                placeholder="e.g. site_name"
                                className={inputClass}
                            />
                        </FormField>

                        <FormField label="Value">
                            <textarea
                                name="value"
                                value={settingForm.value}
                                onChange={handleSettingInput}
                                rows={3}
                                placeholder="Enter setting value"
                                className={`${inputClass} resize-y`}
                            />
                        </FormField>

                        <FormField label="Type">
                            <input
                                name="type"
                                value={settingForm.type}
                                onChange={handleSettingInput}
                                maxLength={50}
                                placeholder="e.g. string, number, boolean"
                                className={inputClass}
                            />
                        </FormField>

                        <FormField label="Description">
                            <textarea
                                name="description"
                                value={settingForm.description}
                                onChange={handleSettingInput}
                                rows={3}
                                placeholder="Describe what this setting controls"
                                className={`${inputClass} resize-y`}
                            />
                        </FormField>

                        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={closeSettingModal}
                                disabled={saving}
                                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                disabled={saving}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-ocean-green px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                            >
                                {saving && (
                                    <FontAwesomeIcon
                                        icon={faSpinner}
                                        className="animate-spin"
                                    />
                                )}

                                {editingSetting ? "Save Changes" : "Create Setting"}
                            </button>
                        </div>
                    </form>
                </ModalShell>
            )}

            {/* ============================ */}
            {/* DELETE CONFIRMATION MODAL */}
            {/* ============================ */}

            {deleteModal && (
                <ModalShell
                    onClose={closeDeleteModal}
                    title="Confirm Deletion"
                    subtitle="This action cannot be undone."
                    icon={faTrash}
                    compact
                >
                    <div className="text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-2xl text-rose-600">
                            <FontAwesomeIcon icon={faTrash} />
                        </div>

                        <p className="text-sm leading-6 text-slate-600">
                            Are you sure you want to delete{" "}
                            <span className="font-bold text-slate-800">
                                {selectedBanner?.title ||
                                    selectedSetting?.key ||
                                    "this item"}
                            </span>
                            ?
                        </p>

                        <p className="mt-2 text-xs text-slate-400">
                            The deleted item cannot be restored.
                        </p>
                    </div>

                    <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
                        <button
                            type="button"
                            onClick={closeDeleteModal}
                            disabled={saving}
                            className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            onClick={deleteItem}
                            disabled={saving}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                        >
                            {saving && (
                                <FontAwesomeIcon
                                    icon={faSpinner}
                                    className="animate-spin"
                                />
                            )}
                            Delete Permanently
                        </button>
                    </div>
                </ModalShell>
            )}

            {/* ============================ */}
            {/* BANNER PREVIEW MODAL */}
            {/* ============================ */}

            {previewModal && selectedBanner && (
                <ModalShell
                    onClose={() => {
                        setPreviewModal(false);
                        setSelectedBanner(null);
                    }}
                    title="Banner Preview"
                    subtitle="Preview your website banner."
                    icon={faEye}
                    wide
                >
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                        {selectedBanner.image && (
                            <img
                                src={toImageUrl(selectedBanner.image)}
                                alt={selectedBanner.title}
                                className="max-h-80 w-full bg-slate-50 object-contain"
                            />
                        )}

                        <div className="space-y-3 p-4">
                            <h3 className="text-lg font-bold text-slate-800">
                                {selectedBanner.title}
                            </h3>

                            <div className="flex flex-wrap items-center gap-3">
                                <StatusBadge status={selectedBanner.status} />

                                <span className="text-xs text-slate-500">
                                    Sort order: {selectedBanner.sort_order ?? 0}
                                </span>
                            </div>

                            {selectedBanner.link && (
                                <p className="break-all text-sm text-ocean-green">
                                    <FontAwesomeIcon
                                        icon={faLink}
                                        className="mr-2"
                                    />
                                    {selectedBanner.link}
                                </p>
                            )}

                            <p className="text-xs text-slate-500">
                                Start: {formatDate(selectedBanner.start_date)}
                            </p>

                            <p className="text-xs text-slate-500">
                                End: {formatDate(selectedBanner.end_date)}
                            </p>
                        </div>
                    </div>

                    <div className="mt-5 flex justify-end">
                        <button
                            type="button"
                            onClick={() => {
                                setPreviewModal(false);
                                setSelectedBanner(null);
                            }}
                            className="rounded-xl bg-ocean-green px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                        >
                            Close Preview
                        </button>
                    </div>
                </ModalShell>
            )}
        </div>
    );
}

// ============================
// REUSABLE COMPONENTS
// ============================

const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-ocean-green focus:ring-2 focus:ring-emerald-100";

function SummaryCard({ title, value, icon, iconClass }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-medium text-slate-500">
                        {title}
                    </p>

                    <p className="mt-2 text-3xl font-bold tracking-tight text-slate-800">
                        {value}
                    </p>
                </div>

                <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl text-lg ${iconClass}`}
                >
                    <FontAwesomeIcon icon={icon} />
                </div>
            </div>
        </div>
    );
}

function TabButton({ active, onClick, icon, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                active
                    ? "bg-ocean-green text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
        >
            <FontAwesomeIcon icon={icon} />
            {children}
        </button>
    );
}

function StatusBadge({ status }) {
    const active = status === "active";

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                active
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
            }`}
        >
            <span
                className={`h-1.5 w-1.5 rounded-full ${
                    active ? "bg-emerald-500" : "bg-slate-400"
                }`}
            />
            {active ? "Active" : "Inactive"}
        </span>
    );
}

function ActionButton({ title, icon, onClick, className = "" }) {
    return (
        <button
            type="button"
            title={title}
            aria-label={title}
            onClick={onClick}
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${className}`}
        >
            <FontAwesomeIcon icon={icon} />
        </button>
    );
}

function FormField({ label, required = false, children }) {
    return (
        <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
                {label}
                {required && <span className="ml-1 text-rose-500">*</span>}
            </label>

            {children}
        </div>
    );
}

function ModalShell({
    title,
    subtitle,
    icon,
    onClose,
    children,
    wide = false,
    compact = false,
}) {
    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        window.addEventListener("keydown", handleEscape);

        return () => {
            window.removeEventListener("keydown", handleEscape);
        };
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <div
                className={`my-auto w-full overflow-hidden rounded-2xl bg-white shadow-2xl ${
                    compact
                        ? "max-w-md"
                        : wide
                            ? "max-w-3xl"
                            : "max-w-xl"
                }`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="content-modal-title"
            >
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/80 px-5 py-5 sm:px-6">
                    <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-lg text-ocean-green">
                            <FontAwesomeIcon icon={icon} />
                        </div>

                        <div>
                            <h2
                                id="content-modal-title"
                                className="text-lg font-bold text-slate-800 sm:text-xl"
                            >
                                {title}
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                {subtitle}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close modal"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>

                <div className="max-h-[calc(100dvh-150px)] overflow-y-auto p-5 sm:p-6">
                    {children}
                </div>
            </div>
        </div>
    );
}

export default ContentManagement;