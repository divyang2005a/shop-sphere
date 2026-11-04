const db = require("../config/db");

const isPositiveInteger = (value) => /^[1-9]\d*$/.test(String(value ?? ""));
const isDateTime = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value) &&
  !Number.isNaN(new Date(value).getTime());

const productImageSql = `(
  SELECT pi.image
  FROM product_images AS pi
  WHERE pi.product_id = p.id
  ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.id ASC
  LIMIT 1
)`;

const getActiveFlashSales = async (_req, res) => {
  try {
    const [flashSales] = await db.promise().execute(
      `SELECT
         fs.id,
         fs.name,
         fs.product_id,
         p.title AS product_title,
         p.slug,
         p.short_description,
         COALESCE(p.sale_price, p.base_price) AS original_price,
         fs.sale_price,
         ROUND(
           (1 - fs.sale_price / COALESCE(p.sale_price, p.base_price)) * 100
         ) AS discount_percentage,
         fs.stock_limit,
         fs.sold_quantity,
         fs.start_time,
         fs.end_time,
         ${productImageSql} AS image
       FROM flash_sales AS fs
       INNER JOIN products AS p ON p.id = fs.product_id
       WHERE fs.status = 'active'
         AND p.status = 'active'
         AND fs.start_time <= NOW()
         AND fs.end_time > NOW()
         AND fs.sold_quantity < fs.stock_limit
       ORDER BY fs.end_time ASC, fs.id DESC
       LIMIT 12`,
    );

    return res.status(200).json({
      success: true,
      count: flashSales.length,
      flash_sales: flashSales,
    });
  } catch (error) {
    console.error("Get active flash sales error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch active flash sales",
    });
  }
};

const getAdminFlashSales = async (_req, res) => {
  try {
    const [flashSales] = await db.promise().execute(
      `SELECT
         fs.id,
         fs.name,
         fs.product_id,
         p.title AS product_title,
         COALESCE(p.sale_price, p.base_price) AS original_price,
         fs.sale_price,
         ROUND(
           (1 - fs.sale_price / COALESCE(p.sale_price, p.base_price)) * 100
         ) AS discount_percentage,
         fs.stock_limit,
         fs.sold_quantity,
         fs.start_time,
         fs.end_time,
         fs.status
       FROM flash_sales AS fs
       INNER JOIN products AS p ON p.id = fs.product_id
       ORDER BY fs.start_time DESC, fs.id DESC`,
    );

    return res.status(200).json({
      success: true,
      count: flashSales.length,
      flash_sales: flashSales,
    });
  } catch (error) {
    console.error("Get admin flash sales error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch flash sales",
    });
  }
};

const createFlashSale = async (req, res) => {
  const {
    name,
    product_id: productId,
    sale_price: salePriceInput,
    stock_limit: stockLimitInput,
    start_time: startTime,
    end_time: endTime,
  } = req.body || {};
  const salePrice = Number(salePriceInput);
  const stockLimit = Number(stockLimitInput);

  if (typeof name !== "string" || !name.trim() || name.trim().length > 150) {
    return res.status(400).json({
      success: false,
      message: "Sale name is required and must be at most 150 characters",
    });
  }

  if (!isPositiveInteger(productId)) {
    return res.status(400).json({
      success: false,
      message: "A valid product_id is required",
    });
  }

  if (!Number.isFinite(salePrice) || salePrice <= 0) {
    return res.status(400).json({
      success: false,
      message: "sale_price must be greater than zero",
    });
  }

  if (!isPositiveInteger(stockLimit)) {
    return res.status(400).json({
      success: false,
      message: "stock_limit must be a positive integer",
    });
  }

  if (!isDateTime(startTime) || !isDateTime(endTime)) {
    return res.status(400).json({
      success: false,
      message: "Valid start_time and end_time are required",
    });
  }

  if (new Date(endTime) <= new Date(startTime)) {
    return res.status(400).json({
      success: false,
      message: "end_time must be after start_time",
    });
  }

  try {
    const [products] = await db.promise().execute(
      `SELECT COALESCE(sale_price, base_price) AS regular_price
       FROM products
       WHERE id = ? AND LOWER(status) = 'active'
       LIMIT 1`,
      [Number(productId)],
    );

    if (!products.length) {
      return res.status(404).json({
        success: false,
        message: "Active product not found",
      });
    }

    if (salePrice >= Number(products[0].regular_price)) {
      return res.status(400).json({
        success: false,
        message: "sale_price must be lower than the product's current price",
      });
    }

    const [overlappingSales] = await db.promise().execute(
      `SELECT id
       FROM flash_sales
       WHERE product_id = ?
         AND status = 'active'
         AND start_time < ?
         AND end_time > ?
       LIMIT 1`,
      [Number(productId), new Date(endTime), new Date(startTime)],
    );

    if (overlappingSales.length) {
      return res.status(409).json({
        success: false,
        message: "This product already has a flash sale scheduled for that time",
      });
    }

    const [result] = await db.promise().execute(
      `INSERT INTO flash_sales
         (name, product_id, sale_price, stock_limit, start_time, end_time)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        Number(productId),
        salePrice,
        stockLimit,
        new Date(startTime),
        new Date(endTime),
      ],
    );

    return res.status(201).json({
      success: true,
      message: "Flash sale created",
      flash_sale_id: result.insertId,
    });
  } catch (error) {
    console.error("Create flash sale error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create flash sale",
    });
  }
};

const deleteFlashSale = async (req, res) => {
  const { id } = req.params;

  if (!isPositiveInteger(id)) {
    return res.status(400).json({
      success: false,
      message: "A valid flash sale ID is required",
    });
  }

  try {
    const [result] = await db.promise().execute(
      "DELETE FROM flash_sales WHERE id = ?",
      [Number(id)],
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Flash sale not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Flash sale deleted",
    });
  } catch (error) {
    console.error("Delete flash sale error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete flash sale",
    });
  }
};

module.exports = {
  getActiveFlashSales,
  getAdminFlashSales,
  createFlashSale,
  deleteFlashSale,
};
