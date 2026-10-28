const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sendEmail } = require("../services/emailService");

// ========================================
// REGISTER
// ========================================
const register = async (req, res) => {
  const { name, email, mobile, password, date_of_birth } = req.body || {};

  if (!name || !password || (!email && !mobile)) {
    return res.status(400).json({
      success: false,
      message: "Name, password and email or mobile are required",
    });
  }

  let connection;
  let transactionStarted = false;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    connection = await db.promise().getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [existingUsers] = await connection.query(
      `SELECT id, email, mobile
       FROM users
       WHERE email = ? OR mobile = ?
       LIMIT 1
       FOR UPDATE`,
      [email || null, mobile || null],
    );

    if (existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      await connection.rollback();
      transactionStarted = false;

      if (mobile && existingUser.mobile === mobile) {
        return res.status(409).json({
          success: false,
          message: "Mobile number already registered",
        });
      }

      if (email && existingUser.email === email) {
        return res.status(409).json({
          success: false,
          message: "Email already registered",
        });
      }
    }

    const [result] = await connection.query(
      `INSERT INTO users
         (name, email, mobile, password, date_of_birth)
       VALUES (?, ?, ?, ?, ?)`,
      [
        name,
        email || null,
        mobile || null,
        hashedPassword,
        date_of_birth || null,
      ],
    );

    // Role ID 2 = user
    await connection.query(
      "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)",
      [result.insertId, 2],
    );

    await connection.commit();
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      user_id: result.insertId,
      role: "user",
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Registration rollback error:", rollbackError);
      }
    }

    console.error("Registration failed:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Email or mobile number already registered",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Registration failed",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// ========================================
// LOGIN - EMAIL OTP
// ========================================
const login = (req, res) => {
  const { email, mobile, password } = req.body;

  if ((!email && !mobile) || !password) {
    return res.status(400).json({
      success: false,
      message: "Email or mobile and password are required",
    });
  }

  const sql = `
    SELECT id, name, email, mobile, password, status
    FROM users
    WHERE email = ? OR mobile = ?
    LIMIT 1
  `;

  db.query(sql, [email || null, mobile || null], (err, results) => {
    if (err) {
      console.error(err);

      return res.status(500).json({
        success: false,
        message: "Login failed",
      });
    }

    if (results.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email/mobile or password",
      });
    }

    const user = results[0];

    if (user.status && String(user.status).toLowerCase() !== "active") {
      return res.status(403).json({
        success: false,
        message: "Your account is not active",
      });
    }

    bcrypt.compare(password, user.password, async (compareErr, isMatch) => {
      if (compareErr) {
        console.error(compareErr);

        return res.status(500).json({
          success: false,
          message: "Password verification failed",
        });
      }

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: "Invalid email/mobile or password",
        });
      }

      if (!user.email) {
        return res.status(400).json({
          success: false,
          message: "Email is required for login OTP",
        });
      }

      try {
        await generateLoginOTP(user.id, user.email);

        return res.status(200).json({
          success: true,
          message: "OTP sent to your email",
          otp_required: true,
          user_id: user.id,
        });
      } catch (error) {
        console.error("Login OTP error:", error);

        return res.status(500).json({
          success: false,
          message: "Failed to send OTP",
        });
      }
    });
  });
};

