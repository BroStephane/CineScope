import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  cacheFavoritePoster,
  uncacheFavoritePoster,
  cacheFavoriteMovieData,
  uncacheFavoriteMovieData,
  getCachedFavoriteMovieData,
  FAVORITES_CACHE_NAME,
  FAVORITES_DATA_CACHE_NAME,
} from '../src/lib/favoritesCache';
import type { TMDBMovieDetail } from '../src/lib/tmdb';

const sampleMovie: TMDBMovieDetail = {
  id: 42,
  title: 'Sample Movie',
  poster_path: '/abc.jpg',
  backdrop_path: null,
  overview: 'An overview',
  release_date: '2024-01-01',
  vote_average: 7.5,
  runtime: 120,
  genres: [{ id: 1, name: 'Action' }],
};

describe('favoritesCache', () => {
  let mockCache: {
    add: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    match: ReturnType<typeof vi.fn>;
  };
  let mockCaches: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockCache = {
      add: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(true),
      put: vi.fn().mockResolvedValue(undefined),
      match: vi.fn().mockResolvedValue(undefined),
    };
    mockCaches = { open: vi.fn().mockResolvedValue(mockCache) };
    vi.stubGlobal('caches', mockCaches);
  });

  it('does nothing when posterPath is null', async () => {
    await cacheFavoritePoster(null);
    expect(mockCaches.open).not.toHaveBeenCalled();
  });

  it('opens the favorites cache and adds the poster URL', async () => {
    await cacheFavoritePoster('/abc.jpg');
    expect(mockCaches.open).toHaveBeenCalledWith(FAVORITES_CACHE_NAME);
    expect(mockCache.add).toHaveBeenCalledWith('https://image.tmdb.org/t/p/w342/abc.jpg');
  });

  it('does not throw when cache.add rejects (offline/blocked)', async () => {
    mockCache.add.mockRejectedValue(new Error('offline'));
    await expect(cacheFavoritePoster('/abc.jpg')).resolves.toBeUndefined();
  });

  it('deletes the poster URL from the favorites cache', async () => {
    await uncacheFavoritePoster('/abc.jpg');
    expect(mockCache.delete).toHaveBeenCalledWith('https://image.tmdb.org/t/p/w342/abc.jpg');
  });

  it('does nothing when posterPath is null on uncache', async () => {
    await uncacheFavoritePoster(null);
    expect(mockCaches.open).not.toHaveBeenCalled();
  });

  it('caches favorite movie JSON keyed by movie id', async () => {
    await cacheFavoriteMovieData(sampleMovie);
    expect(mockCaches.open).toHaveBeenCalledWith(FAVORITES_DATA_CACHE_NAME);
    expect(mockCache.put).toHaveBeenCalledTimes(1);
    const [key, response] = mockCache.put.mock.calls[0];
    expect(key).toBe('/favorites-cache/movie-42');
    expect(response).toBeInstanceOf(Response);
    await expect(response.json()).resolves.toEqual(sampleMovie);
  });

  it('does not throw when cache.put rejects (offline/blocked)', async () => {
    mockCache.put.mockRejectedValue(new Error('offline'));
    await expect(cacheFavoriteMovieData(sampleMovie)).resolves.toBeUndefined();
  });

  it('deletes favorite movie JSON by id', async () => {
    await uncacheFavoriteMovieData(42);
    expect(mockCaches.open).toHaveBeenCalledWith(FAVORITES_DATA_CACHE_NAME);
    expect(mockCache.delete).toHaveBeenCalledWith('/favorites-cache/movie-42');
  });

  it('returns cached favorite movie data when present', async () => {
    mockCache.match.mockResolvedValue(
      new Response(JSON.stringify(sampleMovie), { headers: { 'Content-Type': 'application/json' } })
    );
    const result = await getCachedFavoriteMovieData(42);
    expect(mockCache.match).toHaveBeenCalledWith('/favorites-cache/movie-42');
    expect(result).toEqual(sampleMovie);
  });

  it('returns null when no cached favorite movie data exists', async () => {
    mockCache.match.mockResolvedValue(undefined);
    const result = await getCachedFavoriteMovieData(999);
    expect(result).toBeNull();
  });
});
