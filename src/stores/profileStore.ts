import { atom } from 'nanostores';
import { createEmptyProfile, recordView, recordFavorite, unfavorite, type ProfileScores } from '../lib/recommend';
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

function loadProfile(): ProfileScores {
  const raw = getItem(STORAGE_KEY);
  if (!raw) return createEmptyProfile();
  try {
    const parsed = JSON.parse(raw);
    return isValidProfile(parsed) ? parsed : createEmptyProfile();
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

export function resetProfile(): void {
  const empty = createEmptyProfile();
  profileStore.set(empty);
  persist(empty);
}
