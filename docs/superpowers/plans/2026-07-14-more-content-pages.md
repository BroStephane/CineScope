# Accueil enrichi, pages catégories, Tops, pages Réalisateur/Acteur Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show more movies on the homepage, add real paginated "see all" category pages, add a Tops page (top rated / top by genre / top of the year), and add director/actor filmography pages, all without a backend — everything still goes through `src/lib/tmdb.ts` and client-side fetch, same architecture as the existing MVP.

**Architecture:** Extend `tmdb.ts` with a few new thin fetch wrappers and a paging-aware `discoverMovies`/`buildDiscoverQuery`. Add two new static Astro routes (`/films/[category]`, `/tops`) driven by React islands that read pagination/tab state from the URL query string via plain `<a href="?...">` links (bookmarkable, no router). Add one new on-demand route (`/personne/[id]`, same pattern as the existing `/movie/[id]`) for director/actor filmography. Link into it from the existing movie detail page.

**Tech Stack:** Astro (SSG + one Vercel on-demand route pattern, now two), React islands, TypeScript strict, Vitest for the pure-logic pieces (query building, URL parsing) — consistent with how the rest of the codebase is tested today (no component-testing framework is installed; UI is verified manually in the browser).

---

## Reference: full spec

`docs/superpowers/specs/2026-07-14-more-content-pages-design.md` — read it before starting if anything below is unclear.

## Task 1: `TMDBListResponse` paging fields + paginated list fetchers

**Files:**
- Modify: `src/lib/tmdb.ts:38-41` (interface), `src/lib/tmdb.ts:74-80` (getTrending/getUpcoming)

- [ ] **Step 1: Add `page`/`total_pages` to `TMDBListResponse` and a `page` parameter to `getTrending`/`getUpcoming`**

Replace:

```ts
export interface TMDBListResponse<T> {
  results: T[];
}
```

with:

```ts
export interface TMDBListResponse<T> {
  results: T[];
  page: number;
  total_pages: number;
}
```

Replace:

```ts
export function getTrending(signal?: AbortSignal): Promise<TMDBListResponse<TMDBMovie>> {
  return tmdbFetch('/trending/movie/day', {}, signal);
}

export function getUpcoming(signal?: AbortSignal): Promise<TMDBListResponse<TMDBMovie>> {
  return tmdbFetch('/movie/upcoming', {}, signal);
}
```

with:

```ts
export function getTrending(page = 1, signal?: AbortSignal): Promise<TMDBListResponse<TMDBMovie>> {
  return tmdbFetch('/trending/movie/day', { page: String(page) }, signal);
}

export function getUpcoming(page = 1, signal?: AbortSignal): Promise<TMDBListResponse<TMDBMovie>> {
  return tmdbFetch('/movie/upcoming', { page: String(page) }, signal);
}

export function getPopular(page = 1, signal?: AbortSignal): Promise<TMDBListResponse<TMDBMovie>> {
  return tmdbFetch('/movie/popular', { page: String(page) }, signal);
}

export function getTopRated(page = 1, signal?: AbortSignal): Promise<TMDBListResponse<TMDBMovie>> {
  return tmdbFetch('/movie/top_rated', { page: String(page) }, signal);
}

export function getNowPlaying(page = 1, signal?: AbortSignal): Promise<TMDBListResponse<TMDBMovie>> {
  return tmdbFetch('/movie/now_playing', { page: String(page) }, signal);
}
```

