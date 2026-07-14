import { atom } from 'nanostores';
import {
  createEmptyProfile,
  recordView,
  recordFavorite,
  unfavorite,
  recordSwipeLike,
  recordSwipeDislike,
  resetSwipeDislikes,
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

// Profiles saved before swipedLiked/swipedDisliked existed won't have them —
// backfill instead of rejecting, so existing favorites/scores aren't wiped
// for users who already had the app installed.
function normalizeProfile(profile: ProfileScores): ProfileScores {
  return {
    ...profile,
    swipedLiked: profile.swipedLiked ?? [],
    swipedDisliked: profile.swipedDisliked ?? [],
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

export function resetProfile(): void {
  const empty = createEmptyProfile();
  profileStore.set(empty);
  persist(empty);
}
