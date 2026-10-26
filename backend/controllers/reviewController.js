
const db = require("../config/db");

// ==========================================
// 1. CUSTOMER: CREATE PRODUCT REVIEW
// POST /api/reviews
// ==========================================
const createReview = async (req, res) => {
  let connection;
  let transactionStarted = false;

  try {
    const userId = req.user?.user_id ?? req.user?.id;
    const { product_id, order_id, rating, review } = req.body ?? {};

    const productId = Number(product_id);
    const orderId = Number(order_id);
    const reviewRating = Number(rating);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login to submit a review",
      });
    }

    if (
      !Number.isInteger(productId) ||
      productId <= 0 ||
      !Number.isInteger(orderId) ||
      orderId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid product_id and order_id are required",
      });
    }

    if (
      !Number.isInteger(reviewRating) ||
      reviewRating < 1 ||
      reviewRating > 5
    ) {
      return res.status(400).json({
        success: false,
        message: "Rating must be an integer between 1 and 5",
      });
    }

    if (
      review !== undefined &&
      review !== null &&
      typeof review !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Review must be text",
      });
    }

    const reviewText =
      typeof review === "string" ? review.trim() : null;

    if (reviewText && reviewText.length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Review cannot exceed 5000 characters",
      });
    }

    connection = await db.promise().getConnection();

    await connection.beginTransaction();
    transactionStarted = true;

    // Ensure the order belongs to this customer.
    const [orders] = await connection.execute(
      `SELECT id, order_status
       FROM orders
       WHERE id = ? AND user_id = ?
       LIMIT 1
       FOR UPDATE`,
      [orderId, userId]
    );

    if (orders.length === 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(404).json({
        success: false,
        message: "Order not found for this customer",
      });
    }

    // Reviews are allowed only after delivery.
    if (
      String(orders[0].order_status).toLowerCase() !== "delivered"
    ) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: "You can review products only after delivery",
      });
    }

    // Ensure the product was included in this order.
    const [orderItems] = await connection.execute(
      `SELECT id
       FROM order_items
       WHERE order_id = ? AND product_id = ?
       LIMIT 1`,
      [orderId, productId]
    );

    if (orderItems.length === 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: "This product does not belong to the selected order",
      });
    }

    // Prevent a duplicate review for the same product/order.
    const [existingReviews] = await connection.execute(
      `SELECT id
       FROM reviews
       WHERE user_id = ?
         AND product_id = ?
         AND order_id = ?
       LIMIT 1`,
      [userId, productId, orderId]
    );

    if (existingReviews.length > 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(409).json({
        success: false,
        message: "You have already reviewed this product for this order",
      });
    }

    // Reviews require admin approval before public display.
    const [result] = await connection.execute(
      `INSERT INTO reviews
       (
         user_id,
         product_id,
         order_id,
         rating,
         review,
         verified_purchase,
         status
       )
       VALUES (?, ?, ?, ?, ?, 1, 'pending')`,
      [userId, productId, orderId, reviewRating, reviewText || null]
    );

    await connection.commit();
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      message: "Review submitted successfully and is pending approval",
      data: {
        id: result.insertId,
        product_id: productId,
        order_id: orderId,
        rating: reviewRating,
        review: reviewText || null,
        verified_purchase: true,
        status: "pending",
      },
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Review rollback failed:", rollbackError.message);
      }
    }

    console.error("Create review error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to submit review",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// ==========================================
// 2. PUBLIC: GET APPROVED PRODUCT REVIEWS
// GET /api/reviews/product/:productId
// ==========================================
const getProductReviews = async (req, res) => {
  try {
    const productId = Number(req.params.productId);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const pageValue = Number(req.query.page ?? 1);
    const limitValue = Number(req.query.limit ?? 10);

    if (
      !Number.isInteger(pageValue) ||
      pageValue < 1 ||
      !Number.isInteger(limitValue) ||
      limitValue < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "page and limit must be positive integers",
      });
    }

    const page = pageValue;
    const limit = Math.min(limitValue, 50);
    const offset = (page - 1) * limit;

    // IMPORTANT: pool queries must use the Promise wrapper.
    const [products] = await db.promise().execute(
      `SELECT id, title
       FROM products
       WHERE id = ?
       LIMIT 1`,
      [productId]
    );

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const [summaryRows] = await db.promise().execute(
      `SELECT
         COUNT(*) AS total_reviews,
         ROUND(AVG(rating), 2) AS average_rating
       FROM reviews
       WHERE product_id = ?
         AND status = 'approved'`,
      [productId]
    );

    const [countRows] = await db.promise().execute(
      `SELECT COUNT(*) AS total
       FROM reviews
       WHERE product_id = ?
         AND status = 'approved'`,
      [productId]
    );

    const total = Number(countRows[0].total);

    const [reviews] = await db.promise().execute(
      `SELECT
         r.id,
         r.product_id,
         r.rating,
         r.review,
         r.verified_purchase,
         r.created_at,
         u.name AS reviewer_name
       FROM reviews r
       JOIN users u ON u.id = r.user_id
       WHERE r.product_id = ?
         AND r.status = 'approved'
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT ? OFFSET ?`,
      [productId, limit, offset]
    );

    return res.status(200).json({
      success: true,
      data: {
        product_id: productId,
        product_title: products[0].title,
        average_rating: summaryRows[0].average_rating,
        total_reviews: total,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
        reviews,
      },
    });
  } catch (error) {
    console.error("Get product reviews error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch product reviews",
    });
  }
};

