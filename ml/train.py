# ---------------------------------------------------------------------------
# Training runner — builds all three model types from feature store data.
# Falls back to synthetic demo data when DATABASE_URL is not configured.
# ---------------------------------------------------------------------------

from __future__ import annotations

import logging
from typing import Literal

import numpy as np

from .db import Database
from .demo_data import generate_training_dataframe
from .features import engineer_features, split_xy
from .models import (
    train_yield_model, train_risk_model, train_cluster_model,
)
from .registry import ModelRegistry

logger = logging.getLogger(__name__)

ModelType = Literal["yield", "risk", "cluster"]


class TrainingRunner:
    def __init__(self, db: Database, registry: ModelRegistry, demo_mode: bool = False) -> None:
        self._db = db
        self._registry = registry
        self._demo = demo_mode
        # Cached training arrays (reused across model types in one session)
        self._X: np.ndarray | None = None
        self._y: np.ndarray | None = None
        self._crop_names: list[str] | None = None
        self._cluster_labels: np.ndarray | None = None
        self._feature_names: list[str] | None = None

    async def run(self, model_type: ModelType) -> dict:
        """Train and register the specified model. Returns training metrics."""
        logger.info("Starting %s model training (demo=%s)", model_type, self._demo)
        await self._ensure_data_loaded()

        if model_type == "yield":
            return await self._train_yield()
        elif model_type == "risk":
            return await self._train_risk()
        elif model_type == "cluster":
            return await self._train_cluster()
        else:
            raise ValueError(f"Unknown model_type: {model_type}")

    # ------------------------------------------------------------------

    async def _ensure_data_loaded(self) -> None:
        if self._X is not None:
            return

        if self._demo:
            df = generate_training_dataframe()
        else:
            rows = await self._db.get_training_dataset()
            if len(rows) < 20:
                logger.warning("Only %d labelled rows in DB — supplementing with demo data", len(rows))
                import pandas as pd
                demo_df = generate_training_dataframe()
                db_df = pd.DataFrame(rows) if rows else demo_df.iloc[0:0]
                df = pd.concat([db_df, demo_df], ignore_index=True)
            else:
                import pandas as pd
                df = pd.DataFrame(rows)

        feat_df, y, names = split_xy(df)
        self._X = feat_df.values.astype(float)
        self._y = y.astype(float)
        self._crop_names = list(df["crop_name"])
        self._feature_names = names

    async def _train_cluster(self) -> dict:
        artifact, metrics = train_cluster_model(self._X, self._feature_names)
        self._cluster_labels = artifact.kmeans.labels_
        version = self._registry.save("cluster", artifact, metrics)
        metrics["version"] = version
        return metrics

    async def _train_risk(self) -> dict:
        # Cluster labels are needed for per-cohort residuals
        if self._cluster_labels is None:
            await self._train_cluster()

        artifact, metrics = train_risk_model(
            self._X, self._feature_names, self._cluster_labels
        )
        version = self._registry.save("risk", artifact, metrics)
        metrics["version"] = version
        return metrics

    async def _train_yield(self) -> dict:
        artifact, metrics = train_yield_model(
            self._X, self._y, self._feature_names, self._crop_names
        )
        version = self._registry.save("yield", artifact, metrics)
        metrics["version"] = version
        return metrics

    @property
    def training_yields(self) -> np.ndarray | None:
        return self._y

    @property
    def cluster_labels(self) -> np.ndarray | None:
        return self._cluster_labels
