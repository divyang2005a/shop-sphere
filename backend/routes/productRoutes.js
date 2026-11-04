const express = require("express");
const router = express.Router();

const {
  getProducts,
  getProductDetails,
  getPublicProductImages,
} = require("../controllers/adminController");
const { getRecommendedProducts } = require("../controllers/productController");

// Get all products or filter by category name/slug
router.get("/", getProducts);

// Get recommended products, optionally based on a product ID
router.get("/recommended", getRecommendedProducts);

// Get product images for the public storefront
router.get("/:productId/images", getPublicProductImages);

// Get one product with all its images
router.get("/:productId", getProductDetails);

module.exports = router;
