const db = require("../config/db");
const { createNotification } = require("../services/notificationService");

const isPositiveId = (value) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0;
};

const getUserId = (req) => req.user?.user_id ?? req.user?.id;

const getAdminShipments = async (req, res) => {
  try {
    const shipmentId = req.params.shipmentId;

    if (shipmentId !== undefined && !isPositiveId(shipmentId)) {
      return res.status(400).json({
        success: false,
        message: "Valid shipment ID is required",
      });
    }

    const values = [];
    let shipmentFilter = "";

    if (shipmentId !== undefined) {
      shipmentFilter = "WHERE s.id = ?";
      values.push(Number(shipmentId));
    }

    const [shipments] = await db.promise().query(
      `SELECT
         s.*,
         o.order_number,
         o.user_id,
         o.order_status,
         o.payment_status,
         o.subtotal,
         o.discount,
         o.coupon_discount,
         o.tax,
         o.shipping_fee,
         o.total_amount,
         o.created_at AS order_created_at,
         u.name AS customer_name,
         u.email AS customer_email,
         u.mobile AS customer_mobile,
         sm.name AS shipping_method_name,
         sm.description AS shipping_method_description,
         sm.price AS shipping_method_price,
         sm.estimated_days AS shipping_method_estimated_days,
         billing.name AS billing_name,
         billing.phone AS billing_phone,
         billing.address_line_1 AS billing_address_line_1,
         billing.address_line_2 AS billing_address_line_2,
         billing.city AS billing_city,
         billing.state AS billing_state,
         billing.country AS billing_country,
         billing.pincode AS billing_pincode,
         shipping.name AS shipping_name,
         shipping.phone AS shipping_phone,
         shipping.address_line_1 AS shipping_address_line_1,
         shipping.address_line_2 AS shipping_address_line_2,
         shipping.city AS shipping_city,
         shipping.state AS shipping_state,
         shipping.country AS shipping_country,
         shipping.pincode AS shipping_pincode
       FROM shipments s
       JOIN orders o ON o.id = s.order_id
       LEFT JOIN users u ON u.id = o.user_id
       LEFT JOIN shipping_methods sm ON sm.id = s.shipping_method_id
       LEFT JOIN addresses billing ON billing.id = o.billing_address_id
       LEFT JOIN addresses shipping ON shipping.id = o.shipping_address_id
       ${shipmentFilter}
       ORDER BY s.id DESC`,
      values,
    );

    if (shipmentId !== undefined && shipments.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Shipment not found",
      });
    }

    if (shipments.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        shipments: [],
      });
    }

    const shipmentIds = shipments.map((shipment) => shipment.id);
    const [trackingHistory] = await db.promise().query(
      `SELECT id, shipment_id, status, location, description, tracked_at
       FROM shipment_tracking
       WHERE shipment_id IN (?)
       ORDER BY tracked_at ASC, id ASC`,
      [shipmentIds],
    );

    const historiesByShipment = new Map();
    for (const event of trackingHistory) {
      const key = String(event.shipment_id);
      const history = historiesByShipment.get(key) || [];
      history.push(event);
      historiesByShipment.set(key, history);
    }

    const shipmentsWithHistory = shipments.map((shipment) => ({
      ...shipment,
      tracking_history: historiesByShipment.get(String(shipment.id)) || [],
    }));

    if (shipmentId !== undefined) {
      return res.status(200).json({
        success: true,
        shipment: shipmentsWithHistory[0],
      });
    }

    return res.status(200).json({
      success: true,
      count: shipmentsWithHistory.length,
      shipments: shipmentsWithHistory,
    });
  } catch (error) {
    console.error("Get admin shipments error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch shipments",
    });
  }
};

