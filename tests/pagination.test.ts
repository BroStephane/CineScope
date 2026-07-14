import { describe, it, expect } from 'vitest';
import { parsePageParam } from '../src/lib/pagination';

describe('parsePageParam', () => {
  it('defaults to 1 when the param is missing', () => {
    expect(parsePageParam('')).toBe(1);
  });

  it('reads a valid page number', () => {
    expect(parsePageParam('?page=3')).toBe(3);
  });

  it('defaults to 1 for non-numeric values', () => {
    expect(parsePageParam('?page=abc')).toBe(1);
  });

  it('defaults to 1 for zero or negative values', () => {
    expect(parsePageParam('?page=0')).toBe(1);
    expect(parsePageParam('?page=-5')).toBe(1);
  });

  it('defaults to 1 for non-integer values', () => {
    expect(parsePageParam('?page=2.5')).toBe(1);
  });
});
