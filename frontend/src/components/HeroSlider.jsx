import React, { useEffect, useState } from "react";

const API_URL = "http://localhost:5000/api";
const SERVER_URL = API_URL.replace(/\/api$/, "");

const DEFAULT_SLIDES = [
    {
        id: 1,
        title: "Discover the Latest Deals",
        highlight: "Up to 50% Off!",
        description:
            "Explore amazing products, exclusive offers and exciting deals all in one place.",
        button: "Shop Now",
        image:
            "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=85",
        link: "/products",
    },
    {
        id: 2,
        title: "Fresh Styles for Every Day",
        highlight: "New Collection",
        description:
            "Discover the latest fashion, accessories and trending styles for everyone.",
        button: "Explore Collection",
        image:
            "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1600&q=85",
        link: "/products",
    },
    {
        id: 3,
        title: "Upgrade Your Lifestyle",
        highlight: "Special Offers",
        description:
            "Find electronics, home essentials and smart products at amazing prices.",
        button: "View Deals",
        image:
            "https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=1600&q=85",
        link: "/products",
    },
];

function HeroSlider() {
    const [slides, setSlides] = useState(DEFAULT_SLIDES);
    const [currentSlide, setCurrentSlide] = useState(0);

    useEffect(() => {
        const fetchBanners = async () => {
            try {
                const response = await fetch(`${API_URL}/banners`);
                const result = await response.json();

                if (!response.ok || result.success === false) {
                    throw new Error(
                        result.message || "Unable to load hero banners."
                    );
                }

                if (!Array.isArray(result.banners)) {
                    throw new Error("Hero banner response is invalid.");
                }

                const activeSlides = result.banners
                    .filter(
                        (banner) =>
                            typeof banner.title === "string" &&
                            typeof banner.image === "string" &&
                            banner.title.trim() &&
                            banner.image.trim()
                    )
                    .map((banner) => {
                        const image = banner.image.trim();
                        const link =
                            typeof banner.link === "string"
                                ? banner.link.trim()
                                : "";
                        const safeLink =
                            /^https?:\/\//i.test(link) ||
                            (link.startsWith("/") && !link.startsWith("//"))
                                ? link
                                : "/products";

                        return {
                            id: banner.id,
                            title: banner.title.trim(),
                            highlight: "Featured Offer",
                            description:
                                "Discover great products and special offers at ShopSphere.",
                            button: "Shop Now",
                            image: /^https?:\/\//i.test(image)
                                ? image
                                : `${SERVER_URL}/${image.replace(/^\/+/, "")}`,
                            link: safeLink,
                        };
                    });

                if (activeSlides.length > 0) {
                    setSlides(activeSlides);
                    setCurrentSlide(0);
                }
            } catch (error) {
                console.error("Failed to load hero banners:", error);
            }
        };

        fetchBanners();
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentSlide((previous) =>
                previous === slides.length - 1 ? 0 : previous + 1
            );
        }, 5000);

        return () => clearInterval(timer);
    }, [slides.length]);

    const nextSlide = () => {
        setCurrentSlide((previous) =>
            previous === slides.length - 1 ? 0 : previous + 1
        );
    };

    const previousSlide = () => {
        setCurrentSlide((previous) =>
            previous === 0 ? slides.length - 1 : previous - 1
        );
    };

    const selectSlide = (index) => {
        setCurrentSlide(index);
    };

    const slide = slides[currentSlide];

    return (
        <section className="w-full bg-aqua-spring">
            <div className="relative mx-auto w-full max-w-[1440px] overflow-hidden">
                <div className="relative h-[340px] w-full overflow-hidden min-[480px]:h-[360px] sm:h-[380px] md:h-[420px] lg:h-[460px]">

                    {/* Background Image */}
                    <img
                        key={slide.id}
                        src={slide.image}
                        alt={slide.title}
                        className="absolute inset-0 h-full w-full object-cover"
                    />

                    {/* Image Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-r from-cyprus via-cyprus/80 to-cyprus/30"></div>

                    {/* Slide Content */}
                    <div className="relative z-10 flex h-full items-center">
                        <div className="w-full px-10 min-[480px]:px-12 sm:px-14 md:px-16 lg:px-20">
                            <div className="max-w-[600px]">

                                <p className="mb-2 text-[9px] font-bold uppercase tracking-[2px] text-surf-crest min-[480px]:text-[10px] sm:text-xs sm:tracking-[3px]">
                                    ShopSphere Exclusive
                                </p>

                                <h1 className="text-2xl font-bold leading-tight text-white min-[400px]:text-3xl sm:text-4xl md:text-5xl lg:text-[52px]">
                                    {slide.title}
                                </h1>

                                <h2 className="mt-2 text-xl font-bold leading-tight text-surf-crest min-[400px]:text-2xl sm:text-3xl md:text-4xl">
                                    {slide.highlight}
                                </h2>

                                <p className="mt-3 max-w-[500px] text-xs leading-5 text-white/85 min-[400px]:text-sm min-[400px]:leading-6 sm:mt-4 sm:text-base">
                                    {slide.description}
                                </p>

                                <a
                                    href={slide.link}
                                    className="mt-5 inline-flex max-w-full items-center justify-center gap-2 rounded-full bg-surf-crest px-4 py-3 text-xs font-bold text-cyprus transition duration-300 hover:bg-white hover:shadow-lg min-[400px]:px-5 min-[400px]:text-sm sm:mt-6 sm:px-7"
                                >
                                    <span className="truncate">
                                        {slide.button}
                                    </span>

                                    <i className="fa-solid fa-angle-right shrink-0"></i>
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Previous Button */}
                    <button
                        type="button"
                        onClick={previousSlide}
                        aria-label="Previous slide"
                        className="absolute left-1 top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-base text-cyprus shadow-md transition duration-300 hover:bg-surf-crest min-[400px]:left-2 min-[400px]:h-8 min-[400px]:w-8 sm:left-5 sm:h-11 sm:w-11 sm:text-lg"
                    >
                        <i className="fa-solid fa-angle-left"></i>
                    </button>

                    {/* Next Button */}
                    <button
                        type="button"
                        onClick={nextSlide}
                        aria-label="Next slide"
                        className="absolute right-1 top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-base text-cyprus shadow-md transition duration-300 hover:bg-surf-crest min-[400px]:right-2 min-[400px]:h-8 min-[400px]:w-8 sm:right-5 sm:h-11 sm:w-11 sm:text-lg"
                    >
                        <i className="fa-solid fa-angle-right"></i>
                    </button>

                    {/* Slide Indicators */}
                    <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 sm:bottom-5">
                        {slides.map((item, index) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => selectSlide(index)}
                                aria-label={`Go to slide ${index + 1}`}
                                aria-current={
                                    currentSlide === index ? "true" : undefined
                                }
                                className={`h-2 rounded-full transition-all duration-300 ${
                                    currentSlide === index
                                        ? "w-7 bg-surf-crest sm:w-8"
                                        : "w-2 bg-white/70 hover:bg-white"
                                }`}
                            ></button>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}

export default HeroSlider;