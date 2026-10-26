const express = require("express");
const router = express.Router();

const {
  createReview,
  getProductReviews,
  getMyReviews,
  getReviewsForAdmin,
  moderateReview,
} = require("../controllers/reviewController");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

// Customer routes
router.post("/", authMiddleware, createReview);
router.get("/my", authMiddleware, getMyReviews);

// Public product reviews
router.get("/product/:productId", getProductReviews);

// Admin moderation routes
router.get(
  "/admin",
  authMiddleware,
  adminMiddleware,
  getReviewsForAdmin
);

router.patch(
  "/admin/:reviewId/status",
  authMiddleware,
  adminMiddleware,
  moderateReview
);

module.exports = router;