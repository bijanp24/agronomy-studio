# ---------------------------------------------------------------------------
# Model registry — versioned model serialisation + metadata persistence.
# ---------------------------------------------------------------------------

from __future__ import annotations

import hashlib
import json
import logging
import os
import pickle
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


class ModelRegistry:
    """Saves/loads models to disk and tracks active versions.

    Uses a simple on-disk JSON manifest alongside joblib-serialised artifacts.
    In production, artifact_path would point to S3 / GCS.
    """

    def __init__(self, model_dir: str, db: Any) -> None:
        self._dir = model_dir
        self._db = db
        self._active: dict[str, str] = {}   # model_type → version string
        self._models: dict[str, Any] = {}   # model_type → loaded artifact
        os.makedirs(model_dir, exist_ok=True)
        self._load_manifest()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def has_active(self, model_type: str) -> bool:
        return model_type in self._active

    def active_version(self, model_type: str) -> str | None:
        return self._active.get(model_type)

    def get(self, model_type: str) -> Any | None:
        """Return the in-memory artifact for a model type."""
        return self._models.get(model_type)

    def save(self, model_type: str, artifact: Any, metadata: dict) -> str:
        """Persist a trained model artifact and update the active pointer."""
        version = self._version_tag(model_type)
        path = os.path.join(self._dir, f"{model_type}_{version}.pkl")

        with open(path, "wb") as fh:
            pickle.dump(artifact, fh, protocol=5)

        self._active[model_type] = version
        self._models[model_type] = artifact
        self._save_manifest()

        logger.info("Saved %s model version=%s rows=%s val_rmse=%.1f",
                    model_type, version,
                    metadata.get("training_rows", "?"),
                    metadata.get("val_rmse", float("nan")))
        return version

    def load(self, model_type: str, version: str) -> Any | None:
        path = os.path.join(self._dir, f"{model_type}_{version}.pkl")
        if not os.path.exists(path):
            return None
        with open(path, "rb") as fh:
            return pickle.load(fh)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _version_tag(self, model_type: str) -> str:
        ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        return f"{model_type}-{ts}"

    def _manifest_path(self) -> str:
        return os.path.join(self._dir, "manifest.json")

    def _load_manifest(self) -> None:
        path = self._manifest_path()
        if not os.path.exists(path):
            return
        try:
            with open(path) as fh:
                manifest = json.load(fh)
            for model_type, version in manifest.get("active", {}).items():
                artifact = self.load(model_type, version)
                if artifact is not None:
                    self._active[model_type] = version
                    self._models[model_type] = artifact
                    logger.info("Loaded %s model version=%s", model_type, version)
        except Exception as exc:
            logger.warning("Could not load manifest: %s", exc)

    def _save_manifest(self) -> None:
        with open(self._manifest_path(), "w") as fh:
            json.dump({"active": self._active}, fh, indent=2)