// ==========================================
// 3. CUSTOMER: GET OWN REVIEWS
// GET /api/reviews/my
// ==========================================
const getMyReviews = async (req, res) => {
  try {
    const userId = req.user?.user_id ?? req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login first",
      });
    }

    const pageValue = Number(req.query.page ?? 1);
    const limitValue = Number(req.query.limit ?? 10);

    if (
      !Number.isInteger(pageValue) ||
      pageValue < 1 ||
      !Number.isInteger(limitValue) ||
      limitValue < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "page and limit must be positive integers",
      });
    }

    const page = pageValue;
    const limit = Math.min(limitValue, 50);
    const offset = (page - 1) * limit;

    const [countRows] = await db.promise().execute(
      `SELECT COUNT(*) AS total
       FROM reviews
       WHERE user_id = ?`,
      [userId]
    );

    const total = Number(countRows[0].total);

    const [reviews] = await db.promise().execute(
      `SELECT
         r.id,
         r.product_id,
         p.title AS product_title,
         r.order_id,
         o.order_number,
         r.rating,
         r.review,
         r.verified_purchase,
         r.status,
         r.created_at,
         r.updated_at
       FROM reviews r
       JOIN products p ON p.id = r.product_id
       JOIN orders o ON o.id = r.order_id
       WHERE r.user_id = ?
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    return res.status(200).json({
      success: true,
      data: {
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
        reviews,
      },
    });
  } catch (error) {
    console.error("Get my reviews error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch your reviews",
    });
  }
};

// ==========================================
// 4. ADMIN: LIST REVIEWS FOR MODERATION
// GET /api/reviews/admin?status=pending
// ==========================================
const getReviewsForAdmin = async (req, res) => {
  try {
    const allowedStatuses = [
      "pending",
      "approved",
      "rejected",
      "all",
    ];

    const status = String(
      req.query.status || "pending"
    ).toLowerCase();

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be pending, approved, rejected or all",
      });
    }

    const pageValue = Number(req.query.page ?? 1);
    const limitValue = Number(req.query.limit ?? 20);

    if (
      !Number.isInteger(pageValue) ||
      pageValue < 1 ||
      !Number.isInteger(limitValue) ||
      limitValue < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "page and limit must be positive integers",
      });
    }

    const page = pageValue;
    const limit = Math.min(limitValue, 50);
    const offset = (page - 1) * limit;

    let whereClause = "";
    const params = [];

    if (status !== "all") {
      whereClause = "WHERE r.status = ?";
      params.push(status);
    }

    const [countRows] = await db.promise().execute(
      `SELECT COUNT(*) AS total
       FROM reviews r
       ${whereClause}`,
      params
    );

    const total = Number(countRows[0].total);

    const [reviews] = await db.promise().execute(
      `SELECT
         r.id,
         r.user_id,
         u.name AS reviewer_name,
         r.product_id,
         p.title AS product_title,
         r.order_id,
         o.order_number,
         r.rating,
         r.review,
         r.verified_purchase,
         r.status,
         r.created_at
       FROM reviews r
       JOIN users u ON u.id = r.user_id
       JOIN products p ON p.id = r.product_id
       JOIN orders o ON o.id = r.order_id
       ${whereClause}
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.status(200).json({
      success: true,
      data: {
        status,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
        reviews,
      },
    });
  } catch (error) {
    console.error("Admin get reviews error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch reviews for moderation",
    });
  }
};

// ==========================================
// 5. ADMIN: APPROVE OR REJECT A REVIEW
// PATCH /api/reviews/admin/:reviewId/status
// ==========================================
const moderateReview = async (req, res) => {
  try {
    const reviewId = Number(req.params.reviewId);
    const status = String(req.body?.status || "").toLowerCase();

    if (!Number.isInteger(reviewId) || reviewId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid review ID",
      });
    }

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be approved or rejected",
      });
    }

    const [existingReviews] = await db.promise().execute(
      `SELECT id, status
       FROM reviews
       WHERE id = ?
       LIMIT 1`,
      [reviewId]
    );

    if (existingReviews.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    const [updateResult] = await db.promise().execute(
      `UPDATE reviews
       SET status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, reviewId]
    );

    if (updateResult.affectedRows !== 1) {
      return res.status(500).json({
        success: false,
        message: "Review status was not updated",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Review ${status} successfully`,
      data: {
        id: reviewId,
        previous_status: existingReviews[0].status,
        status,
      },
    });
  } catch (error) {
    console.error("Moderate review error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to moderate review",
    });
  }
};

module.exports = {
  createReview,
  getProductReviews,
  getMyReviews,
  getReviewsForAdmin,
  moderateReview,
};
