# Design : Où regarder, films similaires, historique de vus, sauvegarde locale, filtre multi-genres

Date : 2026-07-14
Statut : Approuvé (décisions prises par Claude seul, sans backend — voir mémoire `feedback_user_autonomy`)

## 1. Contexte

L'utilisateur a demandé d'ajouter d'autres fonctionnalités, décidées et implémentées librement, à condition de rester strictement front-end (TMDB + `localStorage`, toujours aucun backend). Cinq fonctionnalités ont été retenues, chacune réalisable uniquement avec l'API TMDB existante et le store de profil local déjà en place :

1. **Où regarder ce film** — disponibilité streaming/location/achat (France).
2. **Films similaires** — recommandations TMDB natives sur la fiche film.
3. **Historique (déjà vu)** — nouvelle dimension de suivi, distincte des favoris et de la liste "à voir".
4. **Sauvegarde locale** — export/import JSON des données de profil, pour pallier l'absence de synchronisation multi-appareil inhérente au choix "pas de backend".
5. **Filtre multi-genres** sur la recherche — sélection de plusieurs genres à la fois (correspondance "au moins un des genres", pas "tous les genres").

## 2. Où regarder + Films similaires (fiche film)

`getMovieDetail` étend son `append_to_response` existant (`credits,videos`) à `credits,videos,similar,watch/providers` — une seule requête réseau au lieu de trois, cohérent avec le choix déjà fait pour credits/videos.

```ts
export interface TMDBWatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}
export interface TMDBWatchProviderRegion {
  link: string;
  flatrate?: TMDBWatchProvider[];
  rent?: TMDBWatchProvider[];
  buy?: TMDBWatchProvider[];
}
export interface TMDBMovieDetail extends TMDBMovie {
  // ...champs existants
  similar?: TMDBListResponse<TMDBMovie>;
  'watch/providers'?: { results: Record<string, TMDBWatchProviderRegion> };
}
```

- **Où regarder** : lit `movie['watch/providers']?.results?.FR` (région France, cohérente avec `language=fr-FR` déjà fixé dans `tmdbFetch`). Affiche trois groupes si présents (Abonnement/Location/Achat), logos des plateformes (`tmdbImageUrl(logo_path, 'w45')`), et une mention d'attribution obligatoire selon les conditions d'utilisation de cet endpoint TMDB : "Données fournies par JustWatch" en lien vers `regionData.link`. Si aucune donnée pour FR, la section est simplement omise (pas de message "indisponible").
- **Films similaires** : `movie.similar?.results`, grille des 10 premiers résultats (mêmes classes que la section Casting), titre "Films similaires". Chaque carte pointe vers sa propre fiche film comme partout ailleurs.

## 3. Historique (déjà vu)

Nouvelle dimension de profil, indépendante de `favorites` (ajout explicite) et de `swipedLiked` (liste "à voir" issue du swipe) : `watched: number[]`.

`ProfileScores` (dans `recommend.ts`) gagne `watched?: number[]`. Nouvelles fonctions pures, symétriques à `recordFavorite`/`unfavorite` :
- `recordWatched(profile, movieId, genreIds)` — +3 points par genre (entre le poids d'une vue simple `+1` et celui d'un favori `+5`), ajoute l'id à `watched` (dédupliqué).
- `unwatch(profile, movieId)` — retire l'id de `watched`, ne retire pas les points (même logique que `unfavorite`).
- `excludeWatched(movies, profile)` — exclut les films déjà marqués vus (fonction à composer, comme `excludeFavorites`).

`profileStore.ts` : actions `markWatched(movieId, genreIds)` / `unmarkWatched(movieId)`, et `watched: profile.watched ?? []` ajouté à `normalizeProfile` (même migration silencieuse que pour `swipedLiked`/`swipedDisliked` — les profils déjà stockés sans ce champ ne sont jamais rejetés).

**Où c'est utilisé :**
- Fiche film (`MovieDetail.tsx`) : un bouton "Marquer comme vu" à côté du bouton favori, même style `glass-pill`.
- Profil (`ProfileView.tsx`) : nouvelle section "Historique", même schéma de chargement que "Mes favoris"/"À voir" (`Promise.allSettled` sur `getMovieDetail`).
- `SwipeDeck.tsx` : les films déjà vus sont exclus du pool de candidats (`excludeWatched` composé avec `excludeSwiped` existant) — pas d'intérêt à re-proposer en swipe un film déjà vu.
- `SearchExplorer.tsx`, mode "Pour vous" : exclut aussi les films déjà vus (en plus des favoris déjà exclus), même raisonnement.

## 4. Sauvegarde locale (export / import)

Le choix "pas de backend" signifie que les données (favoris, scores, historique, listes swipe) ne quittent jamais l'appareil — mais ça veut aussi dire qu'elles sont perdues si le navigateur est réinitialisé, ou ne se retrouvent pas sur un second appareil. Une sauvegarde/restauration manuelle en JSON comble ce manque sans introduire de backend.

