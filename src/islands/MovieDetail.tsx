import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { Star, Check, Plus, Eye, Share2 } from 'lucide-react';
import MovieCard from '../components/MovieCard';
import BackButton from '../components/BackButton';
import {
  getMovieDetail,
  getCollection,
  tmdbImageUrl,
  type TMDBMovieDetail,
  type TMDBWatchProvider,
  type TMDBMovie,
} from '../lib/tmdb';
import {
  profileStore,
  viewMovie,
  favoriteMovie,
  unfavoriteMovie,
  markWatched,
  unmarkWatched,
  rateMovie,
  unrateMovie,
  setMovieNote,
} from '../stores/profileStore';
import {
  cacheFavoritePoster,
  uncacheFavoritePoster,
  cacheFavoriteMovieData,
  uncacheFavoriteMovieData,
} from '../lib/favoritesCache';

const currencyFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

function BoxOfficeTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card rounded-xl p-3">
      <p className="text-xs uppercase tracking-wide text-white/50">{label}</p>
      <p className="mt-1 font-display text-lg tracking-tight text-white">{value}</p>
    </div>
  );
}

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
  const [collectionParts, setCollectionParts] = useState<TMDBMovie[]>([]);
  const [shareConfirmed, setShareConfirmed] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const isFavorite = movie ? profile.favorites.includes(movie.id) : false;
  const isWatched = movie ? (profile.watched ?? []).includes(movie.id) : false;
  const rating = movie ? (profile.ratings?.[movie.id] ?? 0) : 0;

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

  useEffect(() => {
    if (movie) setNoteDraft(profileStore.get().notes?.[movie.id] ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movie?.id]);

  useEffect(() => {
    if (!movie) return;
    const timeout = setTimeout(() => setMovieNote(movie.id, noteDraft), 600);
    return () => clearTimeout(timeout);
  }, [noteDraft, movie?.id]);

  useEffect(() => {
    if (!movie?.belongs_to_collection) {
      setCollectionParts([]);
      return;
    }
    let cancelled = false;
    getCollection(movie.belongs_to_collection.id)
      .then((result) => {
        if (!cancelled) setCollectionParts(result.parts.filter((p) => p.id !== movie.id));
      })
      .catch(() => {
        if (!cancelled) setCollectionParts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [movie?.belongs_to_collection?.id]);

  if (error)
    return (
      <>
        <BackButton />
        <p className="px-4 py-8 text-white/60">Impossible de charger ce film.</p>
      </>
    );
  if (!movie)
    return (
      <>
        <BackButton />
        <p className="px-4 py-8 text-white/60">Chargement…</p>
      </>
    );

  const director = movie.credits?.crew.find((c) => c.job === 'Director');
  const trailer = movie.videos?.results.find((v) => v.site === 'YouTube' && v.type === 'Trailer');
  const backdrop = tmdbImageUrl(movie.backdrop_path, 'w1280');
  const poster = tmdbImageUrl(movie.poster_path, 'w342');
  const genreIds = movie.genres.map((g) => g.id);
  const watchProviders = movie['watch/providers']?.results?.FR;
  const hasWatchProviders =
    !!watchProviders && !!(watchProviders.flatrate || watchProviders.rent || watchProviders.buy);
  const similar = movie.similar?.results ?? [];
  const hasBoxOffice = movie.budget > 0 || movie.revenue > 0;

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

  function setRating(value: number) {
    if (!movie) return;
    if (rating === value) {
      unrateMovie(movie.id, genreIds);
    } else {
      rateMovie(movie.id, value, genreIds);
    }
  }

  async function handleShare() {
    if (!movie) return;
    const shareData = {
      title: movie.title,
      text: `Découvre ${movie.title} sur CineScope`,
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // user cancelled the native share sheet — nothing to do
      }
      return;
    }
    await navigator.clipboard.writeText(window.location.href);
    setShareConfirmed(true);
    setTimeout(() => setShareConfirmed(false), 3000);
  }

  return (
    <article>
      <BackButton />
      <div className="relative">
        {backdrop && (
          <div className="aspect-video w-full overflow-hidden md:aspect-21/9 md:max-h-140">
            <img src={backdrop} alt="" className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-bg via-bg/10 to-transparent md:from-bg md:via-bg/30" />
          </div>
        )}

        {backdrop && (
          <div className="hidden md:absolute md:inset-x-0 md:bottom-0 md:flex md:items-end md:gap-6 md:px-8 md:pb-8">
            {poster && (
              <img
                src={poster}
                alt=""
                className="w-40 shrink-0 rounded-xl shadow-2xl ring-1 ring-white/10 lg:w-48"
              />
            )}
            <div className="pb-1">
              <h1 className="font-display text-4xl tracking-tight drop-shadow-lg lg:text-5xl">{movie.title}</h1>
              <p className="mt-2 flex items-center gap-1 text-white/80">
                {movie.release_date?.slice(0, 4)} · {movie.runtime} min ·
                <Star size={16} className="fill-current text-accent" aria-hidden="true" />
                {movie.vote_average.toFixed(1)}
              </p>
              {director && (
                <p className="mt-1 text-white/80">
                  Réalisé par{' '}
                  <a href={`/personne/${director.id}`} className="text-white underline">
                    {director.name}
                  </a>
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div
        className={`glass relative z-10 rounded-t-3xl px-4 py-6 md:rounded-none md:px-8 md:py-8 ${
          backdrop ? '-mt-12 md:mt-0' : 'pt-20 md:pt-28'
        }`}
      >
        <div className={backdrop ? 'md:hidden' : ''}>
          <h1 className="font-display text-2xl tracking-tight md:text-4xl">{movie.title}</h1>
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
        </div>

        {movie.genres.length > 0 && (
          <div className="mt-4 hidden flex-wrap gap-2 md:flex">
            {movie.genres.map((g) => (
              <span key={g.id} className="glass-pill rounded-full px-3 py-1 text-xs text-white/70">
                {g.name}
              </span>
            ))}
          </div>
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
          <button
            onClick={handleShare}
            className="glass-pill flex min-h-11 items-center gap-2 rounded-full px-6 py-2 text-sm font-semibold text-white"
          >
            <Share2 size={16} aria-hidden="true" />
            Partager
          </button>
        </div>

        <div className="mt-3 flex items-center gap-1" role="group" aria-label="Noter ce film">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              onClick={() => setRating(value)}
              aria-label={`Noter ${value} étoile${value > 1 ? 's' : ''}`}
              aria-pressed={rating >= value}
              className="flex min-h-11 min-w-11 items-center justify-center"
            >
              <Star
                size={20}
                className={rating >= value ? 'fill-current text-accent' : 'text-white/30'}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
        {shareConfirmed && (
          <p aria-live="polite" className="mt-1 text-xs text-white/50">
            Lien copié !
          </p>
        )}

        <p className="mt-6 max-w-2xl text-white/80 md:max-w-3xl">{movie.overview}</p>

        <div className="mt-6 max-w-2xl md:max-w-3xl">
          <label htmlFor="movie-note" className="mb-2 block text-xs uppercase tracking-wide text-white/50">
            Vos notes personnelles
          </label>
          <textarea
            id="movie-note"
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Ce que vous avez pensé de ce film, une scène marquante…"
            rows={3}
            className="glass-input w-full rounded-2xl px-4 py-3 text-sm text-white/90 placeholder:text-white/40"
          />
        </div>

        {hasBoxOffice && (
          <section className="mt-8">
            <h2 className="mb-3 font-body text-xs font-semibold uppercase tracking-[0.14em] text-white/50">Box-office</h2>
            <div className="grid max-w-md grid-cols-2 gap-3 sm:grid-cols-3">
              {movie.budget > 0 && <BoxOfficeTile label="Budget" value={currencyFormatter.format(movie.budget)} />}
              {movie.revenue > 0 && (
                <BoxOfficeTile label="Recettes mondiales" value={currencyFormatter.format(movie.revenue)} />
              )}
              {movie.budget > 0 && movie.revenue > 0 && (
                <BoxOfficeTile
                  label="Rentabilité"
                  value={`×${(movie.revenue / movie.budget).toFixed(1)}`}
                />
              )}
            </div>
          </section>
        )}

        {hasWatchProviders && watchProviders && (
          <section className="mt-8">
            <h2 className="mb-3 font-body text-xs font-semibold uppercase tracking-[0.14em] text-white/50">Où regarder</h2>
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
            <h2 className="mb-3 font-body text-xs font-semibold uppercase tracking-[0.14em] text-white/50">Casting</h2>
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

        {collectionParts.length > 0 && movie.belongs_to_collection && (
          <section className="mt-8">
            <h2 className="mb-3 font-body text-xs font-semibold uppercase tracking-[0.14em] text-white/50">Fait partie de : {movie.belongs_to_collection.name}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
              {collectionParts.map((m) => (
                <MovieCard key={m.id} movie={m} />
              ))}
            </div>
          </section>
        )}

        {similar.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 font-body text-xs font-semibold uppercase tracking-[0.14em] text-white/50">Films similaires</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
              {similar.slice(0, 10).map((m) => (
                <MovieCard key={m.id} movie={m} />
              ))}
            </div>
          </section>
        )}

        {trailer && (
          <section className="mt-8">
            <h2 className="mb-3 font-body text-xs font-semibold uppercase tracking-[0.14em] text-white/50">Bande-annonce de {movie.title}</h2>
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
