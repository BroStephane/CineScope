import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('profileStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.resetModules();
  });

  it('persists a favorite across store reloads', async () => {
    const mod1 = await import('../src/stores/profileStore');
    mod1.favoriteMovie(42, [28], 7);
    expect(mod1.profileStore.get().favorites).toEqual([42]);

    vi.resetModules();
    const mod2 = await import('../src/stores/profileStore');
    expect(mod2.profileStore.get().favorites).toEqual([42]);
    expect(mod2.profileStore.get().genres[28]).toBe(5);
  });

  it('resetProfile clears all persisted data', async () => {
    const mod = await import('../src/stores/profileStore');
    mod.favoriteMovie(1, [1], 1);
    mod.resetProfile();
    expect(mod.profileStore.get()).toEqual({
      genres: {},
      directors: {},
      favorites: [],
      swipedLiked: [],
      swipedDisliked: [],
      watched: [],
      ratings: {},
      swipedLikedAt: {},
    });
  });

  it('ignores a corrupted profile in localStorage and starts fresh', async () => {
    window.localStorage.setItem('cinescope:profile', '{"not":"a valid profile"}');
    const mod = await import('../src/stores/profileStore');
    expect(mod.profileStore.get()).toEqual({
      genres: {},
      directors: {},
      favorites: [],
      swipedLiked: [],
      swipedDisliked: [],
      watched: [],
      ratings: {},
      swipedLikedAt: {},
    });
  });

  it('does not double-count score when favoriting the same movie twice', async () => {
    const mod = await import('../src/stores/profileStore');
    mod.favoriteMovie(42, [28], 7);
    mod.favoriteMovie(42, [28], 7);
    expect(mod.profileStore.get().genres[28]).toBe(5);
    expect(mod.profileStore.get().favorites).toEqual([42]);
  });

  it('persists a swipe-like across store reloads', async () => {
    const mod1 = await import('../src/stores/profileStore');
    mod1.swipeLikeMovie(55, [28]);
    expect(mod1.profileStore.get().swipedLiked).toEqual([55]);

    vi.resetModules();
    const mod2 = await import('../src/stores/profileStore');
    expect(mod2.profileStore.get().swipedLiked).toEqual([55]);
    expect(mod2.profileStore.get().genres[28]).toBe(2);
  });

  it('does not double-count score when swipe-liking the same movie twice', async () => {
    const mod = await import('../src/stores/profileStore');
    mod.swipeLikeMovie(55, [28]);
    mod.swipeLikeMovie(55, [28]);
    expect(mod.profileStore.get().genres[28]).toBe(2);
    expect(mod.profileStore.get().swipedLiked).toEqual([55]);
  });

  it('swipeDislikeMovie records the id without touching scores', async () => {
    const mod = await import('../src/stores/profileStore');
    mod.swipeDislikeMovie(77);
    expect(mod.profileStore.get().swipedDisliked).toEqual([77]);
    expect(mod.profileStore.get().genres).toEqual({});
  });

  it('clearSwipeDislikes empties swipedDisliked but keeps swipedLiked', async () => {
    const mod = await import('../src/stores/profileStore');
    mod.swipeLikeMovie(1, [28]);
    mod.swipeDislikeMovie(2);
    mod.clearSwipeDislikes();
    expect(mod.profileStore.get().swipedDisliked).toEqual([]);
    expect(mod.profileStore.get().swipedLiked).toEqual([1]);
  });

  it('migrates a profile stored before swipedLiked/swipedDisliked/watched existed', async () => {
    window.localStorage.setItem(
      'cinescope:profile',
      JSON.stringify({ genres: { 28: 5 }, directors: {}, favorites: [10] })
    );
    const mod = await import('../src/stores/profileStore');
    expect(mod.profileStore.get()).toEqual({
      genres: { 28: 5 },
      directors: {},
      favorites: [10],
      swipedLiked: [],
      swipedDisliked: [],
      watched: [],
      ratings: {},
      swipedLikedAt: {},
    });
  });

  it('migrates a profile stored before watched existed but after swipedLiked/swipedDisliked did', async () => {
    window.localStorage.setItem(
      'cinescope:profile',
      JSON.stringify({ genres: { 28: 5 }, directors: {}, favorites: [10], swipedLiked: [2], swipedDisliked: [] })
    );
    const mod = await import('../src/stores/profileStore');
    expect(mod.profileStore.get()).toEqual({
      genres: { 28: 5 },
      directors: {},
      favorites: [10],
      swipedLiked: [2],
      swipedDisliked: [],
      watched: [],
      ratings: {},
      swipedLikedAt: {},
    });
  });

  it('persists a watched movie across store reloads', async () => {
    const mod1 = await import('../src/stores/profileStore');
    mod1.markWatched(88, [28]);
    expect(mod1.profileStore.get().watched).toEqual([88]);

    vi.resetModules();
    const mod2 = await import('../src/stores/profileStore');
    expect(mod2.profileStore.get().watched).toEqual([88]);
    expect(mod2.profileStore.get().genres[28]).toBe(3);
  });

  it('does not double-count score when marking the same movie watched twice', async () => {
    const mod = await import('../src/stores/profileStore');
    mod.markWatched(88, [28]);
    mod.markWatched(88, [28]);
    expect(mod.profileStore.get().genres[28]).toBe(3);
    expect(mod.profileStore.get().watched).toEqual([88]);
  });

  it('unmarkWatched removes the movie from watched', async () => {
    const mod = await import('../src/stores/profileStore');
    mod.markWatched(88, [28]);
    mod.unmarkWatched(88);
    expect(mod.profileStore.get().watched).toEqual([]);
  });

  it('exportProfile returns the current profile as JSON', async () => {
    const mod = await import('../src/stores/profileStore');
    mod.favoriteMovie(1, [28], 7);
    const json = mod.exportProfile();
    expect(JSON.parse(json)).toEqual(mod.profileStore.get());
  });

  it('importProfile restores a previously exported profile', async () => {
    const mod = await import('../src/stores/profileStore');
    mod.favoriteMovie(1, [28], 7);
    const json = mod.exportProfile();
    mod.resetProfile();
    expect(mod.profileStore.get().favorites).toEqual([]);
    const ok = mod.importProfile(json);
    expect(ok).toBe(true);
    expect(mod.profileStore.get().favorites).toEqual([1]);
    expect(mod.profileStore.get().genres[28]).toBe(5);
  });

  it('importProfile rejects invalid JSON and leaves the profile untouched', async () => {
    const mod = await import('../src/stores/profileStore');
    mod.favoriteMovie(1, [28], 7);
    const ok = mod.importProfile('not valid json{{{');
    expect(ok).toBe(false);
    expect(mod.profileStore.get().favorites).toEqual([1]);
  });

  it('importProfile rejects a JSON payload that is not a valid profile shape', async () => {
    const mod = await import('../src/stores/profileStore');
    mod.favoriteMovie(1, [28], 7);
    const ok = mod.importProfile(JSON.stringify({ not: 'a profile' }));
    expect(ok).toBe(false);
    expect(mod.profileStore.get().favorites).toEqual([1]);
  });

  it('importProfile backfills fields missing from an older export', async () => {
    const mod = await import('../src/stores/profileStore');
    const ok = mod.importProfile(JSON.stringify({ genres: { 28: 5 }, directors: {}, favorites: [10] }));
    expect(ok).toBe(true);
    expect(mod.profileStore.get()).toEqual({
      genres: { 28: 5 },
      directors: {},
      favorites: [10],
      swipedLiked: [],
      swipedDisliked: [],
      watched: [],
      ratings: {},
      swipedLikedAt: {},
    });
  });

  it('persists a rating across store reloads', async () => {
    const mod1 = await import('../src/stores/profileStore');
    mod1.rateMovie(77, 4, [28]);
    expect(mod1.profileStore.get().ratings).toEqual({ 77: 4 });

    vi.resetModules();
    const mod2 = await import('../src/stores/profileStore');
    expect(mod2.profileStore.get().ratings).toEqual({ 77: 4 });
    expect(mod2.profileStore.get().genres[28]).toBe(4);
  });

  it('rateMovie only applies the delta when changing an existing rating', async () => {
    const mod = await import('../src/stores/profileStore');
    mod.rateMovie(77, 3, [28]);
    mod.rateMovie(77, 5, [28]);
    expect(mod.profileStore.get().genres[28]).toBe(5);
    expect(mod.profileStore.get().ratings).toEqual({ 77: 5 });
  });

  it('unrateMovie removes the rating and its genre points', async () => {
    const mod = await import('../src/stores/profileStore');
    mod.rateMovie(77, 4, [28]);
    mod.unrateMovie(77, [28]);
    expect(mod.profileStore.get().ratings).toEqual({});
    expect(mod.profileStore.get().genres[28]).toBe(0);
  });

  it('migrates a profile stored before ratings existed', async () => {
    window.localStorage.setItem(
      'cinescope:profile',
      JSON.stringify({
        genres: { 28: 5 },
        directors: {},
        favorites: [10],
        swipedLiked: [],
        swipedDisliked: [],
        watched: [],
      })
    );
    const mod = await import('../src/stores/profileStore');
    expect(mod.profileStore.get()).toEqual({
      genres: { 28: 5 },
      directors: {},
      favorites: [10],
      swipedLiked: [],
      swipedDisliked: [],
      watched: [],
      ratings: {},
      swipedLikedAt: {},
    });
  });
});
