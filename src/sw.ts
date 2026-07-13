/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

const FAVORITES_CACHE = 'tmdb-posters-favorites';

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
    const favoritesCache = await caches.open(FAVORITES_CACHE);
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

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
