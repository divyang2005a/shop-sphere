const db = require("../config/db");

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const SENSITIVE_FIELD =
  /(password|otp|token|secret|authorization|cookie|credential)/i;

function sanitizeValues(value, depth = 0) {
  if (value === null || value === undefined) {
    return value;
  }

  if (depth > 5) {
    return "[truncated]";
  }

  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => sanitizeValues(item, depth + 1));
  }

  if (typeof value === "object") {
    const safe = {};

    for (const [key, item] of Object.entries(value)) {
      if (SENSITIVE_FIELD.test(key)) {
        continue;
      }

      safe[key] = sanitizeValues(item, depth + 1);
    }

    return safe;
  }

  if (typeof value === "string" && value.length > 2000) {
    return value.slice(0, 2000);
  }

  return value;
}

function findEntityId(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 5) {
    return null;
  }

  const possibleKeys = [
    "id",
    "product_id",
    "category_id",
    "brand_id",
    "order_id",
    "orderId",
    "return_id",
    "user_id",
    "image_id",
    "variant_id",
    "ticket_id",
    "shipment_id",
  ];

  for (const key of possibleKeys) {
    const candidate = value[key];

    if (
      candidate !== undefined &&
      candidate !== null &&
      /^[0-9]+$/.test(String(candidate))
    ) {
      return String(candidate);
    }
  }

  for (const child of Object.values(value)) {
    const found = findEntityId(child, depth + 1);

    if (found !== null) {
      return found;
    }
  }

  return null;
}

function adminAuditMiddleware(req, res, next) {
  if (!WRITE_METHODS.has(req.method)) {
    return next();
  }

  const originalJson = res.json;
  let responseHandled = false;

  res.json = function (body) {
    if (responseHandled) {
      return originalJson.call(this, body);
    }

    responseHandled = true;

    if (req.skipGenericAudit) {
      return originalJson.call(this, body);
    }

    const adminId = req.user?.user_id ?? req.user?.id;

    // Record only successful authenticated write actions.
    if (
      !adminId ||
      res.statusCode < 200 ||
      res.statusCode >= 300 ||
      (body && typeof body === "object" && body.success === false)
    ) {
      return originalJson.call(this, body);
    }

    const routePath = req.route?.path || req.path;
    const action = `${req.method} ${req.baseUrl}${routePath}`.slice(0, 100);

    const entityType = (
      req.path.split("/").filter(Boolean)[0] || "admin"
    ).slice(0, 100);

    const entityId = findEntityId(req.params) ?? findEntityId(body);

    const safeBody = sanitizeValues(req.body || {});
    const newValues =
      safeBody && Object.keys(safeBody).length > 0
        ? JSON.stringify(safeBody)
        : null;

    const ipAddress = (req.ip || "").slice(0, 45);

    const sql = `
      INSERT INTO admin_audit_logs
        (
          admin_id,
          action,
          entity_type,
          entity_id,
          old_values,
          new_values,
          ip_address
        )
      VALUES (?, ?, ?, ?, NULL, ?, ?)
    `;

    db.query(
      sql,
      [adminId, action, entityType, entityId, newValues, ipAddress || null],
      (error) => {
        if (error) {
          console.error("Admin audit log error:", error);
        }

        // Do not hide the original API response if logging fails.
        return originalJson.call(res, body);
      },
    );

    return res;
  };

  next();
}

module.exports = adminAuditMiddleware;
