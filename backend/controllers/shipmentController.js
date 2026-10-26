const db = require("../config/db");
const { createNotification } = require("../services/notificationService");

const isPositiveId = (value) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0;
};

const getUserId = (req) => req.user?.user_id ?? req.user?.id;

// Admin: Create shipment for an order
const createShipment = async (req, res) => {
  let connection;
  let transactionStarted = false;

  try {
    const orderId = Number(req.params.orderId);
    const adminId = getUserId(req);

    const {
      courier_name,
      tracking_number,
      expected_delivery_date,
    } = req.body || {};

    if (!isPositiveId(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Valid order ID is required",
      });
    }

    if (
      typeof courier_name !== "string" ||
      !courier_name.trim() ||
      courier_name.trim().length > 150
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid courier name is required (maximum 150 characters)",
      });
    }

    if (
      tracking_number !== undefined &&
      tracking_number !== null &&
      (typeof tracking_number !== "string" ||
        tracking_number.trim().length > 191)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid tracking number",
      });
    }

    let deliveryDate = null;

    if (expected_delivery_date !== undefined &&
        expected_delivery_date !== null &&
        expected_delivery_date !== "") {
      if (
        typeof expected_delivery_date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(expected_delivery_date)
      ) {
        return res.status(400).json({
          success: false,
          message: "Expected delivery date must use YYYY-MM-DD format",
        });
      }

      const date = new Date(`${expected_delivery_date}T00:00:00Z`);

      if (
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== expected_delivery_date
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid expected delivery date",
        });
      }

      deliveryDate = expected_delivery_date;
    }

    connection = await db.promise().getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [orders] = await connection.query(
      `SELECT id, user_id, order_number,
              shipping_method_id, order_status
       FROM orders
       WHERE id = ?
       FOR UPDATE`,
      [orderId]
    );

    if (orders.length === 0) {
      const error = new Error("Order not found");
      error.statusCode = 404;
      throw error;
    }

    const order = orders[0];

    if (
      ["cancelled", "delivered"].includes(
        String(order.order_status).toLowerCase()
      )
    ) {
      const error = new Error(
        `Cannot create a shipment for an order that is ${order.order_status}`
      );
      error.statusCode = 400;
      throw error;
    }

    if (!order.shipping_method_id) {
      const error = new Error(
        "This order has no shipping method assigned"
      );
      error.statusCode = 400;
      throw error;
    }

    const [result] = await connection.query(
      `INSERT INTO shipments
        (order_id, shipping_method_id, courier_name,
         tracking_number, expected_delivery_date, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [
        orderId,
        order.shipping_method_id,
        courier_name.trim(),
        tracking_number?.trim() || null,
        deliveryDate,
      ]
    );

    const shipmentId = result.insertId;

    await connection.query(
      `INSERT INTO shipment_tracking
        (shipment_id, status, location, description)
       VALUES (?, 'pending', NULL, ?)`,
      [shipmentId, "Shipment record created"]
    );

    await connection.commit();
    transactionStarted = false;

    try {
      await createNotification({
        userId: order.user_id,
        type: "shipment_created",
        title: "Shipment created",
        message: `A shipment has been created for order ${order.order_number}.`,
        data: {
          order_id: orderId,
          shipment_id: shipmentId,
          order_number: order.order_number,
          tracking_number: tracking_number?.trim() || null,
          shipment_status: "pending",
        },
      });
    } catch (notificationError) {
      console.error(
        "Shipment creation notification error:",
        notificationError
      );
    }

    return res.status(201).json({
      success: true,
      message: "Shipment created successfully",
      data: {
        shipment_id: shipmentId,
        order_id: orderId,
        order_number: order.order_number,
        courier_name: courier_name.trim(),
        tracking_number: tracking_number?.trim() || null,
        expected_delivery_date: deliveryDate,
        shipment_status: "pending",
      },
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Shipment rollback error:", rollbackError);
      }
    }

    console.error("Create shipment error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to create shipment",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Admin: Update shipment status and add tracking event
// Admin: Update shipment status, tracking event and audit log
const updateShipmentStatus = async (req, res) => {
  let connection;
  let transactionStarted = false;

  try {
    const shipmentId = Number(req.params.shipmentId);
    const adminId = getUserId(req);
    const { status, location, description } = req.body || {};

    const allowedStatuses = [
      "pending",
      "ready_to_ship",
      "shipped",
      "in_transit",
      "out_for_delivery",
      "delivered",
      "failed_delivery",
      "returned",
      "cancelled",
    ];

    if (!isPositiveId(shipmentId)) {
      return res.status(400).json({
        success: false,
        message: "Valid shipment ID is required",
      });
    }

    if (!adminId) {
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
        message: "Invalid shipment status",
        allowed_statuses: allowedStatuses,
      });
    }

    const normalizedStatus = status.trim().toLowerCase();

    if (
      location !== undefined &&
      location !== null &&
      (typeof location !== "string" || location.length > 255)
    ) {
      return res.status(400).json({
        success: false,
        message: "Location must not exceed 255 characters",
      });
    }

    if (
      description !== undefined &&
      description !== null &&
      (
        typeof description !== "string" ||
        description.length > 1000
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Description must not exceed 1000 characters",
      });
    }

    const normalizedLocation =
      typeof location === "string" && location.trim()
        ? location.trim()
        : null;

    connection = await db.promise().getConnection();

    await connection.beginTransaction();
    transactionStarted = true;

    // Lock shipment and retrieve its existing order status.
    const [shipments] = await connection.query(
      `SELECT
         s.id,
         s.order_id,
         s.status,
         s.tracking_number,
         s.courier_name,
         o.user_id,
         o.order_number,
         o.order_status
       FROM shipments s
       JOIN orders o ON o.id = s.order_id
       WHERE s.id = ?
       FOR UPDATE`,
      [shipmentId]
    );

    if (shipments.length === 0) {
      const error = new Error("Shipment not found");
      error.statusCode = 404;
      throw error;
    }

    const shipment = shipments[0];

    const currentStatus = String(
      shipment.status || "pending"
    ).toLowerCase();

    const oldOrderStatus = String(
      shipment.order_status
    ).toLowerCase();

    if (currentStatus === normalizedStatus) {
      const error = new Error(
        `Shipment is already ${normalizedStatus}`
      );
      error.statusCode = 400;
      throw error;
    }

    if (oldOrderStatus === "cancelled") {
      const error = new Error(
        "Cannot update shipment for a cancelled order"
      );
      error.statusCode = 400;
      throw error;
    }

    if (["delivered", "cancelled"].includes(currentStatus)) {
      const error = new Error(
        `Cannot update a shipment after it is ${currentStatus}`
      );
      error.statusCode = 400;
      throw error;
    }

    // Update shipment and milestone timestamps.
    await connection.query(
      `UPDATE shipments
       SET status = ?,
           shipped_at = CASE
             WHEN ? = 'shipped' AND shipped_at IS NULL
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
        normalizedStatus,
        normalizedStatus,
        normalizedStatus,
        shipmentId,
      ]
    );

    const eventDescription =
      typeof description === "string" && description.trim()
        ? description.trim()
        : `Shipment status updated to ${normalizedStatus.replace(/_/g, " ")}`;

    // Preserve the shipment tracking timeline.
    await connection.query(
      `INSERT INTO shipment_tracking
         (shipment_id, status, location, description)
       VALUES (?, ?, ?, ?)`,
      [
        shipmentId,
        normalizedStatus,
        normalizedLocation,
        eventDescription,
      ]
    );

    // Keep the existing order lifecycle synchronization.
    let newOrderStatus = null;

    if (
      ["shipped", "in_transit", "out_for_delivery"].includes(
        normalizedStatus
      )
    ) {
      newOrderStatus = "shipped";
    } else if (normalizedStatus === "delivered") {
      newOrderStatus = "delivered";
    }

    if (
      newOrderStatus &&
      oldOrderStatus !== newOrderStatus &&
      oldOrderStatus !== "delivered"
    ) {
      await connection.query(
        `UPDATE orders
         SET order_status = ?, updated_at = NOW()
         WHERE id = ?`,
        [newOrderStatus, shipment.order_id]
      );

      await connection.query(
        `INSERT INTO order_status_history
           (order_id, status, note, changed_by, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [
          shipment.order_id,
          newOrderStatus,
          `Shipment status updated to ${normalizedStatus.replace(/_/g, " ")}`,
          adminId,
        ]
      );
    }

    const finalOrderStatus = newOrderStatus || oldOrderStatus;

    // Capture previous and new values for the audit record.
    const oldValues = {
      status: currentStatus,
      order_status: oldOrderStatus,
    };

    const newValues = {
      status: normalizedStatus,
      order_status: finalOrderStatus,
      location: normalizedLocation,
      description: eventDescription,
    };

    // Save audit log in the same transaction.
    // If the audit insert fails, the status update is rolled back.
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
        "PATCH /api/shipments/admin/:shipmentId/status",
        "shipments",
        shipmentId,
        JSON.stringify(oldValues),
        JSON.stringify(newValues),
        (req.ip || "").slice(0, 45) || null,
      ]
    );

    // Commit shipment, tracking, order history and audit together.
    await connection.commit();
    transactionStarted = false;

    // Notify the customer after the transaction succeeds.
    try {
      await createNotification({
        userId: shipment.user_id,
        type: "shipment_status_updated",
        title: "Shipment update",
        message:
          `Your shipment for order ${shipment.order_number} is now ${normalizedStatus.replace(/_/g, " ")}.`,
        data: {
          order_id: shipment.order_id,
          order_number: shipment.order_number,
          shipment_id: shipmentId,
          tracking_number: shipment.tracking_number,
          shipment_status: normalizedStatus,
          order_status: finalOrderStatus,
        },
      });
    } catch (notificationError) {
      console.error(
        "Shipment status notification error:",
        notificationError
      );
    }

    return res.status(200).json({
      success: true,
      message: "Shipment status updated successfully",
      data: {
        shipment_id: shipmentId,
        order_id: shipment.order_id,
        previous_status: currentStatus,
        shipment_status: normalizedStatus,
        order_status: finalOrderStatus,
      },
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Shipment update rollback error:",
          rollbackError
        );
      }
    }

    console.error("Update shipment status error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to update shipment status",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Customer: Get shipments and timelines for their own order
const getOrderShipments = async (req, res) => {
  try {
    const userId = getUserId(req);
    const orderId = Number(req.params.orderId);

    if (!isPositiveId(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Valid order ID is required",
      });
    }

    const [orders] = await db.promise().query(
      `SELECT id, order_number, order_status
       FROM orders
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [orderId, userId]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const [shipments] = await db.promise().query(
      `SELECT s.id, s.order_id, s.shipping_method_id,
              sm.name AS shipping_method_name,
              s.courier_name, s.tracking_number,
              s.expected_delivery_date, s.status,
              s.shipped_at, s.delivered_at
       FROM shipments s
       LEFT JOIN shipping_methods sm
         ON sm.id = s.shipping_method_id
       WHERE s.order_id = ?
       ORDER BY s.id DESC`,
      [orderId]
    );

    const shipmentsWithHistory = [];

    for (const shipment of shipments) {
      const [history] = await db.promise().query(
        `SELECT id, status, location, description, tracked_at
         FROM shipment_tracking
         WHERE shipment_id = ?
         ORDER BY tracked_at ASC, id ASC`,
        [shipment.id]
      );

      shipmentsWithHistory.push({
        ...shipment,
        tracking_history: history,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        order: orders[0],
        shipments: shipmentsWithHistory,
      },
    });
  } catch (error) {
    console.error("Get order shipments error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch order shipments",
    });
  }
};

