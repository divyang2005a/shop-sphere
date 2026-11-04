import React, { useEffect } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

function UserDashboardSidebar({ mobileOpen, setMobileOpen }) {
    const location = useLocation();
    const navigate = useNavigate();

    const getUser = () => {
        try {
            return JSON.parse(
                localStorage.getItem("shopsphereUser") || "null"
            );
        } catch {
            return null;
        }
    };

    const user = getUser();
    const _userName = user?.name || "ShopSphere User";

    useEffect(() => {
        setMobileOpen(false);
    }, [location.pathname, setMobileOpen]);

    const menuItems = [
        {
            title: "Dashboard",
            path: "/dashboard",
            icon: "fa-solid fa-house",
        },
        {
            title: "My Orders",
            path: "/orders",
            icon: "fa-solid fa-box",
        },
        {
            title: "My Cart",
            path: "/cart",
            icon: "fa-solid fa-cart-shopping",
        },
        {
            title: "My Wishlist",
            path: "/wishlist",
            icon: "fa-regular fa-heart",
        },
        {
            title: "Payments History",
            path: "/payments",
            icon: "fa-solid fa-credit-card",
        },
        {
            title: "Help & Support",
            path: "/support",
            icon: "fa-solid fa-headset",
        },
        {
            title: "Settings",
            path: "/settings",
            icon: "fa-solid fa-gear",
        },
        {
            title: "Profile",
            path: "/profile",
            icon: "fa-regular fa-user",
        },
    ];

    const handleLogout = async () => {
        try {
            const token = localStorage.getItem("shopsphereToken");

            // Call Logout API
            const response = await fetch(
                "http://localhost:5000/api/auth/logout",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...(token && {
                            Authorization: `Bearer ${token}`,
                        }),
                    },
                }
            );

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                console.error("Logout API Error:", data);
            } else {
                console.log("Logout successful:", data);
            }
        } catch (error) {
            console.error("Logout API Error:", error);
        } finally {
            // Clear login data
            localStorage.removeItem("shopsphereToken");
            localStorage.removeItem("shopsphereCurrentUser");
            localStorage.removeItem("shopsphereLoggedIn");

            // Remove old login keys, if present
            localStorage.removeItem("shopsphereUser");
            localStorage.removeItem("token");
            localStorage.removeItem("user");

            // Update Navbar
            setDropdownOpen(false);
            setCurrentUser(null);
            setIsLoggedIn(false);

            // Notify other components
            window.dispatchEvent(new Event("authChange"));

            // Redirect to Home Page
            navigate("/", { replace: true });
        }
    };

    return (
        <>
            {/* Mobile Backdrop */}
            {mobileOpen && (
                <button
                    type="button"
                    aria-label="Close sidebar"
                    onClick={() => setMobileOpen(false)}
                    className="fixed inset-0 z-40 bg-black/40 lg:hidden"
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-100 bg-white transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"
                    } lg:translate-x-0`}
            >
                {/* Logo */}
                <div className="flex h-14 shrink-0 items-center justify-between border-b border-gray-100 px-5">
                    <Link
                        to="/"
                        onClick={() => setMobileOpen(false)}
                        className="text-2xl font-bold text-cyprus"
                    >
                        Shop<span className="text-ocean-green">Sphere</span>
                    </Link>

                    <button
                        type="button"
                        onClick={() => setMobileOpen(false)}
                        aria-label="Close sidebar"
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 lg:hidden"
                    >
                        <i className="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto px-4 py-5">
                    <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[2px] text-gray-400">
                        Menu
                    </p>

                    <div className="space-y-1">
                        {menuItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                end={item.path === "/dashboard"}
                                onClick={() => setMobileOpen(false)}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${isActive
                                        ? "bg-cyprus text-white shadow-sm"
                                        : "text-text-grey hover:bg-aqua-spring hover:text-cyprus"
                                    }`
                                }
                            >
                                <i className={`${item.icon} w-5 text-center`}></i>
                                <span>{item.title}</span>
                            </NavLink>
                        ))}
                    </div>

                    {/* Logout */}
                    <div className="mt-4 border-t border-gray-100 pt-4">
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-error transition hover:bg-red-50"
                        >
                            <i className="fa-solid fa-right-from-bracket w-5 text-center"></i>
                            <span>Logout</span>
                        </button>
                    </div>
                </nav>

            </aside>
        </>
    );
}

export default UserDashboardSidebar;