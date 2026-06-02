# Agronomy Studio

A Blazor WebAssembly dashboard for precision agriculture — combining field intelligence, yield prediction, nutrient management, GIS mapping, weather-based entropy analysis, and natural-language querying into a single UI.

## Features

- **Dashboard** — At-a-glance stress scores, predicted yields, and limiting factors across all fields.
- **Fields** — Per-field soil tests, field operations, nutrient balances, and yield predictions.
- **Entropy** — Atmospheric entropy readings derived from live weather data (temperature, humidity, UV, wind, precipitation), with coin/dice outcomes and a history sparkline.
- **GIS Blocks** — Interactive Leaflet map displaying field blocks with soil type, elevation, irrigation zone, and crop overlays.
- **Query** — Natural-language questions answered by mock / OpenAI / Gemini providers, with SQL preview and local history.
- **Agronomy** — Location-based irrigation guidance combining reference ET (CIMIS), soil water capacity (NRCS SSURGO), crop coefficients (WUCOLS), and the Open-Meteo forecast, with soil-water balance and risk summaries.
- **Ask** — Plain-English agronomy questions routed (via a deterministic mock NLU) to the agronomy gateway, with source attribution.
- **Logs** — In-app diagnostics ring buffer of HTTP activity and errors with correlation ids and timing.

## California Agronomy Microservices Platform

A set of TypeScript Netlify functions (one domain module per service in
`netlify/lib/`, thin HTTP wrappers in `netlify/functions/`) plus an aggregating
gateway the frontend calls. See [docs/api-source-inventory.md](docs/api-source-inventory.md),
[docs/irrigation-model.md](docs/irrigation-model.md),
[docs/soil-water-balance.md](docs/soil-water-balance.md), and
[docs/ai-search-routing.md](docs/ai-search-routing.md).

| Service | Public prefix | Upstream | Key |
|---------|---------------|----------|-----|
| Agronomy gateway | `/agronomy-api` | aggregates the services below | — |
| Irrigation / CIMIS | `/cimis-api` | CIMIS Web API | `CIMIS_APP_KEY` |
| Forecast ET | `/fret-api` | Open-Meteo | — |
| Soil | `/soil-api` | NRCS SSURGO (SDA) | — |
| Crop coefficients | `/crop-api` | bundled WUCOLS seed | — |
| CNRA open data | `/cnra-api` | CNRA CKAN | — |
| Water quality | `/waterquality-api` | GAMA ArcGIS REST | — (`GAMA_ARCGIS_URL` optional) |
| AI search (mock) | `/ai-search-api` | deterministic NLU → gateway | — |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Blazor WebAssembly (.NET 8, standalone) |
| Styling | Default Blazor theme + Bootstrap, scoped CSS |
| Mapping | Leaflet (via JS interop) |
| Backends | Netlify functions (prod) / Node mock servers (dev) |
| Package Manager | NuGet (dotnet) |

## Prerequisites

- .NET 8 SDK
- Node.js (LTS) — for the local mock APIs and the function toolchain (`npm install`)

## Getting Started

There are two local workflows:

### A. `dotnet run` + Node mocks (offline, no keys)

```bash
# Restore and run the app (https://localhost:5xxx)
dotnet run

# In a second terminal, start the mock backend APIs (includes agronomy + AI on :4310/:4312)
node tools/mock-apis.mjs
```

The Agronomy and Ask pages use canned data from the mock server in this mode.

### B. `netlify dev` (real functions + external APIs)

```bash
cp .env.example .env   # add CIMIS_APP_KEY, FRED_API_KEY as needed
npm install
netlify dev            # runs the real TypeScript functions and proxies the Blazor app
```

In this mode the gateway calls the real CIMIS / NRCS / WUCOLS / Open-Meteo / CNRA / GAMA
sources server-side. Required environment variables are documented in
[.env.example](.env.example) (`CIMIS_APP_KEY` is needed for live ETo; the others
work keyless).

The app talks to several backends. Base URLs are configured per environment:

| Path | Local target (dev) | Production |
|------|--------------------|------------|
| `/field-api` | `http://localhost:4302` | Netlify redirect → `netlify/functions/field-api` |
| `/weather-api` | `http://localhost:4300` | Netlify redirect → `netlify/functions/weather-api` |
| `/query-api` | `http://localhost:4304` | Netlify redirect → `netlify/functions/query-api` |
| `/fred-api` | `http://localhost:4306` | Netlify redirect → `netlify/functions/fred-api` |
| `/datagov-api` | `http://localhost:4308` | Netlify redirect → `netlify/functions/datagov-api` |
| `/agronomy-api` | `http://localhost:4310` | Netlify redirect → `netlify/functions/agronomy-api` |
| `/ai-search-api` | `http://localhost:4312` | Netlify redirect → `netlify/functions/ai-search-api` |

Local URLs live in `wwwroot/appsettings.Development.json`; production (relative) paths live in `wwwroot/appsettings.json`.

For the OpenAI / Gemini query providers, start the mock APIs with the relevant key:

```bash
OPENAI_API_KEY=sk-... node tools/mock-apis.mjs
GEMINI_API_KEY=AIza... node tools/mock-apis.mjs
```

## Scripts

| Command | Description |
|---------|-------------|
| `dotnet run` | Serve with the Blazor dev server |
| `dotnet watch` | Rebuild and reload on file changes |
| `dotnet publish -c Release -o release` | Produce the deployable `release/wwwroot` |
| `node tools/mock-apis.mjs` | Run the local mock backends |
| `npm test` | Run the TypeScript function tests (Vitest) |
| `npm run test:live` | Run the opt-in live smoke tests (`AGRONOMY_LIVE_TESTS=1`) |
| `npm run typecheck` | Type-check the Netlify functions |
| `npm run ingest:wucols [csv]` | Validate or regenerate the crop-coefficient seed |

## Project Structure

```
/
├── AgronomyStudio.csproj   # Blazor WebAssembly project
├── Program.cs              # DI registration (named HttpClients, services)
├── App.razor / _Imports.razor
├── Layout/                 # MainLayout + NavMenu (default theme)
├── Models/                 # C# records mirroring the API payloads
├── Pages/                  # Dashboard, Fields, Entropy, Gis, Query
├── Services/               # FieldIntelligence, Weather, Query, error/notification, storage
├── wwwroot/
│   ├── index.html
│   ├── css/app.css         # Theme tokens + shared styles
│   ├── js/interop.js       # Leaflet interop
│   └── appsettings*.json   # API base URLs per environment
├── netlify/functions/      # Production API mocks
└── tools/mock-apis.mjs     # Local dev backends
```

## Deployment

Netlify builds via `netlify.toml` (installs the .NET SDK, runs `dotnet publish`, and serves `release/wwwroot`), with SPA fallback and API redirects to the functions. GitHub Actions (`.github/workflows/deploy-netlify.yml`) can alternatively build and deploy. See [docs/environments.md](docs/environments.md).

## License

Private — not published.
