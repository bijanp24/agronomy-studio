# ---------------------------------------------------------------------------
# Database layer — PostgreSQL via asyncpg, with a no-op fallback for demo mode.
# ---------------------------------------------------------------------------

from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

try:
    import asyncpg
    ASYNCPG_AVAILABLE = True
except ImportError:
    ASYNCPG_AVAILABLE = False


class Database:
    """Thin async wrapper around asyncpg. Falls back to a no-op stub when
    DATABASE_URL is not set so the service runs entirely from demo data."""

    def __init__(self, url: str | None) -> None:
        self._url = url
        self._pool: Any = None
        self.connected = False

    async def connect(self) -> None:
        if not self._url:
            logger.info("DATABASE_URL not set — running in demo mode (no persistence)")
            return
        if not ASYNCPG_AVAILABLE:
            logger.warning("asyncpg not installed — running in demo mode")
            return
        try:
            self._pool = await asyncpg.create_pool(self._url, min_size=1, max_size=5)
            self.connected = True
            logger.info("Connected to PostgreSQL feature store")
        except Exception as exc:
            logger.warning("Could not connect to DB (%s) — running in demo mode", exc)

    async def disconnect(self) -> None:
        if self._pool:
            await self._pool.close()

    async def fetch(self, query: str, *args: Any) -> list[dict]:
        if not self.connected:
            return []
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(query, *args)
            return [dict(r) for r in rows]

    async def fetchrow(self, query: str, *args: Any) -> dict | None:
        if not self.connected:
            return None
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(query, *args)
            return dict(row) if row else None

    async def execute(self, query: str, *args: Any) -> str:
        if not self.connected:
            return "DEMO"
        async with self._pool.acquire() as conn:
            return await conn.execute(query, *args)

    async def executemany(self, query: str, args: list) -> None:
        if not self.connected:
            return
        async with self._pool.acquire() as conn:
            await conn.executemany(query, args)

    # ------------------------------------------------------------------
    # Feature-store reads used by the ML pipeline
    # ------------------------------------------------------------------

    async def get_training_dataset(self) -> list[dict]:
        """Return all labelled training rows: field features + season outcomes."""
        return await self.fetch("""
            SELECT
                f.id                         AS field_id,
                f.organization_id,
                f.area_ha,
                f.soil_type,
                f.region_code,
                cs.crop_year,
                cs.crop_name,
                cs.variety,
                -- Aggregated season inputs
                COALESCE(SUM(CASE WHEN fof.operation_type = 'irrigation'
                    THEN fof.rate_value ELSE 0 END), 0) AS season_irrigation_in,
                COALESCE(SUM(CASE WHEN fof.operation_type = 'fertilizer'
                    THEN fof.total_applied ELSE 0 END), 0) AS season_n_applied,
                -- Latest soil test before season end
                COALESCE(MAX(stf.soil_ph), 6.8)          AS soil_ph,
                COALESCE(MAX(stf.organic_matter_pct), 2.0) AS organic_matter_pct,
                COALESCE(MAX(stf.nitrate_n_ppm), 15.0)   AS nitrate_n_ppm,
                COALESCE(MAX(stf.phosphorus_ppm), 25.0)  AS phosphorus_ppm,
                COALESCE(MAX(stf.potassium_ppm), 200.0)  AS potassium_ppm,
                -- Actual yield (from harvest operation or yield_prediction_facts)
                MAX(ypf.actual_yield_kg_ha)              AS actual_yield_kg_ha
            FROM crop_seasons cs
            JOIN fields f ON f.id = cs.field_id
            LEFT JOIN field_operation_facts fof
                ON fof.field_id = cs.field_id
                AND EXTRACT(YEAR FROM fof.operation_date) = cs.crop_year
            LEFT JOIN soil_test_facts stf
                ON stf.field_id = cs.field_id
                AND stf.sample_date <= MAKE_DATE(cs.crop_year, 12, 31)
            LEFT JOIN yield_prediction_facts ypf
                ON ypf.field_id = cs.field_id
                AND ypf.crop_year = cs.crop_year
                AND ypf.actual_yield_kg_ha IS NOT NULL
            GROUP BY f.id, f.organization_id, f.area_ha, f.soil_type, f.region_code,
                     cs.crop_year, cs.crop_name, cs.variety
            HAVING MAX(ypf.actual_yield_kg_ha) IS NOT NULL
        """)

    async def get_field_features(self, field_id: str, crop_year: int) -> dict | None:
        """Return live features for a specific field+season for inference."""
        return await self.fetchrow("""
            SELECT
                f.id                         AS field_id,
                f.organization_id,
                f.area_ha,
                f.soil_type,
                f.region_code,
                cs.crop_year,
                cs.crop_name,
                COALESCE(SUM(CASE WHEN fof.operation_type = 'irrigation'
                    THEN fof.rate_value ELSE 0 END), 0) AS season_irrigation_in,
                COALESCE(SUM(CASE WHEN fof.operation_type = 'fertilizer'
                    THEN fof.total_applied ELSE 0 END), 0) AS season_n_applied,
                COALESCE(MAX(stf.soil_ph), 6.8)            AS soil_ph,
                COALESCE(MAX(stf.organic_matter_pct), 2.0) AS organic_matter_pct,
                COALESCE(MAX(stf.nitrate_n_ppm), 15.0)     AS nitrate_n_ppm,
                COALESCE(MAX(stf.phosphorus_ppm), 25.0)    AS phosphorus_ppm,
                COALESCE(MAX(stf.potassium_ppm), 200.0)    AS potassium_ppm
            FROM fields f
            LEFT JOIN crop_seasons cs
                ON cs.field_id = f.id AND cs.crop_year = $2
            LEFT JOIN field_operation_facts fof
                ON fof.field_id = f.id
                AND EXTRACT(YEAR FROM fof.operation_date) = $2
            LEFT JOIN soil_test_facts stf
                ON stf.field_id = f.id
            WHERE f.id = $1
            GROUP BY f.id, f.organization_id, f.area_ha, f.soil_type, f.region_code,
                     cs.crop_year, cs.crop_name
        """, field_id, crop_year)

    async def save_yield_prediction(self, row: dict) -> None:
        await self.execute("""
            INSERT INTO yield_prediction_facts (
                field_id, crop_year, prediction_date, model_version,
                predicted_yield_kg_ha, yield_lower_kg_ha, yield_upper_kg_ha,
                baseline_yield_kg_ha, factor_water, factor_nutrient, factor_heat,
                factor_uv, factor_seed, factor_planting, limiting_factors,
                confidence, explanation
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
            ) ON CONFLICT DO NOTHING
        """,
        row["field_id"], row["crop_year"], row["prediction_date"], row["model_version"],
        row["predicted_yield_kg_ha"], row["yield_lower_kg_ha"], row["yield_upper_kg_ha"],
        row["baseline_yield_kg_ha"], row["factor_water"], row["factor_nutrient"],
        row["factor_heat"], row["factor_uv"], row["factor_seed"], row["factor_planting"],
        row["limiting_factors"], row["confidence"], row["explanation"])

    async def save_risk_score(self, row: dict) -> None:
        await self.execute("""
            INSERT INTO field_risk_scores (
                field_id, crop_year, model_version, anomaly_score,
                risk_label, peer_cohort_id, residual_zscore, top_risk_factors, explanation
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        """,
        row["field_id"], row["crop_year"], row["model_version"],
        row["anomaly_score"], row["risk_label"], row.get("peer_cohort_id"),
        row.get("residual_zscore"), row.get("top_risk_factors"), row.get("explanation"))

    async def get_all_field_features(self) -> list[dict]:
        """All live field features for bulk risk / cluster scoring."""
        return await self.fetch("""
            SELECT
                f.id AS field_id, f.organization_id, f.area_ha,
                f.soil_type, f.region_code,
                COALESCE(MAX(cs.crop_year), EXTRACT(YEAR FROM NOW())::int) AS crop_year,
                COALESCE(MAX(cs.crop_name), 'unknown') AS crop_name,
                COALESCE(SUM(CASE WHEN fof.operation_type='irrigation'
                    THEN fof.rate_value ELSE 0 END),0) AS season_irrigation_in,
                COALESCE(SUM(CASE WHEN fof.operation_type='fertilizer'
                    THEN fof.total_applied ELSE 0 END),0) AS season_n_applied,
                COALESCE(MAX(stf.soil_ph), 6.8)            AS soil_ph,
                COALESCE(MAX(stf.organic_matter_pct), 2.0) AS organic_matter_pct,
                COALESCE(MAX(stf.nitrate_n_ppm), 15.0)     AS nitrate_n_ppm,
                COALESCE(MAX(stf.phosphorus_ppm), 25.0)    AS phosphorus_ppm,
                COALESCE(MAX(stf.potassium_ppm), 200.0)    AS potassium_ppm
            FROM fields f
            LEFT JOIN crop_seasons cs ON cs.field_id = f.id
            LEFT JOIN field_operation_facts fof ON fof.field_id = f.id
            LEFT JOIN soil_test_facts stf ON stf.field_id = f.id
            GROUP BY f.id, f.organization_id, f.area_ha, f.soil_type, f.region_code
        """)
