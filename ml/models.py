# ---------------------------------------------------------------------------
# ML models — yield prediction, risk/anomaly, clustering.
# ---------------------------------------------------------------------------

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, IsolationForest
from sklearn.linear_model import QuantileRegressor, Ridge
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, mean_absolute_percentage_error

logger = logging.getLogger(__name__)

try:
    import lightgbm as lgb
    LGB_AVAILABLE = True
except ImportError:
    LGB_AVAILABLE = False
    logger.warning("lightgbm not available — using sklearn GradientBoostingRegressor")

try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False
    logger.warning("shap not available — using feature coefficients for attribution")


# ---------------------------------------------------------------------------
# Yield prediction
# ---------------------------------------------------------------------------

@dataclass
class YieldModelArtifact:
    regressor: Any
    lower_regressor: Any
    upper_regressor: Any
    scaler: StandardScaler
    feature_names: list[str]
    per_crop_baselines: dict[str, float]   # crop_name → median actual yield
    training_rows: int
    val_rmse: float
    val_mape: float
    model_type: str = "lgb" if LGB_AVAILABLE else "gbr"


def train_yield_model(X: np.ndarray, y: np.ndarray, feature_names: list[str],
                      crop_names: list[str]) -> tuple[YieldModelArtifact, dict]:
    """Train the yield prediction ensemble.

    Returns (artifact, metrics_dict).
    """
    X_tr, X_val, y_tr, y_val, crops_tr, crops_val = train_test_split(
        X, y, crop_names, test_size=0.2, random_state=42
    )

    scaler = StandardScaler()
    X_tr_s = scaler.fit_transform(X_tr)
    X_val_s = scaler.transform(X_val)

    # Main point estimator
    if LGB_AVAILABLE:
        reg = lgb.LGBMRegressor(
            n_estimators=400, learning_rate=0.05, max_depth=6,
            num_leaves=31, subsample=0.8, colsample_bytree=0.8,
            random_state=42, verbose=-1,
        )
        reg.fit(X_tr_s, y_tr)
    else:
        reg = GradientBoostingRegressor(
            n_estimators=300, learning_rate=0.05, max_depth=4,
            subsample=0.8, random_state=42,
        )
        reg.fit(X_tr_s, y_tr)

    # Quantile regressors for prediction intervals (10th / 90th percentile)
    lower_reg = QuantileRegressor(quantile=0.10, alpha=0.01, solver="highs")
    upper_reg = QuantileRegressor(quantile=0.90, alpha=0.01, solver="highs")
    lower_reg.fit(X_tr_s, y_tr)
    upper_reg.fit(X_tr_s, y_tr)

    # Validation metrics
    y_pred_val = reg.predict(X_val_s)
    val_rmse = float(np.sqrt(mean_squared_error(y_val, y_pred_val)))
    val_mape = float(mean_absolute_percentage_error(y_val, y_pred_val))

    # Per-crop baselines (historical medians) for relative deviation
    per_crop_baselines: dict[str, float] = {}
    for cn in set(crop_names):
        mask = [c == cn for c in crops_tr]
        if any(mask):
            per_crop_baselines[cn] = float(np.median(y_tr[mask]))

    artifact = YieldModelArtifact(
        regressor=reg,
        lower_regressor=lower_reg,
        upper_regressor=upper_reg,
        scaler=scaler,
        feature_names=feature_names,
        per_crop_baselines=per_crop_baselines,
        training_rows=len(X_tr),
        val_rmse=val_rmse,
        val_mape=val_mape,
    )

    metrics = {
        "training_rows": len(X_tr),
        "val_rows": len(X_val),
        "val_rmse": val_rmse,
        "val_mape": val_mape,
    }
    logger.info("Yield model trained: val_rmse=%.1f val_mape=%.3f", val_rmse, val_mape)
    return artifact, metrics


