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
