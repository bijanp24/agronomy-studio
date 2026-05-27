# Agronomy Studio

An Angular dashboard for precision agriculture — combining field intelligence, yield prediction, nutrient management, GIS mapping, and weather-based entropy analysis into a single UI.

## Features

- **Dashboard** — At-a-glance stress scores, predicted yields, and limiting factors across all fields.
- **Fields** — Manage fields, view soil tests, track field operations, nutrient balances, and yield predictions.
- **GIS Map** — Interactive Leaflet map displaying field blocks with soil type, elevation, irrigation zone, and crop overlays.
- **Entropy** — Atmospheric entropy readings derived from live weather data (temperature, humidity, UV, wind, precipitation).

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Angular 21 (standalone components, lazy-loaded routes) |
| UI Components | Angular Material + Angular CDK |
| Mapping | Leaflet |
| Styling | SCSS |
| Testing | Vitest |
| Package Manager | npm |

## Prerequisites

- Node.js (LTS recommended)
- npm 11+

## Getting Started

```bash
# Install dependencies
npm install

# Start the dev server (http://localhost:4200)
npm start
```

The dev server proxies two backend APIs (configured in `proxy.conf.json`):

| Proxy Path | Target | Purpose |
|------------|--------|---------|
| `/field-api` | `http://localhost:4302` | Field intelligence API (fields, soil, yield, GIS) |
| `/weather-api` | `http://localhost:4300` | Weather / entropy API |

Make sure the backend services are running before using the app.

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Serve with live reload (development) |
| `npm run build` | Production build |
| `npm run watch` | Rebuild on file changes (development) |
| `npm test` | Run unit tests with Vitest |

## Project Structure

```
src/app/
├── core/              # Interceptors and shared infrastructure
├── models/            # TypeScript interfaces (field intelligence, weather)
├── pages/
│   ├── dashboard/     # Dashboard overview component
│   ├── entropy/       # Weather entropy visualization
│   ├── fields/        # Field management & detail views
│   └── gis/           # Leaflet-based GIS map
└── services/          # HTTP services (FieldIntelligence, Weather)
```

## License

Private — not published to npm.
