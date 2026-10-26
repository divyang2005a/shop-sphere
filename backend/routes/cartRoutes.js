const express = require("express");
const router = express.Router();

const {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} = require("../controllers/cartController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/", authMiddleware, getCart);
router.post("/", authMiddleware, addToCart);
router.put("/:itemId", authMiddleware, updateCartItem);
router.delete("/clear", authMiddleware, clearCart);
router.delete("/:itemId", authMiddleware, removeCartItem);

module.exports = router;
