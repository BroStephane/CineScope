import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { Star, Check, Plus, Eye } from 'lucide-react';
import MovieCard from '../components/MovieCard';
import { getMovieDetail, tmdbImageUrl, type TMDBMovieDetail, type TMDBWatchProvider } from '../lib/tmdb';
import {
  profileStore,
  viewMovie,
  favoriteMovie,
  unfavoriteMovie,
  markWatched,
  unmarkWatched,
} from '../stores/profileStore';
import {
  cacheFavoritePoster,
  uncacheFavoritePoster,
  cacheFavoriteMovieData,
  uncacheFavoriteMovieData,
} from '../lib/favoritesCache';

function ProviderGroup({ label, providers }: { label: string; providers: TMDBWatchProvider[] }) {
  return (
    <div className="mb-3">
      <p className="mb-2 text-xs uppercase tracking-wide text-white/50">{label}</p>
      <div className="flex flex-wrap gap-2">
        {providers.map((p) => (
          <div
            key={p.provider_id}
            className="glass-pill flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-white/80"
          >
            {tmdbImageUrl(p.logo_path, 'w45') && (
              <img src={tmdbImageUrl(p.logo_path, 'w45') ?? ''} alt="" className="h-5 w-5 rounded" />
            )}
            {p.provider_name}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MovieDetail({ movieId }: { movieId: number }) {
  const profile = useStore(profileStore);
  const [movie, setMovie] = useState<TMDBMovieDetail | null>(null);
  const [error, setError] = useState(false);
  const isFavorite = movie ? profile.favorites.includes(movie.id) : false;
  const isWatched = movie ? (profile.watched ?? []).includes(movie.id) : false;

  useEffect(() => {
    let cancelled = false;
    getMovieDetail(movieId)
      .then((data) => {
        if (cancelled) return;
        setMovie(data);
        viewMovie(data.genres.map((g) => g.id));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [movieId]);

  if (error) return <p className="px-4 py-8 text-white/60">Impossible de charger ce film.</p>;
  if (!movie) return <p className="px-4 py-8 text-white/60">Chargement…</p>;

  const director = movie.credits?.crew.find((c) => c.job === 'Director');
  const trailer = movie.videos?.results.find((v) => v.site === 'YouTube' && v.type === 'Trailer');
  const backdrop = tmdbImageUrl(movie.backdrop_path, 'w1280');
  const genreIds = movie.genres.map((g) => g.id);
  const watchProviders = movie['watch/providers']?.results?.FR;
  const hasWatchProviders =
    !!watchProviders && !!(watchProviders.flatrate || watchProviders.rent || watchProviders.buy);
  const similar = movie.similar?.results ?? [];

  function toggleFavorite() {
    if (!movie) return;
    if (isFavorite) {
      unfavoriteMovie(movie.id);
      uncacheFavoritePoster(movie.poster_path);
      uncacheFavoriteMovieData(movie.id);
    } else {
      favoriteMovie(movie.id, genreIds, director?.id);
      cacheFavoritePoster(movie.poster_path);
      cacheFavoriteMovieData(movie);
    }
  }

  function toggleWatched() {
    if (!movie) return;
    if (isWatched) {
      unmarkWatched(movie.id);
    } else {
      markWatched(movie.id, genreIds);
    }
  }

  return (
    <article>
      {backdrop && (
        <div className="aspect-video w-full overflow-hidden">
          <img src={backdrop} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <div className={`glass relative z-10 rounded-t-3xl px-4 py-6 md:px-8 ${backdrop ? '-mt-12 md:-mt-16' : ''}`}>
        <h1 className="font-display text-2xl md:text-4xl">{movie.title}</h1>
        <p className="mt-1 flex items-center gap-1 text-sm text-white/60">
          {movie.release_date?.slice(0, 4)} · {movie.runtime} min ·
          <Star size={14} className="fill-current text-accent" aria-hidden="true" />
          {movie.vote_average.toFixed(1)}
        </p>
        {director && (
          <p className="mt-1 text-sm text-white/60">
            Réalisé par{' '}
            <a href={`/personne/${director.id}`} className="text-white underline">
              {director.name}
            </a>
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={toggleFavorite}
            aria-pressed={isFavorite}
            className={`glass-pill flex min-h-11 items-center gap-2 rounded-full px-6 py-2 text-sm font-semibold ${
              isFavorite ? 'glass-pill-active text-white' : 'text-white'
            }`}
          >
            {isFavorite ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            {isFavorite ? 'Dans mes favoris' : 'Ajouter aux favoris'}
          </button>
          <button
            onClick={toggleWatched}
            aria-pressed={isWatched}
            className={`glass-pill flex min-h-11 items-center gap-2 rounded-full px-6 py-2 text-sm font-semibold ${
              isWatched ? 'glass-pill-active text-white' : 'text-white'
            }`}
          >
            {isWatched ? <Check size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
            {isWatched ? 'Déjà vu' : 'Marquer comme vu'}
          </button>
        </div>

        <p className="mt-6 max-w-2xl text-white/80">{movie.overview}</p>

        {hasWatchProviders && watchProviders && (
          <section className="mt-8">
            <h2 className="mb-3 font-display text-lg">Où regarder</h2>
            {watchProviders.flatrate && watchProviders.flatrate.length > 0 && (
              <ProviderGroup label="Abonnement" providers={watchProviders.flatrate} />
            )}
            {watchProviders.rent && watchProviders.rent.length > 0 && (
              <ProviderGroup label="Location" providers={watchProviders.rent} />
            )}
            {watchProviders.buy && watchProviders.buy.length > 0 && (
              <ProviderGroup label="Achat" providers={watchProviders.buy} />
            )}
            <a href={watchProviders.link} target="_blank" rel="noreferrer" className="text-xs text-white/40 underline">
              Données fournies par JustWatch
            </a>
          </section>
        )}

        {movie.credits && movie.credits.cast.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 font-display text-lg">Casting</h2>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {movie.credits.cast.slice(0, 10).map((member) => (
                <a key={member.id} href={`/personne/${member.id}`} className="w-20 shrink-0 text-center">
                  <div className="h-20 w-20 overflow-hidden rounded-full bg-surface">
                    {member.profile_path && (
                      <img
                        src={tmdbImageUrl(member.profile_path, 'w185') ?? ''}
                        alt={member.name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-white/80">{member.name}</p>
                </a>
              ))}
            </div>
          </section>
        )}

        {similar.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 font-display text-lg">Films similaires</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
              {similar.slice(0, 10).map((m) => (
                <MovieCard key={m.id} movie={m} />
              ))}
            </div>
          </section>
        )}

        {trailer && (
          <section className="mt-8">
            <h2 className="mb-3 font-display text-lg">Bande-annonce de {movie.title}</h2>
            <div className="aspect-video w-full max-w-2xl overflow-hidden rounded-xl">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube.com/embed/${trailer.key}`}
                title={`Bande-annonce de ${movie.title}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </section>
        )}
      </div>
    </article>
  );
}