// ========================================
// VERIFY LOGIN OTP + FETCH ROLE + JWT
// ========================================
const verifyLoginOTP = (req, res) => {
  const { user_id, otp } = req.body;

  if (!user_id || !otp) {
    return res.status(400).json({
      success: false,
      message: "User ID and OTP are required",
    });
  }

  const sql = `
    SELECT id, user_id, otp, expires_at, attempts, verified_at
    FROM otp_verifications
    WHERE user_id = ?
      AND type = 'login'
      AND verified_at IS NULL
    ORDER BY id DESC
    LIMIT 1
  `;

  db.query(sql, [user_id], (err, results) => {
    if (err) {
      console.error(err);

      return res.status(500).json({
        success: false,
        message: "OTP verification failed",
      });
    }

    if (results.length === 0) {
      return res.status(401).json({
        success: false,
        message: "No active OTP found",
      });
    }

    const otpRecord = results[0];

    // Maximum 5 attempts
    if (otpRecord.attempts >= 5) {
      return res.status(429).json({
        success: false,
        message: "Maximum OTP attempts exceeded. Please request a new OTP.",
      });
    }

    // Check expiry
    if (new Date(otpRecord.expires_at) < new Date()) {
      return res.status(401).json({
        success: false,
        message: "OTP has expired. Please request a new OTP.",
      });
    }

    // Wrong OTP
    if (String(otpRecord.otp) !== String(otp)) {
      const newAttempts = otpRecord.attempts + 1;

      const updateAttemptsSql = `
        UPDATE otp_verifications
        SET attempts = ?
        WHERE id = ?
      `;

      db.query(updateAttemptsSql, [newAttempts, otpRecord.id], (updateErr) => {
        if (updateErr) {
          console.error(updateErr);

          return res.status(500).json({
            success: false,
            message: "Failed to update OTP attempts",
          });
        }

        if (newAttempts >= 5) {
          return res.status(429).json({
            success: false,
            message: "Maximum OTP attempts exceeded. Please request a new OTP.",
          });
        }

        return res.status(401).json({
          success: false,
          message: `Invalid OTP. Attempts remaining: ${5 - newAttempts}`,
        });
      });

      return;
    }

    // Correct OTP
    const updateVerifiedSql = `
      UPDATE otp_verifications
      SET verified_at = NOW()
      WHERE id = ?
    `;

    db.query(updateVerifiedSql, [otpRecord.id], (updateErr) => {
      if (updateErr) {
        console.error(updateErr);

        return res.status(500).json({
          success: false,
          message: "OTP verification failed",
        });
      }

      // Fetch user and assigned role directly from the database
      const userSql = `
        SELECT
          u.id,
          u.name,
          u.email,
          u.mobile,
          r.id AS role_id,
          r.name AS role
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        LEFT JOIN roles r ON r.id = ur.role_id
        WHERE u.id = ?
        LIMIT 1
      `;

      db.query(userSql, [user_id], (userErr, userResults) => {
        if (userErr) {
          console.error(userErr);

          return res.status(500).json({
            success: false,
            message: "User and role lookup failed",
          });
        }

        if (userResults.length === 0) {
          return res.status(404).json({
            success: false,
            message: "User not found",
          });
        }

        const user = userResults[0];

        // A valid role must be assigned before issuing a token
        if (!user.role_id || !user.role) {
          return res.status(403).json({
            success: false,
            message: "No role assigned to this user",
          });
        }

        if (!process.env.JWT_SECRET) {
          console.error("JWT_SECRET is missing from environment");

          return res.status(500).json({
            success: false,
            message: "Authentication configuration error",
          });
        }

        const tokenPayload = {
          user_id: user.id,
          email: user.email,
          role_id: user.role_id,
          role: String(user.role).toLowerCase(),
        };

        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
          expiresIn: process.env.JWT_EXPIRES_IN || "1d",
        });

        return res.status(200).json({
          success: true,
          message: "OTP verified successfully. Login successful",
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            mobile: user.mobile,
            role_id: user.role_id,
            role: String(user.role).toLowerCase(),
          },
        });
      });
    });
  });
};

// ========================================
// LOGOUT
// ========================================
const logout = (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Logout Successful...",
  });
};

