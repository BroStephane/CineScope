import { useEffect, useState } from 'react';
import MovieCard from '../components/MovieCard';
import {
  getPersonDetail,
  getPersonMovieCredits,
  tmdbImageUrl,
  type TMDBPersonDetail,
  type TMDBPersonMovieCredits,
} from '../lib/tmdb';

const BIOGRAPHY_PREVIEW_LENGTH = 400;

export default function PersonDetail({ personId }: { personId: number }) {
  const [person, setPerson] = useState<TMDBPersonDetail | null>(null);
  const [credits, setCredits] = useState<TMDBPersonMovieCredits | null>(null);
  const [error, setError] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getPersonDetail(personId), getPersonMovieCredits(personId)])
      .then(([personData, creditsData]) => {
        if (cancelled) return;
        setPerson(personData);
        setCredits(creditsData);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [personId]);

  if (error) return <p className="px-4 py-8 text-white/60">Impossible de charger cette page.</p>;
  if (!person || !credits) return <p className="px-4 py-8 text-white/60">Chargement…</p>;

  const photo = tmdbImageUrl(person.profile_path, 'w342');
  const directed = credits.crew
    .filter((c) => c.job === 'Director')
    .sort((a, b) => (b.release_date ?? '').localeCompare(a.release_date ?? ''));
  const acted = [...credits.cast].sort((a, b) => (b.release_date ?? '').localeCompare(a.release_date ?? ''));
  const bioTooLong = person.biography.length > BIOGRAPHY_PREVIEW_LENGTH;
  const bio = bioExpanded || !bioTooLong ? person.biography : `${person.biography.slice(0, BIOGRAPHY_PREVIEW_LENGTH)}…`;

  return (
    <div className="px-4 py-6 md:px-8">
      <div className="flex items-center gap-4">
        <div className="h-32 w-32 shrink-0 overflow-hidden rounded-full bg-surface">
          {photo && <img src={photo} alt="" className="h-full w-full object-cover" />}
        </div>
        <h1 className="font-display text-2xl tracking-tight">{person.name}</h1>
      </div>

      {person.biography && (
        <div className="mt-6 max-w-2xl">
          <p className="whitespace-pre-line text-white/80">{bio}</p>
          {bioTooLong && (
            <button onClick={() => setBioExpanded((v) => !v)} className="mt-2 min-h-11 text-sm text-accent">
              {bioExpanded ? 'Voir moins' : 'Lire plus'}
            </button>
          )}
        </div>
      )}

      {directed.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-body text-xs font-semibold uppercase tracking-[0.14em] text-white/50">Réalisateur</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
            {directed.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        </section>
      )}

      {acted.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-body text-xs font-semibold uppercase tracking-[0.14em] text-white/50">Acteur</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
            {acted.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
