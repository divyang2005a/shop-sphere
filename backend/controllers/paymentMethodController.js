const db = require("../config/db");

const isValidId = (id) =>
  /^[1-9]\d*$/.test(String(id ?? "")) &&
  Number.isSafeInteger(Number(id));

const normalizeStatus = (value) => {
  if (value === undefined) {
    return "active";
  }

  if (typeof value !== "string") {
    return null;
  }

  const status = value.trim().toLowerCase();
  return ["active", "inactive"].includes(status) ? status : null;
};

const handleDatabaseError = (error, res, message) => {
  console.error(`${message}:`, error);

  if (error.code === "ER_DUP_ENTRY") {
    return res.status(409).json({
      success: false,
      message: "A payment method with this code already exists",
    });
  }

  return res.status(500).json({
    success: false,
    message,
  });
};

const getActivePaymentMethods = (req, res) => {
  db.query(
    `SELECT id, code, name, description
     FROM payment_methods
     WHERE status = 'active'
     ORDER BY sort_order ASC, id ASC`,
    (error, methods) => {
      if (error) {
        return handleDatabaseError(
          error,
          res,
          "Failed to fetch payment methods",
        );
      }

      return res.status(200).json({
        success: true,
        count: methods.length,
        payment_methods: methods,
      });
    },
  );
};

const getAdminPaymentMethods = (req, res) => {
  db.query(
    `SELECT id, code, name, description, status, sort_order,
            created_at, updated_at
     FROM payment_methods
     ORDER BY sort_order ASC, id ASC`,
    (error, methods) => {
      if (error) {
        return handleDatabaseError(
          error,
          res,
          "Failed to fetch payment methods",
        );
      }

      return res.status(200).json({
        success: true,
        count: methods.length,
        payment_methods: methods,
      });
    },
  );
};

const createPaymentMethod = (req, res) => {
  const body = req.body ?? {};
  const code =
    typeof body.code === "string" ? body.code.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description =
    body.description == null
      ? null
      : typeof body.description === "string"
        ? body.description.trim()
        : undefined;
  const status = normalizeStatus(body.status);
  const sortOrder =
    body.sort_order === undefined ? 0 : Number(body.sort_order);

  if (!/^[a-z0-9_-]{1,50}$/.test(code)) {
    return res.status(400).json({
      success: false,
      message:
        "Payment method code must be 1-50 lowercase letters, numbers, hyphens, or underscores",
    });
  }

  if (!name || name.length > 100) {
    return res.status(400).json({
      success: false,
      message: "Payment method name is required and must be at most 100 characters",
    });
  }

  if (
    description === undefined ||
    (description !== null && description.length > 1000)
  ) {
    return res.status(400).json({
      success: false,
      message: "Description must be a string of at most 1000 characters",
    });
  }

  if (!status || !Number.isSafeInteger(sortOrder) || sortOrder < 0) {
    return res.status(400).json({
      success: false,
      message: "Provide a valid status and non-negative sort_order",
    });
  }

  db.query(
    `INSERT INTO payment_methods (code, name, description, status, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
    [code, name, description || null, status, sortOrder],
    (error, result) => {
      if (error) {
        return handleDatabaseError(
          error,
          res,
          "Failed to create payment method",
        );
      }

      return res.status(201).json({
        success: true,
        message: "Payment method created successfully",
        payment_method: {
          id: result.insertId,
          code,
          name,
          description: description || null,
          status,
          sort_order: sortOrder,
        },
      });
    },
  );
};

const updatePaymentMethod = (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({
      success: false,
      message: "A valid payment method ID is required",
    });
  }

  const body = req.body ?? {};
  const fields = [];
  const values = [];

  if (Object.hasOwn(body, "name")) {
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name || name.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Payment method name is required and must be at most 100 characters",
      });
    }

    fields.push("name = ?");
    values.push(name);
  }

  if (Object.hasOwn(body, "description")) {
    if (
      body.description !== null &&
      (typeof body.description !== "string" ||
        body.description.length > 1000)
    ) {
      return res.status(400).json({
        success: false,
        message: "Description must be a string of at most 1000 characters",
      });
    }

    fields.push("description = ?");
    values.push(
      typeof body.description === "string"
        ? body.description.trim() || null
        : null,
    );
  }

  if (Object.hasOwn(body, "status")) {
    const status = normalizeStatus(body.status);

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status must be active or inactive",
      });
    }

    fields.push("status = ?");
    values.push(status);
  }

  if (Object.hasOwn(body, "sort_order")) {
    const sortOrder = Number(body.sort_order);

    if (!Number.isSafeInteger(sortOrder) || sortOrder < 0) {
      return res.status(400).json({
        success: false,
        message: "sort_order must be a non-negative integer",
      });
    }

    fields.push("sort_order = ?");
    values.push(sortOrder);
  }

  if (!fields.length) {
    return res.status(400).json({
      success: false,
      message: "Provide at least one field to update",
    });
  }

  values.push(id);

  db.query(
    `UPDATE payment_methods SET ${fields.join(", ")} WHERE id = ?`,
    values,
    (error, result) => {
      if (error) {
        return handleDatabaseError(
          error,
          res,
          "Failed to update payment method",
        );
      }

      if (result.affectedRows === 0) {
        db.query(
          "SELECT id FROM payment_methods WHERE id = ? LIMIT 1",
          [id],
          (lookupError, methods) => {
            if (lookupError) {
              return handleDatabaseError(
                lookupError,
                res,
                "Failed to update payment method",
              );
            }

            if (!methods.length) {
              return res.status(404).json({
                success: false,
                message: "Payment method not found",
              });
            }

            return res.status(200).json({
              success: true,
              message: "Payment method updated successfully",
            });
          },
        );
        return;
      }

      return res.status(200).json({
        success: true,
        message: "Payment method updated successfully",
      });
    },
  );
};

module.exports = {
  createPaymentMethod,
  getActivePaymentMethods,
  getAdminPaymentMethods,
  updatePaymentMethod,
};
