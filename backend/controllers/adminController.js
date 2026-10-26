const path = require("path");
const fs = require("fs");
const db = require("../config/db");

// Generate slug automatically
const generateSlug = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Common helpers
const isPositiveId = (value) => /^[1-9]\d*$/.test(String(value ?? ""));

const isNonNegativeNumber = (value) =>
  value !== "" &&
  value !== null &&
  value !== undefined &&
  Number.isFinite(Number(value)) &&
  Number(value) >= 0;

const validBoolean = (value) => [0, 1, "0", "1", true, false].includes(value);

const handleDbError = (err, res, message) => {
  console.error(message, err);

  if (err.code === "ER_DUP_ENTRY") {
    return res.status(409).json({
      success: false,
      message: "SKU, product code, or slug already exists",
    });
  }

  if (err.code === "ER_NO_REFERENCED_ROW_2") {
    return res.status(400).json({
      success: false,
      message: "Selected category, brand, or user does not exist",
    });
  }

  return res.status(500).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== "production" ? { error: err.message } : {}),
  });
};

// Get all products

// Get all products with search, filters, sorting and pagination
const getProducts = (req, res) => {
  const {
    category,
    category_id,
    brand_id,
    search,
    min_price,
    max_price,
    sort_by,
    sort_order,
    page = "1",
    limit = "20",
  } = req.query;

  const conditions = [];
  const values = [];

  // Existing category name/slug filter
  if (category !== undefined) {
    if (typeof category !== "string" || !category.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid category name or slug",
      });
    }

    conditions.push(
      `(LOWER(c.name) = LOWER(?) OR LOWER(c.slug) = LOWER(?))`
    );
    values.push(category.trim(), category.trim());
  }

  // Category ID filter
  if (category_id !== undefined) {
    if (!/^[1-9]\d*$/.test(String(category_id))) {
      return res.status(400).json({
        success: false,
        message: "Invalid category_id",
      });
    }

    conditions.push("p.category_id = ?");
    values.push(Number(category_id));
  }

  // Brand ID filter
  if (brand_id !== undefined) {
    if (!/^[1-9]\d*$/.test(String(brand_id))) {
      return res.status(400).json({
        success: false,
        message: "Invalid brand_id",
      });
    }

    conditions.push("p.brand_id = ?");
    values.push(Number(brand_id));
  }

  // Search by product title, SKU or product code
  if (search !== undefined) {
    if (typeof search !== "string" || !search.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid search term",
      });
    }

    const term = `%${search.trim()}%`;

    conditions.push(
      "(p.title LIKE ? OR p.sku LIKE ? OR p.product_code LIKE ?)"
    );
    values.push(term, term, term);
  }

  // Minimum price
  if (min_price !== undefined) {
    if (!isNonNegativeNumber(min_price)) {
      return res.status(400).json({
        success: false,
        message: "min_price must be a non-negative number",
      });
    }

    conditions.push("COALESCE(p.sale_price, p.base_price) >= ?");
    values.push(Number(min_price));
  }

  // Maximum price
  if (max_price !== undefined) {
    if (!isNonNegativeNumber(max_price)) {
      return res.status(400).json({
        success: false,
        message: "max_price must be a non-negative number",
      });
    }

    conditions.push("COALESCE(p.sale_price, p.base_price) <= ?");
    values.push(Number(max_price));
  }

  if (
    min_price !== undefined &&
    max_price !== undefined &&
    Number(min_price) > Number(max_price)
  ) {
    return res.status(400).json({
      success: false,
      message: "min_price cannot be greater than max_price",
    });
  }

  // Pagination validation
  if (!/^[1-9]\d*$/.test(String(page))) {
    return res.status(400).json({
      success: false,
      message: "page must be a positive integer",
    });
  }

  if (!/^[1-9]\d*$/.test(String(limit)) || Number(limit) > 100) {
    return res.status(400).json({
      success: false,
      message: "limit must be between 1 and 100",
    });
  }

  // Whitelist sorting columns to prevent SQL injection
  const sortColumns = {
    id: "p.id",
    title: "p.title",
    price: "COALESCE(p.sale_price, p.base_price)",
    created_at: "p.created_at",
  };

  const selectedSort = sort_by || "created_at";
  const selectedOrder = String(sort_order || "desc").toLowerCase();

  if (!Object.prototype.hasOwnProperty.call(sortColumns, selectedSort)) {
    return res.status(400).json({
      success: false,
      message: "sort_by must be id, title, price, or created_at",
    });
  }

  if (!["asc", "desc"].includes(selectedOrder)) {
    return res.status(400).json({
      success: false,
      message: "sort_order must be asc or desc",
    });
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const offset = (Number(page) - 1) * Number(limit);

  const countSql = `
    SELECT COUNT(*) AS total
    FROM products AS p
    LEFT JOIN categories AS c ON c.id = p.category_id
    ${whereClause}
  `;

  db.query(countSql, values, (countErr, countResults) => {
    if (countErr) {
      return handleDbError(countErr, res, "Failed to count products");
    }

    const total = Number(countResults[0].total);

    const sql = `
      SELECT
        p.id,
        p.category_id,
        p.brand_id,
        p.sku,
        p.product_code,
        p.title,
        p.slug,
        p.base_price,
        p.sale_price,
        p.stock_quantity,
        p.stock_status,
        p.status,
        p.created_at,
        p.updated_at
      FROM products AS p
      LEFT JOIN categories AS c ON c.id = p.category_id
      ${whereClause}
      ORDER BY ${sortColumns[selectedSort]} ${selectedOrder.toUpperCase()}
      LIMIT ? OFFSET ?
    `;

    db.query(
      sql,
      [...values, Number(limit), offset],
      (err, results) => {
        if (err) {
          return handleDbError(err, res, "Failed to fetch products");
        }

        return res.status(200).json({
          success: true,
          count: results.length,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            total_pages: Math.ceil(total / Number(limit)),
          },
          products: results,
        });
      }
    );
  });
};

