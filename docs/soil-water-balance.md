# Soil Water Balance

`GET /api/agronomy/soil-water-balance?lat=&lon=` returns a `SoilWaterBalance`
that combines the SSURGO soil profile, recent reference ET, and the forecast.
Implementation: `buildSoilWaterBalance` in `netlify/lib/gateway.ts`.

## Fields

| Field | Meaning | Derivation |
|-------|---------|------------|
| `availableWaterCapacity` | AWC (in water / in soil) | NRCS `muaggatt.aws0150wta` ÷ 150 cm |
| `rootZoneDepthIn` | effective root-zone depth (in) | NRCS bedrock depth (`brockdepmin`), capped at 150 cm |
| `totalAvailableWaterIn` | TAW (in) | `AWC × rootZoneDepth` |
| `readilyAvailableWaterIn` | RAW (in) | `TAW × 0.5` (default MAD) |
| `recentEtIn` | recent crop-water demand (in) | latest CIMIS ETo × 1 day |
| `forecastEtIn` | forecast ET over the horizon (in) | sum of Open-Meteo daily ETo |
| `forecastRainIn` | forecast precipitation (in) | sum of Open-Meteo daily precipitation |
| `projectedDeficitIn` | projected deficit at horizon (in) | `max(0, recentEt + forecastEt − forecastRain)` |

## Interpretation

When `projectedDeficitIn` approaches `readilyAvailableWaterIn`, the soil profile
is nearing the allowable-depletion threshold and irrigation should be scheduled.
The deficit is intentionally conservative (it does not assume in-season rainfall
beyond the forecast horizon).

## SSURGO source notes

The soil module queries NRCS Soil Data Access (`post.rest`, `JSON+COLUMNNAME`)
using the spatial helper `SDA_Get_Mukey_from_intersection_with_WktWgs84('point(lon lat)')`,
joining `mapunit` → `muaggatt` for AWC/drainage/hydrologic group, and a
best-effort `component`/`chorizon`/`chtexturegrp` join for surface texture. If
the texture lookup fails the profile is still returned without it.
