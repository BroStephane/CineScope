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

export default function MovieRow({ title, fetcher, seeAllHref }: Props) {
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

  const headingId = `row-${title.replace(/\s+/g, '-').toLowerCase()}`;

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
      {!error && !movies && <p className="text-sm text-white/50">Chargement…</p>}
      {movies && movies.length === 0 && <p className="text-sm text-white/50">Rien à afficher pour le moment.</p>}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {movies?.map((movie) => (
          <div key={movie.id} className="w-32 shrink-0 sm:w-40 md:w-48">
            <MovieCard movie={movie} />
          </div>
        ))}
      </div>
    </section>
  );
}
