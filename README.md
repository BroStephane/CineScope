# CineScope

PWA cinéma serverless (Astro + React + TMDB), sans backend ni base de données. Toutes les données utilisateur (favoris, scores de recommandation) sont stockées dans le `localStorage` du navigateur.

## Description

CineScope est une application de catalogue cinéma alimentée par l'API TMDB — un catalogue mondial de films consultable, filtrable et personnalisable, sans jamais créer de compte ni faire transiter la moindre donnée personnelle par un serveur.

**Explorer**
- Accueil avec tendances du jour, films au cinéma, populaires, mieux notés et prochainement, chacun avec sa page dédiée à défilement infini.
- Recherche texte + filtres cumulables : genres (plusieurs à la fois), année, note minimum, langue originale, durée, avec trois modes de tri (tendance, note, "pour vous").
- Sorties : films classés par date de sortie (du plus récent au plus ancien), affichés avec synopsis et note, filtrables par genre (liste déroulante), note minimum et année.
- Tops : mieux notés, top par genre, top de l'année.
- Fiches réalisateur/acteur avec filmographie complète.

**Décider quoi regarder**
- Fiche film détaillée : casting, bande-annonce, films similaires, franchise/collection, où regarder (streaming/location/achat), partage.
- Découverte : swipez les films façon Tinder (au clavier ou au doigt) pour construire votre liste "à voir", propulsé par un algorithme de recommandation local basé sur vos goûts.
- Section "Pour vous" sur l'accueil et la recherche, basée sur vos genres préférés.

**Se souvenir**
- Favoris, historique des films vus, notes personnelles (1 à 5 étoiles) et "Mes meilleurs films" (vos coups de cœur 4-5★), le tout consultable et modifiable depuis votre profil.
- Sauvegarde manuelle : exportez/importez vos données en JSON pour les transférer d'un appareil à l'autre.
- Application installable (PWA), avec vos favoris disponibles hors-ligne.

Aucun compte, aucun tracking, aucune donnée qui quitte l'appareil — tout l'état vit dans le `localStorage` du navigateur.

## Démarrage

1. `npm install`
2. Copier `.env.example` vers `.env` et renseigner `PUBLIC_TMDB_API_KEY` avec une clé API TMDB v3 (https://www.themoviedb.org/settings/api).
3. `npm run dev` puis ouvrir `http://localhost:4321`.

### Note sur la production : Cloudflare adapter requis

Le projet utilise l'adaptateur Cloudflare (`@astrojs/cloudflare`) pour supporter le rendu à la demande de la page de détail du film (`/movie/[id]`) et de la page personne (`/personne/[id]`). Cela signifie que :

- **`npm run preview` ne fonctionne pas** : cet outil intégré d'Astro ne supporte pas les adaptateurs (contrairement à `npm run build`).
- Pour tester une build de production localement, utilisez `npm run build` suivi de `npx wrangler dev` — cela exécute le Worker sur le vrai runtime Cloudflare (workerd) en local, à `http://127.0.0.1:8788` par défaut.
- **Le déploiement doit se faire sur Cloudflare Workers** (ou une plateforme avec un adaptateur Astro équivalent) — ce n'est plus optionnel. Voir la section [Déploiement](#déploiement) : `@astrojs/cloudflare` génère un Worker avec assets statiques, pas une build compatible avec le produit Cloudflare Pages historique (dashboard Git-integration classique) — utilisez `wrangler deploy` ou un projet "Workers" connecté à Git.

## Tests

`npm test` exécute la suite Vitest (logique de scoring, requêtes TMDB, stockage).

`npm run typecheck` vérifie les types TypeScript.

## Sécurité — restriction de la clé TMDB

La clé API TMDB est exposée côté client (obligatoire pour un site 100% serverless). Avant la mise en production :

1. Aller sur https://www.themoviedb.org/settings/api.
2. Ouvrir les paramètres de l'application/clé utilisée.
3. Configurer la restriction "Approved Domains" / "HTTP Referrer" pour n'autoriser que le nom de domaine de production final (ex. `cinescope.<votre-sous-domaine>.workers.dev` ou votre domaine personnalisé).
4. Ne jamais committer le fichier `.env` (déjà exclu via `.gitignore`).

## Déploiement

Déployé sur **Cloudflare Workers** (adapter `@astrojs/cloudflare`, config dans `wrangler.jsonc` à la racine). `npm run build` produit `dist/server/entry.mjs` (le Worker) + `dist/client/` (les assets statiques, servis via le binding `ASSETS`) ; `wrangler.jsonc` référence ces deux chemins.

**Option A — CLI locale (`wrangler deploy`)**

1. `npx wrangler login` (une seule fois, ouvre une fenêtre pour autoriser l'accès à votre compte Cloudflare).
2. Définir `PUBLIC_TMDB_API_KEY` : `npx wrangler secret put PUBLIC_TMDB_API_KEY` — ne pas la committer. Comme c'est une variable `PUBLIC_*` inlinée côté client au build, elle doit aussi être présente dans `.env` localement au moment du `npm run build` (voir "Démarrage" ci-dessus) ; le secret Cloudflare ne couvre que l'exécution du Worker lui-même, pas le contenu déjà buildé.
3. `npm run deploy` (= `astro build && wrangler deploy`).

**Option B — Projet "Workers" connecté à Git (build continue)**

Dans le dashboard Cloudflare : Compute (Workers) → créez un Worker connecté à ce dépôt Git (pas un projet "Pages" classique — l'adapter Cloudflare d'Astro cible les Workers). Build command : `npm run build`. Définissez `PUBLIC_TMDB_API_KEY` dans les variables de build du projet (nécessaire pour que la valeur soit inlinée dans le bundle client à la compilation).

1. **Service worker et support hors-ligne** : le projet utilise une étape de build personnalisée (définie dans `astro.config.mjs` via un hook `astro:build:done`) pour compiler le service worker (`src/sw.ts`). Cette étape est requise pour que le support PWA et hors-ligne fonctionne. Si `dist/client/sw.js` n'apparaît pas après `npm run build`, consultez les commentaires détaillés dans `astro.config.mjs` pour le dépannage.

2. **Icons PWA** : le projet inclut un manifest PWA avec des références à trois fichiers PNG (`public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`), déjà générés et committés à partir des sources SVG (`public/icons/icon.svg` pour les icônes standard, `public/icons/icon-maskable.svg` pour la variante "maskable" avec sa marge de sécurité). Pour les régénérer après une modification des SVG, exécutez `node scripts/generate-icons.mjs` (nécessite le package `playwright` et son navigateur Chromium — `npx playwright install chromium` si besoin).
