import type { TMDBMovieDetail } from './tmdb';
import type { ProfileScores } from './recommend';

export interface AchievementContext {
  profile: ProfileScores;
  // Full detail needed for release-date-based checks (profile only stores ids).
  watchedMovies: TMDBMovieDetail[];
}

export interface Achievement {
  id: string;
  emoji: string;
  label: string;
  description: string;
  isUnlocked: (ctx: AchievementContext) => boolean;
}

const OLD_MOVIE_THRESHOLD_YEARS = 50;

function distinctGenreCount(profile: ProfileScores): number {
  return Object.values(profile.genres).filter((score) => score > 0).length;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-watch',
    emoji: '🎬',
    label: 'Premier film',
    description: 'Marquez un film comme vu.',
    isUnlocked: ({ profile }) => (profile.watched?.length ?? 0) >= 1,
  },
  {
    id: 'cinephile',
    emoji: '🍿',
    label: 'Cinéphile',
    description: '25 films vus.',
    isUnlocked: ({ profile }) => (profile.watched?.length ?? 0) >= 25,
  },
  {
    id: 'grand-cinephile',
    emoji: '🏆',
    label: 'Grand cinéphile',
    description: '100 films vus.',
    isUnlocked: ({ profile }) => (profile.watched?.length ?? 0) >= 100,
  },
  {
    id: 'explorer',
    emoji: '🎭',
    label: 'Explorateur de genres',
    description: '8 genres différents explorés.',
    isUnlocked: ({ profile }) => distinctGenreCount(profile) >= 8,
  },
  {
    id: 'critic',
    emoji: '⭐',
    label: 'Critique',
    description: '10 films notés.',
    isUnlocked: ({ profile }) => Object.keys(profile.ratings ?? {}).length >= 10,
  },
  {
    id: 'collector',
    emoji: '❤️',
    label: 'Collectionneur',
    description: '20 favoris.',
    isUnlocked: ({ profile }) => profile.favorites.length >= 20,
  },
  {
    id: 'curious',
    emoji: '🔮',
    label: 'Curieux',
    description: '50 films swipés dans Découverte.',
    isUnlocked: ({ profile }) =>
      (profile.swipedLiked?.length ?? 0) + (profile.swipedDisliked?.length ?? 0) >= 50,
  },
  {
    id: 'archaeologist',
    emoji: '🕰️',
    label: 'Archéologue',
    description: `Un film vu sorti il y a plus de ${OLD_MOVIE_THRESHOLD_YEARS} ans.`,
    isUnlocked: ({ watchedMovies }) =>
      watchedMovies.some((m) => {
        const year = m.release_date ? Number(m.release_date.slice(0, 4)) : NaN;
        return !Number.isNaN(year) && new Date().getFullYear() - year >= OLD_MOVIE_THRESHOLD_YEARS;
      }),
  },
];
