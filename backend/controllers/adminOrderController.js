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
              SELECT
                id,
                order_id,
                status,
                note,
                changed_by,
                created_at
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

// Update order status and synchronize shipment tracking
const updateAdminOrderStatus = async (req, res) => {
  let connection;
  let transactionStarted = false;

  try {
    const { order_id } = req.params;
    const { status, note } = req.body || {};

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

    const adminId = req.user?.user_id ?? req.user?.id;

    if (!isPositiveId(adminId)) {
      return res.status(401).json({
        success: false,
        message: "Invalid admin authentication",
      });
    }

    const orderRank = {
      pending: 0,
      confirmed: 1,
      processing: 2,
      packed: 3,
      shipped: 4,
      delivered: 5,
    };

    const shipmentStatusForOrder = {
      packed: "ready_to_ship",
      shipped: "shipped",
      delivered: "delivered",
      cancelled: "cancelled",
    };

    const shipmentRank = {
      pending: 0,
      ready_to_ship: 1,
      shipped: 2,
      in_transit: 3,
      out_for_delivery: 4,
      delivered: 5,
    };

    connection = await db.promise().getConnection();

    await connection.beginTransaction();
    transactionStarted = true;

    // 1. Lock the order row.
    const [orders] = await connection.query(
      `SELECT id, user_id, order_number, order_status
       FROM orders
       WHERE id = ?
       FOR UPDATE`,
      [Number(order_id)],
    );

    if (orders.length === 0) {
      const error = new Error("Order not found");
      error.statusCode = 404;
      throw error;
    }

    const order = orders[0];
    const currentOrderStatus = String(
      order.order_status || "pending",
    ).toLowerCase();

    if (currentOrderStatus === normalizedStatus) {
      const error = new Error(`Order is already ${normalizedStatus}`);
      error.statusCode = 400;
      throw error;
    }

    if (
      currentOrderStatus === "delivered" ||
      currentOrderStatus === "cancelled"
    ) {
      const error = new Error(
        `Cannot change status after order is ${currentOrderStatus}`,
      );
      error.statusCode = 400;
      throw error;
    }

    if (
      normalizedStatus !== "cancelled" &&
      orderRank[normalizedStatus] !== undefined &&
      orderRank[currentOrderStatus] !== undefined &&
      orderRank[normalizedStatus] < orderRank[currentOrderStatus]
    ) {
      const error = new Error(
        `Cannot move order status backwards from ${currentOrderStatus} to ${normalizedStatus}`,
      );
      error.statusCode = 400;
      throw error;
    }

    // 2. Lock the shipment row, if one exists.
    const [shipments] = await connection.query(
      `SELECT id, status, tracking_number
       FROM shipments
       WHERE order_id = ?
       ORDER BY id DESC
       LIMIT 1
       FOR UPDATE`,
      [Number(order_id)],
    );

    const shipment = shipments[0] || null;
    const targetShipmentStatus =
      shipmentStatusForOrder[normalizedStatus] || null;

    // Shipping milestones require a shipment record.
    if (
      ["packed", "shipped", "delivered"].includes(normalizedStatus) &&
      !shipment
    ) {
      const error = new Error(
        "Create a shipment for this order before marking it packed, shipped, or delivered",
      );
      error.statusCode = 409;
      throw error;
    }

    let currentShipmentStatus = null;

    if (shipment) {
      currentShipmentStatus = String(
        shipment.status || "pending",
      ).toLowerCase();

      if (
        ["delivered", "cancelled", "returned"].includes(
          currentShipmentStatus,
        ) &&
        targetShipmentStatus &&
        currentShipmentStatus !== targetShipmentStatus
      ) {
        const error = new Error(
          `Cannot change shipment status after it is ${currentShipmentStatus}`,
        );
        error.statusCode = 400;
        throw error;
      }

      if (
        targetShipmentStatus &&
        targetShipmentStatus !== currentShipmentStatus &&
        targetShipmentStatus !== "cancelled" &&
        shipmentRank[targetShipmentStatus] !== undefined &&
        shipmentRank[currentShipmentStatus] !== undefined &&
        shipmentRank[targetShipmentStatus] < shipmentRank[currentShipmentStatus]
      ) {
        const error = new Error(
          `Cannot move shipment status backwards from ${currentShipmentStatus} to ${targetShipmentStatus}`,
        );
        error.statusCode = 400;
        throw error;
      }

      if (
        normalizedStatus === "cancelled" &&
        currentShipmentStatus === "delivered"
      ) {
        const error = new Error("A delivered shipment cannot be cancelled");
        error.statusCode = 400;
        throw error;
      }
    }

    // 3. Update the order.
    await connection.query(
      `UPDATE orders
       SET order_status = ?, updated_at = NOW()
       WHERE id = ?`,
      [normalizedStatus, Number(order_id)],
    );

    // 4. Insert order status history.
    await connection.query(
      `INSERT INTO order_status_history
         (order_id, status, note, changed_by, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [Number(order_id), normalizedStatus, normalizedNote, Number(adminId)],
    );

    // 5. Synchronize shipment status and its timeline.
    if (
      shipment &&
      targetShipmentStatus &&
      currentShipmentStatus !== targetShipmentStatus
    ) {
      await connection.query(
        `UPDATE shipments
         SET status = ?,
             shipped_at = CASE
               WHEN ? IN (
                 'shipped',
                 'in_transit',
                 'out_for_delivery',
                 'delivered'
               ) AND shipped_at IS NULL
               THEN NOW()
               ELSE shipped_at
             END,
             delivered_at = CASE
               WHEN ? = 'delivered' AND delivered_at IS NULL
               THEN NOW()
               ELSE delivered_at
             END
         WHERE id = ?`,
        [
          targetShipmentStatus,
          targetShipmentStatus,
          targetShipmentStatus,
          shipment.id,
        ],
      );

      await connection.query(
        `INSERT INTO shipment_tracking
           (shipment_id, status, location, description)
         VALUES (?, ?, NULL, ?)`,
        [
          shipment.id,
          targetShipmentStatus,
          `Shipment status updated to ${targetShipmentStatus.replace(
            /_/g,
            " ",
          )} because order status changed to ${normalizedStatus}`,
        ],
      );
    }

    // 6. Insert audit log within the same transaction.
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
        Number(adminId),
        "PATCH /api/admin/orders/:order_id/status",
        "orders",
        Number(order_id),
        JSON.stringify({
          order_status: currentOrderStatus,
          shipment_status: currentShipmentStatus,
        }),
        JSON.stringify({
          order_status: normalizedStatus,
          shipment_status: targetShipmentStatus || currentShipmentStatus,
          note: normalizedNote,
        }),
        (req.ip || "").slice(0, 45) || null,
      ],
    );

    // 7. Commit all database changes together.
    await connection.commit();
    transactionStarted = false;

    connection.release();
    connection = null;

    const responseData = {
      order_id: Number(order_id),
      order_number: order.order_number,
      previous_status: currentOrderStatus,
      order_status: normalizedStatus,
      shipment_id: shipment?.id ?? null,
      previous_shipment_status: currentShipmentStatus,
      shipment_status: targetShipmentStatus || currentShipmentStatus,
      note: normalizedNote,
    };

    // 8. Notification failure must not undo a successful order update.
    try {
      await createNotification({
        userId: order.user_id,
        type: "order_status_updated",
        title: "Order status updated",
        message: `Your order ${order.order_number} is now ${normalizedStatus}.`,
        data: responseData,
      });
    } catch (notificationError) {
      console.error(
        "Admin order status notification error:",
        notificationError,
      );
    }

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: responseData,
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Order status rollback error:", rollbackError);
      }
    }

    console.error("Update admin order status error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to update order status",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};
module.exports = {
  getAdminOrders,
  getAdminOrderById,
  updateAdminOrderStatus,
};
