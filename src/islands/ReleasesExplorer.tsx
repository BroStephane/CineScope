import { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import MovieListRow from '../components/MovieListRow';
import GenreDropdown from '../components/GenreDropdown';
import { discoverMovies, getGenres, type DiscoverParams, type TMDBMovie } from '../lib/tmdb';

interface Genre {
  id: number;
  name: string;
}

const CURRENT_YEAR = new Date().getFullYear();
const OLDEST_YEAR = 1970;
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - OLDEST_YEAR + 1 }, (_, i) => CURRENT_YEAR - i);
const TODAY = new Date().toISOString().slice(0, 10);
// TMDB's release_date sort surfaces a lot of zero-engagement, metadata-less
// entries (no synopsis, no votes) ahead of real releases — a small vote
// floor keeps the list to movies that actually have data worth showing.
const MIN_VOTE_COUNT = 5;

export default function ReleasesExplorer() {
  const [selectedGenreIds, setSelectedGenreIds] = useState<number[]>([]);
  const [minRating, setMinRating] = useState(0);
  const [year, setYear] = useState(0);
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

  function buildRequest(pageNum: number) {
    const params: DiscoverParams = {
      genres: selectedGenreIds.length > 0 ? selectedGenreIds : undefined,
      genreMatch: 'any',
      minRating: minRating || undefined,
      year: year || undefined,
      sortBy: 'release_date.desc',
      maxReleaseDate: TODAY,
      minVoteCount: MIN_VOTE_COUNT,
    };
    return discoverMovies(params, pageNum);
  }

  // Resets to page 1 whenever the filters change.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    buildRequest(1)
      .then((data) => {
        if (cancelled) return;
        setMovies(data.results);
        setPage(1);
        setTotalPages(data.total_pages);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGenreIds.join(','), minRating, year]);

  // Loads the next page when the sentinel at the bottom of the list scrolls into view.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || page >= totalPages) return;
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
            // TMDB pages can shift between fetches, so the same movie can
            // reappear across pages. Dedupe by id to avoid duplicate keys.
            setMovies((prev) => {
              const seen = new Set(prev.map((m) => m.id));
              return [...prev, ...data.results.filter((m) => !seen.has(m.id))];
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
  }, [page, totalPages]);

  const hasActiveFilters = selectedGenreIds.length > 0 || year !== 0 || minRating !== 0;

  function resetFilters() {
    setSelectedGenreIds([]);
    setYear(0);
    setMinRating(0);
  }

  function toggleGenre(id: number) {
    setSelectedGenreIds((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  }

  return (
    <div className="px-4 py-6 md:px-8">
      <h1 className="font-display text-2xl tracking-tight">Sorties</h1>
      <p className="mt-1 text-sm text-white/60">Les films classés par date de sortie, du plus récent au plus ancien.</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <GenreDropdown genres={genres} selectedIds={selectedGenreIds} onToggle={toggleGenre} />
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
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="glass-pill flex min-h-11 items-center gap-1 rounded-full px-3 py-1 text-xs text-white/70"
          >
            <RotateCcw size={14} aria-hidden="true" />
            Réinitialiser
          </button>
        )}
      </div>

      {error && <p className="mt-6 text-sm text-white/50">Impossible de charger cette section.</p>}
      {!error && loading && movies.length === 0 && <p className="mt-6 text-sm text-white/50">Chargement…</p>}
      {!error && !loading && movies.length === 0 && <p className="mt-6 text-sm text-white/50">Aucun résultat.</p>}

      <div className="mt-6 flex flex-col gap-3">
        {movies.map((movie) => (
          <MovieListRow key={movie.id} movie={movie} />
        ))}
      </div>

      {page < totalPages && <div ref={sentinelRef} className="h-1" />}
      {loading && movies.length > 0 && <p className="mt-4 text-center text-sm text-white/50">Chargement…</p>}
    </div>
  );
}
