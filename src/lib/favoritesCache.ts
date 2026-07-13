import { tmdbImageUrl } from './tmdb';

export const FAVORITES_CACHE_NAME = 'tmdb-posters-favorites';

export async function cacheFavoritePoster(posterPath: string | null): Promise<void> {
  if (!posterPath || typeof caches === 'undefined') return;
  const url = tmdbImageUrl(posterPath, 'w342');
  if (!url) return;
  const cache = await caches.open(FAVORITES_CACHE_NAME);
  try {
    await cache.add(url);
  } catch {
    // Offline or blocked — favoriting still succeeds, poster just won't be pinned yet.
  }
}

export async function uncacheFavoritePoster(posterPath: string | null): Promise<void> {
  if (!posterPath || typeof caches === 'undefined') return;
  const url = tmdbImageUrl(posterPath, 'w342');
  if (!url) return;
  const cache = await caches.open(FAVORITES_CACHE_NAME);
  await cache.delete(url);
}
