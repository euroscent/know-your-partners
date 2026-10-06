import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Apple, Smartphone, Share2, Plus, CheckCircle2, Bell } from "lucide-react";
import { isAndroid, isIOS, isStandalone, subscribeToPush } from "@/lib/pwa";
import { toast } from "sonner";
import eppLogoAsset from "@/assets/epp-logo.png.asset.json";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const FALLBACK_URL = "https://epp-dashboard.net";


export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    const cached = (window as unknown as { __deferredInstallPrompt?: BeforeInstallPromptEvent })
      .__deferredInstallPrompt;
    return cached ?? null;
  });
  const [installed, setInstalled] = useState(isStandalone());
  const [pushEnabled, setPushEnabled] = useState(
    typeof Notification !== "undefined" && Notification.permission === "granted",
  );

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    const installedHandler = () => setInstalled(true);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) {
      toast.info(
        "Installations-Dialog noch nicht bereit. Tippe auf das Browser-Menü (⋮) → „App installieren\".",
      );
      return;
    }
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      toast.success("App wird installiert!");
      setDeferredPrompt(null);
      (window as unknown as { __deferredInstallPrompt?: Event }).__deferredInstallPrompt = undefined;
    }
  };

  const handleEnablePush = async () => {
    const result = await subscribeToPush();
    if (result.ok) {
      setPushEnabled(true);
      toast.success("Benachrichtigungen aktiviert.");
    } else if (result.reason === "denied") {
      toast.error("Benachrichtigungen wurden blockiert. Bitte in den Browser-Einstellungen erlauben.");
    } else if (result.reason === "preview") {
      toast.error("Push funktioniert nur in der installierten App, nicht im Editor-Preview.");
    } else if (result.reason === "not-authenticated") {
      toast.error("Bitte zuerst einloggen.");
    } else {
      toast.error("Aktivierung fehlgeschlagen.");
    }
  };

  const baseUrl =
    typeof window !== "undefined" && !window.location.hostname.includes("lovable")
      ? window.location.origin
      : FALLBACK_URL;
  const installUrl = `${baseUrl}/install`;
  const ios = isIOS();
  const android = isAndroid();


  return (
    <div className="min-h-screen bg-black px-4 py-8 flex flex-col justify-between">
      <div className="mx-auto max-w-2xl w-full space-y-6 flex-grow flex flex-col justify-center">
        <header className="text-center mb-8">
          <div className="relative mx-auto mb-8 h-32 w-32 flex items-center justify-center">
            <img
              src={eppLogoAsset.url}
              alt="EPP Logo"
              className="h-full w-full object-contain animate-[spin_8s_linear_infinite]"
            />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">EPP App</h1>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Engineering · Partnership · Possibilities
          </p>
          <p className="mt-4 text-slate-400 max-w-md mx-auto">
            Installiere die App auf deinem Homescreen für schnellen Zugriff auf Aufträge, Codes und Honorarabrechnungen.
          </p>
        </header>

        {installed && (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="flex items-center gap-3 py-4">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-semibold">App ist installiert</p>
                <p className="text-sm text-muted-foreground">Du nutzt die EPP App bereits.</p>

              </div>
            </CardContent>
          </Card>
        )}

        {!installed && android && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" /> Android
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">Tippe auf den Button und bestätige die Installation:</p>
              <Button onClick={handleAndroidInstall} className="w-full" disabled={!deferredPrompt}>
                {deferredPrompt ? "Jetzt installieren" : "Bereit machen…"}
              </Button>
              {!deferredPrompt && (
                <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Button noch nicht aktiv?</p>
                  <ol className="mt-1 list-decimal space-y-1 pl-4">
                    <li>Lade die Seite einmal neu (oben rechts ↻).</li>
                    <li>
                      Falls weiterhin nicht aktiv: Chrome-Menü <strong>⋮</strong> → <strong>„App installieren"</strong>{" "}
                      bzw. <strong>„Zum Startbildschirm hinzufügen"</strong>.
                    </li>
                    <li>Stelle sicher, dass du <strong>Chrome</strong> (nicht Firefox/Brave/Samsung Internet) nutzt.</li>
                  </ol>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!installed && ios && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Apple className="h-5 w-5" /> iPhone / iPad
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                  <span>
                    Tippe in Safari unten auf <Share2 className="inline h-4 w-4" /> <strong>Teilen</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                  <span>
                    Wähle <Plus className="inline h-4 w-4" /> <strong>Zum Home-Bildschirm</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
                  <span>Bestätige mit <strong>Hinzufügen</strong> oben rechts.</span>
                </li>
              </ol>
              <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                Wichtig: Du musst die Seite in <strong>Safari</strong> öffnen – nicht in Chrome oder einem In-App-Browser.
              </p>
            </CardContent>
          </Card>
        )}

        {!installed && !android && !ios && (
          <Card>
            <CardHeader>
              <CardTitle>Auf dem Handy installieren</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Scanne den QR-Code mit deinem Handy und folge dort der Anleitung:
              </p>
              <div className="flex justify-center rounded-lg bg-white p-4">
                <QRCodeSVG value={installUrl} size={200} />
              </div>
              <p className="text-center font-mono text-xs text-muted-foreground">{installUrl}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" /> Benachrichtigungen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Erhalte Push-Nachrichten bei neuen Aufträgen, freigegebenen Codes und Auszahlungen.
            </p>
            <Button onClick={handleEnablePush} disabled={pushEnabled} className="w-full" variant={pushEnabled ? "outline" : "default"}>
              {pushEnabled ? "Aktiviert" : "Benachrichtigungen aktivieren"}
            </Button>
          </CardContent>
        </Card>
      </div>
      <footer className="py-8 text-center">
        <p className="text-white font-medium tracking-wider">epp GmbH</p>
      </footer>
    </div>
  );
}
