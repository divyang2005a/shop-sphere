const db = require("../config/db");

const isValidId = (value) => /^[1-9]\d*$/.test(String(value ?? ""));

const getAdminActivityLogs = async (req, res) => {
  const pageValue = Number.parseInt(req.query.page, 10);
  const limitValue = Number.parseInt(req.query.limit, 10);
  const page = Number.isSafeInteger(pageValue) ? Math.max(1, pageValue) : 1;
  const limit = Number.isSafeInteger(limitValue)
    ? Math.min(100, Math.max(1, limitValue))
    : 20;
  const offset = (page - 1) * limit;
  const conditions = [];
  const values = [];

  if (req.query.admin_id !== undefined) {
    if (!isValidId(req.query.admin_id)) {
      return res.status(400).json({
        success: false,
        message: "admin_id must be a positive integer",
      });
    }
    conditions.push("l.admin_id = ?");
    values.push(req.query.admin_id);
  }

  for (const field of ["entity_type", "action"]) {
    if (req.query[field] === undefined) {
      continue;
    }
    if (
      typeof req.query[field] !== "string" ||
      !req.query[field].trim() ||
      req.query[field].trim().length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: `A valid ${field} filter is required`,
      });
    }
    conditions.push(`l.${field} LIKE ?`);
    values.push(`%${req.query[field].trim()}%`);
  }

  if (req.query.from !== undefined) {
    const from = new Date(req.query.from);
    if (Number.isNaN(from.getTime())) {
      return res.status(400).json({
        success: false,
        message: "from must be a valid date",
      });
    }
    conditions.push("l.created_at >= ?");
    values.push(from.toISOString().slice(0, 19).replace("T", " "));
  }

  if (req.query.to !== undefined) {
    const toValue =
      typeof req.query.to === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(req.query.to)
        ? `${req.query.to}T23:59:59.999Z`
        : req.query.to;
    const to = new Date(toValue);
    if (Number.isNaN(to.getTime())) {
      return res.status(400).json({
        success: false,
        message: "to must be a valid date",
      });
    }
    conditions.push("l.created_at <= ?");
    values.push(to.toISOString().slice(0, 19).replace("T", " "));
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  try {
    const [[logs], [countRows]] = await Promise.all([
      db.promise().execute(
        `SELECT l.id, l.admin_id, u.name AS admin_name, u.email AS admin_email,
                l.action, l.entity_type, l.entity_id, l.old_values,
                l.new_values, l.ip_address, l.created_at
         FROM admin_audit_logs l
         LEFT JOIN users u ON u.id = l.admin_id
         ${whereClause}
         ORDER BY l.created_at DESC, l.id DESC
         LIMIT ? OFFSET ?`,
        [...values, limit, offset],
      ),
      db.promise().execute(
        `SELECT COUNT(*) AS total FROM admin_audit_logs l ${whereClause}`,
        values,
      ),
    ]);

    const total = Number(countRows[0].total);
    return res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get admin activity logs error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin activity logs",
    });
  }
};

module.exports = {
  getAdminActivityLogs,
};
