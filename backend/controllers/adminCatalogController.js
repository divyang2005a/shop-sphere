const db = require("../config/db");

const generateSlug = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normalizeStatus = (value, defaultValue = "active") => {
  if (value == null || (typeof value === "string" && !value.trim())) {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value ? "active" : "inactive";
  }

  const normalized = String(value).trim().toLowerCase();

  if (["active", "enabled", "1", "true"].includes(normalized)) {
    return "active";
  }

  if (["inactive", "disabled", "0", "false"].includes(normalized)) {
    return "inactive";
  }

  return null;
};

const isValidId = (id) => /^[1-9]\d*$/.test(String(id ?? ""));

const handleDatabaseError = (err, res, message) => {
  console.error(`${message}:`, err);

  if (err.code === "ER_DUP_ENTRY") {
    return res.status(409).json({
      success: false,
      message: "A record with this name or slug already exists",
    });
  }

  return res.status(500).json({
    success: false,
    message,
  });
};

// ========================================
// GET ALL USERS
// ========================================

const getUsers = (req, res) => {
  const sql = `
    SELECT
      id,
      name,
      email,
      mobile,
      profile_image,
      date_of_birth,
      status,
      created_at,
      updated_at,
      (
        SELECT GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ',')
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = users.id
      ) AS role_names
    FROM users
    ORDER BY id DESC
  `;

  db.query(sql, (err, users) => {
    if (err) {
      return handleDatabaseError(err, res, "Failed to fetch users");
    }

    return res.status(200).json({
      success: true,
      users: users.map(({ role_names: roleNames, ...user }) => ({
        ...user,
        roles: roleNames ? roleNames.split(",") : [],
      })),
    });
  });
};

// ========================================
// UPDATE USER STATUS WITH AUDIT LOG
// ========================================

