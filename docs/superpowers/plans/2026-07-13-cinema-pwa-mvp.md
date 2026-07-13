# Cinema PWA MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully functional, mobile-first, installable PWA (Astro + React islands) that browses TMDB, lets users favorite titles, computes local recommendations, and works offline for favorited content — without the premium GSAP/AIC animation layer (that's a follow-up plan).

**Architecture:** Astro SSG shell with React islands for anything stateful/interactive (search, favorites, recommendations). All persistence is client-side via a `localStorage` wrapper with an in-memory fallback. TMDB is called directly from the browser. A custom Workbox service worker (via `vite-plugin-pwa` `injectManifest`) precaches the app shell and applies differentiated caching: permanent for favorited posters, expiring for everything else browsed.

**Tech Stack:** Astro, React, TypeScript (strict), Tailwind CSS v4, Nano Stores, vite-plugin-pwa + Workbox, Vitest, TMDB API v3.

Reference spec: `docs/superpowers/specs/2026-07-13-cinema-pwa-design.md`.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `astro.config.mjs`
- Create: `src/env.d.ts`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `src/pages/index.astro`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "cinescope",
  "type": "module",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install astro @astrojs/react react react-dom nanostores @nanostores/react gsap framer-motion colorthief @fontsource-variable/fraunces @fontsource-variable/inter
npm install -D typescript vitest jsdom tailwindcss @tailwindcss/vite vite-plugin-pwa workbox-precaching workbox-routing workbox-strategies workbox-expiration workbox-cacheable-response @types/react @types/react-dom
```
Expected: installs succeed, `package.json` now has `dependencies` and `devDependencies` populated, `node_modules/` created.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "src/**/*", "tests/**/*"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 4: Create `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
```

- [ ] **Step 5: Create `src/env.d.ts`**

```ts
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_TMDB_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 6: Create `.env.example` and `.gitignore`**

`.env.example`:
```
PUBLIC_TMDB_API_KEY=your_tmdb_v3_api_key_here
```

`.gitignore`:
```
node_modules/
dist/
.env
.astro/
dev-dist/
```

- [ ] **Step 7: Create a placeholder home page so the dev server has something to render**

`src/pages/index.astro`:
```astro
---
---
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>CineScope</title>
  </head>
  <body>
    <h1>CineScope — scaffold OK</h1>
  </body>
</html>
```

- [ ] **Step 8: Verify the dev server boots**

Run: `npm run dev`
Expected: server starts on `http://localhost:4321`, page shows "CineScope — scaffold OK". Stop the server (Ctrl+C) once confirmed.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json astro.config.mjs src/env.d.ts src/pages/index.astro .gitignore .env.example
git commit -m "chore: scaffold Astro + React + TypeScript project"
```

---

### Task 2: Design tokens, dark theme, self-hosted variable fonts

**Files:**
- Create: `src/styles/global.css`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Create `src/styles/global.css`**

```css
@import "tailwindcss";
@import "@fontsource-variable/fraunces";
@import "@fontsource-variable/inter";

@theme {
  --font-display: "Fraunces Variable", serif;
  --font-body: "Inter Variable", sans-serif;
  --color-bg: #0a0a0f;
  --color-surface: #14141c;
  --color-accent: #7c5cff;
}

:root {
  color-scheme: dark;
}

body {
  background-color: var(--color-bg);
  color: #f4f4f7;
  font-family: var(--font-body);
}
```

- [ ] **Step 2: Wire the stylesheet into the placeholder page and confirm Tailwind utilities work**

`src/pages/index.astro`:
```astro
---
import '../styles/global.css';
---
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>CineScope</title>
  </head>
  <body class="bg-bg font-body text-white">
    <h1 class="font-display text-3xl">CineScope</h1>
    <p class="text-accent">Design tokens OK</p>
  </body>
</html>
```

- [ ] **Step 3: Verify visually**

Run: `npm run dev`, open `http://localhost:4321`.
Expected: dark background, "CineScope" rendered in the Fraunces serif font, "Design tokens OK" text tinted in the accent purple. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/styles/global.css src/pages/index.astro
git commit -m "feat: add Tailwind v4 theme tokens and self-hosted variable fonts"
```

---

### Task 3: Base layout and responsive navigation

**Files:**
- Create: `src/components/Layout.astro`
- Create: `src/components/Header.astro`
- Create: `src/components/BottomNav.astro`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Create `src/components/Header.astro` (desktop nav, hidden on mobile)**

```astro
<header class="sticky top-0 z-40 hidden items-center justify-between border-b border-white/10 bg-bg/80 px-8 py-4 backdrop-blur md:flex">
  <a href="/" class="font-display text-xl">CineScope</a>
  <nav class="flex gap-6 text-sm text-white/70">
    <a href="/" class="hover:text-white">Accueil</a>
    <a href="/search" class="hover:text-white">Recherche</a>
    <a href="/profile" class="hover:text-white">Profil</a>
  </nav>
</header>
```

- [ ] **Step 2: Create `src/components/BottomNav.astro` (mobile tab bar, hidden on desktop)**

```astro
<nav
  class="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-white/10 bg-surface/95 py-2 backdrop-blur md:hidden"
  style="padding-bottom: env(safe-area-inset-bottom)"
