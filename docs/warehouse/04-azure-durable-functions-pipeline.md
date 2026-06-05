# ADR-04: Azure Durable Functions Ingestion Pipeline

**Issue:** #31 / #20  
**Status:** Draft — design only, no cloud provisioning in this phase  
**Date:** 2026-06-05

---

## Context

Agronomy Studio collects data from spreadsheets, screenshots, field scouts, weather
stations, and external APIs. A reliable, scalable ingestion pipeline is needed to
normalise, validate, and commit this data to the warehouse. Azure Durable Functions
(fan-out/fan-in pattern) is well-suited because:

- Each field is an independently schedulable unit of work.
- Activities can retry automatically on transient failures.
- The orchestrator survives restarts and tracks progress durably.
- CIMIS, NRCS, and WUCOLS calls fan out across many fields in parallel.

---

## Pipeline Architecture

```
Trigger
 (timer / blob upload / HTTP)
         ↓
 Orchestrator Function
  "daily-snapshot-orchestrator"
         ↓ fan-out
 ┌───────────────────────────────────────────────┐
 │  Per-field activity: "snapshot-activity"      │
 │  1. Fetch ETo from CIMIS / Open-Meteo         │
 │  2. Fetch soil profile from NRCS SSURGO       │
 │  3. Fetch crop Kc from WUCOLS seed            │
 │  4. Compute irrigation recommendation         │
 │  5. Compute stress score and yield prediction │
 │  6. Write to field_intelligence_snapshot      │
 └───────────────────────────────────────────────┘
         ↓ fan-in (all activities done)
 Post-process activity
  "report-activity"
  - Summarise skipped/failed fields
  - Emit alerts for high-stress fields
  - Trigger notification service
```

### Orchestrator pseudocode

```typescript
// daily-snapshot-orchestrator
export async function orchestrator(context: df.OrchestrationContext) {
  const fields: string[] = yield context.df.callActivity('list-active-fields', {});
  const tasks = fields.map((fieldId) =>
    context.df.callActivity('snapshot-activity', { fieldId, date: context.currentUtcDateTime }),
  );
  const results = yield context.df.Task.all(tasks);
  yield context.df.callActivity('report-activity', { results });
}
```

---

## Spreadsheet and Screenshot Ingestion

For unstructured data (scanned PDFs, photos of spray records, Excel history files):

1. **Blob trigger** fires when a file is uploaded to Azure Blob Storage.
2. **Extraction activity** calls Azure Document Intelligence (Form Recogniser) to parse tabular data from PDFs and images.
3. **Normalisation activity** calls the Transfer Hub normalisation engine (`netlify/lib/transfer.ts` or a .NET mirror) to produce canonical records.
4. **Validation activity** runs the validation engine and generates a conflict report.
5. **Human-review activity** (optional) queues conflicts for manual resolution via the Transfer Hub UI.
6. **Commit activity** writes validated records to the warehouse.

---

## Scheduling

| Pipeline | Trigger | Frequency |
|---|---|---|
| Daily field snapshot | Timer | Every day at 06:00 UTC |
| Historical back-fill | HTTP (admin) | On demand |
| Spreadsheet ingestion | Blob upload | On upload (within 5 min) |
| Screenshot ingestion | Blob upload | On upload (within 10 min) |
| Weather history archive | Timer | Weekly |

---

## Infrastructure (Terraform, not provisioned yet)

```hcl
# placeholder — see infra/azure/ when this phase begins
resource "azurerm_function_app" "agronomy_pipeline" {
  name                = "agronomy-pipeline"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  storage_account_name = azurerm_storage_account.pipeline.name
  os_type             = "linux"
  version             = "~4"
  site_config {
    application_stack { node_version = "20" }
  }
}
```

---

## Error Handling and Retries

| Scenario | Strategy |
|---|---|
| CIMIS API timeout | Retry 3× with exponential back-off; fall back to Open-Meteo |
| NRCS SSURGO unavailable | Retry 2×; use cached last-known soil profile |
| Validation failure | Log error; skip field; include in report |
| Commit failure | Retry 5× with idempotency key (date + field_id); alert on final failure |

---

## Backlog Items

- [ ] Implement `daily-snapshot-orchestrator` Azure Function
- [ ] Implement `snapshot-activity` for CIMIS + NRCS + WUCOLS fan-out
- [ ] Implement blob-triggered spreadsheet ingestion
- [ ] Wire Document Intelligence for PDF/screenshot extraction
- [ ] Add Terraform for Azure Function App, storage, and Application Insights
- [ ] Add Prometheus/Azure Monitor alerting for failed snapshots
