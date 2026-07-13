import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { getMovieDetail, tmdbImageUrl, type TMDBMovieDetail } from '../lib/tmdb';
import { profileStore, viewMovie, favoriteMovie, unfavoriteMovie } from '../stores/profileStore';
import { cacheFavoritePoster, uncacheFavoritePoster } from '../lib/favoritesCache';

export default function MovieDetail({ movieId }: { movieId: number }) {
  const profile = useStore(profileStore);
  const [movie, setMovie] = useState<TMDBMovieDetail | null>(null);
  const [error, setError] = useState(false);
  const isFavorite = movie ? profile.favorites.includes(movie.id) : false;

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

  function toggleFavorite() {
    if (!movie) return;
    if (isFavorite) {
      unfavoriteMovie(movie.id);
      uncacheFavoritePoster(movie.poster_path);
    } else {
      favoriteMovie(movie.id, genreIds, director?.id);
      cacheFavoritePoster(movie.poster_path);
    }
  }

  return (
    <article>
      {backdrop && (
        <div className="aspect-video w-full overflow-hidden">
          <img src={backdrop} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <div className="px-4 py-6 md:px-8">
        <h1 className="font-display text-2xl md:text-4xl">{movie.title}</h1>
        <p className="mt-1 text-sm text-white/60">
          {movie.release_date?.slice(0, 4)} · {movie.runtime} min · ⭐ {movie.vote_average.toFixed(1)}
        </p>

        <button
          onClick={toggleFavorite}
          aria-pressed={isFavorite}
          className={`mt-4 min-h-11 rounded-full px-6 py-2 text-sm font-semibold ${
            isFavorite ? 'bg-accent text-black' : 'border border-white/20 text-white'
          }`}
        >
          {isFavorite ? '✓ Dans mes favoris' : '+ Ajouter aux favoris'}
        </button>

        <p className="mt-6 max-w-2xl text-white/80">{movie.overview}</p>

        {movie.credits && movie.credits.cast.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 font-display text-lg">Casting</h2>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {movie.credits.cast.slice(0, 10).map((member) => (
                <div key={member.id} className="w-20 shrink-0 text-center">
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
                </div>
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
