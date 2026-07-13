# Design : Plateforme Cinéma Immersive (PWA Serverless)

Date : 2026-07-13
Statut : Approuvé

## 1. Contexte

Deux cahiers des charges ont été fournis par l'utilisateur : une version de base ("Application Cinéma Serverless, Personnalisée & PWA") et une version étendue ("Plateforme Cinéma Immersive"), cette dernière ajoutant une direction artistique premium (Néo-Skeuomorphisme Luminescent, extraction de couleur adaptative, animations GSAP/Framer Motion). La seconde version englobe entièrement les fonctionnalités de la première (catalogue TMDB, PWA, offline, algorithme de recommandation local) en y ajoutant la couche visuelle. Ce design retient donc la version premium comme cible unique.

Contrainte explicite ajoutée par l'utilisateur, absente des deux documents : **l'application doit être mobile-first et 100% responsive sur toutes les plateformes** (mobile, tablette, desktop).

Aucune base de données ni backend : tout l'état utilisateur vit dans `localStorage` du navigateur. Aucune donnée personnelle ne quitte l'appareil.

## 2. Stack technique (décisions)

| Composant | Choix | Raison |
|---|---|---|
| Framework | Astro (SSG) | Chargement quasi instantané, HTML minimal par défaut |
| Îlots interactifs | React | Écosystème le plus large, s'intègre nativement avec Framer Motion |
| Styles | Tailwind CSS v4 | Tokens CSS natifs (`@theme`), pratique pour la couleur d'accent dynamique |
| État global | Nano Stores | Léger, recommandé par Astro, pas de re-render inutile entre îlots |
| Animation timeline | GSAP | Transitions Hero, séquences complexes |
| Animation composants | Framer Motion | Micro-interactions React (boutons, cartes) |
| Effet 3D carte au survol | CSS `transform: perspective()` | Choix delta vs cahier des charges (qui suggérait Three.js/WebGL) : coût GPU/bundle bien moindre, respecte nativement `prefers-reduced-motion`, suffisant visuellement pour un tilt de carte. Three.js reste une option de stretch-goal si le rendu CSS s'avère insuffisant à l'usage. |
| Extraction couleur | ColorThief (client-side) | Analyse l'affiche affichée, alimente la variable CSS `--accent` |
| Polices | Fraunces (serif variable, titres) + Inter (sans-serif variable, corps) | Auto-hébergées via `@fontsource-variable` : dispo offline, pas d'appel CDN externe |
| Provider de données | API TMDB | Gratuit, catalogue mondial, interrogeable côté client |
| Stockage | `localStorage` | Remplace la BDD ; wrapper avec fallback silencieux si indisponible |
| PWA | `vite-plugin-pwa` (Workbox) | Manifest, Service Worker, stratégies de cache |
| Hébergement | Vercel | Déploiement continu depuis Git, CDN mondial, gratuit |
| Langage | TypeScript strict | Sécurité des types sur les réponses TMDB et le store |
| Tests | Vitest | Algorithme de scoring et query-builder TMDB (logique pure, sans backend) |

## 3. Structure du projet

```
src/
  pages/
    index.astro           # Dashboard
    search.astro           # Recherche + filtres
    movie/[id].astro       # Fiche détaillée film
    tv/[id].astro           # Fiche détaillée série
    profile.astro           # Mon Profil
    offline.astro            # Page de secours PWA
  components/               # Composants Astro statiques (Header, Footer, Card, Layout)
  islands/                  # Composants React hydratés (SearchBar, Filters, FavoriteButton, RecommendedRow, InstallPrompt, UpdateBanner)
  stores/
    profileStore.ts         # Nano Store : favoris, scores genres/réalisateurs
  lib/
    tmdb.ts                 # Client fetch TMDB + types de réponse
    storage.ts               # Wrapper localStorage (try/catch, no-op fallback)
    recommend.ts              # Scoring + construction requête /discover
    chroma.ts                  # Wrapper ColorThief → CSS var --accent
  styles/
    global.css                # Tailwind v4 + tokens dark mode
public/
  icons/, splash/            # Assets PWA (manifest, icônes, splash screens)
docs/superpowers/specs/       # Specs de design (ce fichier)
```

Chaque module de `lib/` est testable indépendamment (fonctions pures, pas d'accès DOM sauf `storage.ts` et `chroma.ts` qui isolent l'accès navigateur).

## 4. Mobile-first & responsive

- Styles écrits d'abord pour un viewport ~375px, étendus ensuite via les breakpoints Tailwind (`sm`/`md`/`lg`/`xl`).
- Navigation : barre de tabs fixe en bas d'écran sur mobile (Accueil / Recherche / Profil), remplacée par un header horizontal classique à partir de `md:`.
- Cibles tactiles ≥ 44px partout (boutons, cartes cliquables).
- Grilles fluides : 2 colonnes sur mobile, jusqu'à 6-7 colonnes en desktop large, via `grid-template-columns` responsive (pas de largeurs fixes en px pour le contenu principal).
- Vérification manuelle sur au moins 3 tailles de viewport (mobile ~375px, tablette ~768px, desktop ~1440px) avant chaque livraison de page.

