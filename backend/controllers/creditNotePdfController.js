const db = require("../config/db");
const PDFDocument = require("pdfkit");

const getUserId = (req) =>
  req.user?.user_id ?? req.user?.id;

const isPositiveId = (value) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0;
};

const formatAmount = (amount) =>
  `INR ${Number(amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const generateCreditNotePdf = async (req, res, adminAccess) => {
  try {
    const creditNoteId = Number(req.params.creditNoteId);
    const userId = getUserId(req);

    if (!isPositiveId(creditNoteId)) {
      return res.status(400).json({
        success: false,
        message: "Valid credit note ID is required",
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user",
      });
    }

    const customerCondition = adminAccess
      ? ""
      : "AND o.user_id = ?";

    const queryParams = adminAccess
      ? [creditNoteId]
      : [creditNoteId, userId];

    const [rows] = await db.promise().query(
      `SELECT
         cn.id,
         cn.credit_note_number,
         cn.order_id,
         cn.return_id,
         cn.invoice_id,
         cn.subtotal,
         cn.tax_amount,
         cn.total_amount,
         cn.reason,
         cn.status,
         cn.issued_at,
         o.order_number,
         u.name AS customer_name,
         u.email AS customer_email,
         i.invoice_number,
         r.quantity AS return_quantity,
         r.reason AS return_reason,
         oi.product_name
       FROM credit_notes cn
       JOIN orders o ON o.id = cn.order_id
       JOIN users u ON u.id = o.user_id
       JOIN order_returns r ON r.id = cn.return_id
       JOIN order_items oi
         ON oi.id = r.order_item_id
        AND oi.order_id = cn.order_id
       LEFT JOIN invoices i ON i.id = cn.invoice_id
       WHERE cn.id = ?
       ${customerCondition}
       LIMIT 1`,
      queryParams
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Credit note not found",
      });
    }

    const note = rows[0];

    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: `Credit Note ${note.credit_note_number}`,
        Author: "ShopSphere",
      },
    });

    const filename =
      `${note.credit_note_number}.pdf`.replace(
        /[^a-zA-Z0-9_.-]/g,
        "_"
      );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    doc.on("error", (error) => {
      console.error("Credit note PDF error:", error);

      if (!res.headersSent) {
        res.status(500).end();
      } else {
        res.destroy(error);
      }
    });

    doc.pipe(res);

    doc
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("ShopSphere");

    doc
      .fontSize(18)
      .text("CREDIT NOTE", { align: "right" });

    doc.moveDown();

    doc
      .fontSize(10)
      .font("Helvetica")
      .text(`Credit Note Number: ${note.credit_note_number}`)
      .text(`Issued At: ${new Date(note.issued_at).toLocaleString("en-IN")}`)
      .text(`Status: ${note.status}`)
      .text(`Order Number: ${note.order_number}`)
      .text(`Return Request ID: ${note.return_id}`)
      .text(
        `Original Invoice: ${note.invoice_number || "Not linked"}`
      );

    doc.moveDown();

    doc.font("Helvetica-Bold").fontSize(13).text("Customer Details");
    doc.font("Helvetica").fontSize(10);
    doc.text(`Name: ${note.customer_name || "Customer"}`);
    doc.text(`Email: ${note.customer_email || "Not available"}`);

    doc.moveDown();

    doc.font("Helvetica-Bold").fontSize(13).text("Return Details");
    doc.moveDown(0.5);

    doc.font("Helvetica").fontSize(10);
    doc.text(`Product: ${note.product_name}`);
    doc.text(`Returned Quantity: ${note.return_quantity}`);
    doc.text(`Reason: ${note.return_reason || note.reason || "Not specified"}`);

    doc.moveDown();

    const amountX = 350;

    doc
      .font("Helvetica-Bold")
      .text("Credit Summary", 50);

    doc.moveDown(0.5);

    doc.font("Helvetica").fontSize(11);

    doc.text("Subtotal", amountX, doc.y, {
      continued: true,
      width: 190,
      align: "right",
    });
    doc.text(formatAmount(note.subtotal), {
      align: "right",
    });

    doc.text("Tax", amountX, doc.y, {
      continued: true,
      width: 190,
      align: "right",
    });
    doc.text(formatAmount(note.tax_amount), {
      align: "right",
    });

    doc.moveDown(0.5);

    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .text(
        `Total Credit: ${formatAmount(note.total_amount)}`,
        { align: "right" }
      );

    doc.moveDown(2);

    doc
      .font("Helvetica")
      .fontSize(9)
      .text(
        "This document records the credit issued against an approved return. " +
        "It does not confirm that money has been transferred or refunded."
      );

    doc.moveDown();

    doc
      .fontSize(10)
      .text("Thank you for shopping with ShopSphere.");

    doc.end();
  } catch (error) {
    console.error("Generate credit note PDF error:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to generate credit note PDF",
      });
    }

    res.end();
  }
};

// Customer can download only their own order's credit note.
const getCustomerCreditNotePdf = (req, res) =>
  generateCreditNotePdf(req, res, false);

// Admin can download any credit note.
const getAdminCreditNotePdf = (req, res) =>
  generateCreditNotePdf(req, res, true);

module.exports = {
  getCustomerCreditNotePdf,
  getAdminCreditNotePdf,
};