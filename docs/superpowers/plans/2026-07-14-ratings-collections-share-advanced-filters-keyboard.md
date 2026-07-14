# Notes, collections, partage, filtres avancés, clavier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five more front-end-only features: a 1-5 star personal rating (distinct from the binary "watched"), TMDB collection/franchise browsing on the movie detail page, a share button, advanced search filters (original language, runtime), and keyboard shortcuts (arrow keys) on the swipe discovery screen.

**Architecture:** Extend `recommend.ts`/`profileStore.ts` with a `ratings` map and delta-based scoring (unlike the discrete toggles already in place, a rating is a mutable value, so changing it must adjust the genre score by the difference, not re-add the full amount). Extend `DiscoverParams`/`buildDiscoverQuery` with three more optional TMDB query params. Use `movie.belongs_to_collection` (already present in every TMDB movie detail response, no extra append needed) plus one new `getCollection` fetcher. Everything else is additive UI on `MovieDetail.tsx`, `SearchExplorer.tsx`, and `SwipeDeck.tsx`.

**Tech Stack:** Astro, React islands, TypeScript strict, Vitest for the pure-logic pieces — same as every prior round.

---

## Reference: full spec

`docs/superpowers/specs/2026-07-14-ratings-collections-share-advanced-filters-keyboard-design.md` — read it before starting if anything below is unclear.

## Task 1: `tmdb.ts` — collections, and language/runtime discover params (TDD for the pure part)

**Files:**
- Modify: `src/lib/tmdb.ts`
- Test: `tests/tmdb.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/tmdb.test.ts`, inside `describe('buildDiscoverQuery', ...)`:

```ts
  it('adds original language and runtime range filters', () => {
    expect(buildDiscoverQuery({ originalLanguage: 'ja', minRuntime: 90, maxRuntime: 120 })).toEqual({
      sort_by: 'popularity.desc',
      with_original_language: 'ja',
      'with_runtime.gte': '90',
      'with_runtime.lte': '120',
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tmdb`
Expected: FAIL — the new fields are ignored by `buildDiscoverQuery`.

- [ ] **Step 3: Implement — collection types, `belongs_to_collection`, `getCollection`**

Replace:

```ts
export interface TMDBMovieDetail extends TMDBMovie {
  runtime: number;
  genres: { id: number; name: string }[];
  credits?: { cast: TMDBCastMember[]; crew: TMDBCrewMember[] };
  videos?: { results: TMDBVideo[] };
  similar?: TMDBListResponse<TMDBMovie>;
  'watch/providers'?: { results: Record<string, TMDBWatchProviderRegion> };
}
```

with:

```ts
export interface TMDBCollectionSummary {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
}

export interface TMDBMovieDetail extends TMDBMovie {
  runtime: number;
  genres: { id: number; name: string }[];
  credits?: { cast: TMDBCastMember[]; crew: TMDBCrewMember[] };
  videos?: { results: TMDBVideo[] };
  similar?: TMDBListResponse<TMDBMovie>;
  'watch/providers'?: { results: Record<string, TMDBWatchProviderRegion> };
  belongs_to_collection: TMDBCollectionSummary | null;
}
```

Append near the bottom of the file (after `getPersonMovieCredits`):

```ts
export interface TMDBCollection {
  id: number;
  name: string;
  overview: string;
  parts: TMDBMovie[];
}

export function getCollection(id: number, signal?: AbortSignal): Promise<TMDBCollection> {
  return tmdbFetch(`/collection/${id}`, {}, signal);
}
```

- [ ] **Step 4: Implement — `originalLanguage`/`minRuntime`/`maxRuntime`**

Replace:

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
  if (params.year) {
    query.primary_release_year = String(params.year);
  }
  if (params.minRating) {
    query['vote_average.gte'] = String(params.minRating);
  }
  if (params.minVoteCount) {
    query['vote_count.gte'] = String(params.minVoteCount);
  }
  return query;
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
  originalLanguage?: string;
  minRuntime?: number;
  maxRuntime?: number;
}

