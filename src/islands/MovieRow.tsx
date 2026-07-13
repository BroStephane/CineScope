import { useEffect, useState } from 'react';
import MovieCard from '../components/MovieCard';
import { getTrending, getUpcoming, type TMDBMovie } from '../lib/tmdb';

// Astro serializes client:load island props to JSON, so a function reference
// (e.g. passing `getTrending` directly) always arrives client-side as null.
// We pass a string key instead and resolve it to the real fetcher here.
const FETCHERS = {
  trending: getTrending,
  upcoming: getUpcoming,
} as const;

interface Props {
  title: string;
  fetcher: keyof typeof FETCHERS;
}

export default function MovieRow({ title, fetcher }: Props) {
  const [movies, setMovies] = useState<TMDBMovie[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
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
