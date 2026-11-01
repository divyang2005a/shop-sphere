import React from "react";

function CategoryCard({ image, name }) {
    return (
        <div className="group cursor-pointer rounded-xl border border-gray-200 bg-white p-3 text-center transition hover:-translate-y-1 hover:shadow-md">

            <div className="flex h-28 items-center justify-center overflow-hidden rounded-lg bg-aqua-spring">
                <img
                    src={image}
                    alt={name}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
            </div>

            <p className="mt-3 text-sm font-bold text-cyprus">
                {name}
            </p>

        </div>
    );
}

export default CategoryCard;