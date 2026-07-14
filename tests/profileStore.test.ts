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

  it('migrates a profile stored before swipedLiked/swipedDisliked existed', async () => {
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
    });
  });
});
