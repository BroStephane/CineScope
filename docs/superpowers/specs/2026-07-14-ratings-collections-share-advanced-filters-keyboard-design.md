# Design : Notes personnelles, collections, partage, filtres avancés, raccourcis clavier

Date : 2026-07-14
Statut : Approuvé (décisions prises par Claude seul, toujours front-end — voir mémoire `feedback_user_autonomy`)

## 1. Contexte

Quatrième lot de fonctionnalités demandé, toujours décidé et implémenté sans backend (TMDB + `localStorage` uniquement). Cinq fonctionnalités retenues, choisies pour combler des manques réels sans dupliquer l'existant (favoris, à voir, historique, swipe, export/import, filtres genre/année/note/tri) :

1. **Note personnelle (1 à 5 étoiles)** sur un film, en plus du binaire "vu"/"pas vu".
2. **Collections/franchises TMDB** (ex. "Toy Story Collection") sur la fiche film.
3. **Partager un film** (Web Share API + repli presse-papiers).
4. **Filtres de recherche avancés** : langue originale, durée.
5. **Raccourcis clavier** (flèches gauche/droite) sur l'écran Découverte, en plus du geste de swipe et des boutons.

## 2. Note personnelle (1-5 étoiles)

Nouvelle dimension de profil : `ratings?: Record<number, number>` (id de film → note 1-5), distincte de `watched` (qui reste binaire). Contrairement aux autres actions (favoris, vu, swipe) qui sont des bascules discrètes, une note est une valeur qu'on peut changer d'avis dessus — le score de genre doit donc refléter la note *actuelle*, pas s'accumuler à chaque nouvelle notation.

```ts
export function recordRating(profile: ProfileScores, movieId: number, rating: number, genreIds: number[]): ProfileScores {
  const ratings = { ...(profile.ratings ?? {}) };
  const previous = ratings[movieId] ?? 0;
  const delta = rating - previous;
  const genres = { ...profile.genres };
  for (const id of genreIds) {
    genres[id] = (genres[id] ?? 0) + delta;
  }
  ratings[movieId] = rating;
  return { ...profile, genres, ratings };
}

export function removeRating(profile: ProfileScores, movieId: number, genreIds: number[]): ProfileScores {
  const ratings = { ...(profile.ratings ?? {}) };
  const previous = ratings[movieId];
  if (previous === undefined) return profile;
  delete ratings[movieId];
  const genres = { ...profile.genres };
  for (const id of genreIds) {
    genres[id] = (genres[id] ?? 0) - previous;
  }
  return { ...profile, genres, ratings };
}
```

Le poids en points de genre est directement la note (1 à 5) — une note de 5 pèse autant qu'un favori (+5/genre), une note de 1 pèse à peine plus qu'une simple visite (+1/genre). C'est cohérent avec l'échelle déjà en place (vue = 1, swipe-like = 2, vu = 3, favori = 5).

**UI** : sur `MovieDetail.tsx`, un petit widget de 5 étoiles (icône `Star` de `lucide-react`, répétée) sous les boutons favori/vu. Cliquer une étoile note le film à cette valeur ; cliquer l'étoile déjà sélectionnée efface la note (`removeRating`). `profileStore.ts` expose `rateMovie(movieId, rating, genreIds)` / `unrateMovie(movieId, genreIds)`.

Pas de nouvelle section sur la page Profil (éviterait une 4ᵉ grille de films quasi redondante) : à la place, une ligne de statistique compacte sous "Genres préférés" — "X films notés, moyenne Y★" — calculée depuis `profile.ratings`.

## 3. Collections / franchises TMDB

