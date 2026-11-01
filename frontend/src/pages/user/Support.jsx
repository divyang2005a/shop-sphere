import React, { useCallback, useEffect, useState } from "react";
import UserDashboardLayout from "../../layouts/UserDashboardLayout";

const API_URL = "http://192.168.1.10:5000/api/support";

const STATUS_OPTIONS = [
    { value: "open", label: "Open" },
    { value: "in_progress", label: "In Progress" },
    { value: "waiting_for_customer", label: "Waiting for Customer" },
    { value: "resolved", label: "Resolved" },
    { value: "closed", label: "Closed" },
];

const STATUS_STYLES = {
    open: "bg-blue-50 text-blue-700",
    in_progress: "bg-amber-50 text-amber-700",
    waiting_for_customer: "bg-purple-50 text-purple-700",
    resolved: "bg-green-50 text-green-700",
    closed: "bg-gray-100 text-gray-600",
};

const PRIORITIES = [
    { value: "low", label: "Low" },
    { value: "normal", label: "Normal" },
    { value: "high", label: "High" },
    { value: "urgent", label: "Urgent" },
];

const formatDate = (date) => {
    if (!date) return "—";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
        return String(date);
    }

    return parsedDate.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

const formatDateTime = (date) => {
    if (!date) return "—";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
        return String(date);
    }

    return parsedDate.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const getStatusLabel = (status) => {
    return (
        STATUS_OPTIONS.find((item) => item.value === status)?.label ||
        String(status || "Unknown").replace(/_/g, " ")
    );
};

