import { describe, it, expect } from 'vitest';
import { ACHIEVEMENTS } from '../src/lib/achievements';
import { createEmptyProfile } from '../src/lib/recommend';

function findAchievement(id: string) {
  const achievement = ACHIEVEMENTS.find((a) => a.id === id);
  if (!achievement) throw new Error(`Missing achievement: ${id}`);
  return achievement;
}

describe('achievements', () => {
  it('every achievement is locked for a brand new empty profile', () => {
    const ctx = { profile: createEmptyProfile(), watchedMovies: [] };
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.isUnlocked(ctx)).toBe(false);
    }
  });

  it('first-watch unlocks with a single watched movie', () => {
    const profile = { ...createEmptyProfile(), watched: [1] };
    expect(findAchievement('first-watch').isUnlocked({ profile, watchedMovies: [] })).toBe(true);
  });

  it('cinephile requires 25 watched, not fewer', () => {
    const achievement = findAchievement('cinephile');
    const almost = { ...createEmptyProfile(), watched: Array.from({ length: 24 }, (_, i) => i) };
    const enough = { ...createEmptyProfile(), watched: Array.from({ length: 25 }, (_, i) => i) };
    expect(achievement.isUnlocked({ profile: almost, watchedMovies: [] })).toBe(false);
    expect(achievement.isUnlocked({ profile: enough, watchedMovies: [] })).toBe(true);
  });

  it('explorer requires 8 genres with positive score', () => {
    const achievement = findAchievement('explorer');
    const sevenGenres = { ...createEmptyProfile(), genres: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1 } };
    const eightGenres = { ...createEmptyProfile(), genres: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1 } };
    expect(achievement.isUnlocked({ profile: sevenGenres, watchedMovies: [] })).toBe(false);
    expect(achievement.isUnlocked({ profile: eightGenres, watchedMovies: [] })).toBe(true);
  });

  it('archaeologist requires a watched movie released 50+ years ago', () => {
    const achievement = findAchievement('archaeologist');
    const oldYear = new Date().getFullYear() - 60;
    const recentYear = new Date().getFullYear() - 5;
    const recentMovie = { id: 1, release_date: `${recentYear}-01-01` } as any;
    const oldMovie = { id: 2, release_date: `${oldYear}-01-01` } as any;
    expect(achievement.isUnlocked({ profile: createEmptyProfile(), watchedMovies: [recentMovie] })).toBe(false);
    expect(achievement.isUnlocked({ profile: createEmptyProfile(), watchedMovies: [oldMovie] })).toBe(true);
  });

  it('curious counts both swipedLiked and swipedDisliked toward the total', () => {
    const achievement = findAchievement('curious');
    const profile = {
      ...createEmptyProfile(),
      swipedLiked: Array.from({ length: 30 }, (_, i) => i),
      swipedDisliked: Array.from({ length: 20 }, (_, i) => i + 1000),
    };
    expect(achievement.isUnlocked({ profile, watchedMovies: [] })).toBe(true);
  });
});
