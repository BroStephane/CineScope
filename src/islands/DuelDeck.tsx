import { useEffect, useReducer } from 'react';
import { useStore } from '@nanostores/react';
import { Star, Swords } from 'lucide-react';
import { profileStore } from '../stores/profileStore';
import { getToWatchMovies } from '../lib/toWatch';
import { tmdbImageUrl, type TMDBMovieDetail } from '../lib/tmdb';

const MAX_ENTRANTS = 16;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface DuelState {
  status: 'loading' | 'error' | 'insufficient' | 'playing' | 'done';
  queue: TMDBMovieDetail[];
  nextRoundQueue: TMDBMovieDetail[];
  current: [TMDBMovieDetail, TMDBMovieDetail] | null;
  champion: TMDBMovieDetail | null;
}

const initialState: DuelState = {
  status: 'loading',
  queue: [],
  nextRoundQueue: [],
  current: null,
  champion: null,
};

// Draws the next matchup from `queue`, promoting `nextRoundQueue` into a new
// round (and resolving byes) whenever the current round runs out — a light
// single-elimination bracket run as a flat queue rather than a fixed tree,
// so it works with any pool size, not just powers of two.
function drawMatchup(queue: TMDBMovieDetail[], nextRoundQueue: TMDBMovieDetail[]): DuelState {
  let q = queue;
  let nrq = nextRoundQueue;
  for (;;) {
    if (q.length >= 2) {
      const [a, b, ...rest] = q;
      return { status: 'playing', queue: rest, nextRoundQueue: nrq, current: [a, b], champion: null };
    }
    if (q.length === 1) {
      nrq = [...nrq, q[0]];
      q = [];
    }
    if (nrq.length <= 1) {
      return { status: 'done', queue: [], nextRoundQueue: [], current: null, champion: nrq[0] ?? null };
    }
    q = shuffle(nrq);
    nrq = [];
  }
}

type DuelAction = { type: 'loaded'; movies: TMDBMovieDetail[] } | { type: 'error' } | { type: 'pick'; winner: TMDBMovieDetail; loser: TMDBMovieDetail } | { type: 'restart' };

function reducer(state: DuelState, action: DuelAction): DuelState {
  switch (action.type) {
    case 'loaded': {
      if (action.movies.length < 2) return { ...initialState, status: 'insufficient' };
      const pool = shuffle(action.movies).slice(0, MAX_ENTRANTS);
      return drawMatchup(pool, []);
    }
    case 'error':
      return { ...initialState, status: 'error' };
    case 'pick': {
      const nextRoundQueue = [...state.nextRoundQueue, action.winner];
      const queue = [...state.queue, action.loser];
      return drawMatchup(queue, nextRoundQueue);
    }
    case 'restart':
      return { ...initialState };
    default:
      return state;
  }
}

function DuelCard({ movie, onPick }: { movie: TMDBMovieDetail; onPick: () => void }) {
  const poster = tmdbImageUrl(movie.poster_path, 'w500');
  return (
    <button onClick={onPick} className="glass-card group w-full overflow-hidden rounded-2xl text-left">
      <div className="aspect-[2/3] w-full overflow-hidden bg-surface">
        {poster ? (
          <img src={poster} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-white/50">Pas d'affiche</div>
        )}
      </div>
      <div className="p-3">
        <p className="font-display text-base tracking-tight text-white">{movie.title}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-white/60">
          {movie.release_date?.slice(0, 4)} · {movie.runtime} min ·
          <Star size={12} className="fill-current text-accent" aria-hidden="true" />
          {movie.vote_average.toFixed(1)}
        </p>
      </div>
    </button>
  );
}

export default function DuelDeck() {
  const profile = useStore(profileStore);
  const [state, dispatch] = useReducer(reducer, initialState);
  const remaining = state.queue.length + state.nextRoundQueue.length + (state.current ? 2 : 0);

  useEffect(() => {
    let cancelled = false;
    getToWatchMovies(profile)
      .then((movies) => {
        if (!cancelled) dispatch({ type: 'loaded', movies });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'error' });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="px-4 py-6 md:px-8">
      <h1 className="flex items-center gap-2 font-display text-2xl tracking-tight">
        <Swords size={22} className="text-accent" aria-hidden="true" />
        Duel de films
      </h1>
      <p className="mt-1 text-sm text-white/60">
        Deux films de votre liste "à voir" s'affrontent — choisissez celui qui vous tente le plus.
      </p>

      {state.status === 'loading' && <p className="mt-8 text-sm text-white/50">Chargement…</p>}
      {state.status === 'error' && <p className="mt-8 text-sm text-white/50">Impossible de charger votre liste.</p>}
      {state.status === 'insufficient' && (
        <p className="mt-8 text-sm text-white/50">
          Il faut au moins 2 films dans votre liste "à voir" pour lancer un duel — swipez-en quelques-uns dans
          Découverte.
        </p>
      )}

      {state.status === 'playing' && state.current && (
        <>
          <p className="mt-6 text-center text-xs uppercase tracking-wide text-white/40">
            Encore environ {remaining} film{remaining > 1 ? 's' : ''} en lice
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:max-w-xl sm:mx-auto md:gap-6">
            <DuelCard
              movie={state.current[0]}
              onPick={() => dispatch({ type: 'pick', winner: state.current![0], loser: state.current![1] })}
            />
            <DuelCard
              movie={state.current[1]}
              onPick={() => dispatch({ type: 'pick', winner: state.current![1], loser: state.current![0] })}
            />
          </div>
        </>
      )}

      {state.status === 'done' && state.champion && (
        <div className="glass mt-8 flex max-w-md flex-col items-center gap-4 rounded-2xl p-6 text-center">
          <p className="text-sm text-white/60">Le grand gagnant :</p>
          <a href={`/movie/${state.champion.id}`} className="block w-40">
            <div className="aspect-[2/3] overflow-hidden rounded-xl bg-surface">
              {tmdbImageUrl(state.champion.poster_path, 'w342') && (
                <img
                  src={tmdbImageUrl(state.champion.poster_path, 'w342') ?? ''}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <p className="mt-2 font-display text-lg tracking-tight text-white">{state.champion.title}</p>
          </a>
          <button
            onClick={() => dispatch({ type: 'restart' })}
            className="glass-pill min-h-11 rounded-full px-6 py-2 text-sm text-white"
          >
            Nouveau duel
          </button>
        </div>
      )}
    </div>
  );
}
