import { describe, it, expect } from 'vitest';
import {
  createEmptyProfile,
  recordView,
  recordFavorite,
  unfavorite,
  topGenres,
  excludeFavorites,
  recordSwipeLike,
  recordSwipeDislike,
  resetSwipeDislikes,
  excludeSwiped,
  recordWatched,
  unwatch,
  excludeWatched,
  recordRating,
  removeRating,
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

describe('unfavorite', () => {
  it('removes the movie id from favorites', () => {
    const profile = { genres: {}, directors: {}, favorites: [1, 2, 3] };
    expect(unfavorite(profile, 2).favorites).toEqual([1, 3]);
  });

  it('is a no-op when the id is not present', () => {
    const profile = { genres: {}, directors: {}, favorites: [1, 3] };
    expect(unfavorite(profile, 99).favorites).toEqual([1, 3]);
  });

  it('does not mutate the input profile', () => {
    const profile = { genres: {}, directors: {}, favorites: [1, 2] };
    unfavorite(profile, 1);
    expect(profile.favorites).toEqual([1, 2]);
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

describe('recordSwipeLike', () => {
  it('adds 2 points per genre and appends the movie id to swipedLiked', () => {
    const profile = recordSwipeLike(createEmptyProfile(), 200, [28, 12]);
    expect(profile.genres).toEqual({ 28: 2, 12: 2 });
    expect(profile.swipedLiked).toEqual([200]);
  });

  it('does not duplicate a movie id already swiped-liked', () => {
    let profile = recordSwipeLike(createEmptyProfile(), 200, [28]);
    profile = recordSwipeLike(profile, 200, [28]);
    expect(profile.swipedLiked).toEqual([200]);
    expect(profile.genres[28]).toBe(4);
  });
});

describe('recordSwipeDislike', () => {
  it('appends the movie id to swipedDisliked without touching scores', () => {
    const profile = recordSwipeDislike(createEmptyProfile(), 300);
    expect(profile.swipedDisliked).toEqual([300]);
    expect(profile.genres).toEqual({});
  });

  it('does not duplicate a movie id already swiped-disliked', () => {
    let profile = recordSwipeDislike(createEmptyProfile(), 300);
    profile = recordSwipeDislike(profile, 300);
    expect(profile.swipedDisliked).toEqual([300]);
  });
});

describe('resetSwipeDislikes', () => {
  it('clears swipedDisliked but keeps swipedLiked and scores', () => {
    let profile = recordSwipeLike(createEmptyProfile(), 1, [28]);
    profile = recordSwipeDislike(profile, 2);
    profile = resetSwipeDislikes(profile);
    expect(profile.swipedDisliked).toEqual([]);
    expect(profile.swipedLiked).toEqual([1]);
    expect(profile.genres).toEqual({ 28: 2 });
  });
});

describe('excludeSwiped', () => {
  it('filters out favorited, swiped-liked and swiped-disliked ids', () => {
    const profile = { genres: {}, directors: {}, favorites: [1], swipedLiked: [2], swipedDisliked: [3] };
    const movies = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    expect(excludeSwiped(movies, profile)).toEqual([{ id: 4 }]);
  });

  it('treats missing swipedLiked/swipedDisliked as empty', () => {
    const profile = { genres: {}, directors: {}, favorites: [1] };
    const movies = [{ id: 1 }, { id: 2 }];
    expect(excludeSwiped(movies, profile)).toEqual([{ id: 2 }]);
  });
});

describe('recordWatched', () => {
  it('adds 3 points per genre and appends the movie id to watched', () => {
    const profile = recordWatched(createEmptyProfile(), 400, [28, 12]);
    expect(profile.genres).toEqual({ 28: 3, 12: 3 });
    expect(profile.watched).toEqual([400]);
  });

  it('does not duplicate a movie id already watched', () => {
    let profile = recordWatched(createEmptyProfile(), 400, [28]);
    profile = recordWatched(profile, 400, [28]);
    expect(profile.watched).toEqual([400]);
    expect(profile.genres[28]).toBe(6);
  });
});

describe('unwatch', () => {
  it('removes the movie id from watched without touching scores', () => {
    let profile = recordWatched(createEmptyProfile(), 400, [28]);
    profile = unwatch(profile, 400);
    expect(profile.watched).toEqual([]);
    expect(profile.genres[28]).toBe(3);
  });

  it('is a no-op when the id is not present', () => {
    const profile = { genres: {}, directors: {}, favorites: [], watched: [1, 3] };
    expect(unwatch(profile, 99).watched).toEqual([1, 3]);
  });
});

describe('excludeWatched', () => {
  it('filters out movies whose id is already watched', () => {
    const profile = { genres: {}, directors: {}, favorites: [], watched: [2] };
    const movies = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(excludeWatched(movies, profile)).toEqual([{ id: 1 }, { id: 3 }]);
  });

  it('treats a missing watched list as empty', () => {
    const profile = { genres: {}, directors: {}, favorites: [] };
    const movies = [{ id: 1 }];
    expect(excludeWatched(movies, profile)).toEqual([{ id: 1 }]);
  });
});

describe('recordRating', () => {
  it('adds genre points equal to the rating and stores it', () => {
    const profile = recordRating(createEmptyProfile(), 500, 4, [28, 12]);
    expect(profile.genres).toEqual({ 28: 4, 12: 4 });
    expect(profile.ratings).toEqual({ 500: 4 });
  });

  it('only applies the delta when changing an existing rating', () => {
    let profile = recordRating(createEmptyProfile(), 500, 3, [28]);
    profile = recordRating(profile, 500, 5, [28]);
    expect(profile.genres[28]).toBe(5);
    expect(profile.ratings).toEqual({ 500: 5 });
  });

  it('subtracts genre points when lowering a rating', () => {
    let profile = recordRating(createEmptyProfile(), 500, 5, [28]);
    profile = recordRating(profile, 500, 2, [28]);
    expect(profile.genres[28]).toBe(2);
    expect(profile.ratings).toEqual({ 500: 2 });
  });
});

describe('removeRating', () => {
  it('removes the rating and subtracts its genre points', () => {
    let profile = recordRating(createEmptyProfile(), 500, 4, [28]);
    profile = removeRating(profile, 500, [28]);
    expect(profile.genres[28]).toBe(0);
    expect(profile.ratings).toEqual({});
  });

  it('is a no-op when the movie has no rating', () => {
    const profile = createEmptyProfile();
    expect(removeRating(profile, 999, [28])).toEqual(profile);
  });
});
