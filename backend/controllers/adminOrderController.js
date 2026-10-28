const db = require("../config/db");

const { createNotification } = require("../services/notificationService");

const isPositiveId = (value) => /^[1-9]\d*$/.test(String(value ?? ""));

// Get all orders with customer details
const getAdminOrders = (req, res) => {
  const { status, search } = req.query;

  let sql = `
    SELECT
      o.id AS order_id,
      o.order_number,
      o.user_id,
      u.name AS customer_name,
      u.email AS customer_email,
      o.subtotal,
      o.discount,
      o.coupon_discount,
      o.tax,
      o.shipping_fee,
      o.total_amount,
      o.shipping_zone_id,
      sz.name AS delivery_area_name,
      o.payment_method,
      o.payment_status,
      o.order_status,
      o.created_at,
      o.updated_at
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    LEFT JOIN shipping_zones sz ON sz.id = o.shipping_zone_id
    WHERE 1 = 1
  `;

  const values = [];

  if (status) {
    sql += " AND LOWER(o.order_status) = LOWER(?)";
    values.push(String(status).trim());
  }

  if (search) {
    const term = `%${String(search).trim()}%`;
    sql += `
      AND (
        o.order_number LIKE ?
        OR u.name LIKE ?
        OR u.email LIKE ?
      )
    `;
    values.push(term, term, term);
  }

  sql += " ORDER BY o.created_at DESC";

  db.query(sql, values, (err, orders) => {
    if (err) {
      console.error("Get admin orders error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch orders",
      });
    }

    return res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  });
};

// Get one order with items and status history
const getAdminOrderById = (req, res) => {
  const { order_id } = req.params;

  if (!isPositiveId(order_id)) {
    return res.status(400).json({
      success: false,
      message: "A valid order ID is required",
    });
  }

  db.query(
    `
      SELECT
        o.*,
        u.name AS customer_name,
        u.email AS customer_email,
        u.mobile AS customer_mobile
      FROM orders o
      LEFT JOIN users u ON u.id = o.user_id
      WHERE o.id = ?
      LIMIT 1
    `,
    [order_id],
    (orderErr, orderRows) => {
      if (orderErr) {
        console.error("Get admin order error:", orderErr);
        return res.status(500).json({
          success: false,
          message: "Failed to fetch order details",
        });
      }

      if (orderRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      const order = orderRows[0];

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
        [order_id],
        (itemsErr, items) => {
          if (itemsErr) {
            console.error("Get admin order items error:", itemsErr);
            return res.status(500).json({
              success: false,
              message: "Failed to fetch order items",
            });
          }

          db.query(
            `
              SELECT id, order_id, status, note, changed_by, created_at
              FROM order_status_history
              WHERE order_id = ?
              ORDER BY created_at ASC, id ASC
            `,
            [order_id],
            (historyErr, history) => {
              if (historyErr) {
                console.error("Get admin order history error:", historyErr);
                return res.status(500).json({
                  success: false,
                  message: "Failed to fetch order history",
                });
              }

              return res.status(200).json({
                success: true,
                order: {
                  ...order,
                  items,
                  status_history: history,
                },
              });
            },
          );
        },
      );
    },
  );
};

// Update order status

