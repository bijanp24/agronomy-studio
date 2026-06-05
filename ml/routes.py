# ---------------------------------------------------------------------------
# FastAPI route handlers — thin HTTP layer, delegates to InferenceEngine.
# ---------------------------------------------------------------------------

from __future__ import annotations

from typing import Annotated
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from .explain import (
    build_yield_explanation, explain_optimization,
    explain_risk, explain_benchmark, DISCLAIMER,
)
from .train import TrainingRunner, ModelType

# ---------------------------------------------------------------------------
# Yield
# ---------------------------------------------------------------------------

yield_router = APIRouter()


class YieldPredictRequest(BaseModel):
    field_id: str
    crop_name: str
    crop_year: int = Field(ge=2000, le=2100)
    features: dict | None = None   # optional override for inference-time features


@yield_router.post("/predict")
async def yield_predict(req: YieldPredictRequest, request: Request) -> dict:
    engine = request.app.state.engine
    try:
        result = await engine.yield_predict(
            req.field_id, req.crop_name, req.crop_year, req.features
        )
        explain = await build_yield_explanation(result)
        return {**result, **explain}
    except RuntimeError as e:
        raise HTTPException(503, str(e))


@yield_router.get("/history/{field_id}")
async def yield_history(field_id: str, request: Request) -> dict:
    db = request.app.state.db
    rows = await db.fetch(
        "SELECT * FROM yield_prediction_facts WHERE field_id=$1 ORDER BY crop_year DESC, prediction_date DESC",
        field_id,
    )
    return {"field_id": field_id, "history": rows}


# ---------------------------------------------------------------------------
# Input optimization
# ---------------------------------------------------------------------------

optimize_router = APIRouter()


class OptimizeRequest(BaseModel):
    field_id: str
    crop_name: str
    crop_year: int = Field(ge=2000, le=2100)


@optimize_router.post("/inputs")
async def optimize_inputs(req: OptimizeRequest, request: Request) -> dict:
    engine = request.app.state.engine
    try:
        result = await engine.optimize_inputs(req.field_id, req.crop_name, req.crop_year)
        explanation = explain_optimization(
            current_irrigation_in=result["current_irrigation_in"],
            rec_irrigation_in=result["rec_irrigation_in"],
            current_n=result["current_nitrogen_lb_ac"],
            rec_n=result["rec_nitrogen_lb_ac"],
            expected_gain_pct=result["expected_yield_gain_pct"],
            confidence=result["confidence"],
        )
        return {**result, "explanation": explanation, "disclaimer": DISCLAIMER}
    except RuntimeError as e:
        raise HTTPException(503, str(e))


# ---------------------------------------------------------------------------
# Risk / anomaly
# ---------------------------------------------------------------------------

risk_router = APIRouter()


class RiskAssessRequest(BaseModel):
    field_id: str
    crop_name: str
    crop_year: int = Field(ge=2000, le=2100)


@risk_router.post("/assess")
async def risk_assess(req: RiskAssessRequest, request: Request) -> dict:
    engine = request.app.state.engine
    try:
        result = await engine.risk_assess(req.field_id, req.crop_name, req.crop_year)
        explanation = explain_risk(
            risk_label=result["risk_label"],
            anomaly_score=result["anomaly_score"],
            top_risk_factors=result["top_risk_factors"],
            residual_zscore=result["residual_zscore"],
        )
        return {**result, "explanation": explanation, "disclaimer": DISCLAIMER}
    except RuntimeError as e:
        raise HTTPException(503, str(e))


@risk_router.get("/summary")
async def risk_summary(request: Request, org_id: str | None = None,
                       crop_year: int = 2026) -> dict:
    engine = request.app.state.engine
    results = await engine.risk_summary(org_id, crop_year)
    return {"crop_year": crop_year, "fields": results}


# ---------------------------------------------------------------------------
# Benchmarking
# ---------------------------------------------------------------------------

benchmark_router = APIRouter()


class BenchmarkRequest(BaseModel):
    field_id: str
    crop_name: str
    crop_year: int = Field(ge=2000, le=2100)
    yield_kg_ha: float | None = None


@benchmark_router.post("/compare")
async def benchmark_compare(req: BenchmarkRequest, request: Request) -> dict:
    engine = request.app.state.engine
    try:
        result = await engine.benchmark(
            req.field_id, req.crop_name, req.crop_year, req.yield_kg_ha
        )
        explanation = explain_benchmark(
            percentile_rank=result["percentile_rank"],
            cohort_size=result["cohort_size"],
            cluster_name=result["cluster_name"],
            yield_kg_ha=result["yield_kg_ha"],
        )
        return {**result, "explanation": explanation, "disclaimer": DISCLAIMER}
    except RuntimeError as e:
        raise HTTPException(503, str(e))


@benchmark_router.get("/clusters")
async def benchmark_clusters(request: Request) -> dict:
    engine = request.app.state.engine
    clusters = await engine.all_clusters()
    return {"clusters": clusters}


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

train_router = APIRouter()


@train_router.post("/{model_type}")
async def trigger_training(model_type: str, request: Request) -> dict:
    if model_type not in ("yield", "risk", "cluster", "all"):
        raise HTTPException(400, f"Unknown model_type '{model_type}'. Use yield|risk|cluster|all")

    runner: TrainingRunner = request.app.state.runner
    types: list[ModelType] = (
        ["cluster", "risk", "yield"] if model_type == "all" else [model_type]  # type: ignore[list-item]
    )

    results = {}
    for mtype in types:
        metrics = await runner.run(mtype)
        results[mtype] = metrics

    return {"status": "ok", "results": results}