// Get single product details with all images
const getProductDetails = (req, res) => {
  const { productId } = req.params;

  if (!/^[1-9]\d*$/.test(String(productId ?? ""))) {
    return res.status(400).json({
      success: false,
      message: "Invalid product ID",
    });
  }

  const productSql = `
    SELECT
      p.id,
      p.category_id,
      p.brand_id,
      p.sku,
      p.product_code,
      p.title,
      p.slug,
      p.hsn_code,
      p.short_description,
      p.full_description,
      p.base_price,
      p.sale_price,
      p.discount_percentage,
      p.tax_percentage,
      p.stock_quantity,
      p.stock_status,
      p.featured,
      p.bestseller,
      p.new_arrival,
      p.status,
      p.meta_title,
      p.meta_description,
      p.created_at,
      p.updated_at
    FROM products AS p
    WHERE p.id = ?
    LIMIT 1
  `;

  db.query(productSql, [productId], (err, products) => {
    if (err) {
      return handleDbError(err, res, "Failed to fetch product details");
    }

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const imageSql = `
      SELECT
        id,
        product_id,
        image,
        image_type,
        is_primary,
        sort_order
      FROM product_images
      WHERE product_id = ?
      ORDER BY is_primary DESC, sort_order ASC, id ASC
    `;

    db.query(imageSql, [productId], (imageErr, images) => {
      if (imageErr) {
        return handleDbError(imageErr, res, "Failed to fetch product images");
      }

      return res.status(200).json({
        success: true,
        data: {
          ...products[0],
          images,
          main_image: images.length > 0 ? images[0].image : null,
        },
      });
    });
  });
};

