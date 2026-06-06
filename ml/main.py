# ---------------------------------------------------------------------------
# Agronomy Studio — Python ML Service
#
# Principle (mirrors ai-orchestration.ts):
#   The ML service owns ALL numeric predictions. An AI/LLM layer may explain
#   results but must never invent numbers. Model outputs carry uncertainty
#   estimates and SHAP attributions so every number is traceable.
#
# Endpoints:
#   POST /api/ml/yield/predict       Predict yield for a field+season
#   GET  /api/ml/yield/history/{id}  Historical predictions vs actuals
#   POST /api/ml/optimize/inputs     Recommend irrigation/fertilizer rates
#   POST /api/ml/risk/assess         Anomaly score for a field
#   GET  /api/ml/risk/summary        Risk across all fields (org-scoped)
#   POST /api/ml/benchmark/compare   Cohort percentile ranking
#   GET  /api/ml/benchmark/clusters  Cluster assignments
#   POST /api/ml/train/{model_type}  Trigger re-training
#   GET  /api/ml/health              Health + active model versions
# ---------------------------------------------------------------------------

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .db import Database
from .registry import ModelRegistry
from .train import TrainingRunner
from .inference import InferenceEngine
from .routes import yield_router, optimize_router, risk_router, benchmark_router, train_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("ml-service")

DB_URL = os.environ.get("DATABASE_URL")
MODEL_DIR = os.environ.get("MODEL_DIR", "/tmp/ml_models")
DEMO_MODE = DB_URL is None

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info("ML service starting (demo_mode=%s)", DEMO_MODE)
    db = Database(DB_URL)
    registry = ModelRegistry(MODEL_DIR, db)
    runner = TrainingRunner(db, registry, demo_mode=DEMO_MODE)
    engine = InferenceEngine(registry, db, demo_mode=DEMO_MODE)

    await db.connect()

    # Bootstrap: train demo models if none exist yet
    for mtype in ("yield", "risk", "cluster"):
        if not registry.has_active(mtype):
            logger.info("No active %s model found — training bootstrap model", mtype)
            await runner.run(mtype)

    app.state.db = db
    app.state.registry = registry
    app.state.runner = runner
    app.state.engine = engine

    yield

    await db.disconnect()
    logger.info("ML service shut down")


app = FastAPI(
    title="Agronomy Studio ML Service",
    version="1.0.0",
    description="Machine-learning predictions, optimisations, anomaly detection, and benchmarking.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Correlation-Id"],
)

app.include_router(yield_router,     prefix="/api/ml/yield",      tags=["yield"])
app.include_router(optimize_router,  prefix="/api/ml/optimize",   tags=["optimize"])
app.include_router(risk_router,      prefix="/api/ml/risk",       tags=["risk"])
app.include_router(benchmark_router, prefix="/api/ml/benchmark",  tags=["benchmark"])
app.include_router(train_router,     prefix="/api/ml/train",      tags=["train"])


@app.get("/api/ml/health")
async def health() -> dict:
    registry: ModelRegistry = app.state.registry
    return {
        "status": "ok",
        "demo_mode": DEMO_MODE,
        "active_models": {
            mtype: registry.active_version(mtype)
            for mtype in ("yield", "risk", "cluster")
        },
    }
