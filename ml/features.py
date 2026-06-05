# ---------------------------------------------------------------------------
# Feature engineering — converts raw field/season records into ML-ready vectors.
#
# LEAKAGE GUARD: All features are constructed from data available BEFORE the
# harvest date. Post-harvest measurements (actual yield) are only used as the
# training target, never as input features.
# ---------------------------------------------------------------------------

from __future__ import annotations

from typing import Literal

import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder


# Canonical feature columns (order must be stable across train/infer).
NUMERIC_FEATURES = [
    "area_ha",
    "season_irrigation_in",
    "season_n_applied",
    "soil_ph",
    "organic_matter_pct",
    "nitrate_n_ppm",
    "phosphorus_ppm",
    "potassium_ppm",
]

CATEGORICAL_FEATURES = ["crop_name", "region_code", "soil_type_group"]

ALL_FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES

TARGET_COL = "actual_yield_kg_ha"

# Crop encoding — deterministic (not fitted) so new crops get an "other" bucket.
CROP_CODES: dict[str, int] = {
    "almond": 0, "tomato": 1, "pistachio": 2,
    "grape": 3, "alfalfa": 4, "corn": 5, "cotton": 6,
    "wheat": 7, "rice": 8, "walnut": 9,
}

REGION_CODES: dict[str, int] = {
    "CA-SJV": 0, "CA-SAC": 1, "CA-SB": 2, "CA-COA": 3, "CA-NV": 4,
}

SOIL_GROUPS: dict[str, int] = {
    "sandy loam": 0, "loam": 1, "clay loam": 2, "silty clay loam": 3,
    "sandy": 4, "clay": 5,
}


def _soil_group(soil_type: str | None) -> int:
    if not soil_type:
        return -1
    st = soil_type.lower()
    for key, code in SOIL_GROUPS.items():
        if key in st:
            return code
    return -1


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Transform a raw training/inference DataFrame into the model feature matrix.

    Safe to call on both training data (with 'actual_yield_kg_ha') and
    inference data (without it).  Returns only the feature columns.
    """
    out = pd.DataFrame()

    # Numeric — fill missing with crop-median or global fallback
    for col in NUMERIC_FEATURES:
        if col in df.columns:
            out[col] = pd.to_numeric(df[col], errors="coerce").fillna(df[col].median() if col in df.columns else 0)
        else:
            out[col] = 0.0

    # Categorical → integer codes
    out["crop_name"] = df["crop_name"].str.lower().map(CROP_CODES).fillna(len(CROP_CODES)).astype(int)
    out["region_code"] = df["region_code"].map(REGION_CODES).fillna(len(REGION_CODES)).astype(int)
    out["soil_type_group"] = df["soil_type"].apply(_soil_group)

    # Derived: pH deviation from 6.8 (near-neutral optimum)
    out["ph_deviation"] = (out["soil_ph"] - 6.8).abs()

    # Derived: irrigation efficiency proxy (yield-relevant range normalised)
    out["irrigation_adequacy"] = (out["season_irrigation_in"] - 36) / 20  # centred around typical 36in

    return out


def split_xy(df: pd.DataFrame, target_col: str = TARGET_COL):
    """Split engineered feature matrix into X (features) and y (target)."""
    feat_df = engineer_features(df)
    y = df[target_col].values
    return feat_df, y, list(feat_df.columns)


def row_to_features(row: dict) -> pd.DataFrame:
    """Convert a single field snapshot dict to a one-row feature DataFrame."""
    return engineer_features(pd.DataFrame([row]))
