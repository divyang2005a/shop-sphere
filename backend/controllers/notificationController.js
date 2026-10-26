const db = require("../config/db");

// Get logged-in user's notifications
const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user?.user_id ?? req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user",
      });
    }

    let page = parseInt(req.query.page, 10) || 1;
    let limit = parseInt(req.query.limit, 10) || 20;

    page = Math.max(1, page);
    limit = Math.min(100, Math.max(1, limit));

    const offset = (page - 1) * limit;

    const [notifications] = await db.promise().execute(
      `SELECT
         id,
         type,
         title,
         message,
         data,
         is_read,
         created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    const [countResult] = await db.promise().execute(
      `SELECT COUNT(*) AS total
       FROM notifications
       WHERE user_id = ?`,
      [userId]
    );

    const [unreadResult] = await db.promise().execute(
      `SELECT COUNT(*) AS unread_count
       FROM notifications
       WHERE user_id = ? AND is_read = 0`,
      [userId]
    );

    const formattedNotifications = notifications.map((notification) => {
      let data = notification.data;

      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          // Keep the original value if it is not valid JSON.
        }
      }

      return {
        ...notification,
        data,
        is_read: Boolean(notification.is_read),
      };
    });

    const total = Number(countResult[0].total);

    return res.status(200).json({
      success: true,
      data: {
        notifications: formattedNotifications,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
        unread_count: Number(unreadResult[0].unread_count),
      },
    });
  } catch (error) {
    console.error("Get notifications error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
    });
  }
};

// Get unread notification count
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user?.user_id ?? req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user",
      });
    }

    const [result] = await db.promise().execute(
      `SELECT COUNT(*) AS unread_count
       FROM notifications
       WHERE user_id = ? AND is_read = 0`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      unread_count: Number(result[0].unread_count),
    });
  } catch (error) {
    console.error("Get unread count error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch unread notification count",
    });
  }
};

// Mark one notification as read
const markNotificationAsRead = async (req, res) => {
  try {
    const userId = req.user?.user_id ?? req.user?.id;
    const notificationId = Number(req.params.notificationId);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user",
      });
    }

    if (
      !Number.isSafeInteger(notificationId) ||
      notificationId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid notification ID is required",
      });
    }

    const [result] = await db.promise().execute(
      `UPDATE notifications
       SET is_read = 1
       WHERE id = ? AND user_id = ?`,
      [notificationId, userId]
    );

    if (result.affectedRows === 0) {
      const [existing] = await db.promise().execute(
        `SELECT id
         FROM notifications
         WHERE id = ? AND user_id = ?`,
        [notificationId, userId]
      );

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Notification not found",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    console.error("Mark notification as read error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update notification",
    });
  }
};

// Mark all notifications as read
const markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user?.user_id ?? req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user",
      });
    }

    const [result] = await db.promise().execute(
      `UPDATE notifications
       SET is_read = 1
       WHERE user_id = ? AND is_read = 0`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      updated_count: result.affectedRows,
    });
  } catch (error) {
    console.error("Mark all notifications as read error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update notifications",
    });
  }
};

module.exports = {
  getMyNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};