const updateUserStatus = (req, res) => {
  const { id } = req.params;
  const status = normalizeStatus(req.body?.status, null);

  if (!isValidId(id)) {
    return res.status(400).json({
      success: false,
      message: "A valid user ID is required",
    });
  }

  if (!status) {
    return res.status(400).json({
      success: false,
      message: "Invalid status. Use active or inactive",
    });
  }

  const adminId = req.user?.user_id ?? req.user?.id;

  if (!adminId) {
    return res.status(401).json({
      success: false,
      message: "Invalid admin authentication",
    });
  }

  // This controller creates its own audit record.
  req.skipGenericAudit = true;

  db.query(
    "SELECT id, status FROM users WHERE id = ? LIMIT 1",
    [id],
    (selectError, users) => {
      if (selectError) {
        return handleDatabaseError(
          selectError,
          res,
          "Failed to fetch user before status update",
        );
      }

      if (!users || users.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const oldValues = {
        status: users[0].status,
      };

      db.query(
        "UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?",
        [status, id],
        (updateError) => {
          if (updateError) {
            return handleDatabaseError(
              updateError,
              res,
              "Failed to update user status",
            );
          }

          const auditSql = `
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
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `;

          const auditValues = [
            adminId,
            "PUT /api/admin/users/:id/status",
            "users",
            Number(id),
            JSON.stringify(oldValues),
            JSON.stringify({ status }),
            (req.ip || "").slice(0, 45) || null,
          ];

          db.query(auditSql, auditValues, (auditError) => {
            if (auditError) {
              console.error("User status audit log error:", auditError);
            }

            return res.status(200).json({
              success: true,
              message: "User status updated successfully",
            });
          });
        },
      );
    },
  );
};

// ========================================
// GET ALL CATEGORIES
// ========================================

const getCategories = (req, res) => {
  const sql = `
    SELECT
      id,
      parent_id,
      name,
      slug,
      description,
      image,
      status,
      created_at,
      updated_at
    FROM categories
    ORDER BY id DESC
  `;

  db.query(sql, (err, categories) => {
    if (err) {
      return handleDatabaseError(err, res, "Failed to fetch categories");
    }

    return res.status(200).json({
      success: true,
      categories,
    });
  });
};

// ========================================
// CREATE CATEGORY
// ========================================

const createCategory = (req, res) => {
  const body = req.body ?? {};
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const slug = generateSlug(name);
  const status = normalizeStatus(body.status);

  if (!name || !slug) {
    return res.status(400).json({
      success: false,
      message: "A valid category name is required",
    });
  }

  if (!status) {
    return res.status(400).json({
      success: false,
      message: "Invalid status. Use active or inactive",
    });
  }

  const image = req.file
    ? `uploads/categoryimage/${req.file.filename}`
    : body.image || null;

  const parentId = body.parent_id || null;

  const sql = `
    INSERT INTO categories
      (
        parent_id,
        name,
        slug,
        description,
        image,
        status,
        created_at,
        updated_at
      )
    VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
  `;

  db.query(
    sql,
    [parentId, name, slug, body.description || null, image, status],
    (err, result) => {
      if (err) {
        return handleDatabaseError(err, res, "Failed to create category");
      }

      return res.status(201).json({
        success: true,
        message: "Category created successfully",
        category_id: result.insertId,
        slug,
        image,
      });
    },
  );
};

// ========================================
// UPDATE CATEGORY WITH AUDIT LOG
// ========================================

const updateCategory = (req, res) => {
  const { id } = req.params;
  const body = req.body ?? {};

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const slug = generateSlug(name);
  const status = normalizeStatus(body.status);

  if (!isValidId(id)) {
    return res.status(400).json({
      success: false,
      message: "A valid category ID is required",
    });
  }

  if (!name || !slug) {
    return res.status(400).json({
      success: false,
      message: "A valid category name is required",
    });
  }

  if (!status) {
    return res.status(400).json({
      success: false,
      message: "Invalid status. Use active or inactive",
    });
  }

  const image = req.file
    ? `uploads/categoryimage/${req.file.filename}`
    : body.image || null;

  const adminId = req.user?.user_id ?? req.user?.id;

  if (!adminId) {
    return res.status(401).json({
      success: false,
      message: "Invalid admin authentication",
    });
  }

  req.skipGenericAudit = true;

  db.query(
    `
      SELECT
        id,
        parent_id,
        name,
        slug,
        description,
        image,
        status
      FROM categories
      WHERE id = ?
      LIMIT 1
    `,
    [id],
    (selectError, rows) => {
      if (selectError) {
        return handleDatabaseError(
          selectError,
          res,
          "Failed to fetch category before update",
        );
      }

      if (!rows || rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }

      const oldCategory = rows[0];

      const oldValues = {
        parent_id: oldCategory.parent_id,
        name: oldCategory.name,
        slug: oldCategory.slug,
        description: oldCategory.description,
        image: oldCategory.image,
        status: oldCategory.status,
      };

      const newValues = {
        parent_id: body.parent_id || null,
        name,
        slug,
        description: body.description || null,
        image: image || oldCategory.image,
        status,
      };

      const updateSql = `
        UPDATE categories
        SET
          parent_id = ?,
          name = ?,
          slug = ?,
          description = ?,
          image = COALESCE(?, image),
          status = ?,
          updated_at = NOW()
        WHERE id = ?
      `;

      db.query(
        updateSql,
        [
          newValues.parent_id,
          newValues.name,
          newValues.slug,
          newValues.description,
          image,
          newValues.status,
          id,
        ],
        (updateError) => {
          if (updateError) {
            return handleDatabaseError(
              updateError,
              res,
              "Failed to update category",
            );
          }

          const auditSql = `
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
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `;

          db.query(
            auditSql,
            [
              adminId,
              "PUT /api/admin/categories/:id",
              "categories",
              Number(id),
              JSON.stringify(oldValues),
              JSON.stringify(newValues),
              (req.ip || "").slice(0, 45) || null,
            ],
            (auditError) => {
              if (auditError) {
                console.error("Category audit log error:", auditError);
              }

              return res.status(200).json({
                success: true,
                message: "Category updated successfully",
                slug,
              });
            },
          );
        },
      );
    },
  );
};

// ========================================
// DELETE CATEGORY / BRAND WITH AUDIT LOG
// ========================================

const deleteRecord = (table, label, req, res) => {
  const { id } = req.params;

  const allowedTables = {
    categories: "category",
    brands: "brand",
  };

  if (!allowedTables[table] || allowedTables[table] !== label) {
    return res.status(500).json({
      success: false,
      message: "Invalid delete configuration",
    });
  }

  if (!isValidId(id)) {
    return res.status(400).json({
      success: false,
      message: `A valid ${label} ID is required`,
    });
  }

  const adminId = req.user?.user_id ?? req.user?.id;

  if (!adminId) {
    return res.status(401).json({
      success: false,
      message: "Invalid admin authentication",
    });
  }

  req.skipGenericAudit = true;

  db.getConnection((connectionError, connection) => {
    if (connectionError) {
      console.error("Delete connection error:", connectionError);

      return res.status(500).json({
        success: false,
        message: `Failed to delete ${label}`,
      });
    }

    connection.beginTransaction((transactionError) => {
      if (transactionError) {
        connection.release();

        console.error("Delete transaction error:", transactionError);

        return res.status(500).json({
          success: false,
          message: `Failed to delete ${label}`,
        });
      }

      connection.query(
        `SELECT * FROM ${table} WHERE id = ? LIMIT 1 FOR UPDATE`,
        [id],
        (selectError, rows) => {
          if (selectError) {
            return connection.rollback(() => {
              connection.release();

              return handleDatabaseError(
                selectError,
                res,
                `Failed to fetch ${label} before deletion`,
              );
            });
          }

          if (!rows || rows.length === 0) {
            return connection.rollback(() => {
              connection.release();

              return res.status(404).json({
                success: false,
                message: `${label[0].toUpperCase()}${label.slice(1)} not found`,
              });
            });
          }

          const oldValues = JSON.stringify(rows[0]);

          connection.query(
            `DELETE FROM ${table} WHERE id = ?`,
            [id],
            (deleteError, result) => {
              if (deleteError) {
                return connection.rollback(() => {
                  connection.release();

                  return handleDatabaseError(
                    deleteError,
                    res,
                    `Failed to delete ${label}`,
                  );
                });
              }

              if (!result.affectedRows) {
                return connection.rollback(() => {
                  connection.release();

                  return res.status(404).json({
                    success: false,
                    message: `${label[0].toUpperCase()}${label.slice(1)} not found`,
                  });
                });
              }

              const action =
                `DELETE ${req.baseUrl}${req.route?.path || req.path}`.slice(
                  0,
                  100,
                );

              const auditSql = `
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
                VALUES (?, ?, ?, ?, ?, NULL, ?)
              `;

              connection.query(
                auditSql,
                [
                  adminId,
                  action,
                  table,
                  Number(id),
                  oldValues,
                  (req.ip || "").slice(0, 45) || null,
                ],
                (auditError) => {
                  if (auditError) {
                    return connection.rollback(() => {
                      connection.release();

                      console.error("Delete audit log error:", auditError);

                      return res.status(500).json({
                        success: false,
                        message:
                          "Failed to save audit log; deletion was rolled back",
                      });
                    });
                  }

                  connection.commit((commitError) => {
                    if (commitError) {
                      return connection.rollback(() => {
                        connection.release();

                        console.error(
                          "Delete transaction commit error:",
                          commitError,
                        );

                        return res.status(500).json({
                          success: false,
                          message: `Failed to delete ${label}`,
                        });
                      });
                    }

                    connection.release();

                    return res.status(200).json({
                      success: true,
                      message: `${label[0].toUpperCase()}${label.slice(1)} deleted successfully`,
                    });
                  });
                },
              );
            },
          );
        },
      );
    });
  });
};

const deleteCategory = (req, res) =>
  deleteRecord("categories", "category", req, res);

// ========================================
// GET ALL BRANDS
// ========================================

const getBrands = (req, res) => {
  const sql = `
    SELECT
      id,
      name,
      slug,
      description,
      logo,
      status,
      created_at,
      updated_at
    FROM brands
    ORDER BY id DESC
  `;

  db.query(sql, (err, brands) => {
    if (err) {
      return handleDatabaseError(err, res, "Failed to fetch brands");
    }

    return res.status(200).json({
      success: true,
      brands,
    });
  });
};

const getUploadedBrandLogo = (req) =>
  req.file || req.files?.logo?.[0] || req.files?.image?.[0];

// ========================================
// CREATE BRAND
// ========================================

const createBrand = (req, res) => {
  const body = req.body ?? {};

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const slug = generateSlug(name);
  const status = normalizeStatus(body.status);

  if (!name || !slug) {
    return res.status(400).json({
      success: false,
      message: "A valid brand name is required",
    });
  }

  if (!status) {
    return res.status(400).json({
      success: false,
      message: "Invalid status. Use active or inactive",
    });
  }

  const logoFile = getUploadedBrandLogo(req);

  const logo = logoFile
    ? `uploads/brandlogo/${logoFile.filename}`
    : body.logo || null;

  const sql = `
    INSERT INTO brands
      (
        name,
        slug,
        description,
        logo,
        status,
        created_at,
        updated_at
      )
    VALUES (?, ?, ?, ?, ?, NOW(), NOW())
  `;

  db.query(
    sql,
    [name, slug, body.description || null, logo, status],
    (err, result) => {
      if (err) {
        return handleDatabaseError(err, res, "Failed to create brand");
      }

      return res.status(201).json({
        success: true,
        message: "Brand created successfully",
        brand_id: result.insertId,
        slug,
        logo,
      });
    },
  );
};

// ========================================
// UPDATE BRAND WITH AUDIT LOG
// ========================================

const updateBrand = (req, res) => {
  const { id } = req.params;
  const body = req.body ?? {};

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const slug = generateSlug(name);

  const hasDescription = Object.hasOwn(body, "description");

  const description =
    typeof body.description === "string" && body.description.trim()
      ? body.description.trim()
      : null;

  const rawStatus = body.status;

  const hasStatus =
    Object.hasOwn(body, "status") &&
    rawStatus != null &&
    !(typeof rawStatus === "string" && !rawStatus.trim());

  const status = hasStatus ? normalizeStatus(rawStatus, null) : null;

  if (!isValidId(id)) {
    return res.status(400).json({
      success: false,
      message: "A valid brand ID is required",
    });
  }

  if (!name || !slug) {
    return res.status(400).json({
      success: false,
      message: "A valid brand name is required",
    });
  }

  if (hasStatus && !status) {
    return res.status(400).json({
      success: false,
      message: "Invalid status. Use active or inactive",
    });
  }

  const logoFile = getUploadedBrandLogo(req);

  const logo = logoFile
    ? `uploads/brandlogo/${logoFile.filename}`
    : body.logo || null;

  const adminId = req.user?.user_id ?? req.user?.id;

  if (!adminId) {
    return res.status(401).json({
      success: false,
      message: "Invalid admin authentication",
    });
  }

  req.skipGenericAudit = true;

  db.query(
    `
      SELECT id, name, slug, description, logo, status
      FROM brands
      WHERE id = ?
      LIMIT 1
    `,
    [id],
    (selectError, rows) => {
      if (selectError) {
        return handleDatabaseError(
          selectError,
          res,
          "Failed to fetch brand before update",
        );
      }

      if (!rows || rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Brand not found",
        });
      }

      const oldBrand = rows[0];

      const oldValues = {
        name: oldBrand.name,
        slug: oldBrand.slug,
        description: oldBrand.description,
        logo: oldBrand.logo,
        status: oldBrand.status,
      };

      const newValues = {
        name,
        slug,
        description: hasDescription ? description : oldBrand.description,
        logo: logo || oldBrand.logo,
        status: hasStatus ? status : oldBrand.status,
      };

      const updateSql = `
        UPDATE brands
        SET
          name = ?,
          slug = ?,
          description = CASE
            WHEN ? THEN ?
            ELSE description
          END,
          logo = COALESCE(?, logo),
          status = CASE
            WHEN ? THEN ?
            ELSE status
          END,
          updated_at = NOW()
        WHERE id = ?
      `;

      db.query(
        updateSql,
        [name, slug, hasDescription, description, logo, hasStatus, status, id],
        (updateError) => {
          if (updateError) {
            return handleDatabaseError(
              updateError,
              res,
              "Failed to update brand",
            );
          }

          const auditSql = `
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
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `;

          db.query(
            auditSql,
            [
              adminId,
              "PUT /api/admin/brands/:id",
              "brands",
              Number(id),
              JSON.stringify(oldValues),
              JSON.stringify(newValues),
              (req.ip || "").slice(0, 45) || null,
            ],
            (auditError) => {
              if (auditError) {
                console.error("Brand audit log error:", auditError);
              }

              return res.status(200).json({
                success: true,
                message: "Brand updated successfully",
                slug,
                ...(logo ? { logo } : {}),
              });
            },
          );
        },
      );
    },
  );
};

