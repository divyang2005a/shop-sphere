import React from "react";
import {
BrowserRouter,
Routes,
Route,
useLocation,
Link,
} from "react-router-dom";

// Components
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminDashboardLayout from "./layouts/AdminDashboardLayout";

// Customer Pages
import Home from "./pages/Home";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import CategoryPage from "./pages/CategoryPage";
import ProductDetails from "./pages/ProductDetails";

// User Pages
import UserDashboard from "./pages/UserDashboard";
import Profile from "./pages/user/Profile";
import Orders from "./pages/user/Orders";
import Wishlist from "./pages/user/Wishlist";
import Cart from "./pages/user/Cart";
import PaymentHistory from "./pages/user/PaymentHistory";
import UserSupport from "./pages/user/Support";
import UserSettings from "./pages/user/Settings";

// User Notifications
import UserNotifications from "./pages/user/Notifications";

// Checkout
import Checkout from "./pages/Checkout";

// Admin Dashboard
import AdminDashboard from "./pages/AdminDashboard";

// Admin Profile
import AdminProfile from "./pages/admin/AdminProfile/AdminProfile";

// Admin Products
import Products from "./pages/admin/products/products.jsx";
import AddProduct from "./pages/admin/products/AddProduct";
import Categories from "./pages/admin/products/Categories";
import Brands from "./pages/admin/products/Brands";
import Inventory from "./pages/admin/products/Inventory";

// Admin Orders
import AdminOrders from "./pages/admin/orders/orders.jsx";
import PendingOrders from "./pages/admin/orders/PendingOrders";
import ProcessingOrders from "./pages/admin/orders/ProcessingOrders";
import ShippedOrders from "./pages/admin/orders/ShippedOrders";
import DeliveredOrders from "./pages/admin/orders/DeliveredOrders";
import CancelledOrders from "./pages/admin/orders/CancelledOrders";
import ReturnsRefunds from "./pages/admin/orders/ReturnsRefunds";

// Admin Customers
import Customers from "./pages/admin/customers/customers.jsx";
import CustomerDetails from "./pages/admin/customers/CustomerDetails";

// Admin Discounts
import Coupons from "./pages/admin/discounts/Coupons";
import FlashSales from "./pages/admin/discounts/FlashSales";

// Admin Payments
import Payments from "./pages/admin/payments/payments.jsx";

// Admin Shipping
import Shipping from "./pages/admin/shipping/shipping.jsx";
import DeliveryAreas from "./pages/admin/shipping/DeliveryAreas";
import Tracking from "./pages/admin/shipping/Tracking";
import ShippingMethods from "./pages/admin/shipping/ShippingMethods";

// Admin Reviews
import Reviews from "./pages/admin/reviews/reviews.jsx";

// Admin Reports
import ReportsAnalytics from "./pages/admin/reports/ReportsAnalytics";

// Admin Content
import ContentManagement from "./pages/admin/content/ContentManagement";

// Admin Support
import AdminSupport from "./pages/admin/support/support.jsx";

// Admin Users
import UsersRoles from "./pages/admin/users/UsersRoles";

// Admin Notifications
import AdminNotifications from "./pages/admin/notifications/Notifications.jsx";

// Admin Activity Logs
import ActivityLogs from "./pages/admin/activity-logs/ActivityLogs.jsx";

// Admin Settings
import AdminSettings from "./pages/admin/settings/Settings.jsx";

// ============================================
// REUSABLE ADMIN ROUTE
// ============================================

function AdminRoute({ children }) {
return (
<ProtectedRoute role="admin">
<AdminDashboardLayout>
{children}
</AdminDashboardLayout>
</ProtectedRoute>
);
}

// ============================================
// APP CONTENT
// ============================================

