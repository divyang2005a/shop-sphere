const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const db = require("../config/db");

const getProducts = (req, res) => {
  const sql = `
    SELECT
      id,
      category_id,
      brand_id,
      sku,
      product_code,
      title,
      slug,
      base_price,
      sale_price,
      stock_quantity,
      stock_status,
      status,
      created_at,
      updated_at
    FROM products
    ORDER BY id DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({
        success: false,
        message: "Failed to Fatch Products",
      });
    }

    return res.status(200).json({
      success: true,
      products: results,
    });
  });
};

const createProduct = (req, res) => {
  const {
    category_name,
    brand_name,
    title,
    short_description,
    full_description,
    base_price,
    sale_price,
    stock_quantity,
    low_stock_threshold,
    stock_status,
    featured,
    bestseller,
    new_arrival,
    status,
    meta_title,
    meta_description,
    tax_percentage,
  } = req.body || {};

  if (
    !category_name ||
    !title ||
    base_price === undefined ||
    base_price === null ||
    base_price === ""
  ) {
    return res.status(400).json({
      success: false,
      message: "Category name, title and base price are required",
    });
  }

  const basePrice = Number(base_price);
  const salePrice =
    sale_price === undefined || sale_price === null || sale_price === ""
      ? null
      : Number(sale_price);
  const taxPercentage = Number(tax_percentage);

  if (!Number.isFinite(basePrice) || basePrice <= 0) {
    return res.status(400).json({
      success: false,
      message: "Base price must be greater than zero",
    });
  }

  if (
    salePrice !== null &&
    (!Number.isFinite(salePrice) || salePrice < 0 || salePrice > basePrice)
  ) {
    return res.status(400).json({
      success: false,
      message: "Sale price must be between zero and base price",
    });
  }

  if (
    tax_percentage === undefined ||
    tax_percentage === null ||
    tax_percentage === "" ||
    !Number.isFinite(taxPercentage)
  ) {
    return res.status(400).json({
      success: false,
      message: "Please select a GST percentage",
    });
  }

  const cleanTitle = title.trim();
  const cleanCategoryName = category_name.trim();
  const cleanBrandName =
    typeof brand_name === "string" ? brand_name.trim() : "";

  const slug = cleanTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug || !cleanCategoryName) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid title and category name",
    });
  }

  const discount_percentage =
    salePrice !== null && salePrice < basePrice
      ? Number((((basePrice - salePrice) / basePrice) * 100).toFixed(2))
      : 0;

  // Resolve category name to its database ID.
  db.query(
    "SELECT id, name FROM categories WHERE name = ? LIMIT 1",
    [cleanCategoryName],
    (categoryErr, categoryRows) => {
      if (categoryErr) {
        console.error(categoryErr);
        return res.status(500).json({
          success: false,
          message: "Failed to find category",
        });
      }

      if (!categoryRows.length) {
        return res.status(400).json({
          success: false,
          message: "Selected category was not found",
        });
      }

      const category_id = categoryRows[0].id;

      const findBrand = (callback) => {
        if (!cleanBrandName) {
          return callback(null, null);
        }

        db.query(
          "SELECT id, name FROM brands WHERE name = ? LIMIT 1",
          [cleanBrandName],
          (brandErr, brandRows) => {
            if (brandErr) {
              console.error(brandErr);
              return res.status(500).json({
                success: false,
                message: "Failed to find brand",
              });
            }

            if (!brandRows.length) {
              return res.status(400).json({
                success: false,
                message: "Selected brand was not found",
              });
            }

            callback(null, brandRows[0].id);
          },
        );
      };

      findBrand((brandErr, brand_id) => {
        if (brandErr) return;

        // Verify that the selected GST percentage exists in the database.
        db.query(
          `SELECT gst_percentage
           FROM gst_rates
           WHERE status = 1 AND gst_percentage = ?
           LIMIT 1`,
          [taxPercentage],
          (gstErr, gstRows) => {
            if (gstErr) {
              console.error(gstErr);
              return res.status(500).json({
                success: false,
                message: "Failed to validate GST percentage",
              });
            }

            if (!gstRows.length) {
              return res.status(400).json({
                success: false,
                message: "Selected GST percentage is not configured",
              });
            }

            const uniqueSuffix = crypto
              .randomBytes(4)
              .toString("hex")
              .toUpperCase();

            const product_code = `PROD-${uniqueSuffix}`;
            const sku = `${slug.slice(0, 12).toUpperCase()}-${uniqueSuffix}`;

            const sql = `
              INSERT INTO products (
                category_id, brand_id, sku, product_code, title, slug,
                short_description, full_description, base_price, sale_price,
                discount_percentage, tax_percentage, stock_quantity,
                low_stock_threshold, stock_status, featured, bestseller,
                new_arrival, status, meta_title, meta_description,
                created_by, created_at, updated_at
              )
              VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, NOW(), NOW()
              )
            `;

            const values = [
              category_id,
              brand_id,
              sku,
              product_code,
              cleanTitle,
              slug,
              short_description || null,
              full_description || null,
              basePrice,
              salePrice,
              discount_percentage,
              Number(gstRows[0].gst_percentage),
              stock_quantity ?? 0,
              low_stock_threshold ?? 5,
              stock_status || "out_of_stock",
              featured ?? 0,
              bestseller ?? 0,
              new_arrival ?? 0,
              status || "inactive",
              meta_title || null,
              meta_description || null,
              req.user.user_id,
            ];

            db.query(sql, values, (insertErr, result) => {
              if (insertErr) {
                console.error(insertErr);

                if (insertErr.code === "ER_DUP_ENTRY") {
                  return res.status(409).json({
                    success: false,
                    message:
                      "Generated SKU or product code already exists. Please retry.",
                  });
                }

                return res.status(500).json({
                  success: false,
                  message: "Failed to create product",
                });
              }

              return res.status(201).json({
                success: true,
                message: "Product created successfully",
                product: {
                  id: result.insertId,
                  category_id,
                  category_name: categoryRows[0].name,
                  brand_id,
                  brand_name: cleanBrandName || null,
                  product_code,
                  sku,
                  title: cleanTitle,
                  slug,
                  base_price: basePrice,
                  sale_price: salePrice,
                  discount_percentage,
                  tax_percentage: Number(gstRows[0].gst_percentage),
                },
              });
            });
          },
        );
      });
    },
  );
};


const updateProduct = (req, res) => {
  const productId = Number(req.params.product_id);
  const body = req.body || {};

  if (!Number.isSafeInteger(productId) || productId <= 0) {
    return res.status(400).json({
      success: false,
      message: "A valid product ID is required",
    });
  }

  const {
    category_id,
    brand_id,
    sku,
    product_code,
    title,
    slug,
    short_description,
    full_description,
    base_price,
    sale_price,
    discount_percentage,
    tax_percentage,
    stock_quantity,
    low_stock_threshold,
    stock_status,
    featured,
    bestseller,
    new_arrival,
    status,
    meta_title,
    meta_description,
  } = body;

  const adminId = req.user?.user_id ?? req.user?.id;

  if (!adminId) {
    return res.status(401).json({
      success: false,
      message: "Invalid admin authentication",
    });
  }

  // This controller writes its own audit entry.
  req.skipGenericAudit = true;

  const sql = `
    UPDATE products
    SET
      category_id = ?,
      brand_id = ?,
      sku = ?,
      product_code = ?,
      title = ?,
      slug = ?,
      short_description = ?,
      full_description = ?,
      base_price = ?,
      sale_price = ?,
      discount_percentage = ?,
      tax_percentage = ?,
      stock_quantity = ?,
      low_stock_threshold = ?,
      stock_status = ?,
      featured = ?,
      bestseller = ?,
      new_arrival = ?,
      status = ?,
      meta_title = ?,
      meta_description = ?,
      updated_by = ?,
      updated_at = NOW()
    WHERE id = ?
  `;

  const values = [
    category_id,
    brand_id ?? null,
    sku,
    product_code,
    title,
    slug,
    short_description ?? null,
    full_description ?? null,
    base_price,
    sale_price ?? null,
    discount_percentage ?? 0,
    tax_percentage ?? 0,
    stock_quantity ?? 0,
    low_stock_threshold ?? 5,
    stock_status ?? "out_of_stock",
    featured ?? 0,
    bestseller ?? 0,
    new_arrival ?? 0,
    status ?? "inactive",
    meta_title ?? null,
    meta_description ?? null,
    adminId,
    productId,
  ];

  // Read the current product before updating it.
  db.query(
    "SELECT * FROM products WHERE id = ? LIMIT 1",
    [productId],
    (selectError, rows) => {
      if (selectError) {
        console.error(
          "Fetch product before update error:",
          selectError
        );

        return res.status(500).json({
          success: false,
          message: "Failed to fetch product before update",
        });
      }

      if (!rows || rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      const oldProduct = rows[0];

      const newValues = {
        category_id,
        brand_id: brand_id ?? null,
        sku,
        product_code,
        title,
        slug,
        short_description: short_description ?? null,
        full_description: full_description ?? null,
        base_price,
        sale_price: sale_price ?? null,
        discount_percentage: discount_percentage ?? 0,
        tax_percentage: tax_percentage ?? 0,
        stock_quantity: stock_quantity ?? 0,
        low_stock_threshold: low_stock_threshold ?? 5,
        stock_status: stock_status ?? "out_of_stock",
        featured: featured ?? 0,
        bestseller: bestseller ?? 0,
        new_arrival: new_arrival ?? 0,
        status: status ?? "inactive",
        meta_title: meta_title ?? null,
        meta_description: meta_description ?? null,
      };

      db.query(sql, values, (updateError) => {
        if (updateError) {
          console.error("Update product error:", updateError);

          return res.status(500).json({
            success: false,
            message: "Failed to update product",
          });
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
            "PUT /api/admin/products/:product_id",
            "products",
            productId,
            JSON.stringify(oldProduct),
            JSON.stringify(newValues),
            (req.ip || "").slice(0, 45) || null,
          ],
          (auditError) => {
            if (auditError) {
              console.error(
                "Product update audit log error:",
                auditError
              );
            }

            return res.status(200).json({
              success: true,
              message: "Product updated successfully",
            });
          }
        );
      });
    }
  );
};


const deleteProduct = (req, res) => {
  const productId = Number(req.params.product_id);
  const adminId = req.user?.user_id ?? req.user?.id;

  if (!Number.isSafeInteger(productId) || productId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Valid product ID is required",
    });
  }

  if (!adminId) {
    return res.status(401).json({
      success: false,
      message: "Invalid admin authentication",
    });
  }

  // This controller writes its own audit entry.
  req.skipGenericAudit = true;

  db.getConnection((connectionError, connection) => {
    if (connectionError) {
      console.error("Product delete connection error:", connectionError);

      return res.status(500).json({
        success: false,
        message: "Failed to delete product",
      });
    }

    connection.beginTransaction((transactionError) => {
      if (transactionError) {
        connection.release();

        console.error(
          "Product delete transaction error:",
          transactionError
        );

        return res.status(500).json({
          success: false,
          message: "Failed to delete product",
        });
      }

      // Fetch and lock the product before deleting it.
      connection.query(
        "SELECT * FROM products WHERE id = ? LIMIT 1 FOR UPDATE",
        [productId],
        (selectError, rows) => {
          if (selectError) {
            return connection.rollback(() => {
              connection.release();

              console.error(
                "Fetch product before delete error:",
                selectError
              );

              return res.status(500).json({
                success: false,
                message: "Failed to fetch product before deletion",
              });
            });
          }

          if (!rows || rows.length === 0) {
            return connection.rollback(() => {
              connection.release();

              return res.status(404).json({
                success: false,
                message: "Product not found",
              });
            });
          }

          const oldProduct = rows[0];

          connection.query(
            "DELETE FROM products WHERE id = ?",
            [productId],
            (deleteError, result) => {
              if (deleteError) {
                return connection.rollback(() => {
                  connection.release();

                  console.error(
                    "Delete product database error:",
                    deleteError
                  );

                  return res.status(500).json({
                    success: false,
                    message:
                      "Failed to delete product. Check related database records.",
                  });
                });
              }

              if (!result.affectedRows) {
                return connection.rollback(() => {
                  connection.release();

                  return res.status(404).json({
                    success: false,
                    message: "Product not found",
                  });
                });
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
                VALUES (?, ?, ?, ?, ?, NULL, ?)
              `;

              connection.query(
                auditSql,
                [
                  adminId,
                  "DELETE /api/admin/products/:product_id",
                  "products",
                  productId,
                  JSON.stringify(oldProduct),
                  (req.ip || "").slice(0, 45) || null,
                ],
                (auditError) => {
                  if (auditError) {
                    return connection.rollback(() => {
                      connection.release();

                      console.error(
                        "Product delete audit log error:",
                        auditError
                      );

                      return res.status(500).json({
                        success: false,
                        message:
                          "Failed to save audit log; product deletion was rolled back",
                      });
                    });
                  }

                  connection.commit((commitError) => {
                    if (commitError) {
                      return connection.rollback(() => {
                        connection.release();

                        console.error(
                          "Product delete commit error:",
                          commitError
                        );

                        return res.status(500).json({
                          success: false,
                          message: "Failed to delete product",
                        });
                      });
                    }

                    connection.release();

                    return res.status(200).json({
                      success: true,
                      message: "Product deleted successfully",
                    });
                  });
                }
              );
            }
          );
        }
      );
    });
  });
};

