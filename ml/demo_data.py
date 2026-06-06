# ---------------------------------------------------------------------------
# Demo data — synthetic but agronomically realistic California field records.
# Used when DATABASE_URL is not set.
#
# Generates ~300 labelled training rows (fields × years) for:
#   - Almond (Central Valley, ~3800–4800 kg/ha)
#   - Tomato (processing, ~75000–95000 kg/ha)
#   - Pistachio (~2500–3500 kg/ha)
#   - Grape (wine/table, ~8000–20000 kg/ha)
#   - Alfalfa (~16000–22000 kg/ha)
#
# Yield is correlated with controllable features so the model can learn
# meaningful patterns and produce useful SHAP attributions.
# ---------------------------------------------------------------------------

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from typing import Literal

import numpy as np
import pandas as pd


CROPS = ["almond", "tomato", "pistachio", "grape", "alfalfa"]
REGIONS = ["CA-SJV", "CA-SAC", "CA-SB", "CA-COA"]
SOIL_TYPES = ["Hanford sandy loam", "San Joaquin loam", "Tujunga loamy sand", "Yolo silty clay loam", "Greenfield sandy loam"]

# Baseline yield (kg/ha), std, and feature sensitivities per crop
CROP_PROFILES: dict[str, dict] = {
    "almond": {
        "baseline_kg_ha": 4100,
        "std_kg_ha": 350,
        "irrigation_sensitivity": 0.45,   # yield gain per inch above median
        "n_sensitivity": 0.20,
        "heat_penalty": -80,              # per heat-day above 100°F
        "ph_optimum": 6.8,
    },
    "tomato": {
        "baseline_kg_ha": 84000,
        "std_kg_ha": 6000,
        "irrigation_sensitivity": 0.50,
        "n_sensitivity": 0.25,
        "heat_penalty": -1200,
        "ph_optimum": 6.5,
    },
    "pistachio": {
        "baseline_kg_ha": 2950,
        "std_kg_ha": 280,
        "irrigation_sensitivity": 0.35,
        "n_sensitivity": 0.15,
        "heat_penalty": -40,
        "ph_optimum": 7.2,
    },
    "grape": {
        "baseline_kg_ha": 14000,
        "std_kg_ha": 3000,
        "irrigation_sensitivity": 0.30,
        "n_sensitivity": 0.12,
        "heat_penalty": -200,
        "ph_optimum": 6.2,
    },
    "alfalfa": {
        "baseline_kg_ha": 18000,
        "std_kg_ha": 2000,
        "irrigation_sensitivity": 0.60,
        "n_sensitivity": 0.05,   # legume — N fixation
        "heat_penalty": -100,
        "ph_optimum": 7.0,
    },
}

# Typical seasonal irrigation ranges (inches) by crop
CROP_IRRIGATION: dict[str, tuple[float, float]] = {
    "almond":    (36, 52),
    "tomato":    (28, 42),
    "pistachio": (30, 48),
    "grape":     (20, 36),
    "alfalfa":   (42, 60),
}

# Typical N applied (lb/ac converted to a relative scale)
CROP_N_RANGE: dict[str, tuple[float, float]] = {
    "almond":    (150, 250),
    "tomato":    (200, 350),
    "pistachio": (100, 180),
    "grape":     (60, 120),
    "alfalfa":   (20, 40),
}


def _generate_field(rng: random.Random, field_idx: int) -> dict:
    crop = rng.choice(CROPS)
    return {
        "field_id": f"demo-field-{field_idx:04d}",
        "organization_id": f"demo-org-{(field_idx % 20):03d}",
        "area_ha": round(rng.uniform(8, 120), 1),
        "soil_type": rng.choice(SOIL_TYPES),
        "region_code": rng.choice(REGIONS),
        "crop_name": crop,
    }


