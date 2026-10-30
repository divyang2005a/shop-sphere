const express = require("express");
const router = express.Router();
const adminAuditMiddleware = require("../middleware/adminAuditMiddleware");

router.use(adminAuditMiddleware);

// Authentication and admin authorization
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

// Upload middlewares
const uploadProductImage = require("../middleware/uploadMiddleware");
const uploadCategory = require("../middleware/categoryUpload");
const uploadBrand = require("../middleware/brandUpload");

// Admin catalog controllers
const {
  getUsers,
  updateUserStatus,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getBrands,
  createBrand,
  updateBrand,
  deleteBrand,
  getUserDetails,
  deleteUser,
} = require("../controllers/adminCatalogController");

// Product and GST controllers
const {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductImages,
  addProductImage,
  deleteProductImage,
  getProductVariants,
  createProductVariant,
  updateProductVariant,
  deleteProductVariant,
  getGstRates,
} = require("../controllers/adminProductController");

// Returns
const {
  getReturnRequests,
  updateReturnStatus,
} = require("../controllers/adminController");

// Inventory
const {
  getInventoryMovements,
  createInventoryMovement,
  updateInventory,
} = require("../controllers/inventoryController");

// Admin order management
const {
  getAdminOrders,
  getAdminOrderById,
  updateAdminOrderStatus,
  confirmOrderPayment,
} = require("../controllers/adminOrderController");

// Invoices and packing slips
const { getAdminOrderInvoice } = require("../controllers/invoiceController");
const { getAdminInvoicePdf } = require("../controllers/invoicePdfController");
const { getPackingSlipPdf } = require("../controllers/packingSlipController");
const {
  getAllReviewsForAdmin,
  getSiteReviews,
  deleteReviewForAdmin,
  deleteSiteReviewForAdmin,
} = require("../controllers/reviewController");

// Credit notes
const {
  createCreditNote,
  getCreditNotes,
} = require("../controllers/creditNoteController");

const {
  getAdminCreditNotePdf,
} = require("../controllers/creditNotePdfController");

// Refunds
const {
  createRefund,
  getAdminRefunds,
  updateRefundStatus,
} = require("../controllers/refundController");

// Coupons
const {
  createCoupon,
  getCoupons,
  updateCouponStatus,
} = require("../controllers/couponController");

// Payment method configuration only; no gateway integration
const {
  createPaymentMethod,
  getAdminPaymentMethods,
  updatePaymentMethod,
} = require("../controllers/paymentMethodController");
const { getAdminPayments } = require("../controllers/adminPaymentController");
const {
  getAdminNotifications,
  createAdminNotification,
  updateAdminNotification,
  deleteAdminNotification,
  publishAdminNotification,
  scheduleAdminNotification,
} = require("../controllers/adminNotificationController");

// Shipping and delivery areas
const {
  createDeliveryArea,
  createShippingMethod,
  getDeliveryAreas,
  getShippingMethods,
  updateDeliveryArea,
  updateShippingMethod,
} = require("../controllers/shippingController");

// Dashboard and reports
const {
  getDashboard,
  getSalesReport,
  getOrdersReport,
  getProductsReport,
  getInventoryReport,
} = require("../controllers/reportController");

// =====================================================
// DASHBOARD
// =====================================================

router.get(
  "/dashboard",
  authMiddleware,
  adminMiddleware,
  getDashboard,
);

// =====================================================
// USERS
// =====================================================

router.get("/users", authMiddleware, adminMiddleware, getUsers);

router.get(
  "/users/:id",
  authMiddleware,
  adminMiddleware,
  getUserDetails,
);

router.put(
  "/users/:id/status",
  authMiddleware,
  adminMiddleware,
  updateUserStatus,
);

router.delete(
  "/users/:id",
  authMiddleware,
  adminMiddleware,
  deleteUser,
);

// =====================================================
// PRODUCTS
// =====================================================

router.get("/products", authMiddleware, adminMiddleware, getProducts);

router.post("/products", authMiddleware, adminMiddleware, createProduct);

router.put(
  "/products/:product_id",
  authMiddleware,
  adminMiddleware,
  updateProduct,
);

router.delete(
  "/products/:product_id",
  authMiddleware,
  adminMiddleware,
  deleteProduct,
);

// =====================================================
// REVIEWS
// =====================================================

