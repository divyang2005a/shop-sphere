import React, { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL = "http://192.168.1.10:5000/api/admin";
const PAGE_LIMIT = 20;

function ActivityLogs() {
    const [logs, setLogs] = useState([]);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: PAGE_LIMIT,
        total: 0,
        total_pages: 0,
    });

    const [search, setSearch] = useState("");
    const [actionFilter, setActionFilter] = useState("All");
    const [entityFilter, setEntityFilter] = useState("All");
    const [adminId, setAdminId] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [selectedLog, setSelectedLog] = useState(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchLogs = useCallback(async (page = 1) => {
        setLoading(true);
        setError("");

        try {
            const token = localStorage.getItem("shopsphereToken");

            const params = new URLSearchParams({
                page: String(page),
                limit: String(PAGE_LIMIT),
            });

            if (adminId.trim()) {
                params.set("admin_id", adminId.trim());
            }

            if (actionFilter !== "All") {
                params.set("action", actionFilter);
            }

            if (entityFilter !== "All") {
                params.set("entity_type", entityFilter);
            }

            if (fromDate) {
                params.set("from", fromDate);
            }

            if (toDate) {
                params.set("to", toDate);
            }

            const response = await fetch(
                `${API_BASE_URL}/activity-logs?${params.toString()}`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                }
            );

            const result = await response.json();

            if (!response.ok || result.success === false) {
                throw new Error(
                    result.message || "Failed to fetch activity logs"
                );
            }

            const responseData = result.data || {};

            setLogs(Array.isArray(responseData.logs) ? responseData.logs : []);

            setPagination({
                page: Number(responseData.pagination?.page) || page,
                limit: Number(responseData.pagination?.limit) || PAGE_LIMIT,
                total: Number(responseData.pagination?.total) || 0,
                total_pages: Number(responseData.pagination?.total_pages) || 0,
            });
        } catch (err) {
            setLogs([]);
            setPagination({
                page: 1,
                limit: PAGE_LIMIT,
                total: 0,
                total_pages: 0,
            });
            setError(err.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    }, [adminId, actionFilter, entityFilter, fromDate, toDate]);

    useEffect(() => {
        fetchLogs(1);
    }, [fetchLogs]);

    const today = new Date().toISOString().slice(0, 10);

    const todayCount = useMemo(() => {
        return logs.filter((log) => {
            if (!log.created_at) return false;

            const logDate = new Date(log.created_at);

            return (
                !Number.isNaN(logDate.getTime()) &&
                logDate.toDateString() === new Date().toDateString()
            );
        }).length;
    }, [logs]);

    const createdCount = useMemo(
        () => logs.filter((log) => /create|add|insert/i.test(log.action || "")).length,
        [logs]
    );

    const updatedCount = useMemo(
        () => logs.filter((log) => /update|edit|change/i.test(log.action || "")).length,
        [logs]
    );

    const filteredLogs = useMemo(() => {
        const query = search.trim().toLowerCase();

        if (!query) return logs;

        return logs.filter((log) => {
            const searchable = [
                log.id,
                log.admin_id,
                log.admin_name,
                log.admin_email,
                log.action,
                log.entity_type,
                log.entity_id,
                log.ip_address,
                log.old_values,
                log.new_values,
            ]
                .map((value) => {
                    if (value === null || value === undefined) return "";

                    return typeof value === "object"
                        ? JSON.stringify(value)
                        : String(value);
                })
                .join(" ")
                .toLowerCase();

            return searchable.includes(query);
        });
    }, [logs, search]);

    const getActionStyle = (action = "") => {
        const value = action.toLowerCase();

        if (/delete|remove|cancel/.test(value)) {
            return "bg-red-100 text-red-700";
        }

        if (/create|add|insert/.test(value)) {
            return "bg-green-100 text-green-700";
        }

        if (/update|edit|change/.test(value)) {
            return "bg-blue-100 text-blue-700";
        }

        if (/login|logout|auth/.test(value)) {
            return "bg-purple-100 text-purple-700";
        }

        return "bg-gray-100 text-gray-700";
    };

    const getActionIcon = (action = "") => {
        const value = action.toLowerCase();

        if (/delete|remove|cancel/.test(value)) return "fa-trash";
        if (/create|add|insert/.test(value)) return "fa-circle-plus";
        if (/update|edit|change/.test(value)) return "fa-pen-to-square";
        if (/login/.test(value)) return "fa-right-to-bracket";
        if (/logout/.test(value)) return "fa-right-from-bracket";

        return "fa-clock";
    };

    const formatDate = (date) => {
        if (!date) return "—";

        const parsedDate = new Date(date);

        if (Number.isNaN(parsedDate.getTime())) return String(date);

        return parsedDate.toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const formatJson = (value) => {
        if (value === null || value === undefined || value === "") {
            return "No data available";
        }

        if (typeof value === "object") {
            return JSON.stringify(value, null, 2);
        }

        if (typeof value === "string") {
            try {
                return JSON.stringify(JSON.parse(value), null, 2);
            } catch {
                return value;
            }
        }

        return String(value);
    };

    const exportCSV = () => {
        if (!filteredLogs.length) return;

        const headers = [
            "Log ID",
            "Admin ID",
            "Admin Name",
            "Admin Email",
            "Action",
            "Entity Type",
            "Entity ID",
            "IP Address",
            "Old Values",
            "New Values",
            "Date & Time",
        ];

        const escapeCSV = (value) =>
            `"${String(value ?? "").replace(/"/g, '""')}"`;

        const rows = filteredLogs.map((log) => [
            log.id,
            log.admin_id,
            log.admin_name,
            log.admin_email,
            log.action,
            log.entity_type,
            log.entity_id,
            log.ip_address,
            formatJson(log.old_values),
            formatJson(log.new_values),
            formatDate(log.created_at),
        ]);

        const csvContent = [headers, ...rows]
            .map((row) => row.map(escapeCSV).join(","))
            .join("\r\n");

        const blob = new Blob(
            ["\uFEFF" + csvContent],
            { type: "text/csv;charset=utf-8;" }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = "shopsphere-activity-logs.csv";

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);
    };

    const resetFilters = () => {
        setSearch("");
        setActionFilter("All");
        setEntityFilter("All");
        setAdminId("");
        setFromDate("");
        setToDate("");
    };

    const hasFilters =
        search.trim() !== "" ||
        actionFilter !== "All" ||
        entityFilter !== "All" ||
        adminId.trim() !== "" ||
        fromDate !== "" ||
        toDate !== "";

    const changePage = (page) => {
        if (
            page < 1 ||
            page > pagination.total_pages ||
            page === pagination.page
        ) {
            return;
        }

        fetchLogs(page);
    };

    return (
        <div className="min-h-full bg-aqua-spring p-4 sm:p-6 lg:p-8">
            {/* Header */}
            <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-cyprus sm:text-3xl">
                        Activity Logs
                    </h1>

                    <p className="mt-1 text-sm text-text-grey">
                        Track administrative activities and system events.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={exportCSV}
                        disabled={filteredLogs.length === 0 || loading}
                        className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <i className="fa-solid fa-download"></i>
                        Export CSV
                    </button>

                    <button
                        onClick={() => fetchLogs(pagination.page)}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                    >
                        <i className={`fa-solid fa-rotate-right ${loading ? "animate-spin" : ""}`}></i>
                        Refresh
                    </button>
                </div>
            </div>

            {/* Statistics */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    title="Total Activities"
                    value={pagination.total}
                    icon="fa-clock-rotate-left"
                    color="bg-purple-100 text-purple-600"
                />

                <StatCard
                    title="Today's Activities"
                    value={todayCount}
                    icon="fa-calendar-day"
                    color="bg-blue-100 text-blue-600"
                />

                <StatCard
                    title="Created"
                    value={createdCount}
                    icon="fa-circle-plus"
                    color="bg-green-100 text-green-600"
                />

                <StatCard
                    title="Updated"
                    value={updatedCount}
                    icon="fa-pen-to-square"
                    color="bg-orange-100 text-orange-600"
                />
            </div>

            {/* Filters */}
            <div className="mb-5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-center gap-2">
                    <i className="fa-solid fa-filter text-brand-primary"></i>
                    <h2 className="font-bold text-cyprus">Filter Activities</h2>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <div className="relative">
                        <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>

                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search admin, action, entity..."
                            className="w-full rounded-xl border border-gray-200 py-3 pl-11 pr-4 outline-none transition focus:border-brand-primary"
                        />
                    </div>

                    <input
                        type="number"
                        min="1"
                        value={adminId}
                        onChange={(e) => setAdminId(e.target.value)}
                        placeholder="Filter by Admin ID"
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-brand-primary"
                    />

                    <input
                        type="text"
                        value={actionFilter === "All" ? "" : actionFilter}
                        onChange={(e) =>
                            setActionFilter(e.target.value.trim() || "All")
                        }
                        placeholder="Filter action (e.g. update)"
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-brand-primary"
                    />

                    <input
                        type="text"
                        value={entityFilter === "All" ? "" : entityFilter}
                        onChange={(e) =>
                            setEntityFilter(e.target.value.trim() || "All")
                        }
                        placeholder="Filter entity type"
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-brand-primary"
                    />

                    <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-500">
                            From Date
                        </label>
                        <input
                            type="date"
                            value={fromDate}
                            max={toDate || undefined}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-brand-primary"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-500">
                            To Date
                        </label>
                        <input
                            type="date"
                            value={toDate}
                            min={fromDate || undefined}
                            max={today}
                            onChange={(e) => setToDate(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-brand-primary"
                        />
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-gray-500">
                        Showing {filteredLogs.length} activities on this page
                        {" "}·{" "}
                        {pagination.total} total activities
                    </p>

                    {hasFilters && (
                        <button
                            onClick={resetFilters}
                            className="text-sm font-semibold text-brand-primary hover:underline"
                        >
                            Reset Filters
                        </button>
                    )}
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="mb-5 flex flex-col justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center">
                    <div className="flex items-start gap-3 text-red-700">
                        <i className="fa-solid fa-circle-exclamation mt-1"></i>
                        <div>
                            <p className="font-semibold">Unable to load activity logs</p>
                            <p className="mt-1 break-words text-sm">{error}</p>
                        </div>
                    </div>

                    <button
                        onClick={() => fetchLogs(pagination.page)}
                        className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Desktop Table */}
            <div className="hidden overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm md:block">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1050px] text-left">
                        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                            <tr>
                                <th className="px-5 py-4">Log / Admin</th>
                                <th className="px-5 py-4">Action</th>
                                <th className="px-5 py-4">Entity</th>
                                <th className="px-5 py-4">IP Address</th>
                                <th className="px-5 py-4">Date & Time</th>
                                <th className="px-5 py-4 text-center">Details</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100">
                            {!loading && filteredLogs.map((log) => (
                                <tr key={log.id} className="transition hover:bg-gray-50">
                                    <td className="px-5 py-4">
                                        <p className="font-semibold text-gray-800">
                                            {log.admin_name || "Unknown Admin"}
                                        </p>

                                        <p className="mt-1 text-xs text-gray-500">
                                            Log #{log.id} · Admin ID: {log.admin_id ?? "—"}
                                        </p>

                                        <p className="mt-1 text-xs text-gray-500">
                                            {log.admin_email || "No email"}
                                        </p>
                                    </td>

                                    <td className="px-5 py-4">
                                        <div className="flex items-start gap-3">
                                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${getActionStyle(log.action)}`}>
                                                <i className={`fa-solid ${getActionIcon(log.action)}`}></i>
                                            </span>

                                            <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getActionStyle(log.action)}`}>
                                                {log.action || "Unknown"}
                                            </span>
                                        </div>
                                    </td>

                                    <td className="px-5 py-4">
                                        <p className="font-semibold text-gray-700">
                                            {log.entity_type || "—"}
                                        </p>
                                        <p className="mt-1 text-xs text-gray-500">
                                            Entity ID: {log.entity_id ?? "—"}
                                        </p>
                                    </td>

                                    <td className="px-5 py-4 text-sm text-gray-600">
                                        {log.ip_address || "—"}
                                    </td>

                                    <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">
                                        {formatDate(log.created_at)}
                                    </td>

                                    <td className="px-5 py-4 text-center">
                                        <button
                                            onClick={() => setSelectedLog(log)}
                                            title="View details"
                                            aria-label={`View log ${log.id}`}
                                            className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition hover:bg-blue-100"
                                        >
                                            <i className="fa-solid fa-eye"></i>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {loading && <LoadingState />}

                    {!loading && !error && filteredLogs.length === 0 && <EmptyState />}
                </div>
            </div>

            {/* Mobile Cards */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
                {loading ? (
                    <LoadingState />
                ) : filteredLogs.length === 0 ? (
                    <EmptyState />
                ) : (
                    filteredLogs.map((log) => (
                        <div
                            key={log.id}
                            className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
                        >
                            <div className="flex items-start gap-3">
                                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${getActionStyle(log.action)}`}>
                                    <i className={`fa-solid ${getActionIcon(log.action)}`}></i>
                                </span>

                                <div className="min-w-0 flex-1">
                                    <h3 className="break-words font-bold text-gray-800">
                                        {log.action || "Unknown Action"} · {log.entity_type || "Unknown Entity"}
                                    </h3>

                                    <p className="mt-1 break-words text-sm text-gray-500">
                                        {log.admin_name || "Unknown Admin"}
                                    </p>

                                    <p className="mt-1 text-xs text-gray-400">
                                        Log #{log.id} · Admin ID: {log.admin_id ?? "—"}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                                <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${getActionStyle(log.action)}`}>
                                    {log.action || "Unknown"}
                                </span>

                                <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700">
                                    Entity ID: {log.entity_id ?? "—"}
                                </span>
                            </div>

                            <div className="mt-4 space-y-2 text-sm text-gray-500">
                                <p className="break-words">
                                    <i className="fa-solid fa-envelope mr-2 w-4"></i>
                                    {log.admin_email || "No email"}
                                </p>

                                <p className="break-words">
                                    <i className="fa-solid fa-globe mr-2 w-4"></i>
                                    {log.ip_address || "IP unavailable"}
                                </p>

                                <p>
                                    <i className="fa-solid fa-calendar mr-2 w-4"></i>
                                    {formatDate(log.created_at)}
                                </p>
                            </div>

                            <button
                                onClick={() => setSelectedLog(log)}
                                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-50 py-2.5 text-sm font-semibold text-blue-600 transition hover:bg-blue-100"
                            >
                                <i className="fa-solid fa-eye"></i>
                                View Details
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Pagination */}
            {!loading && !error && pagination.total_pages > 0 && (
                <div className="mt-5 flex flex-col items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-white p-4 sm:flex-row">
                    <p className="text-sm text-gray-500">
                        Page {pagination.page} of {pagination.total_pages}
                        {" "}·{" "}
                        {pagination.total} records
                    </p>

                    <div className="flex items-center justify-center gap-2">
                        <button
                            onClick={() => changePage(pagination.page - 1)}
                            disabled={pagination.page <= 1}
                            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <i className="fa-solid fa-chevron-left mr-2"></i>
                            Previous
                        </button>

                        <span className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-white">
                            {pagination.page}
                        </span>

                        <button
                            onClick={() => changePage(pagination.page + 1)}
                            disabled={pagination.page >= pagination.total_pages}
                            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Next
                            <i className="fa-solid fa-chevron-right ml-2"></i>
                        </button>
                    </div>
                </div>
            )}

            {/* Details Modal */}
            {selectedLog && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
                    onClick={() => setSelectedLog(null)}
                >
                    <div
                        className="my-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-5 flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-xl font-bold text-cyprus">
                                    Activity Details
                                </h2>
                                <p className="mt-1 text-sm text-gray-500">
                                    Log #{selectedLog.id}
                                </p>
                            </div>

                            <button
                                onClick={() => setSelectedLog(null)}
                                aria-label="Close details"
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        <div className="mb-5 flex items-start gap-3">
                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${getActionStyle(selectedLog.action)}`}>
                                <i className={`fa-solid ${getActionIcon(selectedLog.action)} text-lg`}></i>
                            </div>

                            <div className="min-w-0">
                                <h3 className="break-words font-bold text-gray-800">
                                    {selectedLog.action || "Unknown Action"} · {selectedLog.entity_type || "Unknown Entity"}
                                </h3>
                                <p className="mt-1 break-words text-sm text-gray-500">
                                    {selectedLog.admin_name || "Unknown Admin"}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4 rounded-xl bg-gray-50 p-4 text-sm">
                            <DetailRow label="Log ID" value={selectedLog.id} />
                            <DetailRow label="Admin ID" value={selectedLog.admin_id} />
                            <DetailRow label="Admin Name" value={selectedLog.admin_name} />
                            <DetailRow label="Admin Email" value={selectedLog.admin_email} />
                            <DetailRow label="Action" value={selectedLog.action} />
                            <DetailRow label="Entity Type" value={selectedLog.entity_type} />
                            <DetailRow label="Entity ID" value={selectedLog.entity_id} />
                            <DetailRow label="IP Address" value={selectedLog.ip_address} />
                            <DetailRow label="Date & Time" value={formatDate(selectedLog.created_at)} />
                        </div>

                        <JsonSection
                            title="Old Values"
                            value={selectedLog.old_values}
                        />

                        <JsonSection
                            title="New Values"
                            value={selectedLog.new_values}
                        />

                        <button
                            onClick={() => setSelectedLog(null)}
                            className="mt-5 w-full rounded-xl bg-brand-primary px-4 py-3 font-semibold text-white transition hover:opacity-90"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );

}

function StatCard({ title, value, icon, color }) {
    return (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm text-gray-500">{title}</p>
                    <h3 className="mt-2 text-3xl font-bold text-cyprus">
                        {value}
                    </h3>
                </div>

                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${color}`}>
                    <i className={`fa-solid ${icon} text-xl`}></i>
                </div>
            </div>
        </div>
    );

}

function DetailRow({ label, value }) {
    return (
        <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
            <span className="text-gray-500">{label}</span>
            <span className="break-words font-semibold text-gray-800 sm:text-right">
                {value === null || value === undefined || value === ""
                    ? "—"
                    : String(value)}
            </span>
        </div>
    );
}

function JsonSection({ title, value }) {
    const formattedValue = (() => {
        if (value === null || value === undefined || value === "") {
            return "No data available";
        }

        if (typeof value === "object") {
            return JSON.stringify(value, null, 2);
        }

        if (typeof value === "string") {
            try {
                return JSON.stringify(JSON.parse(value), null, 2);
            } catch {
                return value;
            }
        }

        return String(value);
    })();

    return (
        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                <h3 className="font-semibold text-gray-700">{title}</h3>
            </div>

            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words p-4 text-xs leading-5 text-gray-700">
                {formattedValue}
            </pre>
        </div>
    );

}

function LoadingState() {
    return (
        <div className="px-5 py-12 text-center">
            <i className="fa-solid fa-spinner mb-3 animate-spin text-3xl text-brand-primary"></i>
            <p className="font-semibold text-gray-600">
                Loading activity logs...
            </p>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="px-5 py-12 text-center">
            <i className="fa-solid fa-clock-rotate-left mb-3 text-3xl text-gray-300"></i>
            <p className="font-semibold text-gray-600">
                No activity logs found
            </p>
            <p className="mt-1 text-sm text-gray-400">
                Try changing your search or filters.
            </p>
        </div>
    );
}

export default ActivityLogs;