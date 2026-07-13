/// <reference types="astro/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly PUBLIC_TMDB_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
