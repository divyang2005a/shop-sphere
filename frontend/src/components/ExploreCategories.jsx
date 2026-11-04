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
            name: "Gaming",
            image:
                "data:image/webp;base64,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",
        },
        {
            id: 7,
            name: "Books",
            image:
                "https://m.media-amazon.com/images/I/41UkF4RfNlL._SY445_SX342_FMwebp_.jpg",
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