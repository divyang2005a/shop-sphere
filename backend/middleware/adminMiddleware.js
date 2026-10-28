const db = require("../config/db");

const adminMiddleware = (req, res, next) => {
  const userId = req.user.user_id;

  const sql = `
    SELECT r.name AS role FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ? 
    AND r.name = 'admin' LIMIT 1
    `;

  db.query(sql, [userId], (err, result) => {
    if (err) {
      console.error("Admin authorization lookup failed:", err);

      return res.status(500).json({
        success: false,
        message: "Failed to verify admin access",
      });
    }

    if (result.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    next();
  });
};

module.exports = adminMiddleware;
