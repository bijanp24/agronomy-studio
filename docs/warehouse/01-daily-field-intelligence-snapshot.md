# ADR-01: Daily Field Intelligence Snapshot Schema

**Issue:** #22  
**Status:** Draft  
**Date:** 2026-06-05

---

## Context

Agronomy Studio needs a time-series fact table that captures the key agronomic
state of each field once per day. This snapshot is the foundation for dashboards,
trend analysis, alerting, and AI-assisted yield prediction.

---

## Schema

### Table: `field_intelligence_snapshot`

| Column | Type | Description |
|---|---|---|
| `snapshot_id` | UUID | Surrogate key |
| `field_id` | string | Canonical field identifier (from Transfer Hub) |
| `farm_id` | string | Farm reference |
| `organization_id` | string | Organisation reference |
| `snapshot_date` | date | ISO date (UTC) |
| `crop_name` | string | Active crop on this date |
| `crop_year` | integer | Season/crop year |
| `stress_score` | float | 0–100 composite stress score |
| `stress_label` | string | low / moderate / high |
| `predicted_yield_kg_ha` | float | Yield prediction for the season |
| `confidence` | string | low / medium / high |
| `top_limiting_factor` | string | water / nutrient / heat / uv / other |
| `eto_in_day` | float | Reference ET for the day (inches/day) |
| `crop_et_in_day` | float | Crop ET = ETo × Kc |
| `forecast_rain_in` | float | 7-day forecast rainfall (inches) |
| `irrigation_applied_in` | float | Irrigation applied on this day (inches) |
| `net_irrigation_rec_in` | float | Net irrigation recommendation (inches) |
| `soil_moisture_pct` | float | Observed or estimated soil moisture (%) |
| `awc_in_per_in` | float | Available water capacity |
| `root_zone_depth_in` | float | Root zone depth (inches) |
| `air_temp_f_max` | float | Daily max temperature (°F) |
| `air_temp_f_min` | float | Daily min temperature (°F) |
| `heat_risk` | boolean | True if heat risk threshold exceeded |
| `drought_stress` | boolean | True if high ET with low forecast rain |
| `source_systems` | string[] | Data sources used (CIMIS, NRCS, WUCOLS, …) |
| `created_at` | timestamp | Row creation timestamp |

### Indexes

- `(field_id, snapshot_date)` — primary lookup
- `(organization_id, snapshot_date)` — org-level dashboards
- `(crop_year, snapshot_date)` — season aggregations

---

## TypeScript Type

```ts
interface FieldIntelligenceSnapshot {
  snapshotId: string;
  fieldId: string;
  farmId: string;
  organizationId: string;
  snapshotDate: string;           // ISO date
  cropName: string;
  cropYear: number;
  stressScore: number;
  stressLabel: 'low' | 'moderate' | 'high';
  predictedYieldKgHa?: number;
  confidence?: 'low' | 'medium' | 'high';
  topLimitingFactor?: string;
  etoInDay?: number;
  cropEtInDay?: number;
  forecastRainIn?: number;
  irrigationAppliedIn?: number;
  netIrrigationRecIn?: number;
  soilMoisturePct?: number;
  awcInPerIn?: number;
  rootZoneDepthIn?: number;
  airTempFMax?: number;
  airTempFMin?: number;
  heatRisk?: boolean;
  droughtStress?: boolean;
  sourceSystems?: string[];
  createdAt: string;
}
```

---

## C# Record

```csharp
public sealed record FieldIntelligenceSnapshot
{
    public string SnapshotId { get; init; } = "";
    public string FieldId { get; init; } = "";
    public string FarmId { get; init; } = "";
    public string OrganizationId { get; init; } = "";
    public string SnapshotDate { get; init; } = "";
    public string CropName { get; init; } = "";
    public int CropYear { get; init; }
    public double StressScore { get; init; }
    public string StressLabel { get; init; } = "";
    public double? PredictedYieldKgHa { get; init; }
    public string? Confidence { get; init; }
    public string? TopLimitingFactor { get; init; }
    public double? EtoInDay { get; init; }
    public double? CropEtInDay { get; init; }
    public double? ForecastRainIn { get; init; }
    public double? IrrigationAppliedIn { get; init; }
    public double? NetIrrigationRecIn { get; init; }
    public double? SoilMoisturePct { get; init; }
    public double? AwcInPerIn { get; init; }
    public double? RootZoneDepthIn { get; init; }
    public double? AirTempFMax { get; init; }
    public double? AirTempFMin { get; init; }
    public bool HeatRisk { get; init; }
    public bool DroughtStress { get; init; }
    public List<string> SourceSystems { get; init; } = new();
    public string CreatedAt { get; init; } = "";
}
```

---

## Data Sources

| Column group | Source |
|---|---|
| ET, temperature, heat risk | CIMIS / Open-Meteo (via `/agronomy-api`) |
| Soil moisture, AWC | NRCS SSURGO (via `/soil-api`) |
| Crop ET, Kc | WUCOLS (via `/crop-api`) |
| Irrigation applied | Field operations log (Transfer Hub) |
| Yield prediction | Field Intelligence Service |

---

## Ingestion

The snapshot is populated by the Azure Durable Functions pipeline (see ADR-04).
Each day at a scheduled time, the pipeline fans out one activity per field,
calls the existing deterministic services, and writes the snapshot row.

A back-fill mode is available for historical reconstruction: start date, end date,
and a list of field IDs. The pipeline replays data from stored weather/ET archives
and operation logs.
