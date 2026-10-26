
const PDFDocument = require("pdfkit");
const db = require("../config/db");

const getPackingSlipPdf = (req, res) => {
  const orderId = req.params.order_id;

  if (!/^[1-9]\d*$/.test(String(orderId ?? ""))) {
    return res.status(400).json({
      success: false,
      message: "Valid order ID is required",
    });
  }

  const orderSql = `
    SELECT
      o.id AS order_id,
      o.order_number,
      o.created_at AS order_date,
      o.order_status,
      u.name AS customer_name,
      u.email AS customer_email,
      sa.name AS shipping_name,
      sa.phone AS shipping_phone,
      sa.address_line_1 AS shipping_line1,
      sa.address_line_2 AS shipping_line2,
      sa.city AS shipping_city,
      sa.state AS shipping_state,
      sa.country AS shipping_country,
      sa.pincode AS shipping_pincode
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    LEFT JOIN addresses sa ON sa.id = o.shipping_address_id
    WHERE o.id = ?
    LIMIT 1
  `;

  db.query(orderSql, [orderId], (err, rows) => {
    if (err) {
      console.error("Packing slip order query error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch order details",
      });
    }

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const order = rows[0];

    db.query(
      `SELECT product_name, sku, quantity
       FROM order_items
       WHERE order_id = ?
       ORDER BY id ASC`,
      [orderId],
      (itemsErr, items) => {
        if (itemsErr) {
          console.error("Packing slip items query error:", itemsErr);
          return res.status(500).json({
            success: false,
            message: "Failed to fetch order items",
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

        const filename = `packing-slip-${order.order_number}.pdf`
          .replace(/[^a-zA-Z0-9._-]/g, "_");

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`
        );

        doc.on("error", (pdfErr) => {
          console.error("Packing slip PDF error:", pdfErr);

          if (!res.headersSent) {
            res.status(500).end("Failed to generate packing slip");
          } else {
            res.destroy(pdfErr);
          }
        });

        doc.pipe(res);

        const formatDate = (value) => {
          if (!value) return "-";

          const date = new Date(value);

          if (Number.isNaN(date.getTime())) return "-";

          return date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            timeZone: "Asia/Kolkata",
          });
        };

        const address = [
          order.shipping_name,
          order.shipping_phone,
          order.shipping_line1,
          order.shipping_line2,
          order.shipping_city,
          order.shipping_state,
          order.shipping_country,
          order.shipping_pincode,
        ]
          .filter(Boolean)
          .join("\n") || "-";

        doc
          .font("Helvetica-Bold")
          .fontSize(24)
          .text("ShopSphere");

        doc
          .font("Helvetica-Bold")
          .fontSize(17)
          .text("PACKING SLIP", { align: "right" });

        doc.moveDown(1.5);

        doc.font("Helvetica-Bold").fontSize(11);
        doc.text(`Order Number: ${order.order_number}`);
        doc.font("Helvetica").fontSize(10);
        doc.text(`Order Date: ${formatDate(order.order_date)}`);
        doc.text(`Order Status: ${order.order_status || "-"}`);

        doc.moveDown();

        doc.font("Helvetica-Bold").fontSize(12);
        doc.text("SHIP TO");

        doc.moveDown(0.4);
        doc.font("Helvetica").fontSize(10);
        doc.text(address, { width: 300 });

        doc.moveDown(1.5);

        let y = doc.y;

        doc.moveTo(45, y).lineTo(550, y).stroke();
        y += 10;

        const drawHeader = () => {
          doc.font("Helvetica-Bold").fontSize(9);
          doc.text("Product", 45, y, { width: 220 });
          doc.text("SKU", 275, y, { width: 100 });
          doc.text("Quantity", 400, y, {
            width: 150,
            align: "right",
          });

          y += 20;
          doc.moveTo(45, y).lineTo(550, y).stroke();
          y += 10;
        };

        drawHeader();

        for (const item of items) {
          const productName = item.product_name || "Product";
          const productHeight = doc.heightOfString(productName, {
            width: 220,
          });
          const rowHeight = Math.max(22, productHeight + 6);

          if (y + rowHeight > 740) {
            doc.addPage();
            y = 45;
            drawHeader();
          }

          doc.font("Helvetica").fontSize(9);
          doc.text(productName, 45, y, { width: 220 });
          doc.text(String(item.sku || "-"), 275, y, {
            width: 100,
          });
          doc.text(String(item.quantity), 400, y, {
            width: 150,
            align: "right",
          });

          y += rowHeight;
          doc.moveTo(45, y).lineTo(550, y).stroke();
          y += 8;
        }

        doc.moveDown(2);
        doc.font("Helvetica-Bold").fontSize(10);
        doc.text(`Total different products: ${items.length}`);

        const totalQuantity = items.reduce(
          (total, item) => total + Number(item.quantity || 0),
          0
        );

        doc.text(`Total units to pack: ${totalQuantity}`);

        doc.moveDown(2);
        doc.font("Helvetica").fontSize(9);
        doc.text(
          "Please verify all items and quantities before dispatch.",
          { align: "center" }
        );

        doc.end();
      }
    );
  });
};

module.exports = { getPackingSlipPdf };
