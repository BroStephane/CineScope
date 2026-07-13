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
    const original = window.localStorage.setItem;
    window.localStorage.setItem = () => {
      throw new DOMException('blocked');
    };

    const storage = await import('../src/lib/storage');
    storage.setItem('foo', 'bar');

    expect(storage.getItem('foo')).toBe('bar');
    expect(storage.isPersistent()).toBe(false);

    window.localStorage.setItem = original;
  });

  it('removeItem clears a key in both modes', async () => {
    const storage = await import('../src/lib/storage');
    storage.setItem('foo', 'bar');
    storage.removeItem('foo');
    expect(storage.getItem('foo')).toBeNull();
  });
});