function Support() {
    const [tickets, setTickets] = useState([]);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        total_pages: 0,
    });

    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState("all");
    const [search, setSearch] = useState("");

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [replyLoading, setReplyLoading] = useState(false);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    const [selectedTicket, setSelectedTicket] = useState(null);
    const [messages, setMessages] = useState([]);
    const [reply, setReply] = useState("");
    const [detailError, setDetailError] = useState("");

    const [form, setForm] = useState({
        subject: "",
        category: "general",
        priority: "normal",
        order_id: "",
        message: "",
    });

    // Get authentication token saved during login.
    const getToken = () => localStorage.getItem("shopsphereToken");

    // Reusable authenticated API request.
    const apiRequest = async (endpoint, options = {}) => {
        const token = getToken();

        if (!token) {
            throw new Error("Please login again to use customer support.");
        }

        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                ...(options.body
                    ? { "Content-Type": "application/json" }
                    : {}),
                ...options.headers,
            },
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || data.success === false) {
            throw new Error(
                data.message || "Something went wrong. Please try again."
            );
        }

        return data;
    };

    // Fetch customer's own tickets.
    const fetchTickets = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const query = new URLSearchParams({
                page: String(page),
                limit: "10",
            });

            const response = await apiRequest(`?${query.toString()}`);

            const ticketData = response.data?.tickets || [];
            const pageData = response.data?.pagination || {};

            setTickets(ticketData);

            setPagination({
                page: Number(pageData.page) || page,
                limit: Number(pageData.limit) || 10,
                total: Number(pageData.total) || 0,
                total_pages: Number(pageData.total_pages) || 0,
            });
        } catch (err) {
            setError(err.message || "Failed to load your support tickets.");
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        fetchTickets();
    }, [fetchTickets]);

    // Create a new customer ticket.
    const handleCreateTicket = async (e) => {
        e.preventDefault();

        if (!form.subject.trim()) {
            setError("Please enter a ticket subject.");
            return;
        }

        if (!form.message.trim()) {
            setError("Please describe your issue.");
            return;
        }

        try {
            setSubmitting(true);
            setError("");
            setSuccess("");

            const payload = {
                subject: form.subject.trim(),
                category: form.category,
                priority: form.priority,
                message: form.message.trim(),
            };

            // Order ID is optional.
            if (form.order_id.trim()) {
                const orderId = Number(form.order_id);

                if (!Number.isInteger(orderId) || orderId <= 0) {
                    setError("Please enter a valid numeric Order ID.");
                    return;
                }

                payload.order_id = orderId;
            }

            const response = await apiRequest("", {
                method: "POST",
                body: JSON.stringify(payload),
            });

            setForm({
                subject: "",
                category: "general",
                priority: "normal",
                order_id: "",
                message: "",
            });

            setShowCreateForm(false);
            setSuccess(response.message || "Support ticket created successfully.");
            setPage(1);

            await fetchTickets();
        } catch (err) {
            setError(err.message || "Failed to create support ticket.");
        } finally {
            setSubmitting(false);
        }
    };

    // Open ticket details and fetch its conversation.
    const openTicketDetails = async (ticket) => {
        setSelectedTicket(ticket);
        setMessages([]);
        setReply("");
        setDetailError("");
        setShowDetails(true);
        setDetailLoading(true);

        try {
            const response = await apiRequest(`/${ticket.id}`);

            setSelectedTicket(response.data?.ticket || ticket);
            setMessages(response.data?.messages || []);
        } catch (err) {
            setDetailError(err.message || "Failed to load ticket details.");
        } finally {
            setDetailLoading(false);
        }
    };

    // Send a reply to the support team.
    const handleSendReply = async (e) => {
        e.preventDefault();

        if (!selectedTicket || !reply.trim()) {
            setDetailError("Please enter a message.");
            return;
        }

        if (
            selectedTicket.status === "resolved" ||
            selectedTicket.status === "closed"
        ) {
            setDetailError(
                "This ticket is resolved or closed. You cannot send another message."
            );
            return;
        }

        try {
            setReplyLoading(true);
            setDetailError("");
            setSuccess("");

            const response = await apiRequest(
                `/${selectedTicket.id}/messages`,
                {
                    method: "POST",
                    body: JSON.stringify({
                        message: reply.trim(),
                    }),
                }
            );

            setReply("");

            setSuccess(response.message || "Message sent successfully.");

            await loadTicketDetails(selectedTicket.id);
            await fetchTickets();
        } catch (err) {
            setDetailError(err.message || "Failed to send message.");
        } finally {
            setReplyLoading(false);
        }
    };

    // Refresh ticket conversation.
    const loadTicketDetails = async (ticketId) => {
        try {
            const response = await apiRequest(`/${ticketId}`);

            setSelectedTicket(response.data?.ticket || null);
            setMessages(response.data?.messages || []);
        } catch (err) {
            setDetailError(err.message || "Failed to refresh conversation.");
        }
    };

    const closeDetails = () => {
        setShowDetails(false);
        setSelectedTicket(null);
        setMessages([]);
        setReply("");
        setDetailError("");
    };

    // Client-side search and status filter for the loaded page.
    const filteredTickets = tickets.filter((ticket) => {
        const query = search.trim().toLowerCase();

        const matchesSearch =
            !query ||
            String(ticket.ticket_number || "").toLowerCase().includes(query) ||
            String(ticket.subject || "").toLowerCase().includes(query) ||
            String(ticket.category || "").toLowerCase().includes(query);

        const matchesStatus =
            statusFilter === "all" || ticket.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const openCount = tickets.filter(
        (ticket) => ticket.status === "open"
    ).length;

    const progressCount = tickets.filter(
        (ticket) => ticket.status === "in_progress"
    ).length;

    const waitingCount = tickets.filter(
        (ticket) => ticket.status === "waiting_for_customer"
    ).length;

    const resolvedCount = tickets.filter(
        (ticket) =>
            ticket.status === "resolved" || ticket.status === "closed"
    ).length;

    return (
        <UserDashboardLayout>
            <div className="min-h-full bg-gray-50 p-4 sm:p-6 lg:p-8">

                {/* Page Header */}
                <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[2px] text-ocean-green">
                            Help Center
                        </p>

                        <h1 className="mt-1 text-2xl font-bold text-cyprus sm:text-3xl">
                            Help & Support
                        </h1>

                        <p className="mt-2 text-sm text-text-grey">
                            Get help with your orders and track your support requests.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            setError("");
                            setSuccess("");
                            setShowCreateForm((previous) => !previous);
                        }}
                        className="flex items-center justify-center gap-2 rounded-xl bg-ocean-green px-5 py-3 font-semibold text-white transition hover:opacity-90"
                    >
                        <i className="fa-solid fa-plus"></i>
                        Create Ticket
                    </button>
                </div>

                {/* Success Message */}
                {success && (
                    <Feedback
                        type="success"
                        message={success}
                        onClose={() => setSuccess("")}
                    />
                )}

                {/* Error Message */}
                {error && (
                    <Feedback
                        type="error"
                        message={error}
                        onClose={() => setError("")}
                    />
                )}

                {/* Summary Cards */}
                <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
                    <StatCard
                        title="Total Tickets"
                        value={pagination.total}
                        icon="fa-ticket"
                        color="bg-blue-50 text-blue-600"
                    />

                    <StatCard
                        title="Open"
                        value={openCount}
                        icon="fa-envelope-open-text"
                        color="bg-indigo-50 text-indigo-600"
                    />

                    <StatCard
                        title="In Progress"
                        value={progressCount}
                        icon="fa-spinner"
                        color="bg-amber-50 text-amber-600"
                    />

                    <StatCard
                        title="Waiting for Reply"
                        value={waitingCount}
                        icon="fa-comments"
                        color="bg-purple-50 text-purple-600"
                    />
                </div>

                {/* Create Ticket Form */}
                {showCreateForm && (
                    <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between gap-3 border-b border-gray-100 p-5">
                            <div>
                                <h2 className="text-lg font-bold text-cyprus">
                                    Create Support Ticket
                                </h2>

                                <p className="mt-1 text-sm text-text-grey">
                                    Describe your problem and our team will help you.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowCreateForm(false)}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
                                aria-label="Close form"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        <form
                            onSubmit={handleCreateTicket}
                            className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2"
                        >
                            <FormField label="Subject" required>
                                <input
                                    type="text"
                                    value={form.subject}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            subject: e.target.value,
                                        })
                                    }
                                    maxLength={255}
                                    placeholder="Enter your issue subject"
                                    className="form-input"
                                    required
                                />
                            </FormField>

                            <FormField label="Order ID (Optional)">
                                <input
                                    type="number"
                                    min="1"
                                    value={form.order_id}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            order_id: e.target.value,
                                        })
                                    }
                                    placeholder="Enter order ID if applicable"
                                    className="form-input"
                                />
                            </FormField>

                            <FormField label="Category" required>
                                <select
                                    value={form.category}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            category: e.target.value,
                                        })
                                    }
                                    className="form-input"
                                >
                                    <option value="general">General</option>
                                    <option value="order">Order</option>
                                    <option value="payment">Payment</option>
                                    <option value="shipping">Shipping</option>
                                    <option value="return">Return</option>
                                    <option value="refund">Refund</option>
                                    <option value="product">Product</option>
                                    <option value="account">Account</option>
                                    <option value="technical">Technical</option>
                                </select>
                            </FormField>

                            <FormField label="Priority" required>
                                <select
                                    value={form.priority}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            priority: e.target.value,
                                        })
                                    }
                                    className="form-input"
                                >
                                    {PRIORITIES.map((priority) => (
                                        <option
                                            key={priority.value}
                                            value={priority.value}
                                        >
                                            {priority.label}
                                        </option>
                                    ))}
                                </select>
                            </FormField>

                            <div className="md:col-span-2">
                                <FormField label="Describe Your Issue" required>
                                    <textarea
                                        rows={5}
                                        value={form.message}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                message: e.target.value,
                                            })
                                        }
                                        maxLength={10000}
                                        placeholder="Explain your issue in detail..."
                                        className="form-input resize-y"
                                        required
                                    />
                                </FormField>

                                <p className="mt-1 text-right text-xs text-gray-400">
                                    {form.message.length}/10000 characters
                                </p>
                            </div>

                            <div className="flex flex-col-reverse gap-3 sm:flex-row md:col-span-2 md:justify-end">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateForm(false)}
                                    className="rounded-xl border border-gray-200 px-5 py-3 font-semibold text-gray-600 transition hover:bg-gray-50"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex items-center justify-center gap-2 rounded-xl bg-ocean-green px-5 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {submitting ? (
                                        <>
                                            <i className="fa-solid fa-spinner animate-spin"></i>
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-paper-plane"></i>
                                            Submit Ticket
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Contact Support and FAQs */}
                <div className="mb-7 grid gap-5 md:grid-cols-2">

                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-aqua-spring text-ocean-green">
                            <i className="fa-solid fa-headset text-xl"></i>
                        </div>

                        <h2 className="text-lg font-bold text-cyprus">
                            Contact Support
                        </h2>

                        <p className="mt-2 text-sm leading-6 text-text-grey">
                            Need help with an order, return, payment, or account issue?
                            Create a support ticket and track the response here.
                        </p>

                        <a
                            href="mailto:support@shopsphere.com"
                            className="mt-4 inline-block break-all text-sm font-bold text-ocean-green hover:underline"
                        >
                            support@shopsphere.com
                        </a>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-aqua-spring text-ocean-green">
                            <i className="fa-solid fa-circle-question text-xl"></i>
                        </div>

                        <h2 className="text-lg font-bold text-cyprus">
                            Frequently Asked Questions
                        </h2>

                        <ul className="mt-3 space-y-3 text-sm text-text-grey">
                            <li className="flex gap-2">
                                <i className="fa-solid fa-check mt-1 text-ocean-green"></i>
                                How can I track my order?
                            </li>

                            <li className="flex gap-2">
                                <i className="fa-solid fa-check mt-1 text-ocean-green"></i>
                                How do I request a return or refund?
                            </li>

                            <li className="flex gap-2">
                                <i className="fa-solid fa-check mt-1 text-ocean-green"></i>
                                Can I change my shipping address?
                            </li>

                            <li className="flex gap-2">
                                <i className="fa-solid fa-check mt-1 text-ocean-green"></i>
                                How do I contact customer support?
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Ticket List Header */}
                <div className="mb-4">
                    <h2 className="text-xl font-bold text-cyprus">
                        My Support Tickets
                    </h2>

                    <p className="mt-1 text-sm text-text-grey">
                        View your requests and continue conversations with our support team.
                    </p>
                </div>

                {/* Search and Filter */}
                <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="relative">
                        <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>

                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search ticket number or subject..."
                            className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 outline-none transition focus:border-ocean-green"
                        />
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-ocean-green"
                    >
                        <option value="all">All Statuses</option>

                        {STATUS_OPTIONS.map((status) => (
                            <option key={status.value} value={status.value}>
                                {status.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Ticket List */}
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">

                    {loading ? (
                        <div className="flex min-h-56 flex-col items-center justify-center p-8 text-center">
                            <i className="fa-solid fa-spinner mb-3 animate-spin text-3xl text-ocean-green"></i>

                            <p className="font-semibold text-cyprus">
                                Loading your tickets...
                            </p>
                        </div>
                    ) : error && tickets.length === 0 ? (
                        <div className="p-10 text-center">
                            <i className="fa-solid fa-circle-exclamation mb-3 text-3xl text-red-500"></i>

                            <p className="font-semibold text-cyprus">
                                Could not load tickets
                            </p>

                            <p className="mt-2 break-words text-sm text-text-grey">
                                {error}
                            </p>

                            <button
                                type="button"
                                onClick={fetchTickets}
                                className="mt-4 rounded-xl bg-ocean-green px-5 py-2.5 font-semibold text-white hover:opacity-90"
                            >
                                Try Again
                            </button>
                        </div>
                    ) : filteredTickets.length === 0 ? (
                        <div className="p-10 text-center">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-aqua-spring text-ocean-green">
                                <i className="fa-solid fa-ticket text-2xl"></i>
                            </div>

                            <h3 className="font-bold text-cyprus">
                                No support tickets found
                            </h3>

                            <p className="mt-2 text-sm text-text-grey">
                                {search || statusFilter !== "all"
                                    ? "Try changing your search or status filter."
                                    : "You haven't created any support tickets yet."}
                            </p>

                            {!search && statusFilter === "all" && (
                                <button
                                    type="button"
                                    onClick={() => setShowCreateForm(true)}
                                    className="mt-4 rounded-xl bg-ocean-green px-5 py-3 font-semibold text-white hover:opacity-90"
                                >
                                    Create Your First Ticket
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <div className="hidden overflow-x-auto md:block">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                        <tr>
                                            <th className="px-5 py-4">Ticket</th>
                                            <th className="px-5 py-4">Subject</th>
                                            <th className="px-5 py-4">Priority</th>
                                            <th className="px-5 py-4">Status</th>
                                            <th className="px-5 py-4">Created</th>
                                            <th className="px-5 py-4 text-center">Action</th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-gray-100">
                                        {filteredTickets.map((ticket) => (
                                            <tr
                                                key={ticket.id}
                                                className="transition hover:bg-gray-50"
                                            >
                                                <td className="whitespace-nowrap px-5 py-4">
                                                    <span className="font-semibold text-ocean-green">
                                                        {ticket.ticket_number || `TKT-${ticket.id}`}
                                                    </span>
                                                </td>

                                                <td className="max-w-64 px-5 py-4">
                                                    <p className="truncate font-medium text-gray-800">
                                                        {ticket.subject || "No subject"}
                                                    </p>

                                                    <p className="mt-1 text-xs text-gray-400">
                                                        {ticket.category || "General"}
                                                    </p>
                                                </td>

                                                <td className="px-5 py-4">
                                                    <PriorityBadge priority={ticket.priority} />
                                                </td>

                                                <td className="px-5 py-4">
                                                    <StatusBadge status={ticket.status} />
                                                </td>

                                                <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-500">
                                                    {formatDate(ticket.created_at)}
                                                </td>

                                                <td className="px-5 py-4 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => openTicketDetails(ticket)}
                                                        className="rounded-lg px-3 py-2 text-sm font-semibold text-ocean-green transition hover:bg-aqua-spring"
                                                    >
                                                        View Details
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Cards */}
                            <div className="grid grid-cols-1 gap-4 p-4 md:hidden">
                                {filteredTickets.map((ticket) => (
                                    <div
                                        key={ticket.id}
                                        className="rounded-xl border border-gray-100 p-4"
                                    >
                                        <div className="mb-3 flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="break-all text-sm font-bold text-ocean-green">
                                                    {ticket.ticket_number || `TKT-${ticket.id}`}
                                                </p>

                                                <h3 className="mt-1 break-words font-semibold text-cyprus">
                                                    {ticket.subject || "No subject"}
                                                </h3>
                                            </div>

                                            <PriorityBadge priority={ticket.priority} />
                                        </div>

                                        <div className="mb-3 flex flex-wrap items-center gap-2">
                                            <StatusBadge status={ticket.status} />

                                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                                                {ticket.category || "General"}
                                            </span>
                                        </div>

                                        <p className="text-xs text-gray-400">
                                            Created {formatDate(ticket.created_at)}
                                        </p>

                                        <button
                                            type="button"
                                            onClick={() => openTicketDetails(ticket)}
                                            className="mt-4 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-ocean-green transition hover:bg-aqua-spring"
                                        >
                                            <i className="fa-regular fa-eye mr-2"></i>
                                            View Ticket & Messages
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Pagination */}
                    {!loading && pagination.total_pages > 0 && (
                        <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-100 px-4 py-4 sm:flex-row sm:px-5">
                            <p className="text-sm text-gray-500">
                                Page {pagination.page} of {pagination.total_pages}
                                {" · "}
                                {pagination.total} tickets
                            </p>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPage((previous) => Math.max(1, previous - 1))}
                                    disabled={page <= 1}
                                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <i className="fa-solid fa-chevron-left mr-2 text-xs"></i>
                                    Previous
                                </button>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setPage((previous) =>
                                            Math.min(
                                                pagination.total_pages,
                                                previous + 1
                                            )
                                        )
                                    }
                                    disabled={page >= pagination.total_pages}
                                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Next
                                    <i className="fa-solid fa-chevron-right ml-2 text-xs"></i>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Ticket Details Modal */}
                {showDetails && selectedTicket && (
                    <div
                        className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-5"
                        onClick={closeDetails}
                    >
                        <div
                            className="my-auto max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-100 bg-white p-4 sm:p-6">
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-ocean-green">
                                        {selectedTicket.ticket_number ||
                                            `TKT-${selectedTicket.id}`}
                                    </p>

                                    <h2 className="mt-1 break-words text-xl font-bold text-cyprus sm:text-2xl">
                                        {selectedTicket.subject || "Support Ticket"}
                                    </h2>

                                    <div className="mt-3">
                                        <StatusBadge status={selectedTicket.status} />
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={closeDetails}
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
                                    aria-label="Close details"
                                >
                                    <i className="fa-solid fa-xmark text-xl"></i>
                                </button>
                            </div>

                            <div className="space-y-6 p-4 sm:p-6">
                                {detailError && (
                                    <Feedback
                                        type="error"
                                        message={detailError}
                                        onClose={() => setDetailError("")}
                                    />
                                )}

                                {detailLoading ? (
                                    <div className="flex min-h-48 flex-col items-center justify-center">
                                        <i className="fa-solid fa-spinner mb-3 animate-spin text-3xl text-ocean-green"></i>

                                        <p className="text-sm text-text-grey">
                                            Loading conversation...
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Ticket Information */}
                                        <div className="rounded-xl bg-gray-50 p-4">
                                            <h3 className="mb-3 font-bold text-cyprus">
                                                Ticket Information
                                            </h3>

                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                <DetailItem
                                                    label="Category"
                                                    value={selectedTicket.category}
                                                />

                                                <DetailItem
                                                    label="Priority"
                                                    value={
                                                        PRIORITIES.find(
                                                            (item) =>
                                                                item.value === selectedTicket.priority
                                                        )?.label ||
                                                        selectedTicket.priority
                                                    }
                                                />

                                                <DetailItem
                                                    label="Created"
                                                    value={formatDateTime(selectedTicket.created_at)}
                                                />

                                                <DetailItem
                                                    label="Last Updated"
                                                    value={formatDateTime(selectedTicket.updated_at)}
                                                />

                                                <DetailItem
                                                    label="Order"
                                                    value={
                                                        selectedTicket.order_number ||
                                                        (selectedTicket.order_id
                                                            ? `#${selectedTicket.order_id}`
                                                            : "No order linked")
                                                    }
                                                />
                                            </div>
                                        </div>

                                        {/* Conversation */}
                                        <section>
                                            <div className="mb-3 flex items-center justify-between gap-3">
                                                <h3 className="font-bold text-cyprus">
                                                    Conversation
                                                </h3>

                                                <span className="text-xs text-gray-400">
                                                    {messages.length} messages
                                                </span>
                                            </div>

                                            {messages.length === 0 ? (
                                                <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
                                                    <i className="fa-regular fa-comments mb-2 text-2xl text-gray-300"></i>

                                                    <p className="text-sm text-text-grey">
                                                        No messages found.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="max-h-96 space-y-4 overflow-y-auto rounded-xl bg-gray-50 p-3 sm:p-4">
                                                    {messages.map((message) => {
                                                        const isCustomerMessage =
                                                            String(message.sender_id) ===
                                                            String(selectedTicket.user_id);

                                                        return (
                                                            <div
                                                                key={message.id}
                                                                className={`flex ${
                                                                    isCustomerMessage
                                                                        ? "justify-end"
                                                                        : "justify-start"
                                                                }`}
                                                            >
                                                                <div
                                                                    className={`max-w-[92%] min-w-0 rounded-2xl p-3 sm:max-w-[85%] sm:p-4 ${
                                                                        isCustomerMessage
                                                                            ? "rounded-br-sm bg-ocean-green text-white"
                                                                            : "rounded-bl-sm border border-gray-200 bg-white text-gray-700"
                                                                    }`}
                                                                >
                                                                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                                                        <p
                                                                            className={`text-xs font-bold ${
                                                                                isCustomerMessage
                                                                                    ? "text-white"
                                                                                    : "text-cyprus"
                                                                            }`}
                                                                        >
                                                                            {isCustomerMessage
                                                                                ? "You"
                                                                                : message.sender_name || "Support Team"}
                                                                        </p>

                                                                        <span
                                                                            className={`text-[10px] sm:text-xs ${
                                                                                isCustomerMessage
                                                                                    ? "text-white/70"
                                                                                    : "text-gray-400"
                                                                            }`}
                                                                        >
                                                                            {formatDateTime(message.created_at)}
                                                                        </span>
                                                                    </div>

                                                                    <p className="whitespace-pre-wrap break-words text-sm leading-6">
                                                                        {message.message}
                                                                    </p>

                                                                    {message.attachment && (
                                                                        <p className="mt-2 break-all text-xs underline">
                                                                            Attachment: {message.attachment}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </section>

                                        {/* Customer Reply Form */}
                                        <section>
                                            <h3 className="mb-3 font-bold text-cyprus">
                                                Send a Message
                                            </h3>

                                            {["resolved", "closed"].includes(
                                                selectedTicket.status
                                            ) ? (
                                                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                                                    <p className="text-sm text-gray-600">
                                                        <i className="fa-solid fa-lock mr-2"></i>
                                                        This ticket is {selectedTicket.status}.
                                                        You cannot send another message.
                                                    </p>
                                                </div>
                                            ) : (
                                                <form onSubmit={handleSendReply}>
                                                    <textarea
                                                        value={reply}
                                                        onChange={(e) => {
                                                            setReply(e.target.value);

                                                            if (detailError) {
                                                                setDetailError("");
                                                            }
                                                        }}
                                                        rows={4}
                                                        maxLength={10000}
                                                        placeholder="Write your message..."
                                                        className="w-full resize-y rounded-xl border border-gray-200 p-4 text-sm leading-6 outline-none transition focus:border-ocean-green focus:ring-2 focus:ring-ocean-green/10"
                                                        required
                                                    />

                                                    <div className="mt-2 flex items-center justify-between gap-3">
                                                        <p className="text-xs text-gray-400">
                                                            {reply.length}/10000 characters
                                                        </p>

                                                        <button
                                                            type="submit"
                                                            disabled={replyLoading || !reply.trim()}
                                                            className="flex items-center justify-center gap-2 rounded-xl bg-ocean-green px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            {replyLoading ? (
                                                                <>
                                                                    <i className="fa-solid fa-spinner animate-spin"></i>
                                                                    Sending...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <i className="fa-solid fa-paper-plane"></i>
                                                                    Send Message
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                </form>
                                            )}
                                        </section>
                                    </>
                                )}
                            </div>

                            <div className="sticky bottom-0 flex justify-end border-t border-gray-100 bg-white p-4 sm:px-6">
                                <button
                                    type="button"
                                    onClick={closeDetails}
                                    className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </UserDashboardLayout>
    );
}

// Summary Card
function StatCard({ title, value, icon, color }) {
    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs text-text-grey sm:text-sm">
                        {title}
                    </p>

                    <h3 className="mt-2 text-xl font-bold text-cyprus sm:text-2xl">
                        {value}
                    </h3>
                </div>

                <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${color}`}
                >
                    <i className={`fa-solid ${icon} text-lg sm:text-xl`}></i>
                </div>
            </div>
        </div>
    );
}

// Status Badge
function StatusBadge({ status }) {
    const normalizedStatus = String(status || "open").toLowerCase();

    return (
        <span
            className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                STATUS_STYLES[normalizedStatus] ||
                "bg-gray-100 text-gray-600"
            }`}
        >
            {getStatusLabel(normalizedStatus)}
        </span>
    );
}

// Priority Badge
function PriorityBadge({ priority }) {
    const normalizedPriority = String(priority || "normal").toLowerCase();

    const styles = {
        urgent: "bg-red-50 text-red-700",
        high: "bg-orange-50 text-orange-700",
        normal: "bg-blue-50 text-blue-700",
        low: "bg-gray-100 text-gray-600",
    };

    const label =
        PRIORITIES.find((item) => item.value === normalizedPriority)?.label ||
        "Normal";

    return (
        <span
            className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                styles[normalizedPriority] || styles.normal
            }`}
        >
            {label}
        </span>
    );
}

// Form Field
function FormField({ label, required, children }) {
    return (
        <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">
                {label}
                {required && <span className="ml-1 text-red-500">*</span>}
            </label>

            {React.cloneElement(children, {
                className: `${
                    children.props.className || ""
                } w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-ocean-green focus:ring-2 focus:ring-ocean-green/10`,
            })}
        </div>
    );
}

// Detail Item
function DetailItem({ label, value }) {
    return (
        <div className="min-w-0">
            <p className="text-xs text-gray-500">{label}</p>

            <p className="mt-1 break-words text-sm font-semibold text-gray-800">
                {value || "—"}
            </p>
        </div>
    );
}

// Feedback Message
function Feedback({ type, message, onClose }) {
    const isError = type === "error";

    return (
        <div
            className={`mb-5 flex items-start justify-between gap-3 rounded-xl border p-4 ${
                isError
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-green-200 bg-green-50 text-green-700"
            }`}
        >
            <div className="flex min-w-0 items-start gap-2">
                <i
                    className={`mt-0.5 ${
                        isError
                            ? "fa-solid fa-circle-exclamation"
                            : "fa-solid fa-circle-check"
                    }`}
                ></i>

                <p className="break-words text-sm">{message}</p>
            </div>

            <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-md p-1 opacity-70 hover:opacity-100"
                aria-label="Close message"
            >
                <i className="fa-solid fa-xmark"></i>
            </button>
        </div>
    );
}

export default Support;