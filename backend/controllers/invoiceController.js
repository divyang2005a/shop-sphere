
const db = require("../config/db");

const isPositiveId = (value) => /^[1-9]\d*$/.test(String(value ?? ""));

// Generate or retrieve an invoice for an order
const generateInvoice = (orderId, userId, isAdmin, res) => {
  if (!/^[1-9]\d*$/.test(String(orderId ?? ""))) {
    return res.status(400).json({
      success: false,
      message: "A valid order ID is required",
    });
  }

  let sql = `
    SELECT
      o.*,
      u.name AS customer_name,
      u.email AS customer_email,
      u.mobile AS customer_mobile,

      ba.name AS billing_name,
      ba.phone AS billing_phone,
      ba.address_line_1 AS billing_address_line_1,
      ba.address_line_2 AS billing_address_line_2,
      ba.city AS billing_city,
      ba.state AS billing_state,
      ba.country AS billing_country,
      ba.pincode AS billing_pincode,

      sa.name AS shipping_name,
      sa.phone AS shipping_phone,
      sa.address_line_1 AS shipping_address_line_1,
      sa.address_line_2 AS shipping_address_line_2,
      sa.city AS shipping_city,
      sa.state AS shipping_state,
      sa.country AS shipping_country,
      sa.pincode AS shipping_pincode

    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    LEFT JOIN addresses ba ON ba.id = o.billing_address_id
    LEFT JOIN addresses sa ON sa.id = o.shipping_address_id
    WHERE o.id = ?
  `;

  const values = [orderId];

  // Customers can access only their own orders.
  if (!isAdmin) {
    if (!isPositiveId(userId)) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    sql += " AND o.user_id = ?";
    values.push(userId);
  }

  sql += " LIMIT 1";

  db.query(sql, values, (orderErr, orderRows) => {
    if (orderErr) {
      console.error("Invoice order query error:", orderErr);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch order for invoice",
      });
    }

    if (orderRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const order = orderRows[0];

    // Reuse the existing invoice if one was already created.
    db.query(
      "SELECT id, invoice_number, invoice_date FROM invoices WHERE order_id = ? LIMIT 1",
      [orderId],
      (invoiceErr, invoiceRows) => {
        if (invoiceErr) {
          console.error("Invoice lookup error:", invoiceErr);
          return res.status(500).json({
            success: false,
            message: "Failed to fetch invoice",
          });
        }

        const returnInvoice = (invoice) => {
          db.query(
            `
              SELECT
                id,
                order_id,
                product_id,
                variant_id,
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
                console.error("Invoice items query error:", itemsErr);
                return res.status(500).json({
                  success: false,
                  message: "Failed to fetch invoice items",
                });
              }

              return res.status(200).json({
                success: true,
                message: "Invoice fetched successfully",
                invoice: {
                  id: invoice.id,
                  invoice_number: invoice.invoice_number,
                  invoice_date: invoice.invoice_date,
                  order_number: order.order_number,
                  order_date: order.created_at,
                  customer: {
                    name: order.customer_name,
                    email: order.customer_email,
                    mobile: order.customer_mobile,
                  },
                  billing_address: {
                    name: order.billing_name,
                    phone: order.billing_phone,
                    address_line_1: order.billing_address_line_1,
                    address_line_2: order.billing_address_line_2,
                    city: order.billing_city,
                    state: order.billing_state,
                    country: order.billing_country,
                    pincode: order.billing_pincode,
                  },
                  shipping_address: {
                    name: order.shipping_name,
                    phone: order.shipping_phone,
                    address_line_1: order.shipping_address_line_1,
                    address_line_2: order.shipping_address_line_2,
                    city: order.shipping_city,
                    state: order.shipping_state,
                    country: order.shipping_country,
                    pincode: order.shipping_pincode,
                  },
                  items,
                  totals: {
                    subtotal: order.subtotal,
                    discount: order.discount,
                    coupon_discount: order.coupon_discount,
                    tax: order.tax,
                    shipping_fee: order.shipping_fee,
                    total_amount: order.total_amount,
                  },
                  payment_status: order.payment_status,
                  order_status: order.order_status,
                },
              });
            }
          );
        };

        if (invoiceRows.length > 0) {
          return returnInvoice(invoiceRows[0]);
        }

        const invoiceNumber = `SS-INV-${order.order_number}`;

        db.query(
          `
            INSERT INTO invoices (order_id, invoice_number)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
          `,
          [orderId, invoiceNumber],
          (insertErr, result) => {
            if (insertErr) {
              console.error("Invoice creation error:", insertErr);
              return res.status(500).json({
                success: false,
                message: "Failed to create invoice",
              });
            }

            db.query(
              `
                SELECT id, invoice_number, invoice_date
                FROM invoices
                WHERE order_id = ?
                LIMIT 1
              `,
              [orderId],
              (savedErr, savedRows) => {
                if (savedErr || savedRows.length === 0) {
                  console.error("Saved invoice lookup error:", savedErr);
                  return res.status(500).json({
                    success: false,
                    message: "Failed to retrieve created invoice",
                  });
                }

                returnInvoice(savedRows[0]);
              }
            );
          }
        );
      }
    );
  });
};

// Customer: invoice for own order
const getOrderInvoice = (req, res) => {
  const userId = req.user?.user_id ?? req.user?.id;

  generateInvoice(req.params.orderId, userId, false, res);
};

// Admin: invoice for any order
const getAdminOrderInvoice = (req, res) => {
  generateInvoice(req.params.order_id, null, true, res);
};

module.exports = {
  getOrderInvoice,
  getAdminOrderInvoice,
};
