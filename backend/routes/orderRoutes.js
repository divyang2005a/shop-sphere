const express = require("express");
const router = express.Router();

const {
  createOrder,
  getOrders,
  getOrderById,
  cancelOrder,
  trackOrder,
  requestReturn,
  checkoutSummary,
} = require("../controllers/orderController");

const {
  reorderOrder,
} = require("../controllers/reorderController");

const authMiddleware = require("../middleware/authMiddleware");

const {
  getOrderInvoice,
} = require("../controllers/invoiceController");

const {
  getInvoicePdf,
} = require("../controllers/invoicePdfController");

const {
  getCustomerCreditNotePdf,
} = require("../controllers/creditNotePdfController");

const {
  getMyRefunds,
} = require("../controllers/refundController");

// Create order
router.post("/", authMiddleware, createOrder);

// Get all orders
router.get("/", authMiddleware, getOrders);

// Checkout summary — static route before /:orderId
router.get(
  "/checkout-summary",
  authMiddleware,
  checkoutSummary
);

// Customer: list refunds for their own orders
// IMPORTANT: Keep this before router.get("/:orderId").
router.get(
  "/refunds",
  authMiddleware,
  getMyRefunds
);

// Customer: download their own credit note PDF
router.get(
  "/credit-notes/:creditNoteId/pdf",
  authMiddleware,
  getCustomerCreditNotePdf
);

// Reorder / Buy Again
router.post(
  "/:orderId/reorder",
  authMiddleware,
  reorderOrder
);

// Get order details
router.get(
  "/:orderId",
  authMiddleware,
  getOrderById
);

// Cancel order
router.patch(
  "/:orderId/cancel",
  authMiddleware,
  cancelOrder
);

// Track order
router.get(
  "/:orderId/track",
  authMiddleware,
  trackOrder
);

// Request return
router.post(
  "/:orderId/return",
  authMiddleware,
  requestReturn
);

// Get order invoice
router.get(
  "/:orderId/invoice",
  authMiddleware,
  getOrderInvoice
);

// Download invoice PDF
router.get(
  "/:orderId/invoice/pdf",
  authMiddleware,
  getInvoicePdf
);

module.exports = router;