def predict_yield(artifact: YieldModelArtifact, X: np.ndarray, crop_name: str) -> dict:
    """Run inference, returning point estimate + interval + SHAP attributions."""
    X_s = artifact.scaler.transform(X)

    point = float(artifact.regressor.predict(X_s)[0])
    lower = float(artifact.lower_regressor.predict(X_s)[0])
    upper = float(artifact.upper_regressor.predict(X_s)[0])

    # Ensure interval ordering
    lower = min(lower, point)
    upper = max(upper, point)
    lower = max(lower, point * 0.5)
    upper = min(upper, point * 1.8)

    baseline = artifact.per_crop_baselines.get(crop_name, point)

    # SHAP attributions (fall back to feature importances if unavailable)
    shap_values = _compute_shap(artifact, X_s)
    factors = _shap_to_factors(shap_values, artifact.feature_names)

    confidence = _confidence_level(artifact, upper - lower, point)

    return {
        "predicted_yield_kg_ha": round(point, 1),
        "yield_lower_kg_ha": round(lower, 1),
        "yield_upper_kg_ha": round(upper, 1),
        "baseline_yield_kg_ha": round(baseline, 1),
        "confidence": confidence,
        **factors,
    }


def _compute_shap(artifact: YieldModelArtifact, X_s: np.ndarray) -> np.ndarray:
    if SHAP_AVAILABLE:
        try:
            explainer = shap.Explainer(artifact.regressor)
            sv = explainer(X_s)
            return sv.values[0] if hasattr(sv, "values") else np.zeros(X_s.shape[1])
        except Exception:
            pass
    # Fallback: use feature importances (GBR / LGBM both expose them)
    if hasattr(artifact.regressor, "feature_importances_"):
        fi = artifact.regressor.feature_importances_
        return fi / (fi.sum() + 1e-9)
    return np.zeros(X_s.shape[1])


def _shap_to_factors(shap_vals: np.ndarray, feature_names: list[str]) -> dict:
    """Map SHAP values to the canonical factor keys used in the UI."""
    # Sum absolute SHAP by semantic bucket
    name_to_idx = {n: i for i, n in enumerate(feature_names)}

    def bucket(keys: list[str]) -> float:
        vals = [abs(float(shap_vals[name_to_idx[k]])) for k in keys if k in name_to_idx]
        return float(np.mean(vals)) if vals else 0.0

    water   = bucket(["season_irrigation_in", "irrigation_adequacy"])
    nutrient = bucket(["season_n_applied", "nitrate_n_ppm", "phosphorus_ppm", "potassium_ppm"])
    heat    = bucket(["soil_ph", "ph_deviation"])  # proxy; real heat would use weather features
    soil    = bucket(["organic_matter_pct", "soil_type_group"])
    seed    = bucket(["area_ha"])                  # area proxies for management intensity
    planting = bucket(["crop_name", "region_code"])

    # Normalise to 0–1 scale for interpretability
    total = water + nutrient + heat + soil + seed + planting + 1e-9
    factors = {
        "factor_water":    round(water / total, 3),
        "factor_nutrient": round(nutrient / total, 3),
        "factor_heat":     round(heat / total, 3),
        "factor_uv":       round(soil / total, 3),
        "factor_seed":     round(seed / total, 3),
        "factor_planting": round(planting / total, 3),
    }

    # Top limiting factors (smallest factors = biggest drags)
    limiting = sorted(factors, key=lambda k: factors[k])[:3]
    factors["limiting_factors"] = [k.replace("factor_", "") for k in limiting]
    return factors


def _confidence_level(artifact: YieldModelArtifact, interval_width: float, point: float) -> str:
    rel_width = interval_width / (abs(point) + 1e-9)
    if artifact.training_rows < 50 or rel_width > 0.5:
        return "low"
    if rel_width > 0.25:
        return "medium"
    return "high"


# ---------------------------------------------------------------------------
# Risk / Anomaly detection
# ---------------------------------------------------------------------------

@dataclass
class RiskModelArtifact:
    iso_forest: IsolationForest
    scaler: StandardScaler
    feature_names: list[str]
    per_cluster_medians: dict[int, np.ndarray]
    training_rows: int
    model_type: str = "isolation_forest"


def train_risk_model(X: np.ndarray, feature_names: list[str],
                     cluster_labels: np.ndarray) -> tuple[RiskModelArtifact, dict]:
    scaler = StandardScaler()
    X_s = scaler.fit_transform(X)

    iso = IsolationForest(n_estimators=200, contamination=0.08, random_state=42)
    iso.fit(X_s)

    per_cluster_medians: dict[int, np.ndarray] = {}
    for lbl in set(cluster_labels):
        mask = cluster_labels == lbl
        per_cluster_medians[int(lbl)] = np.median(X_s[mask], axis=0)

    artifact = RiskModelArtifact(
        iso_forest=iso,
        scaler=scaler,
        feature_names=feature_names,
        per_cluster_medians=per_cluster_medians,
        training_rows=len(X),
    )
    return artifact, {"training_rows": len(X)}


