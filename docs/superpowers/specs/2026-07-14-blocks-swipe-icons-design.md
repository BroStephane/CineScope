# Design : Accueil en blocs, recherche à défilement infini, découverte façon "swipe", bibliothèque d'icônes

Date : 2026-07-14
Statut : Approuvé (décisions prises par Claude, sans aller-retour supplémentaire — voir mémoire `feedback_user_autonomy`)

## 1. Contexte

Après la livraison de l'accueil enrichi / pages catégories / Tops / pages Réalisateur-Acteur (voir `2026-07-14-more-content-pages-design.md`), l'utilisateur a demandé, en un seul lot :

1. Remplacer les carrousels défilants de l'accueil par un affichage en blocs (grille statique), tout en gardant la possibilité d'entrer dans chaque section (déjà permis par `/films/[category]`).
2. Sur la page recherche : défilement infini (chargement automatique de films supplémentaires au scroll), amélioration visuelle des filtres, et un tri par (Tendance / Note / Pour vous).
3. Un système de découverte façon "Tinder" : swiper un film pour dire si on veut le voir ou non, avec accès ensuite à sa liste, piloté par un algorithme qui essaie de proposer les films les plus pertinents.
4. Suppression de tous les emojis au profit d'une bibliothèque d'icônes.

L'utilisateur a explicitement demandé de traiter tout cela en un seul lot plutôt qu'en rounds séparés, et de ne plus poser de questions de choix — toutes les décisions ci-dessous sont prises unilatéralement, avec la raison quand elle n'est pas évidente.

Toujours aucun backend : tout reste TMDB + `localStorage`, architecture Astro/React existante.

## 2. Bibliothèque d'icônes : `lucide-react`

**Choix :** `lucide-react` (déjà dans l'écosystème React, tree-shakable, licence MIT, esthétique neutre qui convient au thème sombre existant). Nouvelle dépendance ajoutée à `package.json`.

**Remplacements exhaustifs de tous les emojis/glyphes actuellement dans le code :**

| Emplacement | Avant | Après |
|---|---|---|
| `navItems.ts` + `Header.astro`/`BottomNav.astro` | 🏠 🔍 🏆 👤 | `Home`, `Search`, `Trophy`, `User` (rendus via une map clé→composant) |
| Nouvelle entrée nav "Découverte" | — | `Compass` |
| `Pagination.tsx` | `←` / `→` | `ChevronLeft` / `ChevronRight` (icône + texte conservé) |
| `MovieBlock` (ex-`MovieRow`) lien "Voir tout" | `→` | `ChevronRight` |
| `MovieDetail.tsx` note | `⭐` | `Star` (rempli, 14px, avant la note) |
| `MovieDetail.tsx` bouton favori | `✓` / `+` | `Check` / `Plus` |
| Nouveau : filtres recherche | — | `SlidersHorizontal` (label filtres), `RotateCcw` (réinitialiser) |
| Nouveau : deck de swipe | — | `Heart` (aimer), `X` (passer) |

Astro peut rendre un composant React sans directive `client:*` quand aucune interactivité n'est nécessaire (rendu HTML/SVG statique uniquement) — utilisé pour les icônes dans `Header.astro`/`BottomNav.astro`, qui restent des fichiers `.astro` non hydratés.

## 3. Accueil : blocs au lieu de carrousel

Le composant `MovieRow` est renommé `MovieBlock` (le nom "row" est trompeur une fois que ce n'est plus un défilement horizontal). Son rendu passe de `flex overflow-x-auto` à la même grille responsive que la recherche (`grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6`), plafonné aux **10 premiers résultats** de la page 1 (au-delà, l'utilisateur clique "Voir tout" vers `/films/<slug>`, qui a déjà la pagination complète). Le lien "Voir tout" existant est conservé tel quel, seule l'icône change.

`index.astro` : mêmes 5 sections qu'aujourd'hui (Tendances, Au cinéma, Populaires, Mieux notés, Prochainement) + `RecommendedRow`, seul le composant sous-jacent change.

## 4. Recherche : défilement infini, tri, filtres améliorés

### 4.1 Tri (`sortMode`)

Trois modes, exclusifs, pilotés par un nouveau sélecteur "Trier par" :
- **Tendance** (défaut) : `sort_by=popularity.desc` — comportement actuel de `discoverMovies`.
- **Note** : `sort_by=vote_average.desc` + `vote_count.gte=300` (même garde-fou que la page Tops, réutilise `minVoteCount`) pour éviter qu'un film à 2 votes de 10/10 remonte en premier.
- **Pour vous** : ignore les genres cochés manuellement, utilise `topGenres(profile, 2)` (déjà utilisé par `RecommendedRow`) et `excludeFavorites`. Si le profil n'a aucun score de genre (utilisateur neuf), affiche le message "Explorez des films pour activer cette option" (même formulation que dans `ProfileView`) au lieu de résultats.

Le champ de recherche texte reste prioritaire : dès qu'une requête texte est saisie, `searchMovies` (ordre de pertinence TMDB, pas de tri custom possible côté API) est utilisé et le sélecteur "Trier par" est masqué (incompatible avec l'endpoint `/search/movie`).