export function buildDiscoverQuery(params: DiscoverParams): Record<string, string> {
  const query: Record<string, string> = { sort_by: params.sortBy ?? 'popularity.desc' };
  if (params.genres && params.genres.length > 0) {
    query.with_genres = params.genres.join(params.genreMatch === 'any' ? '|' : ',');
  }
  if (params.year) {
    query.primary_release_year = String(params.year);
  }
  if (params.minRating) {
    query['vote_average.gte'] = String(params.minRating);
  }
  if (params.minVoteCount) {
    query['vote_count.gte'] = String(params.minVoteCount);
  }
  if (params.originalLanguage) {
    query.with_original_language = params.originalLanguage;
  }
  if (params.minRuntime) {
    query['with_runtime.gte'] = String(params.minRuntime);
  }
  if (params.maxRuntime) {
    query['with_runtime.lte'] = String(params.maxRuntime);
  }
  return query;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- tmdb`
Expected: PASS (all tests, including the new one).

- [ ] **Step 6: Fix the now-broken `TMDBMovieDetail` fixture in `favoritesCache.test.ts`**

`belongs_to_collection` is now a required field on `TMDBMovieDetail`. `tests/favoritesCache.test.ts` constructs a literal of that type and will fail to typecheck without it.

Replace:

```ts
const sampleMovie: TMDBMovieDetail = {
  id: 42,
  title: 'Sample Movie',
  poster_path: '/abc.jpg',
  backdrop_path: null,
  overview: 'An overview',
  release_date: '2024-01-01',
  vote_average: 7.5,
  runtime: 120,
  genres: [{ id: 1, name: 'Action' }],
};
```

with:

```ts
const sampleMovie: TMDBMovieDetail = {
  id: 42,
  title: 'Sample Movie',
  poster_path: '/abc.jpg',
  backdrop_path: null,
  overview: 'An overview',
  release_date: '2024-01-01',
  vote_average: 7.5,
  runtime: 120,
  genres: [{ id: 1, name: 'Action' }],
  belongs_to_collection: null,
};
```

- [ ] **Step 7: Run the full test suite and typecheck**

Run: `npm run test && npm run typecheck`
Expected: all tests pass (including `favoritesCache.test.ts`), no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/tmdb.ts tests/tmdb.test.ts tests/favoritesCache.test.ts
git commit -m "feat(tmdb): add collection fetcher and original language/runtime discover filters"
```

## Task 2: `recommend.ts` — personal ratings (TDD)

**Files:**
- Modify: `src/lib/recommend.ts`
- Test: `tests/recommend.test.ts`

- [ ] **Step 1: Write the failing tests**

Add `recordRating, removeRating` to the existing import from `../src/lib/recommend` in `tests/recommend.test.ts`, then append at the end of the file:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- recommend`
Expected: FAIL — `recordRating`/`removeRating` are not exported yet.

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
  ratings?: Record<number, number>;
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
  };
}
```

Append at the end of `src/lib/recommend.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- recommend`
Expected: PASS (all tests, including the 5 new ones).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/recommend.ts tests/recommend.test.ts
git commit -m "feat(recommend): add personal ratings with delta-based scoring"
```

## Task 3: `profileStore.ts` — rating actions + migration (TDD)

**Files:**
- Modify: `src/stores/profileStore.ts`
- Test: `tests/profileStore.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/profileStore.test.ts`, update every existing full-object equality assertion to include `ratings: {}`. There are 5 of them — `resetProfile clears all persisted data`, `ignores a corrupted profile in localStorage and starts fresh`, `migrates a profile stored before swipedLiked/swipedDisliked/watched existed`, `migrates a profile stored before watched existed but after swipedLiked/swipedDisliked did`, and `importProfile backfills fields missing from an older export`. For each, add `ratings: {},` as the last property of the expected object (same shape everywhere: `{ genres, directors, favorites, swipedLiked: [], swipedDisliked: [], watched: [], ratings: {} }`, adjusted for whatever `genres`/`favorites`/etc. that specific test already expects).

Then append these new tests at the end of the `describe('profileStore', ...)` block (before its closing `});`):

```ts
  it('persists a rating across store reloads', async () => {
    const mod1 = await import('../src/stores/profileStore');
    mod1.rateMovie(77, 4, [28]);
    expect(mod1.profileStore.get().ratings).toEqual({ 77: 4 });

    vi.resetModules();
    const mod2 = await import('../src/stores/profileStore');
    expect(mod2.profileStore.get().ratings).toEqual({ 77: 4 });
    expect(mod2.profileStore.get().genres[28]).toBe(4);
  });

  it('rateMovie only applies the delta when changing an existing rating', async () => {
    const mod = await import('../src/stores/profileStore');
    mod.rateMovie(77, 3, [28]);
    mod.rateMovie(77, 5, [28]);
    expect(mod.profileStore.get().genres[28]).toBe(5);
    expect(mod.profileStore.get().ratings).toEqual({ 77: 5 });
  });

  it('unrateMovie removes the rating and its genre points', async () => {
    const mod = await import('../src/stores/profileStore');
    mod.rateMovie(77, 4, [28]);
    mod.unrateMovie(77, [28]);
    expect(mod.profileStore.get().ratings).toEqual({});
    expect(mod.profileStore.get().genres[28]).toBe(0);
  });

  it('migrates a profile stored before ratings existed', async () => {
    window.localStorage.setItem(
      'cinescope:profile',
      JSON.stringify({
        genres: { 28: 5 },
        directors: {},
        favorites: [10],
        swipedLiked: [],
        swipedDisliked: [],
        watched: [],
      })
    );
    const mod = await import('../src/stores/profileStore');
    expect(mod.profileStore.get()).toEqual({
      genres: { 28: 5 },
      directors: {},
      favorites: [10],
      swipedLiked: [],
      swipedDisliked: [],
      watched: [],
      ratings: {},
    });
  });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm run test -- profileStore`
Expected: FAIL — `rateMovie`/`unrateMovie` are not exported yet, and the updated equality assertions don't match (missing `ratings`).

- [ ] **Step 3: Update `src/stores/profileStore.ts`**

Replace the import block:

```ts
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
```

with:

```ts
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
```

Replace `normalizeProfile`:

```ts
function normalizeProfile(profile: ProfileScores): ProfileScores {
  return {
    ...profile,
    swipedLiked: profile.swipedLiked ?? [],
    swipedDisliked: profile.swipedDisliked ?? [],
    watched: profile.watched ?? [],
  };
}
```

with:

```ts
function normalizeProfile(profile: ProfileScores): ProfileScores {
  return {
    ...profile,
    swipedLiked: profile.swipedLiked ?? [],
    swipedDisliked: profile.swipedDisliked ?? [],
    watched: profile.watched ?? [],
    ratings: profile.ratings ?? {},
  };
}
```

Append after `unmarkWatched`, before `exportProfile`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- profileStore`
Expected: PASS (all tests, including the new rating ones).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/stores/profileStore.ts tests/profileStore.test.ts
git commit -m "feat(profile): add rateMovie/unrateMovie actions and ratings migration"
```

## Task 4: Movie detail page — rating stars, share button, collection section

**Files:**
- Modify: `src/islands/MovieDetail.tsx`

- [ ] **Step 1: Update imports**

Replace:

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
```

