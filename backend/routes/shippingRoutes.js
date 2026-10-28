const express = require("express");
const router = express.Router();

const {
    getDeliveryAreas,
    getShippingMethods,
    createDeliveryArea,
    updateDeliveryArea,
    createShippingMethod,
    updateShippingMethod,
    getActiveDeliveryAreas,
    getActiveShippingMethods,
} = require("../controllers/shippingController");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

// Admin shipping methods
router.get(
    "/shipping-methods",
    authMiddleware,
    adminMiddleware,
    getShippingMethods
);

router.post(
    "/shipping-methods",
    authMiddleware,
    adminMiddleware,
    createShippingMethod
);

router.patch(
    "/shipping-methods/:id",
    authMiddleware,
    adminMiddleware,
    updateShippingMethod
);

// Admin delivery areas
router.get(
    "/delivery-areas",
    authMiddleware,
    adminMiddleware,
    getDeliveryAreas
);

router.post(
    "/delivery-areas",
    authMiddleware,
    adminMiddleware,
    createDeliveryArea
);

router.patch(
    "/delivery-areas/:id",
    authMiddleware,
    adminMiddleware,
    updateDeliveryArea
);

// Customer-facing active options
router.get(
    "/methods",
    authMiddleware,
    getActiveShippingMethods
);

router.get(
    "/active-delivery-areas",
    authMiddleware,
    getActiveDeliveryAreas
);

module.exports = router;