
const PDFDocument = require("pdfkit");
const db = require("../config/db");

// Shared PDF generator for customers and admins
const generateInvoicePdf = (req, res, isAdmin = false) => {
  const orderId = isAdmin
    ? req.params.order_id
    : req.params.orderId;

  const userId = req.user?.user_id ?? req.user?.id ?? null;

  if (!/^[1-9]\d*$/.test(String(orderId ?? ""))) {
    return res.status(400).json({
      success: false,
      message: "Valid order ID is required",
    });
  }

  if (
    !isAdmin &&
    (!userId || !/^[1-9]\d*$/.test(String(userId)))
  ) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  const sql = `
    SELECT
      i.id AS invoice_id,
      i.invoice_number,
      i.invoice_date,
      o.id AS order_id,
      o.order_number,
      o.created_at AS order_date,
      o.subtotal,
      o.discount,
      o.coupon_discount,
      o.tax,
      o.shipping_fee,
      o.total_amount,
      o.payment_status,
      o.order_status,

      u.name AS customer_name,
      u.email AS customer_email,
      u.mobile AS customer_mobile,

      ba.name AS billing_name,
      ba.phone AS billing_phone,
      ba.address_line_1 AS billing_line1,
      ba.address_line_2 AS billing_line2,
      ba.city AS billing_city,
      ba.state AS billing_state,
      ba.country AS billing_country,
      ba.pincode AS billing_pincode,

      sa.name AS shipping_name,
      sa.phone AS shipping_phone,
      sa.address_line_1 AS shipping_line1,
      sa.address_line_2 AS shipping_line2,
      sa.city AS shipping_city,
      sa.state AS shipping_state,
      sa.country AS shipping_country,
      sa.pincode AS shipping_pincode

    FROM invoices i
    INNER JOIN orders o ON o.id = i.order_id
    LEFT JOIN users u ON u.id = o.user_id
    LEFT JOIN addresses ba ON ba.id = o.billing_address_id
    LEFT JOIN addresses sa ON sa.id = o.shipping_address_id

    WHERE o.id = ?
      AND (? = 1 OR o.user_id = ?)
    LIMIT 1
  `;

  db.query(
    sql,
    [orderId, isAdmin ? 1 : 0, userId],
    (err, rows) => {
      if (err) {
        console.error("Invoice PDF query error:", err);
        return res.status(500).json({
          success: false,
          message: "Failed to fetch invoice",
        });
      }

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Invoice not found for this order",
        });
      }

      const invoice = rows[0];

      db.query(
        `
          SELECT
            sku,
            product_name,
            quantity,
            unit_price,
            discount,
            tax,
            total
          FROM order_items
          WHERE order_id = ?
          ORDER BY id ASC
        `,
        [orderId],
        (itemsErr, items) => {
          if (itemsErr) {
            console.error("Invoice PDF items error:", itemsErr);
            return res.status(500).json({
              success: false,
              message: "Failed to fetch invoice items",
            });
          }

          const doc = new PDFDocument({
            size: "A4",
            margins: {
              top: 45,
              bottom: 45,
              left: 45,
              right: 45,
            },
          });

          const filename = `${String(
            invoice.invoice_number
          ).replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;

          res.setHeader("Content-Type", "application/pdf");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"`
          );

          doc.on("error", (pdfErr) => {
            console.error("Invoice PDF generation error:", pdfErr);

            if (!res.headersSent) {
              res.status(500).end("Failed to generate invoice PDF");
            } else {
              res.destroy(pdfErr);
            }
          });

          doc.pipe(res);

          const money = (value) =>
            `INR ${Number(value || 0).toFixed(2)}`;

          const date = (value) => {
            if (!value) return "-";

            const parsed = new Date(value);

            if (Number.isNaN(parsed.getTime())) {
              return "-";
            }

            return parsed.toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              timeZone: "Asia/Kolkata",
            });
          };

          const addressText = (prefix) => {
            const values = [
              invoice[`${prefix}_name`],
              invoice[`${prefix}_phone`],
              invoice[`${prefix}_line1`],
              invoice[`${prefix}_line2`],
              invoice[`${prefix}_city`],
              invoice[`${prefix}_state`],
              invoice[`${prefix}_country`],
              invoice[`${prefix}_pincode`],
            ].filter(Boolean);

            return values.join("\n") || "-";
          };

          // Invoice heading
          doc.font("Helvetica-Bold")
            .fontSize(24)
            .text("ShopSphere", 45, 45);

          doc.font("Helvetica")
            .fontSize(10)
            .text("INVOICE", 45, 76);

          doc.font("Helvetica-Bold")
            .fontSize(11)
            .text("INVOICE DETAILS", 350, 45, {
              width: 200,
              align: "right",
            });

          doc.font("Helvetica")
            .fontSize(9)
            .text(`Invoice No: ${invoice.invoice_number}`, 300, 63, {
              width: 250,
              align: "right",
            })
            .text(
              `Invoice Date: ${date(invoice.invoice_date)}`,
              300,
              77,
              { width: 250, align: "right" }
            )
            .text(`Order No: ${invoice.order_number}`, 300, 91, {
              width: 250,
              align: "right",
            })
            .text(`Order Date: ${date(invoice.order_date)}`, 300, 105, {
              width: 250,
              align: "right",
            });

          doc.moveTo(45, 130).lineTo(550, 130).stroke();

          // Customer
          doc.font("Helvetica-Bold")
            .fontSize(11)
            .text("CUSTOMER", 45, 145);

          doc.font("Helvetica")
            .fontSize(9)
            .text(invoice.customer_name || "-", 45, 163)
            .text(`Email: ${invoice.customer_email || "-"}`, 45, 178)
            .text(`Mobile: ${invoice.customer_mobile || "-"}`, 45, 193);

          // Billing address
          doc.font("Helvetica-Bold")
            .fontSize(11)
            .text("BILLING ADDRESS", 45, 220);

          doc.font("Helvetica")
            .fontSize(9)
            .text(addressText("billing"), 45, 238, {
              width: 220,
              lineGap: 2,
            });

          // Shipping address
          doc.font("Helvetica-Bold")
            .fontSize(11)
            .text("SHIPPING ADDRESS", 310, 220);

          doc.font("Helvetica")
            .fontSize(9)
            .text(addressText("shipping"), 310, 238, {
              width: 220,
              lineGap: 2,
            });

          // Product table
          let y = 345;

          doc.moveTo(45, y).lineTo(550, y).stroke();

          y += 8;

          doc.font("Helvetica-Bold").fontSize(8);
          doc.text("Product / SKU", 45, y, { width: 150 });
          doc.text("Qty", 205, y, { width: 30, align: "right" });
          doc.text("Unit Price", 240, y, {
            width: 65,
            align: "right",
          });
          doc.text("Discount", 310, y, {
            width: 55,
            align: "right",
          });
          doc.text("Tax", 370, y, { width: 45, align: "right" });
          doc.text("Total", 420, y, {
            width: 130,
            align: "right",
          });

          y += 18;
          doc.moveTo(45, y).lineTo(550, y).stroke();
          y += 8;

          doc.font("Helvetica").fontSize(8);

          for (const item of items) {
            const productText =
              `${item.product_name || "Product"}\nSKU: ${item.sku || "-"}`;

            const productHeight = doc.heightOfString(productText, {
              width: 150,
            });

            const rowHeight = Math.max(24, productHeight + 6);

            if (y + rowHeight > 720) {
              doc.addPage();
              y = 50;

              doc.font("Helvetica-Bold")
                .fontSize(8)
                .text("Product / SKU", 45, y, { width: 150 });
              doc.text("Qty", 205, y, {
                width: 30,
                align: "right",
              });
              doc.text("Unit Price", 240, y, {
                width: 65,
                align: "right",
              });
              doc.text("Discount", 310, y, {
                width: 55,
                align: "right",
              });
              doc.text("Tax", 370, y, {
                width: 45,
                align: "right",
              });
              doc.text("Total", 420, y, {
                width: 130,
                align: "right",
              });

              y += 18;
              doc.moveTo(45, y).lineTo(550, y).stroke();
              y += 8;
              doc.font("Helvetica").fontSize(8);
            }

            doc.text(productText, 45, y, { width: 150 });
            doc.text(String(item.quantity), 205, y, {
              width: 30,
              align: "right",
            });
            doc.text(money(item.unit_price), 240, y, {
              width: 65,
              align: "right",
            });
            doc.text(money(item.discount), 310, y, {
              width: 55,
              align: "right",
            });
            doc.text(money(item.tax), 370, y, {
              width: 45,
              align: "right",
            });
            doc.text(money(item.total), 420, y, {
              width: 130,
              align: "right",
            });

            y += rowHeight;
            doc.moveTo(45, y).lineTo(550, y).stroke();
            y += 7;
          }

          // Totals
          if (y > 630) {
            doc.addPage();
            y = 50;
          } else {
            y += 15;
          }

          const addTotal = (label, value, bold = false) => {
            doc.font(bold ? "Helvetica-Bold" : "Helvetica")
              .fontSize(bold ? 10 : 9);

            doc.text(label, 300, y, { width: 120 });
            doc.text(money(value), 420, y, {
              width: 130,
              align: "right",
            });

            y += 18;
          };

          addTotal("Subtotal", invoice.subtotal);
          addTotal("Discount", invoice.discount);
          addTotal("Coupon Discount", invoice.coupon_discount);
          addTotal("Tax", invoice.tax);
          addTotal("Shipping Fee", invoice.shipping_fee);
          addTotal("Grand Total", invoice.total_amount, true);

          y += 8;
          doc.moveTo(300, y).lineTo(550, y).stroke();
          y += 12;

          if (y > 730) {
            doc.addPage();
            y = 50;
          }

          doc.font("Helvetica-Bold")
            .fontSize(9)
            .text(
              `Payment Status: ${invoice.payment_status || "-"}`,
              45,
              y
            );

          doc.font("Helvetica")
            .fontSize(9)
            .text(
              `Order Status: ${invoice.order_status || "-"}`,
              45,
              y + 16
            );

          doc.fontSize(8).text(
            "Thank you for shopping with ShopSphere.",
            45,
            760,
            { width: 505, align: "center" }
          );

          doc.end();
        }
      );
    }
  );
};

// Customer PDF: only their own order
const getInvoicePdf = (req, res) => {
  return generateInvoicePdf(req, res, false);
};

// Admin PDF: any order, protected by adminMiddleware in the route
const getAdminInvoicePdf = (req, res) => {
  return generateInvoicePdf(req, res, true);
};

module.exports = {
  getInvoicePdf,
  getAdminInvoicePdf,
};
