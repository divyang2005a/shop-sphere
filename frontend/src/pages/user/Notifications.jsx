
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Pagination from "../../components/Pagination";

const API_URL = "http://192.168.1.20:5000/api/notifications";
const PAGE_SIZE = 10;

function Notifications({
    mode = "page",
    isOpen = true,
    onClose = () => {},
    onUnreadCountChange,
}) {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [filter, setFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [markingNotificationIds, setMarkingNotificationIds] = useState([]);
    const [markingAllRead, setMarkingAllRead] = useState(false);

    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const token = localStorage.getItem("shopsphereToken");

            const response = await fetch(API_URL, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    ...(token && {
                        Authorization: `Bearer ${token}`,
                    }),
                },
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    result.message || "Failed to load notifications."
                );
            }

            // Supports common API response formats
            const list = Array.isArray(result)
                ? result
                : Array.isArray(result.data)
                ? result.data
                : Array.isArray(result.data?.notifications)
                ? result.data.notifications
                : Array.isArray(result.notifications)
                ? result.notifications
                : [];

            setNotifications(list);
        } catch (err) {
            console.error("Notifications API Error:", err);
            setError(
                err.message ||
                    "Unable to load notifications. Please try again."
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const isUnread = (notification) => {
        if (typeof notification.is_read === "boolean") {
            return !notification.is_read;
        }

        if (typeof notification.is_read === "number") {
            return notification.is_read === 0;
        }

        if (typeof notification.is_read === "string") {
            return ["0", "false", "unread"].includes(
                notification.is_read.toLowerCase()
            );
        }

        if (typeof notification.read === "boolean") {
            return !notification.read;
        }

        const status = String(
            notification.status || notification.read_status || ""
        ).toLowerCase();

        if (status) {
            return ["unread", "pending", "new"].includes(status);
        }

        // Unknown read status: do not assume it is unread.
        return false;
    };

    const unreadCount = useMemo(
        () => notifications.filter(isUnread).length,
        [notifications]
    );

    const markAsRead = async (notification) => {
        const notificationId =
            notification.id ?? notification.notification_id;

        if (notificationId == null) {
            setError("Unable to mark this notification as read.");
            return;
        }

        setMarkingNotificationIds((current) => [
            ...current,
            String(notificationId),
        ]);
        setError("");

        try {
            const token = localStorage.getItem("shopsphereToken");
            const response = await fetch(
                `${API_URL}/${encodeURIComponent(notificationId)}/read`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        ...(token && {
                            Authorization: ["Bearer", token].join(" "),
                        }),
                    },
                }
            );
            const result = await response.json().catch(() => ({}));

            if (!response.ok || result.success === false) {
                throw new Error(
                    result.message || "Failed to mark notification as read."
                );
            }

            setNotifications((current) =>
                current.map((item) =>
                    String(item.id ?? item.notification_id) ===
                    String(notificationId)
                        ? { ...item, is_read: true, read: true }
                        : item
                )
            );
        } catch (err) {
            setError(
                err.message || "Unable to mark notification as read."
            );
        } finally {
            setMarkingNotificationIds((current) =>
                current.filter((id) => id !== String(notificationId))
            );
        }
    };

    const markAllAsRead = async () => {
        if (unreadCount === 0) {
            return;
        }

        setMarkingAllRead(true);
        setError("");

        try {
            const token = localStorage.getItem("shopsphereToken");
            const response = await fetch(`${API_URL}/read-all`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    ...(token && {
                        Authorization: ["Bearer", token].join(" "),
                    }),
                },
            });
            const result = await response.json().catch(() => ({}));

            if (!response.ok || result.success === false) {
                throw new Error(
                    result.message || "Failed to mark notifications as read."
                );
            }

            setNotifications((current) =>
                current.map((notification) => ({
                    ...notification,
                    is_read: true,
                    read: true,
                }))
            );
        } catch (err) {
            setError(
                err.message || "Unable to mark notifications as read."
            );
        } finally {
            setMarkingAllRead(false);
        }
    };

    useEffect(() => {
        onUnreadCountChange?.(unreadCount);
    }, [onUnreadCountChange, unreadCount]);

    const filteredNotifications = useMemo(() => {
        if (filter === "unread") {
            return notifications.filter(isUnread);
        }

        return notifications;
    }, [notifications, filter]);
    const totalPages = Math.max(
        1,
        Math.ceil(filteredNotifications.length / PAGE_SIZE)
    );
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const currentNotifications = filteredNotifications.slice(
        (safeCurrentPage - 1) * PAGE_SIZE,
        safeCurrentPage * PAGE_SIZE
    );

    const formatDate = (dateValue) => {
        if (!dateValue) return "Date unavailable";

        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
            return String(dateValue);
        }

        return date.toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getNotificationIcon = (notification) => {
        const type = String(
            notification.type || notification.notification_type || ""
        ).toLowerCase();

        if (type.includes("order")) {
            return "fa-box";
        }

        if (type.includes("payment")) {
            return "fa-credit-card";
        }

        if (type.includes("deliver") || type.includes("ship")) {
            return "fa-truck";
        }

        if (type.includes("offer") || type.includes("promo")) {
            return "fa-tag";
        }

        if (type.includes("account") || type.includes("profile")) {
            return "fa-user";
        }

        return "fa-bell";
    };

    if (mode === "popup") {
        if (!isOpen) {
            return null;
        }

        return (
            <section
                aria-label="Notifications"
                className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl"
            >
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                    <h2 className="font-bold text-cyprus">Notifications</h2>
                    <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                            <button
                                type="button"
                                onClick={markAllAsRead}
                                disabled={markingAllRead}
                                className="text-xs font-semibold text-ocean-green hover:underline disabled:opacity-50"
                            >
                                {markingAllRead
                                    ? "Marking..."
                                    : "Mark all read"}
                            </button>
                        )}
                        <button
                            type="button"
                            aria-label="Close notifications"
                            onClick={onClose}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-text-grey hover:bg-gray-100"
                        >
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>

                <div className="max-h-96 overflow-y-auto">
                    {loading ? (
                        <p className="px-4 py-8 text-center text-sm text-text-grey">
                            Loading notifications...
                        </p>
                    ) : error ? (
                        <div className="px-4 py-6 text-center">
                            <p className="text-sm text-error">{error}</p>
                            <button
                                type="button"
                                onClick={fetchNotifications}
                                className="mt-3 text-sm font-semibold text-ocean-green hover:underline"
                            >
                                Try again
                            </button>
                        </div>
                    ) : filteredNotifications.length === 0 ? (
                        <p className="px-4 py-8 text-center text-sm text-text-grey">
                            No notifications yet.
                        </p>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {filteredNotifications
                                .slice(0, 5)
                                .map((notification, index) => {
                                    const title =
                                        notification.title ||
                                        notification.subject ||
                                        notification.notification_title ||
                                        "Notification";
                                    const message =
                                        notification.message ||
                                        notification.description ||
                                        notification.body ||
                                        notification.notification_message ||
                                        "You have a new update.";
                                    const date =
                                        notification.created_at ||
                                        notification.createdAt ||
                                        notification.sent_at ||
                                        notification.date;

                                    return (
                                        <article
                                            key={
                                                notification.id ??
                                                notification.notification_id ??
                                                index
                                            }
                                            onClick={() => {
                                                if (isUnread(notification)) {
                                                    markAsRead(notification);
                                                }
                                            }}
                                            onKeyDown={(event) => {
                                                if (
                                                    event.target ===
                                                        event.currentTarget &&
                                                    ["Enter", " "].includes(
                                                        event.key
                                                    ) &&
                                                    isUnread(notification)
                                                ) {
                                                    event.preventDefault();
                                                    markAsRead(notification);
                                                }
                                            }}
                                            role={
                                                isUnread(notification)
                                                    ? "button"
                                                    : undefined
                                            }
                                            tabIndex={
                                                isUnread(notification) ? 0 : undefined
                                            }
                                            className={`flex gap-3 px-4 py-3 ${
                                                isUnread(notification)
                                                    ? "cursor-pointer bg-emerald-50/40 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ocean-green"
                                                    : ""
                                            }`}
                                        >
                                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-aqua-spring text-ocean-green">
                                                <i
                                                    className={`fa-solid ${getNotificationIcon(
                                                        notification
                                                    )}`}
                                                ></i>
                                            </span>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-cyprus">
                                                    {title}
                                                </p>
                                                <p className="line-clamp-2 text-xs text-text-grey">
                                                    {message}
                                                </p>
                                                <p className="mt-1 text-[11px] text-gray-400">
                                                    {formatDate(date)}
                                                </p>
                                            </div>
                                            {isUnread(notification) && (
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        markAsRead(notification)
                                                    }}
                                                    disabled={markingNotificationIds.includes(
                                                        String(
                                                            notification.id ??
                                                                notification.notification_id
                                                        )
                                                    )}
                                                    className="shrink-0 self-center text-[11px] font-semibold text-ocean-green hover:underline disabled:opacity-50"
                                                >
                                                    Mark read
                                                </button>
                                            )}
                                        </article>
                                    );
                                })}
                        </div>
                    )}
                </div>

                <Link
                    to="/notifications"
                    onClick={onClose}
                    className="block border-t border-gray-100 bg-gray-50 px-4 py-3 text-center text-sm font-semibold text-ocean-green hover:bg-aqua-spring"
                >
                    View all notifications
                </Link>
            </section>
        );
    }

    return (
        <div className="min-h-full bg-gray-50 p-3 sm:p-5 lg:p-8">
            <div className="mx-auto max-w-5xl">
                {/* Page Header */}
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="mb-2 flex items-center gap-2">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-aqua-spring text-ocean-green">
                                <i className="fa-regular fa-bell text-lg"></i>
                            </div>

                            <h1 className="text-xl font-bold text-cyprus sm:text-2xl">
                                Notifications
                            </h1>
                        </div>

                        <p className="text-sm text-text-grey">
                            Stay updated with your latest activity.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                            <button
                                type="button"
                                onClick={markAllAsRead}
                                disabled={markingAllRead}
                                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-ocean-green transition hover:border-ocean-green disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <i className="fa-solid fa-check-double" />
                                {markingAllRead
                                    ? "Marking..."
                                    : "Mark all as read"}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={fetchNotifications}
                            disabled={loading}
                            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-cyprus transition hover:border-ocean-green hover:text-ocean-green disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <i
                                className={`fa-solid fa-rotate-right ${
                                    loading ? "animate-spin" : ""
                                }`}
                            ></i>
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Summary */}
                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-text-grey">
                                    Total Notifications
                                </p>
                                <p className="mt-2 text-2xl font-bold text-cyprus">
                                    {notifications.length}
                                </p>
                            </div>

                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                                <i className="fa-solid fa-bell text-xl"></i>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-text-grey">
                                    Unread Notifications
                                </p>
                                <p className="mt-2 text-2xl font-bold text-ocean-green">
                                    {unreadCount}
                                </p>
                            </div>

                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-aqua-spring text-ocean-green">
                                <i className="fa-solid fa-envelope-open-text text-xl"></i>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Notification List */}
                <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4 sm:px-6">
                        <h2 className="font-bold text-cyprus">
                            Recent Activity
                        </h2>

                        <div className="flex rounded-lg bg-gray-100 p-1">
                            <button
                                type="button"
                                onClick={() => {
                                    setCurrentPage(1);
                                    setFilter("all");
                                }}
                                className={`rounded-md px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                                    filter === "all"
                                        ? "bg-white text-cyprus shadow-sm"
                                        : "text-text-grey hover:text-cyprus"
                                }`}
                            >
                                All
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setCurrentPage(1);
                                    setFilter("unread");
                                }}
                                className={`rounded-md px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                                    filter === "unread"
                                        ? "bg-white text-cyprus shadow-sm"
                                        : "text-text-grey hover:text-cyprus"
                                }`}
                            >
                                Unread ({unreadCount})
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center px-4 py-16">
                            <i className="fa-solid fa-spinner mb-3 animate-spin text-3xl text-ocean-green"></i>
                            <p className="text-sm text-text-grey">
                                Loading notifications...
                            </p>
                        </div>
                    ) : error ? (
                        <div className="px-4 py-14 text-center">
                            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-error">
                                <i className="fa-solid fa-triangle-exclamation text-xl"></i>
                            </div>

                            <h3 className="font-bold text-cyprus">
                                Something went wrong
                            </h3>

                            <p className="mx-auto mt-2 max-w-md text-sm text-text-grey">
                                {error}
                            </p>

                            <button
                                type="button"
                                onClick={fetchNotifications}
                                className="mt-5 rounded-lg bg-ocean-green px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                            >
                                Try Again
                            </button>
                        </div>
                    ) : filteredNotifications.length === 0 ? (
                        <div className="px-4 py-16 text-center">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                                <i className="fa-regular fa-bell-slash text-2xl"></i>
                            </div>

                            <h3 className="font-bold text-cyprus">
                                {filter === "unread"
                                    ? "No unread notifications"
                                    : "No notifications yet"}
                            </h3>

                            <p className="mt-2 text-sm text-text-grey">
                                {filter === "unread"
                                    ? "You are all caught up!"
                                    : "Your updates will appear here."}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {currentNotifications.map((notification, index) => {
                                const unread = isUnread(notification);

                                const title =
                                    notification.title ||
                                    notification.subject ||
                                    notification.notification_title ||
                                    "Notification";

                                const message =
                                    notification.message ||
                                    notification.description ||
                                    notification.body ||
                                    notification.notification_message ||
                                    "You have a new update.";

                                const date =
                                    notification.created_at ||
                                    notification.createdAt ||
                                    notification.sent_at ||
                                    notification.date;

                                return (
                                    <div
                                        key={
                                            notification.id ??
                                            notification.notification_id ??
                                            index
                                        }
                                        onClick={() => {
                                            if (unread) {
                                                markAsRead(notification);
                                            }
                                        }}
                                        onKeyDown={(event) => {
                                            if (
                                                event.target ===
                                                    event.currentTarget &&
                                                ["Enter", " "].includes(
                                                    event.key
                                                ) &&
                                                unread
                                            ) {
                                                event.preventDefault();
                                                markAsRead(notification);
                                            }
                                        }}
                                        role={unread ? "button" : undefined}
                                        tabIndex={unread ? 0 : undefined}
                                        className={`flex gap-3 p-4 transition hover:bg-gray-50 sm:gap-4 sm:px-6 ${
                                            unread
                                                ? "cursor-pointer bg-emerald-50/40 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ocean-green"
                                                : "bg-white"
                                        }`}
                                    >
                                        <div
                                            className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${
                                                unread
                                                    ? "bg-aqua-spring text-ocean-green"
                                                    : "bg-gray-100 text-gray-500"
                                            }`}
                                        >
                                            <i
                                                className={`fa-solid ${getNotificationIcon(
                                                    notification
                                                )} text-lg`}
                                            ></i>
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-start justify-between gap-2">
                                                <h3 className="break-words text-sm font-bold text-cyprus sm:text-base">
                                                    {title}
                                                </h3>

                                                {unread && (
                                                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700 sm:text-xs">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
                                                        Unread
                                                    </span>
                                                )}
                                            </div>

                                            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-text-grey">
                                                {message}
                                            </p>

                                            <p className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                                                <i className="fa-regular fa-clock"></i>
                                                {formatDate(date)}
                                            </p>

                                            {unread && (
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        markAsRead(notification)
                                                    }}
                                                    disabled={markingNotificationIds.includes(
                                                        String(
                                                            notification.id ??
                                                                notification.notification_id
                                                        )
                                                    )}
                                                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-ocean-green/20 px-3 py-1.5 text-xs font-semibold text-ocean-green transition hover:bg-aqua-spring disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    <i className="fa-solid fa-check" />
                                                    Mark as read
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {!loading && !error && mode === "page" && (
                        <Pagination
                            page={safeCurrentPage}
                            totalPages={totalPages}
                            totalItems={filteredNotifications.length}
                            pageSize={PAGE_SIZE}
                            itemLabel="notifications"
                            onPageChange={setCurrentPage}
                        />
                    )}
                    {!loading && !error && mode !== "page" && notifications.length > 0 && (
                        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 text-center text-xs text-text-grey">
                            Showing {filteredNotifications.length} of{" "}
                            {notifications.length} notifications
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Notifications;