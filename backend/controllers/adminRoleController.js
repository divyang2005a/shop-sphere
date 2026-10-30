const db = require("../config/db");

const isValidId = (value) => /^[1-9]\d*$/.test(String(value ?? ""));

const getRoles = async (_req, res) => {
  try {
    const [roles] = await db.promise().execute(
      `SELECT r.id, r.name, r.description, COUNT(ur.user_id) AS assigned_users
       FROM roles r
       LEFT JOIN user_roles ur ON ur.role_id = r.id
       GROUP BY r.id, r.name, r.description
       ORDER BY r.id ASC`,
    );
    return res.status(200).json({
      success: true,
      count: roles.length,
      roles: roles.map((role) => ({
        ...role,
        assigned_users: Number(role.assigned_users),
      })),
    });
  } catch (error) {
    console.error("Get roles error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch roles",
    });
  }
};

const getUserRoles = async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({
      success: false,
      message: "A valid user ID is required",
    });
  }
  try {
    const [users] = await db.promise().execute(
      "SELECT id, name, email FROM users WHERE id = ? LIMIT 1",
      [id],
    );
    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    const [roles] = await db.promise().execute(
      `SELECT r.id, r.name, r.description
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = ?
       ORDER BY r.id ASC`,
      [id],
    );
    return res.status(200).json({
      success: true,
      user: users[0],
      roles,
    });
  } catch (error) {
    console.error("Get user roles error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user roles",
    });
  }
};

module.exports = {
  getRoles,
  getUserRoles,
};
