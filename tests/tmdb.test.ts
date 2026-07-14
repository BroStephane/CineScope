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

  it('overrides sort_by when sortBy is provided', () => {
    expect(buildDiscoverQuery({ sortBy: 'vote_average.desc' })).toEqual({
      sort_by: 'vote_average.desc',
    });
  });

  it('adds a minimum vote count filter', () => {
    expect(buildDiscoverQuery({ minVoteCount: 300 })).toEqual({
      sort_by: 'popularity.desc',
      'vote_count.gte': '300',
    });
  });

  it('joins multiple genre ids with a pipe when genreMatch is "any"', () => {
    expect(buildDiscoverQuery({ genres: [28, 12], genreMatch: 'any' })).toEqual({
      sort_by: 'popularity.desc',
      with_genres: '28|12',
    });
  });

  it('adds original language and runtime range filters', () => {
    expect(buildDiscoverQuery({ originalLanguage: 'ja', minRuntime: 90, maxRuntime: 120 })).toEqual({
      sort_by: 'popularity.desc',
      with_original_language: 'ja',
      'with_runtime.gte': '90',
      'with_runtime.lte': '120',
    });
  });

  it('adds a maximum release date filter', () => {
    expect(buildDiscoverQuery({ maxReleaseDate: '2026-07-14' })).toEqual({
      sort_by: 'popularity.desc',
      'primary_release_date.lte': '2026-07-14',
    });
  });

  it('adds a minimum release date filter', () => {
    expect(buildDiscoverQuery({ minReleaseDate: '1990-01-01' })).toEqual({
      sort_by: 'popularity.desc',
      'primary_release_date.gte': '1990-01-01',
    });
  });

  it('combines minReleaseDate and maxReleaseDate for a decade range', () => {
    expect(buildDiscoverQuery({ minReleaseDate: '1990-01-01', maxReleaseDate: '1999-12-31' })).toEqual({
      sort_by: 'popularity.desc',
      'primary_release_date.gte': '1990-01-01',
      'primary_release_date.lte': '1999-12-31',
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