const updateAdminOrderStatus = (req, res) => {
  const { order_id } = req.params;
  const { status, note } = req.body || {};

  // This controller writes its audit record within the same transaction.
  // Prevent the generic middleware from creating a duplicate entry.
  req.skipGenericAudit = true;

  const allowedStatuses = [
    "confirmed",
    "processing",
    "packed",
    "shipped",
    "delivered",
    "cancelled",
  ];

  if (!isPositiveId(order_id)) {
    return res.status(400).json({
      success: false,
      message: "A valid order ID is required",
    });
  }

  if (
    typeof status !== "string" ||
    !allowedStatuses.includes(status.trim().toLowerCase())
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid order status",
      allowed_statuses: allowedStatuses,
    });
  }

  const normalizedStatus = status.trim().toLowerCase();

  const normalizedNote =
    typeof note === "string" && note.trim()
      ? note.trim()
      : `Order status updated to ${normalizedStatus} by admin`;

  if (normalizedNote.length > 2000) {
    return res.status(400).json({
      success: false,
      message: "Note must not exceed 2000 characters",
    });
  }

  const adminId = req.user?.user_id ?? req.user?.id ?? null;

  if (!adminId) {
    return res.status(401).json({
      success: false,
      message: "Invalid admin authentication",
    });
  }

  db.getConnection((connectionErr, connection) => {
    if (connectionErr) {
      console.error("Admin order connection error:", connectionErr);

      return res.status(500).json({
        success: false,
        message: "Database connection failed",
      });
    }

    connection.beginTransaction((transactionErr) => {
      if (transactionErr) {
        connection.release();

        console.error("Begin order transaction error:", transactionErr);

        return res.status(500).json({
          success: false,
          message: "Failed to start order update",
        });
      }

      connection.query(
        `SELECT id, user_id, order_number, order_status
         FROM orders
         WHERE id = ?
         FOR UPDATE`,
        [order_id],
        (selectErr, rows) => {
          if (selectErr) {
            return connection.rollback(() => {
              connection.release();
              console.error("Select order status error:", selectErr);

              return res.status(500).json({
                success: false,
                message: "Failed to check order status",
              });
            });
          }

          if (!rows || rows.length === 0) {
            return connection.rollback(() => {
              connection.release();

              return res.status(404).json({
                success: false,
                message: "Order not found",
              });
            });
          }

          const currentStatus = String(
            rows[0].order_status || "",
          ).toLowerCase();

          if (currentStatus === normalizedStatus) {
            return connection.rollback(() => {
              connection.release();

              return res.status(400).json({
                success: false,
                message: `Order is already ${normalizedStatus}`,
              });
            });
          }

          if (["cancelled", "delivered"].includes(currentStatus)) {
            return connection.rollback(() => {
              connection.release();

              return res.status(400).json({
                success: false,
                message: `Cannot change status after order is ${currentStatus}`,
              });
            });
          }

          connection.query(
            "UPDATE orders SET order_status = ? WHERE id = ?",
            [normalizedStatus, order_id],
            (updateErr) => {
              if (updateErr) {
                return connection.rollback(() => {
                  connection.release();
                  console.error("Update order status error:", updateErr);

                  return res.status(500).json({
                    success: false,
                    message: "Failed to update order status",
                  });
                });
              }

              connection.query(
                `INSERT INTO order_status_history
                  (order_id, status, note, changed_by, created_at)
                 VALUES (?, ?, ?, ?, NOW())`,
                [order_id, normalizedStatus, normalizedNote, adminId],
                (historyErr) => {
                  if (historyErr) {
                    return connection.rollback(() => {
                      connection.release();
                      console.error("Insert order history error:", historyErr);

                      return res.status(500).json({
                        success: false,
                        message: "Failed to save order status history",
                      });
                    });
                  }

                  // Audit log is part of the same transaction.
                  const auditSql = `
                    INSERT INTO admin_audit_logs
                      (
                        admin_id,
                        action,
                        entity_type,
                        entity_id,
                        old_values,
                        new_values,
                        ip_address
                      )
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                  `;

                  const auditValues = [
                    adminId,
                    "PATCH /api/admin/orders/:order_id/status",
                    "orders",
                    Number(order_id),
                    JSON.stringify({
                      order_status: currentStatus,
                    }),
                    JSON.stringify({
                      order_status: normalizedStatus,
                      note: normalizedNote,
                    }),
                    (req.ip || "").slice(0, 45) || null,
                  ];

                  connection.query(auditSql, auditValues, (auditErr) => {
                    if (auditErr) {
                      return connection.rollback(() => {
                        connection.release();
                        console.error("Order audit log error:", auditErr);

                        return res.status(500).json({
                          success: false,
                          message: "Failed to save order audit log",
                        });
                      });
                    }

                    connection.commit((commitErr) => {
                      if (commitErr) {
                        return connection.rollback(() => {
                          connection.release();
                          console.error(
                            "Commit order status error:",
                            commitErr,
                          );

                          return res.status(500).json({
                            success: false,
                            message: "Failed to save order update",
                          });
                        });
                      }

                      connection.release();

                      const statusResponse = {
                        success: true,
                        message: "Order status updated successfully",
                        data: {
                          order_id: Number(order_id),
                          previous_status: currentStatus,
                          order_status: normalizedStatus,
                          note: normalizedNote,
                        },
                      };

                      // Notify the customer after the transaction commits.
                      createNotification({
                        userId: rows[0].user_id,
                        type: "order_status_updated",
                        title: "Order status updated",
                        message: `Your order ${rows[0].order_number} is now ${normalizedStatus}.`,
                        data: {
                          order_id: Number(order_id),
                          order_number: rows[0].order_number,
                          previous_status: currentStatus,
                          order_status: normalizedStatus,
                        },
                      })
                        .then(() => {
                          return res.status(200).json(statusResponse);
                        })
                        .catch((notificationError) => {
                          console.error(
                            "Admin order status notification error:",
                            notificationError,
                          );

                          // The order is already committed successfully.
                          return res.status(200).json(statusResponse);
                        });
                    });
                  });
                },
              );
            },
          );
        },
      );
    });
  });
};

module.exports = {
  getAdminOrders,
  getAdminOrderById,
  updateAdminOrderStatus,
};
