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
    expect(mod.profileStore.get()).toEqual({ genres: {}, directors: {}, favorites: [] });
  });

  it('ignores a corrupted profile in localStorage and starts fresh', async () => {
    window.localStorage.setItem('cinescope:profile', '{"not":"a valid profile"}');
    const mod = await import('../src/stores/profileStore');
    expect(mod.profileStore.get()).toEqual({ genres: {}, directors: {}, favorites: [] });
  });

  it('does not double-count score when favoriting the same movie twice', async () => {
    const mod = await import('../src/stores/profileStore');
    mod.favoriteMovie(42, [28], 7);
    mod.favoriteMovie(42, [28], 7);
    expect(mod.profileStore.get().genres[28]).toBe(5);
    expect(mod.profileStore.get().favorites).toEqual([42]);
  });
});
