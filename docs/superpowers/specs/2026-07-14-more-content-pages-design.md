# Design : Accueil enrichi, pages catégories, Tops, pages Réalisateur/Acteur

Date : 2026-07-14
Statut : Approuvé

## 1. Contexte

Suite au MVP (voir `2026-07-13-cinema-pwa-design.md`), l'utilisateur veut :
- voir plus de films sur la page d'accueil ;
- des pages dédiées avec une vraie pagination pour explorer des listes complètes ;
- des listes "tops" (mieux notés, par genre, de l'année) ;
- pouvoir consulter la filmographie d'un réalisateur (ou d'un acteur) en particulier.

Toujours aucun backend : tout reste TMDB + fetch client-side, dans l'architecture Astro/React existante.

## 2. Nouvelles fonctions TMDB (`src/lib/tmdb.ts`)

```ts
getPopular(page, signal)      // GET /movie/popular
getTopRated(page, signal)     // GET /movie/top_rated
getNowPlaying(page, signal)   // GET /movie/now_playing
getTrendingPaged(page, signal)   // variante paginée de getTrending existant
getUpcomingPaged(page, signal)   // variante paginée de getUpcoming existant
discoverMovies(params, page, signal)  // étendre la signature existante avec un `page`
getPersonDetail(id, signal)   // GET /person/{id}
getPersonMovieCredits(id, signal) // GET /person/{id}/movie_credits
```

Toutes les fonctions de liste renvoient déjà `TMDBListResponse<T>` — on étend ce type avec `page`, `total_pages` (présents dans la réponse TMDB, juste pas mappés aujourd'hui) pour piloter la pagination.

`discoverMovies` et les endpoints paginés acceptent un paramètre `page` optionnel (défaut 1) pour rester compatibles avec les appels existants (SearchExplorer, MovieRow).

## 3. Page d'accueil (`src/pages/index.astro`)

Ajout de 3 lignes `MovieRow` supplémentaires (Populaires, Mieux notés, Au cinéma), en plus de Recommandé/Tendances/Prochainement existants. `MovieRow` gagne un lien "Voir tout →" en en-tête de section, pointant vers `/films/<slug-catégorie>`.

```
Recommandé pour vous
Tendances du jour        → Voir tout
Au cinéma                → Voir tout
Populaires                → Voir tout
Mieux notés                → Voir tout
Prochainement              → Voir tout
```

## 4. Pages catégories paginées (`/films/[category]`)

Route Astro statique (`getStaticPaths` avec la liste fixe des 5 slugs : `tendances`, `au-cinema`, `populaires`, `mieux-notes`, `prochainement`) — pas besoin de rendu à la demande puisque les slugs sont connus au build.

Contenu : un nouvel îlot React `CategoryGrid` (calqué sur `SearchExplorer` pour la grille responsive) qui :
- lit le numéro de page depuis `window.location.search` (`?page=N`, défaut 1) au montage ;
- appelle la fonction TMDB correspondant au slug ;
- affiche la grille (2 → 6 colonnes responsive, réutilise `MovieCard`) ;
- affiche des contrôles de pagination en bas : bouton précédent/suivant + numéro de page courant / total, sous forme de vrais liens `<a href="?page=N">` (pas de gestion d'historique JS custom) pour que la page soit partageable/bookmarkable et fonctionne sans JS pour la navigation (le fetch, lui, nécessite JS).
- `total_pages` de TMDB est plafonné à 500 côté API ; on respecte cette limite (désactive "suivant" au-delà).

## 5. Page Tops (`/tops`)

Nouvel îlot `TopsExplorer`, dans le même esprit que `SearchExplorer` :
- 3 onglets : **Mieux notés** (`getTopRated`), **Top par genre** (sélecteur de genre → `discoverMovies({ genres: [id] }, page)` trié par `vote_average.desc`), **Top de l'année** (`discoverMovies({ year: anneeCourante }, page)` trié par `vote_average.desc`).
- Pour les deux onglets basés sur `discover`, ajout d'un plancher `vote_count.gte=300` (nouveau champ optionnel `minVoteCount` dans `DiscoverParams`/`buildDiscoverQuery`) pour éviter que des films avec 1-2 votes à 10/10 dominent le classement.
- Réutilise la même pagination `?page=N` que `/films/[category]`, avec l'onglet actif encodé dans un paramètre `?tab=` en plus de `?page=`.

## 6. Pages Réalisateur/Acteur (`/personne/[id]`)

Route générique (fonctionne pour n'importe quelle personne TMDB, pas seulement les réalisateurs). Comme `/movie/[id]`, l'id n'est pas connu au build : `export const prerender = false`, rendu à la demande via l'adaptateur Vercel déjà en place.

Nouvel îlot `PersonDetail` :
- `getPersonDetail(id)` → photo, nom, biographie (tronquée avec un "Lire plus" si > ~400 caractères) ;
- `getPersonMovieCredits(id)` → sépare `crew` filtré sur `job === 'Director'` et `cast`, chacun trié par `release_date` décroissante, affichés en deux grilles (`MovieCard`) sous les titres "Réalisateur" / "Acteur" (une section est masquée si vide) ;
- gestion d'erreur identique aux autres îlots (état "Impossible de charger" sans crash de page).

**Liens vers cette page**, dans `MovieDetail.tsx` :
- le nom du réalisateur (actuellement texte brut, absent de l'affichage — à ajouter dans le bloc méta sous le titre) devient `<a href="/personne/{id}">`;
- chaque membre du casting devient cliquable vers `/personne/{id}` (actuellement juste `<div>`).

## 7. Navigation

`src/lib/navItems.ts` : ajout d'une 4ᵉ entrée `{ href: '/tops', label: 'Tops', icon: '🏆' }`. La bottom nav mobile passe de 3 à 4 items (toujours ≤ 5, seuil usuel pour rester lisible en barre de tabs).

## 8. Robustesse & cas limites

- Films sans réalisateur crédité (`credits.crew` sans entrée `job === 'Director'`) : pas de lien réalisateur affiché.
- Personne sans photo (`profile_path: null`) : même fallback visuel que les posters/avatars manquants ailleurs dans l'app.
- Page demandée au-delà de `total_pages` (ex. `?page=999` sur une catégorie qui n'a que 40 pages) : TMDB renvoie un tableau vide plutôt qu'une erreur — l'îlot affiche l'état "Rien à afficher" déjà utilisé dans `MovieRow`, pas de crash.
- `?page=` non numérique ou négatif : normalisé à 1 côté client avant l'appel TMDB.

## 9. Tests

- Vitest sur les nouvelles fonctions pures : `buildDiscoverQuery` avec `minVoteCount` et `page`, construction des slugs `/films/[category]` → fonction TMDB.
- Pas de nouveaux tests Playwright dédiés au-delà de la vérification manuelle habituelle (parcours clé : accueil → voir tout → pagination → fiche film → réalisateur → filmographie).

## 10. Hors périmètre

- Pages "Tops" personnalisées basées sur les favoris/scores de l'utilisateur (ex. "vos genres préférés notés") — resterait dans `recommend.ts`, pas demandé ici.
- Filmographie des équipes techniques autres que réalisateur (scénariste, compositeur, etc.) — uniquement réalisateur + acteur pour l'instant.
- Infinite scroll — pagination par numéros de page choisie explicitement (voir §4) plutôt que chargement automatique au scroll.
