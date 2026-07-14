import { useEffect, useState } from 'react';
import MovieCard from '../components/MovieCard';
import Pagination from '../components/Pagination';
import { parsePageParam } from '../lib/pagination';
import { discoverMovies, getGenres, getTopRated, type TMDBListResponse, type TMDBMovie } from '../lib/tmdb';

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

function buildHref(tab: TabId, genre: number | null, page: number): string {
  const params = new URLSearchParams();
  params.set('tab', tab);
  if (genre) params.set('genre', String(genre));
  params.set('page', String(page));
  return `/tops?${params.toString()}`;
}

export default function TopsExplorer() {
  const [tab, setTab] = useState<TabId>('mieux-notes');
  const [genre, setGenre] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [genres, setGenres] = useState<{ id: number; name: string }[]>([]);
  const [data, setData] = useState<TMDBListResponse<TMDBMovie> | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const search = window.location.search;
    setTab(parseTab(search));
    setGenre(parseGenre(search));
    setPage(parsePageParam(search));
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

  useEffect(() => {
    if (isEmptyGenreTab) {
      setData({ results: [], page: 1, total_pages: 0 });
      return;
    }
    let cancelled = false;
    setData(null);
    setError(false);
    const request =
      tab === 'mieux-notes'
        ? getTopRated(page)
        : tab === 'top-genre'
          ? discoverMovies(
              { genres: genre ? [genre] : undefined, minVoteCount: MIN_VOTE_COUNT, sortBy: 'vote_average.desc' },
              page
            )
          : discoverMovies({ year: CURRENT_YEAR, minVoteCount: MIN_VOTE_COUNT, sortBy: 'vote_average.desc' }, page);
    request
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, genre, page, isEmptyGenreTab]);

  return (
    <div className="px-4 py-6 md:px-8">
      <h1 className="font-display text-2xl">Tops</h1>

      <div role="tablist" aria-label="Choisir un top" className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <a
            key={t.id}
            href={buildHref(t.id, null, 1)}
            role="tab"
            aria-selected={tab === t.id}
            className={`flex min-h-11 items-center rounded-full border border-white/10 px-4 py-1.5 text-sm ${
              tab === t.id ? 'bg-accent text-black' : 'bg-surface/60 text-white/80'
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
              href={buildHref('top-genre', g.id, 1)}
              className={`flex min-h-11 items-center rounded-full border border-white/10 px-3 py-1.5 text-xs ${
                genre === g.id ? 'bg-accent text-black' : 'bg-surface/60 text-white/80'
              }`}
            >
              {g.name}
            </a>
          ))}
        </div>
      )}

      {isEmptyGenreTab && <p className="mt-6 text-sm text-white/50">Choisissez un genre pour voir son top.</p>}
      {error && <p className="mt-6 text-sm text-white/50">Impossible de charger cette section.</p>}
      {!error && !data && <p className="mt-6 text-sm text-white/50">Chargement…</p>}
      {data && data.results.length === 0 && !isEmptyGenreTab && (
        <p className="mt-6 text-sm text-white/50">Rien à afficher pour le moment.</p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
        {data?.results.map((movie) => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>

      {data && data.results.length > 0 && (
        <Pagination page={data.page} totalPages={data.total_pages} buildHref={(p) => buildHref(tab, genre, p)} />
      )}
    </div>
  );
}
