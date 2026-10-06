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
      includeAssets: ["app-icon-192.png", "app-icon-512.png", "app-icon-maskable-512.png", "apple-touch-icon.png"],
      manifest: {
        name: "EuroScent",
        short_name: "EuroScent",
        id: "/euroscent-app",
        description: "Aufträge, Demo-Daten, E-Mails und Honorarabrechnungen für EuroScent-Mitarbeiter.",
        theme_color: "#000000",
        background_color: "#000000",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/dashboard",
        lang: "de",
        categories: ["business", "productivity"],
        icons: [
          { src: "/app-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/app-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webp,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: [
      // Alle Datenzugriffe gehen an das eigene Supabase-Projekt
      {
        find: /^@\/integrations\/supabase\/client$/,
        replacement: path.resolve(__dirname, "./src/integrations/external/client.ts"),
      },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
}));
