// PWA helpers: install detection, SW registration with iframe/preview guard,
// push subscription management.

import { supabase } from "@/integrations/supabase/client";

export const VAPID_PUBLIC_KEY =
  "BESUCxgERCkIShXNmre25t7UB1COSv7Sw-QriuR53QKDnL0sGDsgZcgQ50lDrY7aE5enXuzl8LUWZ_bLHxEPGw0";

export function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function isLovablePreviewHost(): boolean {
  const h = window.location.hostname;
  return h.includes("lovableproject.com") || h.includes("id-preview--");
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  const ua = window.navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) && !/CriOS|FxiOS/.test(ua);
}

export function isAndroid(): boolean {
  return /Android/i.test(window.navigator.userAgent);
}

/**
 * Register the service worker only in safe contexts.
 * In Lovable preview/iframe we actively unregister any leftover SW
 * to avoid stale caches breaking the live preview.
 */
export async function registerServiceWorker(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  if (!import.meta.env.PROD || isInIframe() || isLovablePreviewHost()) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch {
      /* ignore */
    }
    return;
  }

  try {
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    // vite-plugin-pwa emits the worker at /sw.js in production
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await registration.update();
  } catch (err) {
    console.warn("SW registration failed:", err);
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

export async function subscribeToPush(): Promise<{
  ok: boolean;
  reason?: string;
}> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, reason: "unsupported" };
  }
  if (isInIframe() || isLovablePreviewHost()) {
    return { ok: false, reason: "preview" };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: "denied" };

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast: Push spec accepts BufferSource; TS lib types are overly strict on Uint8Array variant.
        applicationServerKey: key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer,
      });
    }

    const json = sub.toJSON();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { ok: false, reason: "not-authenticated" };

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: userData.user.id,
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
          user_agent: navigator.userAgent,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" },
      );

    if (error) {
      console.error("push subscription save failed", error);
      return { ok: false, reason: "save-failed" };
    }
    return { ok: true };
  } catch (err) {
    console.error("subscribeToPush error", err);
    return { ok: false, reason: "error" };
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
  } catch (err) {
    console.warn("unsubscribeFromPush error", err);
  }
}