## 5. Fonctionnalités

### 5.1 Dashboard (accueil)
Hero section avec la tendance du jour (backdrop vidéo si disponible, sinon image), grille "Sorties à venir", grille "Populaires", section "Recommandé pour vous" pilotée par `recommend.ts`.

### 5.2 Recherche & filtres
Recherche textuelle instantanée (debounce) + filtres cumulatifs (année, genre, note minimum TMDB), UI en verre dépoli (glassmorphism), interrogent `/search/movie` ou `/discover/movie` selon présence de filtres.

### 5.3 Fiche détaillée
Page pleine largeur teintée par la couleur dominante de l'affiche (AIC). Synopsis, durée, note, casting (avatars ronds), bande-annonce YouTube intégrée, bouton favori avec effet de remplissage liquide (Framer Motion). L'ouverture de la page déclenche +1 point aux genres du film dans le store.

### 5.4 Mon Profil
Grille visuelle des favoris (disponible offline), statistiques des genres préférés (barres calculées depuis les scores), bouton "Vider mes données" (reset localStorage avec confirmation).

## 6. Algorithme de recommandation

Store `profileStore` persisté dans `localStorage` sous la forme :
```ts
{ genres: Record<number, number>, directors: Record<number, number>, favorites: number[] }
```
- Visite d'une fiche détaillée → +1 point à chaque genre du film.
- Ajout aux favoris → +5 points à chaque genre, +3 points au réalisateur (issu de `credits.crew` filtré sur `job === "Director"`).
- Au chargement de l'accueil : tri des genres par score décroissant, sélection des 2 premiers, requête `GET /discover/movie?with_genres=g1,g2&sort_by=popularity.desc`, résultats filtrés pour exclure les films déjà dans `favorites`.

## 7. PWA & offline

- Precache de l'app shell Astro (HTML/CSS/JS de build) via Workbox `generateSW`.
- Cache runtime `CacheFirst` avec expiration (ex. 7 jours, 60 entrées max) pour les affiches consultées en navigation générale.
- Cache runtime **sans expiration** dédié, alimenté explicitement lors de l'ajout aux favoris (affiche + JSON du film), jamais purgé automatiquement.
- Route `/offline.astro` : page stylée "Vous êtes hors-ligne" avec bouton vers `/profile` (favoris disponibles offline).
- Bannière non intrusive "Nouvelle version disponible" via le hook `registerSW({ onNeedRefresh })` de `vite-plugin-pwa`.
- Manifest avec icônes multi-résolutions + splash screens, mode `standalone`.

## 8. Robustesse & erreurs

- `storage.ts` encapsule tous les accès `localStorage` dans des try/catch ; en cas d'échec (navigation privée stricte), l'app repasse en mode dégradé silencieux : pas de favoris persistés, pas de recommandations, aucune exception remontée à l'utilisateur.
- Erreurs réseau TMDB (offline, timeout, 4xx/5xx) : affichage d'un état d'erreur local dans le composant concerné, jamais de crash de page.
- `prefers-reduced-motion: reduce` détecté globalement : désactive GSAP/Framer Motion et l'effet de tilt CSS, ne garde que des transitions d'opacité minimales. Même dégradation appliquée si `navigator.deviceMemory` (quand disponible) indique un appareil bas de gamme.

## 9. Sécurité

- Clé API TMDB exposée côté client via `PUBLIC_TMDB_API_KEY` (préfixe `PUBLIC_` requis par Astro pour l'exposer au bundle front-end), stockée dans `.env` (git-ignoré), avec `.env.example` versionné comme référence.
- Documentation dans le README des étapes pour configurer la restriction "HTTP Referrer" sur le dashboard TMDB une fois le domaine de production connu (action manuelle utilisateur, non automatisable).

## 10. Tests

- Vitest sur `recommend.ts` (calcul de scores, construction de la requête discover, exclusion des favoris) et `storage.ts` (comportement de fallback).
- Vérification manuelle des parcours clés (recherche, ajout favori, offline, installation PWA) via navigateur réel avant chaque étape livrée, sur mobile et desktop.

## 11. Hors périmètre (v1)

- Comptes utilisateurs / synchronisation multi-appareils (contraire à l'exigence "les données ne quittent jamais l'appareil").
- Effet WebGL/Three.js sur les cartes (remplacé par CSS 3D, voir §2) — réévaluable plus tard si besoin visuel confirmé.
- Support navigateurs très anciens sans `backdrop-filter` (dégradation visuelle acceptée, pas de polyfill).
