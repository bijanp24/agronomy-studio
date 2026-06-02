# Agronomy Studio

A Blazor WebAssembly dashboard for precision agriculture — combining field intelligence, yield prediction, nutrient management, GIS mapping, weather-based entropy analysis, and natural-language querying into a single UI.

## Features

- **Dashboard** — At-a-glance stress scores, predicted yields, and limiting factors across all fields.
- **Fields** — Per-field soil tests, field operations, nutrient balances, and yield predictions.
- **Entropy** — Atmospheric entropy readings derived from live weather data (temperature, humidity, UV, wind, precipitation), with coin/dice outcomes and a history sparkline.
- **GIS Blocks** — Interactive Leaflet map displaying field blocks with soil type, elevation, irrigation zone, and crop overlays.
- **Query** — Natural-language questions answered by mock / OpenAI / Gemini providers, with SQL preview and local history.

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
- Node.js (LTS) — only to run the local mock APIs

## Getting Started

```bash
# Restore and run the app (https://localhost:5xxx)
dotnet run

# In a second terminal, start the mock backend APIs
node tools/mock-apis.mjs
```

The app talks to three backends. Base URLs are configured per environment:

| Path | Local target (dev) | Production |
|------|--------------------|------------|
| `/field-api` | `http://localhost:4302` | Netlify redirect → `netlify/functions/field-api` |
| `/weather-api` | `http://localhost:4300` | Netlify redirect → `netlify/functions/weather-api` |
| `/query-api` | `http://localhost:4304` | Netlify redirect → `netlify/functions/query-api` |

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
