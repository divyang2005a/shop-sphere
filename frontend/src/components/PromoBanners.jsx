import React from "react";
import { Link } from "react-router-dom";

function PromoBanners() {
    const banners = [
        {
            id: 1,
            title: "New Fashion",
            subtitle: "Discover your new style",
            offer: "Up to 50% OFF",
            image:
                "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=85",
        },
        {
            id: 2,
            title: "Men's Collection",
            subtitle: "Upgrade your everyday look",
            offer: "New Arrivals",
            image:
                "https://images.unsplash.com/photo-1488161628813-04466f872be2?auto=format&fit=crop&w=1200&q=85",
        },
        {
            id: 3,
            title: "Denim Collection",
            subtitle: "Classic styles made for you",
            offer: "Shop Denim",
            image:
                "https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=1200&q=85",
        },
        {
            id: 4,
            title: "Home Appliances",
            subtitle: "Make everyday living smarter",
            offer: "Special Deals",
            image:
                "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1200&q=85",
        },
    ];

    return (
        <section className="bg-white py-8 sm:py-10 lg:py-12">

            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

                <div className="grid gap-5 md:grid-cols-2">

                    {banners.map((banner) => (
                        <div
                            key={banner.id}
                            className="group relative min-h-[230px] overflow-hidden rounded-2xl"
                        >

                            <img
                                src={banner.image}
                                alt={banner.title}
                                className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                            />

                            <div className="absolute inset-0 bg-gradient-to-r from-cyprus/90 via-cyprus/55 to-transparent"></div>

                            <div className="relative z-10 flex min-h-[230px] items-center p-6 sm:p-8">

                                <div className="max-w-[270px]">

                                    <p className="text-xs font-bold uppercase tracking-[1.5px] text-surf-crest">
                                        {banner.offer}
                                    </p>

                                    <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                                        {banner.title}
                                    </h2>

                                    <p className="mt-2 text-sm leading-5 text-white/75">
                                        {banner.subtitle}
                                    </p>

                                    <Link
                                        to="/products"
                                        className="mt-5 inline-flex items-center rounded-full bg-surf-crest px-5 py-2.5 text-xs font-bold text-cyprus transition duration-300 hover:bg-white"
                                    >
                                        Shop Now

                                        <span className="ml-2 text-sm">
                                            <i className="fa-solid fa-angle-right"></i>
                                        </span>
                                    </Link>

                                </div>

                            </div>

                        </div>
                    ))}

                </div>

            </div>

        </section>
    );
}

export default PromoBanners;