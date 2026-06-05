# ---------------------------------------------------------------------------
# Evaluation & backtest harness.
#
# PRINCIPLE: The trained model is the deterministic number source.
# This module validates model quality so "ML-derived estimate" labels in the
# UI accurately reflect whether confidence is warranted.
#
# Run from project root:
#   python -m ml.eval --model-dir /tmp/ml_models
# ---------------------------------------------------------------------------

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.metrics import (
    mean_absolute_error,
    mean_absolute_percentage_error,
    mean_squared_error,
    r2_score,
)

from .demo_data import generate_training_dataframe
from .features import engineer_features, split_xy
from .models import predict_yield, predict_risk, assign_cluster
from .registry import ModelRegistry

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Yield model evaluation
# ---------------------------------------------------------------------------

def evaluate_yield_model(artifact: Any, eval_df: pd.DataFrame) -> dict:
    """Walk-forward backtest on eval_df — returns key metrics."""
    feat_df, y_true, _ = split_xy(eval_df)
    X = feat_df.values.astype(float)

    results = []
    for i, (x, y) in enumerate(zip(X, y_true)):
        crop = str(eval_df["crop_name"].iloc[i])
        pred = predict_yield(artifact, x.reshape(1, -1), crop)
        results.append({
            "predicted": pred["predicted_yield_kg_ha"],
            "lower": pred["yield_lower_kg_ha"],
            "upper": pred["yield_upper_kg_ha"],
            "actual": float(y),
            "crop": crop,
        })

    predicted = np.array([r["predicted"] for r in results])
    actual    = np.array([r["actual"] for r in results])
    lowers    = np.array([r["lower"] for r in results])
    uppers    = np.array([r["upper"] for r in results])

    rmse = float(np.sqrt(mean_squared_error(actual, predicted)))
    mae  = float(mean_absolute_error(actual, predicted))
    mape = float(mean_absolute_percentage_error(actual, predicted))
    r2   = float(r2_score(actual, predicted))
    # Interval coverage: fraction of actuals within [lower, upper]
    coverage = float(np.mean((actual >= lowers) & (actual <= uppers)))

    # Per-crop breakdown
    per_crop: dict[str, dict] = {}
    for crop in set(r["crop"] for r in results):
        mask = [r["crop"] == crop for r in results]
        p_crop = predicted[mask]
        a_crop = actual[mask]
        if len(p_crop) == 0:
            continue
        per_crop[crop] = {
            "n": int(len(p_crop)),
            "rmse": float(np.sqrt(mean_squared_error(a_crop, p_crop))),
            "mape": float(mean_absolute_percentage_error(a_crop, p_crop)),
        }

    return {
        "n_eval": len(results),
        "rmse": rmse,
        "mae": mae,
        "mape": mape,
        "r2": r2,
        "interval_coverage_80pct": coverage,
        "per_crop": per_crop,
        "pass": mape < 0.25,   # <25% MAPE threshold for "medium" confidence
    }


# ---------------------------------------------------------------------------
# Cold-start / data-sparse simulation
# ---------------------------------------------------------------------------

def evaluate_cold_start(artifact: Any, n_samples: int = 10) -> dict:
    """Simulate a new tenant with very few historical rows.

    Evaluates whether the model degrades gracefully and confidence
    correctly drops to 'low' rather than presenting false precision.
    """
    sparse_df = generate_training_dataframe(n_fields=n_samples, years=1, seed=999)
    feat_df, y_true, _ = split_xy(sparse_df)
    X = feat_df.values.astype(float)

    confidences = []
    for i, x in enumerate(X):
        crop = str(sparse_df["crop_name"].iloc[i])
        pred = predict_yield(artifact, x.reshape(1, -1), crop)
        confidences.append(pred["confidence"])

    pct_high   = confidences.count("high") / len(confidences) * 100
    pct_medium = confidences.count("medium") / len(confidences) * 100
    pct_low    = confidences.count("low") / len(confidences) * 100

    return {
        "n_samples": n_samples,
        "pct_high_confidence": round(pct_high, 1),
        "pct_medium_confidence": round(pct_medium, 1),
        "pct_low_confidence": round(pct_low, 1),
    }


# ---------------------------------------------------------------------------
# Full evaluation suite
# ---------------------------------------------------------------------------

def run_evaluation(model_dir: str, output_path: str | None = None) -> dict:
    db_stub = type("DB", (), {"connected": False})()
    registry = ModelRegistry(model_dir, db_stub)

    if not registry.has_active("yield"):
        logger.error("No active yield model in %s — run training first", model_dir)
        sys.exit(1)

    yield_artifact = registry.get("yield")

    # Use last 20% of synthetic data as hold-out eval set
    full_df = generate_training_dataframe(n_fields=120, years=5, seed=42)
    eval_start = int(len(full_df) * 0.8)
    eval_df = full_df.iloc[eval_start:].reset_index(drop=True)

    logger.info("Evaluating yield model on %d hold-out rows", len(eval_df))
    yield_metrics = evaluate_yield_model(yield_artifact, eval_df)
    cold_start    = evaluate_cold_start(yield_artifact)

    report = {
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "model_dir": model_dir,
        "yield_model_version": registry.active_version("yield"),
        "yield_eval": yield_metrics,
        "cold_start_sim": cold_start,
        "overall_pass": yield_metrics["pass"],
    }

    if output_path:
        Path(output_path).write_text(json.dumps(report, indent=2))
        logger.info("Wrote evaluation report to %s", output_path)
    else:
        print(json.dumps(report, indent=2))

    return report


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description="Evaluate Agronomy Studio ML models")
    parser.add_argument("--model-dir", default=os.environ.get("MODEL_DIR", "/tmp/ml_models"))
    parser.add_argument("--output", default=None, help="Write JSON report to this path")
    args = parser.parse_args()
    report = run_evaluation(args.model_dir, args.output)
    sys.exit(0 if report["overall_pass"] else 1)
