import React, { useCallback, useEffect, useMemo, useState } from "react";

const API_URL = "http://localhost:5000/api/admin/notifications";
const PAGE_SIZE = 5;

const INITIAL_FORM = {
    type: "general",
    title: "",
    message: "",
};

const STATUS_STYLES = {
    draft: "bg-gray-100 text-gray-700",
    scheduled: "bg-blue-100 text-blue-700",
    published: "bg-green-100 text-green-700",
};

const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const Notifications = () => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);

    const [showForm, setShowForm] = useState(false);
    const [editingNotification, setEditingNotification] = useState(null);
    const [form, setForm] = useState(INITIAL_FORM);
    const [formError, setFormError] = useState("");
    const [saving, setSaving] = useState(false);

    const [selectedNotification, setSelectedNotification] = useState(null);
    const [modalAction, setModalAction] = useState("");
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState("");

    const [scheduleDate, setScheduleDate] = useState("");

    const [pagination, setPagination] = useState({
        page: 1,
        limit: PAGE_SIZE,
        total: 0,
        total_pages: 0,
    });

    const getToken = () => {
        const token = localStorage.getItem("shopsphereToken");

        if (!token) {
            throw new Error("Login session not found. Please login again.");
        }

        return token;
    };

    const apiRequest = async (url, options = {}) => {
        const token = getToken();

        const response = await fetch(url, {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                ...options.headers,
            },
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || data.success !== true) {
            throw new Error(data.message || "Something went wrong.");
        }

        return data;
    };

    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const params = new URLSearchParams({
                page: String(currentPage),
                limit: String(PAGE_SIZE),
            });

            const data = await apiRequest(`${API_URL}?${params}`);

            const result = data.data || {};

            setNotifications(
                Array.isArray(result.notifications)
                    ? result.notifications
                    : []
            );

            setPagination({
                page: Number(result.pagination?.page || currentPage),
                limit: PAGE_SIZE,
                total: Number(result.pagination?.total || 0),
                total_pages: Number(result.pagination?.total_pages || 0),
            });
        } catch (err) {
            setError(err.message || "Unable to load notifications.");
        } finally {
            setLoading(false);
        }
    }, [currentPage]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const showSuccess = (message) => {
        setSuccess(message);
        setError("");

        window.setTimeout(() => {
            setSuccess("");
        }, 4000);
    };

    const openCreateForm = () => {
        setEditingNotification(null);
        setForm(INITIAL_FORM);
        setFormError("");
        setShowForm(true);
    };

    const openEditForm = (notification) => {
        if (!["draft", "scheduled"].includes(notification.status)) {
            return;
        }

        setEditingNotification(notification);
        setForm({
            type: notification.type || "general",
            title: notification.title || "",
            message: notification.message || "",
        });
        setFormError("");
        setShowForm(true);
    };

    const closeForm = () => {
        if (saving) return;

        setShowForm(false);
        setEditingNotification(null);
        setForm(INITIAL_FORM);
        setFormError("");
    };

    const handleFormChange = (event) => {
        const { name, value } = event.target;

        setForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    const handleSave = async (event) => {
        event.preventDefault();

        setFormError("");

        if (!form.type.trim()) {
            setFormError("Notification type is required.");
            return;
        }

        if (!form.title.trim()) {
            setFormError("Notification title is required.");
            return;
        }

        if (!form.message.trim()) {
            setFormError("Notification message is required.");
            return;
        }

        try {
            setSaving(true);

            const isEditing = Boolean(editingNotification);

            const url = isEditing
                ? `${API_URL}/${editingNotification.id}`
                : API_URL;

            await apiRequest(url, {
                method: isEditing ? "PUT" : "POST",
                body: JSON.stringify({
                    type: form.type.trim(),
                    title: form.title.trim(),
                    message: form.message.trim(),
                }),
            });

            closeForm();
            showSuccess(
                isEditing
                    ? "Notification updated successfully."
                    : "Notification saved as draft."
            );

            await fetchNotifications();
        } catch (err) {
            setFormError(err.message || "Unable to save notification.");
        } finally {
            setSaving(false);
        }
    };

    const openActionModal = (notification, action) => {
        setSelectedNotification(notification);
        setModalAction(action);
        setActionError("");
        setScheduleDate("");
    };

    const closeActionModal = () => {
        if (actionLoading) return;

        setSelectedNotification(null);
        setModalAction("");
        setActionError("");
        setScheduleDate("");
    };

    const handleNotificationAction = async () => {
        if (!selectedNotification || actionLoading) return;

        try {
            setActionLoading(true);
            setActionError("");

            const id = selectedNotification.id;
            let url = `${API_URL}/${id}`;
            let method = "DELETE";
            let body;

            if (modalAction === "publish") {
                url = `${API_URL}/${id}/publish`;
                method = "POST";
            } else if (modalAction === "schedule") {
                if (!scheduleDate) {
                    setActionError("Please select a schedule date and time.");
                    return;
                }

                const selectedDate = new Date(scheduleDate);

                if (
                    Number.isNaN(selectedDate.getTime()) ||
                    selectedDate.getTime() <= Date.now()
                ) {
                    setActionError("Please select a future date and time.");
                    return;
                }

                url = `${API_URL}/${id}/schedule`;
                method = "POST";
                body = JSON.stringify({
                    scheduled_at: selectedDate.toISOString(),
                });
            }

            const data = await apiRequest(url, {
                method,
                ...(body ? { body } : {}),
            });

            const actionMessages = {
                publish: data.message || "Notification published successfully.",
                schedule: data.message || "Notification scheduled successfully.",
                delete: data.message || "Notification deleted successfully.",
            };

            const message = actionMessages[modalAction];

            closeActionModal();
            showSuccess(message);

            if (
                modalAction === "delete" &&
                notifications.length === 1 &&
                currentPage > 1
            ) {
                setCurrentPage((page) => page - 1);
            } else {
                await fetchNotifications();
            }
        } catch (err) {
            setActionError(err.message || "Unable to complete this action.");
        } finally {
            setActionLoading(false);
        }
    };

    const filteredNotifications = useMemo(() => {
        const searchText = search.trim().toLowerCase();

        return notifications.filter((notification) => {
            const matchesSearch = [
                notification.title,
                notification.message,
                notification.type,
            ].some((value) =>
                String(value || "").toLowerCase().includes(searchText)
            );

            const matchesStatus =
                statusFilter === "all" ||
                notification.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [notifications, search, statusFilter]);

    const totalPages = Math.max(
        1,
        Math.ceil(pagination.total / PAGE_SIZE)
    );

    const changePage = (page) => {
        if (page < 1 || page > totalPages) return;

        setCurrentPage(page);
    };

    const getActionDetails = () => {
        if (modalAction === "publish") {
            return {
                title: "Publish Notification",
                description:
                    "This notification will be published to its recipients. Please confirm before continuing.",
                button: "Publish Now",
                icon: "fa-paper-plane",
                color: "bg-ocean-green hover:bg-cyprus",
            };
        }

        if (modalAction === "schedule") {
            return {
                title: "Schedule Notification",
                description:
                    "Choose a future date and time for this notification.",
                button: "Schedule Notification",
                icon: "fa-calendar-check",
                color: "bg-ocean-green hover:bg-cyprus",
            };
        }

        return {
            title: "Delete Notification",
            description:
                "Are you sure you want to delete this draft? This action cannot be undone.",
            button: "Delete Notification",
            icon: "fa-trash-can",
            color: "bg-red-600 hover:bg-red-700",
        };
    };

    const actionDetails = getActionDetails();

    return (
        <div className="min-h-screen bg-aqua-spring/30 p-4 sm:p-6 lg:p-8">
            {/* Header */}
            <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ocean-green text-white shadow-sm">
                            <i className="fa-solid fa-bell text-xl" />
                        </div>

                        <div>
                            <h1 className="text-2xl font-bold text-cyprus sm:text-3xl">
                                Notifications
                            </h1>
                            <p className="mt-1 text-sm text-text-grey">
                                Create, manage and publish store notifications.
                            </p>
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={openCreateForm}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-ocean-green px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-cyprus focus:outline-none focus:ring-4 focus:ring-ocean-green/20"
                >
                    <i className="fa-solid fa-plus" />
                    Create Notification
                </button>
            </div>

            {/* Success */}
            {success && (
                <div className="mb-5 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-green-700">
                    <i className="fa-solid fa-circle-check text-lg" />
                    <p className="flex-1 text-sm font-medium">{success}</p>
                    <button
                        type="button"
                        onClick={() => setSuccess("")}
                        aria-label="Dismiss success message"
                    >
                        <i className="fa-solid fa-xmark" />
                    </button>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="mb-5 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm">
                        <i className="fa-solid fa-circle-exclamation mr-2" />
                        {error}
                    </p>

                    <button
                        type="button"
                        onClick={fetchNotifications}
                        className="font-semibold underline"
                    >
                        Try Again
                    </button>
                </div>
            )}

            {/* Summary Cards */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-text-grey">
                                Total Notifications
                            </p>
                            <h2 className="mt-2 text-2xl font-bold text-cyprus">
                                {pagination.total}
                            </h2>
                        </div>
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-aqua-spring text-ocean-green">
                            <i className="fa-solid fa-bell text-xl" />
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-text-grey">
                                Drafts on This Page
                            </p>
                            <h2 className="mt-2 text-2xl font-bold text-gray-700">
                                {
                                    notifications.filter(
                                        (item) => item.status === "draft"
                                    ).length
                                }
                            </h2>
                        </div>
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
                            <i className="fa-solid fa-file-lines text-xl" />
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-text-grey">
                                Published on This Page
                            </p>
                            <h2 className="mt-2 text-2xl font-bold text-green-600">
                                {
                                    notifications.filter(
                                        (item) => item.status === "published"
                                    ).length
                                }
                            </h2>
                        </div>
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-600">
                            <i className="fa-solid fa-paper-plane text-xl" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Search & Filters */}
            <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_220px_auto]">
                    <div className="relative">
                        <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />

                        <input
                            type="text"
                            value={search}
                            onChange={(event) => {
                                setSearch(event.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder="Search notifications..."
                            className="w-full rounded-xl border border-gray-200 py-3 pl-11 pr-4 outline-none transition focus:border-ocean-green focus:ring-4 focus:ring-ocean-green/10"
                        />
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(event) => {
                            setStatusFilter(event.target.value);
                            setCurrentPage(1);
                        }}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-ocean-green focus:ring-4 focus:ring-ocean-green/10"
                    >
                        <option value="all">All Statuses</option>
                        <option value="draft">Draft</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="published">Published</option>
                    </select>

                    <button
                        type="button"
                        onClick={fetchNotifications}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 font-semibold text-cyprus transition hover:bg-gray-50 disabled:opacity-50"
                    >
                        <i
                            className={`fa-solid fa-rotate-right ${
                                loading ? "animate-spin" : ""
                            }`}
                        />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Notifications List */}
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="flex flex-col gap-2 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="font-bold text-cyprus">
                            Notification List
                        </h2>
                        <p className="mt-1 text-sm text-text-grey">
                            Review and manage notification campaigns.
                        </p>
                    </div>

                    <span className="text-sm text-text-grey">
                        {pagination.total} total
                    </span>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-ocean-green border-t-transparent" />
                        <p className="mt-4 text-sm text-text-grey">
                            Loading notifications...
                        </p>
                    </div>
                ) : filteredNotifications.length === 0 ? (
                    <div className="px-5 py-16 text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-aqua-spring text-ocean-green">
                            <i className="fa-regular fa-bell-slash text-2xl" />
                        </div>

                        <h3 className="mt-4 font-bold text-cyprus">
                            No notifications found
                        </h3>

                        <p className="mt-1 text-sm text-text-grey">
                            Create a notification or change your search filters.
                        </p>

                        <button
                            type="button"
                            onClick={openCreateForm}
                            className="mt-5 rounded-xl bg-ocean-green px-5 py-3 font-semibold text-white transition hover:bg-cyprus"
                        >
                            <i className="fa-solid fa-plus mr-2" />
                            Create Notification
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="divide-y divide-gray-100">
                            {filteredNotifications.map((notification) => {
                                const canEdit = [
                                    "draft",
                                    "scheduled",
                                ].includes(notification.status);

                                return (
                                    <div
                                        key={notification.id}
                                        className="p-5 transition hover:bg-gray-50/70"
                                    >
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="flex min-w-0 flex-1 gap-4">
                                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-aqua-spring text-ocean-green">
                                                    <i className="fa-solid fa-bell text-lg" />
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="break-words font-bold text-cyprus">
                                                            {notification.title}
                                                        </h3>

                                                        <span
                                                            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                                                                STATUS_STYLES[
                                                                    notification.status
                                                                ] ||
                                                                "bg-gray-100 text-gray-700"
                                                            }`}
                                                        >
                                                            {notification.status ||
                                                                "Unknown"}
                                                        </span>
                                                    </div>

                                                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-text-grey">
                                                        {notification.message}
                                                    </p>

                                                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-grey">
                                                        <span>
                                                            <i className="fa-solid fa-tag mr-1.5" />
                                                            {notification.type}
                                                        </span>

                                                        <span>
                                                            <i className="fa-regular fa-calendar mr-1.5" />
                                                            {formatDate(
                                                                notification.created_at
                                                            )}
                                                        </span>

                                                        {notification.status ===
                                                            "scheduled" &&
                                                            notification.scheduled_at && (
                                                                <span className="text-blue-700">
                                                                    <i className="fa-solid fa-clock mr-1.5" />
                                                                    Scheduled:{" "}
                                                                    {formatDate(
                                                                        notification.scheduled_at
                                                                    )}
                                                                </span>
                                                            )}

                                                        {notification.status ===
                                                            "published" && (
                                                                <span className="text-green-700">
                                                                    <i className="fa-solid fa-users mr-1.5" />
                                                                    Recipients:{" "}
                                                                    {notification.recipient_count ??
                                                                        0}
                                                                </span>
                                                            )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-2 lg:justify-end">
                                                {canEdit && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                openEditForm(
                                                                    notification
                                                                )
                                                            }
                                                            title="Edit notification"
                                                            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-cyprus transition hover:border-ocean-green hover:bg-aqua-spring/40"
                                                        >
                                                            <i className="fa-solid fa-pen" />
                                                            Edit
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                openActionModal(
                                                                    notification,
                                                                    "schedule"
                                                                )
                                                            }
                                                            title="Schedule notification"
                                                            className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                                                        >
                                                            <i className="fa-regular fa-calendar" />
                                                            Schedule
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                openActionModal(
                                                                    notification,
                                                                    "publish"
                                                                )
                                                            }
                                                            title="Publish notification"
                                                            className="inline-flex items-center gap-2 rounded-lg bg-ocean-green px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyprus"
                                                        >
                                                            <i className="fa-solid fa-paper-plane" />
                                                            Publish
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                openActionModal(
                                                                    notification,
                                                                    "delete"
                                                                )
                                                            }
                                                            title="Delete notification"
                                                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-600 hover:text-white"
                                                        >
                                                            <i className="fa-solid fa-trash-can" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Pagination */}
                        <div className="flex flex-col items-center justify-between gap-4 border-t border-gray-100 px-5 py-4 sm:flex-row">
                            <p className="text-sm text-text-grey">
                                Showing{" "}
                                {pagination.total === 0
                                    ? 0
                                    : (currentPage - 1) * PAGE_SIZE + 1}
                                {" "}to{" "}
                                {Math.min(
                                    currentPage * PAGE_SIZE,
                                    pagination.total
                                )}{" "}
                                of {pagination.total} notifications
                            </p>

                            <div className="flex flex-wrap items-center justify-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => changePage(currentPage - 1)}
                                    disabled={currentPage === 1 || loading}
                                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-cyprus transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <i className="fa-solid fa-chevron-left text-xs" />
                                    Previous
                                </button>

                                {Array.from(
                                    { length: totalPages },
                                    (_, index) => index + 1
                                )
                                    .filter((page) => {
                                        return (
                                            page === 1 ||
                                            page === totalPages ||
                                            Math.abs(page - currentPage) <= 1
                                        );
                                    })
                                    .map((page, index, pages) => (
                                        <React.Fragment key={page}>
                                            {index > 0 &&
                                                page - pages[index - 1] > 1 && (
                                                    <span className="px-1 text-gray-400">
                                                        ...
                                                    </span>
                                                )}

                                            <button
                                                type="button"
                                                onClick={() => changePage(page)}
                                                disabled={loading}
                                                aria-current={
                                                    currentPage === page
                                                        ? "page"
                                                        : undefined
                                                }
                                                className={`h-10 min-w-10 rounded-lg px-3 text-sm font-semibold transition ${
                                                    currentPage === page
                                                        ? "bg-ocean-green text-white shadow-sm"
                                                        : "border border-gray-200 text-cyprus hover:bg-aqua-spring/40"
                                                }`}
                                            >
                                                {page}
                                            </button>
                                        </React.Fragment>
                                    ))}

                                <button
                                    type="button"
                                    onClick={() => changePage(currentPage + 1)}
                                    disabled={
                                        currentPage === totalPages || loading
                                    }
                                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-cyprus transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Next
                                    <i className="fa-solid fa-chevron-right text-xs" />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Create / Edit Popup */}
            {showForm && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closeForm();
                        }
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="notification-form-title"
                        className="my-auto w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl"
                    >
                        <div className="flex items-center justify-between bg-ocean-green px-6 py-5 text-white">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                                    <i
                                        className={`fa-solid ${
                                            editingNotification
                                                ? "fa-pen-to-square"
                                                : "fa-bell"
                                        } text-lg`}
                                    />
                                </div>

                                <div>
                                    <h2
                                        id="notification-form-title"
                                        className="text-xl font-bold"
                                    >
                                        {editingNotification
                                            ? "Edit Notification"
                                            : "Create Notification"}
                                    </h2>
                                    <p className="mt-1 text-sm text-white/80">
                                        {editingNotification
                                            ? "Update your draft notification."
                                            : "Create a new notification campaign."}
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={closeForm}
                                disabled={saving}
                                aria-label="Close popup"
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/15 hover:text-white disabled:opacity-50"
                            >
                                <i className="fa-solid fa-xmark text-xl" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6">
                            {formError && (
                                <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                    <i className="fa-solid fa-circle-exclamation mt-0.5" />
                                    <p>{formError}</p>
                                </div>
                            )}

                            <div className="space-y-5">
                                <div>
                                    <label
                                        htmlFor="notification-type"
                                        className="mb-2 block text-sm font-semibold text-cyprus"
                                    >
                                        Notification Type
                                        <span className="ml-1 text-red-500">*</span>
                                    </label>

                                    <select
                                        id="notification-type"
                                        name="type"
                                        value={form.type}
                                        onChange={handleFormChange}
                                        required
                                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-ocean-green focus:ring-4 focus:ring-ocean-green/10"
                                    >
                                        <option value="general">General</option>
                                        <option value="promotion">Promotion</option>
                                        <option value="order">Order Update</option>
                                        <option value="product">Product Update</option>
                                        <option value="account">Account Update</option>
                                        <option value="system">System</option>
                                    </select>
                                </div>

                                <div>
                                    <label
                                        htmlFor="notification-title"
                                        className="mb-2 block text-sm font-semibold text-cyprus"
                                    >
                                        Notification Title
                                        <span className="ml-1 text-red-500">*</span>
                                    </label>

                                    <input
                                        id="notification-title"
                                        type="text"
                                        name="title"
                                        value={form.title}
                                        onChange={handleFormChange}
                                        maxLength={255}
                                        required
                                        placeholder="Enter notification title"
                                        className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition placeholder:text-gray-400 focus:border-ocean-green focus:ring-4 focus:ring-ocean-green/10"
                                    />

                                    <p className="mt-1.5 text-right text-xs text-text-grey">
                                        {form.title.length}/255
                                    </p>
                                </div>

                                <div>
                                    <label
                                        htmlFor="notification-message"
                                        className="mb-2 block text-sm font-semibold text-cyprus"
                                    >
                                        Notification Message
                                        <span className="ml-1 text-red-500">*</span>
                                    </label>

                                    <textarea
                                        id="notification-message"
                                        name="message"
                                        value={form.message}
                                        onChange={handleFormChange}
                                        required
                                        rows={5}
                                        maxLength={65000}
                                        placeholder="Write your notification message..."
                                        className="w-full resize-y rounded-xl border border-gray-200 px-4 py-3 outline-none transition placeholder:text-gray-400 focus:border-ocean-green focus:ring-4 focus:ring-ocean-green/10"
                                    />

                                    <p className="mt-1.5 text-right text-xs text-text-grey">
                                        {form.message.length}/65000
                                    </p>
                                </div>
                            </div>

                            <div className="mt-7 flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    onClick={closeForm}
                                    disabled={saving}
                                    className="rounded-xl border border-gray-200 px-5 py-3 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-ocean-green px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-cyprus disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {saving ? (
                                        <>
                                            <i className="fa-solid fa-spinner animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-floppy-disk" />
                                            {editingNotification
                                                ? "Update Notification"
                                                : "Save as Draft"}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Center Action Popup */}
            {selectedNotification && modalAction && (
                <div
                    className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closeActionModal();
                        }
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="notification-action-title"
                        className="my-auto w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
                    >
                        <div className="p-6 text-center">
                            <div
                                className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${
                                    modalAction === "delete"
                                        ? "bg-red-100 text-red-600"
                                        : modalAction === "schedule"
                                        ? "bg-blue-100 text-blue-600"
                                        : "bg-aqua-spring text-ocean-green"
                                }`}
                            >
                                <i
                                    className={`fa-solid ${actionDetails.icon} text-2xl`}
                                />
                            </div>

                            <h2
                                id="notification-action-title"
                                className="mt-5 text-xl font-bold text-cyprus"
                            >
                                {actionDetails.title}
                            </h2>

                            <p className="mt-2 text-sm leading-6 text-text-grey">
                                {actionDetails.description}
                            </p>

                            <div className="mt-4 rounded-xl bg-gray-50 p-4 text-left">
                                <p className="text-xs font-semibold uppercase tracking-wide text-text-grey">
                                    Notification
                                </p>
                                <p className="mt-1 break-words font-semibold text-cyprus">
                                    {selectedNotification.title}
                                </p>
                            </div>

                            {modalAction === "schedule" && (
                                <div className="mt-5 text-left">
                                    <label
                                        htmlFor="schedule-date"
                                        className="mb-2 block text-sm font-semibold text-cyprus"
                                    >
                                        Schedule Date & Time
                                    </label>

                                    <input
                                        id="schedule-date"
                                        type="datetime-local"
                                        value={scheduleDate}
                                        onChange={(event) =>
                                            setScheduleDate(event.target.value)
                                        }
                                        min={(() => {
                                            const date = new Date(
                                                Date.now() -
                                                    new Date().getTimezoneOffset() *
                                                        60000
                                            );

                                            return date
                                                .toISOString()
                                                .slice(0, 16);
                                        })()}
                                        className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-ocean-green focus:ring-4 focus:ring-ocean-green/10"
                                    />
                                </div>
                            )}

                            {actionError && (
                                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-left text-sm text-red-700">
                                    <i className="fa-solid fa-circle-exclamation mr-2" />
                                    {actionError}
                                </div>
                            )}

                            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row">
                                <button
                                    type="button"
                                    onClick={closeActionModal}
                                    disabled={actionLoading}
                                    className="flex-1 rounded-xl border border-gray-200 px-4 py-3 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    onClick={handleNotificationAction}
                                    disabled={actionLoading}
                                    className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${actionDetails.color}`}
                                >
                                    {actionLoading ? (
                                        <>
                                            <i className="fa-solid fa-spinner animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <i
                                                className={`fa-solid ${actionDetails.icon}`}
                                            />
                                            {actionDetails.button}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Notifications;