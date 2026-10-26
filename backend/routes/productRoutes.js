const express = require("express");
const router = express.Router();

const {
  getProducts,
  getProductDetails,
} = require("../controllers/adminController");

// Get all products or filter by category name/slug
router.get("/", getProducts);

// Get one product with all its images
router.get("/:productId", getProductDetails);

module.exports = router;