### 4.2 Défilement infini

Remplace le fetch unique par une accumulation de pages : un état `movies: TMDBMovie[]` qui s'accumule (`setMovies((prev) => [...prev, ...nouvelle_page])`), un `page` incrémenté, et un élément sentinelle en bas de la grille observé via `IntersectionObserver` — quand il devient visible, on charge `page + 1` (si `page < total_pages`). Tout changement de requête/genre/année/note/tri réinitialise `movies`, `page` à 1 et débranche puis rebranche l'observer.

### 4.3 Filtres — réorganisation visuelle

Structure en 2 lignes sous le champ de recherche, avec une icône `SlidersHorizontal` en tête de section :
- Ligne 1 : sélecteur "Trier par" (masqué si recherche texte active).
- Ligne 2 : chips de genre (masqués si `sortMode === 'pour-vous'`, puisque les genres sont alors implicites), puis sélecteurs Année et Note minimum, group és visuellement.
- Un bouton "Réinitialiser" (icône `RotateCcw`) apparaît dès qu'au moins un filtre diffère de son défaut (genre choisi, année choisie, note choisie, ou tri ≠ Tendance) et remet tout à zéro en un clic.

## 5. Découverte façon "swipe" (nouvelle fonctionnalité)

### 5.1 Nouvelle route et composant

`src/pages/decouverte.astro` (statique) + îlot `src/islands/SwipeDeck.tsx`. Nouvelle entrée de navigation `{ href: '/decouverte', label: 'Découverte', icon: 'compass' }`, insérée entre Recherche et Tops (5 entrées au total dans la nav, encore dans la limite de lisibilité de 5 déjà documentée dans le design PWA original).

### 5.2 Pool de candidats et algorithme

- Si `topGenres(profile, 2)` est non vide : `discoverMovies({ genres, sortBy: 'popularity.desc' }, page)`.
- Sinon (profil neuf) : `getPopular(page)`.
- Exclusion systématique des films déjà dans `profile.favorites`, `profile.swipedLiked`, `profile.swipedDisliked`.
- Un tampon (`buffer`) de candidats est maintenu ; quand il descend sous 5 cartes, la page suivante est chargée et ajoutée (après filtrage des exclusions). Plafond de sécurité `MAX_SWIPE_PAGES = 20` pour ne pas boucler indéfiniment si le catalogue filtré s'épuise — au-delà, écran de fin "Vous avez tout vu" avec un bouton "Revoir les films passés" qui vide uniquement `swipedDisliked` (les "j'aime" restent acquis) et relance la pagination à 1.
- Les données de genre nécessaires au scoring viennent directement de `genre_ids` (déjà présent sur `TMDBMovie` dans les réponses `/discover` et `/popular`), donc **aucun appel détail par carte** n'est nécessaire.

### 5.3 Interaction de swipe

