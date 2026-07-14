import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { profileStore } from '../stores/profileStore';
import { getWatchedMovies, getToWatchMovies } from '../lib/toWatch';
import { computeWatchStats, formatMinutes, type WatchStats } from '../lib/stats';
import { ACHIEVEMENTS } from '../lib/achievements';
import { getGenres, getPersonDetail, type TMDBMovieDetail } from '../lib/tmdb';
import TasteCard from '../components/TasteCard';

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card rounded-xl p-4">
      <p className="text-xs uppercase tracking-wide text-white/50">{label}</p>
      <p className="mt-1 font-display text-xl tracking-tight text-white">{value}</p>
    </div>
  );
}

export default function StatsView() {
  const profile = useStore(profileStore);
  const [genreNames, setGenreNames] = useState<Record<number, string>>({});
  const [directorName, setDirectorName] = useState<string | null>(null);
  const [watchedMovies, setWatchedMovies] = useState<TMDBMovieDetail[] | null>(null);
  const [toWatchMovies, setToWatchMovies] = useState<TMDBMovieDetail[] | null>(null);
  const [error, setError] = useState(false);

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
    Promise.all([getWatchedMovies(profile), getToWatchMovies(profile)])
      .then(([watched, toWatch]) => {
        setWatchedMovies(watched);
        setToWatchMovies(toWatch);
      })
      .catch(() => setError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(profile.watched ?? []).join(','), (profile.swipedLiked ?? []).join(',')]);

  const stats: WatchStats | null =
    watchedMovies && toWatchMovies ? computeWatchStats(watchedMovies, toWatchMovies, profile) : null;

  useEffect(() => {
    if (!stats?.topDirectorId) {
      setDirectorName(null);
      return;
    }
    let cancelled = false;
    getPersonDetail(stats.topDirectorId)
      .then((person) => {
        if (!cancelled) setDirectorName(person.name);
      })
      .catch(() => {
        if (!cancelled) setDirectorName(null);
      });
    return () => {
      cancelled = true;
    };
  }, [stats?.topDirectorId]);

  const genreName = stats?.topGenreId ? (genreNames[stats.topGenreId] ?? null) : null;
  const ratingDelta = stats?.ratingDelta ?? null;

  return (
    <div className="px-4 py-6 md:px-8">
      <h1 className="font-display text-2xl tracking-tight">Mes stats ciné</h1>

      {error && <p className="mt-6 text-sm text-white/50">Impossible de charger vos statistiques.</p>}
      {!error && !stats && <p className="mt-6 text-sm text-white/50">Calcul en cours…</p>}

      {stats && (
        <>
          {stats.totalWatched === 0 ? (
            <p className="mt-6 text-sm text-white/50">
              Marquez des films comme vus pour construire vos statistiques.
            </p>
          ) : (
            <>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatTile label="Films vus" value={String(stats.totalWatched)} />
                <StatTile label="Temps total" value={formatMinutes(stats.totalMinutes)} />
                <StatTile label="Genre favori" value={genreName ?? '—'} />
                <StatTile label="Réalisateur signature" value={directorName ?? '—'} />
                <StatTile label="Décennie préférée" value={stats.favoriteDecade ? `Années ${stats.favoriteDecade}` : '—'} />
                <StatTile label="Backlog restant" value={formatMinutes(stats.backlogMinutes)} />
              </div>

              {ratingDelta !== null && Math.abs(ratingDelta) >= 0.5 && (
                <p className="mt-4 text-sm text-white/60">
                  {ratingDelta > 0
                    ? `Vous êtes plus indulgent que la moyenne TMDB (+${ratingDelta.toFixed(1)} pts en moyenne).`
                    : `Vous êtes plus sévère que la moyenne TMDB (${ratingDelta.toFixed(1)} pts en moyenne).`}
                </p>
              )}

              {stats.recentlyWatchedCount > 0 && (
                <p className="mt-2 text-sm text-white/60">
                  {stats.recentlyWatchedCount} film{stats.recentlyWatchedCount > 1 ? 's' : ''} vu
                  {stats.recentlyWatchedCount > 1 ? 's' : ''} ces 30 derniers jours.
                </p>
              )}

              <section className="mt-8">
                <h2 className="mb-3 font-body text-xs font-semibold uppercase tracking-[0.14em] text-white/50">
                  Ma carte ciné
                </h2>
                <TasteCard stats={stats} genreName={genreName} directorName={directorName} />
              </section>
            </>
          )}

          <section className="mt-8">
            <h2 className="mb-3 font-body text-xs font-semibold uppercase tracking-[0.14em] text-white/50">
              Succès
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {ACHIEVEMENTS.map((achievement) => {
                const unlocked = achievement.isUnlocked({ profile, watchedMovies: watchedMovies ?? [] });
                return (
                  <div
                    key={achievement.id}
                    className={`glass-card rounded-xl p-4 text-center ${unlocked ? '' : 'opacity-40 grayscale'}`}
                  >
                    <p className="text-3xl">{achievement.emoji}</p>
                    <p className="mt-2 text-sm font-semibold text-white">{achievement.label}</p>
                    <p className="mt-1 text-xs text-white/50">{achievement.description}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