// Add product
const createProduct = (req, res) => {
  const body = req.body || {};

  const category_id = body.category_id;
  const brand_id = body.brand_id || null;
  const sku = String(body.sku || "").trim();
  const product_code = String(body.product_code || "").trim();
  const title = String(body.title || "").trim();
  const slug = generateSlug(body.slug || title);

  const {
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

  // Validate required fields
  if (!isPositiveId(category_id)) {
    return res.status(400).json({
      success: false,
      message: "A valid category_id is required",
    });
  }

  if (!sku || !product_code || !title || !slug) {
    return res.status(400).json({
      success: false,
      message: "SKU, product code and title are required",
    });
  }

  if (!isNonNegativeNumber(base_price)) {
    return res.status(400).json({
      success: false,
      message: "base_price must be a valid non-negative number",
    });
  }

  if (
    sale_price !== undefined &&
    sale_price !== null &&
    sale_price !== "" &&
    !isNonNegativeNumber(sale_price)
  ) {
    return res.status(400).json({
      success: false,
      message: "sale_price must be a valid non-negative number",
    });
  }

  const numericFields = {
    discount_percentage: discount_percentage ?? 0,
    tax_percentage: tax_percentage ?? 0,
    stock_quantity: stock_quantity ?? 0,
    low_stock_threshold: low_stock_threshold ?? 5,
  };

  for (const [field, value] of Object.entries(numericFields)) {
    if (!isNonNegativeNumber(value)) {
      return res.status(400).json({
        success: false,
        message: `${field} must be a non-negative number`,
      });
    }
  }

  if (
    Number(numericFields.discount_percentage) > 100 ||
    Number(numericFields.tax_percentage) > 100
  ) {
    return res.status(400).json({
      success: false,
      message: "Discount and tax percentages must be between 0 and 100",
    });
  }

  for (const field of ["featured", "bestseller", "new_arrival"]) {
    if (body[field] !== undefined && !validBoolean(body[field])) {
      return res.status(400).json({
        success: false,
        message: `${field} must be 0 or 1`,
      });
    }
  }

  if (brand_id !== null && !isPositiveId(brand_id)) {
    return res.status(400).json({
      success: false,
      message: "brand_id must be a valid ID or null",
    });
  }

  const allowedStatuses = ["active", "inactive", "draft"];
  const productStatus = status || "inactive";

  if (!allowedStatuses.includes(productStatus)) {
    return res.status(400).json({
      success: false,
      message: "status must be active, inactive, or draft",
    });
  }

  const quantity = Number(numericFields.stock_quantity);
  const calculatedStockStatus =
    stock_status ||
    (quantity <= 0
      ? "out_of_stock"
      : quantity <= Number(numericFields.low_stock_threshold)
        ? "low_stock"
        : "in_stock");

  const allowedStockStatuses = ["in_stock", "low_stock", "out_of_stock"];

  if (!allowedStockStatuses.includes(calculatedStockStatus)) {
    return res.status(400).json({
      success: false,
      message: "Invalid stock_status",
    });
  }

  // Support common JWT payload names
  const userId = req.user?.user_id ?? req.user?.id;

  if (!isPositiveId(userId)) {
    return res.status(401).json({
      success: false,
      message: "Valid authenticated user ID was not found",
    });
  }

  const sql = `
    INSERT INTO products (
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
      created_by,
      created_at,
      updated_at
    )
    VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()
    )
  `;

  const values = [
    category_id,
    brand_id,
    sku,
    product_code,
    title,
    slug,
    short_description || null,
    full_description || null,
    Number(base_price),
    sale_price === undefined || sale_price === null || sale_price === ""
      ? null
      : Number(sale_price),
    Number(numericFields.discount_percentage),
    Number(numericFields.tax_percentage),
    quantity,
    Number(numericFields.low_stock_threshold),
    calculatedStockStatus,
    Number(featured ?? 0),
    Number(bestseller ?? 0),
    Number(new_arrival ?? 0),
    productStatus,
    meta_title || null,
    meta_description || null,
    userId,
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      return handleDbError(err, res, "Failed to create product");
    }

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      product_id: result.insertId,
      slug,
    });
  });
};

