import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import jellyfishWebm from "@/assets/jellyfish-hero.webm.asset.json";
import jellyfishMp4 from "@/assets/jellyfish-hero.mp4.asset.json";

const START_TIME = 7;
const FADE = 1.2; // seconds of fade in/out

const Hero = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const seekStart = () => {
      try { v.currentTime = START_TIME; } catch { /* noop */ }
    };

    const onLoaded = () => {
      seekStart();
      v.play().catch(() => { /* autoplay guard */ });
    };

    const onTimeUpdate = () => {
      const dur = v.duration || 0;
      const t = v.currentTime;
      // Loop back to START_TIME before natural end (fade-out margin)
      if (dur && t >= dur - 0.15) {
        seekStart();
        return;
      }
      // Fade in from START_TIME, fade out toward end
      const sinceStart = t - START_TIME;
      const untilEnd = dur ? dur - t : FADE;
      const fadeIn = Math.max(0, Math.min(1, sinceStart / FADE));
      const fadeOut = Math.max(0, Math.min(1, untilEnd / FADE));
      setOpacity(Math.min(fadeIn, fadeOut));
    };

    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("timeupdate", onTimeUpdate);
    if (v.readyState >= 1) onLoaded();

    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, []);

  return (
    <section className="relative overflow-hidden bg-background pt-32 pb-20 lg:pt-52 lg:pb-32">
      {/* Technical grid overlay */}
      <div className="absolute inset-0 epp-grid-bg opacity-[0.08] pointer-events-none" />

      {/* Blue radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl aspect-square bg-primary/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="max-w-3xl">
          {/* Status pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-semibold tracking-wider uppercase mb-8 font-display">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            Next-Generation KYC Infrastructure
          </div>

          {/* Headline — Slogan-first */}
          <h1 className="font-display text-5xl lg:text-7xl font-extrabold leading-[1.05] mb-8 tracking-tight text-foreground">
            Engineering.
            <br />
            <span className="text-muted-foreground">Partnership.</span>
            <br />
            Possibilities.
          </h1>

          <p className="text-lg lg:text-xl text-muted-foreground mb-10 leading-relaxed max-w-2xl">
            <span className="text-foreground font-semibold">EPP</span> liefert präzisions-engineered
            B2B-KYC- und Payment-Infrastruktur für die technischen Anforderungen moderner Finanzdienstleister.
            Wir verbinden rigoroses Engineering mit nahtlosen Merchant-Prozessen.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <Button size="lg" asChild className="rounded-full font-bold text-base h-14 px-8 shadow-[var(--shadow-button)]">
              <a href="/services">
                Solutions erkunden
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="rounded-full font-bold text-base h-14 px-8 border-border hover:border-muted-foreground bg-transparent"
            >
              <a href="/contact">Demo buchen</a>
            </Button>
          </div>

          {/* Trust bar */}
          <div className="mt-16 flex flex-wrap items-center gap-x-8 gap-y-6 border-t border-border pt-8">
            <div>
              <div className="font-display text-2xl font-bold text-foreground">99.9%</div>
              <div className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Uptime SLA</div>
            </div>
            <div className="hidden sm:block w-px h-8 bg-border" />
            <div>
              <div className="font-display text-2xl font-bold text-foreground">ISO 27001</div>
              <div className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Certified Security</div>
            </div>
            <div className="hidden sm:block w-px h-8 bg-border" />
            <div>
              <div className="font-display text-2xl font-bold text-foreground">24/7</div>
              <div className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Expert Support</div>
            </div>
          </div>
        </div>
      </div>

      {/* Realistic bioluminescent jellyfish — video loop */}
      <div className="hidden lg:block absolute top-1/2 right-4 -translate-y-1/2 w-[38%] max-w-[520px] pointer-events-none">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          controls={false}
          disablePictureInPicture
          disableRemotePlayback
          controlsList="nodownload nofullscreen noremoteplayback noplaybackrate"
          preload="auto"
          tabIndex={-1}
          aria-hidden="true"
          style={{
            opacity,
            transition: "opacity 120ms linear",
            filter:
              "contrast(1.35) saturate(1.25) brightness(1.08) drop-shadow(0 0 80px hsl(217 91% 60% / 0.45))",
          }}
          className="w-full h-auto mix-blend-lighten pointer-events-none select-none [&::-webkit-media-controls]:!hidden [&::-webkit-media-controls-panel]:!hidden [&::-webkit-media-controls-play-button]:!hidden [&::-webkit-media-controls-start-playback-button]:!hidden"
        >

          <source src={jellyfishWebm.url} type="video/webm" />
          <source src={jellyfishMp4.url} type="video/mp4" />
        </video>

      </div>
    </section>
  );
};

export default Hero;
