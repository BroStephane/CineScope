import { describe, it, expect } from 'vitest';
import { buildDiscoverQuery, tmdbImageUrl } from '../src/lib/tmdb';

describe('buildDiscoverQuery', () => {
  it('includes only the params that were provided', () => {
    expect(buildDiscoverQuery({})).toEqual({ sort_by: 'popularity.desc' });
  });

  it('joins multiple genre ids with commas', () => {
    expect(buildDiscoverQuery({ genres: [28, 12] })).toEqual({
      sort_by: 'popularity.desc',
      with_genres: '28,12',
    });
  });

  it('adds year and minimum rating filters', () => {
    expect(buildDiscoverQuery({ year: 2024, minRating: 7 })).toEqual({
      sort_by: 'popularity.desc',
      primary_release_year: '2024',
      'vote_average.gte': '7',
    });
  });
});

describe('tmdbImageUrl', () => {
  it('returns null when path is null', () => {
    expect(tmdbImageUrl(null)).toBeNull();
  });

  it('builds a full image URL for a given size', () => {
    expect(tmdbImageUrl('/abc.jpg', 'w342')).toBe('https://image.tmdb.org/t/p/w342/abc.jpg');
  });
});
