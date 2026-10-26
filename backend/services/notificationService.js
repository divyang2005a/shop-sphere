const db = require("../config/db");

const createNotification = async ({
  userId,
  type,
  title,
  message,
  data = null,
}) => {
  if (!userId || !type || !title || !message) {
    throw new Error(
      "userId, type, title and message are required"
    );
  }

  const notificationData =
    data === null
      ? null
      : typeof data === "string"
        ? data
        : JSON.stringify(data);

  const [result] = await db.promise().execute(
    `INSERT INTO notifications
      (user_id, type, title, message, data, is_read)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [
      userId,
      type,
      title,
      message,
      notificationData,
    ]
  );

  return {
    id: result.insertId,
  };
};

module.exports = {
  createNotification,
};