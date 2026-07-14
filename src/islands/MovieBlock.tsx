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
