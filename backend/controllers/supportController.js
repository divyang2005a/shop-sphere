const db = require("../config/db");
const crypto = require("crypto");
const { createNotification } = require("../services/notificationService");

const getUserId = (req) => req.user?.user_id ?? req.user?.id;

const isPositiveId = (value) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0;
};

const makeError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const allowedPriorities = ["low", "normal", "high", "urgent"];

const allowedStatuses = [
  "open",
  "in_progress",
  "waiting_for_customer",
  "resolved",
  "closed",
];

// CUSTOMER: Create a support ticket with the first message.
const createTicket = async (req, res) => {
  let connection;
  let transactionStarted = false;

  try {
    const userId = getUserId(req);
    const {
      order_id,
      subject,
      category,
      priority,
      message,
    } = req.body || {};

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user",
      });
    }

    if (
      typeof subject !== "string" ||
      !subject.trim() ||
      subject.trim().length > 255
    ) {
      return res.status(400).json({
        success: false,
        message: "Subject is required and must not exceed 255 characters",
      });
    }

    if (
      typeof message !== "string" ||
      !message.trim() ||
      message.trim().length > 10000
    ) {
      return res.status(400).json({
        success: false,
        message: "Message is required and must not exceed 10000 characters",
      });
    }

    const normalizedCategory =
      category === undefined || category === null || category === ""
        ? null
        : typeof category === "string" && category.trim().length <= 100
          ? category.trim()
          : null;

    if (
      category !== undefined &&
      category !== null &&
      category !== "" &&
      normalizedCategory === null
    ) {
      return res.status(400).json({
        success: false,
        message: "Category must not exceed 100 characters",
      });
    }

    const normalizedPriority =
      priority === undefined ? "normal" : priority;

    if (
      typeof normalizedPriority !== "string" ||
      !allowedPriorities.includes(normalizedPriority.toLowerCase())
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid priority",
        allowed_priorities: allowedPriorities,
      });
    }

    let orderId = null;

    if (
      order_id !== undefined &&
      order_id !== null &&
      order_id !== ""
    ) {
      if (!isPositiveId(order_id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid order ID",
        });
      }

      orderId = Number(order_id);
    }

    connection = await db.promise().getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    // If a ticket refers to an order, verify it belongs to this customer.
    if (orderId !== null) {
      const [orders] = await connection.query(
        `SELECT id
         FROM orders
         WHERE id = ? AND user_id = ?
         LIMIT 1`,
        [orderId, userId]
      );

      if (orders.length === 0) {
        throw makeError(
          404,
          "Order not found for this customer"
        );
      }
    }

    const ticketNumber =
      `SS-TKT-${Date.now()}-${crypto
        .randomBytes(3)
        .toString("hex")
        .toUpperCase()}`;

    const [ticketResult] = await connection.query(
      `INSERT INTO support_tickets (
         user_id,
         order_id,
         ticket_number,
         category,
         priority,
         subject,
         status
       )
       VALUES (?, ?, ?, ?, ?, ?, 'open')`,
      [
        userId,
        orderId,
        ticketNumber,
        normalizedCategory,
        normalizedPriority.toLowerCase(),
        subject.trim(),
      ]
    );

    const ticketId = ticketResult.insertId;

    await connection.query(
      `INSERT INTO support_messages (
         ticket_id,
         sender_id,
         message,
         attachment
       )
       VALUES (?, ?, ?, NULL)`,
      [ticketId, userId, message.trim()]
    );

    await connection.commit();
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      message: "Support ticket created successfully",
      data: {
        ticket_id: ticketId,
        ticket_number: ticketNumber,
        order_id: orderId,
        subject: subject.trim(),
        category: normalizedCategory,
        priority: normalizedPriority.toLowerCase(),
        status: "open",
        first_message: message.trim(),
      },
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Create ticket rollback error:", rollbackError);
      }
    }

    console.error("Create support ticket error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to create support ticket",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// CUSTOMER: List only their own support tickets.
const getMyTickets = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user",
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 20)
    );
    const offset = (page - 1) * limit;

    const [tickets] = await db.promise().query(
      `SELECT
         t.id,
         t.ticket_number,
         t.order_id,
         t.category,
         t.priority,
         t.subject,
         t.status,
         t.created_at,
         t.updated_at,
         (
           SELECT m.message
           FROM support_messages m
           WHERE m.ticket_id = t.id
           ORDER BY m.created_at DESC, m.id DESC
           LIMIT 1
         ) AS latest_message,
         (
           SELECT m.created_at
           FROM support_messages m
           WHERE m.ticket_id = t.id
           ORDER BY m.created_at DESC, m.id DESC
           LIMIT 1
         ) AS latest_message_at
       FROM support_tickets t
       WHERE t.user_id = ?
       ORDER BY t.updated_at DESC, t.id DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    const [countRows] = await db.promise().query(
      `SELECT COUNT(*) AS total
       FROM support_tickets
       WHERE user_id = ?`,
      [userId]
    );

    const total = Number(countRows[0].total);

    return res.status(200).json({
      success: true,
      data: {
        tickets,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get customer tickets error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch support tickets",
    });
  }
};

// CUSTOMER: Get ticket details and conversation.
const getMyTicketDetails = async (req, res) => {
  try {
    const userId = getUserId(req);
    const ticketId = Number(req.params.ticketId);

    if (!isPositiveId(ticketId)) {
      return res.status(400).json({
        success: false,
        message: "Valid ticket ID is required",
      });
    }

    const [tickets] = await db.promise().query(
      `SELECT
         id,
         user_id,
         order_id,
         ticket_number,
         category,
         priority,
         subject,
         status,
         created_at,
         updated_at
       FROM support_tickets
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [ticketId, userId]
    );

    if (tickets.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Support ticket not found",
      });
    }

    const [messages] = await db.promise().query(
      `SELECT
         m.id,
         m.sender_id,
         u.name AS sender_name,
         m.message,
         m.attachment,
         m.created_at
       FROM support_messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.ticket_id = ?
       ORDER BY m.created_at ASC, m.id ASC`,
      [ticketId]
    );

    return res.status(200).json({
      success: true,
      data: {
        ticket: tickets[0],
        messages,
      },
    });
  } catch (error) {
    console.error("Get customer ticket details error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch support ticket details",
    });
  }
};

