
const express = require("express");
const router = express.Router();

const {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  moveToCart,
} = require("../controllers/wishlistController");

const authMiddleware = require("../middleware/authMiddleware");

router.get("/", authMiddleware, getWishlist);
router.post("/items", authMiddleware, addToWishlist);
router.post("/items/:itemId/move-to-cart", authMiddleware, moveToCart);
router.delete("/items/:itemId", authMiddleware, removeFromWishlist);

module.exports = router;
