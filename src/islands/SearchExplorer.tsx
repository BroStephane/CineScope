import { useEffect, useState } from 'react';
import MovieCard from '../components/MovieCard';
import { discoverMovies, searchMovies, getGenres, type TMDBMovie } from '../lib/tmdb';

interface Genre {
  id: number;
  name: string;
}

export default function SearchExplorer() {
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState<number | null>(null);
  const [minRating, setMinRating] = useState(0);
  const [movies, setMovies] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [genres, setGenres] = useState<Genre[]>([]);

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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    const timeout = setTimeout(() => {
      const request = query.trim()
        ? searchMovies(query.trim())
        : discoverMovies({ genres: genre ? [genre] : undefined, minRating: minRating || undefined });
      request
        .then((data) => {
          if (!cancelled) setMovies(data.results);
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
  }, [query, genre, minRating]);

  return (
    <div className="px-4 py-6 md:px-8">
      <label htmlFor="search-input" className="sr-only">
        Rechercher un film
      </label>
      <input
        id="search-input"
        type="search"
        placeholder="Rechercher un film…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-full border border-white/10 bg-surface/80 px-4 py-3 text-sm backdrop-blur placeholder:text-white/40"
      />

      <div role="group" aria-label="Filtrer par genre" className="mt-4 flex flex-wrap gap-2">
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
      </div>

      {error && <p className="mt-6 text-sm text-white/50">Impossible de charger cette section.</p>}
      {!error && loading && <p className="mt-6 text-sm text-white/50">Recherche…</p>}
      {!error && !loading && movies.length === 0 && <p className="mt-6 text-sm text-white/50">Aucun résultat.</p>}

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
        {movies.map((movie) => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>
    </div>
  );
}
