import React from "react";
import HeroSlider from "../components/HeroSlider";
import PromoSection from "../components/PromoSection";
import PromoBanners from "../components/PromoBanners";
import TrendingProducts from "../components/TrendingProducts";
import ExploreCategories from "../components/ExploreCategories";
import BestSellingProducts from "../components/BestSellingProducts";
import LimitedTimeDeal from "../components/LimitedTimeDeal";
import HappyCustomers from "../components/HappyCustomers";
import Footer from "../components/Footer";

function Home() {
    return (
        <main className="bg-white">
            <HeroSlider />
            <PromoSection />
            <PromoBanners />
            <TrendingProducts />
            <ExploreCategories />
            <BestSellingProducts />
            <LimitedTimeDeal />
            <HappyCustomers />
            <Footer />
        </main>
    );
}

export default Home;