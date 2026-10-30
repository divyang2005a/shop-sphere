const db = require("../config/db");

// Validate optional date filters.
const getDateFilters = (query, column = "created_at") => {
  const { start_date, end_date } = query;

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (
    (start_date && !dateRegex.test(start_date)) ||
    (end_date && !dateRegex.test(end_date))
  ) {
    return {
      error: "Dates must use YYYY-MM-DD format",
    };
  }

  if (start_date && end_date && start_date > end_date) {
    return {
      error: "start_date cannot be later than end_date",
    };
  }

  const conditions = [];
  const params = [];

  if (start_date) {
    conditions.push(`DATE(${column}) >= ?`);
    params.push(start_date);
  }

  if (end_date) {
    conditions.push(`DATE(${column}) <= ?`);
    params.push(end_date);
  }

  return {
    where: conditions.length ? `AND ${conditions.join(" AND ")}` : "",
    params,
  };
};

// --------------------------------------------------
// 1. ADMIN DASHBOARD SUMMARY
// --------------------------------------------------

const getDashboard = async (req, res) => {
  try {
    const [
      [userStats],
      [productStats],
      [orderStats],
      [paymentStats],
      [lowStockProducts],
      [recentOrders],
    ] = await Promise.all([
      // User statistics
      db.promise().query(`
        SELECT
          COUNT(*) AS total_users,
          SUM(
            CASE
              WHEN status = 'active' THEN 1
              ELSE 0
            END
          ) AS active_users
        FROM users
      `),

      // Product statistics
      db.promise().query(`
        SELECT
          COUNT(*) AS total_products,
          SUM(
            CASE
              WHEN status = 'active' THEN 1
              ELSE 0
            END
          ) AS active_products,
          SUM(
            CASE
              WHEN COALESCE(stock_quantity, 0)
                   <= COALESCE(low_stock_threshold, 0)
              THEN 1
              ELSE 0
            END
          ) AS low_stock_products
        FROM products
      `),

      // Order statistics
      db.promise().query(`
        SELECT
          COUNT(*) AS total_orders,

          SUM(
            CASE
              WHEN order_status = 'pending' THEN 1
              ELSE 0
            END
          ) AS pending_orders,

          SUM(
            CASE
              WHEN order_status = 'processing' THEN 1
              ELSE 0
            END
          ) AS processing_orders,

          SUM(
            CASE
              WHEN order_status = 'shipped' THEN 1
              ELSE 0
            END
          ) AS shipped_orders,

          SUM(
            CASE
              WHEN order_status = 'delivered' THEN 1
              ELSE 0
            END
          ) AS delivered_orders,

          SUM(
            CASE
              WHEN order_status = 'cancelled' THEN 1
              ELSE 0
            END
          ) AS cancelled_orders,

          COALESCE(
            SUM(
              CASE
                WHEN order_status <> 'cancelled'
                THEN total_amount
                ELSE 0
              END
            ),
            0
          ) AS non_cancelled_order_value

        FROM orders
      `),

      // Payment statistics
      db.promise().query(`
        SELECT
          COUNT(*) AS paid_orders,
          COALESCE(SUM(total_amount), 0) AS paid_revenue
        FROM orders
        WHERE payment_status = 'paid'
          AND order_status <> 'cancelled'
      `),

      // Low stock products
      db.promise().query(`
        SELECT
          id,
          title,
          sku,
          stock_quantity,
          low_stock_threshold,
          stock_status
        FROM products
        WHERE COALESCE(stock_quantity, 0)
              <= COALESCE(low_stock_threshold, 0)
        ORDER BY stock_quantity ASC
        LIMIT 10
      `),

      // Recent orders WITH CUSTOMER NAME
      db.promise().query(`
        SELECT
          o.id,
          o.order_number,
          o.order_status,
          o.payment_status,
          o.total_amount,
          o.created_at,
          u.name AS customer_name
        FROM orders o
        LEFT JOIN users u
          ON u.id = o.user_id
        ORDER BY o.created_at DESC
        LIMIT 10
      `),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        users: userStats[0],
        products: productStats[0],
        orders: orderStats[0],
        payments: paymentStats[0],
        low_stock_products: lowStockProducts,
        recent_orders: recentOrders,
      },
    });
  } catch (error) {
    console.error("Dashboard report error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard",
    });
  }
};

