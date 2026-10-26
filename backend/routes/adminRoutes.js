const express = require("express");
const router = express.Router();
const adminAuditMiddleware = require("../middleware/adminAuditMiddleware");

router.use(adminAuditMiddleware);

// Authentication and admin authorization
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

// Separate upload middlewares
const uploadProductImage = require("../middleware/uploadMiddleware");
const uploadCategory = require("../middleware/categoryUpload");
const uploadBrand = require("../middleware/brandUpload");

// Admin controllers
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

const {
  getReturnRequests,
  updateReturnStatus,
} = require("../controllers/adminController");

// Inventory controllers
const {
  getInventoryMovements,
  createInventoryMovement,
  updateInventory,
} = require("../controllers/inventoryController");

// admin order controle

const {
  getAdminOrders,
  getAdminOrderById,
  updateAdminOrderStatus,
} = require("../controllers/adminOrderController");

const {
  getAdminOrderInvoice,
} = require("../controllers/invoiceController");

const { getAdminInvoicePdf } = require("../controllers/invoicePdfController");

const {
  getPackingSlipPdf,
} = require("../controllers/packingSlipController");

const {
  createCreditNote,
  getCreditNotes,
} = require("../controllers/creditNoteController");

const {
  getAdminCreditNotePdf,
} = require("../controllers/creditNotePdfController");

const {
  createRefund,
  getAdminRefunds,
  updateRefundStatus,
} = require("../controllers/refundController");

// Dashboard
router.get("/dashboard", authMiddleware, adminMiddleware, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Admin dashboard API is running",
  });
});

// Users
router.get("/users", authMiddleware, adminMiddleware, getUsers);

router.put(
  "/users/:id/status",
  authMiddleware,
  adminMiddleware,
  updateUserStatus,
);

// Products
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

// Product images
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

// Product variants
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

router.get("/returns", authMiddleware, adminMiddleware, getReturnRequests);

router.put(
  "/returns/:return_id",
  authMiddleware,
  adminMiddleware,
  updateReturnStatus,
);

// Categories — categoryUpload.js only
router.get("/categories", authMiddleware, adminMiddleware, getCategories);

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

// Brands — brandUpload.js only
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

router.delete("/brands/:id", authMiddleware, adminMiddleware, deleteBrand);

// Inventory movements
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

// GST rates
router.get("/gst-rates", authMiddleware, adminMiddleware, getGstRates);

// Admin Order Management
router.get("/orders", authMiddleware, adminMiddleware, getAdminOrders);

router.get(
  "/orders/:order_id",
  authMiddleware,
  adminMiddleware,
  getAdminOrderById
);

router.patch(
  "/orders/:order_id/status",
  authMiddleware,
  adminMiddleware,
  updateAdminOrderStatus
);

router.get(
  "/orders/:order_id/invoice",
  authMiddleware,
  adminMiddleware,
  getAdminOrderInvoice
);

router.get(
  "/orders/:order_id/invoice/pdf",
  authMiddleware,
  adminMiddleware,
  getAdminInvoicePdf
);

router.get(
  "/orders/:order_id/packing-slip/pdf",
  authMiddleware,
  adminMiddleware,
  getPackingSlipPdf
);

// Credit notes — admin only
router.post(
  "/returns/:return_id/credit-note",
  authMiddleware,
  adminMiddleware,
  createCreditNote
);

router.get(
  "/credit-notes",
  authMiddleware,
  adminMiddleware,
  getCreditNotes
);

router.get(
  "/credit-notes/:creditNoteId/pdf",
  authMiddleware,
  adminMiddleware,
  getAdminCreditNotePdf
);

// Refund management — admin only
router.post(
  "/returns/:return_id/refund",
  authMiddleware,
  adminMiddleware,
  createRefund
);

router.get(
  "/refunds",
  authMiddleware,
  adminMiddleware,
  getAdminRefunds
);

router.patch(
  "/refunds/:refund_id/status",
  authMiddleware,
  adminMiddleware,
  updateRefundStatus
);

module.exports = router;