`profileStore.ts` gagne :
```ts
export function exportProfile(): string {
  return JSON.stringify(profileStore.get(), null, 2);
}

export function importProfile(json: string): boolean {
  try {
    const parsed = JSON.parse(json);
    if (!isValidProfile(parsed)) return false;
    const next = normalizeProfile(parsed);
    profileStore.set(next);
    persist(next);
    return true;
  } catch {
    return false;
  }
}
```

`ProfileView.tsx` ajoute une section "Sauvegarde" avec deux actions :
- **Télécharger une sauvegarde** : génère un `Blob` JSON et déclenche un téléchargement (`cinescope-sauvegarde.json`) via un lien `<a download>` temporaire.
- **Restaurer une sauvegarde** : ouvre un `<input type="file" accept="application/json">` caché, lit le fichier choisi (`file.text()`), appelle `importProfile`, affiche un message de succès ou d'erreur (`aria-live="polite"`, même pattern que la confirmation de reset existante).

Un fichier invalide (JSON cassé, ou JSON valide mais qui ne respecte pas la forme d'un profil) laisse le profil actuel intact et affiche un message d'erreur — jamais de remplacement partiel.

## 5. Filtre multi-genres (recherche)

`DiscoverParams` gagne `genreMatch?: 'all' | 'any'` (défaut `'all'`, c'est-à-dire le comportement actuel inchangé — jointure `with_genres` par virgule). `buildDiscoverQuery` utilise `|` (OR, "au moins un genre") quand `genreMatch === 'any'`, sinon `,` (AND, comportement historique). Aucun appelant existant (`RecommendedRow`, `TopsExplorer`, `SwipeDeck`) ne passe ce paramètre : leur comportement ne change pas.

Dans `SearchExplorer.tsx` uniquement : l'état `genre: number | null` devient `genres: number[]` (sélection multiple par clic sur plusieurs chips), et `buildRequest` passe systématiquement `genreMatch: 'any'` — une recherche multi-genres a plus de sens en "au moins un des genres cochés" qu'en "tous les genres à la fois" (qui retournerait souvent zéro résultat). Ce changement s'applique aussi bien à la sélection manuelle qu'au mode "Pour vous" (qui passe déjà plusieurs genres issus du profil).

## 6. Robustesse & cas limites

- Film sans données JustWatch pour la France : section "Où regarder" omise silencieusement.
- Film sans films similaires retournés par TMDB : section "Films similaires" omise (même convention que Casting/bande-annonce déjà en place : `{condition && <section>...}`).
- Profils `localStorage` antérieurs à `watched` : migrés silencieusement à `[]`, jamais réinitialisés (même garde-fou que pour `swipedLiked`/`swipedDisliked`).
- Import d'un fichier JSON invalide ou de forme incorrecte : profil actuel conservé intact, message d'erreur affiché, aucune exception non gérée.
- Sélection de zéro genre dans le filtre multi-genres : équivalent à l'état actuel "aucun filtre genre" (comportement déjà existant, inchangé).

## 7. Tests

- Vitest : `recordWatched`/`unwatch`/`excludeWatched` (mêmes cas que les tests `recordSwipeLike`/`recordSwipeDislike`/`excludeSwiped` existants) dans `tests/recommend.test.ts`.
- Vitest : `markWatched`/`unmarkWatched` (persistance, non-double-comptage) et `exportProfile`/`importProfile` (aller-retour, rejet d'un JSON invalide, migration d'un profil sans `watched`) dans `tests/profileStore.test.ts`.
- Vitest : `buildDiscoverQuery` avec `genreMatch: 'any'` (jointure par `|`) et sans (comportement par défaut inchangé, jointure par `,`) dans `tests/tmdb.test.ts`.
- Pas de nouveaux tests Playwright dédiés au-delà de la vérification manuelle habituelle (parcours : fiche film → où regarder / films similaires / marquer comme vu → profil → historique + export/import → recherche multi-genres).

## 8. Hors périmètre

- Attribution "logo JustWatch" graphique (juste le lien texte "Données fournies par JustWatch") — suffisant pour respecter l'exigence d'attribution sans télécharger/héberger leur logo officiel.
- Sélecteur de région pour "Où regarder" (France uniquement, cohérent avec le reste de l'app qui est déjà figé en `fr-FR`).
- Synchronisation automatique entre appareils — explicitement hors périmètre puisque "pas de backend" est une contrainte dure ; l'export/import manuel est la réponse à cette limite, pas une vraie synchronisation.
- Genre match "any" appliqué à `RecommendedRow`/`TopsExplorer`/`SwipeDeck` — laissés inchangés (comma/AND), en dehors du périmètre de cette demande centrée sur la page recherche.
