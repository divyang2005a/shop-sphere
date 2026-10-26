const db = require("../config/db");
const { createNotification } = require("../services/notificationService");

const getUserId = (req) => req.user?.user_id ?? req.user?.id ?? null;

const isPositiveId = (value) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0;
};

const money = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const makeError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const successfulPaymentStatuses = ["paid", "success", "completed"];

// ADMIN: Create refund record for an approved return.
// This records the refund; it does not transfer money.
const createRefund = async (req, res) => {
  let connection;
  let transactionStarted = false;

  try {
    const returnId = Number(req.params.return_id);
    const adminId = getUserId(req);

    if (!isPositiveId(returnId)) {
      return res.status(400).json({
        success: false,
        message: "Valid return ID is required",
      });
    }

    connection = await db.promise().getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [returns] = await connection.query(
      `SELECT
         r.id AS return_id,
         r.order_id,
         r.order_item_id,
         r.user_id,
         r.quantity AS return_quantity,
         r.reason,
         r.status AS return_status,
         oi.product_name,
         oi.quantity AS ordered_quantity,
         oi.unit_price,
         COALESCE(oi.discount, 0) AS item_discount,
         COALESCE(oi.tax, 0) AS item_tax,
         o.order_number,
         o.payment_status
       FROM order_returns r
       JOIN order_items oi
         ON oi.id = r.order_item_id
        AND oi.order_id = r.order_id
       JOIN orders o ON o.id = r.order_id
       WHERE r.id = ?
       FOR UPDATE`,
      [returnId],
    );

    if (returns.length === 0) {
      throw makeError(404, "Return request not found");
    }

    const returnRecord = returns[0];

    if (returnRecord.return_status !== "approved") {
      throw makeError(400, "Only approved return requests can be refunded");
    }

    const [existingRefunds] = await connection.query(
      `SELECT id, amount, status
       FROM refunds
       WHERE return_id = ?
       LIMIT 1`,
      [returnId],
    );

    if (existingRefunds.length > 0) {
      throw makeError(409, "A refund record already exists for this return");
    }

    // Require a real, successfully recorded payment.
    const orderPaymentStatus = String(
      returnRecord.payment_status || "",
    ).toLowerCase();

    if (!successfulPaymentStatuses.includes(orderPaymentStatus)) {
      throw makeError(
        409,
        "This order is not marked as paid. No refund was created.",
      );
    }

    const [payments] = await connection.query(
      `SELECT id, amount, status
       FROM payments
       WHERE order_id = ?
         AND user_id = ?
         AND LOWER(status) IN ('paid', 'success', 'completed')
       ORDER BY id DESC
       LIMIT 1
       FOR UPDATE`,
      [returnRecord.order_id, returnRecord.user_id],
    );

    if (payments.length === 0) {
      throw makeError(
        409,
        "No successful payment record exists for this order. " +
          "Record the actual payment first; no refund was created.",
      );
    }

    const payment = payments[0];
    const paymentAmount = Number(payment.amount);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      throw makeError(409, "The recorded payment amount is invalid");
    }

    // Calculate the return value from the original order item.
    // Discount and tax are prorated for partial-quantity returns.
    const orderedQuantity = Number(returnRecord.ordered_quantity);
    const returnQuantity = Number(returnRecord.return_quantity);
    const unitPrice = Number(returnRecord.unit_price);
    const itemDiscount = Number(returnRecord.item_discount);
    const itemTax = Number(returnRecord.item_tax);

    if (
      !Number.isInteger(orderedQuantity) ||
      orderedQuantity <= 0 ||
      !Number.isInteger(returnQuantity) ||
      returnQuantity <= 0 ||
      returnQuantity > orderedQuantity ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0 ||
      !Number.isFinite(itemDiscount) ||
      itemDiscount < 0 ||
      !Number.isFinite(itemTax) ||
      itemTax < 0
    ) {
      throw makeError(400, "Invalid original item amount or return quantity");
    }

    const subtotal = money(
      unitPrice * returnQuantity -
        (itemDiscount * returnQuantity) / orderedQuantity,
    );

    const taxAmount = money((itemTax * returnQuantity) / orderedQuantity);

    const refundAmount = money(subtotal + taxAmount);

    if (refundAmount <= 0) {
      throw makeError(
        400,
        "Calculated refund amount must be greater than zero",
      );
    }

    // Count existing reserved/completed refunds against this payment.
    const [totals] = await connection.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_refunded
       FROM refunds
       WHERE payment_id = ?
         AND LOWER(COALESCE(status, 'pending'))
             IN ('pending', 'processing', 'completed')`,
      [payment.id],
    );

    const amountAlreadyRefunded = Number(totals[0].total_refunded || 0);
    const remainingAmount = money(paymentAmount - amountAlreadyRefunded);

    if (refundAmount > remainingAmount) {
      throw makeError(
        409,
        `Refund amount exceeds the remaining refundable amount: ${remainingAmount.toFixed(2)}`,
      );
    }

    const [insertResult] = await connection.query(
      `INSERT INTO refunds (
         order_id,
         return_id,
         payment_id,
         amount,
         reason,
         status
       )
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [
        returnRecord.order_id,
        returnId,
        payment.id,
        refundAmount,
        returnRecord.reason,
      ],
    );

    const refundId = insertResult.insertId;

    await connection.query(
      `INSERT INTO refund_status_history (
         refund_id,
         previous_status,
         status,
         note,
         changed_by
       )
       VALUES (?, NULL, 'pending', ?, ?)`,
      [
        refundId,
        "Refund record created. Money has not been transferred by this API.",
        adminId,
      ],
    );

    await connection.commit();
    transactionStarted = false;

    try {
      await createNotification({
        userId: returnRecord.user_id,
        type: "refund_created",
        title: "Refund request recorded",
        message: `A refund record has been created for order ${returnRecord.order_number}.`,
        data: {
          refund_id: refundId,
          order_id: returnRecord.order_id,
          order_number: returnRecord.order_number,
          return_id: returnId,
          amount: refundAmount,
          status: "pending",
        },
      });
    } catch (notificationError) {
      console.error("Refund creation notification error:", notificationError);
    }

    return res.status(201).json({
      success: true,
      message: "Refund record created successfully",
      data: {
        refund_id: refundId,
        order_id: returnRecord.order_id,
        order_number: returnRecord.order_number,
        return_id: returnId,
        payment_id: payment.id,
        amount: refundAmount,
        status: "pending",
        money_transferred: false,
      },
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Refund rollback error:", rollbackError);
      }
    }

    console.error("Create refund error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A refund record already exists for this return",
      });
    }

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to create refund record",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// ADMIN: List refund records with pagination and optional status filter.
const getAdminRefunds = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 20),
    );
    const offset = (page - 1) * limit;

    const allowedStatuses = ["pending", "processing", "completed", "failed"];

    const status =
      typeof req.query.status === "string"
        ? req.query.status.trim().toLowerCase()
        : "";

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid refund status filter",
        allowed_statuses: allowedStatuses,
      });
    }

    const whereClause = status ? "WHERE r.status = ?" : "";
    const params = status ? [status] : [];

    const [refunds] = await db.promise().query(
      `SELECT
         r.id AS refund_id,
         r.order_id,
         o.order_number,
         o.user_id,
         u.name AS customer_name,
         u.email AS customer_email,
         r.return_id,
         r.payment_id,
         r.amount,
         r.reason,
         r.status,
         r.refund_transaction_id,
         r.created_at,
         r.completed_at
       FROM refunds r
       JOIN orders o ON o.id = r.order_id
       JOIN users u ON u.id = o.user_id
       ${whereClause}
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    const [countRows] = await db.promise().query(
      `SELECT COUNT(*) AS total
       FROM refunds r
       ${whereClause}`,
      params,
    );

    const total = Number(countRows[0].total);

    return res.status(200).json({
      success: true,
      data: {
        refunds,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get admin refunds error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch refunds",
    });
  }
};

// ADMIN: Update a refund's recorded status.
// "completed" requires a transaction/reference ID supplied by the admin.
const updateRefundStatus = async (req, res) => {
  let connection;
  let transactionStarted = false;

  try {
    const refundId = Number(req.params.refund_id);
    const adminId = getUserId(req);

    const { status, note, refund_transaction_id } = req.body || {};

    if (!isPositiveId(refundId)) {
      throw makeError(400, "Valid refund ID is required");
    }

    if (!adminId) {
      throw makeError(401, "Invalid admin authentication");
    }

    const allowedStatuses = ["processing", "completed", "failed"];

    if (
      typeof status !== "string" ||
      !allowedStatuses.includes(status.trim().toLowerCase())
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid refund status",
        allowed_statuses: allowedStatuses,
      });
    }

    const normalizedStatus = status.trim().toLowerCase();

    if (
      note !== undefined &&
      note !== null &&
      (typeof note !== "string" || note.trim().length > 2000)
    ) {
      return res.status(400).json({
        success: false,
        message: "Note must be a string of at most 2000 characters",
      });
    }

    if (
      refund_transaction_id !== undefined &&
      refund_transaction_id !== null &&
      (typeof refund_transaction_id !== "string" ||
        refund_transaction_id.trim().length > 191)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid refund transaction/reference ID",
      });
    }

    // This controller writes its own audit record inside
    // the same transaction. Avoid a duplicate generic audit.
    req.skipGenericAudit = true;

    connection = await db.promise().getConnection();

    await connection.beginTransaction();
    transactionStarted = true;

    // Fetch and lock the refund record.
    const [refundRows] = await connection.query(
      `SELECT
         r.id,
         r.order_id,
         r.return_id,
         r.payment_id,
         r.amount,
         r.status,
         r.refund_transaction_id,
         r.completed_at,
         o.order_number,
         o.user_id
       FROM refunds r
       JOIN orders o ON o.id = r.order_id
       WHERE r.id = ?
       FOR UPDATE`,
      [refundId],
    );

    if (refundRows.length === 0) {
      throw makeError(404, "Refund record not found");
    }

    const refund = refundRows[0];

    const previousStatus = String(refund.status || "pending").toLowerCase();

    if (previousStatus === "completed") {
      throw makeError(400, "Completed refunds cannot be changed");
    }

    if (previousStatus === normalizedStatus) {
      throw makeError(400, `Refund is already ${normalizedStatus}`);
    }

    if (previousStatus === "failed" && normalizedStatus !== "processing") {
      throw makeError(
        400,
        "A failed refund must be moved to processing before another update",
      );
    }

    const suppliedTransactionId =
      typeof refund_transaction_id === "string"
        ? refund_transaction_id.trim()
        : "";

    const existingTransactionId = refund.refund_transaction_id || "";

    const finalTransactionId =
      suppliedTransactionId || existingTransactionId || null;

    if (normalizedStatus === "completed" && !finalTransactionId) {
      throw makeError(
        400,
        "A refund transaction/reference ID is required before marking a refund completed",
      );
    }

    const normalizedNote =
      typeof note === "string" && note.trim()
        ? note.trim()
        : `Refund status updated to ${normalizedStatus} by admin`;

    // Capture the values before the update.
    const oldValues = {
      status: previousStatus,
      refund_transaction_id: refund.refund_transaction_id || null,
      completed_at: refund.completed_at || null,
    };

    await connection.query(
      `UPDATE refunds
       SET status = ?,
           refund_transaction_id = ?,
           completed_at = CASE
             WHEN ? = 'completed' THEN NOW()
             ELSE NULL
           END
       WHERE id = ?`,
      [normalizedStatus, finalTransactionId, normalizedStatus, refundId],
    );

    // Preserve the existing refund status history.
    await connection.query(
      `INSERT INTO refund_status_history (
         refund_id,
         previous_status,
         status,
         note,
         changed_by
       )
       VALUES (?, ?, ?, ?, ?)`,
      [refundId, previousStatus, normalizedStatus, normalizedNote, adminId],
    );

    // Record the admin's old and new refund values.
    const newValues = {
      status: normalizedStatus,
      refund_transaction_id: finalTransactionId,
      note: normalizedNote,
    };

    await connection.query(
      `INSERT INTO admin_audit_logs
         (
           admin_id,
           action,
           entity_type,
           entity_id,
           old_values,
           new_values,
           ip_address
         )
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        adminId,
        "PATCH /api/admin/refunds/:refund_id/status",
        "refunds",
        refundId,
        JSON.stringify(oldValues),
        JSON.stringify(newValues),
        (req.ip || "").slice(0, 45) || null,
      ],
    );

    // Refund update, status history and audit log commit together.
    await connection.commit();
    transactionStarted = false;

    // Notify only after the database transaction commits.
    try {
      await createNotification({
        userId: refund.user_id,
        type: "refund_status_updated",
        title: "Refund status updated",
        message: `Your refund for order ${refund.order_number} is now ${normalizedStatus}.`,
        data: {
          refund_id: refundId,
          order_id: refund.order_id,
          order_number: refund.order_number,
          return_id: refund.return_id,
          amount: Number(refund.amount),
          status: normalizedStatus,
        },
      });
    } catch (notificationError) {
      console.error("Refund status notification error:", notificationError);
    }

    return res.status(200).json({
      success: true,
      message: "Refund status updated successfully",
      data: {
        refund_id: refundId,
        previous_status: previousStatus,
        status: normalizedStatus,
        refund_transaction_id: finalTransactionId,
        note: normalizedNote,
        money_transferred_by_api: false,
      },
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Refund update rollback error:", rollbackError);
      }
    }

    console.error("Update refund status error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to update refund status",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};
