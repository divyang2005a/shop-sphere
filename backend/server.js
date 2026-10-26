require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const helmet = require("helmet");

const { verifySMTP } = require("./services/emailService");

const app = express();

// ========================================
// SECURITY HEADERS
// ========================================

const helmetOptions = {
  // Allow frontend to load images served from the backend.
  crossOriginResourcePolicy: {
    policy: "cross-origin",
  },
};

// In local HTTP development, do not send an HTTPS-only HSTS header.
// Helmet's default HSTS behavior remains enabled in production.
if (process.env.NODE_ENV !== "production") {
  helmetOptions.strictTransportSecurity = false;
}

app.use(helmet(helmetOptions));

// ========================================
// CORS CONFIGURATION
// ========================================
const corsOptions = {
  origin: "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

// Middleware
app.use(express.json());

// Serve uploaded images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ========================================
// ROUTES
// ========================================
const authRoutes = require("./routes/authRoutes");
const adminRouter = require("./routes/adminRoutes");
const cartRoutes = require("./routes/cartRoutes");
const addressRoutes = require("./routes/addressRoutes");
const orderRoutes = require("./routes/orderRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const productRoutes = require("./routes/productRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const shipmentRoutes = require("./routes/shipmentRoutes");

app.use("/api/products", productRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRouter);
app.use("/api/cart", cartRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/shipments", shipmentRoutes);

app.use("/api/support", require("./routes/supportRoutes"));

// ========================================
// HOME ROUTE
// ========================================
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "ShopSphere Backend API is Running",
  });
});

// ========================================
// 404 HANDLER
// ========================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ========================================
// GLOBAL ERROR HANDLER
// Must be last
// ========================================
app.use((err, req, res, next) => {
  console.error("Global error:", err);

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: err.message,
      code: err.code,
      field: err.field || null,
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

// ========================================
// START SERVER
// ========================================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`ShopSphere backend running on port ${PORT}`);
  console.log("Allowed frontend origin: http://localhost:5173");
});

// Verify SMTP connection
verifySMTP();
