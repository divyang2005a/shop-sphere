import React from "react";
import { Link } from "react-router-dom";

function PromoSection() {
    return (
        <section className="bg-white py-8 sm:py-10 lg:py-12">

            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

                <div className="grid gap-5 lg:grid-cols-3">

                    {/* New Year - New Fashion */}

                    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">

                        {/* Card Header */}
                        <div className="p-5">

                            <p className="text-xs font-bold uppercase tracking-[1.5px] text-ocean-green">
                                New Year
                            </p>

                            <h2 className="mt-1 text-xl font-bold text-cyprus">
                                New Fashion
                            </h2>

                            <p className="mt-2 text-sm text-text-grey">
                                Discover the latest fashion styles and trends.
                            </p>

                        </div>

                        {/* Fashion Image */}
                        <div className="relative h-64 overflow-hidden sm:h-72">

                            <img
                                src="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=800&q=85"
                                alt="New fashion collection"
                                className="h-full w-full object-cover transition duration-500 hover:scale-105"
                            />

                        </div>

                        {/* Shop Now Button - Center Overlap */}
                        <div className="relative z-10 -mt-7 flex justify-center">

                            <Link
                                to="/products"
                                className="inline-flex items-center rounded-full bg-surf-crest px-8 py-4 text-sm font-bold text-cyprus shadow-md transition hover:bg-white"
                            >
                                Shop Now

                                <span className="ml-3">
                                    <i className="fa-solid fa-angle-right"></i>
                                </span>

                            </Link>

                        </div>

                    </div>

                    {/* Gaming Accessories */}

                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">

                        <div>

                            <p className="text-xs font-bold uppercase tracking-[1.5px] text-ocean-green">
                                Gaming
                            </p>

                            <h2 className="mt-1 text-xl font-bold text-cyprus">
                                Gaming Accessories
                            </h2>

                            <p className="mt-2 text-sm text-text-grey">
                                Upgrade your gaming setup with the latest accessories.
                            </p>

                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-3">

                            <Link
                                to="/products"
                                className="group overflow-hidden rounded-xl bg-aqua-spring"
                            >
                                <div className="h-28 overflow-hidden sm:h-32">
                                    <img
                                        src="https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=500&q=80"
                                        alt="Gaming setup"
                                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                    />
                                </div>

                                <p className="p-3 text-xs font-bold text-cyprus">
                                    Gaming Setup
                                </p>
                            </Link>

                            <Link
                                to="/products"
                                className="group overflow-hidden rounded-xl bg-aqua-spring"
                            >
                                <div className="h-28 overflow-hidden sm:h-32">
                                    <img
                                        src="https://images.unsplash.com/photo-1547394765-185e1e68f34e?auto=format&fit=crop&w=500&q=80"
                                        alt="Gaming keyboard"
                                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                    />
                                </div>

                                <p className="p-3 text-xs font-bold text-cyprus">
                                    Gaming Keyboard
                                </p>
                            </Link>

                            <Link
                                to="/products"
                                className="group overflow-hidden rounded-xl bg-aqua-spring"
                            >
                                <div className="h-28 overflow-hidden sm:h-32">
                                    <img
                                        src="https://images.unsplash.com/photo-1585298723682-7115561c51b7?auto=format&fit=crop&w=500&q=80"
                                        alt="Gaming controller"
                                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                    />
                                </div>

                                <p className="p-3 text-xs font-bold text-cyprus">
                                    Gaming Controller
                                </p>
                            </Link>

                            <Link
                                to="/products"
                                className="group overflow-hidden rounded-xl bg-aqua-spring"
                            >
                                <div className="h-28 overflow-hidden sm:h-32">
                                    <img
                                        src="https://images.unsplash.com/photo-1599669454699-248893623440?auto=format&fit=crop&w=500&q=80"
                                        alt="Gaming headphones"
                                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                    />
                                </div>

                                <p className="p-3 text-xs font-bold text-cyprus">
                                    Gaming Headphones
                                </p>
                            </Link>

                        </div>

                    </div>

                    {/* Electronics */}

                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">

                        <div className="relative min-h-[250px] overflow-hidden rounded-2xl bg-cyprus shadow-sm">

                            <img
                                src="https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=800&q=85"
                                alt="Electronics"
                                className="absolute inset-0 h-full w-full object-cover opacity-40"
                            />

                            <div className="relative z-10 flex h-full min-h-[250px] flex-col justify-center p-6">

                                <p className="text-xs font-bold uppercase tracking-[1.5px] text-surf-crest">
                                    Special Offer
                                </p>

                                <h2 className="mt-2 text-2xl font-bold text-white">
                                    Electronics Sale
                                </h2>

                                <p className="mt-2 max-w-xs text-sm text-white/70">
                                    Upgrade your technology with amazing deals.
                                </p>

                                <p className="mt-4 text-2xl font-bold text-surf-crest">
                                    Up to 40% OFF
                                </p>

                                <Link
                                    to="/products"
                                    className="mt-5 inline-flex w-fit items-center rounded-full bg-surf-crest px-5 py-2.5 text-xs font-bold text-cyprus transition hover:bg-white"
                                >
                                    Shop Now
                                </Link>

                            </div>

                        </div>

                        <div className="flex min-h-[160px] items-center justify-between overflow-hidden rounded-2xl bg-surf-crest p-5">

                            <div>

                                <p className="text-xs font-bold uppercase tracking-[1.5px] text-ocean-green">
                                    Hot Deal
                                </p>

                                <h3 className="mt-1 text-xl font-bold text-cyprus">
                                    Smart Products
                                </h3>

                                <p className="mt-2 text-xs text-cyprus/70">
                                    Smart gadgets for everyday life.
                                </p>

                                <Link
                                    to="/products"
                                    className="mt-4 inline-flex rounded-full bg-cyprus px-5 py-2 text-xs font-bold text-white transition hover:bg-ocean-green"
                                >
                                    Shop Now
                                </Link>

                            </div>

                            <div className="hidden h-24 w-24 overflow-hidden rounded-full bg-white sm:block">

                                <img
                                    src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=300&q=80"
                                    alt="Smart watch"
                                    className="h-full w-full object-cover"
                                />

                            </div>

                        </div>

                    </div>

                </div>

            </div>

        </section>
    );
}

export default PromoSection;