const getProductImages = (req, res) => {
  const { product_id } = req.params;

  const sql = `
    SELECT
      id,
      product_id,
      image,
      image_type,
      is_primary,
      sort_order
    FROM product_images
    WHERE product_id = ?
    ORDER BY sort_order ASC, id ASC
  `;

  db.query(sql, [product_id], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch product images",
      });
    }

    return res.status(200).json({
      success: true,
      images: results,
    });
  });
};

const addProductImage = (req, res) => {
  const { product_id } = req.params;

  // Fix: multipart/form-data ke case mein req.body undefined ho sakta hai.
  const body = req.body || {};

  const image_type = body.image_type || "gallery";
  const is_primary = Number(body.is_primary) === 1 ? 1 : 0;
  const sort_order = Number(body.sort_order ?? 0);

  const allowedImageTypes = [
    "main",
    "gallery",
    "thumbnail",
    "front",
    "back",
    "side",
    "detail",
  ];

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Please select an image file",
    });
  }

  if (!allowedImageTypes.includes(image_type)) {
    fs.unlink(req.file.path, () => {});

    return res.status(400).json({
      success: false,
      message: "Invalid image type",
      allowed_types: allowedImageTypes,
    });
  }

  const imagePath = `/uploads/products/${req.file.filename}`;

  const sql = `
    INSERT INTO product_images
      (product_id, image, image_type, is_primary, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [product_id, imagePath, image_type, is_primary, sort_order],
    (err, result) => {
      if (err) {
        fs.unlink(req.file.path, () => {});
        console.error(err);

        return res.status(500).json({
          success: false,
          message: "Failed to add product image",
        });
      }

      return res.status(201).json({
        success: true,
        message: "Product image added successfully",
        image: {
          id: result.insertId,
          product_id,
          image: imagePath,
          image_type,
          is_primary,
          sort_order,
        },
      });
    },
  );
};

const deleteProductImage = (req, res) => {
  const { image_id } = req.params;

  db.query(
    "SELECT image FROM product_images WHERE id = ?",
    [image_id],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({
          success: false,
          message: "Failed to find product image",
        });
      }

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Product image not found",
        });
      }

      const imagePath = rows[0].image;

      db.query(
        "DELETE FROM product_images WHERE id = ?",
        [image_id],
        (deleteErr) => {
          if (deleteErr) {
            console.error(deleteErr);
            return res.status(500).json({
              success: false,
              message: "Failed to delete product image",
            });
          }

          const filename = path.basename(imagePath);
          const filePath = path.join(
            __dirname,
            "../uploads/products",
            filename,
          );

          fs.unlink(filePath, (fileErr) => {
            if (fileErr && fileErr.code !== "ENOENT") {
              console.error("Image file delete failed:", fileErr);
            }
          });

          return res.status(200).json({
            success: true,
            message: "Product image deleted successfully",
          });
        },
      );
    },
  );
};

const getProductVariants = (req, res) => {
  const { product_id } = req.params;

  const sql = `
    SELECT
      id,
      product_id,
      sku,
      variant_name,
      price,
      stock_quantity,
      status
    FROM product_variants
    WHERE product_id = ?
    ORDER BY id DESC
  `;

  db.query(sql, [product_id], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch product variants",
      });
    }

    return res.status(200).json({
      success: true,
      variants: results,
    });
  });
};

const createProductVariant = (req, res) => {
  const { product_id } = req.params;
  const { sku, variant_name, price, stock_quantity, status } = req.body;

  if (!sku || !variant_name || price === undefined) {
    return res.status(400).json({
      success: false,
      message: "SKU, variant name and price are required",
    });
  }

  const sql = `
    INSERT INTO product_variants (
      product_id,
      sku,
      variant_name,
      price,
      stock_quantity,
      status
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  const values = [
    product_id,
    sku,
    variant_name,
    price,
    stock_quantity ?? 0,
    status ?? "active",
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({
        success: false,
        message: "Failed to create product variant",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Product variant created successfully",
      variant_id: result.insertId,
    });
  });
};

