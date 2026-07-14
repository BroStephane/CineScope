export interface TMDBMovie {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  release_date: string;
  vote_average: number;
  genre_ids?: number[];
}

export interface TMDBCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface TMDBCrewMember {
  id: number;
  name: string;
  job: string;
}

export interface TMDBVideo {
  key: string;
  site: string;
  type: string;
}

export interface TMDBMovieDetail extends TMDBMovie {
  runtime: number;
  genres: { id: number; name: string }[];
  credits?: { cast: TMDBCastMember[]; crew: TMDBCrewMember[] };
  videos?: { results: TMDBVideo[] };
}

export interface TMDBListResponse<T> {
  results: T[];
  page: number;
  total_pages: number;
}

const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p/';

export function tmdbImageUrl(path: string | null, size = 'w500'): string | null {
  return path ? `${IMAGE_BASE}${size}${path}` : null;
}

async function tmdbFetch<T>(
  endpoint: string,
  params: Record<string, string> = {},
  signal?: AbortSignal
): Promise<T> {
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', import.meta.env.PUBLIC_TMDB_API_KEY);
  url.searchParams.set('language', 'fr-FR');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    let message = `TMDB request failed: ${response.status}`;
    try {
      const body = await response.json();
      if (body?.status_message) message = body.status_message;
    } catch {
      // response body wasn't JSON — keep the generic message
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export function getTrending(page = 1, signal?: AbortSignal): Promise<TMDBListResponse<TMDBMovie>> {
  return tmdbFetch('/trending/movie/day', { page: String(page) }, signal);
}

export function getUpcoming(page = 1, signal?: AbortSignal): Promise<TMDBListResponse<TMDBMovie>> {
  return tmdbFetch('/movie/upcoming', { page: String(page) }, signal);
}

export function getPopular(page = 1, signal?: AbortSignal): Promise<TMDBListResponse<TMDBMovie>> {
  return tmdbFetch('/movie/popular', { page: String(page) }, signal);
}

export function getTopRated(page = 1, signal?: AbortSignal): Promise<TMDBListResponse<TMDBMovie>> {
  return tmdbFetch('/movie/top_rated', { page: String(page) }, signal);
}

export function getNowPlaying(page = 1, signal?: AbortSignal): Promise<TMDBListResponse<TMDBMovie>> {
  return tmdbFetch('/movie/now_playing', { page: String(page) }, signal);
}

export function getMovieDetail(id: number, signal?: AbortSignal): Promise<TMDBMovieDetail> {
  return tmdbFetch(`/movie/${id}`, { append_to_response: 'credits,videos' }, signal);
}

export function searchMovies(query: string, signal?: AbortSignal): Promise<TMDBListResponse<TMDBMovie>> {
  return tmdbFetch('/search/movie', { query }, signal);
}

export interface DiscoverParams {
  genres?: number[];
  year?: number;
  minRating?: number;
}

export function buildDiscoverQuery(params: DiscoverParams): Record<string, string> {
  const query: Record<string, string> = { sort_by: 'popularity.desc' };
  if (params.genres && params.genres.length > 0) {
    query.with_genres = params.genres.join(',');
  }
  if (params.year) {
    query.primary_release_year = String(params.year);
  }
  if (params.minRating) {
    query['vote_average.gte'] = String(params.minRating);
  }
  return query;
}

export function discoverMovies(
  params: DiscoverParams,
  signal?: AbortSignal
): Promise<TMDBListResponse<TMDBMovie>> {
  return tmdbFetch('/discover/movie', buildDiscoverQuery(params), signal);
}

export function getGenres(signal?: AbortSignal): Promise<{ genres: { id: number; name: string }[] }> {
  return tmdbFetch('/genre/movie/list', {}, signal);
}
