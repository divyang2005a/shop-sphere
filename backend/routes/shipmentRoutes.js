const express = require("express");
const router = express.Router();

const {
  createShipment,
  updateShipmentStatus,
  getAdminShipments,
  getOrderShipments,
  getShipmentByTrackingNumber,
} = require("../controllers/shipmentController");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

// Admin routes
router.get(
  "/admin",
  authMiddleware,
  adminMiddleware,
  getAdminShipments
);

router.get(
  "/admin/:shipmentId",
  authMiddleware,
  adminMiddleware,
  getAdminShipments
);

router.post(
  "/admin/orders/:orderId",
  authMiddleware,
  adminMiddleware,
  createShipment
);

router.patch(
  "/admin/:shipmentId/status",
  authMiddleware,
  adminMiddleware,
  updateShipmentStatus
);

// Customer routes
router.get(
  "/orders/:orderId",
  authMiddleware,
  getOrderShipments
);

router.get(
  "/tracking/:trackingNumber",
  authMiddleware,
  getShipmentByTrackingNumber
);

module.exports = router;