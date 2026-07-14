# Accueil en blocs, recherche infinie, découverte swipe, icônes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homepage carousels with static grid blocks, add infinite scroll + a sort selector + a cleaner filter layout to the search page, add a Tinder-style swipe discovery screen backed by the existing local recommendation scoring, and replace every emoji in the UI with `lucide-react` icons.

**Architecture:** Extend `recommend.ts`/`profileStore.ts` with two new tracked lists (`swipedLiked`, `swipedDisliked`) and matching pure functions, with a migration path for profiles already stored in `localStorage` before this change. Rework `MovieRow` into `MovieBlock` (grid instead of horizontal scroll). Rework `SearchExplorer` to accumulate pages via `IntersectionObserver` and add a `sortMode` selector. Add a new `SwipeDeck` island using `framer-motion` drag (already a dependency) fed by the same `discoverMovies`/`getPopular` calls used elsewhere. Add `lucide-react` as a new dependency and a small `navIcons.ts` lookup table so `.astro` files can render icons without hydration.

**Tech Stack:** Astro, React islands, `framer-motion` (existing dependency, used for swipe drag), `lucide-react` (new dependency), TypeScript strict, Vitest for the pure-logic pieces.

---

## Reference: full spec

`docs/superpowers/specs/2026-07-14-blocks-swipe-icons-design.md` — read it before starting if anything below is unclear.

## Task 1: Install `lucide-react` and add the shared nav icon map

**Files:**
- Modify: `package.json` (via `npm install`)
- Modify: `src/lib/navItems.ts`
- Create: `src/lib/navIcons.ts`
- Modify: `src/components/Header.astro`
- Modify: `src/components/BottomNav.astro`

- [ ] **Step 1: Install the dependency**

Run: `npm install lucide-react`
Expected: `package.json`/`package-lock.json` updated, install succeeds.

- [ ] **Step 2: Replace `navItems.ts`**

```ts
export type NavIconKey = 'home' | 'search' | 'compass' | 'trophy' | 'user';

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconKey;
}

export const navItems: NavItem[] = [
  { href: '/', label: 'Accueil', icon: 'home' },
  { href: '/search', label: 'Recherche', icon: 'search' },
  { href: '/decouverte', label: 'Découverte', icon: 'compass' },
  { href: '/tops', label: 'Tops', icon: 'trophy' },
  { href: '/profile', label: 'Profil', icon: 'user' },
];
```

- [ ] **Step 3: Create `src/lib/navIcons.ts`**

```ts
import { Home, Search, Compass, Trophy, User } from 'lucide-react';
import type { NavIconKey } from './navItems';

export const navIcons: Record<NavIconKey, typeof Home> = {
  home: Home,
  search: Search,
  compass: Compass,
  trophy: Trophy,
  user: User,
};
```

- [ ] **Step 4: Replace `src/components/Header.astro`**

```astro
---
import { navItems } from '../lib/navItems';
import { navIcons } from '../lib/navIcons';

const currentPath = Astro.url.pathname;
---
<header class="sticky top-0 z-40 hidden items-center justify-between border-b border-white/10 bg-bg/80 px-8 py-2 backdrop-blur md:flex">
  <a href="/" class="flex min-h-11 items-center font-display text-xl">CineScope</a>
  <nav class="flex gap-6 text-sm text-white/70" aria-label="Navigation principale">
    {navItems.map((item) => {
      const Icon = navIcons[item.icon];
      return (
        <a
          href={item.href}
          class={`flex min-h-11 items-center gap-1.5 px-2 ${currentPath === item.href ? 'text-white' : 'hover:text-white'}`}
          aria-current={currentPath === item.href ? 'page' : undefined}
        >
          <Icon size={16} aria-hidden="true" />
          {item.label}
        </a>
      );
    })}
  </nav>
</header>
```

- [ ] **Step 5: Replace `src/components/BottomNav.astro`**