const updateProductVariant = (req, res) => {
  const { id } = req.params;
  const { sku, variant_name, price, stock_quantity, status } = req.body;

  if (!sku || !variant_name || price === undefined) {
    return res.status(400).json({
      success: false,
      message: "SKU, variant name and price are required",
    });
  }

  const sql = `
    UPDATE product_variants
    SET
      sku = ?,
      variant_name = ?,
      price = ?,
      stock_quantity = ?,
      status = ?
    WHERE id = ?
  `;

  const values = [
    sku,
    variant_name,
    price,
    stock_quantity ?? 0,
    status ?? "active",
    id,
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({
        success: false,
        message: "Failed to update product variant",
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Variant not found or no changes made",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product variant updated successfully",
    });
  });
};

const deleteProductVariant = (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM product_variants WHERE id = ?";

  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({
        success: false,
        message: "Failed to delete product variant",
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Product variant not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product variant deleted successfully",
    });
  });
};

const getGstRates = (req, res) => {
  const sql = `
    SELECT id, description, gst_percentage
    FROM gst_rates
    WHERE status = 1
    ORDER BY gst_percentage ASC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch GST rates",
      });
    }

    return res.status(200).json({
      success: true,
      tax_rates: results,
    });
  });
};

module.exports = {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductImages,
  addProductImage,
  deleteProductImage,
  getProductVariants,
  createProductVariant,
  updateProductVariant,
  deleteProductVariant,
  getGstRates,
};
