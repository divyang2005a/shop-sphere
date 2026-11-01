import React from "react";
import { Link } from "react-router-dom";
import CategoryCard from "./CategoryCard";

function ExploreCategories() {
    const categories = [
        {
            id: 1,
            name: "Fashion",
            image:
                "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=500&q=80",
        },
        {
            id: 2,
            name: "Mobiles",
            image:
                "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=500&q=80",
        },
        {
            id: 3,
            name: "Electronics",
            image:
                "https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=500&q=80",
        },
        {
            id: 4,
            name: "Beauty",
            image:
                "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=500&q=80",
        },
        {
            id: 5,
            name: "Home",
            image:
                "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=500&q=80",
        },
        {
            id: 6,
            name: "Shoes",
            image:
                "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=500&q=80",
        },
        {
            id: 7,
            name: "Accessories",
            image:
                "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=500&q=80",
        },
        {
            id: 8,
            name: "Sports",
            image:
                "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=500&q=80",
        },
    ];

    return (
        <section className="bg-aqua-spring py-10 sm:py-12 lg:py-16">

            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

                <div className="mb-6 flex items-center justify-between">

                    <div>
                        <p className="text-xs font-bold uppercase tracking-[2px] text-ocean-green">
                            Shop By Category
                        </p>

                        <h2 className="mt-1 text-2xl font-bold text-cyprus sm:text-3xl">
                            Start Exploring Now
                        </h2>
                    </div>

                    <Link
                        to="/categories"
                        className="rounded-full border border-cyprus px-4 py-2 text-xs font-bold text-cyprus transition hover:bg-cyprus hover:text-white sm:px-5"
                    >
                        View All
                    </Link>

                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8">

                    {categories.map((category) => (
                        <Link
                            key={category.id}
                            to={`/category/${category.name.toLowerCase()}`}
                            className="block"
                        >
                            <CategoryCard
                                image={category.image}
                                name={category.name}
                            />
                        </Link>
                    ))}

                </div>

            </div>

        </section>
    );
}

export default ExploreCategories;