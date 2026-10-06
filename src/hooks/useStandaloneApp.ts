import { useEffect, useState } from "react";
import { isStandalone } from "@/lib/pwa";

/**
 * Returns true when the app is running as an installed PWA
 * (display-mode: standalone or iOS standalone flag).
 */
export function useStandaloneApp(): boolean {
  const [standalone, setStandalone] = useState<boolean>(() => isStandalone());

  useEffect(() => {
    const mq = window.matchMedia?.("(display-mode: standalone)");
    if (!mq) return;
    const handler = () => setStandalone(isStandalone());
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  return standalone;
}
