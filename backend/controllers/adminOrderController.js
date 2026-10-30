const db = require("../config/db");
const { createNotification } = require("../services/notificationService");

const isPositiveId = (value) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0;
};

const toMinorUnits = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
};

// Send the final notification only when the order is delivered AND paid.
// Check for an existing notification to avoid sending it twice.
const notifyDeliveredAndPaid = async (connection, order) => {
  if (
    String(order.order_status).toLowerCase() !== "delivered" ||
    String(order.payment_status).toLowerCase() !== "paid"
  ) {
    return false;
  }

  const [existingNotifications] = await connection.query(
    `SELECT id
     FROM notifications
     WHERE user_id = ?
       AND type = 'order_delivered_paid'
       AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.order_id')) = ?
     LIMIT 1`,
    [order.user_id, String(order.id)],
  );

  if (existingNotifications.length > 0) {
    return false;
  }

  await createNotification({
    userId: order.user_id,
    type: "order_delivered_paid",
    title: "Order delivered and payment confirmed",
    message: `Your order ${order.order_number} has been delivered and its payment has been confirmed.`,
    data: {
      order_id: Number(order.id),
      order_number: order.order_number,
      order_status: "delivered",
      payment_status: "paid",
    },
  });

  return true;
};

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
    [Number(order_id)],
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
        [Number(order_id)],
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
            [Number(order_id)],
            (historyErr, history) => {
              if (historyErr) {
                console.error(
                  "Get admin order history error:",
                  historyErr,
                );

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
    const orderId = Number(req.params.order_id);
    const { status, note } = req.body || {};

    const adminId = req.user?.user_id ?? req.user?.id;

    req.skipGenericAudit = true;

    const allowedStatuses = [
      "confirmed",
      "processing",
      "packed",
      "shipped",
      "delivered",
      "cancelled",
    ];

    if (!isPositiveId(orderId)) {
      return res.status(400).json({
        success: false,
        message: "A valid order ID is required",
      });
    }

    if (!isPositiveId(adminId)) {
      return res.status(401).json({
        success: false,
        message: "Invalid admin authentication",
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

    const terminalShipmentStatuses = [
      "delivered",
      "cancelled",
      "returned",
      "failed_delivery",
    ];

    connection = await db.promise().getConnection();

    await connection.beginTransaction();
    transactionStarted = true;

    // 1. Lock the order and read its payment status.
    const [orders] = await connection.query(
      `
        SELECT
          id,
          user_id,
          order_number,
          order_status,
          payment_status
        FROM orders
        WHERE id = ?
        FOR UPDATE
      `,
      [orderId],
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

    if (["delivered", "cancelled"].includes(currentOrderStatus)) {
      const error = new Error(
        `Cannot change status after order is ${currentOrderStatus}`,
      );
      error.statusCode = 400;
      throw error;
    }

    // Prevent order status regression.
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

    // 2. Lock the shipment, if one exists.
    const [shipments] = await connection.query(
      `
        SELECT id, status, tracking_number
        FROM shipments
        WHERE order_id = ?
        ORDER BY id DESC
        LIMIT 1
        FOR UPDATE
      `,
      [orderId],
    );

    const shipment = shipments[0] || null;

    const targetShipmentStatus =
      shipmentStatusForOrder[normalizedStatus] || null;

    if (
      ["packed", "shipped", "delivered"].includes(normalizedStatus) &&
      !shipment
    ) {
      const error = new Error(
        "Create a shipment before marking this order packed, shipped, or delivered",
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
        terminalShipmentStatuses.includes(currentShipmentStatus) &&
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
        normalizedStatus === "cancelled" &&
        currentShipmentStatus === "delivered"
      ) {
        const error = new Error(
          "A delivered shipment cannot be cancelled",
        );
        error.statusCode = 400;
        throw error;
      }

      if (
        targetShipmentStatus &&
        targetShipmentStatus !== "cancelled" &&
        shipmentRank[targetShipmentStatus] !== undefined &&
        shipmentRank[currentShipmentStatus] !== undefined &&
        shipmentRank[targetShipmentStatus] <
          shipmentRank[currentShipmentStatus]
      ) {
        const error = new Error(
          `Cannot move shipment status backwards from ${currentShipmentStatus} to ${targetShipmentStatus}`,
        );
        error.statusCode = 400;
        throw error;
      }

      if (
        normalizedStatus === "cancelled" &&
        terminalShipmentStatuses.includes(currentShipmentStatus) &&
        currentShipmentStatus !== "cancelled"
      ) {
        const error = new Error(
          `Cannot cancel a shipment that is ${currentShipmentStatus}`,
        );
        error.statusCode = 400;
        throw error;
      }
    }

    // 3. Update the order status.
    await connection.query(
      `
        UPDATE orders
        SET order_status = ?, updated_at = NOW()
        WHERE id = ?
      `,
      [normalizedStatus, orderId],
    );

    // 4. Add order status history.
    await connection.query(
      `
        INSERT INTO order_status_history
          (order_id, status, note, changed_by, created_at)
        VALUES (?, ?, ?, ?, NOW())
      `,
      [orderId, normalizedStatus, normalizedNote, Number(adminId)],
    );

    // 5. Synchronize shipment and its timeline.
    let finalShipmentStatus = currentShipmentStatus;

    if (
      shipment &&
      targetShipmentStatus &&
      currentShipmentStatus !== targetShipmentStatus
    ) {
      await connection.query(
        `
          UPDATE shipments
          SET status = ?,
              shipped_at = CASE
                WHEN ? IN (
                  'shipped',
                  'in_transit',
                  'out_for_delivery',
                  'delivered'
                )
                AND shipped_at IS NULL
                THEN NOW()
                ELSE shipped_at
              END,
              delivered_at = CASE
                WHEN ? = 'delivered'
                AND delivered_at IS NULL
                THEN NOW()
                ELSE delivered_at
              END
          WHERE id = ?
        `,
        [
          targetShipmentStatus,
          targetShipmentStatus,
          targetShipmentStatus,
          shipment.id,
        ],
      );

      await connection.query(
        `
          INSERT INTO shipment_tracking
            (shipment_id, status, location, description)
          VALUES (?, ?, NULL, ?)
        `,
        [
          shipment.id,
          targetShipmentStatus,
          `Shipment status updated to ${targetShipmentStatus.replace(
            /_/g,
            " ",
          )} because order status changed to ${normalizedStatus}`,
        ],
      );

      finalShipmentStatus = targetShipmentStatus;
    }

    // 6. Record the audit log.
    await connection.query(
      `
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
      `,
      [
        Number(adminId),
        "PATCH /api/admin/orders/:order_id/status",
        "orders",
        orderId,
        JSON.stringify({
          order_status: currentOrderStatus,
          shipment_status: currentShipmentStatus,
          payment_status: order.payment_status,
        }),
        JSON.stringify({
          order_status: normalizedStatus,
          shipment_status: finalShipmentStatus,
          payment_status: order.payment_status,
          note: normalizedNote,
        }),
        (req.ip || "").slice(0, 45) || null,
      ],
    );

    // 7. Commit the database changes.
    await connection.commit();
    transactionStarted = false;

    connection.release();
    connection = null;

    const responseData = {
      order_id: orderId,
      order_number: order.order_number,
      previous_status: currentOrderStatus,
      order_status: normalizedStatus,
      payment_status: order.payment_status,
      shipment_id: shipment?.id ?? null,
      previous_shipment_status: currentShipmentStatus,
      shipment_status: finalShipmentStatus,
      note: normalizedNote,
    };

    // 8. Send a regular notification for non-delivery status changes.
    // Delivery notification is handled separately and requires payment too.
    if (normalizedStatus !== "delivered") {
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
    } else if (
      String(order.payment_status).toLowerCase() === "paid"
    ) {
      // Order is delivered and already paid.
      try {
        const notificationConnection = await db.promise().getConnection();

        try {
          await notifyDeliveredAndPaid(notificationConnection, {
            ...order,
            id: orderId,
            order_status: "delivered",
            payment_status: "paid",
          });
        } finally {
          notificationConnection.release();
        }
      } catch (notificationError) {
        console.error(
          "Delivered-and-paid notification error:",
          notificationError,
        );
      }
    }

    return res.status(200).json({
      success: true,
      message:
        normalizedStatus === "delivered" &&
        String(order.payment_status).toLowerCase() !== "paid"
          ? "Order delivered. Final customer notification will be sent after payment is confirmed."
          : "Order status updated successfully",
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

// Admin manually confirms that payment was actually received.
const confirmOrderPayment = async (req, res) => {
  let connection;
  let transactionStarted = false;

  try {
    const orderIdValue = req.params.order_id;
    const orderId = Number(orderIdValue);
    const adminId = req.user?.user_id ?? req.user?.id;

    req.skipGenericAudit = true;

    if (
      !/^[1-9]\d*$/.test(String(orderIdValue ?? "")) ||
      !isPositiveId(orderId)
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid order ID is required",
      });
    }

    if (!isPositiveId(adminId)) {
      return res.status(401).json({
        success: false,
        message: "Invalid admin authentication",
      });
    }

    const requestBody = req.body;
    if (
      requestBody !== undefined &&
      requestBody !== null &&
      (typeof requestBody !== "object" ||
        Array.isArray(requestBody) ||
        Object.keys(requestBody).length > 0)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Do not submit payment status, transaction IDs, or payment credentials. Confirm only after independently verifying receipt.",
      });
    }

    connection = await db.promise().getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    // Lock order to prevent concurrent payment confirmation.
    const [orders] = await connection.query(
      `
        SELECT
          id,
          user_id,
          order_number,
          order_status,
          payment_status,
          payment_method,
          total_amount
        FROM orders
        WHERE id = ?
        FOR UPDATE
      `,
      [orderId],
    );

    if (orders.length === 0) {
      const error = new Error("Order not found");
      error.statusCode = 404;
      throw error;
    }

    const order = orders[0];
    const orderStatus = String(order.order_status || "")
      .trim()
      .toLowerCase();
    const paymentStatus = String(order.payment_status || "")
      .trim()
      .toLowerCase();

    if (orderStatus === "cancelled") {
      const error = new Error(
        "Payment cannot be confirmed for a cancelled order",
      );
      error.statusCode = 400;
      throw error;
    }

    const allowedOrderStatuses = new Set([
      "pending",
      "confirmed",
      "processing",
      "packed",
      "shipped",
      "delivered",
    ]);

    if (!allowedOrderStatuses.has(orderStatus)) {
      const error = new Error(
        `Payment cannot be confirmed while order is ${orderStatus || "invalid"}`,
      );
      error.statusCode = 409;
      throw error;
    }

    if (paymentStatus === "paid") {
      const error = new Error("Payment has already been confirmed");
      error.statusCode = 409;
      throw error;
    }

    if (paymentStatus !== "pending") {
      const error = new Error(
        `Payment cannot transition from ${paymentStatus || "invalid"} to paid`,
      );
      error.statusCode = 409;
      throw error;
    }

    const orderPaymentMethod = String(order.payment_method || "").trim();
    if (!orderPaymentMethod) {
      const error = new Error("The order has no payment method recorded");
      error.statusCode = 409;
      throw error;
    }

    const [orderPaymentMethods] = await connection.query(
      `SELECT code, name
       FROM payment_methods
       WHERE LOWER(code) = LOWER(?) OR LOWER(name) = LOWER(?)
       LIMIT 1
       FOR UPDATE`,
      [orderPaymentMethod, orderPaymentMethod],
    );

    if (!orderPaymentMethods.length) {
      const error = new Error("The order has an unsupported payment method");
      error.statusCode = 409;
      throw error;
    }

    const orderPaymentMethodCode = String(orderPaymentMethods[0].code || "")
      .trim()
      .toLowerCase();
    if (!["cod", "upi", "card"].includes(orderPaymentMethodCode)) {
      const error = new Error("The order has an unsupported payment method");
      error.statusCode = 409;
      throw error;
    }

    if (orderPaymentMethodCode === "cod" && orderStatus !== "delivered") {
      const error = new Error(
        "COD payment can only be confirmed after delivery and independent cash-receipt verification",
      );
      error.statusCode = 409;
      throw error;
    }

    const [payments] = await connection.query(
      `
        SELECT id, user_id, payment_method, amount, status
        FROM payments
        WHERE order_id = ?
        ORDER BY id DESC
        FOR UPDATE
      `,
      [orderId],
    );

    if (payments.length > 1) {
      const error = new Error(
        "Multiple payment records exist for this order; manual reconciliation is required",
      );
      error.statusCode = 409;
      throw error;
    }

    if (payments.length === 1) {
      const payment = payments[0];
      const paymentRecordStatus = String(payment.status || "")
        .trim()
        .toLowerCase();

      if (paymentRecordStatus !== "pending") {
        const error = new Error(
          `Payment record cannot transition from ${paymentRecordStatus || "invalid"} to paid`,
        );
        error.statusCode = 409;
        throw error;
      }

      if (
        Number(payment.user_id) !== Number(order.user_id) ||
        toMinorUnits(payment.amount) === null ||
        toMinorUnits(payment.amount) !== toMinorUnits(order.total_amount)
      ) {
        const error = new Error(
          "Payment record does not match the order; manual reconciliation is required",
        );
        error.statusCode = 409;
        throw error;
      }

      const [paymentMethods] = await connection.query(
        `SELECT code, name
         FROM payment_methods
         WHERE LOWER(code) = LOWER(?) OR LOWER(name) = LOWER(?)
         LIMIT 1
         FOR UPDATE`,
        [payment.payment_method, payment.payment_method],
      );

      if (
        !paymentMethods.length ||
        String(paymentMethods[0].code || "").trim().toLowerCase() !==
          orderPaymentMethodCode
      ) {
        const error = new Error(
          "Payment record method does not match the order",
        );
        error.statusCode = 409;
        throw error;
      }

      const [paymentUpdate] = await connection.query(
        `
          UPDATE payments
          SET status = 'paid',
              paid_at = NOW(),
              updated_at = NOW()
          WHERE id = ? AND status = 'pending'
        `,
        [payment.id],
      );

      if (paymentUpdate.affectedRows !== 1) {
        const error = new Error("Payment record is no longer pending");
        error.statusCode = 409;
        throw error;
      }
    } else {
      // Supports orders created before payment records were introduced.
      await connection.query(
        `
          INSERT INTO payments
            (order_id, user_id, payment_method, amount, status, paid_at)
          VALUES (?, ?, ?, ?, 'paid', NOW())
        `,
        [
          orderId,
          order.user_id,
          orderPaymentMethod,
          order.total_amount,
        ],
      );
    }

    const [orderUpdate] = await connection.query(
      `
        UPDATE orders
        SET payment_status = 'paid',
            updated_at = NOW()
        WHERE id = ? AND payment_status = 'pending'
          AND order_status <> 'cancelled'
      `,
      [orderId],
    );

    if (orderUpdate.affectedRows !== 1) {
      const error = new Error(
        "Order payment status changed before confirmation",
      );
      error.statusCode = 409;
      throw error;
    }

    // Record the payment confirmation in the admin audit log.
    await connection.query(
      `
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
      `,
      [
        Number(adminId),
        "PATCH /api/admin/orders/:order_id/payment-status",
        "orders",
        orderId,
        JSON.stringify({
          payment_status: paymentStatus,
          order_status: orderStatus,
        }),
        JSON.stringify({
          payment_status: "paid",
          payment_method: order.payment_method,
          amount: order.total_amount,
        }),
        (req.ip || "").slice(0, 45) || null,
      ],
    );

    await connection.commit();
    transactionStarted = false;

    connection.release();
    connection = null;

    // Notify customer after the transaction is committed.
    try {
      await createNotification({
        userId: order.user_id,
        type: "payment_confirmed",
        title: "Payment confirmed",
        message: `Payment for order ${order.order_number} has been confirmed.`,
        data: {
          order_id: Number(orderId),
          order_number: order.order_number,
          payment_status: "paid",
          payment_method: order.payment_method,
          amount: Number(order.total_amount),
        },
      });
    } catch (notificationError) {
      console.error(
        "Payment confirmation notification error:",
        notificationError,
      );
    }

    // If the order was already delivered, send the final notification now.
    if (orderStatus === "delivered") {
      try {
        const notificationConnection = await db.promise().getConnection();

        try {
          await notifyDeliveredAndPaid(notificationConnection, {
            ...order,
            id: orderId,
            order_status: "delivered",
            payment_status: "paid",
          });
        } finally {
          notificationConnection.release();
        }
      } catch (notificationError) {
        console.error(
          "Delivered-and-paid notification error:",
          notificationError,
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: "Payment confirmed successfully",
      data: {
        order_id: orderId,
        order_number: order.order_number,
        payment_method: order.payment_method,
        payment_status: "paid",
        order_status: order.order_status,
        amount: Number(order.total_amount),
      },
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Payment confirmation rollback error:",
          rollbackError,
        );
      }
    }

    console.error("Confirm order payment error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to confirm payment",
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
  confirmOrderPayment,
};