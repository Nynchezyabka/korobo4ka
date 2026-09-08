import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["Assets/**/*", "favicon.jpg", "icon-192.svg", "icon-512.svg", "icon-maskable-192.svg", "icon-maskable-512.svg"],
      manifest: {
        name: "🎁 КОРОБОЧКА",
        short_name: "КОРОБОЧКА",
        description: "Планировщик задач с таймером",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#fffaf0",
        theme_color: "#5d4037",
        orientation: "portrait-primary",
        icons: [
          {
            src: "/icon-192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/icon-512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/icon-maskable-192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "maskable",
          },
          {
            src: "/icon-maskable-512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // HTML не предкэшируем: навигацию обслуживает NetworkFirst (см. ниже),
        // иначе старая index.html отдаётся из кэша и приложение «не обновляется».
        globPatterns: ["**/*.{js,css,ico,png,jpg,svg,woff2}"],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Страницы приложения: сначала сеть, кэш — только как запасной вариант офлайн
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-pages",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-css",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /\/Assets\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "asset-images",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  server: {
    host: "::",
    port: 8080,
  },
});
