import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { Star } from 'lucide-react';
import { profileStore } from '../stores/profileStore';
import { getToWatchMovies, pickWeighted } from '../lib/toWatch';
import { discoverMovies, tmdbImageUrl, type TMDBMovie, type TMDBMovieDetail } from '../lib/tmdb';
import { topGenres, excludeSwiped, excludeWatched } from '../lib/recommend';

type Company = 'solo' | 'groupe';
type Energy = 'calme' | 'intense';
type Length = 'court' | 'long';

// Mirrors the mood-pill mapping in lib/moods.ts, phrased for this quiz's
// own wording ("calme"/"intense") rather than reusing MOODS directly.
const ENERGY_GENRES: Record<Energy, number[]> = {
  calme: [18, 10751, 10749, 16], // Drame, Famille, Romance, Animation
  intense: [53, 28, 27, 80], // Thriller, Action, Horreur, Crime
};

interface Answers {
  company: Company | null;
  energy: Energy | null;
  length: Length | null;
}

function fitsLength(runtime: number, length: Length): boolean {
  return length === 'court' ? runtime < 100 : runtime >= 100;
}

export default function TonightAssistant() {
  const profile = useStore(profileStore);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({ company: null, energy: null, length: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [result, setResult] = useState<TMDBMovie | TMDBMovieDetail | null>(null);

  async function reveal(finalAnswers: Answers) {
    setLoading(true);
    setError(false);
    try {
      const genreIds = ENERGY_GENRES[finalAnswers.energy!];
      const preferred = topGenres(profile, 2);

      const toWatch = await getToWatchMovies(profile);
      const matching = toWatch.filter(
        (m) =>
          fitsLength(m.runtime, finalAnswers.length!) &&
          m.genres.some((g) => genreIds.includes(g.id))
      );
      if (matching.length > 0) {
        setResult(pickWeighted(matching, profile));
        return;
      }

      const { minRuntime, maxRuntime } = finalAnswers.length === 'court' ? { minRuntime: undefined, maxRuntime: 100 } : { minRuntime: 100, maxRuntime: undefined };
      const discovered = await discoverMovies(
        {
          genres: genreIds,
          genreMatch: 'any',
          minRuntime,
          maxRuntime,
          minVoteCount: finalAnswers.company === 'groupe' ? 300 : undefined,
          sortBy: finalAnswers.company === 'groupe' ? 'popularity.desc' : 'vote_average.desc',
        },
        1
      );
      const filtered = excludeWatched(excludeSwiped(discovered.results, profile), profile);
      setResult(pickWeighted(filtered.length > 0 ? filtered : discovered.results, profile));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function choose<K extends keyof Answers>(key: K, value: NonNullable<Answers[K]>) {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    if (step < 2) {
      setStep(step + 1);
    } else {
      reveal(next);
    }
  }

  function restart() {
    setStep(0);
    setAnswers({ company: null, energy: null, length: null });
    setResult(null);
    setError(false);
  }

  const poster = result ? tmdbImageUrl(result.poster_path, 'w342') : null;

  return (
    <div className="px-4 py-6 md:px-8">
      <h1 className="font-display text-2xl tracking-tight">Ce soir on regarde quoi ?</h1>
      <p className="mt-1 text-sm text-white/60">Trois questions, une seule suggestion — pas de liste à explorer.</p>

      {!loading && !result && !error && (
        <div className="mt-8 max-w-md">
          {step === 0 && (
            <>
              <p className="mb-3 text-lg text-white/90">Vous regardez seul ou à plusieurs ?</p>
              <div className="flex gap-3">
                <button onClick={() => choose('company', 'solo')} className="glass-pill min-h-11 flex-1 rounded-full px-4 py-3 text-sm font-semibold text-white">
                  Seul
                </button>
                <button onClick={() => choose('company', 'groupe')} className="glass-pill min-h-11 flex-1 rounded-full px-4 py-3 text-sm font-semibold text-white">
                  À plusieurs
                </button>
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <p className="mb-3 text-lg text-white/90">Plutôt calme ou intense ?</p>
              <div className="flex gap-3">
                <button onClick={() => choose('energy', 'calme')} className="glass-pill min-h-11 flex-1 rounded-full px-4 py-3 text-sm font-semibold text-white">
                  Calme
                </button>
                <button onClick={() => choose('energy', 'intense')} className="glass-pill min-h-11 flex-1 rounded-full px-4 py-3 text-sm font-semibold text-white">
                  Intense
                </button>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <p className="mb-3 text-lg text-white/90">Court ou long ?</p>
              <div className="flex gap-3">
                <button onClick={() => choose('length', 'court')} className="glass-pill min-h-11 flex-1 rounded-full px-4 py-3 text-sm font-semibold text-white">
                  Court (&lt; 1h40)
                </button>
                <button onClick={() => choose('length', 'long')} className="glass-pill min-h-11 flex-1 rounded-full px-4 py-3 text-sm font-semibold text-white">
                  Long
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {loading && <p className="mt-8 text-sm text-white/50">On cherche…</p>}
      {error && <p className="mt-8 text-sm text-white/50">Impossible de trouver une suggestion, réessayez.</p>}

      {!loading && result && (
        <div className="glass mt-8 flex max-w-md flex-col items-center gap-4 rounded-2xl p-6 text-center">
          <p className="text-sm text-white/60">Ce soir, regardez :</p>
          <a href={`/movie/${result.id}`} className="block w-40">
            <div className="aspect-[2/3] overflow-hidden rounded-xl bg-surface">
              {poster && <img src={poster} alt="" className="h-full w-full object-cover" />}
            </div>
            <p className="mt-2 font-display text-lg tracking-tight text-white">{result.title}</p>
            <p className="mt-0.5 flex items-center justify-center gap-1 text-xs text-white/60">
              <Star size={12} className="fill-current text-accent" aria-hidden="true" />
              {result.vote_average.toFixed(1)}
            </p>
          </a>
          <button onClick={restart} className="glass-pill min-h-11 rounded-full px-6 py-2 text-sm text-white">
            Recommencer
          </button>
        </div>
      )}
    </div>
  );
}
