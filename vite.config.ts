import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectRegister: false,
      devOptions: {
        enabled: false,
      },
      includeAssets: ["epp-app-icon-v3-192.png", "epp-app-icon-v3-512.png", "epp-app-icon-v3-maskable-512.png", "epp-apple-touch-icon-v3.png"],
      manifest: {
        name: "epp GmbH",
        short_name: "EPP",
        id: "/epp-app-v3",
        description: "Aufträge, Demo-Daten, E-Mails und Honorarabrechnungen für EPP-Mitarbeiter.",
        theme_color: "#000000",
        background_color: "#000000",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/dashboard",
        lang: "de",
        categories: ["business", "productivity"],
        icons: [
          { src: "/epp-app-icon-v3-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/epp-app-icon-v3-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/epp-app-icon-v3-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webp,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
