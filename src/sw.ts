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

// `setCatchHandler` below only runs when a *matched* route's strategy throws
// — it does nothing for requests that don't match any registered route at
// all, and a bare navigation to a page outside the precache manifest (e.g. a
// path that was never visited/prerendered) wouldn't match any of the routes
// above, so the browser would fall through to its own native network stack
// and never reach the service worker's fetch handling in the first place.
// This route matches every navigation so a NetworkFirst strategy always
// handles it — succeeding from the network when online, and throwing (thus
// invoking `setCatchHandler`) when offline and nothing else applies.
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({ cacheName: 'navigations' })
);

// Navigation fallback: when offline (or the network otherwise fails) and the
// browser is navigating to a page that isn't precached, serve the offline
// page instead of the browser's native network-error screen. `matchPrecache`
// is used instead of the global Cache Storage `caches.match()` so the lookup
// only ever checks workbox's own precache bucket — but `matchPrecache` does
// an *exact* cache-key lookup (`PrecacheController.getCacheKeyForURL`), with
// no directoryIndex normalization of its own, so the URL passed here must
// match the manifest entry's URL exactly: `offline/index.html`, not the
// `/offline` route path a user actually navigates to (that normalization
// only happens in the separate route-matching logic `precacheAndRoute` sets
// up for handling *incoming requests*, not in `matchPrecache`).
setCatchHandler(async ({ event }) => {
  if (event.request.mode === 'navigate') {
    const cached = await matchPrecache('/offline/index.html');
    if (cached) return cached;
  }
  return Response.error();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
