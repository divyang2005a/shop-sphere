const db = require("../config/db");

const isPositiveInteger = (value) => /^[1-9]\d*$/.test(String(value ?? ""));

const getRecommendedProducts = (req, res) => {
  const { product_id, limit = "8" } = req.query;

  if (product_id !== undefined && !isPositiveInteger(product_id)) {
    return res.status(400).json({
      success: false,
      message: "product_id must be a positive integer",
    });
  }

  if (!isPositiveInteger(limit) || Number(limit) > 20) {
    return res.status(400).json({
      success: false,
      message: "limit must be between 1 and 20",
    });
  }

  const queryProducts = (categoryId = null) => {
    const excludeSource = product_id !== undefined;
    const categoryOrder = categoryId !== null
      ? "(p.category_id = ?) DESC, "
      : "";
    const values = [];

    const exclusion = excludeSource ? "AND p.id <> ? " : "";
    if (excludeSource) values.push(Number(product_id));
    if (categoryId !== null) values.push(categoryId);
    values.push(Number(limit));

    const sql = `
      SELECT
        p.id,
        p.category_id,
        p.brand_id,
        p.title,
        p.slug,
        p.short_description,
        p.base_price,
        COALESCE(
          (SELECT fs.sale_price FROM flash_sales AS fs
           WHERE fs.product_id = p.id AND fs.status = 'active'
             AND fs.start_time <= NOW() AND fs.end_time > NOW()
             AND fs.sold_quantity < fs.stock_limit
           ORDER BY fs.sale_price ASC, fs.id DESC LIMIT 1),
          p.sale_price
        ) AS sale_price,
        EXISTS(
          SELECT 1 FROM flash_sales AS fs
          WHERE fs.product_id = p.id AND fs.status = 'active'
            AND fs.start_time <= NOW() AND fs.end_time > NOW()
            AND fs.sold_quantity < fs.stock_limit
        ) AS flash_sale_active,
        p.discount_percentage,
        p.stock_status,
        p.featured,
        p.bestseller,
        p.new_arrival,
        (
          SELECT pi.image
          FROM product_images AS pi
          WHERE pi.product_id = p.id
          ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.id ASC
          LIMIT 1
        ) AS image
      FROM products AS p
      WHERE LOWER(p.status) = 'active'
      ${exclusion}
      ORDER BY
        ${categoryOrder}
        p.bestseller DESC,
        p.featured DESC,
        p.new_arrival DESC,
        p.created_at DESC
      LIMIT ?
    `;

    db.query(sql, values, (err, products) => {
      if (err) {
        console.error("Failed to fetch recommended products:", err);
        return res.status(500).json({
          success: false,
          message: "Failed to fetch recommended products",
        });
      }

      return res.status(200).json({
        success: true,
        count: products.length,
        products,
      });
    });
  };

  if (product_id === undefined) {
    return queryProducts();
  }

  db.query(
    "SELECT category_id FROM products WHERE id = ? LIMIT 1",
    [Number(product_id)],
    (err, products) => {
      if (err) {
        console.error("Failed to find recommendation source product:", err);
        return res.status(500).json({
          success: false,
          message: "Failed to fetch recommended products",
        });
      }

      if (!products.length) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      return queryProducts(products[0].category_id);
    },
  );
};

module.exports = { getRecommendedProducts };
