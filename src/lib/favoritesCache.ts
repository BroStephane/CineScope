import { tmdbImageUrl, type TMDBMovieDetail } from './tmdb';

export const FAVORITES_CACHE_NAME = 'tmdb-posters-favorites';
export const FAVORITES_DATA_CACHE_NAME = 'tmdb-data-favorites';

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

function favoriteDataKey(movieId: number): string {
  return `/favorites-cache/movie-${movieId}`;
}

export async function cacheFavoriteMovieData(movie: TMDBMovieDetail): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(FAVORITES_DATA_CACHE_NAME);
    const response = new Response(JSON.stringify(movie), {
      headers: { 'Content-Type': 'application/json' },
    });
    await cache.put(favoriteDataKey(movie.id), response);
  } catch {
    // Offline or blocked — favoriting still succeeds, data just won't be pinned yet.
  }
}

export async function uncacheFavoriteMovieData(movieId: number): Promise<void> {
  if (typeof caches === 'undefined') return;
  const cache = await caches.open(FAVORITES_DATA_CACHE_NAME);
  await cache.delete(favoriteDataKey(movieId));
}

export async function getCachedFavoriteMovieData(movieId: number): Promise<TMDBMovieDetail | null> {
  if (typeof caches === 'undefined') return null;
  const cache = await caches.open(FAVORITES_DATA_CACHE_NAME);
  const response = await cache.match(favoriteDataKey(movieId));
  if (!response) return null;
  return (await response.json()) as TMDBMovieDetail;
}
