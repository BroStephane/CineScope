/// <reference lib="webworker" />
import { precacheAndRoute, matchPrecache } from 'workbox-precaching';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { FAVORITES_CACHE_NAME } from './lib/favoritesCache';

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

const recentPosters = new CacheFirst({
  cacheName: 'tmdb-posters-recent',
  plugins: [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
    new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 }),
  ],
});

registerRoute(
  ({ url }) => url.origin === 'https://image.tmdb.org',
  async (options) => {
    const favoritesCache = await caches.open(FAVORITES_CACHE_NAME);
    const cached = await favoritesCache.match(options.request);
    if (cached) return cached;
    return recentPosters.handle(options);
  }
);

registerRoute(
  ({ url }) => url.origin === 'https://api.themoviedb.org',
  new NetworkFirst({
    cacheName: 'tmdb-api',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 })],
  })
);

// `setCatchHandler` alone only runs when a *matched* route's strategy throws
// — it does nothing for requests that don't match any registered route at
// all, and a bare navigation to a page outside the precache manifest (e.g. a
// path that was never visited/prerendered) wouldn't match any of the routes
// above, so the browser would fall through to its own native network stack
// and never reach the service worker's fetch handling in the first place.
// This route matches every navigation so it's always the one handling them.
//
// It does its own precache lookup first (rather than delegating straight to
// a NetworkFirst strategy) because `matchPrecache` does an *exact* cache-key
// lookup (`PrecacheController.getCacheKeyForURL`) with no directoryIndex
// normalization of its own — the manifest keys prerendered pages as
// `search/index.html`, `profile/index.html`, etc., but real in-app links
// (`src/lib/navItems.ts`, used by BottomNav/Header, and the offline page's
// own "Voir mes favoris" link) point at `/search`, `/profile` — no trailing
// slash. Workbox's *automatic* precache route (registered by
// `precacheAndRoute` above) only expands a request to its directoryIndex
// variant when the request's pathname already ends in `/`, so a real tap on
// a nav link while offline was silently missing the precache entirely and
// falling all the way through to the generic offline page instead of the
// actual cached page. Trying both `pathname` and `pathname/index.html` here
// covers both link styles without having to edit every internal href.
registerRoute(
  ({ request }) => request.mode === 'navigate',
  async ({ event, request }) => {
    const url = new URL(request.url);
    const candidates = url.pathname.endsWith('/')
      ? [`${url.pathname}index.html`]
      : [url.pathname, `${url.pathname}/index.html`];

    for (const candidate of candidates) {
      const cached = await matchPrecache(candidate);
      if (cached) return cached;
    }

    try {
      return await new NetworkFirst({ cacheName: 'pages' }).handle({ event, request });
    } catch {
      return (await matchPrecache('/offline/index.html')) ?? Response.error();
    }
  }
);

// Defense-in-depth: catches any navigation that somehow bypasses the route
// above (e.g. a request whose mode workbox's router classifies differently)
// and still serves the offline page rather than a native browser error.
setCatchHandler(async ({ event }) => {
  if (event.request.mode === 'navigate') {
    return (await matchPrecache('/offline/index.html')) ?? Response.error();
  }
  return Response.error();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
