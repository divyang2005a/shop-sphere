const publishNotificationCampaign = async (connection, campaign) => {
  const [result] = await connection.execute(
    `INSERT INTO notifications
       (user_id, type, title, message, data, is_read)
     SELECT id, ?, ?, ?, ?, 0
     FROM users
     WHERE status = 'active'`,
    [
      campaign.type,
      campaign.title,
      campaign.message,
      campaign.data,
    ],
  );

  await connection.execute(
    `UPDATE notification_campaigns
     SET status = 'published',
         published_at = UTC_TIMESTAMP(),
         recipient_count = ?
     WHERE id = ?`,
    [result.affectedRows, campaign.id],
  );

  return result.affectedRows;
};

module.exports = {
  publishNotificationCampaign,
};
