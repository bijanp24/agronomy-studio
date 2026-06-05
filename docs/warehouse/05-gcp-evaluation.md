# ADR-05: Google Cloud Platform Evaluation

**Issue:** #26  
**Status:** Draft — evaluation only, no provisioning in this phase  
**Date:** 2026-06-05

---

## Scope

Evaluate Google Cloud services — BigQuery, Looker Studio, Gemini, and Vertex AI
Vector Search — as candidates for the Agronomy Studio data warehouse and AI layer.

---

## BigQuery

### Strengths for Agronomy Studio

| Capability | Relevance |
|---|---|
| Serverless, columnar storage | No infrastructure to manage; cheap cold storage |
| Standard SQL + GIS extensions | `ST_AREA`, `ST_CONTAINS`, `ST_INTERSECTS` for field geometry queries |
| Partitioned tables | Partition `field_intelligence_snapshot` by `snapshot_date` for fast range scans |
| Streaming inserts | Near-real-time ingestion from the Azure Durable Functions pipeline (cross-cloud feasible) |
| ML in BigQuery (`BQML`) | Logistic regression / boosted trees for yield prediction — no data movement |

### Candidate Tables

| Schema ADR | BigQuery table |
|---|---|
| ADR-01 daily snapshot | `agronomy.field_intelligence_snapshot` |
| ADR-02 weather/ET | `agronomy.weather_et_history` |
| ADR-02 GDD | `agronomy.growing_degree_days` |
| ADR-03 soil tests | `agronomy.soil_test_facts` |
| ADR-03 operations | `agronomy.field_operation_facts` |
| ADR-03 yield | `agronomy.yield_prediction_facts` |

### Sample Query: 7-day stress trend

```sql
SELECT
  field_id,
  snapshot_date,
  stress_score,
  AVG(stress_score) OVER (
    PARTITION BY field_id
    ORDER BY snapshot_date
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) AS stress_7d_avg
FROM `agronomy.field_intelligence_snapshot`
WHERE organization_id = @org_id
  AND snapshot_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
ORDER BY field_id, snapshot_date;
```

---

## Looker Studio

Connect Looker Studio to BigQuery for zero-code dashboards:
- Stress heat maps by field
- 7-day rolling ET vs precipitation charts
- Yield prediction vs actual comparison
- Water-quality concerns by county

This maps directly to issue #25's "saved dashboard stories" concept.

---

## Gemini (Generative AI)

### Role in Agronomy Studio

Same architecture principle as the existing AI orchestration layer (see `docs/ai-orchestration.md`):

- Gemini **explains** BigQuery results in plain English.
- Gemini **does not** compute field measurements or generate regulatory advice.
- Structured output (function calling / JSON mode) is used so Gemini returns an `OrchestrationAction`, not free-form text with fabricated numbers.

### Candidate Gemini use cases

| Use case | Safety constraint |
|---|---|
| "Summarise this field's season" | Gemini reads pre-computed snapshot data; does not recompute |
| Natural-language SQL (issue #25) | Gemini generates SQL preview; user confirms before execution |
| Quiz and explanation generation | Safe — educational content only |
| Yield outlook commentary | Must cite the deterministic prediction, not generate a new one |

---

## Vertex AI Vector Search

Store embeddings of:
- Field operation text notes
- Scouting observations
- Agronomic recommendations
- Research documents and compliance records

Enable semantic search: "Find all fields with nitrate concern and clay-loam soil from 2024–2025."

---

## Decision Criteria

| Criterion | Weight | BigQuery | Azure SQL | PostgreSQL |
|---|---|---|---|---|
| Geospatial support | High | ✅ Native GIS | ⚠️ Limited | ✅ PostGIS |
| Cost at low volume | High | ✅ Pay-per-query | ⚠️ Fixed DTU | ✅ Self-hosted |
| ML integration | Medium | ✅ BQML | ❌ | ❌ |
| Existing infra fit | Medium | ⚠️ GCP (not Azure) | ✅ Azure | ⚠️ New stack |
| Vendor lock-in risk | Medium | ⚠️ Moderate | ⚠️ Moderate | ✅ Low |

**Preliminary recommendation:** BigQuery for analytics and ML; keep operational data
(Transfer Hub records, active sessions) in PostgreSQL or Azure SQL for ACID compliance.
This is a dual-DB pattern — analytics in BigQuery, transactional in RDBMS.

---

## Next Steps (not in scope for this phase)

- [ ] Provision a BigQuery dataset in a dev GCP project
- [ ] Create the six warehouse tables from ADR-01/02/03
- [ ] Run a pilot with 90 days of historical mock data
- [ ] Evaluate Looker Studio dashboards vs custom Blazor charts
- [ ] Prototype Gemini structured-output NL→SQL flow (issue #25)
