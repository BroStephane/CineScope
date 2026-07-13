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
}

const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p/';

export function tmdbImageUrl(path: string | null, size = 'w500'): string | null {
  return path ? `${IMAGE_BASE}${size}${path}` : null;
}

async function tmdbFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', import.meta.env.PUBLIC_TMDB_API_KEY);
  url.searchParams.set('language', 'fr-FR');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`TMDB request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getTrending(): Promise<TMDBListResponse<TMDBMovie>> {
  return tmdbFetch('/trending/movie/day');
}

export function getUpcoming(): Promise<TMDBListResponse<TMDBMovie>> {
  return tmdbFetch('/movie/upcoming');
}

export function getMovieDetail(id: number): Promise<TMDBMovieDetail> {
  return tmdbFetch(`/movie/${id}`, { append_to_response: 'credits,videos' });
}

export function searchMovies(query: string): Promise<TMDBListResponse<TMDBMovie>> {
  return tmdbFetch('/search/movie', { query });
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

export function discoverMovies(params: DiscoverParams): Promise<TMDBListResponse<TMDBMovie>> {
  return tmdbFetch('/discover/movie', buildDiscoverQuery(params));
}

export function getGenres(): Promise<{ genres: { id: number; name: string }[] }> {
  return tmdbFetch('/genre/movie/list');
}