// ========================================
// GENERATE / UPDATE LOGIN OTP
// ========================================
const generateLoginOTP = async (userId, email) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  // Check existing login OTP
  const checkSql = `
    SELECT id
    FROM otp_verifications
    WHERE user_id = ?
      AND type = 'login'
    ORDER BY id DESC
    LIMIT 1
  `;

  const existingOTP = await new Promise((resolve, reject) => {
    db.query(checkSql, [userId], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });

  if (existingOTP.length > 0) {
    // Update the existing login OTP instead of creating another row
    const updateSql = `
      UPDATE otp_verifications
      SET otp = ?,
          expires_at = ?,
          attempts = 0,
          verified_at = NULL,
          created_at = NOW()
      WHERE id = ?
    `;

    await new Promise((resolve, reject) => {
      db.query(
        updateSql,
        [otp, expiresAt, existingOTP[0].id],
        (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        },
      );
    });
  } else {
    // First login OTP for this user
    const insertSql = `
      INSERT INTO otp_verifications
        (user_id, otp, type, expires_at, attempts, verified_at, created_at)
      VALUES (?, ?, ?, ?, ?, NULL, NOW())
    `;

    await new Promise((resolve, reject) => {
      db.query(
        insertSql,
        [userId, otp, "login", expiresAt, 0],
        (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        },
      );
    });
  }

  const emailSent = await sendEmail(
    email,
    "ShopSphere Login OTP",
    `Your ShopSphere login OTP is ${otp}. This OTP is valid for 5 minutes.`,
  );

  if (!emailSent) {
    throw new Error("OTP email could not be sent");
  }

  return true;
};

// ========================================
// FORGOT PASSWORD
// ========================================
const forgotPassword = (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required",
    });
  }

  const sql = `
    SELECT id, name, email
    FROM users
    WHERE email = ?
    LIMIT 1
  `;

  db.query(sql, [email], (err, results) => {
    if (err) {
      console.error(err);

      return res.status(500).json({
        success: false,
        message: "Forgot password request failed",
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User with this email does not exist",
      });
    }

    const user = results[0];
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const checkSql = `
      SELECT id
      FROM password_resets
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 1
    `;

    db.query(checkSql, [user.id], (checkErr, resetResults) => {
      if (checkErr) {
        console.error(checkErr);

        return res.status(500).json({
          success: false,
          message: "Password reset request failed",
        });
      }

      if (resetResults.length > 0) {
        const updateSql = `
          UPDATE password_resets
          SET otp = ?,
              expires_at = ?,
              verified_at = NULL,
              created_at = NOW()
          WHERE id = ?
        `;

        db.query(
          updateSql,
          [otp, expiresAt, resetResults[0].id],
          async (updateErr) => {
            if (updateErr) {
              console.error(updateErr);

              return res.status(500).json({
                success: false,
                message: "Failed to create password reset OTP",
              });
            }

            try {
              const emailSent = await sendEmail(
                user.email,
                "ShopSphere Password Reset OTP",
                `Your ShopSphere password reset OTP is ${otp}. This OTP is valid for 5 minutes.`,
              );

              if (!emailSent) {
                return res.status(500).json({
                  success: false,
                  message: "Failed to send password reset OTP",
                });
              }

              return res.status(200).json({
                success: true,
                message: "Password reset OTP sent to your email",
                user_id: user.id,
              });
            } catch (emailErr) {
              console.error(emailErr);

              return res.status(500).json({
                success: false,
                message: "Failed to send password reset OTP",
              });
            }
          },
        );
      } else {
        const insertSql = `
          INSERT INTO password_resets
            (user_id, otp, expires_at, verified_at, created_at)
          VALUES (?, ?, ?, NULL, NOW())
        `;

        db.query(insertSql, [user.id, otp, expiresAt], async (insertErr) => {
          if (insertErr) {
            console.error(insertErr);

            return res.status(500).json({
              success: false,
              message: "Failed to create password reset OTP",
            });
          }

          try {
            const emailSent = await sendEmail(
              user.email,
              "ShopSphere Password Reset OTP",
              `Your ShopSphere password reset OTP is ${otp}. This OTP is valid for 5 minutes.`,
            );

            if (!emailSent) {
              return res.status(500).json({
                success: false,
                message: "Failed to send password reset OTP",
              });
            }

            return res.status(200).json({
              success: true,
              message: "Password reset OTP sent to your email",
              user_id: user.id,
            });
          } catch (emailErr) {
            console.error(emailErr);

            return res.status(500).json({
              success: false,
              message: "Failed to send password reset OTP",
            });
          }
        });
      }
    });
  });
};

