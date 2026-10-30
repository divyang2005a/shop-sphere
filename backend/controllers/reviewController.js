const db = require("../config/db");

// ==========================================
// 1. CUSTOMER: CREATE SITE REVIEW
// ==========================================
const createSiteReview = async (req, res) => {
  const userId = req.user?.user_id ?? req.user?.id;
  const { rating, review } = req.body ?? {};
  const reviewRating = Number(rating);

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Please login to submit a site review",
    });
  }

  if (!Number.isInteger(reviewRating) || reviewRating < 1 || reviewRating > 5) {
    return res.status(400).json({
      success: false,
      message: "Rating must be an integer between 1 and 5",
    });
  }

  if (review !== undefined && review !== null && typeof review !== "string") {
    return res.status(400).json({
      success: false,
      message: "Review must be text",
    });
  }

  const reviewText = typeof review === "string" ? review.trim() : null;

  if (reviewText && reviewText.length > 5000) {
    return res.status(400).json({
      success: false,
      message: "Review cannot exceed 5000 characters",
    });
  }

  try {
    const [result] = await db.promise().execute(
      `INSERT INTO site_reviews (user_id, rating, review)
       VALUES (?, ?, ?)`,
      [userId, reviewRating, reviewText || null]
    );

    return res.status(201).json({
      success: true,
      message: "Site review submitted successfully",
      data: {
        id: result.insertId,
        user_id: userId,
        rating: reviewRating,
        review: reviewText || null,
      },
    });
  } catch (error) {
    console.error("Create site review error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to submit site review",
    });
  }
};

