import { tmdbImageUrl, type TMDBMovie } from '../lib/tmdb';

export default function MovieCard({ movie }: { movie: TMDBMovie }) {
  const poster = tmdbImageUrl(movie.poster_path, 'w342');
  return (
    <a
      href={`/movie/${movie.id}`}
      className="block"
    >
      <div className="glass-card aspect-[2/3] overflow-hidden rounded-xl bg-surface">
        {poster ? (
          <img src={poster} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-white/50">Pas d'affiche</div>
        )}
      </div>
      <p className="mt-2 truncate text-sm text-white/90">{movie.title}</p>
    </a>
  );
}
