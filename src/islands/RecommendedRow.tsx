import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import MovieCard from '../components/MovieCard';
import { discoverMovies, type TMDBMovie } from '../lib/tmdb';
import { excludeFavorites, topGenres } from '../lib/recommend';
import { profileStore } from '../stores/profileStore';

export default function RecommendedRow() {
  const profile = useStore(profileStore);
  const [rawResults, setRawResults] = useState<TMDBMovie[] | null>(null);
  const [error, setError] = useState(false);
  const genres = topGenres(profile, 2);

  useEffect(() => {
    if (genres.length === 0) {
      setRawResults([]);
      return;
    }
    let cancelled = false;
    setRawResults(null);
    setError(false);
    discoverMovies({ genres })
      .then((data) => {
        if (!cancelled) setRawResults(data.results);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [genres.join(',')]);

  if (genres.length === 0) return null;

  const movies = rawResults ? excludeFavorites(rawResults, profile) : null;

  return (
    <section aria-labelledby="recommended-heading" className="px-4 py-6 md:px-8">
      <h2 id="recommended-heading" className="mb-3 font-body text-xs font-semibold uppercase tracking-[0.14em] text-white/50">
        Recommandé pour vous
      </h2>
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
