export interface Mood {
  id: string;
  label: string;
  genreIds: number[];
}

// Genre id reference: Action 28, Adventure 12, Animation 16, Comedy 35,
// Crime 80, Documentary 99, Drama 18, Family 10751, Fantasy 14, History 36,
// Horror 27, Music 10402, Mystery 9648, Romance 10749, Science Fiction 878,
// TV Movie 10770, Thriller 53, War 10752, Western 37.
export const MOODS: Mood[] = [
  { id: 'leger', label: 'Léger', genreIds: [35, 16, 10751] },
  { id: 'intense', label: 'Intense', genreIds: [53, 28, 80] },
  { id: 'nostalgique', label: 'Nostalgique', genreIds: [18, 36, 10402] },
  { id: 'feel-good', label: 'Feel-good', genreIds: [10749, 35, 10751] },
];
