const express = require("express");

const router = express.Router();

const {
  addAddress,
  getAddresses,
  updateAddress,
  deleteAddress,
} = require("../controllers/addressController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/", authMiddleware, addAddress);
router.get("/", authMiddleware, getAddresses);
router.put("/:addressId", authMiddleware, updateAddress);
router.delete("/:addressId", authMiddleware, deleteAddress);

module.exports = router;
