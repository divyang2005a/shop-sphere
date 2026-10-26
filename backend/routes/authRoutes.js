const express = require("express");

const {
  register,
  login,
  logout,
  verifyLoginOTP,
  forgotPassword,
  resetPassword,
  changePassword,
} = require("../controllers/authController");

const {
  registerLimiter,
  loginLimiter,
  verifyOtpLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  changePasswordLimiter,
} = require("../middleware/rateLimitMiddleware");

const authMiddleware = require("../middleware/authMiddleware");
const uploadProfileImage = require("../middleware/profileUpload");
const db = require("../config/db");

const router = express.Router();

// ========================================
// AUTHENTICATION ROUTES
// ========================================

router.post("/register", registerLimiter, register);

router.post("/login", loginLimiter, login);

router.post("/logout", authMiddleware, logout);

router.post("/verify-otp", verifyOtpLimiter, verifyLoginOTP);

router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  forgotPassword
);

router.post(
  "/reset-password",
  resetPasswordLimiter,
  resetPassword
);

router.put(
  "/change-password",
  authMiddleware,
  changePasswordLimiter,
  changePassword
);

// ========================================
// GET LOGGED-IN USER PROFILE
// ========================================

router.get("/profile", authMiddleware, (req, res) => {
  const userId = req.user?.user_id ?? req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Invalid user authentication",
    });
  }

  const sql = `
    SELECT
      id AS user_id,
      name,
      email,
      mobile,
      profile_image,
      date_of_birth,
      status,
      created_at,
      updated_at
    FROM users
    WHERE id = ?
    LIMIT 1
  `;

  db.query(sql, [userId], (error, users) => {
    if (error) {
      console.error("Get profile error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch user profile",
      });
    }

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      user: users[0],
    });
  });
});

// ========================================
// UPDATE LOGGED-IN USER PROFILE
// ========================================

router.put(
  "/profile",
  authMiddleware,
  uploadProfileImage.single("profile_image"),
  (req, res) => {
    const userId = req.user?.user_id ?? req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid user authentication",
      });
    }

    const body = req.body || {};

    if (typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({
        success: false,
        message: "Request body must be a JSON object",
      });
    }

    const {
      name,
      email,
      mobile,
      date_of_birth,
    } = body;

    const profile_image = req.file
      ? `/uploads/profile/${req.file.filename}`
      : body.profile_image;

    // Validate name
    if (
      name !== undefined &&
      (typeof name !== "string" || !name.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Name cannot be empty",
      });
    }

    // Validate email
    if (
      email !== undefined &&
      email !== null &&
      (
        typeof email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    // Validate mobile
    if (
      mobile !== undefined &&
      mobile !== null &&
      (
        typeof mobile !== "string" ||
        !/^[0-9]{7,15}$/.test(mobile)
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Mobile must contain 7 to 15 digits",
      });
    }

    // Validate date of birth
    if (
      date_of_birth !== undefined &&
      date_of_birth !== null
    ) {
      if (
        typeof date_of_birth !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date_of_birth)
      ) {
        return res.status(400).json({
          success: false,
          message: "Date of birth must use YYYY-MM-DD format",
        });
      }

      const parsedDate = new Date(
        `${date_of_birth}T00:00:00.000Z`
      );

      if (
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== date_of_birth ||
        parsedDate > new Date()
      ) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid date of birth",
        });
      }
    }

    // Validate profile image value
    if (
      profile_image !== undefined &&
      profile_image !== null &&
      (
        typeof profile_image !== "string" ||
        !profile_image.trim() ||
        profile_image.length > 500
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Profile image must be a valid path or URL",
      });
    }

    // Allow only approved profile fields
    const allowedFields = [
      ["name", name === undefined ? undefined : name.trim()],
      ["email", email],
      ["mobile", mobile],
      ["date_of_birth", date_of_birth],
      ["profile_image", profile_image],
    ];

    const updates = [];
    const values = [];

    for (const [field, value] of allowedFields) {
      if (value !== undefined) {
        updates.push(`${field} = ?`);
        values.push(value);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one profile field to update",
      });
    }

    values.push(userId);

    const sql = `
      UPDATE users
      SET ${updates.join(", ")}
      WHERE id = ?
    `;

    db.query(sql, values, (error, result) => {
      if (error) {
        if (error.code === "ER_DUP_ENTRY") {
          return res.status(409).json({
            success: false,
            message: "Email or mobile number is already in use",
          });
        }

        console.error("Update profile error:", error);

        return res.status(500).json({
          success: false,
          message: "Failed to update profile",
        });
      }

      // If no rows changed, check whether the user exists.
      // MySQL may report zero affected rows when values are unchanged.
      if (result.affectedRows === 0) {
        return db.query(
          "SELECT id FROM users WHERE id = ? LIMIT 1",
          [userId],
          (selectError, rows) => {
            if (selectError) {
              console.error(
                "Verify profile user error:",
                selectError
              );

              return res.status(500).json({
                success: false,
                message: "Failed to verify user",
              });
            }

            if (!rows || rows.length === 0) {
              return res.status(404).json({
                success: false,
                message: "User not found",
              });
            }

            return fetchUpdatedProfile();
          }
        );
      }

      return fetchUpdatedProfile();
    });

    // Fetch the latest profile after the update.
    function fetchUpdatedProfile() {
      db.query(
        `SELECT
          id AS user_id,
          name,
          email,
          mobile,
          profile_image,
          date_of_birth,
          status,
          created_at,
          updated_at
        FROM users
        WHERE id = ?
        LIMIT 1`,
        [userId],
        (error, users) => {
          if (error) {
            console.error(
              "Fetch updated profile error:",
              error
            );

            return res.status(500).json({
              success: false,
              message: "Profile updated, but failed to fetch profile",
            });
          }

          if (!users || users.length === 0) {
            return res.status(404).json({
              success: false,
              message: "User not found",
            });
          }

          return res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            user: users[0],
          });
        }
      );
    }
  }
);

module.exports = router;