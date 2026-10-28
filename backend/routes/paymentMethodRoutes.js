const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const {
  getActivePaymentMethods,
} = require("../controllers/paymentMethodController");

router.get("/", authMiddleware, getActivePaymentMethods);

module.exports = router;