def predict_risk(artifact: RiskModelArtifact, X: np.ndarray,
                 cluster_label: int = 0) -> dict:
    X_s = artifact.scaler.transform(X)
    # Isolation Forest score: more negative = more anomalous
    raw_score = float(artifact.iso_forest.score_samples(X_s)[0])
    # Normalise to 0–1 where 1 = highest risk
    anomaly_score = float(np.clip(1 - (raw_score + 0.5), 0, 1))

    # Residual from cluster median
    median = artifact.per_cluster_medians.get(cluster_label,
             artifact.per_cluster_medians.get(0, np.zeros(X_s.shape[1])))
    residuals = X_s[0] - median
    residual_zscore = float(np.linalg.norm(residuals))

    # Which features deviate most?
    top_idx = np.argsort(np.abs(residuals))[::-1][:3]
    top_risk_factors = [artifact.feature_names[i] for i in top_idx]

    risk_label = (
        "critical" if anomaly_score > 0.75 else
        "high" if anomaly_score > 0.55 else
        "moderate" if anomaly_score > 0.35 else
        "low"
    )
    return {
        "anomaly_score": round(anomaly_score, 3),
        "risk_label": risk_label,
        "residual_zscore": round(residual_zscore, 3),
        "top_risk_factors": top_risk_factors,
    }


# ---------------------------------------------------------------------------
# Clustering / benchmarking
# ---------------------------------------------------------------------------

@dataclass
class ClusterModelArtifact:
    kmeans: KMeans
    scaler: StandardScaler
    feature_names: list[str]
    cluster_names: dict[int, str]
    training_rows: int
    model_type: str = "kmeans"


def train_cluster_model(X: np.ndarray, feature_names: list[str],
                        n_clusters: int = 6) -> tuple[ClusterModelArtifact, dict]:
    scaler = StandardScaler()
    X_s = scaler.fit_transform(X)

    km = KMeans(n_clusters=n_clusters, n_init=10, random_state=42)
    km.fit(X_s)

    # Auto-name clusters by dominant feature deviations from global mean
    centers = km.cluster_centers_
    feat_idx = {n: i for i, n in enumerate(feature_names)}
    names: dict[int, str] = {}
    for lbl in range(n_clusters):
        c = centers[lbl]
        irr_idx = feat_idx.get("season_irrigation_in", 0)
        n_idx = feat_idx.get("season_n_applied", 1)
        irr_hi = c[irr_idx] > 0.5
        n_hi = c[n_idx] > 0.5
        if irr_hi and n_hi:
            names[lbl] = "High-input intensive"
        elif irr_hi:
            names[lbl] = "Irrigation-intensive"
        elif n_hi:
            names[lbl] = "Nutrient-intensive"
        elif c[irr_idx] < -0.5 and c[n_idx] < -0.5:
            names[lbl] = "Low-input conservative"
        else:
            names[lbl] = f"Mixed cohort {lbl}"

    artifact = ClusterModelArtifact(
        kmeans=km, scaler=scaler, feature_names=feature_names,
        cluster_names=names, training_rows=len(X),
    )
    return artifact, {"training_rows": len(X), "n_clusters": n_clusters}


def assign_cluster(artifact: ClusterModelArtifact, X: np.ndarray) -> tuple[int, str]:
    X_s = artifact.scaler.transform(X)
    label = int(artifact.kmeans.predict(X_s)[0])
    name = artifact.cluster_names.get(label, f"Cohort {label}")
    return label, name


def compute_percentile(artifact: ClusterModelArtifact, X: np.ndarray,
                       yield_kg_ha: float, training_yields: np.ndarray,
                       cluster_labels: np.ndarray) -> tuple[float, int]:
    """Return (percentile_rank, cohort_size) for a field's yield within its cluster."""
    label, _ = assign_cluster(artifact, X)
    mask = cluster_labels == label
    cohort_yields = training_yields[mask]
    if len(cohort_yields) == 0:
        return 50.0, 0
    pct = float(np.mean(cohort_yields < yield_kg_ha) * 100)
    return round(pct, 1), int(np.sum(mask))
