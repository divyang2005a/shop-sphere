import React from "react";
import { Link } from "react-router-dom";

function BestSellingProducts() {
    const products = [
        {
            id: 1,
            title: "Wireless Headphones",
            description: "Premium sound with a comfortable design.",
            price: "$89.99",
            oldPrice: "$119.99",
            discount: "25% OFF",
            image:
                "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85",
        },
        {
            id: 2,
            title: "Smart Laptop",
            description: "Powerful performance for work and entertainment.",
            price: "$799.99",
            oldPrice: "$899.99",
            discount: "11% OFF",
            image:
                "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=85",
        },
        {
            id: 3,
            title: "Modern Smartphone",
            description: "Powerful features with a stylish modern design.",
            price: "$499.99",
            oldPrice: "$599.99",
            discount: "17% OFF",
            image:
                "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=85",
        },
        {
            id: 4,
            title: "Gaming Accessories",
            description: "Upgrade your gaming experience.",
            price: "$149.99",
            oldPrice: "$199.99",
            discount: "25% OFF",
            image:
                "https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=900&q=85",
        },
    ];

    return (
        <section className="bg-white py-10 sm:py-12 lg:py-16">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[2px] text-ocean-green">
                            Customer Favorites
                        </p>

                        <h2 className="mt-1 text-2xl font-bold text-cyprus sm:text-3xl">
                            Best Selling Product
                        </h2>
                    </div>

                    <Link
                        to="/products"
                        className="rounded-full border border-cyprus px-4 py-2 text-xs font-bold text-cyprus transition hover:bg-cyprus hover:text-white sm:px-5"
                    >
                        View All
                    </Link>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                    {products.map((product, index) => (
                        <div
                            key={product.id}
                            className={`group relative overflow-hidden rounded-2xl bg-cyprus ${
                                index === 0
                                    ? "min-h-[360px]"
                                    : "min-h-[300px]"
                            }`}
                        >
                            <img
                                src={product.image}
                                alt={product.title}
                                className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                            />

                            <div className="absolute inset-0 bg-gradient-to-r from-cyprus/95 via-cyprus/60 to-transparent"></div>

                            <div className="absolute right-4 top-4 rounded-full bg-error px-3 py-1.5 text-[10px] font-bold text-white">
                                {product.discount}
                            </div>

                            <div className="relative z-10 flex min-h-[300px] max-w-[430px] flex-col justify-center p-6 sm:p-8">
                                <p className="text-xs font-bold uppercase tracking-[1.5px] text-surf-crest">
                                    Best Seller
                                </p>

                                <h3 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                                    {product.title}
                                </h3>

                                <p className="mt-2 max-w-sm text-sm leading-6 text-white/70">
                                    {product.description}
                                </p>

                                <div className="mt-4 flex items-center gap-3">
                                    <span className="text-xl font-bold text-surf-crest">
                                        {product.price}
                                    </span>

                                    <span className="text-sm text-white/50 line-through">
                                        {product.oldPrice}
                                    </span>
                                </div>

                                <Link
                                    to="/products"
                                    className="mt-5 inline-flex w-fit items-center rounded-full bg-surf-crest px-6 py-3 text-xs font-bold text-cyprus transition duration-300 hover:bg-white"
                                >
                                    Shop Now
                                    <span className="ml-2 text-sm">
                                        →
                                    </span>
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

export default BestSellingProducts;