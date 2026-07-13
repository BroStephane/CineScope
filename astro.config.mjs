import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

export default defineConfig({
  // Output stays static by default (SSG) for every route. The Vercel adapter
  // is only needed so the single on-demand route (`/movie/[id]`, which sets
  // `export const prerender = false` since movie ids aren't known at build
  // time and all of its data is fetched client-side from TMDB) can be served
  // — Astro requires an adapter for any non-prerendered route, even though
  // the rest of the site remains fully static/serverless.
  adapter: vercel(),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
