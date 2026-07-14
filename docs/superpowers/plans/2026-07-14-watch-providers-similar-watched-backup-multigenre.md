# Où regarder, films similaires, historique, sauvegarde, multi-genres Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five front-end-only features on top of the existing TMDB + `localStorage` architecture: watch-providers availability and similar movies on the movie detail page, a "watched" history dimension (distinct from favorites and the swipe-liked list), a manual JSON export/import backup for the local profile, and a multi-genre ("any of") filter on the search page.

**Architecture:** Extend `getMovieDetail`'s existing `append_to_response` (already `credits,videos`) to also pull `similar` and `watch/providers` in the same request — no new TMDB fetcher functions needed for those two. Extend `recommend.ts`/`profileStore.ts` with a `watched` list and matching pure functions/actions, mirroring the existing `swipedLiked`/`swipedDisliked` pattern exactly, including the same profile-migration safety net. Add `genreMatch` to `DiscoverParams` for OR-style multi-genre queries, defaulting to the existing AND behavior so no other caller changes.

**Tech Stack:** Astro, React islands, TypeScript strict, Vitest for the pure-logic pieces — same as every prior round.

---

## Reference: full spec

`docs/superpowers/specs/2026-07-14-watch-providers-similar-watched-backup-multigenre-design.md` — read it before starting if anything below is unclear.

## Task 1: `getMovieDetail` pulls `similar` and `watch/providers`

**Files:**
- Modify: `src/lib/tmdb.ts`

- [ ] **Step 1: Add the watch-provider types and extend `TMDBMovieDetail`**

Replace:

```ts
export interface TMDBMovieDetail extends TMDBMovie {
  runtime: number;
  genres: { id: number; name: string }[];
  credits?: { cast: TMDBCastMember[]; crew: TMDBCrewMember[] };
  videos?: { results: TMDBVideo[] };
}
```

with:

```ts
export interface TMDBWatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

export interface TMDBWatchProviderRegion {
  link: string;
  flatrate?: TMDBWatchProvider[];
  rent?: TMDBWatchProvider[];
  buy?: TMDBWatchProvider[];
}

export interface TMDBMovieDetail extends TMDBMovie {
  runtime: number;
  genres: { id: number; name: string }[];
  credits?: { cast: TMDBCastMember[]; crew: TMDBCrewMember[] };
  videos?: { results: TMDBVideo[] };
  similar?: TMDBListResponse<TMDBMovie>;
  'watch/providers'?: { results: Record<string, TMDBWatchProviderRegion> };
}
```

(`TMDBListResponse` is declared later in the file — that's fine, TypeScript type declarations aren't order-dependent within a module.)

- [ ] **Step 2: Extend the `append_to_response` value**

Replace:

```ts
export function getMovieDetail(id: number, signal?: AbortSignal): Promise<TMDBMovieDetail> {
  return tmdbFetch(`/movie/${id}`, { append_to_response: 'credits,videos' }, signal);
}
```

with:

```ts
export function getMovieDetail(id: number, signal?: AbortSignal): Promise<TMDBMovieDetail> {
  return tmdbFetch(`/movie/${id}`, { append_to_response: 'credits,videos,similar,watch/providers' }, signal);
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/tmdb.ts
git commit -m "feat(tmdb): fetch similar movies and watch providers alongside movie detail"
```

## Task 2: `DiscoverParams` gains `genreMatch` (TDD)

**Files:**
- Modify: `src/lib/tmdb.ts`
- Test: `tests/tmdb.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/tmdb.test.ts`, inside `describe('buildDiscoverQuery', ...)`:

