const express = require("express");
const { getActiveFlashSales } = require("../controllers/flashSaleController");

const router = express.Router();

router.get("/", getActiveFlashSales);

module.exports = router;
