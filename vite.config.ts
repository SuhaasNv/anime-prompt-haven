// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // Nitro is disabled on purpose. Its node-server preset inlines node_modules
  // into a single ESM bundle, which breaks packages that read their own files at
  // runtime (jsdom's default-stylesheet via __dirname, css-tree's data/patch.json,
  // jsdom's internal require()s) and 500s every SSR route that sanitizes HTML.
  // Externalizing those out of the bundle crashes rollup codegen. The plain Vite
  // SSR build (nitro: false) already keeps deps external as bare imports, so we
  // serve it with a thin Node listener (scripts/node-server.mjs) and ship real
  // node_modules in the container. Build emits dist/server/server.js (fetch
  // handler) + dist/client (static assets).
  nitro: false,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    server: { port: 3000, strictPort: true },
    // Pre-bundle these at cold start. Otherwise Vite discovers them on the first
    // request, re-optimizes mid-session, and forces a reload — which invalidates
    // already-loaded chunks and surfaces as "504 (Outdated Optimize Dep)" in the browser.
    optimizeDeps: {
      include: [
        "@tanstack/router-core",
        "@tanstack/router-core/ssr/client",
        "seroval",
      ],
    },
  },
});