// ========================================
// RESET PASSWORD
// ========================================
const resetPassword = (req, res) => {
  const { user_id, otp, new_password } = req.body;

  if (!user_id || !otp || !new_password) {
    return res.status(400).json({
      success: false,
      message: "User ID, OTP and new password are required",
    });
  }

  const sql = `
    SELECT id, user_id, otp, expires_at, verified_at
    FROM password_resets
    WHERE user_id = ?
    ORDER BY id DESC
    LIMIT 1
  `;

  db.query(sql, [user_id], (err, results) => {
    if (err) {
      console.error(err);

      return res.status(500).json({
        success: false,
        message: "Password reset failed",
      });
    }

    if (results.length === 0) {
      return res.status(401).json({
        success: false,
        message: "No password reset OTP found",
      });
    }

    const resetRecord = results[0];

    if (resetRecord.verified_at) {
      return res.status(401).json({
        success: false,
        message: "OTP has already been used",
      });
    }

    if (new Date(resetRecord.expires_at) < new Date()) {
      return res.status(401).json({
        success: false,
        message: "OTP has expired. Please request a new OTP.",
      });
    }

    if (String(resetRecord.otp) !== String(otp)) {
      return res.status(401).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    bcrypt.hash(new_password, 10, (hashErr, hashedPassword) => {
      if (hashErr) {
        console.error(hashErr);

        return res.status(500).json({
          success: false,
          message: "Password hashing failed",
        });
      }

      const updatePasswordSql = `
        UPDATE users
        SET password = ?,
            updated_at = NOW()
        WHERE id = ?
      `;

      db.query(updatePasswordSql, [hashedPassword, user_id], (passwordErr) => {
        if (passwordErr) {
          console.error(passwordErr);

          return res.status(500).json({
            success: false,
            message: "Failed to update password",
          });
        }

        const verifySql = `
            UPDATE password_resets
            SET verified_at = NOW()
            WHERE id = ?
          `;

        db.query(verifySql, [resetRecord.id], (verifyErr) => {
          if (verifyErr) {
            console.error(verifyErr);

            return res.status(500).json({
              success: false,
              message: "Password reset verification failed",
            });
          }

          return res.status(200).json({
            success: true,
            message: "Password reset successfully",
          });
        });
      });
    });
  });
};

const changePassword = async (req, res) => {
  try {
    const userId = req.user?.user_id ?? req.user?.id;
    const { current_password, new_password, confirm_password } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid authenticated user",
      });
    }

    if (!current_password || !new_password || !confirm_password) {
      return res.status(400).json({
        success: false,
        message:
          "Current password, new password and confirm password are required",
      });
    }

    if (new_password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters long",
      });
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({
        success: false,
        message: "New password and confirm password do not match",
      });
    }

    if (current_password === new_password) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
    }

    const sql = `
      SELECT id, password
      FROM users
      WHERE id = ?
      LIMIT 1
    `;

    db.query(sql, [userId], async (err, results) => {
      if (err) {
        console.error("Change password lookup error:", err);

        return res.status(500).json({
          success: false,
          message: "Failed to verify current password",
        });
      }

      if (results.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      try {
        const isMatch = await bcrypt.compare(
          current_password,
          results[0].password,
        );

        if (!isMatch) {
          return res.status(400).json({
            success: false,
            message: "Current password is incorrect",
          });
        }

        const hashedPassword = await bcrypt.hash(new_password, 10);

        db.query(
          "UPDATE users SET password = ? WHERE id = ?",
          [hashedPassword, userId],
          (updateErr, result) => {
            if (updateErr) {
              console.error("Change password update error:", updateErr);

              return res.status(500).json({
                success: false,
                message: "Failed to update password",
              });
            }

            if (result.affectedRows === 0) {
              return res.status(400).json({
                success: false,
                message: "Password was not changed",
              });
            }

            return res.status(200).json({
              success: true,
              message: "Password changed successfully",
            });
          },
        );
      } catch (error) {
        console.error("Change password error:", error);

        return res.status(500).json({
          success: false,
          message: "Failed to change password",
        });
      }
    });
  } catch (error) {
    console.error("Unexpected change password error:", error);

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred",
    });
  }
};

// ========================================
// EXPORTS
// ========================================
module.exports = {
  register,
  login,
  logout,
  verifyLoginOTP,
  forgotPassword,
  resetPassword,
  changePassword,
};
