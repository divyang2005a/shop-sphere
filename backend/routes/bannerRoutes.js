const express = require("express");
const router = express.Router();
const { getActiveBanners } = require("../controllers/adminContentController");

router.get("/", getActiveBanners);

module.exports = router;
