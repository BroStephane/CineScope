import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cacheFavoritePoster, uncacheFavoritePoster, FAVORITES_CACHE_NAME } from '../src/lib/favoritesCache';

describe('favoritesCache', () => {
  let mockCache: { add: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  let mockCaches: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockCache = { add: vi.fn().mockResolvedValue(undefined), delete: vi.fn().mockResolvedValue(true) };
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
});
