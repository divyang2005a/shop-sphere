import React, { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL = "http://192.168.1.20:5000/api/support";

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_for_customer", label: "Waiting for Customer" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const PRIORITY_OPTIONS = [
  { value: "all", label: "All Priorities" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
];

const STATUS_STYLES = {
  open: "bg-blue-50 text-blue-700 ring-blue-600/20",
  in_progress: "bg-amber-50 text-amber-700 ring-amber-600/20",
  waiting_for_customer: "bg-purple-50 text-purple-700 ring-purple-600/20",
  resolved: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  closed: "bg-gray-100 text-gray-600 ring-gray-500/20",
};

const PRIORITY_STYLES = {
  urgent: "bg-red-50 text-red-700",
  high: "bg-orange-50 text-orange-700",
  normal: "bg-blue-50 text-blue-700",
  low: "bg-gray-100 text-gray-600",
};

const getStatusLabel = (status) => {
  const option = STATUS_OPTIONS.find(
    (item) => item.value === String(status || "").toLowerCase()
  );

  if (option) {
    return option.value === "all" ? "All Statuses" : option.label;
  }

  return String(status || "Unknown").replace(/_/g, " ");
};

const getPriorityLabel = (priority) => {
  const option = PRIORITY_OPTIONS.find(
    (item) => item.value === String(priority || "").toLowerCase()
  );

  return option?.label || String(priority || "Normal");
};

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

const getTicketNumber = (ticket) =>
  ticket?.ticket_number || `TKT-${ticket?.id ?? "—"}`;

const getErrorMessage = (error, fallback) =>
  error?.message || fallback;

function Support() {
  const [tickets, setTickets] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0,
  });

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [replyLoading, setReplyLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [success, setSuccess] = useState("");

  const [showDetails, setShowDetails] = useState(false);

  // Authentication token from Login.jsx
  const getToken = () => localStorage.getItem("shopsphereToken");

  // Authenticated API request helper
  const apiRequest = async (endpoint, options = {}) => {
    const token = getToken();

    if (!token) {
      throw new Error("Authentication token not found. Please login again.");
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success === false) {
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          data.message || "Your session is invalid or you do not have admin access."
        );
      }

      throw new Error(data.message || "Something went wrong. Please try again.");
    }

    return data;
  };

  // Fetch tickets from backend
  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const query = new URLSearchParams({
        page: String(page),
        limit: "20",
        status: statusFilter,
      });

      const response = await apiRequest(
        `/admin/tickets?${query.toString()}`
      );

      const ticketData = response.data?.tickets || [];
      const pageData = response.data?.pagination || {};

      setTickets(ticketData);

      setPagination({
        page: Number(pageData.page) || page,
        limit: Number(pageData.limit) || 20,
        total: Number(pageData.total) || 0,
        total_pages: Number(pageData.total_pages) || 0,
      });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load support tickets."));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Search and priority filtering are performed on the loaded page.
  const filteredTickets = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const ticketNumber = getTicketNumber(ticket).toLowerCase();
      const customerName = String(ticket.customer_name || "").toLowerCase();
      const customerEmail = String(ticket.customer_email || "").toLowerCase();
      const subject = String(ticket.subject || "").toLowerCase();
      const category = String(ticket.category || "").toLowerCase();

      const matchesSearch =
        !searchText ||
        ticketNumber.includes(searchText) ||
        customerName.includes(searchText) ||
        customerEmail.includes(searchText) ||
        subject.includes(searchText) ||
        category.includes(searchText);

      const matchesPriority =
        priorityFilter === "all" ||
        String(ticket.priority || "normal").toLowerCase() === priorityFilter;

      return matchesSearch && matchesPriority;
    });
  }, [tickets, search, priorityFilter]);

  // Summary cards use the tickets loaded for the current page.
  const openCount = tickets.filter(
    (ticket) => ticket.status === "open"
  ).length;

  const progressCount = tickets.filter(
    (ticket) => ticket.status === "in_progress"
  ).length;

  const resolvedCount = tickets.filter(
    (ticket) => ticket.status === "resolved"
  ).length;

  // Load a ticket and its complete conversation.
  const openTicketDetails = async (ticket) => {
    setSelectedTicket(ticket);
    setMessages([]);
    setReply("");
    setDetailError("");
    setSuccess("");
    setShowDetails(true);
    setDetailLoading(true);

    try {
      const response = await apiRequest(
        `/admin/tickets/${ticket.id}`
      );

      setSelectedTicket(response.data?.ticket || ticket);
      setMessages(response.data?.messages || []);
    } catch (err) {
      setDetailError(
        getErrorMessage(err, "Failed to load ticket details.")
      );
    } finally {
      setDetailLoading(false);
    }
  };

  // Send admin reply to the backend.
  const handleSaveReply = async (e) => {
    if (e) e.preventDefault();

    if (!selectedTicket) return;

    if (!reply.trim()) {
      setDetailError("Please enter a reply before sending.");
      return;
    }

    if (reply.trim().length > 10000) {
      setDetailError("Reply cannot exceed 10000 characters.");
      return;
    }

    if (selectedTicket.status === "closed") {
      setDetailError("This ticket is closed and cannot receive new messages.");
      return;
    }

    try {
      setReplyLoading(true);
      setDetailError("");
      setSuccess("");

      const response = await apiRequest(
        `/admin/tickets/${selectedTicket.id}/messages`,
        {
          method: "POST",
          body: JSON.stringify({
            message: reply.trim(),
          }),
        }
      );

      setReply("");

      // The backend changes the status to waiting_for_customer.
      const updatedTicket = {
        ...selectedTicket,
        status: response.data?.status || "waiting_for_customer",
      };

      setSelectedTicket(updatedTicket);
      setSuccess(response.message || "Reply sent successfully.");

      // Refresh the full conversation and ticket list.
      await Promise.all([
        loadUpdatedTicketDetails(selectedTicket.id),
        fetchTickets(),
      ]);
    } catch (err) {
      setDetailError(
        getErrorMessage(err, "Failed to send reply.")
      );
    } finally {
      setReplyLoading(false);
    }
  };

  // Refresh the currently opened conversation.
  const loadUpdatedTicketDetails = async (ticketId) => {
    try {
      const response = await apiRequest(
        `/admin/tickets/${ticketId}`
      );

      setSelectedTicket(response.data?.ticket || null);
      setMessages(response.data?.messages || []);
    } catch (err) {
      setDetailError(
        getErrorMessage(err, "Could not refresh the conversation.")
      );
    }
  };

  // Update ticket status.
  const handleStatusChange = async (newStatus) => {
    if (!selectedTicket || !newStatus) return;

    if (newStatus === selectedTicket.status) return;

    try {
      setStatusLoading(true);
      setDetailError("");
      setSuccess("");

      const response = await apiRequest(
        `/admin/tickets/${selectedTicket.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: newStatus,
          }),
        }
      );

      setSelectedTicket((previous) =>
        previous
          ? {
              ...previous,
              status: response.data?.status || newStatus,
            }
          : previous
      );

      setSuccess(
        response.message || "Ticket status updated successfully."
      );

      await fetchTickets();
    } catch (err) {
      setDetailError(
        getErrorMessage(err, "Failed to update ticket status.")
      );

      // Refresh the list to keep the UI in sync with the backend.
      await fetchTickets();
    } finally {
      setStatusLoading(false);
    }
  };

  const closeDetails = () => {
    setShowDetails(false);
    setSelectedTicket(null);
    setMessages([]);
    setReply("");
    setDetailError("");
    setSuccess("");
  };

  const handleStatusFilterChange = (value) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handlePreviousPage = () => {
    setPage((previous) => Math.max(1, previous - 1));
  };

  const handleNextPage = () => {
    setPage((previous) =>
      Math.min(pagination.total_pages || 1, previous + 1)
    );
  };

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-cyprus sm:text-3xl">
            Support & Tickets
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Manage customer questions and support requests.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchTickets}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 font-semibold text-cyprus transition hover:bg-gray-100 disabled:opacity-60"
        >
          <i
            className={`fa-solid fa-rotate-right ${
              loading ? "animate-spin" : ""
            }`}
          />
          Refresh Tickets
        </button>
      </div>

      {/* API Error */}
      {error && (
        <div className="mb-6 flex flex-col justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <i className="fa-solid fa-circle-exclamation mt-0.5 text-red-500" />

            <div>
              <p className="font-semibold text-red-700">
                Unable to load support tickets
              </p>
              <p className="mt-1 break-words text-sm text-red-600">
                {error}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchTickets}
            className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Tickets"
          value={pagination.total}
          icon="fa-ticket"
          color="bg-purple-100 text-purple-600"
        />

        <StatCard
          title="Open Tickets"
          value={openCount}
          icon="fa-envelope-open-text"
          color="bg-blue-100 text-blue-600"
        />

        <StatCard
          title="In Progress"
          value={progressCount}
          icon="fa-spinner"
          color="bg-yellow-100 text-yellow-600"
        />

        <StatCard
          title="Resolved"
          value={resolvedCount}
          icon="fa-circle-check"
          color="bg-green-100 text-green-600"
        />
      </div>

      {/* Search and Filters */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="relative">
          <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />

          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets, customers, email..."
            className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => handleStatusFilterChange(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-brand-primary"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-brand-primary"
        >
          {PRIORITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tickets Table / Cards */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-2 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:p-5">
          <div>
            <h2 className="font-bold text-cyprus">
              Support Tickets
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Review tickets and respond to customer messages.
            </p>
          </div>

          <span className="text-sm text-gray-500">
            {filteredTickets.length} shown · {pagination.total} total
          </span>
        </div>

        {loading ? (
          <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
            <i className="fa-solid fa-spinner mb-4 animate-spin text-3xl text-brand-primary" />

            <p className="font-semibold text-cyprus">
              Loading support tickets...
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Please wait while we fetch the latest tickets.
            </p>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
              <i className="fa-solid fa-ticket text-2xl" />
            </div>

            <p className="font-semibold text-gray-700">
              No tickets found
            </p>

            <p className="mt-1 text-sm text-gray-400">
              Try changing your search or filters.
            </p>

            {(search || priorityFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setPriorityFilter("all");
                }}
                className="mt-4 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-cyprus hover:bg-gray-50"
              >
                Clear Search & Filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="whitespace-nowrap px-5 py-4">
                      Ticket
                    </th>

                    <th className="px-5 py-4">Customer</th>

                    <th className="px-5 py-4">Category</th>

                    <th className="px-5 py-4">Priority</th>

                    <th className="px-5 py-4">Status</th>

                    <th className="whitespace-nowrap px-5 py-4">
                      Created
                    </th>

                    <th className="px-5 py-4 text-center">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredTickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      className="transition hover:bg-gray-50/80"
                    >
                      <td className="px-5 py-4">
                        <p className="whitespace-nowrap font-semibold text-brand-primary">
                          {getTicketNumber(ticket)}
                        </p>

                        <p
                          className="mt-1 max-w-56 truncate text-sm text-gray-700"
                          title={ticket.subject}
                        >
                          {ticket.subject || "No subject"}
                        </p>

                        {ticket.order_id && (
                          <p className="mt-1 text-xs text-gray-400">
                            Order #{ticket.order_id}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-gray-800">
                          {ticket.customer_name || "Unknown customer"}
                        </p>

                        <p className="mt-1 max-w-48 break-all text-xs text-gray-500">
                          {ticket.customer_email || "—"}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600">
                        {ticket.category || "General"}
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

                      <td className="px-5 py-4">
                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={() => openTicketDetails(ticket)}
                            title="View ticket details"
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-blue-600 transition hover:bg-blue-50"
                          >
                            <i className="fa-regular fa-eye" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile and Tablet Cards */}
            <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:hidden">
              {filteredTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="min-w-0 rounded-xl border border-gray-100 p-4 transition hover:border-gray-200 hover:shadow-sm"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-all text-sm font-bold text-brand-primary">
                        {getTicketNumber(ticket)}
                      </p>

                      <h3 className="mt-1 break-words font-semibold text-gray-800">
                        {ticket.subject || "No subject"}
                      </h3>
                    </div>

                    <PriorityBadge priority={ticket.priority} />
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-700">
                      <i className="fa-regular fa-user mr-2 text-gray-400" />
                      {ticket.customer_name || "Unknown customer"}
                    </p>

                    <p className="break-all text-xs text-gray-500">
                      <i className="fa-regular fa-envelope mr-2 text-gray-400" />
                      {ticket.customer_email || "—"}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusBadge status={ticket.status} />

                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                      {ticket.category || "General"}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 text-xs text-gray-400">
                    <span>{formatDate(ticket.created_at)}</span>

                    {ticket.order_id && (
                      <span>Order #{ticket.order_id}</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => openTicketDetails(ticket)}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
                  >
                    <i className="fa-regular fa-eye" />
                    View Details & Reply
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {!loading && pagination.total_pages > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-100 px-4 py-4 sm:flex-row sm:px-5">
            <p className="text-center text-sm text-gray-500 sm:text-left">
              Page {pagination.page} of {pagination.total_pages}
              {" · "}
              {pagination.total} tickets
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePreviousPage}
                disabled={page <= 1}
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <i className="fa-solid fa-chevron-left text-xs" />
                Previous
              </button>

              <button
                type="button"
                onClick={handleNextPage}
                disabled={
                  page >= pagination.total_pages ||
                  pagination.total_pages === 0
                }
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <i className="fa-solid fa-chevron-right text-xs" />
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
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-aqua-spring px-3 py-1 text-xs font-bold text-cyprus">
                    {getTicketNumber(selectedTicket)}
                  </span>

                  <StatusBadge status={selectedTicket.status} />
                </div>

                <h2 className="break-words text-lg font-bold text-cyprus sm:text-2xl">
                  {selectedTicket.subject || "Support Ticket"}
                </h2>

                <p className="mt-1 text-xs text-gray-500 sm:text-sm">
                  Created {formatDateTime(selectedTicket.created_at)}
                </p>
              </div>

              <button
                type="button"
                onClick={closeDetails}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100"
                aria-label="Close ticket details"
              >
                <i className="fa-solid fa-xmark text-xl" />
              </button>
            </div>

            <div className="space-y-6 p-4 sm:p-6">
              {/* Modal Feedback */}
              {detailError && (
                <Feedback
                  type="error"
                  message={detailError}
                  onClose={() => setDetailError("")}
                />
              )}

              {success && (
                <Feedback
                  type="success"
                  message={success}
                  onClose={() => setSuccess("")}
                />
              )}

              {detailLoading ? (
                <div className="flex min-h-48 flex-col items-center justify-center text-center">
                  <i className="fa-solid fa-spinner mb-3 animate-spin text-3xl text-brand-primary" />

                  <p className="font-semibold text-cyprus">
                    Loading ticket conversation...
                  </p>
                </div>
              ) : (
                <>
                  {/* Customer Details */}
                  <section>
                    <h3 className="mb-3 font-bold text-cyprus">
                      Customer Information
                    </h3>

                    <div className="grid grid-cols-1 gap-4 rounded-xl bg-gray-50 p-4 sm:grid-cols-2">
                      <DetailItem
                        label="Customer"
                        value={selectedTicket.customer_name || "—"}
                      />

                      <DetailItem
                        label="Email"
                        value={selectedTicket.customer_email || "—"}
                      />

                      <DetailItem
                        label="Category"
                        value={selectedTicket.category || "General"}
                      />

                      <DetailItem
                        label="Order ID"
                        value={selectedTicket.order_number
                          ? `${selectedTicket.order_number}`
                          : selectedTicket.order_id
                            ? `#${selectedTicket.order_id}`
                            : "Not linked to an order"}
                      />

                      <DetailItem
                        label="Priority"
                        value={getPriorityLabel(selectedTicket.priority)}
                      />

                      <DetailItem
                        label="Last Updated"
                        value={formatDateTime(selectedTicket.updated_at)}
                      />
                    </div>
                  </section>

                  {/* Ticket Status */}
                  <section>
                    <h3 className="mb-3 font-bold text-cyprus">
                      Manage Ticket
                    </h3>

                    <div className="rounded-xl border border-gray-100 p-4">
                      <label
                        htmlFor="ticket-status"
                        className="mb-2 block text-sm font-semibold text-gray-700"
                      >
                        Update Ticket Status
                      </label>

                      <select
                        id="ticket-status"
                        value={selectedTicket.status || "open"}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        disabled={statusLoading}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand-primary disabled:opacity-60"
                      >
                        {STATUS_OPTIONS.filter(
                          (option) => option.value !== "all"
                        ).map((option) => (
                          <option
                            key={option.value}
                            value={option.value}
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>

                      {statusLoading && (
                        <p className="mt-2 text-xs text-gray-500">
                          <i className="fa-solid fa-spinner mr-1 animate-spin" />
                          Updating ticket status...
                        </p>
                      )}
                    </div>
                  </section>

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
                        <i className="fa-regular fa-comments mb-2 text-2xl text-gray-300" />

                        <p className="text-sm text-gray-500">
                          No messages found for this ticket.
                        </p>
                      </div>
                    ) : (
                      <div className="max-h-96 space-y-4 overflow-y-auto rounded-xl bg-gray-50 p-3 sm:p-4">
                        {messages.map((message) => {
                          const isAdminMessage =
                            Number(message.sender_id) !==
                            Number(selectedTicket.user_id);

                          return (
                            <div
                              key={message.id}
                              className={`flex ${
                                isAdminMessage
                                  ? "justify-end"
                                  : "justify-start"
                              }`}
                            >
                              <div
                                className={`max-w-[92%] min-w-0 rounded-2xl p-3 sm:max-w-[85%] sm:p-4 ${
                                  isAdminMessage
                                    ? "rounded-br-sm bg-cyprus text-white"
                                    : "rounded-bl-sm border border-gray-200 bg-white text-gray-700"
                                }`}
                              >
                                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                  <p
                                    className={`text-xs font-bold ${
                                      isAdminMessage
                                        ? "text-white"
                                        : "text-cyprus"
                                    }`}
                                  >
                                    {message.sender_name ||
                                      (isAdminMessage
                                        ? "Support Team"
                                        : "Customer")}
                                  </p>

                                  <span
                                    className={`text-[10px] sm:text-xs ${
                                      isAdminMessage
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
                                  <p className="mt-3 break-all text-xs underline">
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

                  {/* Admin Reply */}
                  <section>
                    <h3 className="mb-3 font-bold text-cyprus">
                      Reply to Customer
                    </h3>

                    {["closed"].includes(selectedTicket.status) ? (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <p className="text-sm text-gray-600">
                          <i className="fa-solid fa-lock mr-2" />
                          This ticket is closed. New messages cannot be sent.
                        </p>
                      </div>
                    ) : (
                      <form onSubmit={handleSaveReply}>
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
                          placeholder="Write your reply to the customer..."
                          className="w-full resize-y rounded-xl border border-gray-200 p-4 text-sm leading-6 outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
                          disabled={replyLoading}
                          required
                        />

                        <div className="mt-2 flex items-center justify-between gap-3">
                          <p className="text-xs text-gray-400">
                            {reply.length}/10000 characters
                          </p>

                          <button
                            type="submit"
                            disabled={replyLoading || !reply.trim()}
                            className="flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {replyLoading ? (
                              <>
                                <i className="fa-solid fa-spinner animate-spin" />
                                Sending...
                              </>
                            ) : (
                              <>
                                <i className="fa-solid fa-paper-plane" />
                                Send Reply
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

            {/* Modal Footer */}
            <div className="sticky bottom-0 flex justify-end border-t border-gray-100 bg-white p-4 sm:px-6">
              <button
                type="button"
                onClick={closeDetails}
                className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Summary Card
function StatCard({ title, value, icon, color }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-gray-500">{title}</p>

          <h3 className="mt-2 text-2xl font-bold text-cyprus">
            {value}
          </h3>
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${color}`}
        >
          <i className={`fa-solid ${icon} text-xl`} />
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
      className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
        STATUS_STYLES[normalizedStatus] ||
        "bg-gray-100 text-gray-600 ring-gray-500/20"
      }`}
    >
      {getStatusLabel(normalizedStatus)}
    </span>
  );
}

// Priority Badge
function PriorityBadge({ priority }) {
  const normalizedPriority = String(priority || "normal").toLowerCase();

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
        PRIORITY_STYLES[normalizedPriority] ||
        "bg-gray-100 text-gray-600"
      }`}
    >
      {getPriorityLabel(normalizedPriority)}
    </span>
  );
}

// Ticket Detail Item
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

// Success / Error Feedback
function Feedback({ type, message, onClose }) {
  const isError = type === "error";

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-xl border p-3 ${
        isError
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      <div className="flex min-w-0 items-start gap-2">
        <i
          className={`mt-0.5 ${
            isError
              ? "fa-solid fa-circle-exclamation"
              : "fa-solid fa-circle-check"
          }`}
        />

        <p className="break-words text-sm">{message}</p>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="shrink-0 rounded-md p-1 opacity-70 hover:opacity-100"
        aria-label="Dismiss message"
      >
        <i className="fa-solid fa-xmark" />
      </button>
    </div>
  );
}

export default Support;