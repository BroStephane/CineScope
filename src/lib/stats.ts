import type { TMDBMovieDetail } from './tmdb';
import { topGenres, topDirectors, type ProfileScores } from './recommend';

export interface WatchStats {
  totalWatched: number;
  totalMinutes: number;
  topGenreId: number | null;
  topDirectorId: number | null;
  favoriteDecade: number | null;
  // Average of (userRating*2 - tmdbVoteAverage) across rated+watched movies,
  // both put on a 0-10 scale — positive means you rate above the crowd
  // (indulgent), negative means below (severe). Null with no overlap data.
  ratingDelta: number | null;
  backlogMinutes: number;
  recentlyWatchedCount: number;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function computeWatchStats(
  watchedMovies: TMDBMovieDetail[],
  toWatchMovies: TMDBMovieDetail[],
  profile: ProfileScores,
  now = Date.now()
): WatchStats {
  const totalWatched = watchedMovies.length;
  const totalMinutes = watchedMovies.reduce((sum, m) => sum + (m.runtime || 0), 0);
  const backlogMinutes = toWatchMovies.reduce((sum, m) => sum + (m.runtime || 0), 0);

  const decadeCounts = new Map<number, number>();
  for (const m of watchedMovies) {
    const year = m.release_date ? Number(m.release_date.slice(0, 4)) : NaN;
    if (Number.isNaN(year)) continue;
    const decade = Math.floor(year / 10) * 10;
    decadeCounts.set(decade, (decadeCounts.get(decade) ?? 0) + 1);
  }
  let favoriteDecade: number | null = null;
  let bestCount = 0;
  for (const [decade, count] of decadeCounts) {
    if (count > bestCount) {
      bestCount = count;
      favoriteDecade = decade;
    }
  }

  const ratingDeltas: number[] = [];
  for (const m of watchedMovies) {
    const userRating = profile.ratings?.[m.id];
    if (userRating !== undefined) ratingDeltas.push(userRating * 2 - m.vote_average);
  }
  const ratingDelta =
    ratingDeltas.length > 0 ? ratingDeltas.reduce((sum, d) => sum + d, 0) / ratingDeltas.length : null;

  const recentlyWatchedCount = Object.values(profile.watchedAt ?? {}).filter((t) => now - t <= THIRTY_DAYS_MS).length;

  return {
    totalWatched,
    totalMinutes,
    topGenreId: topGenres(profile, 1)[0] ?? null,
    topDirectorId: topDirectors(profile, 1)[0] ?? null,
    favoriteDecade,
    ratingDelta,
    backlogMinutes,
    recentlyWatchedCount,
  };
}

export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days} j ${remainingHours} h` : `${days} j`;
}