- Carte du dessus glissable horizontalement via `framer-motion` (`drag="x"`, déjà une dépendance du projet), avec un badge "J'aime"/"Passer" qui apparaît en fonction du sens et de l'amplitude du glissement (via une `useTransform` sur la position x).
- Seuil de décision : ± 120px ou vélocité de relâchement suffisante → anime la sortie de la carte puis déclenche la décision.
- **Accessibilité** : le geste seul n'est pas accessible au clavier. Deux boutons sous la pile (`X` = passer, `Heart` = aimer) déclenchent exactement la même logique de décision, toujours visibles.
- `prefers-reduced-motion` : reprend la même détection globale que le reste de l'app (voir spec MVP §8) — désactive l'animation de glissement, la décision reste utilisable via les boutons uniquement.

### 5.4 Effet d'une décision

- **Aimer** : ajoute l'id à `profile.swipedLiked` (dédupliqué), +2 points à chaque genre de `genre_ids` (entre le poids d'une simple vue et celui d'un favori explicite).
- **Passer** : ajoute l'id à `profile.swipedDisliked` (dédupliqué), aucun impact sur les scores — sert uniquement à ne plus proposer ce film.

### 5.5 Extension du store de profil

`ProfileScores` (dans `recommend.ts`) gagne deux champs : `swipedLiked: number[]`, `swipedDisliked: number[]`. Nouvelles fonctions pures : `recordSwipeLike(profile, movieId, genreIds)`, `recordSwipeDislike(profile, movieId)`, symétriques à `recordFavorite`/`unfavorite`.

**Migration des profils déjà stockés en `localStorage`** (l'app est déjà utilisée) : `isValidProfile` dans `profileStore.ts` ne doit pas rejeter un profil existant qui n'a pas encore ces deux champs — une fonction `normalizeProfile` complète `swipedLiked`/`swipedDisliked` à `[]` s'ils sont absents, avant validation finale, pour ne pas faire perdre favoris/scores existants aux utilisateurs déjà en place.

### 5.6 Accès à la liste ("À voir")

Plutôt qu'une page dédiée séparée, la liste des films aimés par swipe est ajoutée comme une nouvelle section dans `/profile` (déjà le "hub" des données personnelles), sous la section "Mes favoris" : titre "À voir", même pattern de chargement que les favoris (`Promise.allSettled` sur `getMovieDetail`, pas de cache offline dédié puisque ce n'est pas demandé pour cette liste), même grille de `MovieCard`.

## 6. Robustesse & cas limites

- Profil déjà stocké sans `swipedLiked`/`swipedDisliked` → migré silencieusement à `[]` (voir §5.5), jamais réinitialisé.
- Pool de candidats épuisé après `MAX_SWIPE_PAGES` → écran de fin dédié, pas de crash, action de récupération explicite (§5.2).
- `sortMode: 'pour-vous'` sans scores de genre → message explicite, pas de requête `discover` lancée inutilement.
- Défilement infini : la sentinelle n'observe/re-fetch que si `page < total_pages` (même logique de plafond que `Pagination.tsx`, `MAX_TMDB_PAGE = 500`) — pas de boucle de fetch une fois la dernière page atteinte.
- `prefers-reduced-motion` sur le deck de swipe : boutons toujours fonctionnels, seule l'animation de drag est coupée.

## 7. Tests

- Vitest : nouvelles fonctions pures `recordSwipeLike`/`recordSwipeDislike` (scores, dédoublonnage) et `normalizeProfile` (complète les champs manquants sans toucher aux champs existants) dans `tests/recommend.test.ts`/`tests/profileStore.test.ts`.
- Pas de nouveaux tests Playwright dédiés au-delà de la vérification manuelle habituelle (parcours : accueil en blocs → catégorie → recherche avec scroll infini et tri → swipe (like + dislike + bouton) → profil → section "À voir").

## 8. Hors périmètre

- Score négatif sur "Passer" (l'algorithme ne fait qu'exclure, il ne pénalise pas les genres du film passé) — non demandé, ajouterait de la complexité algorithmique non spécifiée.
- Page dédiée séparée pour la liste "À voir" — regroupée dans `/profile` par simplicité (voir §5.6).
- Undo (annuler un swipe) — non demandé.
- Bibliothèque de swipe tierce (ex. `react-tinder-card`) — `framer-motion` est déjà une dépendance du projet et suffit (`drag="x"` + `useTransform`), pas de nouvelle dépendance de plus que `lucide-react`.
