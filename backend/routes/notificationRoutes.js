const express = require("express");
const router = express.Router();

const {
  getMyNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} = require("../controllers/notificationController");

const authMiddleware = require("../middleware/authMiddleware");

router.get("/", authMiddleware, getMyNotifications);

router.get("/unread-count", authMiddleware, getUnreadCount);

router.patch("/read-all", authMiddleware, markAllNotificationsAsRead);

router.patch(
  "/:notificationId/read",
  authMiddleware,
  markNotificationAsRead
);

module.exports = router;