with:

```tsx
import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { Star, Check, Plus, Eye, Share2 } from 'lucide-react';
import MovieCard from '../components/MovieCard';
import {
  getMovieDetail,
  getCollection,
  tmdbImageUrl,
  type TMDBMovieDetail,
  type TMDBWatchProvider,
  type TMDBMovie,
} from '../lib/tmdb';
import {
  profileStore,
  viewMovie,
  favoriteMovie,
  unfavoriteMovie,
  markWatched,
  unmarkWatched,
  rateMovie,
  unrateMovie,
} from '../stores/profileStore';
```

- [ ] **Step 2: Add collection-loading state and effect**

Replace:

```tsx
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
```

with:

```tsx
export default function MovieDetail({ movieId }: { movieId: number }) {
  const profile = useStore(profileStore);
  const [movie, setMovie] = useState<TMDBMovieDetail | null>(null);
  const [error, setError] = useState(false);
  const [collectionParts, setCollectionParts] = useState<TMDBMovie[]>([]);
  const [shareConfirmed, setShareConfirmed] = useState(false);
  const isFavorite = movie ? profile.favorites.includes(movie.id) : false;
  const isWatched = movie ? (profile.watched ?? []).includes(movie.id) : false;
  const rating = movie ? (profile.ratings?.[movie.id] ?? 0) : 0;

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

  useEffect(() => {
    if (!movie?.belongs_to_collection) {
      setCollectionParts([]);
      return;
    }
    let cancelled = false;
    getCollection(movie.belongs_to_collection.id)
      .then((result) => {
        if (!cancelled) setCollectionParts(result.parts.filter((p) => p.id !== movie.id));
      })
      .catch(() => {
        if (!cancelled) setCollectionParts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [movie?.belongs_to_collection?.id]);
```

- [ ] **Step 3: Add `setRating`/`handleShare` next to the existing toggle functions**

Replace:

```tsx
  function toggleWatched() {
    if (!movie) return;
    if (isWatched) {
      unmarkWatched(movie.id);
    } else {
      markWatched(movie.id, genreIds);
    }
  }
```

with:

```tsx
  function toggleWatched() {
    if (!movie) return;
    if (isWatched) {
      unmarkWatched(movie.id);
    } else {
      markWatched(movie.id, genreIds);
    }
  }

  function setRating(value: number) {
    if (!movie) return;
    if (rating === value) {
      unrateMovie(movie.id, genreIds);
    } else {
      rateMovie(movie.id, value, genreIds);
    }
  }

  async function handleShare() {
    if (!movie) return;
    const shareData = {
      title: movie.title,
      text: `Découvre ${movie.title} sur CineScope`,
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // user cancelled the native share sheet — nothing to do
      }
      return;
    }
    await navigator.clipboard.writeText(window.location.href);
    setShareConfirmed(true);
    setTimeout(() => setShareConfirmed(false), 3000);
  }
```

- [ ] **Step 4: Add the star rating widget and share button to the button row**

Replace:

```tsx
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
```

with:

```tsx
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
          <button
            onClick={handleShare}
            className="glass-pill flex min-h-11 items-center gap-2 rounded-full px-6 py-2 text-sm font-semibold text-white"
          >
            <Share2 size={16} aria-hidden="true" />
            Partager
          </button>
        </div>

        <div className="mt-3 flex items-center gap-1" role="group" aria-label="Noter ce film">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              onClick={() => setRating(value)}
              aria-label={`Noter ${value} étoile${value > 1 ? 's' : ''}`}
              aria-pressed={rating >= value}
              className="flex min-h-11 min-w-11 items-center justify-center"
            >
              <Star
                size={20}
                className={rating >= value ? 'fill-current text-accent' : 'text-white/30'}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
        {shareConfirmed && (
          <p aria-live="polite" className="mt-1 text-xs text-white/50">
            Lien copié !
          </p>
        )}
```

- [ ] **Step 5: Add the collection section**

Replace:

```tsx
        {similar.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 font-display text-lg">Films similaires</h2>
```

with:

```tsx
        {collectionParts.length > 0 && movie.belongs_to_collection && (
          <section className="mt-8">
            <h2 className="mb-3 font-display text-lg">Fait partie de : {movie.belongs_to_collection.name}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
              {collectionParts.map((m) => (
                <MovieCard key={m.id} movie={m} />
              ))}
            </div>
          </section>
        )}

        {similar.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 font-display text-lg">Films similaires</h2>
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/islands/MovieDetail.tsx
git commit -m "feat: add star ratings, share button, and collection section to movie detail"
```

## Task 5: Profile page — ratings stat line

**Files:**
- Modify: `src/islands/ProfileView.tsx`

- [ ] **Step 1: Add the computed stat and render it**

Replace:

```tsx
  const sortedGenres = Object.entries(profile.genres)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  const maxScore = sortedGenres[0]?.[1] ?? 1;
```

with:

```tsx
  const sortedGenres = Object.entries(profile.genres)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  const maxScore = sortedGenres[0]?.[1] ?? 1;
  const ratingValues = Object.values(profile.ratings ?? {});
  const ratingCount = ratingValues.length;
  const averageRating = ratingCount > 0 ? ratingValues.reduce((sum, r) => sum + r, 0) / ratingCount : 0;
```

Replace:

```tsx
      <section className="mt-6">
        <h2 className="mb-3 font-display text-lg">Genres préférés</h2>
        {sortedGenres.length === 0 && <p className="text-sm text-white/50">Explorez des films pour construire votre profil.</p>}
```

with:

```tsx
      <section className="mt-6">
        <h2 className="mb-3 font-display text-lg">Genres préférés</h2>
        {ratingCount > 0 && (
          <p className="mb-3 text-xs text-white/50">
            {ratingCount} film{ratingCount > 1 ? 's' : ''} noté{ratingCount > 1 ? 's' : ''}, moyenne{' '}
            {averageRating.toFixed(1)}★
          </p>
        )}
        {sortedGenres.length === 0 && <p className="text-sm text-white/50">Explorez des films pour construire votre profil.</p>}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/islands/ProfileView.tsx
git commit -m "feat(profile): show ratings count and average"
```

## Task 6: Search page — original language and runtime filters

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

const LANGUAGE_OPTIONS = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'Anglais' },
  { code: 'es', label: 'Espagnol' },
  { code: 'it', label: 'Italien' },
  { code: 'de', label: 'Allemand' },
  { code: 'ja', label: 'Japonais' },
  { code: 'ko', label: 'Coréen' },
  { code: 'hi', label: 'Hindi' },
  { code: 'zh', label: 'Mandarin' },
];

const RUNTIME_OPTIONS = [
  { value: 'any', label: 'Durée', minRuntime: undefined, maxRuntime: undefined },
  { value: 'short', label: 'Moins de 90 min', minRuntime: undefined, maxRuntime: 90 },
  { value: 'medium', label: '90–120 min', minRuntime: 90, maxRuntime: 120 },
  { value: 'long', label: 'Plus de 120 min', minRuntime: 120, maxRuntime: undefined },
] as const;
type RuntimeOption = (typeof RUNTIME_OPTIONS)[number]['value'];