TMDB inclut déjà `belongs_to_collection: { id, name, poster_path, backdrop_path } | null` dans la réponse de base de `/movie/{id}` (pas besoin d'`append_to_response`). Nouveau type dans `tmdb.ts` :

```ts
export interface TMDBCollectionSummary {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
}
```

ajouté à `TMDBMovieDetail`. Nouvelle fonction :

```ts
export interface TMDBCollection {
  id: number;
  name: string;
  overview: string;
  parts: TMDBMovie[];
}

export function getCollection(id: number, signal?: AbortSignal): Promise<TMDBCollection> {
  return tmdbFetch(`/collection/${id}`, {}, signal);
}
```

**UI** : sur `MovieDetail.tsx`, si `movie.belongs_to_collection` existe, un nouvel effet charge la collection complète (`getCollection`) et affiche une section "Fait partie de : {name}" avec une grille des films de la collection (même motif que "Films similaires"), en excluant le film actuellement affiché de la grille.

## 4. Partager un film

Bouton "Partager" à côté des boutons favori/vu/notation sur `MovieDetail.tsx`, icône `Share2` de `lucide-react`. Utilise l'API Web Share native si disponible (`navigator.share`), avec repli sur la copie du lien dans le presse-papiers (`navigator.clipboard.writeText`) et un message de confirmation temporaire ("Lien copié !", même pattern `aria-live="polite"` que les autres confirmations de l'app). Partage le titre du film, un court texte, et l'URL de la page actuelle (`window.location.href`).

## 5. Filtres de recherche avancés (langue, durée)

`DiscoverParams` (dans `tmdb.ts`) gagne `originalLanguage?: string`, `minRuntime?: number`, `maxRuntime?: number`, mappés respectivement sur les paramètres TMDB `with_original_language`, `with_runtime.gte`, `with_runtime.lte` (tous deux supportés nativement par `/discover/movie`).

Dans `SearchExplorer.tsx` : deux nouveaux sélecteurs à côté de "Note minimum"/"Année" — **Langue** (liste courte et pertinente : Français, Anglais, Espagnol, Italien, Allemand, Japonais, Coréen, Hindi, Mandarin) et **Durée** (Moins de 90 min / 90–120 min / Plus de 120 min, mappé sur des paires min/max cohérentes). Comptent dans `hasActiveFilters`/`resetFilters` comme les autres filtres.

## 6. Raccourcis clavier (Découverte)

Sur `SwipeDeck.tsx`, un `useEffect` ajoute un écouteur `keydown` global : Flèche gauche → `decide('dislike')`, Flèche droite → `decide('like')` (uniquement si une carte est affichée). N'interfère pas avec la saisie clavier ailleurs sur la page (l'app n'a pas de champ de texte sur cette route). Un indice discret sous les boutons ("Utilisez ← / → au clavier") signale la fonctionnalité, masqué visuellement sur mobile (`hidden md:block`, cohérent avec le fait que les flèches clavier ne concernent que desktop).

## 7. Robustesse & cas limites

- Profils `localStorage` antérieurs à `ratings` : migrés silencieusement à `{}` (même garde-fou que `swipedLiked`/`watched`), y compris pour l'import d'une sauvegarde plus ancienne.
- `navigator.share` absent (desktop, navigateurs non compatibles) : repli automatique sur le presse-papiers, jamais d'erreur visible.
- Film sans collection (`belongs_to_collection: null`, cas le plus fréquent) : aucune section affichée, aucun appel réseau superflu.
- Film sans note attribuée : le widget d'étoiles affiche 5 étoiles vides, aucune erreur.
- Combinaison filtre langue + durée + genres + année + note : tous cumulables, comme les filtres existants (juste des paramètres `discover` supplémentaires).

## 8. Tests

- Vitest : `recordRating`/`removeRating` (y compris le cas "changer d'avis" : noter 3 puis 5 ne doit ajouter que +2, pas +5) dans `tests/recommend.test.ts`.
- Vitest : `rateMovie`/`unrateMovie` (persistance, migration `ratings` manquant) dans `tests/profileStore.test.ts`.
- Vitest : `buildDiscoverQuery` avec `originalLanguage`/`minRuntime`/`maxRuntime` dans `tests/tmdb.test.ts`.
- Pas de nouveaux tests Playwright dédiés au-delà de la vérification manuelle habituelle (parcours : noter un film → voir la moyenne sur le profil → fiche d'un film à collection → partager → recherche avec langue/durée → raccourcis clavier sur Découverte).

## 9. Hors périmètre

- Historique de notes changées dans le temps — seule la note actuelle est conservée.
- Partage d'une liste entière (favoris, à voir) — uniquement un film à la fois pour l'instant.
- Filtre de durée à curseur continu — trois tranches prédéfinies suffisent, plus simple à utiliser sur mobile qu'un double-curseur.
- Raccourcis clavier ailleurs dans l'app (recherche, tops) — resserré à Découverte, seul endroit où l'interaction principale (swiper) a un équivalent clavier naturel (gauche/droite).
