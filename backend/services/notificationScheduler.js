const db = require("../config/db");
const {
  publishNotificationCampaign,
} = require("./notificationCampaignService");

const SCHEDULER_INTERVAL_MS = 30_000;
let schedulerStarted = false;
let processingScheduledNotifications = false;
let campaignTableMissing = false;

const processScheduledNotifications = async () => {
  if (processingScheduledNotifications) {
    return;
  }

  processingScheduledNotifications = true;
  let connection;

  try {
    connection = await db.promise().getConnection();
    await connection.beginTransaction();

    const [campaigns] = await connection.execute(
      `SELECT id, type, title, message, data
       FROM notification_campaigns
       WHERE status = 'scheduled'
         AND scheduled_at <= UTC_TIMESTAMP()
       ORDER BY scheduled_at ASC, id ASC
       LIMIT 20
       FOR UPDATE`,
    );
    campaignTableMissing = false;

    for (const campaign of campaigns) {
      await publishNotificationCampaign(connection, campaign);
    }

    await connection.commit();
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Rollback scheduled notifications error:", rollbackError);
      }
    }
    if (error.code === "ER_NO_SUCH_TABLE") {
      if (!campaignTableMissing) {
        console.error(
          "Notification campaign table is missing. Apply " +
            "database/migrations/20261030_create_notification_campaigns.sql " +
            "to the shop_sphere database; scheduled notifications are paused.",
        );
      }
      campaignTableMissing = true;
    } else {
      console.error("Process scheduled notifications error:", error);
    }
  } finally {
    if (connection) {
      connection.release();
    }
    processingScheduledNotifications = false;
  }
};

const startNotificationScheduler = () => {
  if (schedulerStarted) {
    return;
  }

  schedulerStarted = true;
  processScheduledNotifications();
  setInterval(processScheduledNotifications, SCHEDULER_INTERVAL_MS);
};

module.exports = {
  processScheduledNotifications,
  startNotificationScheduler,
};
