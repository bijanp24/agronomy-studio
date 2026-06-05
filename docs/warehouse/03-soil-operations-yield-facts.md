# ADR-03: Soil Tests, Operations, and Yield-Prediction Facts

**Issue:** #24  
**Status:** Draft  
**Date:** 2026-06-05

---

## Context

Three fact tables capture the agronomic record of what was measured, applied,
and predicted. Together with the daily snapshot (ADR-01) and weather history (ADR-02)
they form the complete data warehouse.

---

## Schema: `soil_test_facts`

| Column | Type | Description |
|---|---|---|
| `soil_test_id` | UUID | Surrogate key |
| `field_id` | string | Field reference |
| `sample_date` | date | When the sample was taken |
| `lab_name` | string | Laboratory that processed the sample |
| `soil_ph` | float | pH |
| `organic_matter_pct` | float | Organic matter (%) |
| `cation_exchange_capacity` | float | CEC (meq/100g) |
| `nitrate_n_ppm` | float | Nitrate-N (ppm) |
| `phosphorus_ppm` | float | Phosphorus (Mehlich-3, ppm) |
| `potassium_ppm` | float | Potassium (ppm) |
| `electrical_conductivity_ds_m` | float | EC (dS/m) |
| `sulfur_ppm` | float | Sulfur (ppm) |
| `zinc_ppm` | float | Zinc (ppm) |
| `boron_ppm` | float | Boron (ppm) |
| `sample_depth_in` | float | Sampling depth (inches) |
| `raw_source_id` | string | Source record ID from originating system |
| `source_system` | string | Lab, Transfer Hub, manual |
| `created_at` | timestamp | |

---

## Schema: `field_operation_facts`

Mirrors the Transfer Hub canonical `FieldOperation` model with analytics columns added.

| Column | Type | Description |
|---|---|---|
| `operation_id` | UUID | Surrogate key |
| `field_id` | string | Field reference |
| `season_id` | string | Crop season reference |
| `operation_type` | string | planting / harvest / irrigation / fertilizer / chemical / tillage / scouting / soil_sample / other |
| `operation_date` | date | Date of operation |
| `crop_name` | string | Crop at time of operation |
| `product_name` | string | Product applied (chemical, seed, fertiliser) |
| `rate_value` | float | Application rate |
| `rate_unit` | string | lb/ac, gal/ac, in, etc. |
| `area_treated_ac` | float | Acres treated |
| `total_applied` | float | rate × area |
| `equipment_id` | string | Equipment identifier (optional) |
| `operator` | string | Operator name (optional) |
| `notes` | string | Free-text notes |
| `raw_source_id` | string | |
| `source_system` | string | |
| `created_at` | timestamp | |

---

## Schema: `yield_prediction_facts`

| Column | Type | Description |
|---|---|---|
| `prediction_id` | UUID | Surrogate key |
| `field_id` | string | Field reference |
| `crop_year` | integer | Season year |
| `prediction_date` | date | When the prediction was generated |
| `model_version` | string | Version of the yield model |
| `predicted_yield_kg_ha` | float | Predicted yield |
| `actual_yield_kg_ha` | float | Actual yield (populated at harvest) |
| `baseline_yield_kg_ha` | float | Historical average baseline |
| `factor_water` | float | Water stress factor (0–1) |
| `factor_nutrient` | float | Nutrient factor (0–1) |
| `factor_heat` | float | Heat stress factor (0–1) |
| `factor_uv` | float | UV factor (0–1) |
| `factor_seed` | float | Seed quality factor (0–1) |
| `factor_planting` | float | Planting date factor (0–1) |
| `factor_population` | float | Plant population factor (0–1) |
| `limiting_factors` | string[] | Top limiting factors |
| `confidence` | string | low / medium / high |
| `explanation` | string | Plain-English explanation |
| `created_at` | timestamp | |

### Derived: prediction accuracy

```sql
SELECT
  field_id,
  crop_year,
  AVG(ABS(predicted_yield_kg_ha - actual_yield_kg_ha) / actual_yield_kg_ha) AS mape
FROM yield_prediction_facts
WHERE actual_yield_kg_ha IS NOT NULL
GROUP BY field_id, crop_year;
```

---

## TypeScript Types

```ts
interface SoilTestFact {
  soilTestId: string;
  fieldId: string;
  sampleDate: string;
  labName?: string;
  soilPh?: number;
  organicMatterPct?: number;
  cationExchangeCapacity?: number;
  nitrateNPpm?: number;
  phosphorusPpm?: number;
  potassiumPpm?: number;
  electricalConductivityDsM?: number;
  rawSourceId?: string;
  sourceSystem?: string;
  createdAt: string;
}

interface FieldOperationFact {
  operationId: string;
  fieldId: string;
  seasonId?: string;
  operationType: string;
  operationDate: string;
  cropName?: string;
  rateValue?: number;
  rateUnit?: string;
  areaTreatedAc?: number;
  notes?: string;
  rawSourceId?: string;
  sourceSystem?: string;
  createdAt: string;
}

interface YieldPredictionFact {
  predictionId: string;
  fieldId: string;
  cropYear: number;
  predictionDate: string;
  predictedYieldKgHa: number;
  actualYieldKgHa?: number;
  baselineYieldKgHa?: number;
  factorWater?: number;
  factorNutrient?: number;
  factorHeat?: number;
  limitingFactors?: string[];
  confidence: 'low' | 'medium' | 'high';
  explanation?: string;
  createdAt: string;
}
```
