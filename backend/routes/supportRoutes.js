const express = require("express");
const router = express.Router();

const {
  createTicket,
  getMyTickets,
  getMyTicketDetails,
  sendCustomerMessage,
  getAdminTickets,
  getAdminTicketDetails,
  replyToTicket,
  updateTicketStatus,
} = require("../controllers/supportController");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

// Admin routes — protect every endpoint with adminMiddleware.
router.get(
  "/admin/tickets",
  authMiddleware,
  adminMiddleware,
  getAdminTickets
);

router.get(
  "/admin/tickets/:ticketId",
  authMiddleware,
  adminMiddleware,
  getAdminTicketDetails
);

router.post(
  "/admin/tickets/:ticketId/messages",
  authMiddleware,
  adminMiddleware,
  replyToTicket
);

router.patch(
  "/admin/tickets/:ticketId/status",
  authMiddleware,
  adminMiddleware,
  updateTicketStatus
);

// Customer routes.
router.post("/", authMiddleware, createTicket);

router.get("/", authMiddleware, getMyTickets);

router.get(
  "/:ticketId",
  authMiddleware,
  getMyTicketDetails
);

router.post(
  "/:ticketId/messages",
  authMiddleware,
  sendCustomerMessage
);

module.exports = router;