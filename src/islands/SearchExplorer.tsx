import { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { SlidersHorizontal, RotateCcw } from 'lucide-react';
import MovieCard from '../components/MovieCard';
import { discoverMovies, searchMovies, getGenres, type DiscoverParams, type TMDBMovie } from '../lib/tmdb';
import { profileStore } from '../stores/profileStore';
import { topGenres, excludeFavorites, excludeWatched } from '../lib/recommend';
import { MOODS } from '../lib/moods';

function sameGenreSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, i) => id === sortedB[i]);
}

interface Genre {
  id: number;
  name: string;
}

const CURRENT_YEAR = new Date().getFullYear();
const OLDEST_YEAR = 1970;
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - OLDEST_YEAR + 1 }, (_, i) => CURRENT_YEAR - i);
const MIN_VOTE_COUNT_FOR_RATING_SORT = 300;

const LANGUAGE_OPTIONS = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'Anglais' },
  { code: 'es', label: 'Espagnol' },
  { code: 'it', label: 'Italien' },
  { code: 'de', label: 'Allemand' },
  { code: 'ja', label: 'Japonais' },
  { code: 'ko', label: 'Coréen' },
  { code: 'hi', label: 'Hindi' },
  { code: 'zh', label: 'Mandarin' },
];

const RUNTIME_OPTIONS = [
  { value: 'any', label: 'Durée', minRuntime: undefined, maxRuntime: undefined },
  { value: 'short', label: 'Moins de 90 min', minRuntime: undefined, maxRuntime: 90 },
  { value: 'medium', label: '90–120 min', minRuntime: 90, maxRuntime: 120 },
  { value: 'long', label: 'Plus de 120 min', minRuntime: 120, maxRuntime: undefined },
] as const;
type RuntimeOption = (typeof RUNTIME_OPTIONS)[number]['value'];

type SortMode = 'tendance' | 'note' | 'pour-vous';

