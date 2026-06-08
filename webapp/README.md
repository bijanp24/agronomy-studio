# Agronomy Studio WebApp

Angular 22 frontend rewrite for Agronomy Studio. This project is intentionally
self-contained under `webapp/` while the existing Blazor app and Netlify
functions continue to build from the repository root.

## Runtime

- Node.js 24 LTS
- npm 11+

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
npm run e2e
```

`npm run dev` starts the local Express mock API on `http://127.0.0.1:4310` and
the Angular dev server on `http://127.0.0.1:4200`.

## Backend Direction

The local Express server is a frontend-first contract mock. Production backend
mapping should target the existing Netlify function gateway unless the project
later chooses a hosted Express API.
