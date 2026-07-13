# CineScope

PWA cinéma serverless (Astro + React + TMDB), sans backend ni base de données. Toutes les données utilisateur (favoris, scores de recommandation) sont stockées dans le `localStorage` du navigateur.

## Démarrage

1. `npm install`
2. Copier `.env.example` vers `.env` et renseigner `PUBLIC_TMDB_API_KEY` avec une clé API TMDB v3 (https://www.themoviedb.org/settings/api).
3. `npm run dev` puis ouvrir `http://localhost:4321`.

### Note sur la production : Vercel adapter requis

Le projet utilise l'adaptateur Vercel (`@astrojs/vercel`) pour supporter le rendu à la demande de la page de détail du film (`/movie/[id]`). Cela signifie que :

- **`npm run preview` ne fonctionne pas** : cet outil intégré d'Astro ne supporte pas les adaptateurs (contrairement à `npm run build`).
- Pour tester une build de production localement, utilisez `npm run build` suivi de `vercel dev` (si vous avez la CLI Vercel installée) ou déployez simplement sur Vercel pour vérifier.
- **Le déploiement doit se faire sur Vercel** (ou une plateforme avec un adaptateur Astro équivalent) — ce n'est plus optionnel.

## Tests

`npm test` exécute la suite Vitest (logique de scoring, requêtes TMDB, stockage).

## Sécurité — restriction de la clé TMDB

La clé API TMDB est exposée côté client (obligatoire pour un site 100% serverless). Avant la mise en production :

1. Aller sur https://www.themoviedb.org/settings/api.
2. Ouvrir les paramètres de l'application/clé utilisée.
3. Configurer la restriction "Approved Domains" / "HTTP Referrer" pour n'autoriser que le nom de domaine de production final (ex. `cinescope.vercel.app`).
4. Ne jamais committer le fichier `.env` (déjà exclu via `.gitignore`).

## Déploiement

Déployé sur **Vercel uniquement** via intégration Git continue. Avant de déployer :

1. Définir `PUBLIC_TMDB_API_KEY` dans les variables d'environnement du projet Vercel (Project Settings → Environment Variables) — ne pas la committer dans le dépôt.

2. **Service worker et support hors-ligne** : le projet utilise une étape de build personnalisée (définie dans `astro.config.mjs` via un hook `astro:build:done`) pour compiler le service worker (`src/sw.ts`). Cette étape est requise pour que le support PWA et hors-ligne fonctionne. Si `dist/client/sw.js` n'apparaît pas après `npm run build`, consultez les commentaires détaillés dans `astro.config.mjs` pour le dépannage.

3. **Icons PWA** : le projet inclut un manifest PWA avec des références à trois fichiers PNG (`public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`), déjà générés et committés à partir des sources SVG (`public/icons/icon.svg` pour les icônes standard, `public/icons/icon-maskable.svg` pour la variante "maskable" avec sa marge de sécurité). Pour les régénérer après une modification des SVG, exécutez `node scripts/generate-icons.mjs` (nécessite le package `playwright` et son navigateur Chromium — `npx playwright install chromium` si besoin).