// Update product
const updateProduct = (req, res) => {
  const { id } = req.params;
  const body = req.body || {};

  if (!isPositiveId(id)) {
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

  if (
    !isPositiveId(category_id) ||
    !String(sku || "").trim() ||
    !String(product_code || "").trim() ||
    !String(title || "").trim() ||
    !isNonNegativeNumber(base_price)
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Valid category, SKU, product code, title and base price are required",
    });
  }

  const productSlug = generateSlug(slug || title);

  if (!productSlug) {
    return res.status(400).json({
      success: false,
      message: "A valid product title or slug is required",
    });
  }

  const numericFields = {
    sale_price,
    discount_percentage: discount_percentage ?? 0,
    tax_percentage: tax_percentage ?? 0,
    stock_quantity: stock_quantity ?? 0,
    low_stock_threshold: low_stock_threshold ?? 5,
  };

  for (const [field, value] of Object.entries(numericFields)) {
    if (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      !isNonNegativeNumber(value)
    ) {
      return res.status(400).json({
        success: false,
        message: `${field} must be a non-negative number`,
      });
    }
  }

  if (
    Number(numericFields.discount_percentage) > 100 ||
    Number(numericFields.tax_percentage) > 100
  ) {
    return res.status(400).json({
      success: false,
      message: "Discount and tax percentages must be between 0 and 100",
    });
  }

  for (const field of ["featured", "bestseller", "new_arrival"]) {
    if (body[field] !== undefined && !validBoolean(body[field])) {
      return res.status(400).json({
        success: false,
        message: `${field} must be 0 or 1`,
      });
    }
  }

  const normalizedBrandId =
    brand_id === undefined || brand_id === null || brand_id === ""
      ? null
      : brand_id;

  if (normalizedBrandId !== null && !isPositiveId(normalizedBrandId)) {
    return res.status(400).json({
      success: false,
      message: "brand_id must be a valid ID or null",
    });
  }

  const productStatus = status || "inactive";
  if (!["active", "inactive", "draft"].includes(productStatus)) {
    return res.status(400).json({
      success: false,
      message: "status must be active, inactive, or draft",
    });
  }

  const quantity = Number(numericFields.stock_quantity);
  const productStockStatus =
    stock_status ||
    (quantity <= 0
      ? "out_of_stock"
      : quantity <= Number(numericFields.low_stock_threshold)
        ? "low_stock"
        : "in_stock");

  if (!["in_stock", "low_stock", "out_of_stock"].includes(productStockStatus)) {
    return res.status(400).json({
      success: false,
      message: "Invalid stock_status",
    });
  }

  const userId = req.user?.user_id ?? req.user?.id;

  if (!isPositiveId(userId)) {
    return res.status(401).json({
      success: false,
      message: "Valid authenticated user ID was not found",
    });
  }

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
    normalizedBrandId,
    String(sku).trim(),
    String(product_code).trim(),
    String(title).trim(),
    productSlug,
    short_description || null,
    full_description || null,
    Number(base_price),
    sale_price === undefined || sale_price === null || sale_price === ""
      ? null
      : Number(sale_price),
    Number(numericFields.discount_percentage),
    Number(numericFields.tax_percentage),
    quantity,
    Number(numericFields.low_stock_threshold),
    productStockStatus,
    Number(featured ?? 0),
    Number(bestseller ?? 0),
    Number(new_arrival ?? 0),
    productStatus,
    meta_title || null,
    meta_description || null,
    userId,
    id,
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      return handleDbError(err, res, "Failed to update product");
    }

    if (result.affectedRows === 0) {
      return db.query(
        "SELECT id FROM products WHERE id = ?",
        [id],
        (checkErr, rows) => {
          if (checkErr) {
            return handleDbError(checkErr, res, "Failed to verify product");
          }

          if (rows.length === 0) {
            return res.status(404).json({
              success: false,
              message: "Product not found",
            });
          }

          return res.status(200).json({
            success: true,
            message: "Product updated successfully",
          });
        },
      );
    }

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
    });
  });
};

