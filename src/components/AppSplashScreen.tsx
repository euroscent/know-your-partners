import { useState, useEffect } from "react";
import { isStandalone } from "@/lib/pwa";
import euroscentLogoAsset from "@/assets/euroscent-logo.png";
import { cn } from "@/lib/utils";

export const AppSplashScreen = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    // Only show if we are in standalone mode (PWA)
    if (!isStandalone()) return;

    // Check if we've already shown it in this session
    const hasShown = sessionStorage.getItem("pwa_splash_shown_v3");
    if (hasShown) return;
    
    // Check if the user is actually on the dashboard (start URL) to avoid showing it on every navigation
    const isInitialLoad = window.location.pathname === "/dashboard" || window.location.pathname === "/";
    if (!isInitialLoad) return;

    setIsRendered(true);
    // Tiny delay to ensure transition works
    requestAnimationFrame(() => setIsVisible(true));

    const timer = setTimeout(() => {
      setIsVisible(false);
      sessionStorage.setItem("pwa_splash_shown_v3", "true");
      // Clean up from DOM after fade out
      setTimeout(() => setIsRendered(false), 500);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  if (!isRendered) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#000000] transition-opacity duration-700 ease-in-out",
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
    >
      <div className="relative h-32 w-32 flex items-center justify-center mb-8">
        <img
          src={euroscentLogoAsset}
          alt="EuroScent Logo"
          className="h-full w-full rounded-full object-cover animate-pulse"
        />
        {/* Glow effect to hide any remaining background edges during rotation */}
        <div className="absolute inset-0 bg-black/20 blur-xl -z-10 rounded-full" />
      </div>
      <div className="absolute bottom-12 text-center">
        <p className="text-white text-lg font-medium tracking-wider">EuroScent</p>
      </div>
    </div>
  );
};
