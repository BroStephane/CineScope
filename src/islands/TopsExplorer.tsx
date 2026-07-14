import { useEffect, useRef, useState } from 'react';
import MovieCard from '../components/MovieCard';
import { discoverMovies, getGenres, getTopRated, type TMDBMovie } from '../lib/tmdb';

const TABS = [
  { id: 'mieux-notes', label: 'Mieux notés' },
  { id: 'top-genre', label: 'Top par genre' },
  { id: 'top-annee', label: "Top de l'année" },
] as const;
type TabId = (typeof TABS)[number]['id'];

const MIN_VOTE_COUNT = 300;
const CURRENT_YEAR = new Date().getFullYear();

function parseTab(search: string): TabId {
  const raw = new URLSearchParams(search).get('tab');
  return TABS.some((t) => t.id === raw) ? (raw as TabId) : 'mieux-notes';
}

function parseGenre(search: string): number | null {
  const raw = Number(new URLSearchParams(search).get('genre'));
  return Number.isInteger(raw) && raw > 0 ? raw : null;
}

function buildHref(tab: TabId, genre: number | null): string {
  const params = new URLSearchParams();
  params.set('tab', tab);
  if (genre) params.set('genre', String(genre));
  return `/tops?${params.toString()}`;
}

export default function TopsExplorer() {
  const [tab, setTab] = useState<TabId>('mieux-notes');
  const [genre, setGenre] = useState<number | null>(null);
  const [genres, setGenres] = useState<{ id: number; name: string }[]>([]);
  const [movies, setMovies] = useState<TMDBMovie[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const fetchingMoreRef = useRef(false);

  useEffect(() => {
    const search = window.location.search;
    setTab(parseTab(search));
    setGenre(parseGenre(search));
  }, []);

  useEffect(() => {
    let cancelled = false;
    getGenres()
      .then((result) => {
        if (!cancelled) setGenres(result.genres);
      })
      .catch(() => {
        if (!cancelled) setGenres([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isEmptyGenreTab = tab === 'top-genre' && !genre;

  function buildRequest(pageNum: number) {
    return tab === 'mieux-notes'
      ? getTopRated(pageNum)
      : tab === 'top-genre'
        ? discoverMovies(
            { genres: genre ? [genre] : undefined, minVoteCount: MIN_VOTE_COUNT, sortBy: 'vote_average.desc' },
            pageNum
          )
        : discoverMovies({ year: CURRENT_YEAR, minVoteCount: MIN_VOTE_COUNT, sortBy: 'vote_average.desc' }, pageNum);
  }

  // Initial load, reset whenever the tab or genre changes.
  useEffect(() => {
    if (isEmptyGenreTab) {
      setMovies([]);
      setPage(1);
      setTotalPages(1);
      setError(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setMovies([]);
    setPage(1);
    setTotalPages(1);
    setError(false);
    setLoading(true);
    buildRequest(1)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, genre, isEmptyGenreTab]);

  // Loads the next page when the sentinel at the bottom of the grid scrolls into view.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || isEmptyGenreTab || page >= totalPages) return;
    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || fetchingMoreRef.current) return;
        fetchingMoreRef.current = true;
        const nextPage = page + 1;
        setLoading(true);
        buildRequest(nextPage)
          .then((result) => {
            if (cancelled) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, totalPages, isEmptyGenreTab]);

  return (
    <div className="px-4 py-6 md:px-8">
      <h1 className="font-display text-2xl">Tops</h1>

      <div role="tablist" aria-label="Choisir un top" className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <a
            key={t.id}
            href={buildHref(t.id, null)}
            role="tab"
            aria-selected={tab === t.id}
            className={`glass-pill flex min-h-11 items-center rounded-full px-4 py-1.5 text-sm ${
              tab === t.id ? 'glass-pill-active text-white' : 'text-white/80'
            }`}
          >
            {t.label}
          </a>
        ))}
      </div>

      {tab === 'top-genre' && (
        <div role="group" aria-label="Choisir un genre" className="mt-4 flex flex-wrap gap-2">
          {genres.map((g) => (
            <a
              key={g.id}
              href={buildHref('top-genre', g.id)}
              className={`glass-pill flex min-h-11 items-center rounded-full px-3 py-1.5 text-xs ${
                genre === g.id ? 'glass-pill-active text-white' : 'text-white/80'
              }`}
            >
              {g.name}
            </a>
          ))}
        </div>
      )}

      {isEmptyGenreTab && <p className="mt-6 text-sm text-white/50">Choisissez un genre pour voir son top.</p>}
      {error && <p className="mt-6 text-sm text-white/50">Impossible de charger cette section.</p>}
      {!error && !isEmptyGenreTab && loading && movies.length === 0 && (
        <p className="mt-6 text-sm text-white/50">Chargement…</p>
      )}
      {!error && !isEmptyGenreTab && !loading && movies.length === 0 && (
        <p className="mt-6 text-sm text-white/50">Rien à afficher pour le moment.</p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
        {movies.map((movie) => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>

      {!isEmptyGenreTab && page < totalPages && <div ref={sentinelRef} className="h-1" />}
      {!isEmptyGenreTab && loading && movies.length > 0 && (
        <p className="mt-4 text-center text-sm text-white/50">Chargement…</p>
      )}
    </div>
  );
}