>
  <a href="/" class="flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 text-xs text-white/70">
    <span aria-hidden="true">🏠</span>
    Accueil
  </a>
  <a href="/search" class="flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 text-xs text-white/70">
    <span aria-hidden="true">🔍</span>
    Recherche
  </a>
  <a href="/profile" class="flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 text-xs text-white/70">
    <span aria-hidden="true">👤</span>
    Profil
  </a>
</nav>
```

- [ ] **Step 3: Create `src/components/Layout.astro`**

```astro
---
import '../styles/global.css';
import Header from './Header.astro';
import BottomNav from './BottomNav.astro';

interface Props {
  title: string;
}
const { title } = Astro.props;
---
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0a0a0f" />
    <title>{title} · CineScope</title>
  </head>
  <body class="min-h-screen bg-bg font-body text-white pb-16 md:pb-0">
    <Header />
    <main>
      <slot />
    </main>
    <BottomNav />
  </body>
</html>
```

- [ ] **Step 4: Use the layout on the home page**

`src/pages/index.astro`:
```astro
---
import Layout from '../components/Layout.astro';
---
<Layout title="Accueil">
  <h1 class="px-6 py-8 font-display text-3xl">CineScope</h1>
</Layout>
```

- [ ] **Step 5: Verify responsive behavior**

Run: `npm run dev`, open `http://localhost:4321` in a browser, toggle device toolbar between a ~375px mobile width and a desktop width (~1440px).
Expected: at 375px, the bottom tab bar is visible and the top header is hidden; at 1440px, the reverse. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add src/components/Layout.astro src/components/Header.astro src/components/BottomNav.astro src/pages/index.astro
git commit -m "feat: add responsive layout with mobile bottom nav and desktop header"
```

---

### Task 4: TMDB client library

**Files:**
- Create: `src/lib/tmdb.ts`
- Test: `tests/tmdb.test.ts`
- Create: `vitest.config.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 2: Write the failing test for the discover query builder**

`tests/tmdb.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildDiscoverQuery, tmdbImageUrl } from '../src/lib/tmdb';

describe('buildDiscoverQuery', () => {
  it('includes only the params that were provided', () => {
    expect(buildDiscoverQuery({})).toEqual({ sort_by: 'popularity.desc' });
  });

  it('joins multiple genre ids with commas', () => {
    expect(buildDiscoverQuery({ genres: [28, 12] })).toEqual({
      sort_by: 'popularity.desc',
      with_genres: '28,12',
    });
  });

  it('adds year and minimum rating filters', () => {
    expect(buildDiscoverQuery({ year: 2024, minRating: 7 })).toEqual({
      sort_by: 'popularity.desc',
      primary_release_year: '2024',
      'vote_average.gte': '7',
    });
  });
});

describe('tmdbImageUrl', () => {
  it('returns null when path is null', () => {
    expect(tmdbImageUrl(null)).toBeNull();
  });

  it('builds a full image URL for a given size', () => {
    expect(tmdbImageUrl('/abc.jpg', 'w342')).toBe('https://image.tmdb.org/t/p/w342/abc.jpg');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `src/lib/tmdb.ts` does not exist yet.

- [ ] **Step 4: Implement `src/lib/tmdb.ts`**

```ts
export interface TMDBMovie {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  release_date: string;
  vote_average: number;
  genre_ids?: number[];
}

export interface TMDBCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface TMDBCrewMember {
  id: number;
  name: string;
  job: string;
}

export interface TMDBVideo {
  key: string;
  site: string;
  type: string;
}

export interface TMDBMovieDetail extends TMDBMovie {
  runtime: number;
  genres: { id: number; name: string }[];
  credits?: { cast: TMDBCastMember[]; crew: TMDBCrewMember[] };
  videos?: { results: TMDBVideo[] };
}

export interface TMDBListResponse<T> {
  results: T[];
}

const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p/';

export function tmdbImageUrl(path: string | null, size = 'w500'): string | null {
  return path ? `${IMAGE_BASE}${size}${path}` : null;
}

async function tmdbFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', import.meta.env.PUBLIC_TMDB_API_KEY);
  url.searchParams.set('language', 'fr-FR');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`TMDB request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getTrending(): Promise<TMDBListResponse<TMDBMovie>> {
  return tmdbFetch('/trending/movie/day');
}

export function getUpcoming(): Promise<TMDBListResponse<TMDBMovie>> {
  return tmdbFetch('/movie/upcoming');
}

export function getMovieDetail(id: number): Promise<TMDBMovieDetail> {
  return tmdbFetch(`/movie/${id}`, { append_to_response: 'credits,videos' });
}

export function searchMovies(query: string): Promise<TMDBListResponse<TMDBMovie>> {
  return tmdbFetch('/search/movie', { query });
}

export interface DiscoverParams {
  genres?: number[];
  year?: number;
  minRating?: number;
}

export function buildDiscoverQuery(params: DiscoverParams): Record<string, string> {
  const query: Record<string, string> = { sort_by: 'popularity.desc' };
  if (params.genres && params.genres.length > 0) {
    query.with_genres = params.genres.join(',');
  }
  if (params.year) {
    query.primary_release_year = String(params.year);
  }
  if (params.minRating) {
    query['vote_average.gte'] = String(params.minRating);
  }
  return query;
}

export function discoverMovies(params: DiscoverParams): Promise<TMDBListResponse<TMDBMovie>> {
  return tmdbFetch('/discover/movie', buildDiscoverQuery(params));
}

export function getGenres(): Promise<{ genres: { id: number; name: string }[] }> {
  return tmdbFetch('/genre/movie/list');
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — all `buildDiscoverQuery` and `tmdbImageUrl` tests green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tmdb.ts tests/tmdb.test.ts vitest.config.ts
git commit -m "feat: add TMDB client library with typed responses"
```