// --------------------------------------------------
// 2. SALES REPORT
// --------------------------------------------------

const getSalesReport = async (req, res) => {
  try {
    const filters = getDateFilters(req.query, "created_at");

    if (filters.error) {
      return res.status(400).json({
        success: false,
        message: filters.error,
      });
    }

    const where = filters.where;
    const params = filters.params;

    const [summary] = await db.promise().query(
      `
      SELECT
        COUNT(*) AS total_orders,

        COALESCE(
          SUM(total_amount),
          0
        ) AS total_order_value,

        SUM(
          CASE
            WHEN payment_status = 'paid' THEN 1
            ELSE 0
          END
        ) AS paid_orders,

        COALESCE(
          SUM(
            CASE
              WHEN payment_status = 'paid'
              THEN total_amount
              ELSE 0
            END
          ),
          0
        ) AS paid_revenue,

        COALESCE(
          SUM(
            CASE
              WHEN payment_status = 'pending'
              THEN total_amount
              ELSE 0
            END
          ),
          0
        ) AS pending_payment_value

      FROM orders
      WHERE order_status <> 'cancelled'
      ${where}
      `,
      params
    );

    const [dailySales] = await db.promise().query(
      `
      SELECT
        DATE(created_at) AS sale_date,
        COUNT(*) AS total_orders,

        COALESCE(
          SUM(total_amount),
          0
        ) AS total_order_value,

        COALESCE(
          SUM(
            CASE
              WHEN payment_status = 'paid'
              THEN total_amount
              ELSE 0
            END
          ),
          0
        ) AS paid_revenue

      FROM orders
      WHERE order_status <> 'cancelled'
      ${where}
      GROUP BY DATE(created_at)
      ORDER BY sale_date DESC
      `,
      params
    );

    return res.status(200).json({
      success: true,

      filters: {
        start_date: req.query.start_date || null,
        end_date: req.query.end_date || null,
      },

      data: {
        summary: summary[0],
        daily_sales: dailySales,
      },
    });
  } catch (error) {
    console.error("Sales report error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate sales report",
    });
  }
};

// --------------------------------------------------
// 3. ORDER STATUS REPORT
// --------------------------------------------------

const getOrdersReport = async (req, res) => {
  try {
    const filters = getDateFilters(req.query, "created_at");

    if (filters.error) {
      return res.status(400).json({
        success: false,
        message: filters.error,
      });
    }

    const [statusReport] = await db.promise().query(
      `
      SELECT
        order_status,
        COUNT(*) AS total_orders,
        COALESCE(SUM(total_amount), 0) AS total_order_value
      FROM orders
      WHERE 1 = 1
      ${filters.where}
      GROUP BY order_status
      ORDER BY total_orders DESC
      `,
      filters.params
    );

    const [paymentReport] = await db.promise().query(
      `
      SELECT
        payment_status,
        COUNT(*) AS total_orders,
        COALESCE(SUM(total_amount), 0) AS total_order_value
      FROM orders
      WHERE 1 = 1
      ${filters.where}
      GROUP BY payment_status
      ORDER BY total_orders DESC
      `,
      filters.params
    );

    return res.status(200).json({
      success: true,

      data: {
        by_order_status: statusReport,
        by_payment_status: paymentReport,
      },
    });
  } catch (error) {
    console.error("Orders report error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate orders report",
    });
  }
};

// --------------------------------------------------
// 4. PRODUCT AND INVENTORY STOCK REPORT
// --------------------------------------------------

