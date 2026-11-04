import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

function LimitedTimeDeal() {
const [products, setProducts] = useState([]);
const [now, setNow] = useState(Date.now());

const sliderRef = useRef(null);

// Fetch Flash Sales API
useEffect(() => {
    const controller = new AbortController();

    const fetchFlashSales = async () => {
        try {
            const response = await fetch(
                "http://192.168.1.20:5000/api/flash-sales",
                { signal: controller.signal }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Unable to load flash sales."
                );
            }

            if (!Array.isArray(result.flash_sales)) {
                throw new Error("Flash sales response is invalid.");
            }

            const serverUrl = "http://192.168.1.20:5000";

            setNow(Date.now());

            setProducts(
                result.flash_sales.map((sale) => ({
                    id: sale.product_id,
                    title: sale.product_title,
                    description:
                        sale.short_description ||
                        "Limited-time offer while stocks last.",
                    price: Number(sale.sale_price),
                    oldPrice: Number(sale.original_price),
                    discount: `${Math.round(
                        Number(sale.discount_percentage)
                    )}% OFF`,
                    image: sale.image
                        ? /^https?:\/\//i.test(sale.image)
                            ? sale.image
                            : `${serverUrl}/${sale.image.replace(/^\/+/, "")}`
                        : "https://placehold.co/500x500?text=Product",
                    endTime: new Date(sale.end_time).getTime(),
                }))
            );
        } catch (error) {
            if (error.name !== "AbortError") {
                console.error("Failed to load flash sales:", error);
            }
        }
    };

    fetchFlashSales();

    const refreshTimer = setInterval(fetchFlashSales, 30000);

    return () => {
        controller.abort();
        clearInterval(refreshTimer);
    };
}, []);

// Countdown Timer
useEffect(() => {
    if (!products.length) return;

    const timer = setInterval(() => {
        setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
}, [products.length]);

// Slider Previous
const handlePrevious = () => {
    if (sliderRef.current) {
        sliderRef.current.scrollBy({
            left: -sliderRef.current.clientWidth,
            behavior: "smooth",
        });
    }
};

// Slider Next
const handleNext = () => {
    if (sliderRef.current) {
        sliderRef.current.scrollBy({
            left: sliderRef.current.clientWidth,
            behavior: "smooth",
        });
    }
};

if (!products.length) return null;

// Countdown Calculation
const validEndTimes = products
    .map((product) => product.endTime)
    .filter((time) => Number.isFinite(time));

const saleEnd = validEndTimes.length
    ? Math.min(...validEndTimes)
    : now;

const timeLeft = Math.max(0, Math.floor((saleEnd - now) / 1000));

const hours = String(Math.floor(timeLeft / 3600)).padStart(2, "0");
const minutes = String(Math.floor((timeLeft % 3600) / 60)).padStart(2, "0");
const seconds = String(timeLeft % 60).padStart(2, "0");

return (
    <section className="bg-aqua-spring py-10 sm:py-12 lg:py-16">

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                <div>
                    <p className="text-xs font-bold uppercase tracking-[2px] text-ocean-green">
                        Don't Miss Out
                    </p>

                    <h2 className="mt-1 text-2xl font-bold text-cyprus sm:text-3xl">
                        Limited-Time Deal
                    </h2>
                </div>

                {/* Countdown + Slider Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-4 sm:justify-end">

                    <div className="flex items-center gap-2">

                        <span className="text-xs font-medium text-text-grey">
                            Ends in
                        </span>

                        <div className="flex items-center gap-1">

                            <span className="rounded-lg bg-cyprus px-2.5 py-2 text-sm font-bold text-white">
                                {hours}
                            </span>

                            <span className="font-bold text-cyprus">:</span>

                            <span className="rounded-lg bg-cyprus px-2.5 py-2 text-sm font-bold text-white">
                                {minutes}
                            </span>

                            <span className="font-bold text-cyprus">:</span>

                            <span className="rounded-lg bg-cyprus px-2.5 py-2 text-sm font-bold text-white">
                                {seconds}
                            </span>

                        </div>
                    </div>

                    {/* Slider Navigation */}
                    <div className="flex items-center gap-2">

                        <button
                            type="button"
                            onClick={handlePrevious}
                            aria-label="Previous products"
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-cyprus bg-white text-cyprus transition hover:bg-cyprus hover:text-white"
                        >
                            <i className="fa-solid fa-chevron-left text-xs"></i>
                        </button>

                        <button
                            type="button"
                            onClick={handleNext}
                            aria-label="Next products"
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-cyprus bg-white text-cyprus transition hover:bg-cyprus hover:text-white"
                        >
                            <i className="fa-solid fa-chevron-right text-xs"></i>
                        </button>

                    </div>

                </div>

            </div>

            {/* Product Slider */}
            <div
                ref={sliderRef}
                className="flex gap-5 overflow-x-auto scroll-smooth pb-3 snap-x snap-mandatory scrollbar-hide"
            >

                {products.map((product) => (
                    <div
                        key={product.id}
                        className="w-[85%] flex-shrink-0 snap-start sm:w-[calc(50%-10px)] lg:w-[calc(25%-15px)]"
                    >

                        <div className="group h-full overflow-hidden rounded-2xl border border-ocean-green/10 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">

                            {/* Product Image */}
                            <div className="relative h-52 overflow-hidden bg-gray-100">

                                <img
                                    src={product.image}
                                    alt={product.title}
                                    onError={(e) => {
                                        e.currentTarget.src =
                                            "https://placehold.co/500x500?text=Product";
                                    }}
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

                            {/* Product Details */}
                            <div className="p-4">

                                <h3 className="truncate text-base font-bold text-cyprus">
                                    {product.title}
                                </h3>

                                <p className="mt-1 line-clamp-2 min-h-[40px] text-xs leading-5 text-text-grey">
                                    {product.description}
                                </p>

                                <div className="mt-3 flex items-center gap-2">

                                    <span className="text-lg font-bold text-ocean-green">
                                        ₹{product.price.toLocaleString("en-IN")}
                                    </span>

                                    <span className="text-xs text-gray-400 line-through">
                                        ₹{product.oldPrice.toLocaleString("en-IN")}
                                    </span>

                                </div>

                                <Link
                                    to={`/product/${product.id}`}
                                    className="mt-4 flex w-full items-center justify-center rounded-full bg-ocean-green px-4 py-2.5 text-xs font-bold text-white transition hover:bg-cyprus"
                                >
                                    View Deal
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

export default LimitedTimeDeal;