import { useEffect, useState } from 'react';
import MovieCard from '../components/MovieCard';
import Pagination from '../components/Pagination';
import { parsePageParam } from '../lib/pagination';
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
  const [page, setPage] = useState(1);
  const [data, setData] = useState<TMDBListResponse<TMDBMovie> | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setPage(parsePageParam(window.location.search));
  }, []);

  useEffect(() => {
    if (!entry) return;
    let cancelled = false;
    setData(null);
    setError(false);
    entry
      .fetcher(page)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [category, page]);

  if (!entry) return <p className="px-4 py-8 text-white/60">Catégorie inconnue.</p>;

  return (
    <div className="px-4 py-6 md:px-8">
      <h1 className="font-display text-2xl">{entry.title}</h1>
      {error && <p className="mt-6 text-sm text-white/50">Impossible de charger cette section.</p>}
      {!error && !data && <p className="mt-6 text-sm text-white/50">Chargement…</p>}
      {data && data.results.length === 0 && (
        <p className="mt-6 text-sm text-white/50">Rien à afficher pour le moment.</p>
      )}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
        {data?.results.map((movie) => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>
      {data && data.results.length > 0 && (
        <Pagination page={data.page} totalPages={data.total_pages} buildHref={(p) => `/films/${category}?page=${p}`} />
      )}
    </div>
  );
}
