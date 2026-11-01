import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

function LimitedTimeDeal() {
    const products = [
        {
            id: 1,
            title: "Samsung Galaxy",
            description: "Latest smartphone with powerful performance.",
            price: "$799.99",
            oldPrice: "$999.99",
            discount: "20% OFF",
            rating: "4.8",
            image:
                "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=700&q=85",
        },
        {
            id: 2,
            title: "Wireless Earbuds",
            description: "Clear sound and compact wireless design.",
            price: "$49.99",
            oldPrice: "$79.99",
            discount: "35% OFF",
            rating: "4.7",
            image:
                "https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=700&q=85",
        },
        {
            id: 3,
            title: "Winter Fashion Jacket",
            description: "Stay comfortable and stylish this winter.",
            price: "$89.99",
            oldPrice: "$129.99",
            discount: "30% OFF",
            rating: "4.6",
            image:
                "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=700&q=85",
        },
        {
            id: 4,
            title: "Modern Sneakers",
            description: "Modern sneakers for everyday style.",
            price: "$59.99",
            oldPrice: "$89.99",
            discount: "33% OFF",
            rating: "4.8",
            image:
                "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=85",
        },
    ];

    const [timeLeft, setTimeLeft] = useState(
        8 * 60 * 60 + 42 * 60 + 19
    );

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft((previous) => {
                if (previous <= 0) {
                    return 8 * 60 * 60 + 42 * 60 + 19;
                }

                return previous - 1;
            });
        }, 1000);

        return () => {
            clearInterval(timer);
        };
    }, []);

    const hours = String(
        Math.floor(timeLeft / 3600)
    ).padStart(2, "0");

    const minutes = String(
        Math.floor((timeLeft % 3600) / 60)
    ).padStart(2, "0");

    const seconds = String(
        timeLeft % 60
    ).padStart(2, "0");

    return (
        <section className="bg-aqua-spring py-10 sm:py-12 lg:py-16">

            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                    <div>
                        <p className="text-xs font-bold uppercase tracking-[2px] text-ocean-green">
                            Don't Miss Out
                        </p>

                        <h2 className="mt-1 text-2xl font-bold text-cyprus sm:text-3xl">
                            Limited-Time Deal
                        </h2>
                    </div>

                    <div className="flex items-center gap-2">

                        <span className="text-xs font-medium text-text-grey">
                            Ends in
                        </span>

                        <div className="flex items-center gap-1">

                            <span className="rounded-lg bg-cyprus px-2.5 py-2 text-sm font-bold text-white">
                                {hours}
                            </span>

                            <span className="font-bold text-cyprus">
                                :
                            </span>

                            <span className="rounded-lg bg-cyprus px-2.5 py-2 text-sm font-bold text-white">
                                {minutes}
                            </span>

                            <span className="font-bold text-cyprus">
                                :
                            </span>

                            <span className="rounded-lg bg-cyprus px-2.5 py-2 text-sm font-bold text-white">
                                {seconds}
                            </span>

                        </div>

                    </div>

                </div>

                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

                    {products.map((product) => (
                        <div
                            key={product.id}
                            className="group overflow-hidden rounded-2xl border border-ocean-green/10 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
                        >

                            <div className="relative h-52 overflow-hidden bg-gray-100">

                                <img
                                    src={product.image}
                                    alt={product.title}
                                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                />

                                <span className="absolute left-3 top-3 rounded-full bg-error px-3 py-1.5 text-[10px] font-bold text-white">
                                    {product.discount}
                                </span>

                                <button
                                    type="button"
                                    aria-label={`Add ${product.title} to wishlist`}
                                    className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg text-cyprus shadow-sm transition hover:text-ocean-green"
                                >
                                    ♡
                                </button>

                            </div>

                            <div className="p-4">

                                <h3 className="truncate text-base font-bold text-cyprus">
                                    {product.title}
                                </h3>

                                <p className="mt-1 line-clamp-2 min-h-[40px] text-xs leading-5 text-text-grey">
                                    {product.description}
                                </p>

                                <div className="mt-3 flex items-center gap-1">

                                    <span className="text-sm text-yellow-400">
                                        ★★★★★
                                    </span>

                                    <span className="text-xs text-text-grey">
                                        {product.rating}
                                    </span>

                                </div>

                                <div className="mt-3 flex items-center gap-2">

                                    <span className="text-lg font-bold text-ocean-green">
                                        {product.price}
                                    </span>

                                    <span className="text-xs text-gray-400 line-through">
                                        {product.oldPrice}
                                    </span>

                                </div>

                                <Link
                                    to="/products"
                                    className="mt-4 flex w-full items-center justify-center rounded-full bg-ocean-green px-4 py-2.5 text-xs font-bold text-white transition hover:bg-cyprus"
                                >
                                    Add to Cart
                                </Link>

                            </div>

                        </div>
                    ))}

                </div>

                <div className="mt-7 flex justify-center">

                    <Link
                        to="/products"
                        className="rounded-full border border-cyprus px-6 py-2.5 text-xs font-bold text-cyprus transition hover:bg-cyprus hover:text-white"
                    >
                        View All Deals
                    </Link>

                </div>

            </div>

        </section>
    );
}

export default LimitedTimeDeal;