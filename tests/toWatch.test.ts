import { describe, it, expect } from 'vitest';
import { pickWeighted } from '../src/lib/toWatch';
import { createEmptyProfile } from '../src/lib/recommend';

describe('pickWeighted', () => {
  it('returns null for an empty list', () => {
    expect(pickWeighted([], createEmptyProfile())).toBeNull();
  });

  it('returns the only movie when there is just one', () => {
    const movies = [{ id: 1, genre_ids: [28] }];
    expect(pickWeighted(movies, createEmptyProfile())).toEqual(movies[0]);
  });

  it('weights movies matching top genres more heavily', () => {
    const profile = { ...createEmptyProfile(), genres: { 28: 10 } };
    const movies = [
      { id: 1, genre_ids: [28] }, // weight 3
      { id: 2, genre_ids: [99] }, // weight 1
    ];
    // roll=0 always lands on the first positive-weight bucket it hits
    expect(pickWeighted(movies, profile, () => 0)?.id).toBe(1);
    // a roll just past movie 1's weight (3/4 of total) should land on movie 2
    expect(pickWeighted(movies, profile, () => 0.99)?.id).toBe(2);
  });

  it('works with TMDBMovieDetail-shaped genres as well as genre_ids', () => {
    const profile = { ...createEmptyProfile(), genres: { 28: 10 } };
    const movies = [{ id: 1, genres: [{ id: 28, name: 'Action' }] }];
    expect(pickWeighted(movies, profile, () => 0)?.id).toBe(1);
  });
});