const getProductsReport = async (req, res) => {
  try {
    const [summary] = await db.promise().query(`
      SELECT
        COUNT(*) AS total_products,

        COALESCE(
          SUM(stock_quantity),
          0
        ) AS total_stock_units,

        SUM(
          CASE
            WHEN COALESCE(stock_quantity, 0) = 0
            THEN 1
            ELSE 0
          END
        ) AS out_of_stock_products,

        SUM(
          CASE
            WHEN COALESCE(stock_quantity, 0)
                 <= COALESCE(low_stock_threshold, 0)
            THEN 1
            ELSE 0
          END
        ) AS low_stock_products

      FROM products
    `);

    const [products] = await db.promise().query(`
      SELECT
        p.id,
        p.title,
        p.sku,
        p.category_id,
        p.brand_id,
        p.base_price,
        p.sale_price,
        p.stock_quantity,
        p.low_stock_threshold,
        p.stock_status,
        p.status,
        COALESCE(sold.total_sold, 0) AS total_sold

      FROM products p

      LEFT JOIN (
        SELECT
          oi.product_id,
          SUM(oi.quantity) AS total_sold
        FROM order_items oi
        INNER JOIN orders o
          ON o.id = oi.order_id
        WHERE o.order_status <> 'cancelled'
        GROUP BY oi.product_id
      ) sold
        ON sold.product_id = p.id

      ORDER BY p.stock_quantity ASC, p.title ASC
      LIMIT 100
    `);

    return res.status(200).json({
      success: true,

      data: {
        summary: summary[0],
        products,
        limit: 100,
      },
    });
  } catch (error) {
    console.error("Products report error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate products report",
    });
  }
};

// --------------------------------------------------
// 5. INVENTORY MOVEMENT REPORT
// --------------------------------------------------

const getInventoryReport = async (req, res) => {
  try {
    const filters = getDateFilters(req.query, "im.created_at");

    if (filters.error) {
      return res.status(400).json({
        success: false,
        message: filters.error,
      });
    }

    const conditions = [];
    const params = [...filters.params];

    if (req.query.type) {
      conditions.push("im.type = ?");
      params.push(req.query.type);
    }

    if (req.query.product_id !== undefined) {
      const productId = String(req.query.product_id);

      if (
        !/^\d+$/.test(productId) ||
        Number(productId) <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "product_id must be a positive integer",
        });
      }

      conditions.push("im.product_id = ?");
      params.push(productId);
    }

    const extraWhere = conditions.length
      ? `AND ${conditions.join(" AND ")}`
      : "";

    const [summary] = await db.promise().query(
      `
      SELECT
        COUNT(*) AS total_movements,

        COALESCE(
          SUM(
            CASE
              WHEN im.quantity > 0
              THEN im.quantity
              ELSE 0
            END
          ),
          0
        ) AS positive_quantity_total,

        COALESCE(
          SUM(
            CASE
              WHEN im.quantity < 0
              THEN ABS(im.quantity)
              ELSE 0
            END
          ),
          0
        ) AS negative_quantity_total

      FROM inventory_movements im
      WHERE 1 = 1
      ${filters.where}
      ${extraWhere}
      `,
      params
    );

    const [movements] = await db.promise().query(
      `
      SELECT
        im.id,
        im.product_id,
        p.title AS product_title,
        p.sku,
        im.variant_id,
        im.type,
        im.quantity,
        im.reference_type,
        im.reference_id,
        im.note,
        im.created_by,
        im.created_at

      FROM inventory_movements im

      LEFT JOIN products p
        ON p.id = im.product_id

      WHERE 1 = 1
      ${filters.where}
      ${extraWhere}

      ORDER BY im.created_at DESC
      LIMIT 100
      `,
      params
    );

    return res.status(200).json({
      success: true,

      filters: {
        start_date: req.query.start_date || null,
        end_date: req.query.end_date || null,
        type: req.query.type || null,
        product_id: req.query.product_id || null,
      },

      data: {
        summary: summary[0],
        movements,
        limit: 100,
      },
    });
  } catch (error) {
    console.error("Inventory report error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate inventory report",
    });
  }
};

// --------------------------------------------------
// EXPORT CONTROLLERS
// --------------------------------------------------

module.exports = {
  getDashboard,
  getSalesReport,
  getOrdersReport,
  getProductsReport,
  getInventoryReport,
};