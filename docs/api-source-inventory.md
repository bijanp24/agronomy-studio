# API Source Inventory

The California Agronomy Microservices Platform aggregates several public data
sources behind a single gateway. Each upstream is wrapped by a TypeScript domain
module in `netlify/lib/` and exposed through a thin function in `netlify/functions/`.
The Blazor frontend calls **only** the gateway (`/agronomy-api/*`) and the AI
search service (`/ai-search-api`).

| Service | Module | Function (public prefix) | Upstream | Auth | Normalized model |
|---------|--------|--------------------------|----------|------|------------------|
| Irrigation / CIMIS | `cimis.ts` | `/cimis-api` | [CIMIS Web API](https://et.water.ca.gov/) (`/api/data`, `/api/station`) | `CIMIS_APP_KEY` | `EvapotranspirationReading`, `CimisStation` |
| Forecast ET | `fret.ts` | `/fret-api` | [Open-Meteo](https://open-meteo.com/) daily `et0_fao_evapotranspiration` | none | `ForecastEtReading[]` |
| Soil | `soil.ts` | `/soil-api` | [NRCS Soil Data Access](https://sdmdataaccess.sc.egov.usda.gov/) SSURGO (`post.rest`) | none | `SoilProfile` |
| Crop coefficients | `crop.ts` | `/crop-api` | Bundled `data/wucols-kc.json` (WUCOLS IV + FAO-56) | none | `CropWaterCoefficient` |
| CNRA open data | `cnra.ts` | `/cnra-api` | [CNRA CKAN](https://data.cnra.ca.gov/) (`package_search`, `datastore_search`) | none | `OpenDataDataset` |
| Water quality | `waterquality.ts` | `/waterquality-api` | GAMA ArcGIS REST layer (configurable) | none (`GAMA_ARCGIS_URL` optional) | `WaterQualityRecord` |
| Gateway | `gateway.ts` | `/agronomy-api` | aggregates all of the above in-process | n/a | `AgronomyLocationSummary`, `IrrigationRecommendation`, `SoilWaterBalance`, `RiskSummary` |
| AI search (mock) | `ai-search.ts` | `/ai-search-api` | deterministic NLU → gateway | none | `AgronomySearchResult` |

## Gateway routes

- `GET /api/agronomy/location-summary?lat=&lon=&crop=` → `AgronomyLocationSummary`
- `GET /api/agronomy/irrigation-recommendation?lat=&lon=&crop=&efficiency=` (or `POST` with `IrrigationRequest`)
- `GET /api/agronomy/soil-water-balance?lat=&lon=`
- `GET /api/agronomy/risk-summary?lat=&lon=`
- `POST /api/agronomy/search` (body `{ latitude, longitude, cropName }`)

## Resilience

The gateway fans out to providers with `Promise.all` and isolates failures: a
failing upstream is logged and recorded under `warnings[service]` while the rest
of the summary is still returned. Each upstream fetch is timed and logged as a
structured JSON line (level, service, route, upstream URL, status, durationMs,
correlationId) via `netlify/lib/http.ts`.

## Units

All water depths are normalized to **inches**, temperatures to **°F**. Open-Meteo
(mm) and NRCS (cm) values are converted on ingest; CIMIS is requested in English
units (`unitOfMeasure=E`).
