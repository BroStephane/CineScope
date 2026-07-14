import { Star } from 'lucide-react';
import { tmdbImageUrl, type TMDBMovie } from '../lib/tmdb';

export default function MovieListRow({ movie }: { movie: TMDBMovie }) {
  const poster = tmdbImageUrl(movie.poster_path, 'w185');
  const year = movie.release_date?.slice(0, 4);

  return (
    <a href={`/movie/${movie.id}`} className="glass-card flex gap-4 rounded-xl p-3">
      <div className="aspect-[2/3] w-20 flex-shrink-0 overflow-hidden rounded-lg bg-surface sm:w-24">
        {poster ? (
          <img src={poster} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-white/50">Pas d'affiche</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-display text-base tracking-tight text-white/90 sm:text-lg">{movie.title}</h3>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-white/60">
          {year}
          {movie.vote_average > 0 && (
            <>
              {' '}
              · <Star size={12} className="fill-current text-accent" aria-hidden="true" />
              {movie.vote_average.toFixed(1)}
            </>
          )}
        </p>
        <p className="mt-1.5 line-clamp-2 text-sm text-white/60 sm:line-clamp-3">
          {movie.overview || 'Pas de synopsis disponible.'}
        </p>
      </div>
    </a>
  );
}
