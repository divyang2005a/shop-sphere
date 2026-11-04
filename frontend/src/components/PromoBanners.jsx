import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const API_BASE_URL = "http://192.168.1.20:5000/api";
const API_URL = `${API_BASE_URL}/banners?placement=promo`;
const SERVER_URL = API_BASE_URL.replace(/\/api$/, "");

function PromoBanners() {
    const [banners, setBanners] = useState([]);

    useEffect(() => {
        const controller = new AbortController();

        const fetchBanners = async () => {
            try {
                const response = await fetch(API_URL, {
                    signal: controller.signal,
                });
                const result = await response.json();

                if (!response.ok || result.success === false) {
                    throw new Error(
                        result.message || "Unable to load promotional banners."
                    );
                }

                if (!Array.isArray(result.banners)) {
                    throw new Error("Promotional banner response is invalid.");
                }

                const activeBanners = result.banners
                    .filter(
                        (banner) =>
                            typeof banner.title === "string" &&
                            banner.title.trim() &&
                            typeof banner.image === "string" &&
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
                            ...banner,
                            image: /^https?:\/\//i.test(image)
                                ? image
                                : `${SERVER_URL}/${image.replace(/^\/+/, "")}`,
                            link: safeLink,
                        };
                    });

                if (!controller.signal.aborted) {
                    setBanners(activeBanners);
                }
            } catch (error) {
                if (error.name !== "AbortError") {
                    console.error(
                        "Failed to load promotional banners:",
                        error
                    );
                }
            }
        };

        fetchBanners();

        return () => controller.abort();
    }, []);

    if (banners.length === 0) return null;

    return (
        <section className="bg-white py-8 sm:py-10 lg:py-12">

            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

                <div className="grid gap-5 md:grid-cols-2">

                    {banners.map((banner) => {
                        const isExternalLink = /^https?:\/\//i.test(banner.link);
                        const BannerLink = isExternalLink ? "a" : Link;
                        const linkProps = isExternalLink
                            ? {
                                  href: banner.link,
                                  target: "_blank",
                                  rel: "noopener noreferrer",
                              }
                            : { to: banner.link };

                        return (
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
                                        Featured Offer
                                    </p>

                                    <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                                        {banner.title}
                                    </h2>

                                    <p className="mt-2 text-sm leading-5 text-white/75">
                                        Discover featured products and special offers.
                                    </p>

                                    <BannerLink
                                        {...linkProps}
                                        className="mt-5 inline-flex items-center rounded-full bg-surf-crest px-5 py-2.5 text-xs font-bold text-cyprus transition duration-300 hover:bg-white"
                                    >
                                        Shop Now

                                        <span className="ml-2 text-sm">
                                            <i className="fa-solid fa-angle-right"></i>
                                        </span>
                                    </BannerLink>

                                </div>

                            </div>

                        </div>
                        );
                    })}

                </div>

            </div>

        </section>
    );
}

export default PromoBanners;