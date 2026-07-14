import { useEffect, useRef, useState } from 'react';
import MovieCard from '../components/MovieCard';
import {
  getTrending,
  getUpcoming,
  getPopular,
  getTopRated,
  getNowPlaying,
  type TMDBListResponse,
  type TMDBMovie,
} from '../lib/tmdb';

const CATEGORY_FETCHERS: Record<
  string,
  { title: string; fetcher: (page: number, signal?: AbortSignal) => Promise<TMDBListResponse<TMDBMovie>> }
> = {
  tendances: { title: 'Tendances du jour', fetcher: getTrending },
  'au-cinema': { title: 'Au cinéma', fetcher: getNowPlaying },
  populaires: { title: 'Populaires', fetcher: getPopular },
  'mieux-notes': { title: 'Mieux notés', fetcher: getTopRated },
  prochainement: { title: 'Prochainement', fetcher: getUpcoming },
};

export default function CategoryGrid({ category }: { category: string }) {
  const entry = CATEGORY_FETCHERS[category];
  const [movies, setMovies] = useState<TMDBMovie[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const fetchingMoreRef = useRef(false);

  // Initial load, reset whenever the category changes.
  useEffect(() => {
    if (!entry) return;
    let cancelled = false;
    setMovies([]);
    setPage(1);
    setTotalPages(1);
    setError(false);
    setLoading(true);
    entry
      .fetcher(1)
      .then((result) => {
        if (cancelled) return;
        setMovies(result.results);
        setPage(1);
        setTotalPages(result.total_pages);
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
  }, [category]);

  // Loads the next page when the sentinel at the bottom of the grid scrolls into view.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!entry || !sentinel || page >= totalPages) return;
    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || fetchingMoreRef.current) return;
        fetchingMoreRef.current = true;
        const nextPage = page + 1;
        setLoading(true);
        entry
          .fetcher(nextPage)
          .then((result) => {
            if (cancelled) return;
            // TMDB's popularity/trending sort is live — its ranking can shift between
            // page fetches, so the same movie can reappear across pages. Dedupe by id
            // to avoid duplicate React keys and duplicate cards.
            setMovies((prev) => {
              const seen = new Set(prev.map((m) => m.id));
              return [...prev, ...result.results.filter((m) => !seen.has(m.id))];
            });
            setPage(nextPage);
            setTotalPages(result.total_pages);
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
  }, [category, page, totalPages]);

  if (!entry) return <p className="px-4 py-8 text-white/60">Catégorie inconnue.</p>;

  return (
    <div className="px-4 py-6 md:px-8">
      <h1 className="font-display text-2xl">{entry.title}</h1>
      {error && <p className="mt-6 text-sm text-white/50">Impossible de charger cette section.</p>}
      {!error && loading && movies.length === 0 && <p className="mt-6 text-sm text-white/50">Chargement…</p>}
      {!error && !loading && movies.length === 0 && (
        <p className="mt-6 text-sm text-white/50">Rien à afficher pour le moment.</p>
      )}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
        {movies.map((movie) => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>
      {page < totalPages && <div ref={sentinelRef} className="h-1" />}
      {loading && movies.length > 0 && <p className="mt-4 text-center text-sm text-white/50">Chargement…</p>}
    </div>
  );
}
