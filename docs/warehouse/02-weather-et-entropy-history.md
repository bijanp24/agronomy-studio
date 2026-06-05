# ADR-02: Weather, ET, and Entropy History Schema

**Issue:** #23  
**Status:** Draft  
**Date:** 2026-06-05

---

## Context

Weather and evapotranspiration data are time-series facts. Storing historical readings
enables trend detection, retrospective analysis, degree-day accumulation (GDD), entropy
scoring, and comparison of predicted vs actual conditions.

---

## Schema: `weather_et_history`

| Column | Type | Description |
|---|---|---|
| `record_id` | UUID | Surrogate key |
| `field_id` | string | Canonical field (null if station-level only) |
| `station_id` | string | CIMIS station or weather station identifier |
| `observation_date` | date | ISO date |
| `observation_hour` | integer | 0–23 (null for daily aggregates) |
| `air_temp_f` | float | Air temperature (°F) |
| `dew_point_f` | float | Dew point (°F) |
| `relative_humidity_pct` | float | Relative humidity (%) |
| `wind_speed_mph` | float | Wind speed (mph) |
| `solar_radiation_ly_day` | float | Solar radiation (Ly/day) |
| `precipitation_in` | float | Precipitation (inches) |
| `eto_in_day` | float | Reference ET (in/day) — CIMIS or Open-Meteo |
| `vapor_pressure_deficit_kpa` | float | VPD (kPa) |
| `entropy_score` | float | Atmospheric entropy composite (0–1) |
| `data_quality` | string | observed / estimated / interpolated |
| `source` | string | CIMIS / Open-Meteo / manual |
| `created_at` | timestamp | Row creation timestamp |

### Indexes

- `(field_id, observation_date)` — field-level weather lookup
- `(station_id, observation_date)` — station archive lookup
- `(observation_date)` — date-range scans

---

## Schema: `growing_degree_days`

Derived table populated by the ingestion pipeline.

| Column | Type | Description |
|---|---|---|
| `gdd_id` | UUID | Surrogate key |
| `field_id` | string | Field reference |
| `season_start_date` | date | First day of GDD accumulation |
| `observation_date` | date | Current accumulation date |
| `base_temp_f` | float | Base temperature threshold (e.g. 50°F for corn) |
| `daily_gdd` | float | GDD for this day |
| `cumulative_gdd` | float | GDD since season start |
| `crop_name` | string | Crop this GDD applies to |

---

## TypeScript Type

```ts
interface WeatherEtRecord {
  recordId: string;
  fieldId?: string;
  stationId?: string;
  observationDate: string;         // ISO date
  observationHour?: number;
  airTempF?: number;
  dewPointF?: number;
  relativeHumidityPct?: number;
  windSpeedMph?: number;
  solarRadiationLyDay?: number;
  precipitationIn?: number;
  etoInDay?: number;
  vaporPressureDeficitKpa?: number;
  entropyScore?: number;
  dataQuality: 'observed' | 'estimated' | 'interpolated';
  source: string;
  createdAt: string;
}
```

---

## Entropy Score

The entropy score (0–1) is derived from the existing `Entropy.razor` page calculation:

```
entropy = f(temperature, humidity, UV, wind, precipitation, pressure)
```

Stored historically so the app can show a sparkline, detect anomalous days, and
correlate entropy with crop stress.

---

## Retention Policy

| Data tier | Retention | Storage |
|---|---|---|
| Raw hourly readings | 2 years | Hot (queryable) |
| Daily aggregates | 10 years | Warm (queryable, compressed) |
| Historical archive | Indefinite | Cold (Blob/S3, query on demand) |
