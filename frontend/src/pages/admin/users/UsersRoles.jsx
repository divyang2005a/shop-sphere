import React, { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL = "http://192.168.1.20:5000/api/admin";
const ITEMS_PER_PAGE = 5;

function UsersRoles() {
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);

    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All");
    const [currentPage, setCurrentPage] = useState(1);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [selectedUser, setSelectedUser] = useState(null);
    const [userDetails, setUserDetails] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);

    const [updatingId, setUpdatingId] = useState(null);

    const token = localStorage.getItem("shopsphereToken");

    const getHeaders = useCallback(() => ({
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }), [token]);

    // Fetch users
    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const response = await fetch(`${API_BASE_URL}/users`, {
                method: "GET",
                headers: getHeaders(),
            });

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(data.message || "Failed to fetch users.");
            }

            const userList = Array.isArray(data)
                ? data
                : data.users || data.data || [];

            setUsers(userList);
        } catch (err) {
            setError(err.message || "Unable to load users.");
        } finally {
            setLoading(false);
        }
    }, [getHeaders]);

    // Fetch roles
    const fetchRoles = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/roles`, {
                method: "GET",
                headers: getHeaders(),
            });

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(data.message || "Failed to fetch roles.");
            }

            const roleList = Array.isArray(data)
                ? data
                : data.roles || data.data || [];

            setRoles(roleList);
        } catch (err) {
            console.error("Fetch roles error:", err);
        }
    }, [getHeaders]);

    useEffect(() => {
        fetchUsers();
        fetchRoles();
    }, [fetchUsers, fetchRoles]);

    // Helpers
    const getUserName = (user) =>
        user.name || user.full_name || user.username || "Unknown User";

    const getUserEmail = (user) =>
        user.email || user.email_address || "No email";

    const getUserStatus = (user) => {
        const status = String(user.status ?? "").toLowerCase();

        if (["active", "1", "true"].includes(status)) return "Active";

        if (["inactive", "0", "false", "blocked", "disabled"].includes(status)) {
            return "Inactive";
        }

        return user.status || "Unknown";
    };

    const getUserRoles = (user) => {
        if (Array.isArray(user.roles)) {
            return user.roles
                .map((role) => typeof role === "string" ? role : role.name)
                .filter(Boolean);
        }

        if (user.role && typeof user.role === "object") {
            return [user.role.name].filter(Boolean);
        }

        if (typeof user.role === "string" && user.role.trim()) {
            return [user.role];
        }

        return [];
    };

    const getInitials = (name) =>
        String(name || "U")
            .trim()
            .split(/\s+/)
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();

    const getRoleStyle = (role) => {
        const name = String(role || "").toLowerCase();

        if (name === "admin") return "bg-purple-100 text-purple-700";
        if (name === "manager") return "bg-blue-100 text-blue-700";
        if (name === "customer" || name === "user") {
            return "bg-orange-100 text-orange-700";
        }

        return "bg-gray-100 text-gray-700";
    };

    const getStatusStyle = (status) => {
        if (status === "Active") return "bg-green-100 text-green-700";
        if (status === "Inactive") return "bg-red-100 text-red-700";

        return "bg-gray-100 text-gray-700";
    };

    const getJoinedDate = (user) => {
        const date =
            user.created_at ||
            user.joined ||
            user.joined_at ||
            user.createdAt;

        if (!date) return "—";

        const parsedDate = new Date(date);

        if (Number.isNaN(parsedDate.getTime())) return "—";

        return parsedDate.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    // Statistics
    const activeUsers = users.filter(
        (user) => getUserStatus(user) === "Active"
    ).length;

    const inactiveUsers = users.filter(
        (user) => getUserStatus(user) === "Inactive"
    ).length;

    const totalAssignedUsers = roles.reduce(
        (total, role) => total + Number(role.assigned_users || 0),
        0
    );

    // Search and filters
    const filteredUsers = useMemo(() => {
        const query = search.trim().toLowerCase();

        return users.filter((user) => {
            const matchesSearch =
                String(user.id ?? "").toLowerCase().includes(query) ||
                getUserName(user).toLowerCase().includes(query) ||
                getUserEmail(user).toLowerCase().includes(query);

            const userRoles = getUserRoles(user);

            const matchesRole =
                roleFilter === "All" ||
                userRoles.some(
                    (role) =>
                        String(role).toLowerCase() === roleFilter.toLowerCase()
                );

            const matchesStatus =
                statusFilter === "All" ||
                getUserStatus(user) === statusFilter;

            return matchesSearch && matchesRole && matchesStatus;
        });
    }, [users, search, roleFilter, statusFilter]);

    useEffect(() => {
        setCurrentPage(1);
    }, [search, roleFilter, statusFilter]);

    const totalPages = Math.max(
        1,
        Math.ceil(filteredUsers.length / ITEMS_PER_PAGE)
    );

    const paginatedUsers = filteredUsers.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    // View user details
    const openUserDetails = async (user, showRoles = false) => {
        setSelectedUser(user);
        setUserDetails(null);
        setDetailsLoading(true);
        setError("");

        try {
            const endpoint = showRoles
                ? `${API_BASE_URL}/users/${user.id}/roles`
                : `${API_BASE_URL}/users/${user.id}`;

            const response = await fetch(endpoint, {
                method: "GET",
                headers: getHeaders(),
            });

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(data.message || "Failed to fetch user details.");
            }

            if (showRoles) {
                setUserDetails({
                    ...(data.user || user),
                    roles: data.roles || [],
                });
            } else {
                setUserDetails(data.user || data.data || data);
            }
        } catch (err) {
            setError(err.message || "Unable to load user details.");
        } finally {
            setDetailsLoading(false);
        }
    };

    // Update status
    const toggleStatus = async (user) => {
        const currentStatus = getUserStatus(user);

        if (!["Active", "Inactive"].includes(currentStatus)) {
            setError("This user's status cannot be changed.");
            return;
        }

        const nextStatus =
            currentStatus === "Active" ? "Inactive" : "Active";

        if (!window.confirm(
            `Are you sure you want to change ${getUserName(user)} to ${nextStatus}?`
        )) {
            return;
        }

        setUpdatingId(user.id);
        setError("");
        setSuccess("");

        try {
            const response = await fetch(
                `${API_BASE_URL}/users/${user.id}/status`,
                {
                    method: "PUT",
                    headers: getHeaders(),
                    body: JSON.stringify({ status: nextStatus }),
                }
            );

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(data.message || "Failed to update user status.");
            }

            setSuccess(data.message || "User status updated successfully.");
            await fetchUsers();
        } catch (err) {
            setError(err.message || "Unable to update user status.");
        } finally {
            setUpdatingId(null);
        }
    };

    return (
        <div className="min-h-full bg-aqua-spring p-4 sm:p-6 lg:p-8">
            {/* Header */}
            <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-cyprus sm:text-3xl">
                        Users & Roles
                    </h1>
                    <p className="mt-1 text-sm text-text-grey">
                        Manage users, roles and account access.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => {
                        fetchUsers();
                        fetchRoles();
                    }}
                    disabled={loading}
                    className="flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                    <i className={`fa-solid ${loading ? "fa-spinner fa-spin" : "fa-rotate"}`}></i>
                    Refresh Data
                </button>
            </div>

            {/* Messages */}
            {error && (
                <Message
                    type="error"
                    message={error}
                    onClose={() => setError("")}
                />
            )}

            {success && (
                <Message
                    type="success"
                    message={success}
                    onClose={() => setSuccess("")}
                />
            )}

            {/* Statistics */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    title="Total Users"
                    value={users.length}
                    icon="fa-users"
                    color="bg-blue-100 text-blue-600"
                />

                <StatCard
                    title="Active Users"
                    value={activeUsers}
                    icon="fa-user-check"
                    color="bg-green-100 text-green-600"
                />

                <StatCard
                    title="Inactive Users"
                    value={inactiveUsers}
                    icon="fa-user-slash"
                    color="bg-red-100 text-red-600"
                />

                <StatCard
                    title="Total Roles"
                    value={roles.length}
                    icon="fa-user-shield"
                    color="bg-purple-100 text-purple-600"
                />
            </div>

            {/* Role Overview */}
            <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                    <div>
                        <h2 className="font-bold text-cyprus">Role Overview</h2>
                        <p className="mt-1 text-sm text-gray-500">
                            Roles and their assigned user counts.
                        </p>
                    </div>

                    <span className="text-sm text-gray-500">
                        {totalAssignedUsers} total role assignments
                    </span>
                </div>

                {roles.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {roles.map((role) => (
                            <div
                                key={role.id}
                                className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4"
                            >
                                <div className="min-w-0">
                                    <h3 className="font-semibold text-gray-800">
                                        {role.name}
                                    </h3>
                                    <p className="mt-1 break-words text-sm text-gray-500">
                                        {role.description || "No description available"}
                                    </p>
                                </div>

                                <div className="shrink-0 text-center">
                                    <p className="text-xl font-bold text-cyprus">
                                        {Number(role.assigned_users || 0)}
                                    </p>
                                    <p className="text-xs text-gray-500">Users</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="py-6 text-center text-sm text-gray-500">
                        {loading ? "Loading roles..." : "No roles available."}
                    </p>
                )}
            </div>

            {/* Search and Filters */}
            <div className="mb-5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="relative">
                        <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>

                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search user ID, name or email..."
                            className="w-full rounded-xl border border-gray-200 py-3 pl-11 pr-4 outline-none transition focus:border-brand-primary"
                        />
                    </div>

                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-brand-primary"
                    >
                        <option value="All">All Roles</option>
                        {roles.map((role) => (
                            <option key={role.id} value={role.name}>
                                {role.name}
                            </option>
                        ))}
                    </select>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-brand-primary"
                    >
                        <option value="All">All Statuses</option>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                    </select>
                </div>
            </div>

            {/* Desktop Table */}
            <div className="hidden overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm md:block">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[850px] text-left">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                            <tr>
                                <th className="px-5 py-4">User ID</th>
                                <th className="px-5 py-4">User</th>
                                <th className="px-5 py-4">Role</th>
                                <th className="px-5 py-4">Status</th>
                                <th className="px-5 py-4">Joined</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-5 py-14 text-center text-gray-500">
                                        <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                                        Loading users...
                                    </td>
                                </tr>
                            ) : paginatedUsers.length > 0 ? (
                                paginatedUsers.map((user) => {
                                    const name = getUserName(user);
                                    const userRoles = getUserRoles(user);
                                    const status = getUserStatus(user);

                                    return (
                                        <tr key={user.id} className="transition hover:bg-gray-50">
                                            <td className="px-5 py-4">
                                                <span className="inline-flex rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-700">
                                                    #{user.id}
                                                </span>
                                            </td>

                                            <td className="px-5 py-4">
                                                <button
                                                    type="button"
                                                    onClick={() => openUserDetails(user)}
                                                    className="flex items-center gap-3 text-left"
                                                    title="View user details"
                                                >
                                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surf-crest font-bold text-cyprus">
                                                        {getInitials(name)}
                                                    </div>

                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-gray-800">
                                                            {name}
                                                        </p>
                                                        <p className="text-sm text-gray-500">
                                                            {getUserEmail(user)}
                                                        </p>
                                                    </div>
                                                </button>
                                            </td>

                                            <td className="px-5 py-4">
                                                <div className="flex max-w-[220px] flex-wrap gap-1.5">
                                                    {userRoles.length > 0 ? (
                                                        userRoles.map((role) => (
                                                            <span
                                                                key={role}
                                                                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${getRoleStyle(role)}`}
                                                            >
                                                                {role}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => openUserDetails(user, true)}
                                                            className="text-sm text-gray-400 hover:text-cyprus"
                                                        >
                                                            View roles
                                                        </button>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-5 py-4">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleStatus(user)}
                                                    disabled={updatingId === user.id || !["Active", "Inactive"].includes(status)}
                                                    title="Click to change status"
                                                    className={`rounded-full px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${getStatusStyle(status)}`}
                                                >
                                                    {updatingId === user.id ? (
                                                        <i className="fa-solid fa-spinner fa-spin"></i>
                                                    ) : (
                                                        status
                                                    )}
                                                </button>
                                            </td>

                                            <td className="px-5 py-4 text-sm text-gray-600">
                                                {getJoinedDate(user)}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="5">
                                        <EmptyState />
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={filteredUsers.length}
                    itemsPerPage={ITEMS_PER_PAGE}
                    onPageChange={setCurrentPage}
                />
            </div>

            {/* Mobile Cards */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
                {loading ? (
                    <div className="rounded-2xl bg-white py-12 text-center text-gray-500">
                        <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                        Loading users...
                    </div>
                ) : paginatedUsers.length > 0 ? (
                    paginatedUsers.map((user) => {
                        const name = getUserName(user);
                        const status = getUserStatus(user);
                        const userRoles = getUserRoles(user);

                        return (
                            <div
                                key={user.id}
                                className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
                            >
                                <div className="mb-3 flex items-start gap-3">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surf-crest font-bold text-cyprus">
                                        {getInitials(name)}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                                            User ID: #{user.id}
                                        </p>
                                        <h3 className="break-words font-bold text-gray-800">
                                            {name}
                                        </h3>
                                        <p className="break-all text-sm text-gray-500">
                                            {getUserEmail(user)}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    {userRoles.length > 0 ? (
                                        userRoles.map((role) => (
                                            <span
                                                key={role}
                                                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${getRoleStyle(role)}`}
                                            >
                                                {role}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-xs text-gray-400">
                                            No role
                                        </span>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => toggleStatus(user)}
                                        disabled={updatingId === user.id || !["Active", "Inactive"].includes(status)}
                                        className={`rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${getStatusStyle(status)}`}
                                    >
                                        {updatingId === user.id ? (
                                            <i className="fa-solid fa-spinner fa-spin"></i>
                                        ) : (
                                            status
                                        )}
                                    </button>
                                </div>

                                <p className="mt-3 text-xs text-gray-500">
                                    Joined: {getJoinedDate(user)}
                                </p>

                                <button
                                    type="button"
                                    onClick={() => openUserDetails(user)}
                                    className="mt-4 w-full rounded-lg bg-blue-50 py-2.5 text-sm font-semibold text-blue-600 transition hover:bg-blue-100"
                                >
                                    <i className="fa-solid fa-eye mr-2"></i>
                                    View User Details
                                </button>
                            </div>
                        );
                    })
                ) : (
                    <div className="rounded-2xl bg-white">
                        <EmptyState />
                    </div>
                )}

                {!loading && (
                    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={filteredUsers.length}
                            itemsPerPage={ITEMS_PER_PAGE}
                            onPageChange={setCurrentPage}
                        />
                    </div>
                )}
            </div>

            {/* User Details Modal */}
            {selectedUser && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setSelectedUser(null);
                            setUserDetails(null);
                        }
                    }}
                >
                    <div className="my-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-7">
                        <div className="mb-5 flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-xl font-bold text-cyprus">
                                    User Details
                                </h2>
                                <p className="mt-1 text-sm text-gray-500">
                                    User information and assigned roles.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedUser(null);
                                    setUserDetails(null);
                                }}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                                aria-label="Close details"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        {detailsLoading ? (
                            <div className="py-12 text-center text-gray-500">
                                <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                                Loading details...
                            </div>
                        ) : userDetails ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-4">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surf-crest text-lg font-bold text-cyprus">
                                        {getInitials(getUserName(userDetails))}
                                    </div>

                                    <div className="min-w-0">
                                        <h3 className="break-words font-bold text-gray-800">
                                            {getUserName(userDetails)}
                                        </h3>
                                        <p className="break-all text-sm text-gray-500">
                                            {getUserEmail(userDetails)}
                                        </p>
                                    </div>
                                </div>

                                <DetailRow
                                    label="User ID"
                                    value={userDetails.id ?? selectedUser.id}
                                />

                                <DetailRow
                                    label="Status"
                                    value={getUserStatus(userDetails)}
                                />

                                <DetailRow
                                    label="Joined"
                                    value={getJoinedDate(userDetails)}
                                />

                                <div>
                                    <p className="mb-2 text-sm font-semibold text-gray-700">
                                        Assigned Roles
                                    </p>

                                    <div className="flex flex-wrap gap-2">
                                        {Array.isArray(userDetails.roles) && userDetails.roles.length > 0 ? (
                                            userDetails.roles.map((role) => {
                                                const roleName =
                                                    typeof role === "string"
                                                        ? role
                                                        : role.name;

                                                return (
                                                    <span
                                                        key={typeof role === "string" ? role : role.id || role.name}
                                                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${getRoleStyle(roleName)}`}
                                                    >
                                                        {roleName}
                                                    </span>
                                                );
                                            })
                                        ) : getUserRoles(userDetails).length > 0 ? (
                                            getUserRoles(userDetails).map((role) => (
                                                <span
                                                    key={role}
                                                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${getRoleStyle(role)}`}
                                                >
                                                    {role}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-sm text-gray-400">
                                                No assigned roles found.
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="py-8 text-center text-sm text-gray-500">
                                Unable to load user details.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// Reusable Components
function StatCard({ title, value, icon, color }) {
    return (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-sm text-gray-500">{title}</p>
                    <h3 className="mt-2 text-3xl font-bold text-cyprus">
                        {value}
                    </h3>
                </div>

                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}>
                    <i className={`fa-solid ${icon} text-xl`}></i>
                </div>
            </div>
        </div>
    );
}

function DetailRow({ label, value }) {
    return (
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-3">
            <span className="text-sm text-gray-500">{label}</span>
            <span className="break-all text-right text-sm font-semibold text-gray-800">
                {value || "—"}
            </span>
        </div>
    );
}

function Pagination({
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    onPageChange,
}) {
    const start =
        totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;

    const end = Math.min(currentPage * itemsPerPage, totalItems);

    return (
        <div className="flex flex-col items-center justify-between gap-4 border-t border-gray-100 px-4 py-4 sm:flex-row sm:px-5">
            <p className="text-center text-sm text-gray-500">
                Showing {start}–{end} of {totalItems} users
            </p>

            <div className="flex items-center justify-center gap-2">
                <button
                    type="button"
                    onClick={() => onPageChange((page) => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <i className="fa-solid fa-chevron-left mr-2"></i>
                    Previous
                </button>

                <span className="min-w-20 text-center text-sm font-semibold text-cyprus">
                    Page {currentPage} of {totalPages}
                </span>

                <button
                    type="button"
                    onClick={() => onPageChange((page) => Math.min(totalPages, page + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    Next
                    <i className="fa-solid fa-chevron-right ml-2"></i>
                </button>
            </div>
        </div>
    );
}

function Message({ type, message, onClose }) {
    const isError = type === "error";

    return (
        <div
            className={`mb-5 flex items-start gap-3 rounded-xl border p-4 text-sm ${
                isError
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-green-200 bg-green-50 text-green-700"
            }`}
        >
            <i
                className={`fa-solid ${
                    isError ? "fa-circle-exclamation" : "fa-circle-check"
                } mt-0.5`}
            ></i>

            <p className="min-w-0 flex-1 break-words">{message}</p>

            <button type="button" onClick={onClose} aria-label="Close message">
                <i className="fa-solid fa-xmark"></i>
            </button>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="px-5 py-12 text-center">
            <i className="fa-solid fa-users mb-3 text-3xl text-gray-300"></i>
            <p className="font-semibold text-gray-600">No users found</p>
            <p className="mt-1 text-sm text-gray-400">
                Try changing your search or filters.
            </p>
        </div>
    );
}

export default UsersRoles;