// Delete product
const deleteProduct = (req, res) => {
  const { id } = req.params;

  if (!isPositiveId(id)) {
    return res.status(400).json({
      success: false,
      message: "A valid product ID is required",
    });
  }

  db.query("DELETE FROM products WHERE id = ?", [id], (err, result) => {
    if (err) {
      return handleDbError(err, res, "Failed to delete product");
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  });
};

// Get product images
const getProductImages = (req, res) => {
  const { product_id } = req.params;

  if (!isPositiveId(product_id)) {
    return res.status(400).json({
      success: false,
      message: "A valid product ID is required",
    });
  }

  const sql = `
    SELECT id, product_id, image, image_type, is_primary, sort_order
    FROM product_images
    WHERE product_id = ?
    ORDER BY sort_order ASC, id ASC
  `;

  db.query(sql, [product_id], (err, results) => {
    if (err) {
      return handleDbError(err, res, "Failed to fetch product images");
    }

    return res.status(200).json({
      success: true,
      images: results,
    });
  });
};

// Add product image
const addProductImage = (req, res) => {
  const { product_id } = req.params;
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

  if (!isPositiveId(product_id)) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({
      success: false,
      message: "A valid product ID is required",
    });
  }

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Please select an image file using the form-data field 'image'",
    });
  }

  if (
    !allowedImageTypes.includes(image_type) ||
    !Number.isInteger(sort_order) ||
    sort_order < 0
  ) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({
      success: false,
      message: "Invalid image_type or sort_order",
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
        return handleDbError(err, res, "Failed to add product image");
      }

      return res.status(201).json({
        success: true,
        message: "Product image added successfully",
        image: {
          id: result.insertId,
          product_id: Number(product_id),
          image: imagePath,
          image_type,
          is_primary,
          sort_order,
        },
      });
    },
  );
};