export default function SearchExplorer() {
  const profile = useStore(profileStore);
  const [query, setQuery] = useState('');
  const [selectedGenreIds, setSelectedGenreIds] = useState<number[]>([]);
  const [minRating, setMinRating] = useState(0);
  const [year, setYear] = useState(0);
  const [language, setLanguage] = useState('');
  const [runtime, setRuntime] = useState<RuntimeOption>('any');
  const [sortMode, setSortMode] = useState<SortMode>('tendance');
  const [movies, setMovies] = useState<TMDBMovie[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [genres, setGenres] = useState<Genre[]>([]);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const fetchingMoreRef = useRef(false);

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

  const isTextSearch = query.trim().length > 0;
  const isPourVous = !isTextSearch && sortMode === 'pour-vous';
  const preferredGenres = topGenres(profile, 2);
  const pourVousUnavailable = isPourVous && preferredGenres.length === 0;
  const runtimeRange = RUNTIME_OPTIONS.find((r) => r.value === runtime);

  function filterResults(results: TMDBMovie[]) {
    return isPourVous ? excludeWatched(excludeFavorites(results, profile), profile) : results;
  }

  function buildRequest(pageNum: number) {
    if (isTextSearch) return searchMovies(query.trim(), pageNum);
    const params: DiscoverParams = {
      genres: isPourVous ? preferredGenres : selectedGenreIds.length > 0 ? selectedGenreIds : undefined,
      genreMatch: 'any',
      minRating: minRating || undefined,
      year: year || undefined,
      sortBy: sortMode === 'note' ? 'vote_average.desc' : undefined,
      minVoteCount: sortMode === 'note' ? MIN_VOTE_COUNT_FOR_RATING_SORT : undefined,
      originalLanguage: language || undefined,
      minRuntime: runtimeRange?.minRuntime,
      maxRuntime: runtimeRange?.maxRuntime,
    };
    return discoverMovies(params, pageNum);
  }

  // Resets to page 1 whenever the query/filters/sort change.
  useEffect(() => {
    if (pourVousUnavailable) {
      setMovies([]);
      setPage(1);
      setTotalPages(1);
      setLoading(false);
      setError(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    const timeout = setTimeout(() => {
      buildRequest(1)
        .then((data) => {
          if (cancelled) return;
          setMovies(filterResults(data.results));
          setPage(1);
          setTotalPages(data.total_pages);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    query,
    selectedGenreIds.join(','),
    minRating,
    year,
    language,
    runtime,
    sortMode,
    preferredGenres.join(','),
    pourVousUnavailable,
  ]);

  // Loads the next page when the sentinel at the bottom of the grid scrolls into view.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || pourVousUnavailable || page >= totalPages) return;
    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || fetchingMoreRef.current) return;
        fetchingMoreRef.current = true;
        const nextPage = page + 1;
        setLoading(true);
        buildRequest(nextPage)
          .then((data) => {
            if (cancelled) return;
            const results = filterResults(data.results);
            // TMDB's popularity-based sort is live — its ranking can shift between
            // the page-1 and page-N fetches, so the same movie can reappear across
            // pages. Dedupe by id to avoid duplicate React keys and duplicate cards.
            setMovies((prev) => {
              const seen = new Set(prev.map((m) => m.id));
              return [...prev, ...results.filter((m) => !seen.has(m.id))];
            });
            setPage(nextPage);
            setTotalPages(data.total_pages);
          })
          .catch(() => {
            if (!cancelled) setError(true);
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
            fetchingMoreRef.current = false;
          });
      },
      { rootMargin: '400px' }
    );
    observer.observe(sentinel);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, totalPages, pourVousUnavailable]);

  const hasActiveFilters =
    selectedGenreIds.length > 0 ||
    year !== 0 ||
    minRating !== 0 ||
    sortMode !== 'tendance' ||
    language !== '' ||
    runtime !== 'any';

  function resetFilters() {
    setSelectedGenreIds([]);
    setYear(0);
    setMinRating(0);
    setSortMode('tendance');
    setLanguage('');
    setRuntime('any');
  }

  function toggleGenre(id: number) {
    setSelectedGenreIds((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  }

  function toggleMood(genreIds: number[]) {
    setSelectedGenreIds((prev) => (sameGenreSet(prev, genreIds) ? [] : genreIds));
  }

  return (
    <div className="px-4 py-6 md:px-8">
      <h1 className="font-display text-2xl tracking-tight">Recherche</h1>
      <label htmlFor="search-input" className="sr-only">
        Rechercher un film
      </label>
      <input
        id="search-input"
        type="search"
        placeholder="Rechercher un film…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="glass-input mt-4 w-full rounded-full px-4 py-3 text-sm placeholder:text-white/40"
      />

      <div className="mt-4 flex items-center gap-2 text-xs uppercase tracking-wide text-white/50">
        <SlidersHorizontal size={14} aria-hidden="true" />
        Filtres
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="glass-pill ml-auto flex min-h-11 items-center gap-1 rounded-full px-3 py-1 normal-case text-white/70"
          >
            <RotateCcw size={14} aria-hidden="true" />
            Réinitialiser
          </button>
        )}
      </div>

      {!isTextSearch && (
        <div className="mt-2">
          <label htmlFor="sort-mode" className="sr-only">
            Trier par
          </label>
          <select
            id="sort-mode"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="glass-input min-h-11 rounded-full px-3 py-1.5 text-xs text-white/80"
          >
            <option value="tendance">Trier par tendance</option>
            <option value="note">Trier par note</option>
            <option value="pour-vous">Trier par pour vous</option>
          </select>
        </div>
      )}

      {sortMode !== 'pour-vous' && (
        <div role="group" aria-label="Filtrer par humeur" className="mt-3 flex flex-wrap gap-2">
          {MOODS.map((mood) => (
            <button
              key={mood.id}
              aria-pressed={sameGenreSet(selectedGenreIds, mood.genreIds)}
              onClick={() => toggleMood(mood.genreIds)}
              className={`glass-pill flex min-h-11 items-center rounded-full px-3 py-1.5 text-xs ${
                sameGenreSet(selectedGenreIds, mood.genreIds) ? 'glass-pill-active text-white' : 'text-white/80'
              }`}
            >
              {mood.label}
            </button>
          ))}
        </div>
      )}

      {sortMode !== 'pour-vous' && (
        <div role="group" aria-label="Filtrer par genres" className="mt-3 flex flex-wrap gap-2">
          {genres.map((g) => (
            <button
              key={g.id}
              aria-pressed={selectedGenreIds.includes(g.id)}
              onClick={() => toggleGenre(g.id)}
              className={`glass-pill flex min-h-11 items-center rounded-full px-3 py-1.5 text-xs ${
                selectedGenreIds.includes(g.id) ? 'glass-pill-active text-white' : 'text-white/80'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <select
          value={minRating}
          onChange={(e) => setMinRating(Number(e.target.value))}
          className="glass-input min-h-11 rounded-full px-3 py-1.5 text-xs text-white/80"
        >
          <option value={0}>Note minimum</option>
          <option value={5}>5+</option>
          <option value={7}>7+</option>
          <option value={8}>8+</option>
        </select>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="glass-input min-h-11 rounded-full px-3 py-1.5 text-xs text-white/80"
        >
          <option value={0}>Année</option>
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="glass-input min-h-11 rounded-full px-3 py-1.5 text-xs text-white/80"
        >
          <option value="">Langue</option>
          {LANGUAGE_OPTIONS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
        <select
          value={runtime}
          onChange={(e) => setRuntime(e.target.value as RuntimeOption)}
          className="glass-input min-h-11 rounded-full px-3 py-1.5 text-xs text-white/80"
        >
          {RUNTIME_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {pourVousUnavailable && (
        <p className="mt-6 text-sm text-white/50">Explorez des films pour activer cette option.</p>
      )}
      {!pourVousUnavailable && error && <p className="mt-6 text-sm text-white/50">Impossible de charger cette section.</p>}
      {!pourVousUnavailable && !error && loading && movies.length === 0 && (
        <p className="mt-6 text-sm text-white/50">Recherche…</p>
      )}
      {!pourVousUnavailable && !error && !loading && movies.length === 0 && (
        <p className="mt-6 text-sm text-white/50">Aucun résultat.</p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
        {movies.map((movie) => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>

      {!pourVousUnavailable && page < totalPages && <div ref={sentinelRef} className="h-1" />}
      {!pourVousUnavailable && loading && movies.length > 0 && (
        <p className="mt-4 text-center text-sm text-white/50">Chargement…</p>
      )}
    </div>
  );
}