type SortMode = 'tendance' | 'note' | 'pour-vous';

export default function SearchExplorer() {
  const profile = useStore(profileStore);
  const [query, setQuery] = useState('');
  const [selectedGenreIds, setSelectedGenreIds] = useState<number[]>([]);
  const [minRating, setMinRating] = useState(0);
  const [year, setYear] = useState(0);
  const [language, setLanguage] = useState('');
  const [runtime, setRuntime] = useState<RuntimeOption>('any');
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
  const runtimeRange = RUNTIME_OPTIONS.find((r) => r.value === runtime);

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
      originalLanguage: language || undefined,
      minRuntime: runtimeRange?.minRuntime,
      maxRuntime: runtimeRange?.maxRuntime,
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
  }, [
    query,
    selectedGenreIds.join(','),
    minRating,
    year,
    language,
    runtime,
    sortMode,
    preferredGenres.join(','),
    pourVousUnavailable,
  ]);

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

  const hasActiveFilters =
    selectedGenreIds.length > 0 ||
    year !== 0 ||
    minRating !== 0 ||
    sortMode !== 'tendance' ||
    language !== '' ||
    runtime !== 'any';

  function resetFilters() {
    setSelectedGenreIds([]);
    setYear(0);
    setMinRating(0);
    setSortMode('tendance');
    setLanguage('');
    setRuntime('any');
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
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="glass-input min-h-11 rounded-full px-3 py-1.5 text-xs text-white/80"
        >
          <option value="">Langue</option>
          {LANGUAGE_OPTIONS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
        <select
          value={runtime}
          onChange={(e) => setRuntime(e.target.value as RuntimeOption)}
          className="glass-input min-h-11 rounded-full px-3 py-1.5 text-xs text-white/80"
        >
          {RUNTIME_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
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
git commit -m "feat(search): add original language and runtime filters"
```

## Task 7: Swipe deck — keyboard shortcuts

**Files:**
- Modify: `src/islands/SwipeDeck.tsx`

- [ ] **Step 1: Add the keydown effect**

Insert after the `restart` function (before the `return (`):

```tsx
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!topMovie) return;
      if (e.key === 'ArrowRight') decide('like');
      else if (e.key === 'ArrowLeft') decide('dislike');
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topMovie]);
```

- [ ] **Step 2: Add the keyboard hint below the like/dislike buttons**

Replace:

```tsx
        <button
          onClick={() => decide('like')}
          disabled={!topMovie}
          aria-label="Ajouter à ma liste"
          className="glass-pill glass-pill-active flex h-14 w-14 items-center justify-center rounded-full text-white disabled:opacity-30"
        >
          <Heart size={24} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
```

with:

```tsx
        <button
          onClick={() => decide('like')}
          disabled={!topMovie}
          aria-label="Ajouter à ma liste"
          className="glass-pill glass-pill-active flex h-14 w-14 items-center justify-center rounded-full text-white disabled:opacity-30"
        >
          <Heart size={24} aria-hidden="true" />
        </button>
      </div>

      <p className="mt-3 hidden text-center text-xs text-white/40 md:block">Utilisez ← / → au clavier</p>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/islands/SwipeDeck.tsx
git commit -m "feat(swipe): add left/right arrow key shortcuts"
```

## Task 8: Full verification pass

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
- On a movie detail page, click through the 5 rating stars — clicking the same star again clears the rating; the fill state matches the clicked value.
- `/profile` shows "X films notés, moyenne Y★" once at least one movie is rated.
- Open a movie that's part of a well-known franchise (e.g. a Toy Story or Marvel film) and confirm a "Fait partie de : …" section appears with the other entries, excluding the current movie; a movie with no franchise shows no such section.
- Click "Partager" — on a browser/OS that supports the Web Share API this opens the native share sheet; otherwise the URL is copied and "Lien copié !" appears briefly.
- On `/search`, the new Langue and Durée selects narrow results, combine correctly with genre/year/note/tri, and count toward "Réinitialiser" appearing/clearing.
- On `/decouverte`, pressing the right arrow key likes the current card and left arrow passes it, matching the swipe gesture and buttons; the "Utilisez ← / → au clavier" hint is visible on desktop widths and hidden on mobile widths.

- [ ] **Step 5: Commit (only if manual verification required fixes)**

If Step 4 surfaced no issues, there is nothing to commit here — the plan is done. If it did, fix, re-run steps 1-4, then:

```bash
git add -A
git commit -m "fix: address issues found during manual verification"
```
