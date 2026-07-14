import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useStore } from '@nanostores/react';
import { Download, Upload } from 'lucide-react';
import MovieCard from '../components/MovieCard';
import { profileStore, resetProfile, exportProfile, importProfile } from '../stores/profileStore';
import { getGenres, getMovieDetail, type TMDBMovie, type TMDBMovieDetail } from '../lib/tmdb';
import { FAVORITES_CACHE_NAME, FAVORITES_DATA_CACHE_NAME, getCachedFavoriteMovieData } from '../lib/favoritesCache';

export default function ProfileView() {
  const profile = useStore(profileStore);
  const [genreNames, setGenreNames] = useState<Record<number, string>>({});
  const [favoriteMovies, setFavoriteMovies] = useState<TMDBMovie[] | null>(null);
  const [favoritesError, setFavoritesError] = useState(false);
  const [toWatchMovies, setToWatchMovies] = useState<TMDBMovie[] | null>(null);
  const [toWatchError, setToWatchError] = useState(false);
  const [historyMovies, setHistoryMovies] = useState<TMDBMovie[] | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [importError, setImportError] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    Promise.allSettled(
      profile.favorites.map(async (id) => {
        const cached = await getCachedFavoriteMovieData(id);
        if (cached) return cached;
        return getMovieDetail(id);
      })
    ).then((results) => {
      if (cancelled) return;
      const movies = results
        .filter((r): r is PromiseFulfilledResult<TMDBMovieDetail> => r.status === 'fulfilled')
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

  useEffect(() => {
    let cancelled = false;
    const ids = profile.swipedLiked ?? [];
    if (ids.length === 0) {
      setToWatchMovies([]);
      setToWatchError(false);
      return;
    }
    setToWatchMovies(null);
    setToWatchError(false);
    Promise.allSettled(ids.map((id) => getMovieDetail(id))).then((results) => {
      if (cancelled) return;
      const movies = results
        .filter((r): r is PromiseFulfilledResult<TMDBMovieDetail> => r.status === 'fulfilled')
        .map((r) => r.value);
      if (movies.length === 0 && results.length > 0) setToWatchError(true);
      setToWatchMovies(movies);
    });
    return () => {
      cancelled = true;
    };
  }, [(profile.swipedLiked ?? []).join(',')]);

  useEffect(() => {
    let cancelled = false;
    const ids = profile.watched ?? [];
    if (ids.length === 0) {
      setHistoryMovies([]);
      setHistoryError(false);
      return;
    }
    setHistoryMovies(null);
    setHistoryError(false);
    Promise.allSettled(ids.map((id) => getMovieDetail(id))).then((results) => {
      if (cancelled) return;
      const movies = results
        .filter((r): r is PromiseFulfilledResult<TMDBMovieDetail> => r.status === 'fulfilled')
        .map((r) => r.value);
      if (movies.length === 0 && results.length > 0) setHistoryError(true);
      setHistoryMovies(movies);
    });
    return () => {
      cancelled = true;
    };
  }, [(profile.watched ?? []).join(',')]);

  const sortedGenres = Object.entries(profile.genres)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  const maxScore = sortedGenres[0]?.[1] ?? 1;

  async function handleReset() {
    if (!confirm('Vider toutes vos données locales (favoris, scores) ?')) return;
    resetProfile();
    if (typeof caches !== 'undefined') {
      await Promise.all([caches.delete(FAVORITES_CACHE_NAME), caches.delete(FAVORITES_DATA_CACHE_NAME)]);
    }
    setResetConfirmed(true);
    setTimeout(() => setResetConfirmed(false), 4000);
  }

  function handleExport() {
    const json = exportProfile();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cinescope-sauvegarde.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    const ok = importProfile(text);
    setImportError(!ok);
    setImportSuccess(ok);
    setTimeout(() => {
      setImportError(false);
      setImportSuccess(false);
    }, 4000);
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

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg">
          À voir {toWatchMovies !== null && `(${toWatchMovies.length})`}
        </h2>
        {toWatchError && <p className="text-sm text-white/50">Impossible de charger votre liste.</p>}
        {!toWatchError && toWatchMovies === null && <p className="text-sm text-white/50">Chargement…</p>}
        {!toWatchError && toWatchMovies?.length === 0 && (
          <p className="text-sm text-white/50">Swipez des films dans Découverte pour construire votre liste.</p>
        )}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {toWatchMovies?.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg">
          Historique {historyMovies !== null && `(${historyMovies.length})`}
        </h2>
        {historyError && <p className="text-sm text-white/50">Impossible de charger votre historique.</p>}
        {!historyError && historyMovies === null && <p className="text-sm text-white/50">Chargement…</p>}
        {!historyError && historyMovies?.length === 0 && (
          <p className="text-sm text-white/50">Marquez des films comme vus depuis leur fiche.</p>
        )}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {historyMovies?.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg">Sauvegarde</h2>
        <p className="text-sm text-white/50">
          Vos données restent sur cet appareil. Téléchargez une sauvegarde pour les transférer ou les protéger.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={handleExport}
            className="glass-pill flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm text-white"
          >
            <Download size={16} aria-hidden="true" />
            Télécharger une sauvegarde
          </button>
          <button
            onClick={handleImportClick}
            className="glass-pill flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm text-white"
          >
            <Upload size={16} aria-hidden="true" />
            Restaurer une sauvegarde
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
        <p aria-live="polite" className="mt-2 text-xs text-white/50">
          {importSuccess && 'Sauvegarde restaurée.'}
          {importError && 'Fichier invalide — impossible de restaurer cette sauvegarde.'}
        </p>
      </section>

      <button
        onClick={handleReset}
        className="mt-10 min-h-11 rounded-full border border-red-500/40 bg-red-500/5 px-6 py-2 text-sm text-red-400 backdrop-blur-md"
      >
        Vider mes données
      </button>
      <p aria-live="polite" className="mt-2 text-xs text-white/50">
        {resetConfirmed && 'Vos données ont été supprimées.'}
      </p>
    </div>
  );
}
