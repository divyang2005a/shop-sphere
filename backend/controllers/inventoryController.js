const db = require("../config/db");

// Get inventory movements
const getInventoryMovements = (req, res) => {
  const sql = `
    SELECT
      id,
      product_id,
      variant_id,
      type,
      quantity,
      reference_type,
      reference_id,
      note,
      created_by,
      created_at
    FROM inventory_movements
    ORDER BY created_at DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Inventory movements error:", err);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch inventory movements",
      });
    }

    return res.status(200).json({
      success: true,
      count: results.length,
      data: results,
    });
  });
};

// Create inventory movement and update stock atomically
const createInventoryMovement = (req, res) => {
  const {
    product_id,
    variant_id,
    type,
    quantity,
    reference_type,
    reference_id,
    note,
  } = req.body;

  const productId = Number(product_id);
  const qty = Number(quantity);

  const variantId =
    variant_id === undefined || variant_id === null || variant_id === ""
      ? null
      : Number(variant_id);

  if (
    !Number.isInteger(productId) ||
    productId <= 0 ||
    !["stock_in", "stock_out"].includes(type) ||
    !Number.isInteger(qty) ||
    qty <= 0 ||
    (variantId !== null &&
      (!Number.isInteger(variantId) || variantId <= 0))
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Valid product ID, optional variant ID, movement type, and positive integer quantity are required",
    });
  }

  const userId = req.user?.user_id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authenticated user not found",
    });
  }

  db.getConnection((connErr, conn) => {
    if (connErr) {
      console.error("Inventory connection error:", connErr);

      return res.status(500).json({
        success: false,
        message: "Database connection failed",
      });
    }

    conn.beginTransaction((txErr) => {
      if (txErr) {
        conn.release();
        console.error("Inventory transaction error:", txErr);

        return res.status(500).json({
          success: false,
          message: "Could not start inventory transaction",
        });
      }

      let finished = false;

      const fail = (statusCode, message, error = null) => {
        if (finished) return;

        finished = true;

        if (error) {
          console.error("Inventory movement error:", error);
        }

        conn.rollback(() => {
          conn.release();

          if (!res.headersSent) {
            return res.status(statusCode).json({
              success: false,
              message,
            });
          }
        });
      };

      const commit = (movementId) => {
        if (finished) return;

        conn.commit((commitErr) => {
          if (commitErr) {
            return fail(
              500,
              "Could not commit inventory update",
              commitErr,
            );
          }

          finished = true;
          conn.release();

          return res.status(201).json({
            success: true,
            message: "Inventory movement recorded and stock updated successfully",
            movement_id: movementId,
            product_id: productId,
            variant_id: variantId,
            type,
            quantity: qty,
          });
        });
      };

      const selectSql =
        variantId !== null
          ? `SELECT id, stock_quantity
             FROM product_variants
             WHERE id = ? AND product_id = ?
             FOR UPDATE`
          : `SELECT id, stock_quantity
             FROM products
             WHERE id = ?
             FOR UPDATE`;

      const selectValues =
        variantId !== null ? [variantId, productId] : [productId];

      conn.query(selectSql, selectValues, (selectErr, rows) => {
        if (selectErr) {
          return fail(500, "Failed to check current stock", selectErr);
        }

        if (rows.length === 0) {
          return fail(404, "Product or matching variant not found");
        }

        const currentStock = Number(rows[0].stock_quantity ?? 0);

        if (!Number.isFinite(currentStock) || currentStock < 0) {
          return fail(409, "Current stock value is invalid");
        }

        if (type === "stock_out" && currentStock < qty) {
          return fail(400, "Insufficient stock for stock_out");
        }

        const delta = type === "stock_in" ? qty : -qty;
        const table = variantId !== null ? "product_variants" : "products";

        conn.query(
          `UPDATE ${table}
           SET stock_quantity = COALESCE(stock_quantity, 0) + ?
           WHERE id = ?`,
          [delta, rows[0].id],
          (updateErr, updateResult) => {
            if (updateErr) {
              return fail(500, "Failed to update stock", updateErr);
            }

            if (updateResult.affectedRows !== 1) {
              return fail(404, "Product or variant not found");
            }

            const movementSql = `
              INSERT INTO inventory_movements (
                product_id,
                variant_id,
                type,
                quantity,
                reference_type,
                reference_id,
                note,
                created_by
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const movementValues = [
              productId,
              variantId,
              type,
              qty,
              reference_type ?? null,
              reference_id ?? null,
              note ?? null,
              userId,
            ];

            conn.query(
              movementSql,
              movementValues,
              (insertErr, result) => {
                if (insertErr) {
                  return fail(
                    500,
                    "Failed to record inventory movement",
                    insertErr,
                  );
                }

                commit(result.insertId);
              },
            );
          },
        );
      });
    });
  });
};

// Set product stock directly
// This endpoint does not create an inventory movement record.
const updateInventory = (req, res) => {
  const productId = Number(req.params.product_id);
  const rawStock = req.body.stock_quantity;
  const stockQuantity = Number(rawStock);

  if (
    !Number.isInteger(productId) ||
    productId <= 0 ||
    rawStock === undefined ||
    rawStock === null ||
    rawStock === "" ||
    !Number.isInteger(stockQuantity) ||
    stockQuantity < 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Valid product ID and non-negative integer stock quantity are required",
    });
  }

  const sql = `
    UPDATE products
    SET stock_quantity = ?,
        stock_status = CASE
          WHEN ? = 0 THEN 'out_of_stock'
          ELSE 'in_stock'
        END,
        updated_at = NOW()
    WHERE id = ?
  `;

  db.query(
    sql,
    [stockQuantity, stockQuantity, productId],
    (err, result) => {
      if (err) {
        console.error("Update inventory error:", err);

        return res.status(500).json({
          success: false,
          message: "Failed to update inventory",
        });
      }

      if (result.affectedRows === 0) {
        // A zero affectedRows value can also mean the value was unchanged.
        db.query(
          "SELECT id FROM products WHERE id = ?",
          [productId],
          (selectErr, rows) => {
            if (selectErr) {
              console.error("Product lookup error:", selectErr);

              return res.status(500).json({
                success: false,
                message: "Failed to verify product",
              });
            }

            if (rows.length === 0) {
              return res.status(404).json({
                success: false,
                message: "Product not found",
              });
            }

            return res.status(200).json({
              success: true,
              message: "Inventory updated successfully",
              data: {
                product_id: productId,
                stock_quantity: stockQuantity,
              },
            });
          },
        );

        return;
      }

      return res.status(200).json({
        success: true,
        message: "Inventory updated successfully",
        data: {
          product_id: productId,
          stock_quantity: stockQuantity,
        },
      });
    },
  );
};

module.exports = {
  getInventoryMovements,
  createInventoryMovement,
  updateInventory,
};