// CUSTOMER: Send a message in one of their own tickets.
const sendCustomerMessage = async (req, res) => {
  let connection;
  let transactionStarted = false;

  try {
    const userId = getUserId(req);
    const ticketId = Number(req.params.ticketId);
    const { message } = req.body || {};

    if (!isPositiveId(ticketId)) {
      return res.status(400).json({
        success: false,
        message: "Valid ticket ID is required",
      });
    }

    if (
      typeof message !== "string" ||
      !message.trim() ||
      message.trim().length > 10000
    ) {
      return res.status(400).json({
        success: false,
        message: "Message is required and must not exceed 10000 characters",
      });
    }

    connection = await db.promise().getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [tickets] = await connection.query(
      `SELECT id, status
       FROM support_tickets
       WHERE id = ? AND user_id = ?
       FOR UPDATE`,
      [ticketId, userId]
    );

    if (tickets.length === 0) {
      throw makeError(404, "Support ticket not found");
    }

    const status = String(tickets[0].status || "open").toLowerCase();

    if (["resolved", "closed"].includes(status)) {
      throw makeError(
        400,
        "This ticket is closed. Please create a new support ticket."
      );
    }

    const [result] = await connection.query(
      `INSERT INTO support_messages (
         ticket_id,
         sender_id,
         message,
         attachment
       )
       VALUES (?, ?, ?, NULL)`,
      [ticketId, userId, message.trim()]
    );

    await connection.query(
      `UPDATE support_tickets
       SET status = 'open'
       WHERE id = ?`,
      [ticketId]
    );

    await connection.commit();
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      message: "Support message sent successfully",
      data: {
        message_id: result.insertId,
        ticket_id: ticketId,
        sender_id: userId,
        message: message.trim(),
      },
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Customer message rollback error:", rollbackError);
      }
    }

    console.error("Send customer message error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to send support message",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// ADMIN: List all support tickets.
const getAdminTickets = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 20)
    );
    const offset = (page - 1) * limit;

    const status =
      typeof req.query.status === "string"
        ? req.query.status.trim().toLowerCase()
        : "";

    if (
      status &&
      status !== "all" &&
      !allowedStatuses.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket status",
        allowed_statuses: [...allowedStatuses, "all"],
      });
    }

    const whereClause =
      status && status !== "all"
        ? "WHERE t.status = ?"
        : "";

    const params =
      status && status !== "all"
        ? [status]
        : [];

    const [tickets] = await db.promise().query(
      `SELECT
         t.id,
         t.user_id,
         u.name AS customer_name,
         u.email AS customer_email,
         t.order_id,
         t.ticket_number,
         t.category,
         t.priority,
         t.subject,
         t.status,
         t.created_at,
         t.updated_at,
         (
           SELECT m.message
           FROM support_messages m
           WHERE m.ticket_id = t.id
           ORDER BY m.created_at DESC, m.id DESC
           LIMIT 1
         ) AS latest_message
       FROM support_tickets t
       JOIN users u ON u.id = t.user_id
       ${whereClause}
       ORDER BY
         CASE t.priority
           WHEN 'urgent' THEN 1
           WHEN 'high' THEN 2
           WHEN 'normal' THEN 3
           WHEN 'low' THEN 4
           ELSE 5
         END,
         t.updated_at DESC,
         t.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countRows] = await db.promise().query(
      `SELECT COUNT(*) AS total
       FROM support_tickets t
       ${whereClause}`,
      params
    );

    const total = Number(countRows[0].total);

    return res.status(200).json({
      success: true,
      data: {
        tickets,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get admin tickets error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch support tickets",
    });
  }
};

// ADMIN: Get any ticket and its conversation.
const getAdminTicketDetails = async (req, res) => {
  try {
    const ticketId = Number(req.params.ticketId);

    if (!isPositiveId(ticketId)) {
      return res.status(400).json({
        success: false,
        message: "Valid ticket ID is required",
      });
    }

    const [tickets] = await db.promise().query(
      `SELECT
         t.*,
         u.name AS customer_name,
         u.email AS customer_email,
         o.order_number
       FROM support_tickets t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN orders o
         ON o.id = t.order_id
        AND o.user_id = t.user_id
       WHERE t.id = ?
       LIMIT 1`,
      [ticketId]
    );

    if (tickets.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Support ticket not found",
      });
    }

    const [messages] = await db.promise().query(
      `SELECT
         m.id,
         m.sender_id,
         u.name AS sender_name,
         m.message,
         m.attachment,
         m.created_at
       FROM support_messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.ticket_id = ?
       ORDER BY m.created_at ASC, m.id ASC`,
      [ticketId]
    );

    return res.status(200).json({
      success: true,
      data: {
        ticket: tickets[0],
        messages,
      },
    });
  } catch (error) {
    console.error("Get admin ticket details error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch ticket details",
    });
  }
};

// ADMIN: Reply to a ticket.
const replyToTicket = async (req, res) => {
  let connection;
  let transactionStarted = false;

  try {
    const adminId = getUserId(req);
    const ticketId = Number(req.params.ticketId);
    const { message } = req.body || {};

    if (!isPositiveId(ticketId)) {
      return res.status(400).json({
        success: false,
        message: "Valid ticket ID is required",
      });
    }

    if (
      typeof message !== "string" ||
      !message.trim() ||
      message.trim().length > 10000
    ) {
      return res.status(400).json({
        success: false,
        message: "Reply is required and must not exceed 10000 characters",
      });
    }

    connection = await db.promise().getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [tickets] = await connection.query(
      `SELECT id, user_id, ticket_number, status
       FROM support_tickets
       WHERE id = ?
       FOR UPDATE`,
      [ticketId]
    );

    if (tickets.length === 0) {
      throw makeError(404, "Support ticket not found");
    }

    const ticket = tickets[0];

    if (String(ticket.status).toLowerCase() === "closed") {
      throw makeError(
        400,
        "This ticket is closed and cannot receive new messages"
      );
    }

    const [result] = await connection.query(
      `INSERT INTO support_messages (
         ticket_id,
         sender_id,
         message,
         attachment
       )
       VALUES (?, ?, ?, NULL)`,
      [ticketId, adminId, message.trim()]
    );

    await connection.query(
      `UPDATE support_tickets
       SET status = 'waiting_for_customer'
       WHERE id = ?`,
      [ticketId]
    );

    await connection.commit();
    transactionStarted = false;

    try {
      await createNotification({
        userId: ticket.user_id,
        type: "support_reply",
        title: "Support team replied",
        message: `The support team replied to ticket ${ticket.ticket_number}.`,
        data: {
          ticket_id: ticketId,
          ticket_number: ticket.ticket_number,
          message_id: result.insertId,
        },
      });
    } catch (notificationError) {
      console.error(
        "Support reply notification error:",
        notificationError
      );
    }

    return res.status(201).json({
      success: true,
      message: "Reply sent successfully",
      data: {
        ticket_id: ticketId,
        message_id: result.insertId,
        status: "waiting_for_customer",
      },
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Admin reply rollback error:", rollbackError);
      }
    }

    console.error("Reply to ticket error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to send support reply",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// ADMIN: Update ticket status.
const updateTicketStatus = async (req, res) => {
  let connection;
  let transactionStarted = false;

  try {
    const adminId = getUserId(req);
    const ticketId = Number(req.params.ticketId);
    const { status } = req.body || {};

    if (!isPositiveId(ticketId)) {
      return res.status(400).json({
        success: false,
        message: "Valid ticket ID is required",
      });
    }

    if (
      typeof status !== "string" ||
      !allowedStatuses.includes(status.trim().toLowerCase())
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket status",
        allowed_statuses: allowedStatuses,
      });
    }

    const normalizedStatus = status.trim().toLowerCase();

    connection = await db.promise().getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [tickets] = await connection.query(
      `SELECT id, user_id, ticket_number, status
       FROM support_tickets
       WHERE id = ?
       FOR UPDATE`,
      [ticketId]
    );

    if (tickets.length === 0) {
      throw makeError(404, "Support ticket not found");
    }

    const ticket = tickets[0];
    const previousStatus = String(ticket.status || "open").toLowerCase();

    if (previousStatus === normalizedStatus) {
      throw makeError(
        400,
        `Ticket is already ${normalizedStatus}`
      );
    }

    await connection.query(
      `UPDATE support_tickets
       SET status = ?
       WHERE id = ?`,
      [normalizedStatus, ticketId]
    );

    await connection.commit();
    transactionStarted = false;

    try {
      await createNotification({
        userId: ticket.user_id,
        type: "support_ticket_status_updated",
        title: "Support ticket updated",
        message:
          `Your support ticket ${ticket.ticket_number} is now ${normalizedStatus.replace(/_/g, " ")}.`,
        data: {
          ticket_id: ticketId,
          ticket_number: ticket.ticket_number,
          previous_status: previousStatus,
          status: normalizedStatus,
        },
      });
    } catch (notificationError) {
      console.error(
        "Ticket status notification error:",
        notificationError
      );
    }

    return res.status(200).json({
      success: true,
      message: "Support ticket status updated successfully",
      data: {
        ticket_id: ticketId,
        ticket_number: ticket.ticket_number,
        previous_status: previousStatus,
        status: normalizedStatus,
      },
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Ticket status rollback error:", rollbackError);
      }
    }

    console.error("Update ticket status error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to update ticket status",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

module.exports = {
  createTicket,
  getMyTickets,
  getMyTicketDetails,
  sendCustomerMessage,
  getAdminTickets,
  getAdminTicketDetails,
  replyToTicket,
  updateTicketStatus,
};