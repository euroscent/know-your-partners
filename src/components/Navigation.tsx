import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import eppLogoAsset from "@/assets/epp-logo.png.asset.json";

const EppMark = () => (
  <a href="/start" className="flex items-center gap-3 group">
    <img
      src={eppLogoAsset.url}
      alt="EPP Logo"
      className="w-10 h-10 object-contain transition-transform duration-500 group-hover:rotate-45"
    />
    <div className="flex flex-col leading-none">
      <span className="font-display text-xl font-extrabold tracking-tighter text-foreground">EPP</span>
      <span className="hidden sm:block text-[9px] font-medium tracking-[0.15em] uppercase text-muted-foreground mt-0.5">
        Engineering · Partnership · Possibilities
      </span>
    </div>
  </a>
);

const links = [
  { href: "/services", label: "Solutions" },
  { href: "/industries", label: "Branchen" },
  { href: "/partners", label: "Partnership" },
  { href: "/careers", label: "Karriere" },
];

const Navigation = () => {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex h-20 items-center justify-between">
          <div className="flex items-center gap-10">
            <EppMark />
            <div className="hidden md:flex items-center gap-8">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  {l.label}
                </a>
              ))}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" asChild className="text-muted-foreground hover:text-foreground">
              <a href="/contact">Kontakt</a>
            </Button>
            <Button asChild className="rounded-full font-semibold">
              <a href="/careers">Get Started</a>
            </Button>
          </div>

          <button
            className="md:hidden text-foreground"
            onClick={() => setOpen(!open)}
            aria-label="Menü"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {open && (
          <div className="md:hidden py-4 border-t border-border">
            <div className="flex flex-col gap-4">
              {links.map((l) => (
                <a key={l.href} href={l.href} className="text-sm font-medium text-muted-foreground hover:text-foreground">
                  {l.label}
                </a>
              ))}
              <Button asChild className="rounded-full mt-2">
                <a href="/careers">Get Started</a>
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
