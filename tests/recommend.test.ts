import { describe, it, expect } from 'vitest';
import {
  createEmptyProfile,
  recordView,
  recordFavorite,
  topGenres,
  excludeFavorites,
} from '../src/lib/recommend';

describe('recordView', () => {
  it('adds 1 point to each genre visited', () => {
    const profile = recordView(createEmptyProfile(), [28, 12]);
    expect(profile.genres).toEqual({ 28: 1, 12: 1 });
  });

  it('accumulates points across repeated views', () => {
    let profile = createEmptyProfile();
    profile = recordView(profile, [28]);
    profile = recordView(profile, [28]);
    expect(profile.genres[28]).toBe(2);
  });
});

describe('recordFavorite', () => {
  it('adds 5 points per genre and 3 to the director', () => {
    const profile = recordFavorite(createEmptyProfile(), 100, [28, 12], 500);
    expect(profile.genres).toEqual({ 28: 5, 12: 5 });
    expect(profile.directors).toEqual({ 500: 3 });
    expect(profile.favorites).toEqual([100]);
  });

  it('does not duplicate a movie already favorited', () => {
    let profile = recordFavorite(createEmptyProfile(), 100, [28], 500);
    profile = recordFavorite(profile, 100, [28], 500);
    expect(profile.favorites).toEqual([100]);
    expect(profile.genres[28]).toBe(10);
  });
});

describe('topGenres', () => {
  it('returns the top N genres sorted by score descending', () => {
    const profile = { genres: { 1: 3, 2: 9, 3: 5 }, directors: {}, favorites: [] };
    expect(topGenres(profile, 2)).toEqual([2, 3]);
  });

  it('returns an empty array when there are no genres yet', () => {
    expect(topGenres(createEmptyProfile())).toEqual([]);
  });
});

describe('excludeFavorites', () => {
  it('filters out movies whose id is already in favorites', () => {
    const profile = { genres: {}, directors: {}, favorites: [1, 3] };
    const movies = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(excludeFavorites(movies, profile)).toEqual([{ id: 2 }]);
  });
});