// Admin: Create shipment for an order
const createShipment = async (req, res) => {
  let connection;
  let transactionStarted = false;

  try {
    const orderId = Number(req.params.orderId);
    const adminId = getUserId(req);

    const { courier_name, tracking_number, expected_delivery_date } =
      req.body || {};

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

    if (
      expected_delivery_date !== undefined &&
      expected_delivery_date !== null &&
      expected_delivery_date !== ""
    ) {
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
      [orderId],
    );

    if (orders.length === 0) {
      const error = new Error("Order not found");
      error.statusCode = 404;
      throw error;
    }

    const order = orders[0];

    if (
      ["cancelled", "delivered"].includes(
        String(order.order_status).toLowerCase(),
      )
    ) {
      const error = new Error(
        `Cannot create a shipment for an order that is ${order.order_status}`,
      );
      error.statusCode = 400;
      throw error;
    }

    if (!order.shipping_method_id) {
      const error = new Error("This order has no shipping method assigned");
      error.statusCode = 400;
      throw error;
    }

    const [existingShipments] = await connection.query(
      `SELECT id
       FROM shipments
       WHERE order_id = ?
       LIMIT 1
       FOR UPDATE`,
      [orderId],
    );

    if (existingShipments.length > 0) {
      const error = new Error("A shipment already exists for this order");
      error.statusCode = 409;
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
      ],
    );

    const shipmentId = result.insertId;

    await connection.query(
      `INSERT INTO shipment_tracking
        (shipment_id, status, location, description)
       VALUES (?, 'pending', NULL, ?)`,
      [shipmentId, "Shipment record created"],
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
      console.error("Shipment creation notification error:", notificationError);
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

// Admin: Update shipment status, tracking event and audit log
// Admin: Update shipment status, tracking event and audit log
const updateShipmentStatus = async (req, res) => {
  let connection;
  let transactionStarted = false;

  try {
    const shipmentId = Number(req.params.shipmentId);
    const adminId = getUserId(req);

    const {
      status,
      location,
      description,
      cash_received,
    } = req.body || {};

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

    const shipmentRank = {
      pending: 0,
      ready_to_ship: 1,
      shipped: 2,
      in_transit: 3,
      out_for_delivery: 4,
      delivered: 5,
    };

    const terminalStatuses = [
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
      (typeof description !== "string" ||
        description.length > 1000)
    ) {
      return res.status(400).json({
        success: false,
        message: "Description must not exceed 1000 characters",
      });
    }

    if (
      cash_received !== undefined &&
      typeof cash_received !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message: "cash_received must be true or false",
      });
    }

    const normalizedLocation =
      typeof location === "string" && location.trim()
        ? location.trim()
        : null;

    let eventDescription =
      typeof description === "string" && description.trim()
        ? description.trim()
        : `Shipment status updated to ${normalizedStatus.replace(
            /_/g,
            " ",
          )}`;

    connection = await db.promise().getConnection();

    await connection.beginTransaction();
    transactionStarted = true;

    // 1. Lock shipment and its order.
    const [shipments] = await connection.query(
      `
        SELECT
          s.id,
          s.order_id,
          s.status,
          s.tracking_number,
          s.courier_name,
          s.shipped_at,
          s.delivered_at,
          o.user_id,
          o.order_number,
          o.order_status,
          o.payment_method,
          o.payment_status,
          o.total_amount
        FROM shipments s
        JOIN orders o ON o.id = s.order_id
        WHERE s.id = ?
        FOR UPDATE
      `,
      [shipmentId],
    );

    if (shipments.length === 0) {
      const error = new Error("Shipment not found");
      error.statusCode = 404;
      throw error;
    }

    const shipment = shipments[0];

    const currentStatus = String(
      shipment.status || "pending",
    ).toLowerCase();

    const oldOrderStatus = String(
      shipment.order_status || "pending",
    ).toLowerCase();

    const paymentMethod = String(
      shipment.payment_method || "",
    )
      .trim()
      .toLowerCase();

    const isCOD = [
      "cod",
      "cash on delivery",
      "cash_on_delivery",
      "cash-on-delivery",
    ].includes(paymentMethod);

    // COD delivery must include an explicit cash confirmation.
    if (
      normalizedStatus === "delivered" &&
      isCOD &&
      typeof cash_received !== "boolean"
    ) {
      const error = new Error(
        "For COD delivery, include boolean cash_received in the request body (true if cash was collected, false otherwise)",
      );
      error.statusCode = 400;
      throw error;
    }

    if (currentStatus === normalizedStatus) {
      const error = new Error(
        `Shipment is already ${normalizedStatus}`,
      );
      error.statusCode = 400;
      throw error;
    }

    if (["cancelled", "delivered"].includes(oldOrderStatus)) {
      const error = new Error(
        `Cannot update shipment for an order that is ${oldOrderStatus}`,
      );
      error.statusCode = 400;
      throw error;
    }

    if (terminalStatuses.includes(currentStatus)) {
      const error = new Error(
        `Cannot update shipment after it is ${currentStatus}`,
      );
      error.statusCode = 400;
      throw error;
    }

    // 2. Prevent shipment status regression.
    const currentRank = shipmentRank[currentStatus];
    const nextRank = shipmentRank[normalizedStatus];

    if (
      currentRank !== undefined &&
      nextRank !== undefined &&
      nextRank < currentRank
    ) {
      const error = new Error(
        `Cannot move shipment backwards from ${currentStatus} to ${normalizedStatus}`,
      );
      error.statusCode = 400;
      throw error;
    }

    // 3. Update shipment status and milestone timestamps.
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
        normalizedStatus,
        normalizedStatus,
        normalizedStatus,
        shipmentId,
      ],
    );

    // 4. Add shipment tracking history.
    await connection.query(
      `
        INSERT INTO shipment_tracking
          (shipment_id, status, location, description)
        VALUES (?, ?, ?, ?)
      `,
      [
        shipmentId,
        normalizedStatus,
        normalizedLocation,
        eventDescription,
      ],
    );

    // 5. Synchronize order status.
    let newOrderStatus = oldOrderStatus;

    if (
      [
        "shipped",
        "in_transit",
        "out_for_delivery",
      ].includes(normalizedStatus)
    ) {
      newOrderStatus = "shipped";
    } else if (normalizedStatus === "delivered") {
      newOrderStatus = "delivered";
    } else if (normalizedStatus === "cancelled") {
      newOrderStatus = "cancelled";
    }

    if (newOrderStatus !== oldOrderStatus) {
      const orderRank = {
        pending: 0,
        confirmed: 1,
        processing: 2,
        packed: 3,
        shipped: 4,
        delivered: 5,
      };

      if (
        newOrderStatus === "shipped" &&
        orderRank[oldOrderStatus] !== undefined &&
        orderRank[oldOrderStatus] > orderRank.shipped
      ) {
        const error = new Error(
          `Cannot move order backwards from ${oldOrderStatus} to shipped`,
        );
        error.statusCode = 400;
        throw error;
      }

      await connection.query(
        `
          UPDATE orders
          SET order_status = ?,
              updated_at = NOW()
          WHERE id = ?
        `,
        [newOrderStatus, shipment.order_id],
      );

      await connection.query(
        `
          INSERT INTO order_status_history
            (order_id, status, note, changed_by, created_at)
          VALUES (?, ?, ?, ?, NOW())
        `,
        [
          shipment.order_id,
          newOrderStatus,
          `Shipment status updated to ${normalizedStatus.replace(
            /_/g,
            " ",
          )}`,
          Number(adminId),
        ],
      );
    }

    // 6. COD payment handling.
    // COD is marked paid only when the admin confirms cash receipt.
    // UPI and other methods are never auto-marked paid here.
    let newPaymentStatus = String(
      shipment.payment_status || "pending",
    ).toLowerCase();

    let paymentUpdated = false;

    if (
      normalizedStatus === "delivered" &&
      isCOD &&
      cash_received === true
    ) {
      if (newPaymentStatus !== "paid") {
        const [payments] = await connection.query(
          `
            SELECT id, status, payment_method
            FROM payments
            WHERE order_id = ?
            ORDER BY id DESC
            LIMIT 1
            FOR UPDATE
          `,
          [shipment.order_id],
        );

        if (payments.length > 0) {
          const payment = payments[0];

          await connection.query(
            `
              UPDATE payments
              SET status = 'paid',
                  paid_at = COALESCE(paid_at, NOW()),
                  updated_at = NOW()
              WHERE id = ?
            `,
            [payment.id],
          );
        } else {
          // Create a payment record only if no payment record exists.
          await connection.query(
            `
              INSERT INTO payments
                (
                  order_id,
                  user_id,
                  payment_method,
                  amount,
                  status,
                  paid_at
                )
              VALUES (?, ?, ?, ?, 'paid', NOW())
            `,
            [
              shipment.order_id,
              shipment.user_id,
              shipment.payment_method,
              shipment.total_amount,
            ],
          );
        }

        await connection.query(
          `
            UPDATE orders
            SET payment_status = 'paid',
                updated_at = NOW()
            WHERE id = ?
          `,
          [shipment.order_id],
        );

        newPaymentStatus = "paid";
        paymentUpdated = true;

        eventDescription = `${eventDescription} - COD cash received and payment confirmed`;
      }
    }

    // If COD cash has not been received, leave payment status unchanged.
    // For UPI, use the separate admin payment-confirmation endpoint.

    // 7. Insert audit log.
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
        "PATCH /api/shipments/admin/:shipmentId/status",
        "shipments",
        shipmentId,
        JSON.stringify({
          shipment_status: currentStatus,
          order_status: oldOrderStatus,
          payment_status: shipment.payment_status,
        }),
        JSON.stringify({
          shipment_status: normalizedStatus,
          order_status: newOrderStatus,
          payment_status: newPaymentStatus,
          payment_updated: paymentUpdated,
          cash_received:
            normalizedStatus === "delivered" && isCOD
              ? cash_received
              : null,
          location: normalizedLocation,
          description: eventDescription,
        }),
        (req.ip || "").slice(0, 45) || null,
      ],
    );

    // 8. Commit all database changes together.
    await connection.commit();
    transactionStarted = false;

    // 9. Notify customer after commit.
    try {
      await createNotification({
        userId: shipment.user_id,
        type: "shipment_status_updated",
        title: "Shipment update",
        message: `Your shipment for order ${
          shipment.order_number
        } is now ${normalizedStatus.replace(/_/g, " ")}.`,
        data: {
          order_id: shipment.order_id,
          order_number: shipment.order_number,
          shipment_id: shipmentId,
          tracking_number: shipment.tracking_number,
          shipment_status: normalizedStatus,
          order_status: newOrderStatus,
          payment_status: newPaymentStatus,
        },
      });

      if (paymentUpdated) {
        await createNotification({
          userId: shipment.user_id,
          type: "payment_received",
          title: "COD payment received",
          message: `Cash payment for order ${shipment.order_number} has been confirmed.`,
          data: {
            order_id: shipment.order_id,
            order_number: shipment.order_number,
            shipment_id: shipmentId,
            payment_status: "paid",
            amount: shipment.total_amount,
          },
        });
      }
    } catch (notificationError) {
      console.error(
        "Shipment status notification error:",
        notificationError,
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
        previous_order_status: oldOrderStatus,
        order_status: newOrderStatus,
        previous_payment_status: shipment.payment_status,
        payment_status: newPaymentStatus,
        payment_updated: paymentUpdated,
        cash_received:
          normalizedStatus === "delivered" && isCOD
            ? cash_received
            : null,
      },
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Shipment update rollback error:",
          rollbackError,
        );
      }
    }

    console.error("Update shipment status error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.message || "Failed to update shipment status",
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
      [orderId, userId],
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
      [orderId],
    );

    const shipmentsWithHistory = [];

    for (const shipment of shipments) {
      const [history] = await db.promise().query(
        `SELECT id, status, location, description, tracked_at
         FROM shipment_tracking
         WHERE shipment_id = ?
         ORDER BY tracked_at ASC, id ASC`,
        [shipment.id],
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
      [trackingNumber.trim(), userId],
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
      [shipment.id],
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
  getAdminShipments,
  createShipment,
  updateShipmentStatus,
  getOrderShipments,
  getShipmentByTrackingNumber,
};
