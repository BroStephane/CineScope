import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { Swords, Compass } from 'lucide-react';
import { profileStore } from '../stores/profileStore';
import { getToWatchMovies } from '../lib/toWatch';
import { discoverMovies, type TMDBMovie, type TMDBMovieDetail } from '../lib/tmdb';
import { topGenres, excludeSwiped, excludeWatched } from '../lib/recommend';
import MovieCard from '../components/MovieCard';
import SurpriseMeButton from '../components/SurpriseMeButton';

type TimeRange = 'short' | 'medium' | 'long' | 'any';

const RANGES: Record<TimeRange, { label: string; minRuntime?: number; maxRuntime?: number }> = {
  short: { label: '< 1h30', maxRuntime: 90 },
  medium: { label: '~2h', minRuntime: 90, maxRuntime: 150 },
  long: { label: '2h et +', minRuntime: 150 },
  any: { label: 'Peu importe' },
};

function fitsRange(runtime: number, range: TimeRange): boolean {
  const { minRuntime, maxRuntime } = RANGES[range];
  if (minRuntime && runtime < minRuntime) return false;
  if (maxRuntime && runtime > maxRuntime) return false;
  return true;
}

// Ranks by how many of the user's top genres a movie matches, then by
// rating — deterministic and relevance-first, unlike the roulette's random
// weighted pick, since this widget's whole point is "these 3 fit tonight".
function rankByTaste<T extends { genre_ids?: number[]; vote_average: number }>(movies: T[], preferred: number[]): T[] {
  const preferredSet = new Set(preferred);
  return [...movies].sort((a, b) => {
    const matchesA = (a.genre_ids ?? []).filter((id) => preferredSet.has(id)).length;
    const matchesB = (b.genre_ids ?? []).filter((id) => preferredSet.has(id)).length;
    if (matchesA !== matchesB) return matchesB - matchesA;
    return b.vote_average - a.vote_average;
  });
}

export default function TonightWidget() {
  const profile = useStore(profileStore);
  const [range, setRange] = useState<TimeRange>('any');
  const [suggestions, setSuggestions] = useState<TMDBMovie[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSuggestions(null);
    setError(false);
    const preferred = topGenres(profile, 2);

    getToWatchMovies(profile)
      .then(async (toWatch) => {
        if (cancelled) return;
        const fitting = toWatch.filter((m) => fitsRange(m.runtime, range));
        if (fitting.length >= 3) {
          setSuggestions(rankByTaste(fitting, preferred).slice(0, 3));
          return;
        }
        const { minRuntime, maxRuntime } = RANGES[range];
        const discovered = await discoverMovies(
          { genres: preferred.length > 0 ? preferred : undefined, minRuntime, maxRuntime, sortBy: 'popularity.desc' },
          1
        );
        if (cancelled) return;
        const filtered = excludeWatched(excludeSwiped(discovered.results, profile), profile);
        const combined: (TMDBMovie | TMDBMovieDetail)[] = [
          ...fitting,
          ...filtered.filter((m) => !fitting.some((f) => f.id === m.id)),
        ];
        setSuggestions(rankByTaste(combined, preferred).slice(0, 3));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, profile.swipedLiked?.join(','), profile.watched?.join(',')]);

  return (
    <section className="glass mx-4 mt-6 rounded-2xl p-4 md:mx-8 md:p-6">
      <h2 className="font-display text-xl tracking-tight">Ce soir, vous avez…</h2>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Temps disponible">
        {(Object.keys(RANGES) as TimeRange[]).map((key) => (
          <button
            key={key}
            aria-pressed={range === key}
            onClick={() => setRange(key)}
            className={`glass-pill flex min-h-11 items-center rounded-full px-3 py-1.5 text-xs ${
              range === key ? 'glass-pill-active text-white' : 'text-white/80'
            }`}
          >
            {RANGES[key].label}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-white/50">Impossible de charger des suggestions.</p>}
      {!error && suggestions === null && <p className="mt-4 text-sm text-white/50">Recherche…</p>}
      {!error && suggestions?.length === 0 && (
        <p className="mt-4 text-sm text-white/50">Aucune suggestion pour ce créneau, essayez un autre temps disponible.</p>
      )}
      {!error && suggestions && suggestions.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-3 sm:max-w-md">
          {suggestions.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
        <SurpriseMeButton />
        <a
          href="/duel"
          className="glass-pill flex min-h-11 items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white"
        >
          <Swords size={16} aria-hidden="true" />
          Duel de films
        </a>
        <a
          href="/quoi-regarder"
          className="glass-pill flex min-h-11 items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white"
        >
          <Compass size={16} aria-hidden="true" />
          Ce soir on regarde quoi ?
        </a>
      </div>
    </section>
  );
}
