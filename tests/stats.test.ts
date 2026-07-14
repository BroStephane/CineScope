import { describe, it, expect } from 'vitest';
import { computeWatchStats, formatMinutes } from '../src/lib/stats';
import { createEmptyProfile } from '../src/lib/recommend';

function movie(overrides: Partial<Parameters<typeof computeWatchStats>[0][number]> = {}) {
  return {
    id: 1,
    title: 'Test',
    poster_path: null,
    backdrop_path: null,
    overview: '',
    release_date: '1995-06-01',
    vote_average: 7,
    runtime: 100,
    genres: [],
    belongs_to_collection: null,
    ...overrides,
  } as Parameters<typeof computeWatchStats>[0][number];
}

describe('computeWatchStats', () => {
  it('returns zeros/nulls for an empty profile and no movies', () => {
    const stats = computeWatchStats([], [], createEmptyProfile());
    expect(stats).toEqual({
      totalWatched: 0,
      totalMinutes: 0,
      topGenreId: null,
      topDirectorId: null,
      favoriteDecade: null,
      ratingDelta: null,
      backlogMinutes: 0,
      recentlyWatchedCount: 0,
    });
  });

  it('sums runtime across watched and backlog movies separately', () => {
    const watched = [movie({ id: 1, runtime: 90 }), movie({ id: 2, runtime: 120 })];
    const toWatch = [movie({ id: 3, runtime: 100 })];
    const stats = computeWatchStats(watched, toWatch, createEmptyProfile());
    expect(stats.totalMinutes).toBe(210);
    expect(stats.backlogMinutes).toBe(100);
    expect(stats.totalWatched).toBe(2);
  });

  it('picks the decade with the most watched movies', () => {
    const watched = [
      movie({ id: 1, release_date: '1995-01-01' }),
      movie({ id: 2, release_date: '1998-01-01' }),
      movie({ id: 3, release_date: '2010-01-01' }),
    ];
    const stats = computeWatchStats(watched, [], createEmptyProfile());
    expect(stats.favoriteDecade).toBe(1990);
  });

  it('computes a positive ratingDelta when the user rates above TMDB average', () => {
    const watched = [movie({ id: 1, vote_average: 5 })];
    const profile = { ...createEmptyProfile(), ratings: { 1: 5 } }; // 5*2=10 vs tmdb 5 -> +5
    const stats = computeWatchStats(watched, [], profile);
    expect(stats.ratingDelta).toBe(5);
  });

  it('computes a negative ratingDelta when the user rates below TMDB average', () => {
    const watched = [movie({ id: 1, vote_average: 9 })];
    const profile = { ...createEmptyProfile(), ratings: { 1: 2 } }; // 2*2=4 vs tmdb 9 -> -5
    const stats = computeWatchStats(watched, [], profile);
    expect(stats.ratingDelta).toBe(-5);
  });

  it('only counts watchedAt entries within the last 30 days as recent', () => {
    const now = 1_000_000_000_000;
    const profile = {
      ...createEmptyProfile(),
      watchedAt: {
        1: now - 5 * 24 * 60 * 60 * 1000, // 5 days ago: recent
        2: now - 60 * 24 * 60 * 60 * 1000, // 60 days ago: not recent
      },
    };
    const stats = computeWatchStats([], [], profile, now);
    expect(stats.recentlyWatchedCount).toBe(1);
  });
});

describe('formatMinutes', () => {
  it('formats under an hour as minutes', () => {
    expect(formatMinutes(45)).toBe('45 min');
  });

  it('formats under a day as hours', () => {
    expect(formatMinutes(150)).toBe('2 h');
  });

  it('formats a day or more as days and hours', () => {
    expect(formatMinutes(26 * 60)).toBe('1 j 2 h');
  });

  it('omits hours when exactly on a day boundary', () => {
    expect(formatMinutes(48 * 60)).toBe('2 j');
  });

  it('treats zero or negative as 0 min', () => {
    expect(formatMinutes(0)).toBe('0 min');
    expect(formatMinutes(-5)).toBe('0 min');
  });
});