const deleteBrand = (req, res) => deleteRecord("brands", "brand", req, res);

// ========================================
// EXPORT CONTROLLERS
// ========================================

// ========================================
// GET CUSTOMER DETAILS
// ========================================

const getUserDetails = (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({
      success: false,
      message: "A valid customer ID is required",
    });
  }

  const userSql = `
    SELECT
      id,
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

  db.query(userSql, [id], (userError, users) => {
    if (userError) {
      return handleDatabaseError(
        userError,
        res,
        "Failed to fetch customer details",
      );
    }

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    const customer = users[0];

    const addressesSql = `
      SELECT
        id,
        type,
        name,
        phone,
        address_line_1,
        address_line_2,
        city,
        state,
        country,
        pincode,
        is_default,
        created_at,
        updated_at
      FROM addresses
      WHERE user_id = ?
      ORDER BY is_default DESC, id DESC
    `;

    db.query(addressesSql, [id], (addressError, addresses) => {
      if (addressError) {
        return handleDatabaseError(
          addressError,
          res,
          "Failed to fetch customer addresses",
        );
      }

      const ordersSql = `
        SELECT
          id,
          order_number,
          subtotal,
          discount,
          coupon_discount,
          tax,
          shipping_fee,
          total_amount,
          payment_status,
          order_status,
          created_at,
          updated_at
        FROM orders
        WHERE user_id = ?
        ORDER BY id DESC
      `;

      db.query(ordersSql, [id], (ordersError, orders) => {
        if (ordersError) {
          return handleDatabaseError(
            ordersError,
            res,
            "Failed to fetch customer orders",
          );
        }

        const ticketsSql = `
          SELECT
            id,
            ticket_number,
            category,
            priority,
            subject,
            status,
            created_at,
            updated_at
          FROM support_tickets
          WHERE user_id = ?
          ORDER BY id DESC
        `;

        db.query(ticketsSql, [id], (ticketsError, tickets) => {
          if (ticketsError) {
            return handleDatabaseError(
              ticketsError,
              res,
              "Failed to fetch customer support tickets",
            );
          }

          return res.status(200).json({
            success: true,
            data: {
              customer,
              addresses,
              orders,
              support_tickets: tickets,
              summary: {
                total_addresses: addresses.length,
                total_orders: orders.length,
                total_support_tickets: tickets.length,
              },
            },
          });
        });
      });
    });
  });
};

// ========================================
// DELETE CUSTOMER SAFELY
// ========================================

const deleteUser = (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({
      success: false,
      message: "A valid customer ID is required",
    });
  }

  const adminId = req.user?.user_id ?? req.user?.id;

  if (!adminId) {
    return res.status(401).json({
      success: false,
      message: "Invalid admin authentication",
    });
  }

  // Preserve the generic audit middleware behavior.
  // This API does not delete anything until checks finish.
  const userSql = `
    SELECT id, name, email, status
    FROM users
    WHERE id = ?
    LIMIT 1
  `;

  db.query(userSql, [id], (userError, users) => {
    if (userError) {
      return handleDatabaseError(userError, res, "Failed to fetch customer");
    }

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    const referenceTables = [
      "addresses",
      "activity_logs",
      "carts",
      "coupon_usages",
      "credit_notes",
      "inventory_movements",
      "login_attempts",
      "notifications",
      "orders",
      "order_returns",
      "order_status_history",
      "order_notes",
      "otp_verifications",
      "password_resets",
      "payments",
      "products",
      "refund_status_history",
      "recently_viewed",
      "reviews",
      "review_reports",
      "shipment_events",
      "stock_adjustments",
      "support_tickets",
      "user_roles",
      "wishlists",
    ];

    const checkReferences = (index) => {
      if (index >= referenceTables.length) {
        // Avoid automatic deletion of accounts with related records.
        // Even if these checks pass, another FK may still prevent deletion.
        const auditSql = `
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
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        const auditValues = [
          adminId,
          "DELETE /api/admin/users/:id",
          "users",
          Number(id),
          JSON.stringify({
            name: users[0].name,
            email: users[0].email,
            status: users[0].status,
          }),
          JSON.stringify({
            result: "blocked",
            reason: "Customer deletion requires verified relationship checks",
          }),
          (req.ip || "").slice(0, 45) || null,
        ];

        db.query(auditSql, auditValues, (auditError) => {
          if (auditError) {
            console.error("Customer deletion audit error:", auditError);
          }

          return res.status(409).json({
            success: false,
            message:
              "Permanent customer deletion is disabled to protect order history and related records. Set the customer status to inactive instead.",
            customer_id: Number(id),
            alternative: "PUT /api/admin/users/:id/status",
          });
        });

        return;
      }

      const table = referenceTables[index];

      // Table names come only from the fixed allowlist above.
      const sql = `SELECT COUNT(*) AS total FROM \`${table}\` WHERE ${
        table === "credit_notes" ||
        table === "products" ||
        table === "inventory_movements" ||
        table === "order_notes" ||
        table === "order_status_history" ||
        table === "refund_status_history" ||
        table === "shipment_events" ||
        table === "stock_adjustments"
          ? table === "order_status_history" ||
            table === "refund_status_history"
            ? "changed_by"
            : table === "order_notes" ||
                table === "credit_notes" ||
                table === "inventory_movements" ||
                table === "stock_adjustments"
              ? "created_by"
              : table === "products"
                ? "created_by"
                : "updated_by"
          : "user_id"
      } = ?`;

      db.query(sql, [id], (checkError, rows) => {
        if (checkError) {
          return handleDatabaseError(
            checkError,
            res,
            `Failed to check customer references in ${table}`,
          );
        }

        // Stop deletion as soon as a related record exists.
        if (rows[0].total > 0) {
          return res.status(409).json({
            success: false,
            message:
              "Customer cannot be deleted because related records exist. Set the customer status to inactive instead.",
            customer_id: Number(id),
            related_table: table,
            related_records: Number(rows[0].total),
            alternative: "PUT /api/admin/users/:id/status",
          });
        }

        checkReferences(index + 1);
      });
    };

    checkReferences(0);
  });
};

module.exports = {
  getUsers,
  updateUserStatus,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getBrands,
  createBrand,
  updateBrand,
  deleteBrand,
    getUserDetails,
  deleteUser,
};