No existing caller passes a `signal` positionally today (`MovieRow` calls `FETCHERS[fetcher]()`, `RecommendedRow`/`SearchExplorer` call `discoverMovies(...)`/`searchMovies(...)` with no second arg), so inserting `page` before `signal` is safe.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors (existing callers of `getTrending()`/`getUpcoming()` still compile since `page` defaults to `1`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/tmdb.ts
git commit -m "feat(tmdb): add paging fields and popular/top-rated/now-playing fetchers"
```

## Task 2: `buildDiscoverQuery` gains `sortBy` and `minVoteCount`

**Files:**
- Modify: `src/lib/tmdb.ts:90-108` (DiscoverParams, buildDiscoverQuery, discoverMovies)
- Test: `tests/tmdb.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tests/tmdb.test.ts`, inside the existing `describe('buildDiscoverQuery', ...)` block:

```ts
  it('overrides sort_by when sortBy is provided', () => {
    expect(buildDiscoverQuery({ sortBy: 'vote_average.desc' })).toEqual({
      sort_by: 'vote_average.desc',
    });
  });

  it('adds a minimum vote count filter', () => {
    expect(buildDiscoverQuery({ minVoteCount: 300 })).toEqual({
      sort_by: 'popularity.desc',
      'vote_count.gte': '300',
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- tmdb`
Expected: FAIL — `Object literal may only specify known properties` / property `sortBy`/`minVoteCount` does not exist on `DiscoverParams` (or the two new assertions fail because the fields are silently ignored).

- [ ] **Step 3: Implement**

Replace the `DiscoverParams` interface and `buildDiscoverQuery`/`discoverMovies` functions:

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

export function discoverMovies(
  params: DiscoverParams,
  page = 1,
  signal?: AbortSignal
): Promise<TMDBListResponse<TMDBMovie>> {
  return tmdbFetch('/discover/movie', { ...buildDiscoverQuery(params), page: String(page) }, signal);
}
```

(Same safety note as Task 1: no existing caller of `discoverMovies` passes a second positional argument, so inserting `page` before `signal` is safe.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- tmdb`
Expected: PASS (all `buildDiscoverQuery` and `tmdbImageUrl` tests, including the two new ones).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tmdb.ts tests/tmdb.test.ts
git commit -m "feat(tmdb): add sortBy/minVoteCount discover params and paged discoverMovies"
```

## Task 3: Person detail + movie credits fetchers

**Files:**
- Modify: `src/lib/tmdb.ts` (append near the bottom, after `getGenres`)

- [ ] **Step 1: Add the person types and fetchers**

Append to `src/lib/tmdb.ts`:

```ts
export interface TMDBPersonDetail {
  id: number;
  name: string;
  biography: string;
  profile_path: string | null;
}

export interface TMDBPersonCastCredit extends TMDBMovie {
  character: string;
}

export interface TMDBPersonCrewCredit extends TMDBMovie {
  job: string;
}

export interface TMDBPersonMovieCredits {
  cast: TMDBPersonCastCredit[];
  crew: TMDBPersonCrewCredit[];
}

export function getPersonDetail(id: number, signal?: AbortSignal): Promise<TMDBPersonDetail> {
  return tmdbFetch(`/person/${id}`, {}, signal);
}

export function getPersonMovieCredits(id: number, signal?: AbortSignal): Promise<TMDBPersonMovieCredits> {
  return tmdbFetch(`/person/${id}/movie_credits`, {}, signal);
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/tmdb.ts
git commit -m "feat(tmdb): add person detail and movie credits fetchers"
```

## Task 4: URL page-param parsing helper (`src/lib/pagination.ts`)

**Files:**
- Create: `src/lib/pagination.ts`
- Test: `tests/pagination.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/pagination.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parsePageParam } from '../src/lib/pagination';

describe('parsePageParam', () => {
  it('defaults to 1 when the param is missing', () => {
    expect(parsePageParam('')).toBe(1);
  });

  it('reads a valid page number', () => {
    expect(parsePageParam('?page=3')).toBe(3);
  });

  it('defaults to 1 for non-numeric values', () => {
    expect(parsePageParam('?page=abc')).toBe(1);
  });

  it('defaults to 1 for zero or negative values', () => {
    expect(parsePageParam('?page=0')).toBe(1);
    expect(parsePageParam('?page=-5')).toBe(1);
  });

  it('defaults to 1 for non-integer values', () => {
    expect(parsePageParam('?page=2.5')).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- pagination`
Expected: FAIL with "Cannot find module '../src/lib/pagination'".

- [ ] **Step 3: Implement**

Create `src/lib/pagination.ts`:

```ts
export function parsePageParam(search: string, key = 'page'): number {
  const raw = Number(new URLSearchParams(search).get(key));
  return Number.isInteger(raw) && raw > 0 ? raw : 1;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- pagination`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pagination.ts tests/pagination.test.ts
git commit -m "feat: add parsePageParam URL helper"
```

## Task 5: Shared `Pagination` component

**Files:**
- Create: `src/components/Pagination.tsx`

- [ ] **Step 1: Create the component**

```tsx
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
          className="flex min-h-11 items-center rounded-full border border-white/10 px-4 py-2 text-white/80"
        >
          ← Précédent
        </a>
      ) : (
        <span className="flex min-h-11 items-center rounded-full border border-white/5 px-4 py-2 text-white/30">
          ← Précédent
        </span>
      )}
      <span className="text-white/60">
        Page {page} / {clampedTotal}
      </span>
      {hasNext ? (
        <a
          href={buildHref(page + 1)}
          className="flex min-h-11 items-center rounded-full border border-white/10 px-4 py-2 text-white/80"
        >
          Suivant →
        </a>
      ) : (
        <span className="flex min-h-11 items-center rounded-full border border-white/5 px-4 py-2 text-white/30">
          Suivant →
        </span>
      )}
    </nav>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/Pagination.tsx
git commit -m "feat: add shared Pagination component"
```

## Task 6: Homepage — more rows + "Voir tout" links

**Files:**
- Modify: `src/islands/MovieRow.tsx`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Add the new fetchers and a `seeAllHref` prop to `MovieRow`**

Replace the top of `src/islands/MovieRow.tsx` (imports + `FETCHERS` + `Props`):

```tsx
import { useEffect, useState } from 'react';
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

interface Props {
  title: string;
  fetcher: keyof typeof FETCHERS;
  seeAllHref?: string;
}
```

Replace the `return` block's opening `<section>` heading markup:

```tsx
  return (
    <section aria-labelledby={headingId} className="px-4 py-6 md:px-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 id={headingId} className="font-display text-xl">{title}</h2>
        {seeAllHref && (
          <a href={seeAllHref} className="flex min-h-11 items-center text-sm text-white/60 hover:text-white">
            Voir tout →
          </a>
        )}
      </div>
      {error && <p className="text-sm text-white/50">Impossible de charger cette section.</p>}
```

(Everything else in the file — the `useEffect`, the `headingId` computation, the movie grid — stays the same. The function signature is now `export default function MovieRow({ title, fetcher, seeAllHref }: Props)`.)

- [ ] **Step 2: Add the new rows to the homepage**

Replace `src/pages/index.astro`:

```astro
---
import Layout from '../components/Layout.astro';
import MovieRow from '../islands/MovieRow';
import RecommendedRow from '../islands/RecommendedRow';
---
<Layout title="Accueil">
  <h1 class="px-4 pt-8 font-display text-3xl md:px-8">CineScope</h1>
  <RecommendedRow client:load />
  <MovieRow client:load title="Tendances du jour" fetcher="trending" seeAllHref="/films/tendances" />
  <MovieRow client:load title="Au cinéma" fetcher="nowPlaying" seeAllHref="/films/au-cinema" />
  <MovieRow client:load title="Populaires" fetcher="popular" seeAllHref="/films/populaires" />
  <MovieRow client:load title="Mieux notés" fetcher="topRated" seeAllHref="/films/mieux-notes" />
  <MovieRow client:load title="Prochainement" fetcher="upcoming" seeAllHref="/films/prochainement" />
</Layout>
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/islands/MovieRow.tsx src/pages/index.astro
git commit -m "feat(home): add popular/top-rated/now-playing rows with see-all links"
```

## Task 7: Category grid island + `/films/[category]` page

**Files:**
- Create: `src/islands/CategoryGrid.tsx`
- Create: `src/pages/films/[category].astro`

- [ ] **Step 1: Create the island**

```tsx
import { useEffect, useState } from 'react';
import MovieCard from '../components/MovieCard';
import Pagination from '../components/Pagination';
import { parsePageParam } from '../lib/pagination';
import {
  getTrending,
  getUpcoming,
  getPopular,
  getTopRated,
  getNowPlaying,
  type TMDBListResponse,
  type TMDBMovie,
} from '../lib/tmdb';

const CATEGORY_FETCHERS: Record<
  string,
  { title: string; fetcher: (page: number, signal?: AbortSignal) => Promise<TMDBListResponse<TMDBMovie>> }
> = {
  tendances: { title: 'Tendances du jour', fetcher: getTrending },
  'au-cinema': { title: 'Au cinéma', fetcher: getNowPlaying },
  populaires: { title: 'Populaires', fetcher: getPopular },
  'mieux-notes': { title: 'Mieux notés', fetcher: getTopRated },
  prochainement: { title: 'Prochainement', fetcher: getUpcoming },
};

export default function CategoryGrid({ category }: { category: string }) {
  const entry = CATEGORY_FETCHERS[category];
  const [page, setPage] = useState(1);
  const [data, setData] = useState<TMDBListResponse<TMDBMovie> | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setPage(parsePageParam(window.location.search));
  }, []);

  useEffect(() => {
    if (!entry) return;
    let cancelled = false;
    setData(null);
    setError(false);
    entry
      .fetcher(page)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [category, page]);

  if (!entry) return <p className="px-4 py-8 text-white/60">Catégorie inconnue.</p>;

  return (
    <div className="px-4 py-6 md:px-8">
      <h1 className="font-display text-2xl">{entry.title}</h1>
      {error && <p className="mt-6 text-sm text-white/50">Impossible de charger cette section.</p>}
      {!error && !data && <p className="mt-6 text-sm text-white/50">Chargement…</p>}
      {data && data.results.length === 0 && (
        <p className="mt-6 text-sm text-white/50">Rien à afficher pour le moment.</p>
      )}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
        {data?.results.map((movie) => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>
      {data && data.results.length > 0 && (
        <Pagination page={data.page} totalPages={data.total_pages} buildHref={(p) => `/films/${category}?page=${p}`} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the static route**

Create `src/pages/films/[category].astro`:

```astro
---
import Layout from '../../components/Layout.astro';
import CategoryGrid from '../../islands/CategoryGrid';

export function getStaticPaths() {
  return ['tendances', 'au-cinema', 'populaires', 'mieux-notes', 'prochainement'].map((category) => ({
    params: { category },
  }));
}

const { category } = Astro.params as { category: string };
---
<Layout title="Films">
  <CategoryGrid client:load category={category} />
</Layout>
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Build to confirm the 5 static pages generate**

Run: `npm run build`
Expected: build succeeds; output mentions 5 prerendered `/films/*` routes (check the build log for `films/tendances`, `films/au-cinema`, `films/populaires`, `films/mieux-notes`, `films/prochainement`).

- [ ] **Step 5: Commit**

```bash
git add src/islands/CategoryGrid.tsx src/pages/films/[category].astro
git commit -m "feat: add paginated category grid pages (/films/[category])"
```

## Task 8: Tops page

**Files:**
- Create: `src/islands/TopsExplorer.tsx`
- Create: `src/pages/tops.astro`
- Modify: `src/lib/navItems.ts`

- [ ] **Step 1: Create the island**

```tsx
import { useEffect, useState } from 'react';
import MovieCard from '../components/MovieCard';
import Pagination from '../components/Pagination';
import { parsePageParam } from '../lib/pagination';
import { discoverMovies, getGenres, getTopRated, type TMDBListResponse, type TMDBMovie } from '../lib/tmdb';

const TABS = [
  { id: 'mieux-notes', label: 'Mieux notés' },
  { id: 'top-genre', label: 'Top par genre' },
  { id: 'top-annee', label: "Top de l'année" },
] as const;
type TabId = (typeof TABS)[number]['id'];

const MIN_VOTE_COUNT = 300;
const CURRENT_YEAR = new Date().getFullYear();

function parseTab(search: string): TabId {
  const raw = new URLSearchParams(search).get('tab');
  return TABS.some((t) => t.id === raw) ? (raw as TabId) : 'mieux-notes';
}

function parseGenre(search: string): number | null {
  const raw = Number(new URLSearchParams(search).get('genre'));
  return Number.isInteger(raw) && raw > 0 ? raw : null;
}

function buildHref(tab: TabId, genre: number | null, page: number): string {
  const params = new URLSearchParams();
  params.set('tab', tab);
  if (genre) params.set('genre', String(genre));
  params.set('page', String(page));
  return `/tops?${params.toString()}`;
}

export default function TopsExplorer() {
  const [tab, setTab] = useState<TabId>('mieux-notes');
  const [genre, setGenre] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [genres, setGenres] = useState<{ id: number; name: string }[]>([]);
  const [data, setData] = useState<TMDBListResponse<TMDBMovie> | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const search = window.location.search;
    setTab(parseTab(search));
    setGenre(parseGenre(search));
    setPage(parsePageParam(search));
  }, []);

  useEffect(() => {
    let cancelled = false;
    getGenres()
      .then((result) => {
        if (!cancelled) setGenres(result.genres);
      })
      .catch(() => {
        if (!cancelled) setGenres([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isEmptyGenreTab = tab === 'top-genre' && !genre;

  useEffect(() => {
    if (isEmptyGenreTab) {
      setData({ results: [], page: 1, total_pages: 0 });
      return;
    }
    let cancelled = false;
    setData(null);
    setError(false);
    const request =
      tab === 'mieux-notes'
        ? getTopRated(page)
        : tab === 'top-genre'
          ? discoverMovies(
              { genres: genre ? [genre] : undefined, minVoteCount: MIN_VOTE_COUNT, sortBy: 'vote_average.desc' },
              page
            )
          : discoverMovies({ year: CURRENT_YEAR, minVoteCount: MIN_VOTE_COUNT, sortBy: 'vote_average.desc' }, page);
    request
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, genre, page, isEmptyGenreTab]);

  return (
    <div className="px-4 py-6 md:px-8">
      <h1 className="font-display text-2xl">Tops</h1>

      <div role="tablist" aria-label="Choisir un top" className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <a
            key={t.id}
            href={buildHref(t.id, null, 1)}
            role="tab"
            aria-selected={tab === t.id}
            className={`flex min-h-11 items-center rounded-full border border-white/10 px-4 py-1.5 text-sm ${
              tab === t.id ? 'bg-accent text-black' : 'bg-surface/60 text-white/80'
            }`}
          >
            {t.label}
          </a>
        ))}
      </div>

      {tab === 'top-genre' && (
        <div role="group" aria-label="Choisir un genre" className="mt-4 flex flex-wrap gap-2">
          {genres.map((g) => (
            <a
              key={g.id}
              href={buildHref('top-genre', g.id, 1)}
              className={`flex min-h-11 items-center rounded-full border border-white/10 px-3 py-1.5 text-xs ${
                genre === g.id ? 'bg-accent text-black' : 'bg-surface/60 text-white/80'
              }`}
            >
              {g.name}
            </a>
          ))}
        </div>
      )}

      {isEmptyGenreTab && <p className="mt-6 text-sm text-white/50">Choisissez un genre pour voir son top.</p>}
      {error && <p className="mt-6 text-sm text-white/50">Impossible de charger cette section.</p>}
      {!error && !data && <p className="mt-6 text-sm text-white/50">Chargement…</p>}
      {data && data.results.length === 0 && !isEmptyGenreTab && (
        <p className="mt-6 text-sm text-white/50">Rien à afficher pour le moment.</p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
        {data?.results.map((movie) => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>

      {data && data.results.length > 0 && (
        <Pagination page={data.page} totalPages={data.total_pages} buildHref={(p) => buildHref(tab, genre, p)} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the page**

Create `src/pages/tops.astro`:

```astro
---
import Layout from '../components/Layout.astro';
import TopsExplorer from '../islands/TopsExplorer';
---
<Layout title="Tops">
  <TopsExplorer client:load />
</Layout>
```

- [ ] **Step 3: Add "Tops" to the nav**

Replace `src/lib/navItems.ts`:

```ts
export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export const navItems: NavItem[] = [
  { href: '/', label: 'Accueil', icon: '🏠' },
  { href: '/search', label: 'Recherche', icon: '🔍' },
  { href: '/tops', label: 'Tops', icon: '🏆' },
  { href: '/profile', label: 'Profil', icon: '👤' },
];
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build succeeds, includes a prerendered `/tops` route.

- [ ] **Step 6: Commit**

```bash
git add src/islands/TopsExplorer.tsx src/pages/tops.astro src/lib/navItems.ts
git commit -m "feat: add /tops page (top rated, top by genre, top of the year) and nav entry"
```

## Task 9: Person detail island + `/personne/[id]` page

**Files:**
- Create: `src/islands/PersonDetail.tsx`
- Create: `src/pages/personne/[id].astro`
- Modify: `astro.config.mjs:85-92` (comment only)

- [ ] **Step 1: Create the island**

```tsx
import { useEffect, useState } from 'react';
import MovieCard from '../components/MovieCard';
import {
  getPersonDetail,
  getPersonMovieCredits,
  tmdbImageUrl,
  type TMDBPersonDetail,
  type TMDBPersonMovieCredits,
} from '../lib/tmdb';

const BIOGRAPHY_PREVIEW_LENGTH = 400;

export default function PersonDetail({ personId }: { personId: number }) {
  const [person, setPerson] = useState<TMDBPersonDetail | null>(null);
  const [credits, setCredits] = useState<TMDBPersonMovieCredits | null>(null);
  const [error, setError] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getPersonDetail(personId), getPersonMovieCredits(personId)])
      .then(([personData, creditsData]) => {
        if (cancelled) return;
        setPerson(personData);
        setCredits(creditsData);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [personId]);

  if (error) return <p className="px-4 py-8 text-white/60">Impossible de charger cette page.</p>;
  if (!person || !credits) return <p className="px-4 py-8 text-white/60">Chargement…</p>;

  const photo = tmdbImageUrl(person.profile_path, 'w342');
  const directed = credits.crew
    .filter((c) => c.job === 'Director')
    .sort((a, b) => (b.release_date ?? '').localeCompare(a.release_date ?? ''));
  const acted = [...credits.cast].sort((a, b) => (b.release_date ?? '').localeCompare(a.release_date ?? ''));
  const bioTooLong = person.biography.length > BIOGRAPHY_PREVIEW_LENGTH;
  const bio = bioExpanded || !bioTooLong ? person.biography : `${person.biography.slice(0, BIOGRAPHY_PREVIEW_LENGTH)}…`;

  return (
    <div className="px-4 py-6 md:px-8">
      <div className="flex items-center gap-4">
        <div className="h-32 w-32 shrink-0 overflow-hidden rounded-full bg-surface">
          {photo && <img src={photo} alt="" className="h-full w-full object-cover" />}
        </div>
        <h1 className="font-display text-2xl">{person.name}</h1>
      </div>

      {person.biography && (
        <div className="mt-6 max-w-2xl">
          <p className="whitespace-pre-line text-white/80">{bio}</p>
          {bioTooLong && (
            <button onClick={() => setBioExpanded((v) => !v)} className="mt-2 min-h-11 text-sm text-accent">
              {bioExpanded ? 'Voir moins' : 'Lire plus'}
            </button>
          )}
        </div>
      )}

      {directed.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-lg">Réalisateur</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
            {directed.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        </section>
      )}

      {acted.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-lg">Acteur</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
            {acted.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the on-demand route**

Create `src/pages/personne/[id].astro`:

```astro
---
// Same reasoning as src/pages/movie/[id].astro: person ids aren't known at
// build time and all data is fetched client-side from TMDB, so this route
// can't use getStaticPaths() and must be served on-demand via the Vercel
// adapter.
export const prerender = false;

import Layout from '../../components/Layout.astro';
import PersonDetail from '../../islands/PersonDetail';

const { id } = Astro.params;
const personId = Number(id);
---
<Layout title="Personne">
  <PersonDetail client:load personId={personId} />
</Layout>
```

- [ ] **Step 3: Update the astro.config.mjs comment (now two on-demand routes, not one)**

In `astro.config.mjs`, replace:

```js
  // Output stays static by default (SSG) for every route. The Vercel adapter
  // is only needed so the single on-demand route (`/movie/[id]`, which sets
  // `export const prerender = false` since movie ids aren't known at build
  // time and all of its data is fetched client-side from TMDB) can be served
  // — Astro requires an adapter for any non-prerendered route, even though
  // the rest of the site remains fully static/serverless.
```

with:

```js
  // Output stays static by default (SSG) for every route. The Vercel adapter
  // is only needed so the on-demand routes (`/movie/[id]` and `/personne/[id]`,
  // which set `export const prerender = false` since their ids aren't known at
  // build time and all of their data is fetched client-side from TMDB) can be
  // served — Astro requires an adapter for any non-prerendered route, even
  // though the rest of the site remains fully static/serverless.
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/islands/PersonDetail.tsx "src/pages/personne/[id].astro" astro.config.mjs
git commit -m "feat: add /personne/[id] director/actor filmography page"
```

## Task 10: Link into person pages from the movie detail page

**Files:**
- Modify: `src/islands/MovieDetail.tsx:62-101`

- [ ] **Step 1: Add a director link and make cast members clickable**

Replace the meta paragraph block (currently just release year/runtime/rating):

```tsx
        <p className="mt-1 text-sm text-white/60">
          {movie.release_date?.slice(0, 4)} · {movie.runtime} min · ⭐ {movie.vote_average.toFixed(1)}
        </p>
        {director && (
          <p className="mt-1 text-sm text-white/60">
            Réalisé par{' '}
            <a href={`/personne/${director.id}`} className="text-white underline">
              {director.name}
            </a>
          </p>
        )}
```

Replace the cast member markup (currently a non-interactive `<div>`) with a link:

```tsx
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
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/islands/MovieDetail.tsx
git commit -m "feat: link director and cast members to their filmography page"
```

## Task 11: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, including the new `tests/tmdb.test.ts` and `tests/pagination.test.ts` cases.

- [ ] **Step 2: Typecheck the whole project**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds. Confirm in the log: 5 static `/films/*` pages, 1 static `/tops` page, and the on-demand functions for `/movie/[id]` and `/personne/[id]`.

- [ ] **Step 4: Manual verification in the browser**

Run: `npm run dev` (requires a real `PUBLIC_TMDB_API_KEY` in `.env` — see project memory / README if not already set up), then in a browser check:
- Homepage shows 5 rows (Tendances, Au cinéma, Populaires, Mieux notés, Prochainement) each with a working "Voir tout →" link.
- `/films/mieux-notes` (and the other 4 category pages) shows a full grid with working Précédent/Suivant pagination that updates the URL and the results.
- `/tops` — all 3 tabs work; picking a genre in "Top par genre" shows results; pagination works within a tab/genre combination.
- Opening a movie detail page shows a clickable director name and clickable cast members, both navigating to `/personne/<id>` with a bio, photo, and "Réalisateur"/"Acteur" filmography grids (movies link back to their own detail pages).
- Bottom tab bar (mobile viewport) and header nav (desktop viewport) both show the new "Tops" entry and highlight it as current on `/tops`.

- [ ] **Step 5: Commit (only if manual verification required fixes)**

If Step 4 surfaced no issues, there is nothing to commit here — the plan is done. If it did, fix, re-run steps 1-4, then:

```bash
git add -A
git commit -m "fix: address issues found during manual verification"
```