```ts
  it('joins multiple genre ids with a pipe when genreMatch is "any"', () => {
    expect(buildDiscoverQuery({ genres: [28, 12], genreMatch: 'any' })).toEqual({
      sort_by: 'popularity.desc',
      with_genres: '28|12',
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tmdb`
Expected: FAIL — TypeScript error (`genreMatch` doesn't exist on `DiscoverParams`) or the assertion fails because the field is ignored.

- [ ] **Step 3: Implement**

Replace:

```ts
export interface DiscoverParams {
  genres?: number[];
  year?: number;
  minRating?: number;
  minVoteCount?: number;
  sortBy?: string;
}

export function buildDiscoverQuery(params: DiscoverParams): Record<string, string> {
  const query: Record<string, string> = { sort_by: params.sortBy ?? 'popularity.desc' };
  if (params.genres && params.genres.length > 0) {
    query.with_genres = params.genres.join(',');
  }
```

with:

```ts
export interface DiscoverParams {
  genres?: number[];
  genreMatch?: 'all' | 'any';
  year?: number;
  minRating?: number;
  minVoteCount?: number;
  sortBy?: string;
}

export function buildDiscoverQuery(params: DiscoverParams): Record<string, string> {
  const query: Record<string, string> = { sort_by: params.sortBy ?? 'popularity.desc' };
  if (params.genres && params.genres.length > 0) {
    query.with_genres = params.genres.join(params.genreMatch === 'any' ? '|' : ',');
  }
```

(Everything below — year/minRating/minVoteCount handling — stays the same. No existing caller passes `genreMatch`, so every other call site keeps today's comma/AND behavior.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tmdb`
Expected: PASS (all `buildDiscoverQuery` tests, including the new one).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tmdb.ts tests/tmdb.test.ts
git commit -m "feat(tmdb): add genreMatch (all/any) to discover queries"
```

## Task 3: `recommend.ts` — watched tracking (TDD)

**Files:**
- Modify: `src/lib/recommend.ts`
- Test: `tests/recommend.test.ts`

- [ ] **Step 1: Write the failing tests**

Add `recordWatched, unwatch, excludeWatched` to the existing import from `../src/lib/recommend` at the top of `tests/recommend.test.ts`, then append at the end of the file:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- recommend`
Expected: FAIL — `recordWatched`/`unwatch`/`excludeWatched` are not exported yet.

- [ ] **Step 3: Implement**

Replace the `ProfileScores` interface and `createEmptyProfile`:

```ts
export interface ProfileScores {
  genres: Record<number, number>;
  directors: Record<number, number>;
  favorites: number[];
  swipedLiked?: number[];
  swipedDisliked?: number[];
  watched?: number[];
}

export function createEmptyProfile(): ProfileScores {
  return { genres: {}, directors: {}, favorites: [], swipedLiked: [], swipedDisliked: [], watched: [] };
}
```

Append at the end of `src/lib/recommend.ts`:

```ts
const WATCHED_GENRE_POINTS = 3;

// Between the weight of a simple detail-page view (+1, automatic on every
// visit) and an explicit favorite (+5) — marking a movie watched is a
// deliberate action but a lighter taste signal than favoriting it.
export function recordWatched(profile: ProfileScores, movieId: number, genreIds: number[]): ProfileScores {
  const genres = { ...profile.genres };
  for (const id of genreIds) {
    genres[id] = (genres[id] ?? 0) + WATCHED_GENRE_POINTS;
  }
  const watched = profile.watched ?? [];
  const nextWatched = watched.includes(movieId) ? watched : [...watched, movieId];
  return { ...profile, genres, watched: nextWatched };
}

// Same rationale as unfavorite — doesn't reverse the genre score contribution.
export function unwatch(profile: ProfileScores, movieId: number): ProfileScores {
  return { ...profile, watched: (profile.watched ?? []).filter((id) => id !== movieId) };
}

export function excludeWatched<T extends { id: number }>(movies: T[], profile: ProfileScores): T[] {
  const watched = profile.watched ?? [];
  return movies.filter((movie) => !watched.includes(movie.id));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- recommend`
Expected: PASS (all tests, including the 6 new ones).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/recommend.ts tests/recommend.test.ts
git commit -m "feat(recommend): add watched tracking and exclusion helper"
```

## Task 4: `profileStore.ts` — watched actions + migration, export/import (TDD)

**Files:**
- Modify: `src/stores/profileStore.ts`
- Test: `tests/profileStore.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/profileStore.test.ts`, update the two existing full-object equality assertions to include the new `watched: []` field:

Replace:

```ts
  it('resetProfile clears all persisted data', async () => {
    const mod = await import('../src/stores/profileStore');
    mod.favoriteMovie(1, [1], 1);
    mod.resetProfile();
    expect(mod.profileStore.get()).toEqual({
      genres: {},
      directors: {},
      favorites: [],
      swipedLiked: [],
      swipedDisliked: [],
    });
  });

  it('ignores a corrupted profile in localStorage and starts fresh', async () => {
    window.localStorage.setItem('cinescope:profile', '{"not":"a valid profile"}');
    const mod = await import('../src/stores/profileStore');
    expect(mod.profileStore.get()).toEqual({
      genres: {},
      directors: {},
      favorites: [],
      swipedLiked: [],
      swipedDisliked: [],
    });
  });
```

with:

```ts
  it('resetProfile clears all persisted data', async () => {
    const mod = await import('../src/stores/profileStore');
    mod.favoriteMovie(1, [1], 1);
    mod.resetProfile();
    expect(mod.profileStore.get()).toEqual({
      genres: {},
      directors: {},
      favorites: [],
      swipedLiked: [],
      swipedDisliked: [],
      watched: [],
    });
  });

  it('ignores a corrupted profile in localStorage and starts fresh', async () => {
    window.localStorage.setItem('cinescope:profile', '{"not":"a valid profile"}');
    const mod = await import('../src/stores/profileStore');
    expect(mod.profileStore.get()).toEqual({
      genres: {},
      directors: {},
      favorites: [],
      swipedLiked: [],
      swipedDisliked: [],
      watched: [],
    });
  });
```

Also update the existing migration test to expect `watched: []` too:

Replace:

```ts
  it('migrates a profile stored before swipedLiked/swipedDisliked existed', async () => {
    window.localStorage.setItem(
      'cinescope:profile',
      JSON.stringify({ genres: { 28: 5 }, directors: {}, favorites: [10] })
    );
    const mod = await import('../src/stores/profileStore');
    expect(mod.profileStore.get()).toEqual({
      genres: { 28: 5 },
      directors: {},
      favorites: [10],
      swipedLiked: [],
      swipedDisliked: [],
    });
  });
});
```

with:

```ts
  it('migrates a profile stored before swipedLiked/swipedDisliked/watched existed', async () => {
    window.localStorage.setItem(
      'cinescope:profile',
      JSON.stringify({ genres: { 28: 5 }, directors: {}, favorites: [10] })
    );
    const mod = await import('../src/stores/profileStore');
    expect(mod.profileStore.get()).toEqual({
      genres: { 28: 5 },
      directors: {},
      favorites: [10],
      swipedLiked: [],
      swipedDisliked: [],
      watched: [],
    });
  });

  it('migrates a profile stored before watched existed but after swipedLiked/swipedDisliked did', async () => {
    window.localStorage.setItem(
      'cinescope:profile',
      JSON.stringify({ genres: { 28: 5 }, directors: {}, favorites: [10], swipedLiked: [2], swipedDisliked: [] })
    );
    const mod = await import('../src/stores/profileStore');
    expect(mod.profileStore.get()).toEqual({
      genres: { 28: 5 },
      directors: {},
      favorites: [10],
      swipedLiked: [2],
      swipedDisliked: [],
      watched: [],
    });
  });

  it('persists a watched movie across store reloads', async () => {
    const mod1 = await import('../src/stores/profileStore');
    mod1.markWatched(88, [28]);
    expect(mod1.profileStore.get().watched).toEqual([88]);

    vi.resetModules();
    const mod2 = await import('../src/stores/profileStore');
    expect(mod2.profileStore.get().watched).toEqual([88]);
    expect(mod2.profileStore.get().genres[28]).toBe(3);
  });

  it('does not double-count score when marking the same movie watched twice', async () => {
    const mod = await import('../src/stores/profileStore');
    mod.markWatched(88, [28]);
    mod.markWatched(88, [28]);
    expect(mod.profileStore.get().genres[28]).toBe(3);
    expect(mod.profileStore.get().watched).toEqual([88]);
  });

  it('unmarkWatched removes the movie from watched', async () => {
    const mod = await import('../src/stores/profileStore');
    mod.markWatched(88, [28]);
    mod.unmarkWatched(88);
    expect(mod.profileStore.get().watched).toEqual([]);
  });

  it('exportProfile returns the current profile as JSON', async () => {
    const mod = await import('../src/stores/profileStore');
    mod.favoriteMovie(1, [28], 7);
    const json = mod.exportProfile();
    expect(JSON.parse(json)).toEqual(mod.profileStore.get());
  });

  it('importProfile restores a previously exported profile', async () => {
    const mod = await import('../src/stores/profileStore');
    mod.favoriteMovie(1, [28], 7);
    const json = mod.exportProfile();
    mod.resetProfile();
    expect(mod.profileStore.get().favorites).toEqual([]);
    const ok = mod.importProfile(json);
    expect(ok).toBe(true);
    expect(mod.profileStore.get().favorites).toEqual([1]);
    expect(mod.profileStore.get().genres[28]).toBe(5);
  });

  it('importProfile rejects invalid JSON and leaves the profile untouched', async () => {
    const mod = await import('../src/stores/profileStore');
    mod.favoriteMovie(1, [28], 7);
    const ok = mod.importProfile('not valid json{{{');
    expect(ok).toBe(false);
    expect(mod.profileStore.get().favorites).toEqual([1]);
  });

  it('importProfile rejects a JSON payload that is not a valid profile shape', async () => {
    const mod = await import('../src/stores/profileStore');
    mod.favoriteMovie(1, [28], 7);
    const ok = mod.importProfile(JSON.stringify({ not: 'a profile' }));
    expect(ok).toBe(false);
    expect(mod.profileStore.get().favorites).toEqual([1]);
  });

  it('importProfile backfills fields missing from an older export', async () => {
    const mod = await import('../src/stores/profileStore');
    const ok = mod.importProfile(JSON.stringify({ genres: { 28: 5 }, directors: {}, favorites: [10] }));
    expect(ok).toBe(true);
    expect(mod.profileStore.get()).toEqual({
      genres: { 28: 5 },
      directors: {},
      favorites: [10],
      swipedLiked: [],
      swipedDisliked: [],
      watched: [],
    });
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm run test -- profileStore`
Expected: FAIL — `markWatched`/`unmarkWatched`/`exportProfile`/`importProfile` are not exported yet.

- [ ] **Step 3: Replace `src/stores/profileStore.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- profileStore`
Expected: PASS (all tests, including the new watched/export/import ones).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/stores/profileStore.ts tests/profileStore.test.ts
git commit -m "feat(profile): add watched tracking, migration, and JSON export/import"
```

## Task 5: Movie detail page — watch providers, similar movies, "Marquer comme vu"

**Files:**
- Modify: `src/islands/MovieDetail.tsx`

- [ ] **Step 1: Replace the whole file**

```tsx
import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { Star, Check, Plus, Eye } from 'lucide-react';
import MovieCard from '../components/MovieCard';
import { getMovieDetail, tmdbImageUrl, type TMDBMovieDetail, type TMDBWatchProvider } from '../lib/tmdb';
import {
  profileStore,
  viewMovie,
  favoriteMovie,
  unfavoriteMovie,
  markWatched,
  unmarkWatched,
} from '../stores/profileStore';
import {
  cacheFavoritePoster,
  uncacheFavoritePoster,
  cacheFavoriteMovieData,
  uncacheFavoriteMovieData,
} from '../lib/favoritesCache';

function ProviderGroup({ label, providers }: { label: string; providers: TMDBWatchProvider[] }) {
  return (
    <div className="mb-3">
      <p className="mb-2 text-xs uppercase tracking-wide text-white/50">{label}</p>
      <div className="flex flex-wrap gap-2">
        {providers.map((p) => (
          <div
            key={p.provider_id}
            className="glass-pill flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-white/80"
          >
            {tmdbImageUrl(p.logo_path, 'w45') && (
              <img src={tmdbImageUrl(p.logo_path, 'w45') ?? ''} alt="" className="h-5 w-5 rounded" />
            )}
            {p.provider_name}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MovieDetail({ movieId }: { movieId: number }) {
  const profile = useStore(profileStore);
  const [movie, setMovie] = useState<TMDBMovieDetail | null>(null);
  const [error, setError] = useState(false);
  const isFavorite = movie ? profile.favorites.includes(movie.id) : false;
  const isWatched = movie ? (profile.watched ?? []).includes(movie.id) : false;

  useEffect(() => {
    let cancelled = false;
    getMovieDetail(movieId)
      .then((data) => {
        if (cancelled) return;
        setMovie(data);
        viewMovie(data.genres.map((g) => g.id));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [movieId]);

  if (error) return <p className="px-4 py-8 text-white/60">Impossible de charger ce film.</p>;
  if (!movie) return <p className="px-4 py-8 text-white/60">Chargement…</p>;

  const director = movie.credits?.crew.find((c) => c.job === 'Director');
  const trailer = movie.videos?.results.find((v) => v.site === 'YouTube' && v.type === 'Trailer');
  const backdrop = tmdbImageUrl(movie.backdrop_path, 'w1280');
  const genreIds = movie.genres.map((g) => g.id);
  const watchProviders = movie['watch/providers']?.results?.FR;
  const hasWatchProviders =
    !!watchProviders && !!(watchProviders.flatrate || watchProviders.rent || watchProviders.buy);
  const similar = movie.similar?.results ?? [];

  function toggleFavorite() {
    if (!movie) return;
    if (isFavorite) {
      unfavoriteMovie(movie.id);
      uncacheFavoritePoster(movie.poster_path);
      uncacheFavoriteMovieData(movie.id);
    } else {
      favoriteMovie(movie.id, genreIds, director?.id);
      cacheFavoritePoster(movie.poster_path);
      cacheFavoriteMovieData(movie);
    }
  }

  function toggleWatched() {
    if (!movie) return;
    if (isWatched) {
      unmarkWatched(movie.id);
    } else {
      markWatched(movie.id, genreIds);
    }
  }

  return (
    <article>
      {backdrop && (
        <div className="aspect-video w-full overflow-hidden">
          <img src={backdrop} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <div className={`glass relative z-10 rounded-t-3xl px-4 py-6 md:px-8 ${backdrop ? '-mt-12 md:-mt-16' : ''}`}>
        <h1 className="font-display text-2xl md:text-4xl">{movie.title}</h1>
        <p className="mt-1 flex items-center gap-1 text-sm text-white/60">
          {movie.release_date?.slice(0, 4)} · {movie.runtime} min ·
          <Star size={14} className="fill-current text-accent" aria-hidden="true" />
          {movie.vote_average.toFixed(1)}
        </p>
        {director && (
          <p className="mt-1 text-sm text-white/60">
            Réalisé par{' '}
            <a href={`/personne/${director.id}`} className="text-white underline">
              {director.name}
            </a>
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={toggleFavorite}
            aria-pressed={isFavorite}
            className={`glass-pill flex min-h-11 items-center gap-2 rounded-full px-6 py-2 text-sm font-semibold ${
              isFavorite ? 'glass-pill-active text-white' : 'text-white'
            }`}
          >
            {isFavorite ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            {isFavorite ? 'Dans mes favoris' : 'Ajouter aux favoris'}
          </button>
          <button
            onClick={toggleWatched}
            aria-pressed={isWatched}
            className={`glass-pill flex min-h-11 items-center gap-2 rounded-full px-6 py-2 text-sm font-semibold ${
              isWatched ? 'glass-pill-active text-white' : 'text-white'
            }`}
          >
            {isWatched ? <Check size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
            {isWatched ? 'Déjà vu' : 'Marquer comme vu'}
          </button>
        </div>

        <p className="mt-6 max-w-2xl text-white/80">{movie.overview}</p>

        {hasWatchProviders && watchProviders && (
          <section className="mt-8">
            <h2 className="mb-3 font-display text-lg">Où regarder</h2>
            {watchProviders.flatrate && watchProviders.flatrate.length > 0 && (
              <ProviderGroup label="Abonnement" providers={watchProviders.flatrate} />
            )}
            {watchProviders.rent && watchProviders.rent.length > 0 && (
              <ProviderGroup label="Location" providers={watchProviders.rent} />
            )}
            {watchProviders.buy && watchProviders.buy.length > 0 && (
              <ProviderGroup label="Achat" providers={watchProviders.buy} />
            )}
            <a href={watchProviders.link} target="_blank" rel="noreferrer" className="text-xs text-white/40 underline">
              Données fournies par JustWatch
            </a>
          </section>
        )}

        {movie.credits && movie.credits.cast.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 font-display text-lg">Casting</h2>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {movie.credits.cast.slice(0, 10).map((member) => (
                <a key={member.id} href={`/personne/${member.id}`} className="w-20 shrink-0 text-center">
                  <div className="h-20 w-20 overflow-hidden rounded-full bg-surface">
                    {member.profile_path && (
                      <img
                        src={tmdbImageUrl(member.profile_path, 'w185') ?? ''}
                        alt={member.name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-white/80">{member.name}</p>
                </a>
              ))}
            </div>
          </section>
        )}

        {similar.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 font-display text-lg">Films similaires</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
              {similar.slice(0, 10).map((m) => (
                <MovieCard key={m.id} movie={m} />
              ))}
            </div>
          </section>
        )}

        {trailer && (
          <section className="mt-8">
            <h2 className="mb-3 font-display text-lg">Bande-annonce de {movie.title}</h2>
            <div className="aspect-video w-full max-w-2xl overflow-hidden rounded-xl">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube.com/embed/${trailer.key}`}
                title={`Bande-annonce de ${movie.title}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </section>
        )}
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/islands/MovieDetail.tsx
git commit -m "feat: add watch providers, similar movies, and a watched toggle to the movie detail page"
```

## Task 6: Profile page — "Historique" section + backup export/import

**Files:**
- Modify: `src/islands/ProfileView.tsx`

- [ ] **Step 1: Replace the whole file**

```tsx
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useStore } from '@nanostores/react';
import { Download, Upload } from 'lucide-react';
import MovieCard from '../components/MovieCard';
import { profileStore, resetProfile, exportProfile, importProfile } from '../stores/profileStore';
import { getGenres, getMovieDetail, type TMDBMovie, type TMDBMovieDetail } from '../lib/tmdb';
import { FAVORITES_CACHE_NAME, FAVORITES_DATA_CACHE_NAME, getCachedFavoriteMovieData } from '../lib/favoritesCache';

export default function ProfileView() {
  const profile = useStore(profileStore);
  const [genreNames, setGenreNames] = useState<Record<number, string>>({});
  const [favoriteMovies, setFavoriteMovies] = useState<TMDBMovie[] | null>(null);
  const [favoritesError, setFavoritesError] = useState(false);
  const [toWatchMovies, setToWatchMovies] = useState<TMDBMovie[] | null>(null);
  const [toWatchError, setToWatchError] = useState(false);
  const [historyMovies, setHistoryMovies] = useState<TMDBMovie[] | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [importError, setImportError] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getGenres()
      .then((data) => {
        const map: Record<number, string> = {};
        for (const g of data.genres) map[g.id] = g.name;
        setGenreNames(map);
      })
      .catch(() => setGenreNames({}));
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (profile.favorites.length === 0) {
      setFavoriteMovies([]);
      setFavoritesError(false);
      return;
    }
    setFavoriteMovies(null);
    setFavoritesError(false);
    Promise.allSettled(
      profile.favorites.map(async (id) => {
        const cached = await getCachedFavoriteMovieData(id);
        if (cached) return cached;
        return getMovieDetail(id);
      })
    ).then((results) => {
      if (cancelled) return;
      const movies = results
        .filter((r): r is PromiseFulfilledResult<TMDBMovieDetail> => r.status === 'fulfilled')
        .map((r) => r.value);
      if (movies.length === 0 && results.length > 0) {
        setFavoritesError(true);
      }
      setFavoriteMovies(movies);
    });
    return () => {
      cancelled = true;
    };
  }, [profile.favorites.join(',')]);

  useEffect(() => {
    let cancelled = false;
    const ids = profile.swipedLiked ?? [];
    if (ids.length === 0) {
      setToWatchMovies([]);
      setToWatchError(false);
      return;
    }
    setToWatchMovies(null);
    setToWatchError(false);
    Promise.allSettled(ids.map((id) => getMovieDetail(id))).then((results) => {
      if (cancelled) return;
      const movies = results
        .filter((r): r is PromiseFulfilledResult<TMDBMovieDetail> => r.status === 'fulfilled')
        .map((r) => r.value);
      if (movies.length === 0 && results.length > 0) setToWatchError(true);
      setToWatchMovies(movies);
    });
    return () => {
      cancelled = true;
    };
  }, [(profile.swipedLiked ?? []).join(',')]);

  useEffect(() => {
    let cancelled = false;
    const ids = profile.watched ?? [];
    if (ids.length === 0) {
      setHistoryMovies([]);
      setHistoryError(false);
      return;
    }
    setHistoryMovies(null);
    setHistoryError(false);
    Promise.allSettled(ids.map((id) => getMovieDetail(id))).then((results) => {
      if (cancelled) return;
      const movies = results
        .filter((r): r is PromiseFulfilledResult<TMDBMovieDetail> => r.status === 'fulfilled')
        .map((r) => r.value);
      if (movies.length === 0 && results.length > 0) setHistoryError(true);
      setHistoryMovies(movies);
    });
    return () => {
      cancelled = true;
    };
  }, [(profile.watched ?? []).join(',')]);

  const sortedGenres = Object.entries(profile.genres)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  const maxScore = sortedGenres[0]?.[1] ?? 1;

  async function handleReset() {
    if (!confirm('Vider toutes vos données locales (favoris, scores) ?')) return;
    resetProfile();
    if (typeof caches !== 'undefined') {
      await Promise.all([caches.delete(FAVORITES_CACHE_NAME), caches.delete(FAVORITES_DATA_CACHE_NAME)]);
    }
    setResetConfirmed(true);
    setTimeout(() => setResetConfirmed(false), 4000);
  }

  function handleExport() {
    const json = exportProfile();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cinescope-sauvegarde.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    const ok = importProfile(text);
    setImportError(!ok);
    setImportSuccess(ok);
    setTimeout(() => {
      setImportError(false);
      setImportSuccess(false);
    }, 4000);
  }

  return (
    <div className="px-4 py-6 md:px-8">
      <h1 className="font-display text-2xl">Mon Profil</h1>

      <section className="mt-6">
        <h2 className="mb-3 font-display text-lg">Genres préférés</h2>
        {sortedGenres.length === 0 && <p className="text-sm text-white/50">Explorez des films pour construire votre profil.</p>}
        <div className="space-y-2">
          {sortedGenres.map(([id, score]) => (
            <div key={id}>
              <div className="flex justify-between text-xs text-white/70">
                <span>{genreNames[Number(id)] ?? `Genre ${id}`}</span>
                <span>{score} pts</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-surface">
                <div
                  className="h-2 rounded-full bg-accent"
                  style={{ width: `${(score / maxScore) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg">
          Mes favoris {favoriteMovies !== null && `(${favoriteMovies.length})`}
        </h2>
        {favoritesError && <p className="text-sm text-white/50">Impossible de charger vos favoris.</p>}
        {!favoritesError && favoriteMovies === null && <p className="text-sm text-white/50">Chargement…</p>}
        {!favoritesError && favoriteMovies?.length === 0 && (
          <p className="text-sm text-white/50">Aucun favori pour le moment.</p>
        )}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {favoriteMovies?.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg">
          À voir {toWatchMovies !== null && `(${toWatchMovies.length})`}
        </h2>
        {toWatchError && <p className="text-sm text-white/50">Impossible de charger votre liste.</p>}
        {!toWatchError && toWatchMovies === null && <p className="text-sm text-white/50">Chargement…</p>}
        {!toWatchError && toWatchMovies?.length === 0 && (
          <p className="text-sm text-white/50">Swipez des films dans Découverte pour construire votre liste.</p>
        )}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {toWatchMovies?.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg">
          Historique {historyMovies !== null && `(${historyMovies.length})`}
        </h2>
        {historyError && <p className="text-sm text-white/50">Impossible de charger votre historique.</p>}
        {!historyError && historyMovies === null && <p className="text-sm text-white/50">Chargement…</p>}
        {!historyError && historyMovies?.length === 0 && (
          <p className="text-sm text-white/50">Marquez des films comme vus depuis leur fiche.</p>
        )}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {historyMovies?.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg">Sauvegarde</h2>
        <p className="text-sm text-white/50">
          Vos données restent sur cet appareil. Téléchargez une sauvegarde pour les transférer ou les protéger.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={handleExport}
            className="glass-pill flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm text-white"
          >
            <Download size={16} aria-hidden="true" />
            Télécharger une sauvegarde
          </button>
          <button
            onClick={handleImportClick}
            className="glass-pill flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm text-white"
          >
            <Upload size={16} aria-hidden="true" />
            Restaurer une sauvegarde
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
        <p aria-live="polite" className="mt-2 text-xs text-white/50">
          {importSuccess && 'Sauvegarde restaurée.'}
          {importError && 'Fichier invalide — impossible de restaurer cette sauvegarde.'}
        </p>
      </section>

      <button
        onClick={handleReset}
        className="mt-10 min-h-11 rounded-full border border-red-500/40 bg-red-500/5 px-6 py-2 text-sm text-red-400 backdrop-blur-md"
      >
        Vider mes données
      </button>
      <p aria-live="polite" className="mt-2 text-xs text-white/50">
        {resetConfirmed && 'Vos données ont été supprimées.'}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/islands/ProfileView.tsx
git commit -m "feat(profile): add watch history section and backup export/import UI"
```

## Task 7: Search page — multi-genre filter, exclude watched in "Pour vous"

**Files:**
- Modify: `src/islands/SearchExplorer.tsx`

- [ ] **Step 1: Replace the whole file**

```tsx
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { SlidersHorizontal, RotateCcw } from 'lucide-react';
import MovieCard from '../components/MovieCard';
import { discoverMovies, searchMovies, getGenres, type DiscoverParams, type TMDBMovie } from '../lib/tmdb';
import { profileStore } from '../stores/profileStore';
import { topGenres, excludeFavorites, excludeWatched } from '../lib/recommend';

interface Genre {
  id: number;
  name: string;
}

const CURRENT_YEAR = new Date().getFullYear();
const OLDEST_YEAR = 1970;
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - OLDEST_YEAR + 1 }, (_, i) => CURRENT_YEAR - i);
const MIN_VOTE_COUNT_FOR_RATING_SORT = 300;

type SortMode = 'tendance' | 'note' | 'pour-vous';

export default function SearchExplorer() {
  const profile = useStore(profileStore);
  const [query, setQuery] = useState('');
  const [selectedGenreIds, setSelectedGenreIds] = useState<number[]>([]);
  const [minRating, setMinRating] = useState(0);
  const [year, setYear] = useState(0);
  const [sortMode, setSortMode] = useState<SortMode>('tendance');
  const [movies, setMovies] = useState<TMDBMovie[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [genres, setGenres] = useState<Genre[]>([]);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const fetchingMoreRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getGenres()
      .then((data) => {
        if (!cancelled) setGenres(data.genres);
      })
      .catch(() => {
        if (!cancelled) setGenres([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isTextSearch = query.trim().length > 0;
  const isPourVous = !isTextSearch && sortMode === 'pour-vous';
  const preferredGenres = topGenres(profile, 2);
  const pourVousUnavailable = isPourVous && preferredGenres.length === 0;

  function filterResults(results: TMDBMovie[]) {
    return isPourVous ? excludeWatched(excludeFavorites(results, profile), profile) : results;
  }

  function buildRequest(pageNum: number) {
    if (isTextSearch) return searchMovies(query.trim(), pageNum);
    const params: DiscoverParams = {
      genres: isPourVous ? preferredGenres : selectedGenreIds.length > 0 ? selectedGenreIds : undefined,
      genreMatch: 'any',
      minRating: minRating || undefined,
      year: year || undefined,
      sortBy: sortMode === 'note' ? 'vote_average.desc' : undefined,
      minVoteCount: sortMode === 'note' ? MIN_VOTE_COUNT_FOR_RATING_SORT : undefined,
    };
    return discoverMovies(params, pageNum);
  }

  // Resets to page 1 whenever the query/filters/sort change.
  useEffect(() => {
    if (pourVousUnavailable) {
      setMovies([]);
      setPage(1);
      setTotalPages(1);
      setLoading(false);
      setError(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    const timeout = setTimeout(() => {
      buildRequest(1)
        .then((data) => {
          if (cancelled) return;
          setMovies(filterResults(data.results));
          setPage(1);
          setTotalPages(data.total_pages);
        })
        .catch(() => {
          if (!cancelled) setError(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, selectedGenreIds.join(','), minRating, year, sortMode, preferredGenres.join(','), pourVousUnavailable]);

  // Loads the next page when the sentinel at the bottom of the grid scrolls into view.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || pourVousUnavailable || page >= totalPages) return;
    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || fetchingMoreRef.current) return;
        fetchingMoreRef.current = true;
        const nextPage = page + 1;
        setLoading(true);
        buildRequest(nextPage)
          .then((data) => {
            if (cancelled) return;
            const results = filterResults(data.results);
            // TMDB's popularity-based sort is live — its ranking can shift between
            // the page-1 and page-N fetches, so the same movie can reappear across
            // pages. Dedupe by id to avoid duplicate React keys and duplicate cards.
            setMovies((prev) => {
              const seen = new Set(prev.map((m) => m.id));
              return [...prev, ...results.filter((m) => !seen.has(m.id))];
            });
            setPage(nextPage);
            setTotalPages(data.total_pages);
          })
          .catch(() => {
            if (!cancelled) setError(true);
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
            fetchingMoreRef.current = false;
          });
      },
      { rootMargin: '400px' }
    );
    observer.observe(sentinel);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, totalPages, pourVousUnavailable]);

  const hasActiveFilters = selectedGenreIds.length > 0 || year !== 0 || minRating !== 0 || sortMode !== 'tendance';

  function resetFilters() {
    setSelectedGenreIds([]);
    setYear(0);
    setMinRating(0);
    setSortMode('tendance');
  }

  function toggleGenre(id: number) {
    setSelectedGenreIds((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  }

  return (
    <div className="px-4 py-6 md:px-8">
      <h1 className="font-display text-2xl">Recherche</h1>
      <label htmlFor="search-input" className="sr-only">
        Rechercher un film
      </label>
      <input
        id="search-input"
        type="search"
        placeholder="Rechercher un film…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="glass-input mt-4 w-full rounded-full px-4 py-3 text-sm placeholder:text-white/40"
      />

      <div className="mt-4 flex items-center gap-2 text-xs uppercase tracking-wide text-white/50">
        <SlidersHorizontal size={14} aria-hidden="true" />
        Filtres
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="glass-pill ml-auto flex min-h-11 items-center gap-1 rounded-full px-3 py-1 normal-case text-white/70"
          >
            <RotateCcw size={14} aria-hidden="true" />
            Réinitialiser
          </button>
        )}
      </div>

      {!isTextSearch && (
        <div className="mt-2">
          <label htmlFor="sort-mode" className="sr-only">
            Trier par
          </label>
          <select
            id="sort-mode"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="glass-input min-h-11 rounded-full px-3 py-1.5 text-xs text-white/80"
          >
            <option value="tendance">Trier par tendance</option>
            <option value="note">Trier par note</option>
            <option value="pour-vous">Trier par pour vous</option>
          </select>
        </div>
      )}

      {sortMode !== 'pour-vous' && (
        <div role="group" aria-label="Filtrer par genres" className="mt-3 flex flex-wrap gap-2">
          {genres.map((g) => (
            <button
              key={g.id}
              aria-pressed={selectedGenreIds.includes(g.id)}
              onClick={() => toggleGenre(g.id)}
              className={`glass-pill flex min-h-11 items-center rounded-full px-3 py-1.5 text-xs ${
                selectedGenreIds.includes(g.id) ? 'glass-pill-active text-white' : 'text-white/80'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <select
          value={minRating}
          onChange={(e) => setMinRating(Number(e.target.value))}
          className="glass-input min-h-11 rounded-full px-3 py-1.5 text-xs text-white/80"
        >
          <option value={0}>Note minimum</option>
          <option value={5}>5+</option>
          <option value={7}>7+</option>
          <option value={8}>8+</option>
        </select>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="glass-input min-h-11 rounded-full px-3 py-1.5 text-xs text-white/80"
        >
          <option value={0}>Année</option>
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {pourVousUnavailable && (
        <p className="mt-6 text-sm text-white/50">Explorez des films pour activer cette option.</p>
      )}
      {!pourVousUnavailable && error && <p className="mt-6 text-sm text-white/50">Impossible de charger cette section.</p>}
      {!pourVousUnavailable && !error && loading && movies.length === 0 && (
        <p className="mt-6 text-sm text-white/50">Recherche…</p>
      )}
      {!pourVousUnavailable && !error && !loading && movies.length === 0 && (
        <p className="mt-6 text-sm text-white/50">Aucun résultat.</p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
        {movies.map((movie) => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>

      {!pourVousUnavailable && page < totalPages && <div ref={sentinelRef} className="h-1" />}
      {!pourVousUnavailable && loading && movies.length > 0 && (
        <p className="mt-4 text-center text-sm text-white/50">Chargement…</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/islands/SearchExplorer.tsx
git commit -m "feat(search): allow selecting multiple genres (any-match) and exclude watched movies from Pour vous"
```

## Task 8: Swipe deck — exclude watched movies from the candidate pool

**Files:**
- Modify: `src/islands/SwipeDeck.tsx`

- [ ] **Step 1: Update the import and the filter call**

Replace:

```ts
import { topGenres, excludeSwiped } from '../lib/recommend';
```

with:

```ts
import { topGenres, excludeSwiped, excludeWatched } from '../lib/recommend';
```

Replace:

```ts
        const filtered = excludeSwiped(result.results, profile);
```

with:

```ts
        const filtered = excludeWatched(excludeSwiped(result.results, profile), profile);
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/islands/SwipeDeck.tsx
git commit -m "feat(swipe): exclude already-watched movies from the candidate pool"
```

## Task 9: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, including every new `tmdb.test.ts`/`recommend.test.ts`/`profileStore.test.ts` case.

- [ ] **Step 2: Typecheck the whole project**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds, same route set as before (this round adds no new routes/pages).

- [ ] **Step 4: Manual verification in the browser**

Run: `npm run dev` (needs a real `PUBLIC_TMDB_API_KEY` in `.env`), then check:
- A popular movie's detail page shows "Où regarder" (streaming/rental/purchase logos, with the JustWatch attribution link) when TMDB has that data for France, and "Films similaires" with clickable cards.
- The "Marquer comme vu" button toggles independently from the favorite button; after marking a movie watched, `/profile`'s new "Historique" section shows it.
- On `/decouverte`, a movie already marked watched never appears in the swipe deck.
- On `/search`, switching "Trier par" to "Pour vous" excludes both favorited and watched movies; selecting multiple genre chips at once returns results matching any of them (not requiring all).
- On `/profile`, "Télécharger une sauvegarde" downloads a JSON file; clearing data (or opening in a private window) then "Restaurer une sauvegarde" with that file brings favorites/history/scores back. Uploading an unrelated/invalid JSON file shows the error message and leaves existing data untouched.

- [ ] **Step 5: Commit (only if manual verification required fixes)**

If Step 4 surfaced no issues, there is nothing to commit here — the plan is done. If it did, fix, re-run steps 1-4, then:

```bash
git add -A
git commit -m "fix: address issues found during manual verification"
```
