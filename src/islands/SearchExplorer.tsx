import { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { SlidersHorizontal, RotateCcw } from 'lucide-react';
import MovieCard from '../components/MovieCard';
import { discoverMovies, searchMovies, getGenres, type DiscoverParams, type TMDBMovie } from '../lib/tmdb';
import { profileStore } from '../stores/profileStore';
import { topGenres, excludeFavorites } from '../lib/recommend';

interface Genre {
  id: number;
  name: string;
}

const CURRENT_YEAR = new Date().getFullYear();
const OLDEST_YEAR = 1970;
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - OLDEST_YEAR + 1 }, (_, i) => CURRENT_YEAR - i);
const MIN_VOTE_COUNT_FOR_RATING_SORT = 300;

type SortMode = 'tendance' | 'note' | 'pour-vous';

export default function SearchExplorer() {
  const profile = useStore(profileStore);
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState<number | null>(null);
  const [minRating, setMinRating] = useState(0);
  const [year, setYear] = useState(0);
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

  function buildRequest(pageNum: number) {
    if (isTextSearch) return searchMovies(query.trim(), pageNum);
    const params: DiscoverParams = {
      genres: isPourVous ? preferredGenres : genre ? [genre] : undefined,
      minRating: minRating || undefined,
      year: year || undefined,
      sortBy: sortMode === 'note' ? 'vote_average.desc' : undefined,
      minVoteCount: sortMode === 'note' ? MIN_VOTE_COUNT_FOR_RATING_SORT : undefined,
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
          const results = isPourVous ? excludeFavorites(data.results, profile) : data.results;
          setMovies(results);
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
  }, [query, genre, minRating, year, sortMode, preferredGenres.join(','), pourVousUnavailable]);

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
            const results = isPourVous ? excludeFavorites(data.results, profile) : data.results;
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

  const hasActiveFilters = genre !== null || year !== 0 || minRating !== 0 || sortMode !== 'tendance';

  function resetFilters() {
    setGenre(null);
    setYear(0);
    setMinRating(0);
    setSortMode('tendance');
  }

  return (
    <div className="px-4 py-6 md:px-8">
      <h1 className="font-display text-2xl">Recherche</h1>
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
        <div role="group" aria-label="Filtrer par genre" className="mt-3 flex flex-wrap gap-2">
          {genres.map((g) => (
            <button
              key={g.id}
              aria-pressed={genre === g.id}
              onClick={() => setGenre(genre === g.id ? null : g.id)}
              className={`glass-pill flex min-h-11 items-center rounded-full px-3 py-1.5 text-xs ${
                genre === g.id ? 'glass-pill-active text-white' : 'text-white/80'
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
