import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';
import { VitePWA } from 'vite-plugin-pwa';

// vite-plugin-pwa's `injectManifest` build step (the one that actually bundles
// `src/sw.ts` — resolving its `workbox-*` imports and compiling out the TS
// syntax — then writes the final sw.js) only runs from a `closeBundle` hook
// that is gated on `!viteConfig.build.ssr`. Because the Cloudflare adapter puts
// Astro in "server" output mode, every one of Astro's internal Vite
// sub-builds runs with `build.ssr === true` (verified by instrumenting the
// plugin locally: all three "Building server entrypoints" passes reported
// `ssr: true`), so that gate never opens and sw.js is never emitted at build
// time — even though `manifest.webmanifest` (written from an un-gated
// `generateBundle` hook) and the dev-mode service worker (served through a
// separate `serve`-only code path, unaffected by the ssr gate) both work
// fine. This is a known friction point between plain `vite-plugin-pwa` and
// Astro's adapter/SSR output mode; the dedicated `@vite-pwa/astro`
// integration exists specifically to paper over it, but to stay on the
// plan's chosen dependency (plain `vite-plugin-pwa`) we instead call the
// plugin's own public `api.generateSW()` ourselves from an `astro:build:done`
// hook, once Astro's static output directory is fully populated — this reuses
// vite-plugin-pwa's real bundling logic (unlike calling workbox-build's
// `injectManifest` directly on the raw .ts source, which was tried first and
// produced a broken sw.js: unresolved bare `import 'workbox-*'` specifiers
// and TS-only syntax like `declare let self: ...` left verbatim, causing
// "ServiceWorker script evaluation failed" in the browser).
//
// `outDir: 'dist/client'` below is also required: vite-plugin-pwa defaults
// `outDir` to `viteConfig.build.outDir`, which for every one of Astro's
// sub-builds resolves to `dist/server/` (the SSR function bundle), not the
// static asset directory Astro actually serves from. Pinning it explicitly
// makes the plugin glob the right directory for its precache manifest and
// write sw.js next to manifest.webmanifest in `dist/client/` — the exact
// directory the Cloudflare adapter's generated `wrangler.json` points its
// `assets.directory` at (`dist/server/wrangler.json` → `"../client"`), so
// no further copying step is needed (confirmed via `wrangler dev`: sw.js,
// manifest.webmanifest and every prerendered route serve correctly).
const pwaPlugins = VitePWA({
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.ts',
  outDir: 'dist/client',
  injectManifest: { swSrc: 'src/sw.ts' },
  registerType: 'prompt',
  devOptions: { enabled: true, type: 'module' },
  manifest: {
    name: 'CineScope',
    short_name: 'CineScope',
    description: 'Explorez films et séries, avec vos favoris toujours disponibles hors-ligne.',
    lang: 'fr',
    theme_color: '#0a0a0f',
    background_color: '#0a0a0f',
    display: 'standalone',
    start_url: '/',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
});
const pwaPlugin = pwaPlugins.find((plugin) => plugin.name === 'vite-plugin-pwa');
if (!pwaPlugin?.api) {
  throw new Error(
    "vite-plugin-pwa's internal plugin name/API shape changed — the astro:build:done " +
      'workaround in astro.config.mjs (see comment above) can no longer call generateSW(). ' +
      'Check the installed vite-plugin-pwa version and update the lookup.'
  );
}
const pwaApi = pwaPlugin.api;

function pwaServiceWorkerIntegration() {
  return {
    name: 'cinescope-pwa-sw',
    hooks: {
      'astro:build:done': async ({ logger }) => {
        await pwaApi.generateSW();
        logger.info('PWA service worker (sw.js) generated via vite-plugin-pwa injectManifest.');
      },
    },
  };
}

export default defineConfig({
  // Output stays static by default (SSG) for every route. The Cloudflare
  // adapter is only needed so the on-demand routes (`/movie/[id]` and
  // `/personne/[id]`, which set `export const prerender = false` since their
  // ids aren't known at build time and all of their data is fetched
  // client-side from TMDB) can be served — Astro requires an adapter for any
  // non-prerendered route, even though the rest of the site remains fully
  // static/serverless. Deploys to Cloudflare Workers (`wrangler deploy`),
  // not Cloudflare Pages — see README for why.
  adapter: cloudflare(),
  integrations: [react(), pwaServiceWorkerIntegration()],
  vite: {
    plugins: [tailwindcss(), ...pwaPlugins],
  },
});