router.get(
  "/reviews",
  authMiddleware,
  adminMiddleware,
  getAllReviewsForAdmin,
);

router.get(
  "/site-reviews",
  authMiddleware,
  adminMiddleware,
  getSiteReviews,
);

router.delete(
  "/reviews/:reviewId",
  authMiddleware,
  adminMiddleware,
  deleteReviewForAdmin,
);

router.delete(
  "/site-reviews/:reviewId",
  authMiddleware,
  adminMiddleware,
  deleteSiteReviewForAdmin,
);

// =====================================================
// PRODUCT IMAGES
// =====================================================

router.get(
  "/products/:product_id/images",
  authMiddleware,
  adminMiddleware,
  getProductImages,
);

router.post(
  "/products/:product_id/images",
  authMiddleware,
  adminMiddleware,
  uploadProductImage.single("image"),
  addProductImage,
);

router.delete(
  "/products/:product_id/images/:image_id",
  authMiddleware,
  adminMiddleware,
  deleteProductImage,
);

// =====================================================
// PRODUCT VARIANTS
// =====================================================

router.get(
  "/products/:product_id/variants",
  authMiddleware,
  adminMiddleware,
  getProductVariants,
);

router.post(
  "/products/:product_id/variants",
  authMiddleware,
  adminMiddleware,
  createProductVariant,
);

router.put(
  "/products/:product_id/variants/:variant_id",
  authMiddleware,
  adminMiddleware,
  updateProductVariant,
);

router.delete(
  "/products/:product_id/variants/:variant_id",
  authMiddleware,
  adminMiddleware,
  deleteProductVariant,
);

// =====================================================
// RETURNS
// =====================================================

router.get(
  "/returns",
  authMiddleware,
  adminMiddleware,
  getReturnRequests,
);

router.put(
  "/returns/:return_id",
  authMiddleware,
  adminMiddleware,
  updateReturnStatus,
);

// =====================================================
// CATEGORIES
// =====================================================

router.get(
  "/categories",
  authMiddleware,
  adminMiddleware,
  getCategories,
);

router.post(
  "/categories",
  authMiddleware,
  adminMiddleware,
  uploadCategory.single("image"),
  createCategory,
);

router.put(
  "/categories/:id",
  authMiddleware,
  adminMiddleware,
  uploadCategory.single("image"),
  updateCategory,
);

router.delete(
  "/categories/:id",
  authMiddleware,
  adminMiddleware,
  deleteCategory,
);

// =====================================================
// BRANDS
// =====================================================

router.get("/brands", authMiddleware, adminMiddleware, getBrands);

