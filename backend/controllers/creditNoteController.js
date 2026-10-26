const db = require("../config/db");
const { createNotification } = require("../services/notificationService");

const createCreditNote = async (req, res) => {
  let connection;
  let transactionStarted = false;

  try {
    const returnId = Number(req.params.return_id);
    const adminId = req.user?.user_id ?? req.user?.id ?? null;

    if (!Number.isSafeInteger(returnId) || returnId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid return ID is required",
      });
    }

    connection = await db.promise().getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    // Lock the return request and get the original item amounts.
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
         o.order_number
       FROM order_returns r
       JOIN order_items oi
         ON oi.id = r.order_item_id
        AND oi.order_id = r.order_id
       JOIN orders o ON o.id = r.order_id
       WHERE r.id = ?
       FOR UPDATE`,
      [returnId]
    );

    if (returns.length === 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(404).json({
        success: false,
        message: "Return request not found",
      });
    }

    const returnRecord = returns[0];

    if (returnRecord.return_status !== "approved") {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: "Only approved return requests can have a credit note",
      });
    }

    // Prevent multiple credit notes for the same return.
    const [existingNotes] = await connection.query(
      `SELECT id, credit_note_number, total_amount, status
       FROM credit_notes
       WHERE return_id = ?
       LIMIT 1`,
      [returnId]
    );

    if (existingNotes.length > 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(409).json({
        success: false,
        message: "A credit note already exists for this return",
        data: existingNotes[0],
      });
    }

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
      throw new Error("Invalid return quantity or original item amounts");
    }

    const roundMoney = (amount) =>
      Math.round((amount + Number.EPSILON) * 100) / 100;

    // Allocate the original discount and tax proportionally
    // when only part of an item's quantity is being returned.
    const subtotal = roundMoney(
      unitPrice * returnQuantity -
        (itemDiscount * returnQuantity) / orderedQuantity
    );

    const taxAmount = roundMoney(
      (itemTax * returnQuantity) / orderedQuantity
    );

    const totalAmount = roundMoney(subtotal + taxAmount);

    // Find the original invoice, if one exists.
    const [invoices] = await connection.query(
      `SELECT id
       FROM invoices
       WHERE order_id = ?
       LIMIT 1`,
      [returnRecord.order_id]
    );

    const invoiceId = invoices.length > 0 ? invoices[0].id : null;

    const creditNoteNumber =
      `SS-CN-${returnRecord.order_id}-${returnId}`;

    const [insertResult] = await connection.query(
      `INSERT INTO credit_notes (
         credit_note_number,
         order_id,
         return_id,
         invoice_id,
         subtotal,
         tax_amount,
         total_amount,
         reason,
         status,
         created_by,
         issued_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'issued', ?, NOW())`,
      [
        creditNoteNumber,
        returnRecord.order_id,
        returnId,
        invoiceId,
        subtotal,
        taxAmount,
        totalAmount,
        returnRecord.reason,
        adminId,
      ]
    );

    await connection.commit();
    transactionStarted = false;

    // Notify the customer after the credit note has been saved.
    // Notification failure must not undo the credit note.
    try {
      await createNotification({
        userId: returnRecord.user_id,
        type: "credit_note_issued",
        title: "Credit note issued",
        message:
          `Credit note ${creditNoteNumber} has been issued for return request ${returnId}.`,
        data: {
          credit_note_id: insertResult.insertId,
          credit_note_number: creditNoteNumber,
          order_id: returnRecord.order_id,
          order_number: returnRecord.order_number,
          return_id: returnId,
          total_amount: totalAmount,
          status: "issued",
        },
      });
    } catch (notificationError) {
      console.error(
        "Credit note notification error:",
        notificationError
      );
    }

    return res.status(201).json({
      success: true,
      message: "Credit note issued successfully",
      data: {
        id: insertResult.insertId,
        credit_note_number: creditNoteNumber,
        order_id: returnRecord.order_id,
        order_number: returnRecord.order_number,
        return_id: returnId,
        invoice_id: invoiceId,
        product_name: returnRecord.product_name,
        quantity: returnQuantity,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        reason: returnRecord.reason,
        status: "issued",
      },
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Credit note rollback error:", rollbackError);
      }
    }

    console.error("Create credit note error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A credit note already exists for this return",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to issue credit note",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Admin: List credit notes
const getCreditNotes = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 20)
    );
    const offset = (page - 1) * limit;

    const [notes] = await db.promise().execute(
      `SELECT
         cn.id,
         cn.credit_note_number,
         cn.order_id,
         o.order_number,
         cn.return_id,
         cn.invoice_id,
         cn.subtotal,
         cn.tax_amount,
         cn.total_amount,
         cn.reason,
         cn.status,
         cn.created_by,
         cn.issued_at
       FROM credit_notes cn
       JOIN orders o ON o.id = cn.order_id
       ORDER BY cn.issued_at DESC, cn.id DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [countResult] = await db.promise().query(
      "SELECT COUNT(*) AS total FROM credit_notes"
    );

    const total = Number(countResult[0].total);

    return res.status(200).json({
      success: true,
      data: {
        credit_notes: notes,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get credit notes error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch credit notes",
    });
  }
};

module.exports = {
  createCreditNote,
  getCreditNotes,
};