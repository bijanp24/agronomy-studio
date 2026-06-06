# ---------------------------------------------------------------------------
# Inference engine — orchestrates model predictions for all four objectives.
# ---------------------------------------------------------------------------

from __future__ import annotations

import logging
from datetime import date

import numpy as np
import pandas as pd

from .db import Database
from .demo_data import generate_demo_field_snapshot, generate_training_dataframe
from .features import engineer_features, row_to_features
from .models import predict_yield, predict_risk, assign_cluster, compute_percentile
from .registry import ModelRegistry

logger = logging.getLogger(__name__)


class InferenceEngine:
    def __init__(self, registry: ModelRegistry, db: Database, demo_mode: bool = False) -> None:
        self._registry = registry
        self._db = db
        self._demo = demo_mode
        # Cache training data for benchmarking percentile lookups
        self._training_df: pd.DataFrame | None = None

    # ------------------------------------------------------------------
    # Yield prediction
    # ------------------------------------------------------------------

    async def yield_predict(self, field_id: str, crop_name: str,
                            crop_year: int, custom_features: dict | None = None) -> dict:
        artifact = self._registry.get("yield")
        if artifact is None:
            raise RuntimeError("No active yield model")

        row = custom_features or await self._get_field_row(field_id, crop_name, crop_year)
        X = row_to_features(row).values.astype(float)
        result = predict_yield(artifact, X, crop_name)

        # Persist prediction to DB
        today = date.today().isoformat()
        await self._db.save_yield_prediction({
            **result,
            "field_id": field_id,
            "crop_year": crop_year,
            "prediction_date": today,
            "model_version": self._registry.active_version("yield") or "demo",
        })

        return {**result, "crop_name": crop_name, "field_id": field_id, "crop_year": crop_year}

    # ------------------------------------------------------------------
    # Input optimisation
    # ------------------------------------------------------------------

    async def optimize_inputs(self, field_id: str, crop_name: str, crop_year: int) -> dict:
        artifact = self._registry.get("yield")
        if artifact is None:
            raise RuntimeError("No active yield model")

        base_row = await self._get_field_row(field_id, crop_name, crop_year)
        base_X = row_to_features(base_row).values.astype(float)
        base_pred = predict_yield(artifact, base_X, crop_name)
        base_yield = base_pred["predicted_yield_kg_ha"]

        # Grid search over irrigation and N-applied
        import pandas as _pd
        from .demo_data import CROP_IRRIGATION, CROP_N_RANGE

        crop_key = crop_name.lower()
        irr_lo, irr_hi = CROP_IRRIGATION.get(crop_key, (30, 55))
        n_lo, n_hi = CROP_N_RANGE.get(crop_key, (100, 300))

        best_yield = base_yield
        best_irr = base_row.get("season_irrigation_in", (irr_lo + irr_hi) / 2)
        best_n = base_row.get("season_n_applied", (n_lo + n_hi) / 2)

        irr_grid = np.linspace(irr_lo, irr_hi, 8)
        n_grid = np.linspace(n_lo, n_hi, 8)

        for irr in irr_grid:
            for n in n_grid:
                trial = {**base_row, "season_irrigation_in": irr, "season_n_applied": n}
                X_t = row_to_features(trial).values.astype(float)
                pred = predict_yield(artifact, X_t, crop_name)
                if pred["predicted_yield_kg_ha"] > best_yield:
                    best_yield = pred["predicted_yield_kg_ha"]
                    best_irr = irr
                    best_n = n

        cur_irr = float(base_row.get("season_irrigation_in", best_irr))
        cur_n = float(base_row.get("season_n_applied", best_n))
        gain_pct = (best_yield - base_yield) / (abs(base_yield) + 1e-9) * 100
        confidence = base_pred.get("confidence", "medium")

        return {
            "field_id": field_id,
            "crop_year": crop_year,
            "current_irrigation_in": round(cur_irr, 1),
            "rec_irrigation_in": round(best_irr, 1),
            "irrigation_delta_in": round(best_irr - cur_irr, 1),
            "current_nitrogen_lb_ac": round(cur_n, 1),
            "rec_nitrogen_lb_ac": round(best_n, 1),
            "nitrogen_delta_lb_ac": round(best_n - cur_n, 1),
            "expected_yield_kg_ha": round(best_yield, 1),
            "expected_yield_gain_pct": round(gain_pct, 2),
            "baseline_yield_kg_ha": round(base_yield, 1),
            "confidence": confidence,
        }

    # ------------------------------------------------------------------
    # Risk / anomaly
    # ------------------------------------------------------------------

    async def risk_assess(self, field_id: str, crop_name: str, crop_year: int) -> dict:
        risk_artifact = self._registry.get("risk")
        cluster_artifact = self._registry.get("cluster")
        if risk_artifact is None or cluster_artifact is None:
            raise RuntimeError("Risk or cluster model not loaded")

        row = await self._get_field_row(field_id, crop_name, crop_year)
        X = row_to_features(row).values.astype(float)
        cluster_label, cluster_name = assign_cluster(cluster_artifact, X)
        result = predict_risk(risk_artifact, X, cluster_label)

        await self._db.save_risk_score({
            **result,
            "field_id": field_id,
            "crop_year": crop_year,
            "model_version": self._registry.active_version("risk") or "demo",
            "peer_cohort_id": str(cluster_label),
        })

        return {
            **result,
            "field_id": field_id,
            "crop_year": crop_year,
            "cohort_id": cluster_label,
            "cohort_name": cluster_name,
        }

    async def risk_summary(self, organization_id: str | None, crop_year: int) -> list[dict]:
        """Assess risk for all known fields."""
        if self._demo:
            return self._demo_risk_summary(crop_year)
        rows = await self._db.get_all_field_features()
        if not rows:
            return self._demo_risk_summary(crop_year)
        results = []
        for r in rows:
            if organization_id and r.get("organization_id") != organization_id:
                continue
            try:
                res = await self.risk_assess(r["field_id"], r.get("crop_name", "unknown"), crop_year)
                results.append(res)
            except Exception as e:
                logger.warning("Risk assess failed for %s: %s", r["field_id"], e)
        return results

    def _demo_risk_summary(self, crop_year: int) -> list[dict]:
        demo_fields = [
            ("field-001", "almond"), ("field-002", "tomato"), ("field-003", "pistachio")
        ]
        results = []
        for fid, crop in demo_fields:
            row = generate_demo_field_snapshot(fid, crop, crop_year)
            X = row_to_features(row).values.astype(float)
            risk_art = self._registry.get("risk")
            cluster_art = self._registry.get("cluster")
            if risk_art and cluster_art:
                cluster_label, cluster_name = assign_cluster(cluster_art, X)
                r = predict_risk(risk_art, X, cluster_label)
                results.append({**r, "field_id": fid, "crop_year": crop_year,
                                "cohort_id": cluster_label, "cohort_name": cluster_name})
        return results

    # ------------------------------------------------------------------
    # Benchmarking
    # ------------------------------------------------------------------

    async def benchmark(self, field_id: str, crop_name: str,
                        crop_year: int, yield_kg_ha: float | None = None) -> dict:
        cluster_artifact = self._registry.get("cluster")
        yield_artifact = self._registry.get("yield")
        if cluster_artifact is None:
            raise RuntimeError("Cluster model not loaded")

        row = await self._get_field_row(field_id, crop_name, crop_year)
        X = row_to_features(row).values.astype(float)
        cluster_label, cluster_name = assign_cluster(cluster_artifact, X)

        if yield_kg_ha is None and yield_artifact is not None:
            yp = predict_yield(yield_artifact, X, crop_name)
            yield_kg_ha = yp["predicted_yield_kg_ha"]

        # Compute percentile against cached training yields in the same cluster
        training_df = await self._get_training_df()
        if training_df is not None and len(training_df) > 0:
            crop_mask = training_df["crop_name"].str.lower() == crop_name.lower()
            cohort_df = training_df[crop_mask] if crop_mask.any() else training_df
            cohort_yields = cohort_df["actual_yield_kg_ha"].values
            pct_rank = float(np.mean(cohort_yields < (yield_kg_ha or 0)) * 100)
            cohort_size = len(cohort_yields)
        else:
            pct_rank = 50.0
            cohort_size = 0

        return {
            "field_id": field_id,
            "crop_year": crop_year,
            "cluster_label": cluster_label,
            "cluster_name": cluster_name,
            "yield_kg_ha": round(yield_kg_ha or 0, 1),
            "percentile_rank": round(pct_rank, 1),
            "cohort_size": cohort_size,
        }

    async def all_clusters(self) -> list[dict]:
        cluster_art = self._registry.get("cluster")
        if cluster_art is None:
            return []
        return [
            {"cluster_label": k, "cluster_name": v}
            for k, v in cluster_art.cluster_names.items()
        ]

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _get_field_row(self, field_id: str, crop_name: str, crop_year: int) -> dict:
        if not self._demo:
            db_row = await self._db.get_field_features(field_id, crop_year)
            if db_row:
                if not db_row.get("crop_name"):
                    db_row["crop_name"] = crop_name
                return db_row
        return generate_demo_field_snapshot(field_id, crop_name, crop_year)

    async def _get_training_df(self) -> pd.DataFrame | None:
        if self._training_df is not None:
            return self._training_df
        if self._demo:
            self._training_df = generate_training_dataframe()
        else:
            rows = await self._db.get_training_dataset()
            self._training_df = pd.DataFrame(rows) if rows else generate_training_dataframe()
        return self._training_df