router.post(
  "/brands",
  authMiddleware,
  adminMiddleware,
  uploadBrand.fields([
    { name: "logo", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  createBrand,
);

router.put(
  "/brands/:id",
  authMiddleware,
  adminMiddleware,
  uploadBrand.fields([
    { name: "logo", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  updateBrand,
);

router.delete(
  "/brands/:id",
  authMiddleware,
  adminMiddleware,
  deleteBrand,
);

// =====================================================
// COUPONS
// =====================================================

router.get("/coupons", authMiddleware, adminMiddleware, getCoupons);

router.post("/coupons", authMiddleware, adminMiddleware, createCoupon);

router.patch(
  "/coupons/:id/status",
  authMiddleware,
  adminMiddleware,
  updateCouponStatus,
);

// =====================================================
// PAYMENT METHODS
// Configuration only; no payment gateway integration
// =====================================================

router.get(
  "/payments",
  authMiddleware,
  adminMiddleware,
  getAdminPayments,
);

router.get(
  "/payment-methods",
  authMiddleware,
  adminMiddleware,
  getAdminPaymentMethods,
);

router.post(
  "/payment-methods",
  authMiddleware,
  adminMiddleware,
  createPaymentMethod,
);

router.patch(
  "/payment-methods/:id",
  authMiddleware,
  adminMiddleware,
  updatePaymentMethod,
);

// =====================================================
// SHIPPING METHODS AND DELIVERY AREAS
// =====================================================

router.get(
  "/shipping-methods",
  authMiddleware,
  adminMiddleware,
  getShippingMethods,
);

router.post(
  "/shipping-methods",
  authMiddleware,
  adminMiddleware,
  createShippingMethod,
);

router.patch(
  "/shipping-methods/:id",
  authMiddleware,
  adminMiddleware,
  updateShippingMethod,
);

router.get(
  "/delivery-areas",
  authMiddleware,
  adminMiddleware,
  getDeliveryAreas,
);

router.post(
  "/delivery-areas",
  authMiddleware,
  adminMiddleware,
  createDeliveryArea,
);

router.patch(
  "/delivery-areas/:id",
  authMiddleware,
  adminMiddleware,
  updateDeliveryArea,
);

// =====================================================
// INVENTORY
// =====================================================

router.get(
  "/inventory/movements",
  authMiddleware,
  adminMiddleware,
  getInventoryMovements,
);

router.post(
  "/inventory/movements",
  authMiddleware,
  adminMiddleware,
  createInventoryMovement,
);

router.put(
  "/inventory/:product_id",
  authMiddleware,
  adminMiddleware,
  updateInventory,
);

// =====================================================
// GST RATES
// =====================================================

router.get(
  "/gst-rates",
  authMiddleware,
  adminMiddleware,
  getGstRates,
);

// =====================================================
// ADMIN ORDER MANAGEMENT
// =====================================================

router.get(
  "/orders",
  authMiddleware,
  adminMiddleware,
  getAdminOrders,
);

router.get(
  "/orders/:order_id",
  authMiddleware,
  adminMiddleware,
  getAdminOrderById,
);

router.patch(
  "/orders/:order_id/status",
  authMiddleware,
  adminMiddleware,
  updateAdminOrderStatus,
);

router.get(
  "/orders/:order_id/invoice",
  authMiddleware,
  adminMiddleware,
  getAdminOrderInvoice,
);

router.get(
  "/orders/:order_id/invoice/pdf",
  authMiddleware,
  adminMiddleware,
  getAdminInvoicePdf,
);

router.get(
  "/orders/:order_id/packing-slip/pdf",
  authMiddleware,
  adminMiddleware,
  getPackingSlipPdf,
);

// =====================================================
// CREDIT NOTES
// =====================================================

router.post(
  "/returns/:return_id/credit-note",
  authMiddleware,
  adminMiddleware,
  createCreditNote,
);

router.get(
  "/credit-notes",
  authMiddleware,
  adminMiddleware,
  getCreditNotes,
);

router.get(
  "/credit-notes/:creditNoteId/pdf",
  authMiddleware,
  adminMiddleware,
  getAdminCreditNotePdf,
);

// =====================================================
// REFUND MANAGEMENT
// =====================================================

router.post(
  "/returns/:return_id/refund",
  authMiddleware,
  adminMiddleware,
  createRefund,
);

router.get(
  "/refunds",
  authMiddleware,
  adminMiddleware,
  getAdminRefunds,
);

router.patch(
  "/refunds/:refund_id/status",
  authMiddleware,
  adminMiddleware,
  updateRefundStatus,
);

// =====================================================
// REPORTS
// =====================================================

// Sales report
router.get(
  "/reports/sales",
  authMiddleware,
  adminMiddleware,
  getSalesReport,
);

// Orders report
router.get(
  "/reports/orders",
  authMiddleware,
  adminMiddleware,
  getOrdersReport,
);

// Products report
router.get(
  "/reports/products",
  authMiddleware,
  adminMiddleware,
  getProductsReport,
);

// Inventory report
router.get(
  "/reports/inventory",
  authMiddleware,
  adminMiddleware,
  getInventoryReport,
);

router.patch(
  "/orders/:order_id/payment-status",
  authMiddleware,
  adminMiddleware,
  confirmOrderPayment,
);

// =====================================================
// NOTIFICATIONS
// =====================================================

router.get(
  "/notifications",
  authMiddleware,
  adminMiddleware,
  getAdminNotifications,
);

router.post(
  "/notifications",
  authMiddleware,
  adminMiddleware,
  createAdminNotification,
);

router.put(
  "/notifications/:notificationId",
  authMiddleware,
  adminMiddleware,
  updateAdminNotification,
);

router.delete(
  "/notifications/:notificationId",
  authMiddleware,
  adminMiddleware,
  deleteAdminNotification,
);

router.post(
  "/notifications/:notificationId/publish",
  authMiddleware,
  adminMiddleware,
  publishAdminNotification,
);

router.post(
  "/notifications/:notificationId/schedule",
  authMiddleware,
  adminMiddleware,
  scheduleAdminNotification,
);

module.exports = router;