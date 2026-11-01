import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function AdminNavbar({ onMenuClick }) {
    const adminName = "Admin";

    const [dropdownOpen, setDropdownOpen] = useState(false);
    const navigate = useNavigate();

    // Logout Function
    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        setDropdownOpen(false);
        navigate("/login");
    };

    return (
        <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
            <div className="flex h-15 items-center justify-between px-4 sm:px-6 lg:px-8">

                {/* Left Side */}
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">

                    {/* Mobile Hamburger */}
                    <button
                        type="button"
                        onClick={onMenuClick}
                        aria-label="Open sidebar"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-cyprus transition hover:bg-aqua-spring lg:hidden"
                    >
                        <i className="fa-solid fa-bars text-xl"></i>
                    </button>

                    {/* Mobile Logo */}
                    <Link to="/admin" className="shrink-0 lg:hidden">
                        <h1 className="text-xl font-bold text-cyprus">
                            Shop<span className="text-ocean-green">Sphere</span>
                        </h1>
                    </Link>

                    {/* Page Text */}
                    <div className="hidden sm:block">
                        <p className="text-xs text-text-grey">
                            Admin Panel
                        </p>

                        <h2 className="text-sm font-bold text-cyprus">
                            Store Management
                        </h2>
                    </div>
                </div>

                {/* Right Side */}
                <div className="flex shrink-0 items-center gap-2 sm:gap-5">

                    {/* Desktop Search */}
                    <div className="hidden md:flex">
                        <div className="flex w-64 items-center gap-3 rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5">
                            <i className="fa-solid fa-magnifying-glass text-sm text-text-grey"></i>

                            <input
                                type="text"
                                placeholder="Search..."
                                aria-label="Search"
                                className="w-full bg-transparent text-sm text-cyprus outline-none placeholder:text-text-grey"
                            />
                        </div>
                    </div>

                    {/* Mobile Search */}
                    <button
                        type="button"
                        aria-label="Search"
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 text-text-grey transition hover:bg-aqua-spring hover:text-ocean-green md:hidden"
                    >
                        <i className="fa-solid fa-magnifying-glass"></i>
                    </button>

                    {/* Divider */}
                    <div className="hidden h-8 w-px bg-gray-200 sm:block"></div>

                    {/* Admin Profile Dropdown */}
                    <div className="relative">

                        {/* Profile Button */}
                        <button
                            type="button"
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                            aria-label="Admin menu"
                            aria-expanded={dropdownOpen}
                            className="flex items-center gap-2 sm:gap-3"
                        >
                            {/* Avatar */}
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ocean-green text-sm font-bold text-white sm:h-10 sm:w-10">
                                A
                            </div>

                            {/* Admin Info */}
                            <div className="hidden text-left sm:block">
                                <p className="text-sm font-bold text-cyprus">
                                    {adminName}
                                </p>

                                <p className="text-[11px] text-text-grey">
                                    Administrator
                                </p>
                            </div>

                            {/* Dropdown Icon */}
                            <i
                                className={`fa-solid fa-chevron-down hidden text-xs text-text-grey transition-transform sm:block ${
                                    dropdownOpen ? "rotate-180" : ""
                                }`}
                            ></i>
                        </button>

                        {/* Dropdown Menu */}
                        {dropdownOpen && (
                            <>
                                {/* Outside Click Overlay */}
                                <button
                                    type="button"
                                    aria-label="Close admin menu"
                                    onClick={() => setDropdownOpen(false)}
                                    className="fixed inset-0 z-40 cursor-default"
                                ></button>

                                <div className="absolute right-0 top-full z-50 mt-3 w-48 overflow-hidden rounded-xl border border-gray-100 bg-white py-2 shadow-lg">

                                    {/* Profile */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDropdownOpen(false);
                                            navigate("/admin/profile");
                                        }}
                                        className="flex w-full items-center gap-3 px-4 py-3 text-sm text-cyprus transition hover:bg-aqua-spring"
                                    >
                                        <i className="fa-regular fa-user w-4"></i>
                                        <span>Profile</span>
                                    </button>

                                    <div className="mx-3 border-t border-gray-100"></div>

                                    {/* Logout */}
                                    <button
                                        type="button"
                                        onClick={handleLogout}
                                        className="flex w-full items-center gap-3 px-4 py-3 text-sm text-error transition hover:bg-red-50"
                                    >
                                        <i className="fa-solid fa-right-from-bracket w-4"></i>
                                        <span>Logout</span>
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

export default AdminNavbar;