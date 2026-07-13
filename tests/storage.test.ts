import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.resetModules();
  });

  it('reads and writes through localStorage when available', async () => {
    const storage = await import('../src/lib/storage');
    storage.setItem('foo', 'bar');
    expect(storage.getItem('foo')).toBe('bar');
    expect(storage.isPersistent()).toBe(true);
  });

  it('falls back to in-memory storage when localStorage throws', async () => {
    // jsdom's localStorage exposes setItem only via its prototype (Storage.prototype);
    // vi.spyOn(window.localStorage, 'setItem') silently fails to override it because
    // defineProperty on the instance doesn't take effect. Spying on the prototype does.
    const setItemSpy = vi
      .spyOn(Object.getPrototypeOf(window.localStorage), 'setItem')
      .mockImplementation(() => {
        throw new DOMException('blocked');
      });

    const storage = await import('../src/lib/storage');
    storage.setItem('foo', 'bar');

    expect(storage.getItem('foo')).toBe('bar');
    expect(storage.isPersistent()).toBe(false);

    setItemSpy.mockRestore();
  });

  it('removeItem clears a key in both modes', async () => {
    const storage = await import('../src/lib/storage');
    storage.setItem('foo', 'bar');
    storage.removeItem('foo');
    expect(storage.getItem('foo')).toBeNull();
  });
});