def _generate_year_row(rng: random.Random, field: dict, crop_year: int) -> dict:
    crop = field["crop_name"]
    profile = CROP_PROFILES[crop]

    irr_lo, irr_hi = CROP_IRRIGATION[crop]
    n_lo, n_hi = CROP_N_RANGE[crop]

    irrigation = round(rng.uniform(irr_lo, irr_hi), 1)
    n_applied = round(rng.uniform(n_lo, n_hi), 1)
    soil_ph = round(rng.gauss(profile["ph_optimum"], 0.5), 2)
    organic_matter_pct = round(rng.uniform(0.8, 4.5), 2)
    nitrate_n_ppm = round(rng.uniform(5, 35), 1)
    phosphorus_ppm = round(rng.uniform(10, 60), 1)
    potassium_ppm = round(rng.uniform(80, 350), 1)

    # Simulated heat-days (days above 100°F) — varies by year
    heat_days = max(0, rng.gauss(8 if crop_year > 2022 else 5, 4))

    # Yield model: correlated but with realistic noise
    irr_median = (irr_lo + irr_hi) / 2
    irr_delta = irrigation - irr_median

    ph_diff = abs(soil_ph - profile["ph_optimum"])
    ph_penalty = profile["baseline_kg_ha"] * 0.03 * ph_diff

    yield_kg_ha = (
        profile["baseline_kg_ha"]
        + profile["irrigation_sensitivity"] * irr_delta * profile["baseline_kg_ha"] / irr_median
        + profile["n_sensitivity"] * (n_applied - (n_lo + n_hi) / 2) * profile["baseline_kg_ha"] / n_lo
        + profile["heat_penalty"] * heat_days
        - ph_penalty
        + rng.gauss(0, profile["std_kg_ha"])
    )
    yield_kg_ha = max(yield_kg_ha, profile["baseline_kg_ha"] * 0.25)

    return {
        "field_id": field["field_id"],
        "organization_id": field["organization_id"],
        "area_ha": field["area_ha"],
        "soil_type": field["soil_type"],
        "region_code": field["region_code"],
        "crop_name": crop,
        "crop_year": crop_year,
        "season_irrigation_in": irrigation,
        "season_n_applied": n_applied,
        "soil_ph": soil_ph,
        "organic_matter_pct": organic_matter_pct,
        "nitrate_n_ppm": nitrate_n_ppm,
        "phosphorus_ppm": phosphorus_ppm,
        "potassium_ppm": potassium_ppm,
        "heat_days": heat_days,
        "actual_yield_kg_ha": round(yield_kg_ha, 1),
    }


def generate_training_dataframe(n_fields: int = 120, years: int = 5, seed: int = 42) -> pd.DataFrame:
    """Generate a synthetic labelled dataset for model training."""
    rng = random.Random(seed)
    current_year = 2026
    rows = []
    fields = [_generate_field(rng, i) for i in range(n_fields)]
    for f in fields:
        for yr in range(current_year - years, current_year):
            rows.append(_generate_year_row(rng, f, yr))
    return pd.DataFrame(rows)


def generate_demo_field_snapshot(field_id: str = "demo-field-0001", crop: str = "almond", crop_year: int = 2026) -> dict:
    """Return a single field's current-season features for demo inference."""
    rng = random.Random(hash(field_id + str(crop_year)) % (2**31))
    profile = CROP_PROFILES.get(crop, CROP_PROFILES["almond"])
    irr_lo, irr_hi = CROP_IRRIGATION.get(crop, (36, 52))
    n_lo, n_hi = CROP_N_RANGE.get(crop, (150, 250))
    return {
        "field_id": field_id,
        "organization_id": "demo-org-001",
        "area_ha": 48.6,
        "soil_type": "Hanford sandy loam",
        "region_code": "CA-SJV",
        "crop_name": crop,
        "crop_year": crop_year,
        "season_irrigation_in": round(rng.uniform(irr_lo, irr_hi), 1),
        "season_n_applied": round(rng.uniform(n_lo, n_hi), 1),
        "soil_ph": round(rng.gauss(profile["ph_optimum"], 0.3), 2),
        "organic_matter_pct": round(rng.uniform(1.5, 3.5), 2),
        "nitrate_n_ppm": round(rng.uniform(8, 28), 1),
        "phosphorus_ppm": round(rng.uniform(15, 45), 1),
        "potassium_ppm": round(rng.uniform(120, 280), 1),
    }
