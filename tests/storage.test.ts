import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => vi.restoreAllMocks());

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
    vi.spyOn(Object.getPrototypeOf(window.localStorage), 'setItem').mockImplementation(() => {
      throw new DOMException('blocked');
    });

    const storage = await import('../src/lib/storage');
    storage.setItem('foo', 'bar');

    expect(storage.getItem('foo')).toBe('bar');
    expect(storage.isPersistent()).toBe(false);
  });

  it('removeItem clears a key', async () => {
    const storage = await import('../src/lib/storage');
    storage.setItem('foo', 'bar');
    storage.removeItem('foo');
    expect(storage.getItem('foo')).toBeNull();
  });

  it('removeItem clears a key when in fallback mode', async () => {
    vi.spyOn(Object.getPrototypeOf(window.localStorage), 'setItem').mockImplementation(() => {
      throw new DOMException('blocked');
    });

    const storage = await import('../src/lib/storage');
    storage.setItem('foo', 'bar');
    storage.removeItem('foo');
    expect(storage.getItem('foo')).toBeNull();
  });
});