```astro
---
import { navItems } from '../lib/navItems';
import { navIcons } from '../lib/navIcons';

const currentPath = Astro.url.pathname;
---
<nav
  class="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-white/10 bg-surface/95 py-2 backdrop-blur md:hidden"
  style="padding-bottom: env(safe-area-inset-bottom)"
  aria-label="Navigation mobile"
>
  {navItems.map((item) => {
    const Icon = navIcons[item.icon];
    return (
      <a
        href={item.href}
        class={`flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 text-[10px] ${
          currentPath === item.href ? 'text-white' : 'text-white/70'
        }`}
        aria-current={currentPath === item.href ? 'page' : undefined}
      >
        <Icon size={20} aria-hidden="true" />
        {item.label}
      </a>
    );
  })}
</nav>
```

(5 nav items now instead of 4 — labels shrink to `text-[10px]` on the bottom bar only, to keep "Découverte" from wrapping awkwardly on narrow screens. Verify this visually in Task 10.)

- [ ] **Step 6: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: no errors. This is the first place a React component (the icon) is rendered inside an `.astro` file without a `client:*` directive — confirm the build succeeds and treat any failure here as a blocker to investigate before continuing (not a reason to add an unnecessary `client:load`).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/navItems.ts src/lib/navIcons.ts src/components/Header.astro src/components/BottomNav.astro
git commit -m "feat: add lucide-react and render nav icons from a lookup table"
```

## Task 2: Replace remaining emoji/glyphs with icons

**Files:**
- Modify: `src/components/Pagination.tsx`
- Modify: `src/islands/MovieDetail.tsx`

- [ ] **Step 1: `Pagination.tsx` — chevrons instead of arrow glyphs**

Replace the whole file:

```tsx
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}

const MAX_TMDB_PAGE = 500;

export default function Pagination({ page, totalPages, buildHref }: Props) {
  const clampedTotal = Math.min(totalPages, MAX_TMDB_PAGE);
  if (clampedTotal <= 1) return null;

  const hasPrev = page > 1;
  const hasNext = page < clampedTotal;

  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-4 text-sm">
      {hasPrev ? (
        <a
          href={buildHref(page - 1)}
          className="flex min-h-11 items-center gap-1 rounded-full border border-white/10 px-4 py-2 text-white/80"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Précédent
        </a>
      ) : (
        <span className="flex min-h-11 items-center gap-1 rounded-full border border-white/5 px-4 py-2 text-white/30">
          <ChevronLeft size={16} aria-hidden="true" />
          Précédent
        </span>
      )}
      <span className="text-white/60">
        Page {page} / {clampedTotal}
      </span>
      {hasNext ? (
        <a
          href={buildHref(page + 1)}
          className="flex min-h-11 items-center gap-1 rounded-full border border-white/10 px-4 py-2 text-white/80"
        >
          Suivant
          <ChevronRight size={16} aria-hidden="true" />
        </a>
      ) : (
        <span className="flex min-h-11 items-center gap-1 rounded-full border border-white/5 px-4 py-2 text-white/30">
          Suivant
          <ChevronRight size={16} aria-hidden="true" />
        </span>
      )}
    </nav>
  );
}
```

- [ ] **Step 2: `MovieDetail.tsx` — star/check/plus icons**

Add the import at the top of `src/islands/MovieDetail.tsx`:

```tsx
import { Star, Check, Plus } from 'lucide-react';
```

Replace the rating paragraph:

```tsx
        <p className="mt-1 flex items-center gap-1 text-sm text-white/60">
          {movie.release_date?.slice(0, 4)} · {movie.runtime} min ·
          <Star size={14} className="fill-current text-accent" aria-hidden="true" />
          {movie.vote_average.toFixed(1)}
        </p>
