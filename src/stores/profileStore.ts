import { atom } from 'nanostores';
import {
  createEmptyProfile,
  recordView,
  recordFavorite,
  unfavorite,
  recordSwipeLike,
  recordSwipeDislike,
  resetSwipeDislikes,
  recordWatched,
  unwatch,
  recordRating,
  removeRating,
  type ProfileScores,
} from '../lib/recommend';
import { getItem, setItem } from '../lib/storage';

const STORAGE_KEY = 'cinescope:profile';

function isValidProfile(value: unknown): value is ProfileScores {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<ProfileScores>;
  return (
    typeof candidate.genres === 'object' &&
    candidate.genres !== null &&
    typeof candidate.directors === 'object' &&
    candidate.directors !== null &&
    Array.isArray(candidate.favorites)
  );
}

// Profiles saved before swipedLiked/swipedDisliked/watched existed won't have
// them — backfill instead of rejecting, so existing favorites/scores aren't
// wiped for users who already had the app installed, and so an older
// exported backup can still be imported today.
function normalizeProfile(profile: ProfileScores): ProfileScores {
  return {
    ...profile,
    swipedLiked: profile.swipedLiked ?? [],
    swipedDisliked: profile.swipedDisliked ?? [],
    watched: profile.watched ?? [],
    ratings: profile.ratings ?? {},
    swipedLikedAt: profile.swipedLikedAt ?? {},
  };
}

function loadProfile(): ProfileScores {
  const raw = getItem(STORAGE_KEY);
  if (!raw) return createEmptyProfile();
  try {
    const parsed = JSON.parse(raw);
    return isValidProfile(parsed) ? normalizeProfile(parsed) : createEmptyProfile();
  } catch {
    return createEmptyProfile();
  }
}

export const profileStore = atom<ProfileScores>(loadProfile());

function persist(profile: ProfileScores) {
  setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function viewMovie(genreIds: number[]): void {
  const next = recordView(profileStore.get(), genreIds);
  profileStore.set(next);
  persist(next);
}

export function favoriteMovie(movieId: number, genreIds: number[], directorId?: number): void {
  const current = profileStore.get();
  if (current.favorites.includes(movieId)) return;
  const next = recordFavorite(current, movieId, genreIds, directorId);
  profileStore.set(next);
  persist(next);
}

export function unfavoriteMovie(movieId: number): void {
  const next = unfavorite(profileStore.get(), movieId);
  profileStore.set(next);
  persist(next);
}

export function swipeLikeMovie(movieId: number, genreIds: number[]): void {
  const current = profileStore.get();
  if ((current.swipedLiked ?? []).includes(movieId)) return;
  const next = recordSwipeLike(current, movieId, genreIds);
  profileStore.set(next);
  persist(next);
}

export function swipeDislikeMovie(movieId: number): void {
  const current = profileStore.get();
  if ((current.swipedDisliked ?? []).includes(movieId)) return;
  const next = recordSwipeDislike(current, movieId);
  profileStore.set(next);
  persist(next);
}

export function clearSwipeDislikes(): void {
  const next = resetSwipeDislikes(profileStore.get());
  profileStore.set(next);
  persist(next);
}

export function markWatched(movieId: number, genreIds: number[]): void {
  const current = profileStore.get();
  if ((current.watched ?? []).includes(movieId)) return;
  const next = recordWatched(current, movieId, genreIds);
  profileStore.set(next);
  persist(next);
}

export function unmarkWatched(movieId: number): void {
  const next = unwatch(profileStore.get(), movieId);
  profileStore.set(next);
  persist(next);
}

export function rateMovie(movieId: number, rating: number, genreIds: number[]): void {
  const next = recordRating(profileStore.get(), movieId, rating, genreIds);
  profileStore.set(next);
  persist(next);
}

export function unrateMovie(movieId: number, genreIds: number[]): void {
  const next = removeRating(profileStore.get(), movieId, genreIds);
  profileStore.set(next);
  persist(next);
}

export function exportProfile(): string {
  return JSON.stringify(profileStore.get(), null, 2);
}

export function importProfile(json: string): boolean {
  try {
    const parsed = JSON.parse(json);
    if (!isValidProfile(parsed)) return false;
    const next = normalizeProfile(parsed);
    profileStore.set(next);
    persist(next);
    return true;
  } catch {
    return false;
  }
}

export function resetProfile(): void {
  const empty = createEmptyProfile();
  profileStore.set(empty);
  persist(empty);
}