function AppContent() {
const location = useLocation();
const pathname = location.pathname;

// Hide customer Navbar on Admin pages
const isAdminRoute =
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/admin-dashboard";

// Hide customer Navbar on User Dashboard and Auth pages
const hideCustomerNavbarRoutes = [
    "/login",
    "/register",
    "/dashboard",
    "/profile",
    "/orders",
    "/wishlist",
    "/cart",
    "/checkout",
    "/payments",
    "/support",
    "/settings",
    "/notifications",
];

const hideNavbar =
    isAdminRoute ||
    hideCustomerNavbarRoutes.includes(pathname);

return (
    <>
        {!hideNavbar && <Navbar />}

        <Routes>
            {/* HOME */}
            <Route
                path="/"
                element={<Home />}
            />

            {/* AUTH */}
            <Route
                path="/login"
                element={<Login />}
            />

            <Route
                path="/register"
                element={<Register />}
            />

            {/* ALL PRODUCTS */}
            <Route
                path="/products"
                element={
                    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-aqua-spring px-4 text-center">
                        <h1 className="text-3xl font-bold text-cyprus">
                            Products Page
                        </h1>

                        <Link
                            to="/categories"
                            className="text-sm font-semibold text-ocean-green hover:underline"
                        >
                            Browse Categories
                        </Link>
                    </div>
                }
            />

            {/* DYNAMIC CATEGORY PAGE */}
            <Route
                path="/category/:categorySlug"
                element={<CategoryPage />}
            />

            {/* ALL CATEGORIES */}
            <Route
                path="/categories"
                element={<CategoryPage />}
            />

            {/* PRODUCT DETAILS */}
            <Route
                path="/product/:productId"
                element={<ProductDetails />}
            />

            {/* ================================== */}
            {/* USER DASHBOARD */}
            {/* ================================== */}

            <Route
                path="/dashboard"
                element={
                    <ProtectedRoute role="user">
                        <UserDashboard />
                    </ProtectedRoute>
                }
            />

            {/* USER PROFILE */}
            <Route
                path="/profile"
                element={
                    <ProtectedRoute role="user">
                        <Profile />
                    </ProtectedRoute>
                }
            />

            {/* USER ORDERS */}
            <Route
                path="/orders"
                element={
                    <ProtectedRoute role="user">
                        <Orders />
                    </ProtectedRoute>
                }
            />

            {/* USER WISHLIST */}
            <Route
                path="/wishlist"
                element={
                    <ProtectedRoute role="user">
                        <Wishlist />
                    </ProtectedRoute>
                }
            />

            {/* USER CART */}
            <Route
                path="/cart"
                element={
                    <ProtectedRoute role="user">
                        <Cart />
                    </ProtectedRoute>
                }
            />

            {/* USER PAYMENT HISTORY */}
            <Route
                path="/payments"
                element={
                    <ProtectedRoute role="user">
                        <PaymentHistory />
                    </ProtectedRoute>
                }
            />

            {/* USER SUPPORT */}
            <Route
                path="/support"
                element={
                    <ProtectedRoute role="user">
                        <UserSupport />
                    </ProtectedRoute>
                }
            />

            {/* USER SETTINGS */}
            <Route
                path="/settings"
                element={
                    <ProtectedRoute role="user">
                        <UserSettings />
                    </ProtectedRoute>
                }
            />

            {/* USER NOTIFICATIONS */}
            <Route
                path="/notifications"
                element={
                    <ProtectedRoute role="user">
                        <UserNotifications />
                    </ProtectedRoute>
                }
            />

            {/* CHECKOUT */}
            <Route
                path="/checkout"
                element={
                    <ProtectedRoute role="user">
                        <Checkout />
                    </ProtectedRoute>
                }
            />

            {/* ================================== */}
            {/* ADMIN DASHBOARD */}
            {/* ================================== */}

            <Route
                path="/admin"
                element={
                    <AdminRoute>
                        <AdminDashboard />
                    </AdminRoute>
                }
            />

            <Route
                path="/admin-dashboard"
                element={
                    <AdminRoute>
                        <AdminDashboard />
                    </AdminRoute>
                }
            />

            {/* ADMIN PROFILE */}
            <Route
                path="/admin/profile"
                element={
                    <AdminRoute>
                        <AdminProfile />
                    </AdminRoute>
                }
            />

            {/* ADMIN PRODUCTS */}
            <Route
                path="/admin/products"
                element={
                    <AdminRoute>
                        <Products />
                    </AdminRoute>
                }
            />

            <Route
                path="/admin/products/add"
                element={
                    <AdminRoute>
                        <AddProduct />
                    </AdminRoute>
                }
            />

            <Route
                path="/admin/categories"
                element={
                    <AdminRoute>
                        <Categories />
                    </AdminRoute>
                }
            />

            <Route
                path="/admin/brands"
                element={
                    <AdminRoute>
                        <Brands />
                    </AdminRoute>
                }
            />

            <Route
                path="/admin/inventory"
                element={
                    <AdminRoute>
                        <Inventory />
                    </AdminRoute>
                }
            />

            {/* ADMIN ORDERS */}
            <Route
                path="/admin/orders"
                element={
                    <AdminRoute>
                        <AdminOrders />
                    </AdminRoute>
                }
            />

            <Route
                path="/admin/orders/pending"
                element={
                    <AdminRoute>
                        <PendingOrders />
                    </AdminRoute>
                }
            />

            <Route
                path="/admin/orders/processing"
                element={
                    <AdminRoute>
                        <ProcessingOrders />
                    </AdminRoute>
                }
            />

            <Route
                path="/admin/orders/shipped"
                element={
                    <AdminRoute>
                        <ShippedOrders />
                    </AdminRoute>
                }
            />

            <Route
                path="/admin/orders/delivered"
                element={
                    <AdminRoute>
                        <DeliveredOrders />
                    </AdminRoute>
                }
            />

            <Route
                path="/admin/orders/cancelled"
                element={
                    <AdminRoute>
                        <CancelledOrders />
                    </AdminRoute>
                }
            />

            <Route
                path="/admin/orders/returns"
                element={
                    <AdminRoute>
                        <ReturnsRefunds />
                    </AdminRoute>
                }
            />

            {/* ADMIN CUSTOMERS */}
            <Route
                path="/admin/customers"
                element={
                    <AdminRoute>
                        <Customers />
                    </AdminRoute>
                }
            />

            <Route
                path="/admin/customers/:id"
                element={
                    <AdminRoute>
                        <CustomerDetails />
                    </AdminRoute>
                }
            />

            {/* ADMIN DISCOUNTS */}
            <Route
                path="/admin/discounts/coupons"
                element={
                    <AdminRoute>
                        <Coupons />
                    </AdminRoute>
                }
            />

            <Route
                path="/admin/discounts/flash-sales"
                element={
                    <AdminRoute>
                        <FlashSales />
                    </AdminRoute>
                }
            />

            {/* ADMIN PAYMENTS */}
            <Route
                path="/admin/payments"
                element={
                    <AdminRoute>
                        <Payments />
                    </AdminRoute>
                }
            />

            {/* ADMIN SHIPPING */}
            <Route
                path="/admin/shipping"
                element={
                    <AdminRoute>
                        <Shipping />
                    </AdminRoute>
                }
            />

            <Route
                path="/admin/shipping/areas"
                element={
                    <AdminRoute>
                        <DeliveryAreas />
                    </AdminRoute>
                }
            />

            <Route
                path="/admin/shipping/tracking"
                element={
                    <AdminRoute>
                        <Tracking />
                    </AdminRoute>
                }
            />

            <Route
                path="/admin/shipping/methods"
                element={
                    <AdminRoute>
                        <ShippingMethods />
                    </AdminRoute>
                }
            />

            {/* ADMIN REVIEWS */}
            <Route
                path="/admin/reviews"
                element={
                    <AdminRoute>
                        <Reviews />
                    </AdminRoute>
                }
            />

            {/* ADMIN REPORTS */}
            <Route
                path="/admin/reports"
                element={
                    <AdminRoute>
                        <ReportsAnalytics />
                    </AdminRoute>
                }
            />

            {/* ADMIN CONTENT */}
            <Route
                path="/admin/content"
                element={
                    <AdminRoute>
                        <ContentManagement />
                    </AdminRoute>
                }
            />

            {/* ADMIN SUPPORT */}
            <Route
                path="/admin/support"
                element={
                    <AdminRoute>
                        <AdminSupport />
                    </AdminRoute>
                }
            />

            {/* ADMIN USERS & ROLES */}
            <Route
                path="/admin/users"
                element={
                    <AdminRoute>
                        <UsersRoles />
                    </AdminRoute>
                }
            />

            {/* ADMIN NOTIFICATIONS */}
            <Route
                path="/admin/notifications"
                element={
                    <AdminRoute>
                        <AdminNotifications />
                    </AdminRoute>
                }
            />

            {/* ADMIN ACTIVITY LOGS */}
            <Route
                path="/admin/activity-logs"
                element={
                    <AdminRoute>
                        <ActivityLogs />
                    </AdminRoute>
                }
            />

            {/* ADMIN SETTINGS */}
            <Route
                path="/admin/settings"
                element={
                    <AdminRoute>
                        <AdminSettings />
                    </AdminRoute>
                }
            />

            {/* 404 PAGE */}
            <Route
                path="*"
                element={
                    <div className="flex min-h-screen items-center justify-center bg-aqua-spring px-4">
                        <div className="text-center">
                            <h1 className="text-7xl font-bold text-cyprus">
                                404
                            </h1>

                            <p className="mt-4 text-xl text-gray-600">
                                Page Not Found
                            </p>

                            <Link
                                to="/"
                                className="mt-6 inline-block rounded-lg bg-ocean-green px-6 py-3 text-white hover:opacity-90"
                            >
                                Go Home
                            </Link>
                        </div>
                    </div>
                }
            />
        </Routes>
    </>
);

}

// ============================================
// MAIN APP
// ============================================

function App() {
return (
<BrowserRouter>
<AppContent />
</BrowserRouter>
);
}

export default App;