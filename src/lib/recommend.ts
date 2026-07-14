export interface ProfileScores {
  genres: Record<number, number>;
  directors: Record<number, number>;
  favorites: number[];
  swipedLiked?: number[];
  swipedDisliked?: number[];
  watched?: number[];
  ratings?: Record<number, number>;
  // movieId -> timestamp (ms) it was added to swipedLiked. Only populated
  // going forward — entries swiped before this field existed have no key,
  // so "forgotten" checks treat missing entries as unknown age, not old.
  swipedLikedAt?: Record<number, number>;
  // movieId -> timestamp (ms) it was marked watched. Same "only populated
  // going forward" caveat as swipedLikedAt — powers stats/achievements.
  watchedAt?: Record<number, number>;
  // movieId -> free-text personal note. Independent of ratings (a number)
  // so a note can exist without a rating and vice versa.
  notes?: Record<number, string>;
}

export function createEmptyProfile(): ProfileScores {
  return {
    genres: {},
    directors: {},
    favorites: [],
    swipedLiked: [],
    swipedDisliked: [],
    watched: [],
    ratings: {},
    swipedLikedAt: {},
    watchedAt: {},
    notes: {},
  };
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

export function topDirectors(profile: ProfileScores, count = 1): number[] {
  return Object.entries(profile.directors)
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

const SWIPE_LIKE_GENRE_POINTS = 2;

// Lighter weight than recordFavorite (a swipe is a lighter signal than an
// explicit favorite) and doesn't credit a director — the swipe deck works
// from list-endpoint movies, which only carry genre_ids, not crew.
// `timestamp` defaults to Date.now() but is an explicit param so tests can
// pin it — it also powers the "forgotten for a long time" badge.
export function recordSwipeLike(
  profile: ProfileScores,
  movieId: number,
  genreIds: number[],
  timestamp = Date.now()
): ProfileScores {
  const genres = { ...profile.genres };
  for (const id of genreIds) {
    genres[id] = (genres[id] ?? 0) + SWIPE_LIKE_GENRE_POINTS;
  }
  const swipedLiked = profile.swipedLiked ?? [];
  const nextSwipedLiked = swipedLiked.includes(movieId) ? swipedLiked : [...swipedLiked, movieId];
  const swipedLikedAt = { ...(profile.swipedLikedAt ?? {}) };
  if (!(movieId in swipedLikedAt)) swipedLikedAt[movieId] = timestamp;
  return { ...profile, genres, swipedLiked: nextSwipedLiked, swipedLikedAt };
}

const FORGOTTEN_THRESHOLD_MS = 45 * 24 * 60 * 60 * 1000; // 45 days

// True only when we actually know the movie was added long ago — missing
// timestamps (pre-existing entries, or ones added via favorites/import) are
// treated as unknown age, not old, so we never claim knowledge we don't have.
export function isForgotten(profile: ProfileScores, movieId: number, now = Date.now()): boolean {
  const addedAt = profile.swipedLikedAt?.[movieId];
  if (addedAt === undefined) return false;
  return now - addedAt > FORGOTTEN_THRESHOLD_MS;
}

// Deliberately does not penalize genre scores — the algorithm only excludes
// passed movies from future candidate pools, it doesn't punish taste signals.
export function recordSwipeDislike(profile: ProfileScores, movieId: number): ProfileScores {
  const swipedDisliked = profile.swipedDisliked ?? [];
  if (swipedDisliked.includes(movieId)) return profile;
  return { ...profile, swipedDisliked: [...swipedDisliked, movieId] };
}

export function resetSwipeDislikes(profile: ProfileScores): ProfileScores {
  return { ...profile, swipedDisliked: [] };
}

export function excludeSwiped<T extends { id: number }>(movies: T[], profile: ProfileScores): T[] {
  const excluded = new Set([
    ...profile.favorites,
    ...(profile.swipedLiked ?? []),
    ...(profile.swipedDisliked ?? []),
  ]);
  return movies.filter((movie) => !excluded.has(movie.id));
}

const WATCHED_GENRE_POINTS = 3;

// Between the weight of a simple detail-page view (+1, automatic on every
// visit) and an explicit favorite (+5) — marking a movie watched is a
// deliberate action but a lighter taste signal than favoriting it.
// `timestamp` mirrors recordSwipeLike's pattern: defaults to Date.now(),
// explicit param so tests can pin it, powers stats/achievements.
export function recordWatched(
  profile: ProfileScores,
  movieId: number,
  genreIds: number[],
  timestamp = Date.now()
): ProfileScores {
  const genres = { ...profile.genres };
  for (const id of genreIds) {
    genres[id] = (genres[id] ?? 0) + WATCHED_GENRE_POINTS;
  }
  const watched = profile.watched ?? [];
  const nextWatched = watched.includes(movieId) ? watched : [...watched, movieId];
  const watchedAt = { ...(profile.watchedAt ?? {}) };
  if (!(movieId in watchedAt)) watchedAt[movieId] = timestamp;
  return { ...profile, genres, watched: nextWatched, watchedAt };
}

// Same rationale as unfavorite — doesn't reverse the genre score contribution.
export function unwatch(profile: ProfileScores, movieId: number): ProfileScores {
  return { ...profile, watched: (profile.watched ?? []).filter((id) => id !== movieId) };
}

export function excludeWatched<T extends { id: number }>(movies: T[], profile: ProfileScores): T[] {
  const watched = profile.watched ?? [];
  return movies.filter((movie) => !watched.includes(movie.id));
}

// Unlike the discrete toggles above (favorite/watched/swipe), a rating is a
// mutable value the user can change their mind about — the genre score must
// track the *current* rating, so changing it applies only the delta rather
// than re-adding the full new value.
export function recordRating(
  profile: ProfileScores,
  movieId: number,
  rating: number,
  genreIds: number[]
): ProfileScores {
  const ratings = { ...(profile.ratings ?? {}) };
  const previous = ratings[movieId] ?? 0;
  const delta = rating - previous;
  const genres = { ...profile.genres };
  for (const id of genreIds) {
    genres[id] = (genres[id] ?? 0) + delta;
  }
  ratings[movieId] = rating;
  return { ...profile, genres, ratings };
}

export function removeRating(profile: ProfileScores, movieId: number, genreIds: number[]): ProfileScores {
  const ratings = { ...(profile.ratings ?? {}) };
  const previous = ratings[movieId];
  if (previous === undefined) return profile;
  delete ratings[movieId];
  const genres = { ...profile.genres };
  for (const id of genreIds) {
    genres[id] = (genres[id] ?? 0) - previous;
  }
  return { ...profile, genres, ratings };
}

// A note is presentation data, not a taste signal — unlike ratings/favorites,
// setting or clearing one never touches genre/director scores.
export function setNote(profile: ProfileScores, movieId: number, text: string): ProfileScores {
  const notes = { ...(profile.notes ?? {}) };
  const trimmed = text.trim();
  if (trimmed === '') {
    delete notes[movieId];
  } else {
    notes[movieId] = trimmed;
  }
  return { ...profile, notes };
}
