/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_TMDB_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
