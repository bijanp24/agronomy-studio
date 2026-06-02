# AI Search Routing (Mock NLU)

The AI agronomy search service (`netlify/lib/ai-search.ts`, exposed at
`/ai-search-api`) is a **deterministic mock**: it classifies intent and extracts
parameters with keyword rules, routes to the real gateway endpoints, and returns
a templated plain-English summary with source attribution. Generative LLM calls
(OpenAI/Gemini) are stubbed behind `callLlmStub` and swappable later.

## Pipeline

1. **Classify intent** (`classifyIntent`): first matching keyword group wins.
2. **Extract params** (`extractParams`): coordinates, place name (gazetteer →
   lat/lon/county), crop (from the WUCOLS seed), basin, and ISO dates.
3. **Route** to the gateway and build a summary + `sources[]` + `confidence`.

## Intent → route table

| Intent | Trigger keywords (sample) | Gateway call | Sources |
|--------|---------------------------|--------------|---------|
| `irrigation_recommendation` | irrigat, how much water, watering | `buildIrrigationRecommendation` | CIMIS, SSURGO, WUCOLS, Open-Meteo |
| `evapotranspiration` | evapotranspiration, eto, reference et | `getEvapotranspiration` | CIMIS |
| `soil_profile` | soil, texture, drainage, water capacity | `getSoil` + `buildSoilWaterBalance` | SSURGO |
| `water_quality` | nitrate, water quality, salinity, groundwater | `getWaterQuality` | GAMA |
| `dataset_discovery` | dataset, open data, report on | `getDatasets` | CNRA |
| `location_summary` | summary, overview, conditions, or a bare place name | `buildLocationSummary` | all |
| `unknown` | (no match) | — | — |

## Location resolution

`dataset_discovery` does not require a location. Every other (non-`unknown`)
intent does: if no coordinates or known place are found, the service returns a
low-confidence response asking the user to name a city/county or coordinates.

The gazetteer covers common Central Valley / California locations (Fresno,
Bakersfield, Salinas, Sacramento, Modesto, Visalia, Merced, Stockton, Davis,
Napa, Riverside, El Centro, Santa Maria, …) mapped to representative coordinates
and counties.

## Tests

`netlify/lib/__tests__/ai-search.test.ts` covers intent classification,
parameter extraction, and routing (with mocked gateway providers, no network).