// Delete product image
const deleteProductImage = (req, res) => {
  const { image_id } = req.params;

  if (!isPositiveId(image_id)) {
    return res.status(400).json({
      success: false,
      message: "A valid image ID is required",
    });
  }

  db.query(
    "SELECT image FROM product_images WHERE id = ?",
    [image_id],
    (err, rows) => {
      if (err) {
        return handleDbError(err, res, "Failed to find product image");
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
            return handleDbError(
              deleteErr,
              res,
              "Failed to delete product image",
            );
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

// Get product variants
const getProductVariants = (req, res) => {
  const { product_id } = req.params;

  if (!isPositiveId(product_id)) {
    return res.status(400).json({
      success: false,
      message: "A valid product ID is required",
    });
  }

  const sql = `
    SELECT id, product_id, sku, variant_name, price, stock_quantity, status
    FROM product_variants
    WHERE product_id = ?
    ORDER BY id DESC
  `;

  db.query(sql, [product_id], (err, results) => {
    if (err) {
      return handleDbError(err, res, "Failed to fetch product variants");
    }

    return res.status(200).json({
      success: true,
      variants: results,
    });
  });
};

// Create product variant
const createProductVariant = (req, res) => {
  const { product_id } = req.params;
  const body = req.body || {};
  const { sku, variant_name, price, stock_quantity, status } = body;

  if (
    !isPositiveId(product_id) ||
    !String(sku || "").trim() ||
    !String(variant_name || "").trim() ||
    !isNonNegativeNumber(price)
  ) {
    return res.status(400).json({
      success: false,
      message: "Valid product ID, SKU, variant name and price are required",
    });
  }

  if (stock_quantity !== undefined && !isNonNegativeNumber(stock_quantity)) {
    return res.status(400).json({
      success: false,
      message: "stock_quantity must be a non-negative number",
    });
  }

  const variantStatus = status || "active";
  if (!["active", "inactive"].includes(variantStatus)) {
    return res.status(400).json({
      success: false,
      message: "Variant status must be active or inactive",
    });
  }

  const sql = `
    INSERT INTO product_variants
      (product_id, sku, variant_name, price, stock_quantity, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      product_id,
      String(sku).trim(),
      String(variant_name).trim(),
      Number(price),
      Number(stock_quantity ?? 0),
      variantStatus,
    ],
    (err, result) => {
      if (err) {
        return handleDbError(err, res, "Failed to create product variant");
      }

      return res.status(201).json({
        success: true,
        message: "Product variant created successfully",
        variant_id: result.insertId,
      });
    },
  );
};

// Update product variant
const updateProductVariant = (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  const { sku, variant_name, price, stock_quantity, status } = body;

  if (
    !isPositiveId(id) ||
    !String(sku || "").trim() ||
    !String(variant_name || "").trim() ||
    !isNonNegativeNumber(price)
  ) {
    return res.status(400).json({
      success: false,
      message: "Valid variant ID, SKU, variant name and price are required",
    });
  }

  if (stock_quantity !== undefined && !isNonNegativeNumber(stock_quantity)) {
    return res.status(400).json({
      success: false,
      message: "stock_quantity must be a non-negative number",
    });
  }

  const variantStatus = status || "active";
  if (!["active", "inactive"].includes(variantStatus)) {
    return res.status(400).json({
      success: false,
      message: "Variant status must be active or inactive",
    });
  }

  const sql = `
    UPDATE product_variants
    SET sku = ?, variant_name = ?, price = ?, stock_quantity = ?, status = ?
    WHERE id = ?
  `;

  db.query(
    sql,
    [
      String(sku).trim(),
      String(variant_name).trim(),
      Number(price),
      Number(stock_quantity ?? 0),
      variantStatus,
      id,
    ],
    (err, result) => {
      if (err) {
        return handleDbError(err, res, "Failed to update product variant");
      }

      if (result.affectedRows === 0) {
        return db.query(
          "SELECT id FROM product_variants WHERE id = ?",
          [id],
          (checkErr, rows) => {
            if (checkErr) {
              return handleDbError(checkErr, res, "Failed to verify variant");
            }

            if (rows.length === 0) {
              return res.status(404).json({
                success: false,
                message: "Product variant not found",
              });
            }

            return res.status(200).json({
              success: true,
              message: "Product variant updated successfully",
            });
          },
        );
      }

      return res.status(200).json({
        success: true,
        message: "Product variant updated successfully",
      });
    },
  );
};

// Delete product variant
const deleteProductVariant = (req, res) => {
  const { id } = req.params;

  if (!isPositiveId(id)) {
    return res.status(400).json({
      success: false,
      message: "A valid variant ID is required",
    });
  }

  db.query("DELETE FROM product_variants WHERE id = ?", [id], (err, result) => {
    if (err) {
      return handleDbError(err, res, "Failed to delete product variant");
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

// Get all return requests (Admin)
const getReturnRequests = (req, res) => {
  const sql = `
    SELECT
      r.id AS return_id,
      r.order_id,
      r.order_item_id,
      r.user_id,
      r.quantity,
      r.reason,
      r.status,
      r.admin_note,
      r.created_at,
      r.updated_at
    FROM order_returns r
    ORDER BY r.created_at DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      return handleDbError(err, res, "Failed to fetch return requests");
    }

    return res.status(200).json({
      success: true,
      count: results.length,
      returns: results,
    });
  });
};

const updateReturnStatus = (req, res) => {
  const { return_id } = req.params;
  const { status, admin_note } = req.body;

  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Status must be approved or rejected",
    });
  }

  const sql = `
    UPDATE order_returns
    SET status = ?, admin_note = ?
    WHERE id = ? AND status = 'pending'
  `;

  db.query(sql, [status, admin_note || null, return_id], (err, result) => {
    if (err) {
      return handleDbError(err, res, "Failed to update return status");
    }

    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: "Return request not found or already processed",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Return request ${status} successfully`,
      data: {
        return_id: Number(return_id),
        status,
        admin_note: admin_note || null,
      },
    });
  });
};

module.exports = {
  getProducts,
  getProductDetails,
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
  getReturnRequests,
  updateReturnStatus,
};
