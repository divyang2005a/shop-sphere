const db = require("../config/db");

const getAdminPayments = async (req, res) => {
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
    const status =
      typeof req.query.status === "string" ? req.query.status.trim() : "";

    const conditions = [];
    const values = [];
    if (status) {
      if (status.length > 50) {
        return res.status(400).json({
          success: false,
          message: "Payment status must be at most 50 characters",
        });
      }
      conditions.push("p.status = ?");
      values.push(status);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const [[payments], [countRows]] = await Promise.all([
      db.promise().execute(
        `SELECT p.id, p.order_id, p.user_id, p.payment_method, p.amount,
                p.status, p.transaction_id, p.paid_at, p.created_at,
                p.updated_at, o.order_number, u.name AS customer_name,
                u.email AS customer_email
         FROM payments p
         LEFT JOIN orders o ON o.id = p.order_id
         LEFT JOIN users u ON u.id = p.user_id
         ${whereClause}
         ORDER BY p.created_at DESC, p.id DESC
         LIMIT ? OFFSET ?`,
        [...values, limit, offset],
      ),
      db.promise().execute(
        `SELECT COUNT(*) AS total
         FROM payments p
         ${whereClause}`,
        values,
      ),
    ]);

    const total = Number(countRows[0].total);
    return res.status(200).json({
      success: true,
      count: payments.length,
      payments,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get admin payments error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payments",
    });
  }
};

module.exports = {
  getAdminPayments,
};
