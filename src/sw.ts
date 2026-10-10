/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { NetworkFirst } from "workbox-strategies";

declare const self: ServiceWorkerGlobalScope;

// Precache build assets
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// SPA navigation fallback (excludes oauth + supabase callbacks + api)
const navigationRoute = new NavigationRoute(
  new NetworkFirst({ cacheName: "navigations", networkTimeoutSeconds: 5 }),
  {
    denylist: [/^\/~oauth/, /^\/api\//, /\/functions\//],
  },
);
registerRoute(navigationRoute);

// Activate immediately
self.addEventListener("install", () => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// --- Push Notifications ---
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload: {
    title?: string;
    body?: string;
    url?: string;
    tag?: string;
    icon?: string;
    badge?: string;
  } = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "EuroScent", body: event.data.text() };
  }

  const title = payload.title || "EuroScent App";
  const options: NotificationOptions = {
    body: payload.body || "",
    icon: payload.icon || "/epp-app-icon-v3-192.png",
    badge: payload.badge || "/epp-app-icon-v3-192.png",
    tag: payload.tag,
    data: { url: payload.url || "/dashboard" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data?.url as string) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return (client as WindowClient).focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
