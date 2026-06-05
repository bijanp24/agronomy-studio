-- ---------------------------------------------------------------------------
-- Feature Store schema — Phase 0
--
-- Persists the canonical Transfer Hub model plus fact tables for ML training.
-- All tables carry organization_id / farm_id for tenant isolation.
-- No cross-tenant raw data leaks; only pooled model weights cross tenants.
--
-- Run against the RDS PostgreSQL instance provisioned in infra/aws/main.tf.
-- ---------------------------------------------------------------------------

BEGIN;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- fuzzy crop-name search

-- ---------------------------------------------------------------------------
-- Canonical org hierarchy (mirrors transfer.ts)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS organizations (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  org_type         TEXT NOT NULL CHECK (org_type IN ('customer','grower','retailer','advisor','cooperative','research')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS farms (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  region           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS farms_org_idx ON farms(organization_id);

CREATE TABLE IF NOT EXISTS fields (
  id               TEXT PRIMARY KEY,
  farm_id          TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  organization_id  TEXT NOT NULL,
  name             TEXT NOT NULL,
  area_value       FLOAT,
  area_unit        TEXT CHECK (area_unit IN ('acre','hectare')),
  area_ha          FLOAT GENERATED ALWAYS AS (
    CASE area_unit
      WHEN 'acre'    THEN area_value * 0.404686
      WHEN 'hectare' THEN area_value
    END
  ) STORED,
  boundary_geojson TEXT,             -- serialised GeoJSON geometry
  soil_type        TEXT,
  region_code      TEXT,
  raw_source_id    TEXT,
  source_system    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fields_farm_idx ON fields(farm_id);
CREATE INDEX IF NOT EXISTS fields_org_idx  ON fields(organization_id);

CREATE TABLE IF NOT EXISTS crop_seasons (
  id            TEXT PRIMARY KEY,
  field_id      TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  crop_year     INTEGER NOT NULL,
  crop_name     TEXT NOT NULL,
  variety       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS crop_seasons_field_idx ON crop_seasons(field_id);
CREATE INDEX IF NOT EXISTS crop_seasons_year_idx  ON crop_seasons(crop_year);

-- ---------------------------------------------------------------------------
-- Field operations (mirrors transfer.ts FieldOperation)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS field_operations (
  id               TEXT PRIMARY KEY,
  field_id         TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  season_id        TEXT REFERENCES crop_seasons(id),
  operation_type   TEXT NOT NULL,
  operation_date   DATE NOT NULL,
  source_system    TEXT,
  raw_source_id    TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ops_field_idx ON field_operations(field_id);
CREATE INDEX IF NOT EXISTS ops_date_idx  ON field_operations(operation_date);

CREATE TABLE IF NOT EXISTS operation_measurements (
  id             BIGSERIAL PRIMARY KEY,
  operation_id   TEXT NOT NULL REFERENCES field_operations(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  value          FLOAT NOT NULL,
  unit           TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS meas_op_idx ON operation_measurements(operation_id);

-- ---------------------------------------------------------------------------
-- Fact table: soil tests (ADR-03)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS soil_test_facts (
  soil_test_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id                      TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  sample_date                   DATE NOT NULL,
  lab_name                      TEXT,
  soil_ph                       FLOAT,
  organic_matter_pct            FLOAT,
  cation_exchange_capacity      FLOAT,
  nitrate_n_ppm                 FLOAT,
  phosphorus_ppm                FLOAT,
  potassium_ppm                 FLOAT,
  electrical_conductivity_ds_m  FLOAT,
  sulfur_ppm                    FLOAT,
  zinc_ppm                      FLOAT,
  boron_ppm                     FLOAT,
  sample_depth_in               FLOAT DEFAULT 12,
  raw_source_id                 TEXT,
  source_system                 TEXT,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS soil_field_idx ON soil_test_facts(field_id);
CREATE INDEX IF NOT EXISTS soil_date_idx  ON soil_test_facts(sample_date);

-- ---------------------------------------------------------------------------
-- Fact table: field operations analytics (ADR-03)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS field_operation_facts (
  operation_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id          TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  season_id         TEXT,
  operation_type    TEXT NOT NULL,
  operation_date    DATE NOT NULL,
  crop_name         TEXT,
  product_name      TEXT,
  rate_value        FLOAT,
  rate_unit         TEXT,
  area_treated_ac   FLOAT,
  total_applied     FLOAT,
  equipment_id      TEXT,
  operator          TEXT,
  notes             TEXT,
  raw_source_id     TEXT,
  source_system     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fof_field_idx ON field_operation_facts(field_id);
CREATE INDEX IF NOT EXISTS fof_date_idx  ON field_operation_facts(operation_date);
CREATE INDEX IF NOT EXISTS fof_type_idx  ON field_operation_facts(operation_type);

-- ---------------------------------------------------------------------------
-- Fact table: weather / ET history (ADR-02)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS weather_et_history (
  record_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id                   TEXT REFERENCES fields(id) ON DELETE SET NULL,
  station_id                 TEXT,
  observation_date           DATE NOT NULL,
  observation_hour           SMALLINT,
  air_temp_f                 FLOAT,
  dew_point_f                FLOAT,
  relative_humidity_pct      FLOAT,
  wind_speed_mph             FLOAT,
  solar_radiation_ly_day     FLOAT,
  precipitation_in           FLOAT,
  eto_in_day                 FLOAT,
  vapor_pressure_deficit_kpa FLOAT,
  entropy_score              FLOAT,
  data_quality               TEXT CHECK (data_quality IN ('observed','estimated','interpolated')),
  source                     TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS weh_field_date_idx   ON weather_et_history(field_id, observation_date);
CREATE INDEX IF NOT EXISTS weh_station_date_idx ON weather_et_history(station_id, observation_date);
CREATE INDEX IF NOT EXISTS weh_date_idx         ON weather_et_history(observation_date);

-- ---------------------------------------------------------------------------
-- Fact table: growing degree days (ADR-02)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS growing_degree_days (
  gdd_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id           TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  season_start_date  DATE NOT NULL,
  observation_date   DATE NOT NULL,
  base_temp_f        FLOAT NOT NULL,
  daily_gdd          FLOAT NOT NULL,
  cumulative_gdd     FLOAT NOT NULL,
  crop_name          TEXT
);

CREATE INDEX IF NOT EXISTS gdd_field_date_idx ON growing_degree_days(field_id, observation_date);

-- ---------------------------------------------------------------------------
-- Fact table: yield predictions (ADR-03 + ML plan)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS yield_prediction_facts (
  prediction_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id               TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  crop_year              INTEGER NOT NULL,
  prediction_date        DATE NOT NULL,
  model_version          TEXT NOT NULL,
  predicted_yield_kg_ha  FLOAT NOT NULL,
  yield_lower_kg_ha      FLOAT,      -- quantile 0.10
  yield_upper_kg_ha      FLOAT,      -- quantile 0.90
  actual_yield_kg_ha     FLOAT,      -- populated at harvest
  baseline_yield_kg_ha   FLOAT,
  -- SHAP feature attributions (0–1 scale)
  factor_water           FLOAT,
  factor_nutrient        FLOAT,
  factor_heat            FLOAT,
  factor_uv              FLOAT,
  factor_seed            FLOAT,
  factor_planting        FLOAT,
  factor_population      FLOAT,
  limiting_factors       TEXT[],
  confidence             TEXT CHECK (confidence IN ('low','medium','high')),
  explanation            TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ypf_field_year_idx ON yield_prediction_facts(field_id, crop_year);
CREATE INDEX IF NOT EXISTS ypf_model_idx      ON yield_prediction_facts(model_version);

-- ---------------------------------------------------------------------------
-- ML model registry
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ml_model_registry (
  model_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_type       TEXT NOT NULL,           -- yield / risk / cluster
  model_version    TEXT NOT NULL,
  artifact_path    TEXT,                    -- S3 / local path to serialised model
  training_rows    INTEGER,
  train_rmse       FLOAT,
  val_rmse         FLOAT,
  val_mape         FLOAT,
  feature_names    TEXT[],
  is_active        BOOLEAN NOT NULL DEFAULT FALSE,
  trained_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes            TEXT,
  UNIQUE (model_type, model_version)
);

-- Ensure only one active model per type
CREATE UNIQUE INDEX IF NOT EXISTS ml_registry_active_idx
  ON ml_model_registry(model_type)
  WHERE is_active = TRUE;

-- ---------------------------------------------------------------------------
-- Risk / anomaly scores (Phase 3)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS field_risk_scores (
  score_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id           TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  crop_year          INTEGER NOT NULL,
  scored_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model_version      TEXT NOT NULL,
  anomaly_score      FLOAT NOT NULL,       -- Isolation Forest: higher = more anomalous
  risk_label         TEXT NOT NULL CHECK (risk_label IN ('low','moderate','high','critical')),
  peer_cohort_id     TEXT,                 -- cluster id
  residual_zscore    FLOAT,               -- deviation from cohort median
  top_risk_factors   TEXT[],
  explanation        TEXT
);

CREATE INDEX IF NOT EXISTS risk_field_idx ON field_risk_scores(field_id, crop_year);

-- ---------------------------------------------------------------------------
-- Benchmarking clusters (Phase 4)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS field_clusters (
  cluster_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id         TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  model_version    TEXT NOT NULL,
  cluster_label    INTEGER NOT NULL,
  cluster_name     TEXT,
  percentile_rank  FLOAT,           -- 0–100 within cohort
  cohort_size      INTEGER,
  assigned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cluster_field_idx ON field_clusters(field_id);

-- ---------------------------------------------------------------------------
-- Optimisation recommendations (Phase 2)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS input_recommendations (
  rec_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id             TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  crop_year            INTEGER NOT NULL,
  generated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model_version        TEXT NOT NULL,
  -- Irrigation
  rec_irrigation_in    FLOAT,
  current_irrigation_in FLOAT,
  irrigation_delta_in  FLOAT,
  -- Nitrogen
  rec_nitrogen_lb_ac   FLOAT,
  current_nitrogen_lb_ac FLOAT,
  nitrogen_delta_lb_ac FLOAT,
  -- Phosphorus
  rec_phosphorus_lb_ac FLOAT,
  current_phosphorus_lb_ac FLOAT,
  phosphorus_delta_lb_ac FLOAT,
  -- Expected outcome
  expected_yield_kg_ha FLOAT,
  expected_yield_gain_pct FLOAT,
  confidence           TEXT CHECK (confidence IN ('low','medium','high')),
  explanation          TEXT
);

CREATE INDEX IF NOT EXISTS rec_field_idx ON input_recommendations(field_id, crop_year);

COMMIT;
