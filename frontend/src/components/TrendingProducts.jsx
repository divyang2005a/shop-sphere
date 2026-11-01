import React from "react";
import { Link } from "react-router-dom";
import ProductCard from "./ProductCard";

function TrendingProducts() {
    const products = [
        {
            id: 1,
            title: "Radiant Glow Serum",
            description: "Gentle yet effective skincare for everyday use.",
            price: "29.99",
            oldPrice: "39.99",
            discount: 20,
            rating: 4.8,
            image:
                "https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?auto=format&fit=crop&w=600&q=80",
        },
        {
            id: 2,
            title: "Modern Minimalist Vase",
            description: "Beautiful home decoration for modern interiors.",
            price: "40.99",
            oldPrice: "49.99",
            discount: 18,
            rating: 4.7,
            image:
                "https://images.unsplash.com/photo-1612196808214-b8e1d6145a8c?auto=format&fit=crop&w=600&q=80",
        },
        {
            id: 3,
            title: "FitPro Smartwatch",
            description: "Track your fitness and daily activities.",
            price: "119.99",
            oldPrice: "149.99",
            discount: 20,
            rating: 4.9,
            image:
                "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80",
        },
    ];

    return (
        <section className="bg-white py-10 sm:py-12 lg:py-16">

            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

                <div className="mb-6 flex items-center justify-between">

                    <div>

                        <p className="text-xs font-bold uppercase tracking-[2px] text-ocean-green">
                            Trending Now
                        </p>

                        <h2 className="mt-1 text-2xl font-bold text-cyprus sm:text-3xl">
                            Trending Product
                        </h2>

                    </div>

                    <Link
                        to="/products"
                        className="rounded-full border border-cyprus px-4 py-2 text-xs font-bold text-cyprus transition hover:bg-cyprus hover:text-white sm:px-5"
                    >
                        View All
                    </Link>

                </div>

                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

                    {products.map((product) => (
                        <ProductCard
                            key={product.id}
                            product={product}
                        />
                    ))}

                    <div className="group relative min-h-[450px] overflow-hidden rounded-xl bg-cyprus">

                        <img
                            src="https://images.unsplash.com/photo-1488161628813-04466f872be2?auto=format&fit=crop&w=700&q=85"
                            alt="Trend collection for men"
                            className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                        />

                        <div className="absolute inset-0 bg-gradient-to-t from-cyprus via-cyprus/50 to-transparent"></div>

                        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">

                            <p className="text-xs font-bold uppercase tracking-[2px] text-surf-crest">
                                New Collection
                            </p>

                            <h3 className="mt-2 text-2xl font-bold text-white">
                                Trend Collection
                                <br />
                                For Men
                            </h3>

                            <p className="mt-2 text-sm leading-5 text-white/70">
                                Discover the latest styles designed for
                                modern everyday looks.
                            </p>

                            <Link
                                to="/products"
                                className="mt-5 inline-flex items-center rounded-full bg-surf-crest px-5 py-2.5 text-xs font-bold text-cyprus transition hover:bg-white"
                            >
                                Explore Now

                                <span className="ml-2 text-sm">
                                    →
                                </span>
                            </Link>

                        </div>

                    </div>

                </div>

            </div>

        </section>
    );
}

export default TrendingProducts;