---

### Task 5: Storage wrapper with private-browsing fallback

**Files:**
- Create: `src/lib/storage.ts`
- Test: `tests/storage.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/storage.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.resetModules();
  });

  it('reads and writes through localStorage when available', async () => {
    const storage = await import('../src/lib/storage');
    storage.setItem('foo', 'bar');
    expect(storage.getItem('foo')).toBe('bar');
    expect(storage.isPersistent()).toBe(true);
  });

  it('falls back to in-memory storage when localStorage throws', async () => {
    const original = window.localStorage.setItem;
    window.localStorage.setItem = () => {
      throw new DOMException('blocked');
    };

    const storage = await import('../src/lib/storage');
    storage.setItem('foo', 'bar');

    expect(storage.getItem('foo')).toBe('bar');
    expect(storage.isPersistent()).toBe(false);

    window.localStorage.setItem = original;
  });

  it('removeItem clears a key in both modes', async () => {
    const storage = await import('../src/lib/storage');
    storage.setItem('foo', 'bar');
    storage.removeItem('foo');
    expect(storage.getItem('foo')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `src/lib/storage.ts` does not exist yet.

- [ ] **Step 3: Implement `src/lib/storage.ts`**

```ts
const memoryFallback = new Map<string, string>();
let localStorageAvailable: boolean | null = null;

function isLocalStorageAvailable(): boolean {
  if (localStorageAvailable !== null) return localStorageAvailable;
  try {
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    localStorageAvailable = true;
  } catch {
    localStorageAvailable = false;
  }
  return localStorageAvailable;
}

export function getItem(key: string): string | null {
  if (isLocalStorageAvailable()) {
    return window.localStorage.getItem(key);
  }
  return memoryFallback.get(key) ?? null;
}

export function setItem(key: string, value: string): void {
  if (isLocalStorageAvailable()) {
    window.localStorage.setItem(key, value);
    return;
  }
  memoryFallback.set(key, value);
}

export function removeItem(key: string): void {
  if (isLocalStorageAvailable()) {
    window.localStorage.removeItem(key);
    return;
  }
  memoryFallback.delete(key);
}

export function isPersistent(): boolean {
  return isLocalStorageAvailable();
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — all 3 storage tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts tests/storage.test.ts
git commit -m "feat: add localStorage wrapper with in-memory fallback"
```

---

### Task 6: Recommendation scoring logic

**Files:**
- Create: `src/lib/recommend.ts`
- Test: `tests/recommend.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/recommend.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  createEmptyProfile,
  recordView,
  recordFavorite,
  topGenres,
  excludeFavorites,
} from '../src/lib/recommend';

describe('recordView', () => {
  it('adds 1 point to each genre visited', () => {
    const profile = recordView(createEmptyProfile(), [28, 12]);
    expect(profile.genres).toEqual({ 28: 1, 12: 1 });
  });

  it('accumulates points across repeated views', () => {
    let profile = createEmptyProfile();
    profile = recordView(profile, [28]);
    profile = recordView(profile, [28]);
    expect(profile.genres[28]).toBe(2);
  });
});

describe('recordFavorite', () => {
  it('adds 5 points per genre and 3 to the director', () => {
    const profile = recordFavorite(createEmptyProfile(), 100, [28, 12], 500);
    expect(profile.genres).toEqual({ 28: 5, 12: 5 });
    expect(profile.directors).toEqual({ 500: 3 });
    expect(profile.favorites).toEqual([100]);
  });

  it('does not duplicate a movie already favorited', () => {
    let profile = recordFavorite(createEmptyProfile(), 100, [28], 500);
    profile = recordFavorite(profile, 100, [28], 500);
    expect(profile.favorites).toEqual([100]);
    expect(profile.genres[28]).toBe(10);
  });
});

describe('topGenres', () => {
  it('returns the top N genres sorted by score descending', () => {
    const profile = { genres: { 1: 3, 2: 9, 3: 5 }, directors: {}, favorites: [] };
    expect(topGenres(profile, 2)).toEqual([2, 3]);
  });

  it('returns an empty array when there are no genres yet', () => {
    expect(topGenres(createEmptyProfile())).toEqual([]);
  });
});

