const db = require("../config/db");
const {
  publishNotificationCampaign,
} = require("../services/notificationCampaignService");

const parseId = (value) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const parseCampaignInput = (body) => {
  const { type, title, message, data = null } = body || {};

  if (
    typeof type !== "string" ||
    !type.trim() ||
    type.trim().length > 100
  ) {
    return {
      error: "Valid notification type is required (maximum 100 characters)",
    };
  }

  if (
    typeof title !== "string" ||
    !title.trim() ||
    title.trim().length > 255
  ) {
    return {
      error: "Valid notification title is required (maximum 255 characters)",
    };
  }

  if (
    typeof message !== "string" ||
    !message.trim() ||
    Buffer.byteLength(message.trim(), "utf8") > 65_535
  ) {
    return {
      error: "Notification message is required (maximum 65,535 bytes)",
    };
  }

  if (
    data !== null &&
    (typeof data !== "object" || Array.isArray(data))
  ) {
    return { error: "Notification data must be an object or null" };
  }

  return {
    campaign: {
      type: type.trim(),
      title: title.trim(),
      message: message.trim(),
      data: data === null ? null : JSON.stringify(data),
    },
  };
};

const formatCampaign = (campaign) => {
  let data = campaign.data;

  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch (error) {
      console.error("Invalid JSON in notification campaign:", error);
      throw new Error("Stored notification campaign data is invalid");
    }
  }

  return {
    ...campaign,
    data,
    recipient_count:
      campaign.recipient_count === null
        ? null
        : Number(campaign.recipient_count),
  };
};

