import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { Shuffle, Star } from 'lucide-react';
import { profileStore } from '../stores/profileStore';
import { getToWatchMovies, pickWeighted } from '../lib/toWatch';
import { tmdbImageUrl, type TMDBMovieDetail } from '../lib/tmdb';

export default function SurpriseMeButton() {
  const profile = useStore(profileStore);
  const [pick, setPick] = useState<TMDBMovieDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);

  async function draw() {
    setLoading(true);
    setEmpty(false);
    try {
      const movies = await getToWatchMovies(profile);
      const chosen = pickWeighted(movies, profile);
      if (!chosen) setEmpty(true);
      setPick(chosen);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={draw}
        disabled={loading}
        className="glass-pill flex min-h-11 items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        <Shuffle size={16} aria-hidden="true" />
        {loading ? 'Tirage…' : pick ? 'Encore !' : 'Surprends-moi'}
      </button>

      {empty && (
        <p className="mt-3 text-sm text-white/50">
          Ajoutez des films à votre liste "à voir" dans Découverte pour utiliser la roulette.
        </p>
      )}

      {pick && (
        <a
          href={`/movie/${pick.id}`}
          className="glass-card mt-3 flex max-w-md gap-4 rounded-xl p-3 hover:no-underline"
        >
          <div className="aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-lg bg-surface">
            {tmdbImageUrl(pick.poster_path, 'w185') && (
              <img
                src={tmdbImageUrl(pick.poster_path, 'w185') ?? ''}
                alt=""
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-display text-base tracking-tight text-white">{pick.title}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-white/60">
              {pick.release_date?.slice(0, 4)} · {pick.runtime} min ·
              <Star size={12} className="fill-current text-accent" aria-hidden="true" />
              {pick.vote_average.toFixed(1)}
            </p>
            <p className="mt-1.5 line-clamp-2 text-sm text-white/60">{pick.overview}</p>
          </div>
        </a>
      )}
    </div>
  );
}
