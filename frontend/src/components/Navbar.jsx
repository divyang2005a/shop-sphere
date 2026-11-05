
import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

function Navbar() {
    const navigate = useNavigate();
    const location = useLocation();

    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    const handleSearch = (event) => {
        event.preventDefault();
        const query = searchTerm.trim();
        navigate(
            query
                ? `/products?search=${encodeURIComponent(query)}`
                : "/products"
        );
    };

    const categories = [
        { name: "For You", slug: "for-you", icon: "fa-solid fa-bag-shopping" },
        { name: "Fashion", slug: "fashion", icon: "fa-solid fa-shirt" },
        { name: "Mobiles", slug: "mobiles", icon: "fa-solid fa-mobile-screen" },
        { name: "Electronics", slug: "electronics", icon: "fa-solid fa-laptop" },
        { name: "Beauty", slug: "beauty", icon: "fa-solid fa-pump-soap" },
        { name: "Appliances", slug: "appliances", icon: "fa-solid fa-tv" },
        { name: "Gaming", slug: "Gaming", icon: "fa-solid fa-gamepad" },
        { name: "Toys & Baby", slug: "toys-baby", icon: "fa-solid fa-baby" },
        { name: "Food & Health", slug: "food-health", icon: "fa-solid fa-jar" },
        { name: "Auto Accessories", slug: "auto-accessories", icon: "fa-solid fa-car" },
        { name: "Sports", slug: "sports", icon: "fa-solid fa-baseball" },
        { name: "Furniture", slug: "furniture", icon: "fa-solid fa-couch" },
        { name: "Books", slug: "books", icon: "fa-solid fa-book" },
        { name: "2 Wheelers", slug: "2-wheelers", icon: "fa-solid fa-motorcycle" },
        { name: "Grocery", slug: "grocery", icon: "fa-solid fa-cart-shopping" },
    ];

    // Active category URL પ્રમાણે નક્કી થશે
    const activeCategory =
        location.pathname === "/"
            ? "For You"
            : categories.find(
                (category) =>
                    category.slug !== "for-you" &&
                    location.pathname === `/category/${category.slug}`
            )?.name || "";

    // Login status check
    useEffect(() => {
        const checkLoginStatus = () => {
            const loggedIn =
                localStorage.getItem("shopsphereLoggedIn") === "true";

            const savedUser = localStorage.getItem("shopsphereCurrentUser");

            if (loggedIn && savedUser) {
                try {
                    setCurrentUser(JSON.parse(savedUser));
                    setIsLoggedIn(true);
                } catch {
                    setCurrentUser(null);
                    setIsLoggedIn(false);
                }
            } else {
                setCurrentUser(null);
                setIsLoggedIn(false);
                setDropdownOpen(false);
            }
        };

        checkLoginStatus();

        window.addEventListener("storage", checkLoginStatus);
        window.addEventListener("focus", checkLoginStatus);
        window.addEventListener("authChange", checkLoginStatus);

        return () => {
            window.removeEventListener("storage", checkLoginStatus);
            window.removeEventListener("focus", checkLoginStatus);
            window.removeEventListener("authChange", checkLoginStatus);
        };
    }, []);

    // Account click
    const handleAccountClick = () => {
        setDropdownOpen(false);

        const roleId = Number(currentUser?.role_id);

        if (roleId === 1) {
            navigate("/admin");
        } else if (roleId === 2) {
            navigate("/dashboard");
        } else {
            navigate("/login");
        }
    };

    // Logout
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
            } else {
                console.log("Logout successful:", data);
            }
        } catch (error) {
            console.error("Logout API Error:", error);
        } finally {
            localStorage.removeItem("shopsphereToken");
            localStorage.removeItem("shopsphereCurrentUser");
            localStorage.removeItem("shopsphereLoggedIn");
            localStorage.removeItem("shopsphereUser");
            localStorage.removeItem("token");
            localStorage.removeItem("user");

            setDropdownOpen(false);
            setCurrentUser(null);
            setIsLoggedIn(false);

            window.dispatchEvent(new Event("authChange"));
            navigate("/", { replace: true });
        }
    };

    return (
        <header className="sticky top-0 z-50 w-full bg-white">
            {/* TOP BAR */}
            <div className="border-b border-gray-100">
                <div className="mx-auto flex h-12 w-full max-w-7xl items-center justify-between gap-3 px-3 sm:px-5">
                    <Link
                        to="/"
                        className="shrink-0 text-lg font-bold tracking-tight sm:text-xl"
                    >
                        <span className="text-ocean-green">Shop</span>
                        <span className="text-cyprus">Sphere</span>
                    </Link>

                    <div className="hidden items-center gap-2 text-xs lg:flex">
                        <span className="text-lg">
                            <i className="fa-solid fa-location-dot"></i>
                        </span>

                        <div>
                            <p className="text-[9px] text-gray-600">
                                Deliver to
                            </p>
                            <p className="font-medium text-cyprus">
                                Your address
                            </p>
                        </div>

                        <div className="h-7 border-l border-gray-400"></div>

                        <select
                            aria-label="Select language"
                            className="cursor-pointer bg-white text-sm font-medium text-black outline-none"
                        >
                            <option value="en">EN</option>
                            <option value="gu">GU</option>
                            <option value="hi">HI</option>
                            <option value="ae">AE</option>
                            <option value="es">ES</option>
                            <option value="fr">FR</option>
                            <option value="de">DE</option>
                            <option value="it">IT</option>
                            <option value="br">BR</option>
                        </select>
                    </div>

                    {/* SEARCH */}
                    <form
                        onSubmit={handleSearch}
                        role="search"
                        className="hidden min-w-0 flex-1 rounded-full bg-aqua-spring p-1 md:flex md:max-w-[340px]"
                    >
                        <input
                            type="text"
                            placeholder="What are you looking for?"
                            aria-label="Search products"
                            value={searchTerm}
                            onChange={(event) =>
                                setSearchTerm(event.target.value)
                            }
                            className="min-w-0 w-full bg-transparent px-3 text-xs text-cyprus outline-none placeholder:text-gray-400 sm:px-4"
                        />

                        <button
                            type="submit"
                            className="shrink-0 rounded-full bg-white px-4 py-2 text-xs font-medium text-cyprus shadow-sm sm:px-5"
                        >
                            Search
                        </button>
                    </form>

                    {/* WISHLIST, CART AND LOGIN / PROFILE */}
                    <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                        <Link
                            to="/wishlist"
                            aria-label="Wishlist"
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-aqua-spring text-xl text-cyprus shadow-sm transition hover:text-ocean-green sm:h-10 sm:w-10 sm:text-2xl"
                        >
                            ♡
                        </Link>

                        <Link
                            to="/cart"
                            aria-label="Cart"
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-aqua-spring text-sm text-cyprus shadow-sm transition hover:text-ocean-green sm:h-10 sm:w-10 sm:text-base"
                        >
                            <i className="fa-brands fa-opencart"></i>
                        </Link>

                        {!isLoggedIn ? (
                            <Link
                                to="/login"
                                className="rounded-full bg-aqua-spring px-3 py-2 text-xs font-medium text-cyprus shadow-sm transition hover:bg-ocean-green hover:text-white sm:px-5 sm:py-2.5"
                            >
                                Login
                            </Link>
                        ) : (
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setDropdownOpen((prev) => !prev)
                                    }
                                    aria-expanded={dropdownOpen}
                                    aria-label="Open profile menu"
                                    className="flex items-center gap-2 rounded-full bg-ocean-green px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-aqua-spring hover:text-cyprus sm:px-4 sm:py-2.5"
                                >
                                    <i className="fa-regular fa-user"></i>
                                    <span>Profile</span>
                                    <i
                                        className={`fa-solid fa-chevron-down text-[10px] transition-transform ${
                                            dropdownOpen ? "rotate-180" : ""
                                        }`}
                                    ></i>
                                </button>

                                {dropdownOpen && (
                                    <>
                                        <button
                                            type="button"
                                            aria-label="Close dropdown"
                                            onClick={() => setDropdownOpen(false)}
                                            className="fixed inset-0 z-40 cursor-default"
                                        ></button>

                                        <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-gray-100 bg-white py-2 shadow-lg">
                                            <button
                                                type="button"
                                                onClick={handleAccountClick}
                                                className="flex w-full items-center gap-3 px-4 py-3 text-sm text-cyprus transition hover:bg-aqua-spring"
                                            >
                                                <i className="fa-regular fa-user w-4"></i>
                                                <span>Account</span>
                                            </button>

                                            <div className="mx-3 border-t border-gray-100"></div>

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
                        )}
                    </div>
                </div>
            </div>

            <form
                onSubmit={handleSearch}
                role="search"
                className="flex items-center gap-1 border-b border-gray-100 bg-white px-3 py-2 md:hidden"
            >
                <input
                    type="search"
                    placeholder="What are you looking for?"
                    aria-label="Search products"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="min-w-0 flex-1 rounded-full bg-aqua-spring px-4 py-2.5 text-sm text-cyprus outline-none placeholder:text-gray-400"
                />
                <button
                    type="submit"
                    aria-label="Search"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ocean-green text-white"
                >
                    <i className="fa-solid fa-magnifying-glass" />
                </button>
            </form>

            {/* CATEGORY MENU */}
            <div className="w-full border-b border-gray-200 bg-white">
                <div
                    className="mx-auto flex w-full max-w-7xl items-center gap-3 overflow-x-auto px-3 py-2 sm:gap-5 sm:px-5 sm:py-3"
                    style={{
                        scrollbarWidth: "none",
                        msOverflowStyle: "none",
                    }}
                >
                    {categories.map((category) => {
                        const isActive = activeCategory === category.name;

                        return (
                            <Link
                                key={category.slug}
                                to={
                                    category.slug === "for-you"
                                        ? "/"
                                        : `/category/${category.slug}`
                                }
                                className="group relative flex min-w-[65px] flex-shrink-0 flex-col items-center justify-center sm:min-w-[76px]"
                            >
                                <div
                                    className={`flex h-8 w-8 items-center justify-center transition sm:h-9 sm:w-9 ${
                                        isActive
                                            ? "text-ocean-green"
                                            : "text-cyprus"
                                    }`}
                                >
                                    <i
                                        className={`${category.icon} text-[17px] sm:text-[20px]`}
                                    ></i>
                                </div>

                                <span
                                    className={`mt-1 max-w-[75px] truncate whitespace-nowrap text-center text-[10px] font-medium sm:max-w-[100px] sm:text-[12px] ${
                                        isActive
                                            ? "text-ocean-green"
                                            : "text-cyprus"
                                    }`}
                                >
                                    {category.name}
                                </span>

                                <span
                                    className={`absolute -bottom-2 h-[2px] rounded-full bg-ocean-green transition-all duration-200 ${
                                        isActive
                                            ? "w-full opacity-100"
                                            : "w-0 opacity-0"
                                    }`}
                                ></span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </header>
    );
}

export default Navbar;