const getAdminNotifications = async (req, res) => {
  try {
    const requestedPage = Number.parseInt(req.query.page, 10);
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const page = Number.isSafeInteger(requestedPage)
      ? Math.max(1, requestedPage)
      : 1;
    const limit = Number.isSafeInteger(requestedLimit)
      ? Math.min(100, Math.max(1, requestedLimit))
      : 20;
    const offset = (page - 1) * limit;

    const [[campaigns], [countRows]] = await Promise.all([
      db.promise().execute(
        `SELECT id, type, title, message, data, status, scheduled_at,
                published_at, recipient_count, created_by, created_at, updated_at
         FROM notification_campaigns
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
        [limit, offset],
      ),
      db.promise().execute(
        "SELECT COUNT(*) AS total FROM notification_campaigns",
      ),
    ]);

    const total = Number(countRows[0].total);

    return res.status(200).json({
      success: true,
      data: {
        notifications: campaigns.map(formatCampaign),
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get admin notifications error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
    });
  }
};

const createAdminNotification = async (req, res) => {
  const parsed = parseCampaignInput(req.body);

  if (parsed.error) {
    return res.status(400).json({ success: false, message: parsed.error });
  }

  try {
    const [result] = await db.promise().execute(
      `INSERT INTO notification_campaigns
         (type, title, message, data, status, created_by)
       VALUES (?, ?, ?, ?, 'draft', ?)`,
      [
        parsed.campaign.type,
        parsed.campaign.title,
        parsed.campaign.message,
        parsed.campaign.data,
        req.user?.user_id ?? req.user?.id ?? null,
      ],
    );

    return res.status(201).json({
      success: true,
      message: "Notification created as a draft",
      notification_id: result.insertId,
    });
  } catch (error) {
    console.error("Create admin notification error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create notification",
    });
  }
};

const updateAdminNotification = async (req, res) => {
  const notificationId = parseId(req.params.notificationId);
  if (!notificationId) {
    return res.status(400).json({
      success: false,
      message: "Valid notification ID is required",
    });
  }

  const parsed = parseCampaignInput(req.body);
  if (parsed.error) {
    return res.status(400).json({ success: false, message: parsed.error });
  }

  try {
    const [result] = await db.promise().execute(
      `UPDATE notification_campaigns
       SET type = ?, title = ?, message = ?, data = ?
       WHERE id = ? AND status IN ('draft', 'scheduled')`,
      [
        parsed.campaign.type,
        parsed.campaign.title,
        parsed.campaign.message,
        parsed.campaign.data,
        notificationId,
      ],
    );

    if (result.affectedRows === 0) {
      const [rows] = await db.promise().execute(
        "SELECT status FROM notification_campaigns WHERE id = ?",
        [notificationId],
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Notification not found",
        });
      }

      if (["draft", "scheduled"].includes(rows[0].status)) {
        return res.status(200).json({
          success: true,
          message: "Notification updated",
        });
      }

      return res.status(409).json({
        success: false,
        message: "Published notifications cannot be edited",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification updated",
    });
  } catch (error) {
    console.error("Update admin notification error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update notification",
    });
  }
};

const deleteAdminNotification = async (req, res) => {
  const notificationId = parseId(req.params.notificationId);
  if (!notificationId) {
    return res.status(400).json({
      success: false,
      message: "Valid notification ID is required",
    });
  }

  try {
    const [result] = await db.promise().execute(
      `DELETE FROM notification_campaigns
       WHERE id = ? AND status IN ('draft', 'scheduled')`,
      [notificationId],
    );

    if (result.affectedRows === 0) {
      const [rows] = await db.promise().execute(
        "SELECT status FROM notification_campaigns WHERE id = ?",
        [notificationId],
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Notification not found",
        });
      }

      return res.status(409).json({
        success: false,
        message: "Published notifications cannot be deleted",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification deleted",
    });
  } catch (error) {
    console.error("Delete admin notification error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete notification",
    });
  }
};

const publishAdminNotification = async (req, res) => {
  const notificationId = parseId(req.params.notificationId);
  if (!notificationId) {
    return res.status(400).json({
      success: false,
      message: "Valid notification ID is required",
    });
  }

  let connection;
  try {
    connection = await db.promise().getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      "SELECT * FROM notification_campaigns WHERE id = ? FOR UPDATE",
      [notificationId],
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    const campaign = rows[0];
    if (campaign.status === "published") {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "Notification has already been published",
      });
    }

    const recipientCount = await publishNotificationCampaign(
      connection,
      campaign,
    );
    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Notification published",
      recipient_count: recipientCount,
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Rollback notification publish error:", rollbackError);
      }
    }
    console.error("Publish admin notification error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to publish notification",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

const scheduleAdminNotification = async (req, res) => {
  const notificationId = parseId(req.params.notificationId);
  if (!notificationId) {
    return res.status(400).json({
      success: false,
      message: "Valid notification ID is required",
    });
  }

  const { scheduled_at: scheduledAt } = req.body || {};
  if (
    typeof scheduledAt !== "string" ||
    !scheduledAt.includes("T") ||
    !/(?:Z|[+-]\d{2}:\d{2})$/i.test(scheduledAt)
  ) {
    return res.status(400).json({
      success: false,
      message: "scheduled_at must be an ISO 8601 datetime with a timezone",
    });
  }

  const scheduledDate = new Date(scheduledAt);
  if (
    Number.isNaN(scheduledDate.getTime()) ||
    scheduledDate.getTime() <= Date.now()
  ) {
    return res.status(400).json({
      success: false,
      message: "scheduled_at must be a valid future datetime",
    });
  }

  const scheduledAtUtc = scheduledDate
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

  try {
    const [result] = await db.promise().execute(
      `UPDATE notification_campaigns
       SET status = 'scheduled', scheduled_at = ?, published_at = NULL,
           recipient_count = NULL
       WHERE id = ? AND status IN ('draft', 'scheduled')`,
      [scheduledAtUtc, notificationId],
    );

    if (result.affectedRows === 0) {
      const [rows] = await db.promise().execute(
        "SELECT status FROM notification_campaigns WHERE id = ?",
        [notificationId],
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Notification not found",
        });
      }

      if (["draft", "scheduled"].includes(rows[0].status)) {
        return res.status(200).json({
          success: true,
          message: "Notification scheduled",
          scheduled_at: scheduledAtUtc,
        });
      }

      return res.status(409).json({
        success: false,
        message: "Published notifications cannot be scheduled",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification scheduled",
      scheduled_at: scheduledAtUtc,
    });
  } catch (error) {
    console.error("Schedule admin notification error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to schedule notification",
    });
  }
};

module.exports = {
  getAdminNotifications,
  createAdminNotification,
  updateAdminNotification,
  deleteAdminNotification,
  publishAdminNotification,
  scheduleAdminNotification,
};