describe('excludeFavorites', () => {
  it('filters out movies whose id is already in favorites', () => {
    const profile = { genres: {}, directors: {}, favorites: [1, 3] };
    const movies = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(excludeFavorites(movies, profile)).toEqual([{ id: 2 }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `src/lib/recommend.ts` does not exist yet.

- [ ] **Step 3: Implement `src/lib/recommend.ts`**

```ts
export interface ProfileScores {
  genres: Record<number, number>;
  directors: Record<number, number>;
  favorites: number[];
}

export function createEmptyProfile(): ProfileScores {
  return { genres: {}, directors: {}, favorites: [] };
}

export function recordView(profile: ProfileScores, genreIds: number[]): ProfileScores {
  const genres = { ...profile.genres };
  for (const id of genreIds) {
    genres[id] = (genres[id] ?? 0) + 1;
  }
  return { ...profile, genres };
}

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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — all recommend tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/recommend.ts tests/recommend.test.ts
git commit -m "feat: add local recommendation scoring logic"
```

---

### Task 7: Profile store (Nano Stores)

**Files:**
- Create: `src/stores/profileStore.ts`
- Test: `tests/profileStore.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/profileStore.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('profileStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.resetModules();
  });

  it('persists a favorite across store reloads', async () => {
    const mod1 = await import('../src/stores/profileStore');
    mod1.favoriteMovie(42, [28], 7);
    expect(mod1.profileStore.get().favorites).toEqual([42]);

    vi.resetModules();
    const mod2 = await import('../src/stores/profileStore');
    expect(mod2.profileStore.get().favorites).toEqual([42]);
    expect(mod2.profileStore.get().genres[28]).toBe(5);
  });

  it('resetProfile clears all persisted data', async () => {
    const mod = await import('../src/stores/profileStore');
    mod.favoriteMovie(1, [1], 1);
    mod.resetProfile();
    expect(mod.profileStore.get()).toEqual({ genres: {}, directors: {}, favorites: [] });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `src/stores/profileStore.ts` does not exist yet.

- [ ] **Step 3: Implement `src/stores/profileStore.ts`**

```ts
import { atom } from 'nanostores';
import { createEmptyProfile, recordView, recordFavorite, unfavorite, type ProfileScores } from '../lib/recommend';
import { getItem, setItem } from '../lib/storage';

const STORAGE_KEY = 'cinescope:profile';

function loadProfile(): ProfileScores {
  const raw = getItem(STORAGE_KEY);
  if (!raw) return createEmptyProfile();
  try {
    return JSON.parse(raw) as ProfileScores;
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
  const next = recordFavorite(profileStore.get(), movieId, genreIds, directorId);
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/profileStore.ts tests/profileStore.test.ts
git commit -m "feat: add persisted profile store wiring recommend + storage"
```

---

### Task 8: Home dashboard (trending, upcoming, recommended)

**Files:**
- Create: `src/components/MovieCard.tsx`
- Create: `src/islands/MovieRow.tsx`
- Create: `src/islands/RecommendedRow.tsx`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Create the shared card component `src/components/MovieCard.tsx`**

```tsx
import { tmdbImageUrl, type TMDBMovie } from '../lib/tmdb';

export default function MovieCard({ movie }: { movie: TMDBMovie }) {
  const poster = tmdbImageUrl(movie.poster_path, 'w342');
  return (
    <a
      href={`/movie/${movie.id}`}
      className="block w-32 shrink-0 sm:w-40 md:w-48"
    >
      <div className="aspect-[2/3] overflow-hidden rounded-xl bg-surface">
        {poster ? (
          <img src={poster} alt={movie.title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-white/50">Pas d'affiche</div>
        )}
      </div>
      <p className="mt-2 truncate text-sm text-white/90">{movie.title}</p>
    </a>
  );
}
```

- [ ] **Step 2: Create a generic fetch-and-render row island `src/islands/MovieRow.tsx`**

```tsx
import { useEffect, useState } from 'react';
import MovieCard from '../components/MovieCard';
import type { TMDBMovie } from '../lib/tmdb';

interface Props {
  title: string;
  fetcher: () => Promise<{ results: TMDBMovie[] }>;
}

export default function MovieRow({ title, fetcher }: Props) {
  const [movies, setMovies] = useState<TMDBMovie[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetcher()
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

  return (
    <section className="px-4 py-6 md:px-8">
      <h2 className="mb-3 font-display text-xl">{title}</h2>
      {error && <p className="text-sm text-white/50">Impossible de charger cette section.</p>}
      {!error && !movies && <p className="text-sm text-white/50">Chargement…</p>}
      {movies && movies.length === 0 && <p className="text-sm text-white/50">Rien à afficher pour le moment.</p>}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {movies?.map((movie) => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Create the recommendation row island `src/islands/RecommendedRow.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import MovieCard from '../components/MovieCard';
import { discoverMovies, type TMDBMovie } from '../lib/tmdb';
import { excludeFavorites, topGenres } from '../lib/recommend';
import { profileStore } from '../stores/profileStore';

export default function RecommendedRow() {
  const profile = useStore(profileStore);
  const [movies, setMovies] = useState<TMDBMovie[] | null>(null);
  const genres = topGenres(profile, 2);

  useEffect(() => {
    if (genres.length === 0) {
      setMovies([]);
      return;
    }
    let cancelled = false;
    discoverMovies({ genres })
      .then((data) => {
        if (!cancelled) setMovies(excludeFavorites(data.results, profile));
      })
      .catch(() => {
        if (!cancelled) setMovies([]);
      });
    return () => {
      cancelled = true;
    };
  }, [genres.join(',')]);

  if (genres.length === 0) return null;

  return (
    <section className="px-4 py-6 md:px-8">
      <h2 className="mb-3 font-display text-xl">Recommandé pour vous</h2>
      {!movies && <p className="text-sm text-white/50">Chargement…</p>}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {movies?.map((movie) => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Wire the rows into the home page**

`src/pages/index.astro`:
```astro
---
import Layout from '../components/Layout.astro';
import MovieRow from '../islands/MovieRow';
import RecommendedRow from '../islands/RecommendedRow';
import { getTrending, getUpcoming } from '../lib/tmdb';
---
<Layout title="Accueil">
  <h1 class="px-4 pt-8 font-display text-3xl md:px-8">CineScope</h1>
  <RecommendedRow client:load />
  <MovieRow client:load title="Tendances du jour" fetcher={getTrending} />
  <MovieRow client:load title="Prochainement" fetcher={getUpcoming} />
</Layout>
```

- [ ] **Step 5: Add your TMDB API key and verify in the browser**

Run: `cp .env.example .env` (Windows PowerShell: `Copy-Item .env.example .env`), then edit `.env` and set `PUBLIC_TMDB_API_KEY` to a real TMDB v3 API key. Run `npm run dev`, open `http://localhost:4321`.
Expected: "Tendances du jour" and "Prochainement" rows populate with real movie posters. "Recommandé pour vous" is absent (no scored genres yet — expected, since the profile is empty). Confirm the row scrolls horizontally on a ~375px mobile viewport and shows more columns on desktop width.

- [ ] **Step 6: Commit**

```bash
git add src/components/MovieCard.tsx src/islands/MovieRow.tsx src/islands/RecommendedRow.tsx src/pages/index.astro
git commit -m "feat: add home dashboard with trending, upcoming and recommended rows"
```

---

### Task 9: Search page with filters

**Files:**
- Create: `src/islands/SearchExplorer.tsx`
- Create: `src/pages/search.astro`

- [ ] **Step 1: Create `src/islands/SearchExplorer.tsx`**

```tsx
import { useEffect, useState } from 'react';
import MovieCard from '../components/MovieCard';
import { discoverMovies, searchMovies, type TMDBMovie } from '../lib/tmdb';

const GENRES: { id: number; name: string }[] = [
  { id: 28, name: 'Action' },
  { id: 35, name: 'Comédie' },
  { id: 18, name: 'Drame' },
  { id: 27, name: 'Horreur' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Science-fiction' },
];

export default function SearchExplorer() {
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState<number | null>(null);
  const [minRating, setMinRating] = useState(0);
  const [movies, setMovies] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timeout = setTimeout(() => {
      const request = query.trim()
        ? searchMovies(query.trim())
        : discoverMovies({ genres: genre ? [genre] : undefined, minRating: minRating || undefined });
      request
        .then((data) => setMovies(data.results))
        .catch(() => setMovies([]))
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(timeout);
  }, [query, genre, minRating]);

  return (
    <div className="px-4 py-6 md:px-8">
      <input
        type="search"
        placeholder="Rechercher un film…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-full border border-white/10 bg-surface/80 px-4 py-3 text-sm backdrop-blur placeholder:text-white/40"
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {GENRES.map((g) => (
          <button
            key={g.id}
            onClick={() => setGenre(genre === g.id ? null : g.id)}
            className={`rounded-full border border-white/10 px-3 py-1.5 text-xs backdrop-blur ${
              genre === g.id ? 'bg-accent text-black' : 'bg-surface/60 text-white/80'
            }`}
          >
            {g.name}
          </button>
        ))}
        <select
          value={minRating}
          onChange={(e) => setMinRating(Number(e.target.value))}
          className="rounded-full border border-white/10 bg-surface/60 px-3 py-1.5 text-xs text-white/80"
        >
          <option value={0}>Note minimum</option>
          <option value={5}>5+</option>
          <option value={7}>7+</option>
          <option value={8}>8+</option>
        </select>
      </div>

      {loading && <p className="mt-6 text-sm text-white/50">Recherche…</p>}
      {!loading && movies.length === 0 && <p className="mt-6 text-sm text-white/50">Aucun résultat.</p>}

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
        {movies.map((movie) => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/pages/search.astro`**

```astro
---
import Layout from '../components/Layout.astro';
import SearchExplorer from '../islands/SearchExplorer';
---
<Layout title="Recherche">
  <SearchExplorer client:load />
</Layout>
```

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`, open `http://localhost:4321/search`.
Expected: typing a query returns matching movies after a short debounce; toggling a genre chip or rating filter (with empty query) returns filtered discover results; grid is 2 columns on mobile width and widens on desktop.

- [ ] **Step 4: Commit**

```bash
git add src/islands/SearchExplorer.tsx src/pages/search.astro
git commit -m "feat: add search page with text search and cumulative filters"
```

---

### Task 10: Movie detail page with favoriting

**Files:**
- Create: `src/lib/favoritesCache.ts`
- Create: `src/islands/MovieDetail.tsx`
- Create: `src/pages/movie/[id].astro`

- [ ] **Step 1: Create `src/lib/favoritesCache.ts`**

```ts
import { tmdbImageUrl } from './tmdb';

export const FAVORITES_CACHE_NAME = 'tmdb-posters-favorites';

export async function cacheFavoritePoster(posterPath: string | null): Promise<void> {
  if (!posterPath || typeof caches === 'undefined') return;
  const url = tmdbImageUrl(posterPath, 'w500');
  if (!url) return;
  const cache = await caches.open(FAVORITES_CACHE_NAME);
  try {
    await cache.add(url);
  } catch {
    // Offline or blocked — favoriting still succeeds, poster just won't be pinned yet.
  }
}

export async function uncacheFavoritePoster(posterPath: string | null): Promise<void> {
  if (!posterPath || typeof caches === 'undefined') return;
  const url = tmdbImageUrl(posterPath, 'w500');
  if (!url) return;
  const cache = await caches.open(FAVORITES_CACHE_NAME);
  await cache.delete(url);
}
```

- [ ] **Step 2: Create the detail island `src/islands/MovieDetail.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { getMovieDetail, tmdbImageUrl, type TMDBMovieDetail } from '../lib/tmdb';
import { profileStore, viewMovie, favoriteMovie, unfavoriteMovie } from '../stores/profileStore';
import { cacheFavoritePoster, uncacheFavoritePoster } from '../lib/favoritesCache';

export default function MovieDetail({ movieId }: { movieId: number }) {
  const profile = useStore(profileStore);
  const [movie, setMovie] = useState<TMDBMovieDetail | null>(null);
  const [error, setError] = useState(false);
  const isFavorite = movie ? profile.favorites.includes(movie.id) : false;

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

  function toggleFavorite() {
    if (!movie) return;
    if (isFavorite) {
      unfavoriteMovie(movie.id);
      uncacheFavoritePoster(movie.poster_path);
    } else {
      favoriteMovie(
        movie.id,
        movie.genres.map((g) => g.id),
        director?.id
      );
      cacheFavoritePoster(movie.poster_path);
    }
  }

  return (
    <article>
      {backdrop && (
        <div className="aspect-video w-full overflow-hidden">
          <img src={backdrop} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <div className="px-4 py-6 md:px-8">
        <h1 className="font-display text-2xl md:text-4xl">{movie.title}</h1>
        <p className="mt-1 text-sm text-white/60">
          {movie.release_date?.slice(0, 4)} · {movie.runtime} min · ⭐ {movie.vote_average.toFixed(1)}
        </p>

        <button
          onClick={toggleFavorite}
          className={`mt-4 min-h-11 rounded-full px-6 py-2 text-sm font-semibold ${
            isFavorite ? 'bg-accent text-black' : 'border border-white/20 text-white'
          }`}
        >
          {isFavorite ? '✓ Dans mes favoris' : '+ Ajouter aux favoris'}
        </button>

        <p className="mt-6 max-w-2xl text-white/80">{movie.overview}</p>

        {movie.credits && movie.credits.cast.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 font-display text-lg">Casting</h2>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {movie.credits.cast.slice(0, 10).map((member) => (
                <div key={member.id} className="w-20 shrink-0 text-center">
                  <div className="h-20 w-20 overflow-hidden rounded-full bg-surface">
                    {member.profile_path && (
                      <img
                        src={tmdbImageUrl(member.profile_path, 'w185') ?? ''}
                        alt={member.name}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-white/80">{member.name}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {trailer && (
          <section className="mt-8">
            <h2 className="mb-3 font-display text-lg">Bande-annonce</h2>
            <div className="aspect-video w-full max-w-2xl overflow-hidden rounded-xl">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube.com/embed/${trailer.key}`}
                title="Bande-annonce"
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

- [ ] **Step 3: Create `src/pages/movie/[id].astro`**

```astro
---
import Layout from '../../components/Layout.astro';
import MovieDetail from '../../islands/MovieDetail';

const { id } = Astro.params;
const movieId = Number(id);
---
<Layout title="Film">
  <MovieDetail client:load movieId={movieId} />
</Layout>
```

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev`, click a movie card from the home page or navigate to `http://localhost:4321/movie/<any-valid-tmdb-id>`.
Expected: backdrop, title, synopsis, cast avatars and trailer (when available) render; clicking "Ajouter aux favoris" flips to "✓ Dans mes favoris" instantly; reloading the page keeps it favorited (persisted via `profileStore`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/favoritesCache.ts src/islands/MovieDetail.tsx src/pages/movie/[id].astro
git commit -m "feat: add movie detail page with cast, trailer and favoriting"
```

---

### Task 11: Profile page

**Files:**
- Create: `src/islands/ProfileView.tsx`
- Create: `src/pages/profile.astro`

- [ ] **Step 1: Create `src/islands/ProfileView.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import MovieCard from '../components/MovieCard';
import { profileStore, resetProfile } from '../stores/profileStore';
import { getGenres, type TMDBMovie } from '../lib/tmdb';

export default function ProfileView() {
  const profile = useStore(profileStore);
  const [genreNames, setGenreNames] = useState<Record<number, string>>({});
  const [favoriteMovies, setFavoriteMovies] = useState<TMDBMovie[]>([]);

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
    if (profile.favorites.length === 0) {
      setFavoriteMovies([]);
      return;
    }
    import('../lib/tmdb').then(({ getMovieDetail }) => {
      Promise.allSettled(profile.favorites.map((id) => getMovieDetail(id))).then((results) => {
        const movies = results
          .filter((r): r is PromiseFulfilledResult<TMDBMovie> => r.status === 'fulfilled')
          .map((r) => r.value);
        setFavoriteMovies(movies);
      });
    });
  }, [profile.favorites.join(',')]);

  const sortedGenres = Object.entries(profile.genres)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  const maxScore = sortedGenres[0]?.[1] ?? 1;

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
        <h2 className="mb-3 font-display text-lg">Mes favoris ({favoriteMovies.length})</h2>
        {favoriteMovies.length === 0 && <p className="text-sm text-white/50">Aucun favori pour le moment.</p>}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {favoriteMovies.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      </section>

      <button
        onClick={() => {
          if (confirm('Vider toutes vos données locales (favoris, scores) ?')) {
            resetProfile();
          }
        }}
        className="mt-10 min-h-11 rounded-full border border-red-500/40 px-6 py-2 text-sm text-red-400"
      >
        Vider mes données
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/pages/profile.astro`**

```astro
---
import Layout from '../components/Layout.astro';
import ProfileView from '../islands/ProfileView';
---
<Layout title="Profil">
  <ProfileView client:load />
</Layout>
```

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`, favorite a couple of movies from their detail pages, then open `http://localhost:4321/profile`.
Expected: genre score bars reflect the favorited movies' genres, favorited posters appear in the grid, and clicking "Vider mes données" (after confirming) empties everything and updates the page immediately.

- [ ] **Step 4: Commit**

```bash
git add src/islands/ProfileView.tsx src/pages/profile.astro
git commit -m "feat: add profile page with genre stats, favorites grid and reset"
```

---

### Task 12: PWA — manifest, custom service worker, offline fallback, update/install UI

**Files:**
- Modify: `astro.config.mjs`
- Create: `src/sw.ts`
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-512-maskable.png`
- Create: `src/pages/offline.astro`
- Create: `src/islands/UpdateBanner.tsx`
- Create: `src/islands/InstallPrompt.tsx`
- Modify: `src/components/Layout.astro`

- [ ] **Step 1: Generate placeholder PWA icons**

Create `public/icons/icon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0a0a0f"/>
  <circle cx="256" cy="256" r="160" fill="#7c5cff"/>
  <text x="256" y="290" font-family="Georgia, serif" font-size="180" fill="#0a0a0f" text-anchor="middle">C</text>
</svg>
```

Manually export `public/icons/icon.svg` to `public/icons/icon-192.png`, `public/icons/icon-512.png` and a version with ~15% padding as `public/icons/icon-512-maskable.png` (any image editor, or an online SVG-to-PNG tool) before shipping to production — this is a one-time manual asset step tracked as a follow-up, not a blocker for local development since `vite-plugin-pwa`'s `devOptions` renders the app without requiring the icons to exist yet.

- [ ] **Step 2: Update `astro.config.mjs` to register the PWA plugin with a custom service worker**

```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [
      tailwindcss(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        injectManifest: { swSrc: 'src/sw.ts' },
        registerType: 'prompt',
        devOptions: { enabled: true, type: 'module' },
        manifest: {
          name: 'CineScope',
          short_name: 'CineScope',
          description: 'Explorez films et séries, avec vos favoris toujours disponibles hors-ligne.',
          theme_color: '#0a0a0f',
          background_color: '#0a0a0f',
          display: 'standalone',
          start_url: '/',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
    ],
  },
});
```

- [ ] **Step 3: Write the custom service worker `src/sw.ts`**

```ts
/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

const FAVORITES_CACHE = 'tmdb-posters-favorites';

const recentPosters = new CacheFirst({
  cacheName: 'tmdb-posters-recent',
  plugins: [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
    new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 }),
  ],
});

registerRoute(
  ({ url }) => url.origin === 'https://image.tmdb.org',
  async (options) => {
    const favoritesCache = await caches.open(FAVORITES_CACHE);
    const cached = await favoritesCache.match(options.request);
    if (cached) return cached;
    return recentPosters.handle(options);
  }
);

registerRoute(
  ({ url }) => url.origin === 'https://api.themoviedb.org',
  new NetworkFirst({
    cacheName: 'tmdb-api',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 })],
  })
);

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
```

- [ ] **Step 4: Create the offline fallback page `src/pages/offline.astro`**

```astro
---
import Layout from '../components/Layout.astro';
---
<Layout title="Hors-ligne">
  <div class="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
    <h1 class="font-display text-3xl">Vous êtes hors-ligne</h1>
    <p class="max-w-md text-white/70">
      Impossible de charger cette page sans connexion. Vos favoris restent disponibles hors-ligne.
    </p>
    <a href="/profile" class="min-h-11 rounded-full bg-accent px-6 py-3 font-semibold text-black">
      Voir mes favoris
    </a>
  </div>
</Layout>
```

- [ ] **Step 5: Create `src/islands/UpdateBanner.tsx`**

```tsx
import { useRegisterSW } from 'virtual:pwa-register/react';

export default function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-surface/95 px-4 py-2 text-sm shadow-lg backdrop-blur md:bottom-4">
      <span>Nouvelle version disponible</span>
      <button
        className="min-h-11 rounded-full bg-accent px-3 py-1 font-semibold text-black"
        onClick={() => updateServiceWorker(true)}
      >
        Rafraîchir
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Create `src/islands/InstallPrompt.tsx`**

```tsx
import { useEffect, useState } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);

  useEffect(() => {
    function handler(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferredPrompt) return null;

  return (
    <button
      className="fixed bottom-20 right-4 z-50 min-h-11 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-black shadow-lg md:bottom-4"
      onClick={async () => {
        const promptEvent = deferredPrompt as any;
        promptEvent.prompt();
        await promptEvent.userChoice;
        setDeferredPrompt(null);
      }}
    >
      Installer l'app
    </button>
  );
}
```

- [ ] **Step 7: Wire the banners into the layout**

`src/components/Layout.astro` — add the two islands just before `</body>`:
```astro
---
import '../styles/global.css';
import Header from './Header.astro';
import BottomNav from './BottomNav.astro';
import UpdateBanner from '../islands/UpdateBanner';
import InstallPrompt from '../islands/InstallPrompt';

interface Props {
  title: string;
}
const { title } = Astro.props;
---
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0a0a0f" />
    <title>{title} · CineScope</title>
  </head>
  <body class="min-h-screen bg-bg font-body text-white pb-16 md:pb-0">
    <Header />
    <main>
      <slot />
    </main>
    <BottomNav />
    <UpdateBanner client:load />
    <InstallPrompt client:load />
  </body>
</html>
```

- [ ] **Step 8: Verify PWA behavior**

Run: `npm run build && npm run preview`, open the printed local URL in Chrome.
Expected: DevTools → Application → Service Workers shows `sw.ts` (compiled) active; DevTools → Application → Manifest shows the CineScope manifest with icons; favoriting a movie then going offline (DevTools → Network → Offline) and reloading its detail page still shows the poster; navigating to a never-visited route while offline shows the `/offline` page.

- [ ] **Step 9: Commit**

```bash
git add astro.config.mjs src/sw.ts public/icons src/pages/offline.astro src/islands/UpdateBanner.tsx src/islands/InstallPrompt.tsx src/components/Layout.astro
git commit -m "feat: add PWA manifest, custom service worker with differentiated caching, offline page"
```

---

### Task 13: Cross-viewport verification pass

**Files:** none (manual verification only)

- [ ] **Step 1: Invoke the webapp-testing skill's Playwright tooling**

Use the `webapp-testing` skill to drive the running app (`npm run dev`) at three viewport widths — 375px (mobile), 768px (tablet), 1440px (desktop) — across `/`, `/search`, `/movie/<id>`, `/profile`, and `/offline`.

- [ ] **Step 2: Checklist per viewport**

For each of the 3 widths, confirm:
- No horizontal scroll on the page body.
- Bottom tab bar shown only below `md:`; header shown only at/above `md:`.
- All interactive controls (buttons, chips, nav items) are at least 44×44px.
- Movie grids reflow (2 cols mobile → more columns as width grows) without overflow.
- Favoriting a movie on mobile width persists after a full page reload.

- [ ] **Step 3: Fix any issues found, then commit**

If any viewport issue is found, fix the relevant Tailwind classes in the affected component, re-verify, then:
```bash
git add -A
git commit -m "fix: address responsive issues found in cross-viewport verification"
```
If no issues are found, skip the commit — nothing changed.

---

### Task 14: README with setup and TMDB security instructions

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# CineScope

PWA cinéma serverless (Astro + React + TMDB), sans backend ni base de données. Toutes les données utilisateur (favoris, scores de recommandation) sont stockées dans le `localStorage` du navigateur.

## Démarrage

1. `npm install`
2. Copier `.env.example` vers `.env` et renseigner `PUBLIC_TMDB_API_KEY` avec une clé API TMDB v3 (https://www.themoviedb.org/settings/api).
3. `npm run dev` puis ouvrir `http://localhost:4321`.

## Tests

`npm test` exécute la suite Vitest (logique de scoring, requêtes TMDB, stockage).

## Sécurité — restriction de la clé TMDB

La clé API TMDB est exposée côté client (obligatoire pour un site 100% serverless). Avant la mise en production :

1. Aller sur https://www.themoviedb.org/settings/api.
2. Ouvrir les paramètres de l'application/clé utilisée.
3. Configurer la restriction "Approved Domains" / "HTTP Referrer" pour n'autoriser que le nom de domaine de production final (ex. `cinescope.vercel.app`).
4. Ne jamais committer le fichier `.env` (déjà exclu via `.gitignore`).

## Déploiement

Déployé sur Vercel via intégration Git continue. Définir `PUBLIC_TMDB_API_KEY` dans les variables d'environnement du projet Vercel (Project Settings → Environment Variables) — ne pas la committer dans le dépôt.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add setup, testing and TMDB security instructions"
```

---

## Follow-up (separate plan, not in this one)

The premium Direction Artistique layer — Adaptive Interface Chroma (ColorThief-driven accent color per movie), glassmorphism refinements, GSAP hero page transitions, Framer Motion liquid-fill favorite button, CSS 3D card tilt, `prefers-reduced-motion`/low-end device downgrade — is intentionally deferred to a second plan once this MVP is verified working end-to-end. This MVP is fully usable and installable on its own.

Also explicitly deferred, identified during the final whole-implementation review (not previously called out, so making it explicit here rather than leaving it as a silent gap):
- **Dashboard Hero section** (spec §5.1/§3 "Hero section spectaculaire" / video backdrop for the day's trending title) — MVP's home page uses plain scrollable rows only. Bundled with the premium DA pass above, since the spec frames the Hero as part of the "Niveau 1M€" visual ambition (video background, dynamic chroma), not a plain functional requirement.
- **TV series support** (`tv/[id].astro`, series search/discover) — the cahier des charges covers "films et séries" throughout, but this MVP plan only scoped movies. Adding TV requires mirroring the movie detail/search/recommendation logic for a second TMDB media type; scoped out to keep this MVP plan focused, planned as a follow-up increment once the movie flow is validated in production.

Both are real, acknowledged scope cuts — not oversights — and should be picked up in a dedicated follow-up plan.
