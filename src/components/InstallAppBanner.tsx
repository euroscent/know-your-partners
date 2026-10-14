import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Smartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { isStandalone, isPreviewHost, isInIframe } from "@/lib/pwa";

const STORAGE_KEY = "euroscent.install-banner-dismissed-at";
const SUPPRESS_DAYS = 7;

export function InstallAppBanner() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || isInIframe() || isPreviewHost()) return;
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) {
      const ts = Number(dismissed);
      if (Date.now() - ts < SUPPRESS_DAYS * 24 * 60 * 60 * 1000) return;
    }
    // Show only on mobile
    if (window.matchMedia?.("(max-width: 768px)").matches) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setVisible(false);
  };

  return (
    <div
      className="fixed left-2 right-2 z-50 rounded-xl border border-border bg-card shadow-lg md:hidden"
      style={{
        bottom: "calc(env(safe-area-inset-bottom) + 64px)",
      }}
    >
      <div className="flex items-start gap-3 p-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">App installieren</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Schneller Zugriff auf Aufträge & Push-Codes direkt vom Homescreen.
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" className="h-8" onClick={() => { dismiss(); navigate("/install"); }}>
              Installieren
            </Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={dismiss}>
              Später
            </Button>
          </div>
        </div>
        <button
          aria-label="Schließen"
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
