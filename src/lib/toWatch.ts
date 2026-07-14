import { getMovieDetail, type TMDBMovieDetail } from './tmdb';
import { topGenres, type ProfileScores } from './recommend';

// Shared by every "decide for me" feature (roulette, duel, tonight
// assistant, time-fit widget): the "à voir" list is swipedLiked, not
// favorites (see ProfileView) — full detail is needed everywhere for
// runtime/genres, so this fetches once and lets callers filter further.
export async function getToWatchMovies(profile: ProfileScores): Promise<TMDBMovieDetail[]> {
  const watched = new Set(profile.watched ?? []);
  const ids = (profile.swipedLiked ?? []).filter((id) => !watched.has(id));
  const results = await Promise.allSettled(ids.map((id) => getMovieDetail(id)));
  return results
    .filter((r): r is PromiseFulfilledResult<TMDBMovieDetail> => r.status === 'fulfilled')
    .map((r) => r.value);
}

// Full detail for every watched movie — used by stats/achievements, which
// need runtime and release_date, not just the bare ids profile.watched holds.
export async function getWatchedMovies(profile: ProfileScores): Promise<TMDBMovieDetail[]> {
  const results = await Promise.allSettled((profile.watched ?? []).map((id) => getMovieDetail(id)));
  return results
    .filter((r): r is PromiseFulfilledResult<TMDBMovieDetail> => r.status === 'fulfilled')
    .map((r) => r.value);
}

// Picks one movie at random, weighting toward the user's top genres so
// "surprise me" leans on known taste without being fully deterministic.
// `random` is injectable so callers/tests can pin the outcome.
export function pickWeighted<T extends { genre_ids?: number[]; genres?: { id: number }[] }>(
  movies: T[],
  profile: ProfileScores,
  random: () => number = Math.random
): T | null {
  if (movies.length === 0) return null;
  const preferred = new Set(topGenres(profile, 3));
  const weights = movies.map((m) => {
    const ids = m.genre_ids ?? m.genres?.map((g) => g.id) ?? [];
    const matches = ids.filter((id) => preferred.has(id)).length;
    return 1 + matches * 2;
  });
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = random() * total;
  for (let i = 0; i < movies.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return movies[i];
  }
  return movies[movies.length - 1];
}