// CUSTOMER: Get refunds belonging only to the logged-in user's orders.
const getMyRefunds = async (req, res) => {
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
      Math.max(1, parseInt(req.query.limit, 10) || 20),
    );
    const offset = (page - 1) * limit;

    const [refunds] = await db.promise().query(
      `SELECT
         r.id AS refund_id,
         r.order_id,
         o.order_number,
         r.return_id,
         r.amount,
         r.reason,
         r.status,
         r.refund_transaction_id,
         r.created_at,
         r.completed_at
       FROM refunds r
       JOIN orders o ON o.id = r.order_id
       WHERE o.user_id = ?
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset],
    );

    const [countRows] = await db.promise().query(
      `SELECT COUNT(*) AS total
       FROM refunds r
       JOIN orders o ON o.id = r.order_id
       WHERE o.user_id = ?`,
      [userId],
    );

    // Include status history for every refund returned.
    for (const refund of refunds) {
      const [history] = await db.promise().query(
        `SELECT previous_status, status, note, created_at
         FROM refund_status_history
         WHERE refund_id = ?
         ORDER BY created_at ASC, id ASC`,
        [refund.refund_id],
      );

      refund.status_history = history;
    }

    const total = Number(countRows[0].total);

    return res.status(200).json({
      success: true,
      data: {
        refunds,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get customer refunds error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch your refunds",
    });
  }
};

module.exports = {
  createRefund,
  getAdminRefunds,
  updateRefundStatus,
  getMyRefunds,
};
