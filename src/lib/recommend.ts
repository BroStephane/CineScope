export interface ProfileScores {
  genres: Record<number, number>;
  directors: Record<number, number>;
  favorites: number[];
}

export function createEmptyProfile(): ProfileScores {
  return { genres: {}, directors: {}, favorites: [] };
}

// Intentionally called on every visit, unguarded — views are meant to accumulate as an engagement signal (unlike recordFavorite, a discrete action).
export function recordView(profile: ProfileScores, genreIds: number[]): ProfileScores {
  const genres = { ...profile.genres };
  for (const id of genreIds) {
    genres[id] = (genres[id] ?? 0) + 1;
  }
  return { ...profile, genres };
}

// Not idempotent for scoring: calling this twice for the same movieId double-counts genre/director points (only the favorites-list entry is deduped). Callers must not invoke this more than once per movie.
export function recordFavorite(
  profile: ProfileScores,
  movieId: number,
  genreIds: number[],
  directorId?: number
): ProfileScores {
  const genres = { ...profile.genres };
  for (const id of genreIds) {
    genres[id] = (genres[id] ?? 0) + 5;
  }
  const directors = { ...profile.directors };
  if (directorId !== undefined) {
    directors[directorId] = (directors[directorId] ?? 0) + 3;
  }
  const favorites = profile.favorites.includes(movieId)
    ? profile.favorites
    : [...profile.favorites, movieId];
  return { ...profile, genres, directors, favorites };
}

// Intentionally does not reverse the genre/director score contribution — removing a favorite doesn't undo what it taught us about taste.
export function unfavorite(profile: ProfileScores, movieId: number): ProfileScores {
  return { ...profile, favorites: profile.favorites.filter((id) => id !== movieId) };
}

export function topGenres(profile: ProfileScores, count = 2): number[] {
  return Object.entries(profile.genres)
    .sort(([, a], [, b]) => b - a)
    .slice(0, count)
    .map(([id]) => Number(id));
}

export function excludeFavorites<T extends { id: number }>(
  movies: T[],
  profile: ProfileScores
): T[] {
  return movies.filter((movie) => !profile.favorites.includes(movie.id));
}
