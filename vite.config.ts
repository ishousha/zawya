import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  define: {
    __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: false,
      },
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        // Network-first for HTML so users always get fresh layouts on deploy
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 },
              networkTimeoutSeconds: 3,
            },
          },
          {
            urlPattern: /\.(js|css)$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "static-assets",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: /\/ticket/,
            handler: "CacheFirst",
            options: {
              cacheName: "ticket-cache",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
            },
          },
        ],
      },
      manifest: {
        name: "Zawya",
        short_name: "Zawya",
        description: "A gathering place for the community",
        theme_color: "#2F5233",
        background_color: "#F5F5DC",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core", "scheduler"],
  },
}));
