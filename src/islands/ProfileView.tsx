import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import MovieCard from '../components/MovieCard';
import { profileStore, resetProfile } from '../stores/profileStore';
import { getGenres, getMovieDetail, type TMDBMovie } from '../lib/tmdb';
import { FAVORITES_CACHE_NAME } from '../lib/favoritesCache';

export default function ProfileView() {
  const profile = useStore(profileStore);
  const [genreNames, setGenreNames] = useState<Record<number, string>>({});
  const [favoriteMovies, setFavoriteMovies] = useState<TMDBMovie[] | null>(null);
  const [favoritesError, setFavoritesError] = useState(false);
  const [resetConfirmed, setResetConfirmed] = useState(false);

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
    let cancelled = false;
    if (profile.favorites.length === 0) {
      setFavoriteMovies([]);
      setFavoritesError(false);
      return;
    }
    setFavoriteMovies(null);
    setFavoritesError(false);
    Promise.allSettled(profile.favorites.map((id) => getMovieDetail(id))).then((results) => {
      if (cancelled) return;
      const movies = results
        .filter((r): r is PromiseFulfilledResult<TMDBMovie> => r.status === 'fulfilled')
        .map((r) => r.value);
      if (movies.length === 0 && results.length > 0) {
        setFavoritesError(true);
      }
      setFavoriteMovies(movies);
    });
    return () => {
      cancelled = true;
    };
  }, [profile.favorites.join(',')]);

  const sortedGenres = Object.entries(profile.genres)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  const maxScore = sortedGenres[0]?.[1] ?? 1;

  async function handleReset() {
    if (!confirm('Vider toutes vos données locales (favoris, scores) ?')) return;
    resetProfile();
    if (typeof caches !== 'undefined') {
      await caches.delete(FAVORITES_CACHE_NAME);
    }
    setResetConfirmed(true);
    setTimeout(() => setResetConfirmed(false), 4000);
  }

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
        <h2 className="mb-3 font-display text-lg">
          Mes favoris {favoriteMovies !== null && `(${favoriteMovies.length})`}
        </h2>
        {favoritesError && <p className="text-sm text-white/50">Impossible de charger vos favoris.</p>}
        {!favoritesError && favoriteMovies === null && <p className="text-sm text-white/50">Chargement…</p>}
        {!favoritesError && favoriteMovies?.length === 0 && (
          <p className="text-sm text-white/50">Aucun favori pour le moment.</p>
        )}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {favoriteMovies?.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      </section>

      <button
        onClick={handleReset}
        className="mt-10 min-h-11 rounded-full border border-red-500/40 px-6 py-2 text-sm text-red-400"
      >
        Vider mes données
      </button>
      <p aria-live="polite" className="mt-2 text-xs text-white/50">
        {resetConfirmed && 'Vos données ont été supprimées.'}
      </p>
    </div>
  );
}
