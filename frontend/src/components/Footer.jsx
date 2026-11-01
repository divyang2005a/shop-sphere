import React from "react";
import { Link } from "react-router-dom";

function Footer() {
    return (
        <footer className="bg-aqua-spring text-cyprus">

            <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-16">

                <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">

                    <div>

                        <Link
                            to="/"
                            className="text-2xl font-bold tracking-tight"
                        >
                            <span className="text-ocean-green">
                                Shop
                            </span>

                            <span className="text-cyprus">
                                Sphere
                            </span>
                        </Link>

                        <p className="mt-4 max-w-xs text-sm leading-6 text-text-grey">
                            Your one-stop destination for fashion, electronics,
                            lifestyle products and amazing deals.
                        </p>

                        <div className="mt-5 flex items-center gap-3">

                            <a
                                href="#"
                                aria-label="Facebook"
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-cyprus shadow-sm transition hover:bg-ocean-green hover:text-white"
                            >
                                <i className="fa-brands fa-facebook-f"></i>
                            </a>

                            <a
                                href="#"
                                aria-label="Instagram"
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-cyprus shadow-sm transition hover:bg-ocean-green hover:text-white"
                            >
                                <i className="fa-brands fa-instagram"></i>
                            </a>

                            <a
                                href="#"
                                aria-label="Twitter"
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-cyprus shadow-sm transition hover:bg-ocean-green hover:text-white"
                            >
                                <i className="fa-brands fa-x-twitter"></i>
                            </a>

                            <a
                                href="#"
                                aria-label="YouTube"
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-cyprus shadow-sm transition hover:bg-ocean-green hover:text-white"
                            >
                                <i className="fa-brands fa-youtube"></i>
                            </a>

                        </div>

                    </div>

                    <div>

                        <h3 className="text-base font-bold">
                            Customer Support
                        </h3>

                        <ul className="mt-4 space-y-3 text-sm text-text-grey">

                            <li>
                                <Link
                                    to="/contact"
                                    className="transition hover:text-ocean-green"
                                >
                                    Contact Us
                                </Link>
                            </li>

                            <li>
                                <Link
                                    to="/orders"
                                    className="transition hover:text-ocean-green"
                                >
                                    Track Order
                                </Link>
                            </li>

                            <li>
                                <Link
                                    to="/returns"
                                    className="transition hover:text-ocean-green"
                                >
                                    Returns & Refunds
                                </Link>
                            </li>

                            <li>
                                <Link
                                    to="/shipping"
                                    className="transition hover:text-ocean-green"
                                >
                                    Shipping Information
                                </Link>
                            </li>

                            <li>
                                <Link
                                    to="/faq"
                                    className="transition hover:text-ocean-green"
                                >
                                    FAQs
                                </Link>
                            </li>

                        </ul>

                    </div>

                    <div>

                        <h3 className="text-base font-bold">
                            Explore
                        </h3>

                        <ul className="mt-4 space-y-3 text-sm text-text-grey">

                            <li>
                                <Link
                                    to="/products"
                                    className="transition hover:text-ocean-green"
                                >
                                    All Products
                                </Link>
                            </li>

                            <li>
                                <Link
                                    to="/categories"
                                    className="transition hover:text-ocean-green"
                                >
                                    Categories
                                </Link>
                            </li>

                            <li>
                                <Link
                                    to="/deals"
                                    className="transition hover:text-ocean-green"
                                >
                                    Today's Deals
                                </Link>
                            </li>

                            <li>
                                <Link
                                    to="/new-arrivals"
                                    className="transition hover:text-ocean-green"
                                >
                                    New Arrivals
                                </Link>
                            </li>

                            <li>
                                <Link
                                    to="/best-sellers"
                                    className="transition hover:text-ocean-green"
                                >
                                    Best Sellers
                                </Link>
                            </li>

                        </ul>

                    </div>

                    <div>

                        <h3 className="text-base font-bold">
                            Legal
                        </h3>

                        <ul className="mt-4 space-y-3 text-sm text-text-grey">

                            <li>
                                <Link
                                    to="/privacy-policy"
                                    className="transition hover:text-ocean-green"
                                >
                                    Privacy Policy
                                </Link>
                            </li>

                            <li>
                                <Link
                                    to="/terms"
                                    className="transition hover:text-ocean-green"
                                >
                                    Terms & Conditions
                                </Link>
                            </li>

                            <li>
                                <Link
                                    to="/cookie-policy"
                                    className="transition hover:text-ocean-green"
                                >
                                    Cookie Policy
                                </Link>
                            </li>

                            <li>
                                <Link
                                    to="/about"
                                    className="transition hover:text-ocean-green"
                                >
                                    About Us
                                </Link>
                            </li>

                            <li>
                                <Link
                                    to="/contact"
                                    className="transition hover:text-ocean-green"
                                >
                                    Contact
                                </Link>
                            </li>

                        </ul>

                    </div>

                </div>

                <div className="mt-10 border-t border-ocean-green/20 pt-8 sm:mt-12 sm:pt-10">

                    <div className="mx-auto max-w-2xl text-center">

                        <h2 className="text-2xl font-bold text-cyprus sm:text-3xl">
                            Stay Updated
                        </h2>

                        <p className="mt-2 text-sm text-text-grey">
                            Subscribe to our newsletter and get the latest
                            deals, new arrivals and exclusive offers.
                        </p>

                        <div className="mx-auto mt-5 flex max-w-lg flex-col gap-2 sm:flex-row">

                            <input
                                type="email"
                                placeholder="Enter your email address"
                                className="min-w-0 flex-1 rounded-full border border-ocean-green/20 bg-white px-5 py-3 text-sm text-cyprus outline-none transition focus:border-ocean-green"
                            />

                            <button
                                type="button"
                                className="rounded-full bg-ocean-green px-6 py-3 text-sm font-bold text-white transition hover:bg-cyprus"
                            >
                                Subscribe
                            </button>

                        </div>

                    </div>

                </div>

            </div>

            <div className="border-t border-ocean-green/20 bg-white/50">

                <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-4 text-center sm:px-6 md:flex-row md:text-left lg:px-8">

                    <p className="text-xs text-text-grey">
                        © 2026 ShopSphere. All rights reserved.
                    </p>

                    <div className="flex items-center gap-2 text-xs font-medium text-cyprus">
                        <i className="fa-solid fa-shield-halved text-ocean-green"></i>

                        <span>
                            Trusted & Secure Shopping
                        </span>
                    </div>

                </div>

            </div>

        </footer>
    );
}

export default Footer;