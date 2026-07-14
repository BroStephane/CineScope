import { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { Heart, X, Star } from 'lucide-react';
import { discoverMovies, getPopular, tmdbImageUrl, type TMDBMovie } from '../lib/tmdb';
import { topGenres, excludeSwiped } from '../lib/recommend';
import { profileStore, swipeLikeMovie, swipeDislikeMovie, clearSwipeDislikes } from '../stores/profileStore';

const MAX_SWIPE_PAGES = 20;
const BUFFER_LOW_WATERMARK = 5;
const SWIPE_THRESHOLD = 120;
const SWIPE_VELOCITY_THRESHOLD = 800;

function SwipeCard({ movie }: { movie: TMDBMovie }) {
  const poster = tmdbImageUrl(movie.poster_path, 'w500');
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-surface shadow-xl">
      {poster ? (
        <img src={poster} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <div className="flex h-full items-center justify-center text-white/50">Pas d'affiche</div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
        <p className="font-display text-lg text-white">{movie.title}</p>
        <p className="flex items-center gap-1 text-xs text-white/70">
          <Star size={12} className="fill-current text-accent" aria-hidden="true" />
          {movie.vote_average.toFixed(1)}
        </p>
      </div>
    </div>
  );
}

export default function SwipeDeck() {
  const profile = useStore(profileStore);
  const [deck, setDeck] = useState<TMDBMovie[]>([]);
  const [page, setPage] = useState(1);
  const [exhausted, setExhausted] = useState(false);
  const loadingRef = useRef(false);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const likeOpacity = useTransform(x, [20, 120], [0, 1]);
  const passOpacity = useTransform(x, [-120, -20], [1, 0]);

  const genres = topGenres(profile, 2);

  useEffect(() => {
    if (exhausted || loadingRef.current) return;
    if (deck.length >= BUFFER_LOW_WATERMARK) return;
    if (page > MAX_SWIPE_PAGES) {
      if (deck.length === 0) setExhausted(true);
      return;
    }
    let cancelled = false;
    loadingRef.current = true;
    const request = genres.length > 0
      ? discoverMovies({ genres, sortBy: 'popularity.desc' }, page)
      : getPopular(page);
    request
      .then((result) => {
        if (cancelled) return;
        const filtered = excludeSwiped(result.results, profile);
        setDeck((prev) => [...prev, ...filtered]);
        setPage((p) => p + 1);
      })
      .catch(() => {
        if (!cancelled) setExhausted(true);
      })
      .finally(() => {
        loadingRef.current = false;
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck.length, page, exhausted, genres.join(',')]);

  const topMovie = deck[0];
  const nextMovie = deck[1];

  function decide(direction: 'like' | 'dislike') {
    if (!topMovie) return;
    if (direction === 'like') {
      swipeLikeMovie(topMovie.id, topMovie.genre_ids ?? []);
    } else {
      swipeDislikeMovie(topMovie.id);
    }
    setDeck((prev) => prev.slice(1));
    x.set(0);
  }

  function handleDragEnd(_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (info.offset.x > SWIPE_THRESHOLD || info.velocity.x > SWIPE_VELOCITY_THRESHOLD) {
      decide('like');
    } else if (info.offset.x < -SWIPE_THRESHOLD || info.velocity.x < -SWIPE_VELOCITY_THRESHOLD) {
      decide('dislike');
    }
  }

  function restart() {
    clearSwipeDislikes();
    setExhausted(false);
    setPage(1);
  }

  return (
    <div className="flex flex-col items-center px-4 py-6 md:px-8">
      <h1 className="font-display text-2xl">Découverte</h1>
      <p className="mt-1 text-center text-sm text-white/60">
        Glissez à droite pour l'ajouter à votre liste, à gauche pour passer.
      </p>

      <div className="relative mt-6 h-[28rem] w-64 sm:w-72">
        {exhausted && deck.length === 0 && (
          <div className="glass flex h-full flex-col items-center justify-center gap-4 rounded-2xl p-6 text-center">
            <p className="text-white/70">Vous avez tout vu !</p>
            <button
              onClick={restart}
              className="glass-pill min-h-11 rounded-full px-6 py-2 text-sm text-white"
            >
              Revoir les films passés
            </button>
          </div>
        )}

        {!exhausted && !topMovie && (
          <p className="flex h-full items-center justify-center text-sm text-white/50">Chargement…</p>
        )}

        {nextMovie && (
          <div className="absolute inset-0 scale-95 opacity-60">
            <SwipeCard movie={nextMovie} />
          </div>
        )}

        {topMovie && (
          <motion.div
            key={topMovie.id}
            className="absolute inset-0 cursor-grab active:cursor-grabbing"
            style={{ x, rotate }}
            drag="x"
            dragSnapToOrigin
            onDragEnd={handleDragEnd}
          >
            <SwipeCard movie={topMovie} />
            <motion.div
              style={{ opacity: likeOpacity }}
              className="glass-pill glass-pill-active pointer-events-none absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-bold text-white"
            >
              J'aime
            </motion.div>
            <motion.div
              style={{ opacity: passOpacity }}
              className="glass-pill pointer-events-none absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-bold text-white"
            >
              Passer
            </motion.div>
          </motion.div>
        )}
      </div>

      <div className="mt-6 flex gap-6">
        <button
          onClick={() => decide('dislike')}
          disabled={!topMovie}
          aria-label="Passer ce film"
          className="glass-pill flex h-14 w-14 items-center justify-center rounded-full text-white/80 disabled:opacity-30"
        >
          <X size={24} aria-hidden="true" />
        </button>
        <button
          onClick={() => decide('like')}
          disabled={!topMovie}
          aria-label="Ajouter à ma liste"
          className="glass-pill glass-pill-active flex h-14 w-14 items-center justify-center rounded-full text-white disabled:opacity-30"
        >
          <Heart size={24} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
