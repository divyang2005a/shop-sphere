import React from "react";
import { Navigate } from "react-router-dom";

function ProtectedRoute({ children, role }) {

    const isLoggedIn =
        localStorage.getItem("shopsphereLoggedIn") === "true";

    const currentUser = JSON.parse(
        localStorage.getItem("shopsphereCurrentUser") || "null"
    );

    // User is not logged in
    if (!isLoggedIn) {
        return <Navigate to="/login" replace />;
    }

    // Role protection
    if (role && currentUser?.role !== role) {

        // Admin -> Admin Dashboard
        if (currentUser?.role === "admin") {
            return <Navigate to="/admin-dashboard" replace />;
        }

        // User -> User UserDashboard

        return <Navigate to="/dashboard" replace />;

    }

    return children;
}

export default ProtectedRoute;