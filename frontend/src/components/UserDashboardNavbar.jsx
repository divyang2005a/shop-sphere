import React, {
    useState,
    useEffect,
    useRef,
    useCallback,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import Notifications from "../pages/user/Notifications";

const UNREAD_COUNT_URL =
    "http://192.168.1.20:5000/api/notifications/unread-count";

function UserDashboardNavbar({ onMenuClick }) {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [notificationOpen, setNotificationOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const navigate = useNavigate();
    const notificationRef = useRef(null);

    const getUser = () => {
        try {
            return JSON.parse(
                localStorage.getItem("shopsphereCurrentUser") ||
                    localStorage.getItem("shopsphereUser") ||
                    "null"
            );
        } catch {
            return null;
        }
    };

    const user = getUser();
    const userName = user?.name || "User";

    const getHeaders = () => {
        const token = localStorage.getItem("shopsphereToken");

        return {
            "Content-Type": "application/json",
            ...(token && {
                Authorization: `Bearer ${token}`,
            }),
        };
    };

    const fetchUnreadCount = useCallback(async () => {
        try {
            const response = await fetch(UNREAD_COUNT_URL, {
                method: "GET",
                headers: getHeaders(),
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    result.message || "Failed to load unread count."
                );
            }

            const count =
                result.unread_count ??
                result.unreadCount ??
                result.count ??
                result.data?.unread_count ??
                result.data?.unreadCount ??
                result.data?.count ??
                result.data?.unread ??
                result.unread ??
                0;

            setUnreadCount(Number(count) || 0);
        } catch (error) {
            console.error("Unread Count API Error:", error);
        }
    }, []);

    useEffect(() => {
        fetchUnreadCount();
    }, [fetchUnreadCount]);

    useEffect(() => {
        if (notificationOpen) {
            fetchUnreadCount();
        }
    }, [notificationOpen, fetchUnreadCount]);

    // Popup બહાર click થાય ત્યારે બંધ કરો.
    useEffect(() => {
        const handleOutsideClick = (event) => {
            if (
                notificationRef.current &&
                !notificationRef.current.contains(event.target)
            ) {
                setNotificationOpen(false);
            }
        };

        const handleEscape = (event) => {
            if (event.key === "Escape") {
                setNotificationOpen(false);
            }
        };

        document.addEventListener("mousedown", handleOutsideClick);
        document.addEventListener("keydown", handleEscape);

        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
            document.removeEventListener("keydown", handleEscape);
        };
    }, []);

    const handleLogout = async () => {
        try {
            const token = localStorage.getItem("shopsphereToken");

            const response = await fetch(
                "http://192.168.1.20:5000/api/auth/logout",
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
            }
        } catch (error) {
            console.error("Logout API Error:", error);
        } finally {
            [
                "shopsphereToken",
                "shopsphereCurrentUser",
                "shopsphereLoggedIn",
                "shopsphereUser",
                "token",
                "user",
            ].forEach((key) => localStorage.removeItem(key));

            setDropdownOpen(false);
            setNotificationOpen(false);
            setUnreadCount(0);

            window.dispatchEvent(new Event("authChange"));
            navigate("/", { replace: true });
        }
    };

    return (
        <header className="sticky top-0 z-30 shrink-0 border-b border-gray-200 bg-white">
            <div className="flex h-14 items-center justify-between gap-2 px-3 sm:px-6 lg:px-8">
                {/* Left Section */}
                <div className="flex min-w-0 items-center gap-2 sm:gap-4">
                    <button
                        type="button"
                        onClick={onMenuClick}
                        aria-label="Open sidebar"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-cyprus transition hover:bg-aqua-spring lg:hidden"
                    >
                        <i className="fa-solid fa-bars text-xl"></i>
                    </button>

                    <Link to="/dashboard" className="shrink-0 lg:hidden">
                        <span className="text-lg font-bold text-cyprus sm:text-xl">
                            Shop
                            <span className="text-ocean-green">Sphere</span>
                        </span>
                    </Link>

                    <div className="hidden lg:block">
                        <h2 className="text-base font-bold text-cyprus">
                            My Account
                        </h2>
                    </div>
                </div>

                {/* Right Section */}
                <div className="flex shrink-0 items-center gap-1 sm:gap-3">
                    {/* Search */}
                    <div className="hidden md:flex md:w-48 lg:w-64">
                        <div className="flex w-full items-center gap-3 rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5">
                            <i className="fa-solid fa-magnifying-glass text-sm text-text-grey"></i>

                            <input
                                type="text"
                                placeholder="Search products..."
                                aria-label="Search products"
                                className="w-full bg-transparent text-sm text-cyprus outline-none placeholder:text-text-grey"
                            />
                        </div>
                    </div>

                    <button
                        type="button"
                        aria-label="Search products"
                        onClick={() => navigate("/products")}
                        className="hidden h-9 w-9 items-center justify-center rounded-full text-text-grey transition hover:bg-aqua-spring hover:text-ocean-green sm:flex md:hidden"
                    >
                        <i className="fa-solid fa-magnifying-glass"></i>
                    </button>

                    {/* Notification Bell + Popup */}
                    <div className="relative" ref={notificationRef}>
                        <button
                            type="button"
                            aria-label="Notifications"
                            title="Notifications"
                            aria-expanded={notificationOpen}
                            onClick={() =>
                                setNotificationOpen((previous) => !previous)
                            }
                            className="relative hidden h-9 w-9 items-center justify-center rounded-full text-text-grey transition hover:bg-aqua-spring hover:text-ocean-green md:flex sm:h-10 sm:w-10"
                        >
                            <i className="fa-regular fa-bell text-lg"></i>

                            {unreadCount > 0 && (
                                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[9px] font-bold text-white">
                                    {unreadCount > 99 ? "99+" : unreadCount}
                                </span>
                            )}
                        </button>

                        {notificationOpen && (
                            <Notifications
                                mode="popup"
                                isOpen={notificationOpen}
                                onClose={() => setNotificationOpen(false)}
                                onUnreadCountChange={setUnreadCount}
                            />
                        )}
                    </div>

                    <div className="hidden h-8 w-px bg-gray-200 sm:block"></div>

                    {/* User Profile Dropdown */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() =>
                                setDropdownOpen((previous) => !previous)
                            }
                            aria-label="Open user menu"
                            aria-expanded={dropdownOpen}
                            className="flex items-center gap-2 rounded-lg p-1.5 transition hover:bg-gray-50 sm:gap-3"
                        >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ocean-green text-sm font-bold text-white">
                                {userName.charAt(0).toUpperCase()}
                            </div>

                            <div className="hidden text-left sm:block">
                                <p className="max-w-28 truncate text-sm font-bold text-cyprus">
                                    {userName}
                                </p>
                                <p className="text-[11px] text-text-grey">
                                    Customer
                                </p>
                            </div>

                            <i
                                className={`fa-solid fa-chevron-down hidden text-xs text-text-grey transition-transform sm:block ${
                                    dropdownOpen ? "rotate-180" : ""
                                }`}
                            ></i>
                        </button>

                        {dropdownOpen && (
                            <>
                                <button
                                    type="button"
                                    aria-label="Close user menu"
                                    onClick={() => setDropdownOpen(false)}
                                    className="fixed inset-0 z-40 cursor-default"
                                ></button>

                                <div className="absolute right-0 top-full z-50 mt-3 w-48 overflow-hidden rounded-xl border border-gray-100 bg-white py-2 shadow-lg">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDropdownOpen(false);
                                            navigate("/profile");
                                        }}
                                        className="flex w-full items-center gap-3 px-4 py-3 text-sm text-cyprus hover:bg-aqua-spring"
                                    >
                                        <i className="fa-regular fa-user w-4"></i>
                                        Profile
                                    </button>

                                    <div className="mx-3 border-t border-gray-100"></div>

                                    <button
                                        type="button"
                                        onClick={handleLogout}
                                        className="flex w-full items-center gap-3 px-4 py-3 text-sm text-error hover:bg-red-50"
                                    >
                                        <i className="fa-solid fa-right-from-bracket w-4"></i>
                                        Logout
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}

export default UserDashboardNavbar;