// Customer: Find a shipment by tracking number, restricted to their own order
const getShipmentByTrackingNumber = async (req, res) => {
  try {
    const userId = getUserId(req);
    const trackingNumber = req.params.trackingNumber;

    if (
      typeof trackingNumber !== "string" ||
      !trackingNumber.trim() ||
      trackingNumber.length > 191
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid tracking number is required",
      });
    }

    const [shipments] = await db.promise().query(
      `SELECT s.id, s.order_id, s.shipping_method_id,
              sm.name AS shipping_method_name,
              s.courier_name, s.tracking_number,
              s.expected_delivery_date, s.status,
              s.shipped_at, s.delivered_at,
              o.order_number, o.order_status
       FROM shipments s
       JOIN orders o ON o.id = s.order_id
       LEFT JOIN shipping_methods sm
         ON sm.id = s.shipping_method_id
       WHERE s.tracking_number = ?
         AND o.user_id = ?
       ORDER BY s.id DESC
       LIMIT 1`,
      [trackingNumber.trim(), userId]
    );

    if (shipments.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Shipment not found",
      });
    }

    const shipment = shipments[0];

    const [history] = await db.promise().query(
      `SELECT id, status, location, description, tracked_at
       FROM shipment_tracking
       WHERE shipment_id = ?
       ORDER BY tracked_at ASC, id ASC`,
      [shipment.id]
    );

    return res.status(200).json({
      success: true,
      data: {
        shipment,
        tracking_history: history,
      },
    });
  } catch (error) {
    console.error("Get shipment by tracking number error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch shipment tracking",
    });
  }
};

module.exports = {
  createShipment,
  updateShipmentStatus,
  getOrderShipments,
  getShipmentByTrackingNumber,
};