// ==========================================
// 2. PUBLIC: GET SITE REVIEWS
// ==========================================
const getSiteReviews = async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const limitValue = Number(req.query.limit ?? 20);

  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(limitValue) ||
    limitValue < 1
  ) {
    return res.status(400).json({
      success: false,
      message: "page and limit must be positive integers",
    });
  }

  const limit = Math.min(limitValue, 50);
  const offset = (page - 1) * limit;

  try {
    const [countRows] = await db.promise().execute(
      "SELECT COUNT(*) AS total FROM site_reviews"
    );

    const total = Number(countRows[0].total);

    const [reviews] = await db.promise().execute(
      `SELECT
         sr.id,
         sr.user_id,
         u.name AS reviewer_name,
         sr.rating,
         sr.review,
         sr.created_at
       FROM site_reviews sr
       JOIN users u ON u.id = sr.user_id
       ORDER BY sr.created_at DESC, sr.id DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
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
    console.error("Get site reviews error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch site reviews",
    });
  }
};

// ==========================================
// 3. DELETE SITE REVIEW
// ==========================================
const deleteSiteReviewRecord = async (req, res, ownerId = null) => {
  const reviewId = String(req.params.reviewId ?? "");

  if (
    !/^[1-9]\d*$/.test(reviewId) ||
    !Number.isSafeInteger(Number(reviewId))
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid site review ID",
    });
  }

  const sql =
    ownerId === null
      ? "DELETE FROM site_reviews WHERE id = ?"
      : "DELETE FROM site_reviews WHERE id = ? AND user_id = ?";

  const params =
    ownerId === null ? [reviewId] : [reviewId, ownerId];

  try {
    const [result] = await db.promise().execute(sql, params);

    if (result.affectedRows !== 1) {
      return res.status(404).json({
        success: false,
        message: "Site review not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Site review deleted successfully",
      data: {
        id: Number(reviewId),
      },
    });
  } catch (error) {
    console.error("Delete site review error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete site review",
    });
  }
};

// ==========================================
// CUSTOMER: DELETE OWN SITE REVIEW
// ==========================================
const deleteOwnSiteReview = (req, res) => {
  const userId = req.user?.user_id ?? req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Please login to delete a site review",
    });
  }

  return deleteSiteReviewRecord(req, res, userId);
};

// ==========================================
// ADMIN: DELETE SITE REVIEW
// ==========================================
const deleteSiteReviewForAdmin = (req, res) =>
  deleteSiteReviewRecord(req, res);

// ==========================================
// 4. CUSTOMER: CREATE PRODUCT REVIEW
// POST /api/reviews
//
// Login required.
// Purchase not required.
// One review per user per product.
// ==========================================
const createReview = async (req, res) => {
  let connection;
  let transactionStarted = false;

  try {
    const userId = req.user?.user_id ?? req.user?.id;
    const { product_id, rating, review } = req.body ?? {};

    const productId = Number(product_id);
    const reviewRating = Number(rating);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login to submit a review",
      });
    }

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid product_id is required",
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

    const [products] = await connection.execute(
      `SELECT id
       FROM products
       WHERE id = ?
       LIMIT 1`,
      [productId]
    );

    if (products.length === 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const [existingReviews] = await connection.execute(
      `SELECT id
       FROM reviews
       WHERE user_id = ?
         AND product_id = ?
       LIMIT 1`,
      [userId, productId]
    );

    if (existingReviews.length > 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(409).json({
        success: false,
        message: "You have already reviewed this product",
      });
    }

    const [result] = await connection.execute(
      `INSERT INTO reviews
       (
         user_id,
         product_id,
         rating,
         review,
         verified_purchase,
         status
       )
       VALUES (?, ?, ?, ?, 0, 'pending')`,
      [userId, productId, reviewRating, reviewText || null]
    );

    await connection.commit();
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      message: "Review submitted successfully and is pending approval",
      data: {
        id: result.insertId,
        user_id: userId,
        product_id: productId,
        rating: reviewRating,
        review: reviewText || null,
        verified_purchase: false,
        status: "pending",
      },
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Review rollback failed:",
          rollbackError.message
        );
      }
    }

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "You have already reviewed this product",
      });
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
// 5. PUBLIC: GET APPROVED PRODUCT REVIEWS
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

    const [breakdownRows] = await db.promise().execute(
      `SELECT
         rating,
         COUNT(*) AS total
       FROM reviews
       WHERE product_id = ?
         AND status = 'approved'
       GROUP BY rating`,
      [productId]
    );

    const ratingBreakdown = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    for (const row of breakdownRows) {
      ratingBreakdown[row.rating] = Number(row.total);
    }

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

    // Fetch review images for the returned reviews.
    if (reviews.length > 0) {
      const reviewIds = reviews.map((item) => item.id);
      const placeholders = reviewIds.map(() => "?").join(",");

      const [imageRows] = await db.promise().execute(
        `SELECT review_id, image
         FROM review_images
         WHERE review_id IN (${placeholders})
         ORDER BY id ASC`,
        reviewIds
      );

      const imagesByReview = new Map();

      for (const imageRow of imageRows) {
        const key = String(imageRow.review_id);

        if (!imagesByReview.has(key)) {
          imagesByReview.set(key, []);
        }

        imagesByReview.get(key).push(imageRow.image);
      }

      for (const item of reviews) {
        item.images = imagesByReview.get(String(item.id)) || [];
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        product_id: productId,
        product_title: products[0].title,
        average_rating: summaryRows[0].average_rating,
        total_reviews: total,
        rating_breakdown: ratingBreakdown,
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
// 6. CUSTOMER: GET OWN REVIEWS
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
         r.rating,
         r.review,
         r.verified_purchase,
         r.status,
         r.created_at,
         r.updated_at
       FROM reviews r
       JOIN products p ON p.id = r.product_id
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
// 7. ADMIN: LIST REVIEWS FOR MODERATION
// GET /api/reviews/admin?status=pending
// ==========================================
const listReviewsForAdmin = async (req, res, defaultStatus) => {
  try {
    const allowedStatuses = [
      "pending",
      "approved",
      "rejected",
      "all",
    ];

    const status = String(
      req.query.status || defaultStatus
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
         r.rating,
         r.review,
         r.verified_purchase,
         r.status,
         r.created_at
       FROM reviews r
       JOIN users u ON u.id = r.user_id
       JOIN products p ON p.id = r.product_id
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
// ADMIN: GET PENDING REVIEWS BY DEFAULT
// ==========================================
const getReviewsForAdmin = (req, res) =>
  listReviewsForAdmin(req, res, "pending");

// ==========================================
// ADMIN: GET ALL REVIEWS BY DEFAULT
// ==========================================
const getAllReviewsForAdmin = (req, res) =>
  listReviewsForAdmin(req, res, "all");

// ==========================================
// 8. ADMIN: DELETE PRODUCT REVIEW
// ==========================================
const deleteReviewForAdmin = async (req, res) => {
  const reviewId = String(req.params.reviewId ?? "");

  if (
    !/^[1-9]\d*$/.test(reviewId) ||
    !Number.isSafeInteger(Number(reviewId))
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid review ID",
    });
  }

  let connection;
  let transactionStarted = false;

  try {
    connection = await db.promise().getConnection();

    await connection.beginTransaction();
    transactionStarted = true;

    const [existingReviews] = await connection.execute(
      `SELECT id
       FROM reviews
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [reviewId]
    );

    if (existingReviews.length === 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    await connection.execute(
      "DELETE FROM review_images WHERE review_id = ?",
      [reviewId]
    );

    await connection.execute(
      "DELETE FROM review_reports WHERE review_id = ?",
      [reviewId]
    );

    const [deleteResult] = await connection.execute(
      "DELETE FROM reviews WHERE id = ?",
      [reviewId]
    );

    if (deleteResult.affectedRows !== 1) {
      throw new Error("Review was not deleted");
    }

    await connection.commit();
    transactionStarted = false;

    return res.status(200).json({
      success: true,
      message: "Review deleted successfully",
      data: {
        id: Number(reviewId),
      },
    });
  } catch (error) {
    console.error("Admin delete review error:", error);

    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Admin delete review rollback error:",
          rollbackError
        );
      }
    }

    return res.status(500).json({
      success: false,
      message: "Failed to delete review",
    });
  } finally {
    connection?.release();
  }
};

// ==========================================
// 9. ADMIN: APPROVE OR REJECT PRODUCT REVIEW
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

// ==========================================
// EXPORTS
// ==========================================
module.exports = {
  createSiteReview,
  getSiteReviews,
  deleteOwnSiteReview,
  deleteSiteReviewForAdmin,
  createReview,
  getProductReviews,
  getMyReviews,
  getReviewsForAdmin,
  getAllReviewsForAdmin,
  deleteReviewForAdmin,
  moderateReview,
};