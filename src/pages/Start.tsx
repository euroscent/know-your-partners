import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import TrustBanner from "@/components/TrustBanner";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

const Start = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <Hero />
      <TrustBanner />
      <CTA />
      <Footer />
    </div>
  );
};

export default Start;