```

Replace the favorite button's contents:

```tsx
        <button
          onClick={toggleFavorite}
          aria-pressed={isFavorite}
          className={`mt-4 flex min-h-11 items-center gap-2 rounded-full px-6 py-2 text-sm font-semibold ${
            isFavorite ? 'bg-accent text-black' : 'border border-white/20 text-white'
          }`}
        >
          {isFavorite ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
          {isFavorite ? 'Dans mes favoris' : 'Ajouter aux favoris'}
        </button>
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/Pagination.tsx src/islands/MovieDetail.tsx
git commit -m "feat: replace pagination/rating/favorite glyphs with lucide icons"
```

## Task 3: Homepage — `MovieRow` becomes `MovieBlock` (grid instead of carousel)

**Files:**
- Create: `src/islands/MovieBlock.tsx` (replaces `src/islands/MovieRow.tsx`)
- Delete: `src/islands/MovieRow.tsx`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Create `src/islands/MovieBlock.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import MovieCard from '../components/MovieCard';
import { getTrending, getUpcoming, getPopular, getTopRated, getNowPlaying, type TMDBMovie } from '../lib/tmdb';

// Astro serializes client:load island props to JSON, so a function reference
// (e.g. passing `getTrending` directly) always arrives client-side as null.
// We pass a string key instead and resolve it to the real fetcher here.
const FETCHERS = {
  trending: getTrending,
  upcoming: getUpcoming,
  popular: getPopular,
  topRated: getTopRated,
  nowPlaying: getNowPlaying,
} as const;

const BLOCK_SIZE = 10;

interface Props {
  title: string;
  fetcher: keyof typeof FETCHERS;
  seeAllHref?: string;
}

export default function MovieBlock({ title, fetcher, seeAllHref }: Props) {
  const [movies, setMovies] = useState<TMDBMovie[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setMovies(null);
    setError(false);
    FETCHERS[fetcher]()
      .then((data) => {
        if (!cancelled) setMovies(data.results);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [fetcher]);

  const headingId = `block-${title.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <section aria-labelledby={headingId} className="px-4 py-6 md:px-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 id={headingId} className="font-display text-xl">{title}</h2>
        {seeAllHref && (
          <a href={seeAllHref} className="flex min-h-11 items-center gap-0.5 text-sm text-white/60 hover:text-white">
            Voir tout
            <ChevronRight size={16} aria-hidden="true" />
          </a>
        )}
      </div>
      {error && <p className="text-sm text-white/50">Impossible de charger cette section.</p>}
      {!error && !movies && <p className="text-sm text-white/50">Chargement…</p>}
      {movies && movies.length === 0 && <p className="text-sm text-white/50">Rien à afficher pour le moment.</p>}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
        {movies?.slice(0, BLOCK_SIZE).map((movie) => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Delete the old file**

```bash
git rm src/islands/MovieRow.tsx
```

- [ ] **Step 3: Update `src/pages/index.astro`**

```astro
---
import Layout from '../components/Layout.astro';
import MovieBlock from '../islands/MovieBlock';
import RecommendedRow from '../islands/RecommendedRow';
---
<Layout title="Accueil">
  <h1 class="px-4 pt-8 font-display text-3xl md:px-8">CineScope</h1>
  <RecommendedRow client:load />
  <MovieBlock client:load title="Tendances du jour" fetcher="trending" seeAllHref="/films/tendances" />
  <MovieBlock client:load title="Au cinéma" fetcher="nowPlaying" seeAllHref="/films/au-cinema" />
  <MovieBlock client:load title="Populaires" fetcher="popular" seeAllHref="/films/populaires" />
  <MovieBlock client:load title="Mieux notés" fetcher="topRated" seeAllHref="/films/mieux-notes" />
  <MovieBlock client:load title="Prochainement" fetcher="upcoming" seeAllHref="/films/prochainement" />
</Layout>
```

- [ ] **Step 4: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: no errors, no leftover reference to `MovieRow` anywhere (confirm with a search — it should only be `MovieBlock` now).

- [ ] **Step 5: Commit**

```bash
git add -A src/islands/MovieBlock.tsx src/pages/index.astro
git commit -m "feat(home): replace carousel rows with grid blocks (MovieBlock)"
```

## Task 4: `searchMovies` gains a `page` parameter

**Files:**
- Modify: `src/lib/tmdb.ts`

- [ ] **Step 1: Add the parameter**

Replace:

```ts
export function searchMovies(query: string, signal?: AbortSignal): Promise<TMDBListResponse<TMDBMovie>> {
  return tmdbFetch('/search/movie', { query }, signal);
}
```

with:

```ts
export function searchMovies(query: string, page = 1, signal?: AbortSignal): Promise<TMDBListResponse<TMDBMovie>> {
  return tmdbFetch('/search/movie', { query, page: String(page) }, signal);
}
```

(No existing caller passes a second positional argument, so this is safe — same reasoning as the earlier `page` additions.)

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/tmdb.ts
git commit -m "feat(tmdb): add page parameter to searchMovies"
```

## Task 5: `recommend.ts` — swipe scoring functions (TDD)

**Files:**
- Modify: `src/lib/recommend.ts`
- Test: `tests/recommend.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/recommend.test.ts` (add `recordSwipeLike, recordSwipeDislike, resetSwipeDislikes, excludeSwiped` to the existing import from `../src/lib/recommend`):

```ts
describe('recordSwipeLike', () => {
  it('adds 2 points per genre and appends the movie id to swipedLiked', () => {
    const profile = recordSwipeLike(createEmptyProfile(), 200, [28, 12]);
    expect(profile.genres).toEqual({ 28: 2, 12: 2 });
    expect(profile.swipedLiked).toEqual([200]);
  });

  it('does not duplicate a movie id already swiped-liked', () => {
    let profile = recordSwipeLike(createEmptyProfile(), 200, [28]);
    profile = recordSwipeLike(profile, 200, [28]);
    expect(profile.swipedLiked).toEqual([200]);
    expect(profile.genres[28]).toBe(4);
  });
});

describe('recordSwipeDislike', () => {
  it('appends the movie id to swipedDisliked without touching scores', () => {
    const profile = recordSwipeDislike(createEmptyProfile(), 300);
    expect(profile.swipedDisliked).toEqual([300]);
    expect(profile.genres).toEqual({});
  });

  it('does not duplicate a movie id already swiped-disliked', () => {
    let profile = recordSwipeDislike(createEmptyProfile(), 300);
    profile = recordSwipeDislike(profile, 300);
    expect(profile.swipedDisliked).toEqual([300]);
  });
});

describe('resetSwipeDislikes', () => {
  it('clears swipedDisliked but keeps swipedLiked and scores', () => {
    let profile = recordSwipeLike(createEmptyProfile(), 1, [28]);
    profile = recordSwipeDislike(profile, 2);
    profile = resetSwipeDislikes(profile);
    expect(profile.swipedDisliked).toEqual([]);
    expect(profile.swipedLiked).toEqual([1]);
    expect(profile.genres).toEqual({ 28: 2 });
  });
});

describe('excludeSwiped', () => {
  it('filters out favorited, swiped-liked and swiped-disliked ids', () => {
    const profile = { genres: {}, directors: {}, favorites: [1], swipedLiked: [2], swipedDisliked: [3] };
    const movies = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    expect(excludeSwiped(movies, profile)).toEqual([{ id: 4 }]);
  });

  it('treats missing swipedLiked/swipedDisliked as empty', () => {
    const profile = { genres: {}, directors: {}, favorites: [1] };
    const movies = [{ id: 1 }, { id: 2 }];
    expect(excludeSwiped(movies, profile)).toEqual([{ id: 2 }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- recommend`
Expected: FAIL — `recordSwipeLike`/`recordSwipeDislike`/`resetSwipeDislikes`/`excludeSwiped` are not exported yet.

- [ ] **Step 3: Implement**

Replace the `ProfileScores` interface and `createEmptyProfile`:

```ts
export interface ProfileScores {
  genres: Record<number, number>;
  directors: Record<number, number>;
  favorites: number[];
  swipedLiked?: number[];
  swipedDisliked?: number[];
}

export function createEmptyProfile(): ProfileScores {
  return { genres: {}, directors: {}, favorites: [], swipedLiked: [], swipedDisliked: [] };
}
```

Append at the end of the file:

```ts
const SWIPE_LIKE_GENRE_POINTS = 2;

// Lighter weight than recordFavorite (a swipe is a lighter signal than an
// explicit favorite) and doesn't credit a director — the swipe deck works
// from list-endpoint movies, which only carry genre_ids, not crew.
export function recordSwipeLike(profile: ProfileScores, movieId: number, genreIds: number[]): ProfileScores {
  const genres = { ...profile.genres };
  for (const id of genreIds) {
    genres[id] = (genres[id] ?? 0) + SWIPE_LIKE_GENRE_POINTS;
  }
  const swipedLiked = profile.swipedLiked ?? [];
  const nextSwipedLiked = swipedLiked.includes(movieId) ? swipedLiked : [...swipedLiked, movieId];
  return { ...profile, genres, swipedLiked: nextSwipedLiked };
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- recommend`
Expected: PASS (all `recommend.test.ts` tests, including the new ones).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/recommend.ts tests/recommend.test.ts
git commit -m "feat(recommend): add swipe-like/dislike scoring and exclusion helper"
```

## Task 6: `profileStore.ts` — swipe actions and legacy-profile migration (TDD)

**Files:**
- Modify: `src/stores/profileStore.ts`
- Test: `tests/profileStore.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/profileStore.test.ts`, update the two existing full-object equality assertions (they'll otherwise fail once `createEmptyProfile()` includes the two new array fields):

Replace:

```ts
  it('resetProfile clears all persisted data', async () => {
    const mod = await import('../src/stores/profileStore');
    mod.favoriteMovie(1, [1], 1);
    mod.resetProfile();
    expect(mod.profileStore.get()).toEqual({ genres: {}, directors: {}, favorites: [] });
  });

  it('ignores a corrupted profile in localStorage and starts fresh', async () => {
    window.localStorage.setItem('cinescope:profile', '{"not":"a valid profile"}');
    const mod = await import('../src/stores/profileStore');
    expect(mod.profileStore.get()).toEqual({ genres: {}, directors: {}, favorites: [] });
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

Then append these new tests at the end of the `describe('profileStore', ...)` block (before its closing `});`):

```ts
  it('persists a swipe-like across store reloads', async () => {
    const mod1 = await import('../src/stores/profileStore');
    mod1.swipeLikeMovie(55, [28]);
    expect(mod1.profileStore.get().swipedLiked).toEqual([55]);

    vi.resetModules();
    const mod2 = await import('../src/stores/profileStore');
    expect(mod2.profileStore.get().swipedLiked).toEqual([55]);
    expect(mod2.profileStore.get().genres[28]).toBe(2);
  });

  it('does not double-count score when swipe-liking the same movie twice', async () => {
    const mod = await import('../src/stores/profileStore');
    mod.swipeLikeMovie(55, [28]);
    mod.swipeLikeMovie(55, [28]);
    expect(mod.profileStore.get().genres[28]).toBe(2);
    expect(mod.profileStore.get().swipedLiked).toEqual([55]);
  });

  it('swipeDislikeMovie records the id without touching scores', async () => {
    const mod = await import('../src/stores/profileStore');
    mod.swipeDislikeMovie(77);
    expect(mod.profileStore.get().swipedDisliked).toEqual([77]);
    expect(mod.profileStore.get().genres).toEqual({});
  });

  it('clearSwipeDislikes empties swipedDisliked but keeps swipedLiked', async () => {
    const mod = await import('../src/stores/profileStore');
    mod.swipeLikeMovie(1, [28]);
    mod.swipeDislikeMovie(2);
    mod.clearSwipeDislikes();
    expect(mod.profileStore.get().swipedDisliked).toEqual([]);
    expect(mod.profileStore.get().swipedLiked).toEqual([1]);
  });

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
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm run test -- profileStore`
Expected: FAIL — `swipeLikeMovie`/`swipeDislikeMovie`/`clearSwipeDislikes` are not exported yet, and the migration test doesn't backfill the new fields.

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- profileStore`
Expected: PASS (all tests, including the migration test).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/stores/profileStore.ts tests/profileStore.test.ts
git commit -m "feat(profile): add swipe actions and migrate profiles missing the new fields"
```

## Task 7: Search page — sort mode, infinite scroll, redesigned filters

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
import { topGenres, excludeFavorites } from '../lib/recommend';

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
  const [genre, setGenre] = useState<number | null>(null);
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

  function buildRequest(pageNum: number) {
    if (isTextSearch) return searchMovies(query.trim(), pageNum);
    const params: DiscoverParams = {
      genres: isPourVous ? preferredGenres : genre ? [genre] : undefined,
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
          const results = isPourVous ? excludeFavorites(data.results, profile) : data.results;
          setMovies(results);
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
  }, [query, genre, minRating, year, sortMode, preferredGenres.join(','), pourVousUnavailable]);

  // Loads the next page when the sentinel at the bottom of the grid scrolls into view.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || pourVousUnavailable || page >= totalPages) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || fetchingMoreRef.current) return;
        fetchingMoreRef.current = true;
        const nextPage = page + 1;
        setLoading(true);
        buildRequest(nextPage)
          .then((data) => {
            const results = isPourVous ? excludeFavorites(data.results, profile) : data.results;
            setMovies((prev) => [...prev, ...results]);
            setPage(nextPage);
            setTotalPages(data.total_pages);
          })
          .catch(() => setError(true))
          .finally(() => {
            setLoading(false);
            fetchingMoreRef.current = false;
          });
      },
      { rootMargin: '400px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, totalPages, pourVousUnavailable]);

  const hasActiveFilters = genre !== null || year !== 0 || minRating !== 0 || sortMode !== 'tendance';

  function resetFilters() {
    setGenre(null);
    setYear(0);
    setMinRating(0);
    setSortMode('tendance');
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
        className="mt-4 w-full rounded-full border border-white/10 bg-surface/80 px-4 py-3 text-sm backdrop-blur placeholder:text-white/40"
      />

      <div className="mt-4 flex items-center gap-2 text-xs uppercase tracking-wide text-white/50">
        <SlidersHorizontal size={14} aria-hidden="true" />
        Filtres
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="ml-auto flex min-h-11 items-center gap-1 rounded-full border border-white/10 px-3 py-1 normal-case text-white/70"
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
            className="min-h-11 rounded-full border border-white/10 bg-surface/60 px-3 py-1.5 text-xs text-white/80"
          >
            <option value="tendance">Trier par tendance</option>
            <option value="note">Trier par note</option>
            <option value="pour-vous">Trier par pour vous</option>
          </select>
        </div>
      )}

      {sortMode !== 'pour-vous' && (
        <div role="group" aria-label="Filtrer par genre" className="mt-3 flex flex-wrap gap-2">
          {genres.map((g) => (
            <button
              key={g.id}
              aria-pressed={genre === g.id}
              onClick={() => setGenre(genre === g.id ? null : g.id)}
              className={`flex min-h-11 items-center rounded-full border border-white/10 px-3 py-1.5 text-xs backdrop-blur ${
                genre === g.id ? 'bg-accent text-black' : 'bg-surface/60 text-white/80'
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
          className="min-h-11 rounded-full border border-white/10 bg-surface/60 px-3 py-1.5 text-xs text-white/80"
        >
          <option value={0}>Note minimum</option>
          <option value={5}>5+</option>
          <option value={7}>7+</option>
          <option value={8}>8+</option>
        </select>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="min-h-11 rounded-full border border-white/10 bg-surface/60 px-3 py-1.5 text-xs text-white/80"
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
git commit -m "feat(search): add sort mode, infinite scroll, and redesigned filter bar"
```

## Task 8: Swipe discovery screen (`/decouverte`)

**Files:**
- Create: `src/islands/SwipeDeck.tsx`
- Create: `src/pages/decouverte.astro`

- [ ] **Step 1: Create `src/islands/SwipeDeck.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { Heart, X, Star } from 'lucide-react';
import { discoverMovies, getPopular, tmdbImageUrl, type TMDBMovie } from '../lib/tmdb';
import { topGenres, excludeSwiped } from '../lib/recommend';
import { profileStore, swipeLikeMovie, swipeDislikeMovie, clearSwipeDislikes } from '../stores/profileStore';

const MAX_SWIPE_PAGES = 20;
const BUFFER_LOW_WATERMARK = 5;
const SWIPE_THRESHOLD = 120;
const SWIPE_VELOCITY_THRESHOLD = 800;

function SwipeCard({ movie }: { movie: TMDBMovie }) {
  const poster = tmdbImageUrl(movie.poster_path, 'w500');
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-surface shadow-xl">
      {poster ? (
        <img src={poster} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <div className="flex h-full items-center justify-center text-white/50">Pas d'affiche</div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
        <p className="font-display text-lg text-white">{movie.title}</p>
        <p className="flex items-center gap-1 text-xs text-white/70">
          <Star size={12} className="fill-current text-accent" aria-hidden="true" />
          {movie.vote_average.toFixed(1)}
        </p>
      </div>
    </div>
  );
}

export default function SwipeDeck() {
  const profile = useStore(profileStore);
  const [deck, setDeck] = useState<TMDBMovie[]>([]);
  const [page, setPage] = useState(1);
  const [exhausted, setExhausted] = useState(false);
  const [loading, setLoading] = useState(false);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const likeOpacity = useTransform(x, [20, 120], [0, 1]);
  const passOpacity = useTransform(x, [-120, -20], [1, 0]);

  const genres = topGenres(profile, 2);

  useEffect(() => {
    if (exhausted || loading) return;
    if (deck.length >= BUFFER_LOW_WATERMARK) return;
    if (page > MAX_SWIPE_PAGES) {
      if (deck.length === 0) setExhausted(true);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const request = genres.length > 0
      ? discoverMovies({ genres, sortBy: 'popularity.desc' }, page)
      : getPopular(page);
    request
      .then((result) => {
        if (cancelled) return;
        const filtered = excludeSwiped(result.results, profile);
        setDeck((prev) => [...prev, ...filtered]);
        setPage((p) => p + 1);
      })
      .catch(() => {
        if (!cancelled) setExhausted(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck.length, page, exhausted, loading, genres.join(',')]);

  const topMovie = deck[0];
  const nextMovie = deck[1];

  function decide(direction: 'like' | 'dislike') {
    if (!topMovie) return;
    if (direction === 'like') {
      swipeLikeMovie(topMovie.id, topMovie.genre_ids ?? []);
    } else {
      swipeDislikeMovie(topMovie.id);
    }
    setDeck((prev) => prev.slice(1));
    x.set(0);
  }

  function handleDragEnd(_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (info.offset.x > SWIPE_THRESHOLD || info.velocity.x > SWIPE_VELOCITY_THRESHOLD) {
      decide('like');
    } else if (info.offset.x < -SWIPE_THRESHOLD || info.velocity.x < -SWIPE_VELOCITY_THRESHOLD) {
      decide('dislike');
    }
  }

  function restart() {
    clearSwipeDislikes();
    setExhausted(false);
    setPage(1);
  }

  return (
    <div className="flex flex-col items-center px-4 py-6 md:px-8">
      <h1 className="font-display text-2xl">Découverte</h1>
      <p className="mt-1 text-center text-sm text-white/60">
        Glissez à droite pour l'ajouter à votre liste, à gauche pour passer.
      </p>

      <div className="relative mt-6 h-[28rem] w-64 sm:w-72">
        {exhausted && deck.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-surface/60 p-6 text-center">
            <p className="text-white/70">Vous avez tout vu !</p>
            <button
              onClick={restart}
              className="min-h-11 rounded-full border border-white/20 px-6 py-2 text-sm text-white"
            >
              Revoir les films passés
            </button>
          </div>
        )}

        {!exhausted && !topMovie && (
          <p className="flex h-full items-center justify-center text-sm text-white/50">Chargement…</p>
        )}

        {nextMovie && (
          <div className="absolute inset-0 scale-95 opacity-60">
            <SwipeCard movie={nextMovie} />
          </div>
        )}

        {topMovie && (
          <motion.div
            key={topMovie.id}
            className="absolute inset-0 cursor-grab active:cursor-grabbing"
            style={{ x, rotate }}
            drag="x"
            dragSnapToOrigin
            onDragEnd={handleDragEnd}
          >
            <SwipeCard movie={topMovie} />
            <motion.div
              style={{ opacity: likeOpacity }}
              className="pointer-events-none absolute right-4 top-4 rounded-full bg-accent px-3 py-1 text-xs font-bold text-black"
            >
              J'aime
            </motion.div>
            <motion.div
              style={{ opacity: passOpacity }}
              className="pointer-events-none absolute left-4 top-4 rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white"
            >
              Passer
            </motion.div>
          </motion.div>
        )}
      </div>

      <div className="mt-6 flex gap-6">
        <button
          onClick={() => decide('dislike')}
          disabled={!topMovie}
          aria-label="Passer ce film"
          className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 text-white/80 disabled:opacity-30"
        >
          <X size={24} aria-hidden="true" />
        </button>
        <button
          onClick={() => decide('like')}
          disabled={!topMovie}
          aria-label="Ajouter à ma liste"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-black disabled:opacity-30"
        >
          <Heart size={24} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/pages/decouverte.astro`**

```astro
---
import Layout from '../components/Layout.astro';
import SwipeDeck from '../islands/SwipeDeck';
---
<Layout title="Découverte">
  <SwipeDeck client:load />
</Layout>
```

- [ ] **Step 3: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: no errors, `/decouverte` appears as a prerendered static page in the build log.

- [ ] **Step 4: Commit**

```bash
git add src/islands/SwipeDeck.tsx src/pages/decouverte.astro
git commit -m "feat: add Tinder-style swipe discovery screen (/decouverte)"
```

## Task 9: Profile page — "À voir" section for swipe-liked movies

**Files:**
- Modify: `src/islands/ProfileView.tsx`

- [ ] **Step 1: Add state and a data-loading effect**

Add to the top of the component (after the existing `favoriteMovies`/`favoritesError` state):

```tsx
  const [toWatchMovies, setToWatchMovies] = useState<TMDBMovie[] | null>(null);
  const [toWatchError, setToWatchError] = useState(false);
```

Add a new effect alongside the existing favorites-loading effect:

```tsx
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
```

- [ ] **Step 2: Render the new section**

Insert after the "Mes favoris" `</section>` and before the "Vider mes données" button:

```tsx
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
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/islands/ProfileView.tsx
git commit -m "feat(profile): add \"À voir\" section for swipe-liked movies"
```

## Task 10: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, including the new `recommend.test.ts` and `profileStore.test.ts` cases.

- [ ] **Step 2: Typecheck the whole project**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Confirm no emoji remain**

Run (ripgrep or equivalent): search `src/` for the emoji characters listed in the spec's §2 table (🏠 🔍 🏆 👤 ⭐ ✓) — expect zero matches outside of this plan/spec's own markdown files.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds. Confirm in the log: `/decouverte` is prerendered, `/films/*` and `/tops` are still prerendered, `/movie/[id]` and `/personne/[id]` remain on-demand.

- [ ] **Step 5: Manual verification in the browser**

Run: `npm run dev`, then check:
- Homepage: 5 sections render as static grids (not horizontal scroll), each capped around 10 cards, each with a working "Voir tout" link; nav (header on desktop width, bottom bar on mobile width) shows 5 icons (no emoji) including the new "Découverte" entry, highlighted correctly on each page.
- `/search`: typing hides the sort selector; without a query, switching "Trier par" between Tendance/Note/Pour vous changes results (Pour vous shows the "Explorez des films…" message on a fresh profile with no scores yet); scrolling down the results grid loads more automatically; "Réinitialiser" appears only when a filter is active and clears it.
- `/decouverte`: a draggable card appears; dragging right past the threshold (or clicking the heart button) removes it and reveals the next one; dragging left / clicking X does the same for "pass"; after several likes, `/profile` shows them under "À voir".
- `/movie/[id]`: rating shows a star icon, favorite button shows a plus/check icon (no emoji).
- Pagination on `/films/*` and `/tops` shows chevron icons instead of arrow characters.

- [ ] **Step 6: Commit (only if manual verification required fixes)**

If Step 5 surfaced no issues, there is nothing to commit here — the plan is done. If it did, fix, re-run steps 1-4, then:

```bash
git add -A
git commit -m "fix: address issues found during manual verification"
```
