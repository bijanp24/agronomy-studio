# AI Orchestration Layer

## Core Principle

**The AI layer interprets user intent and explains deterministic results.
It does not compute field measurements, acreage, slope values, application rates,
or any safety-critical agronomic value.**

All numerical results — area, perimeter, slope, population counts, irrigation depths —
come from deterministic, unit-tested services (`netlify/lib/spatial.ts`,
`netlify/lib/irrigation.ts`, etc.). The AI layer routes questions to the correct
service, then explains what the numbers mean.

```
User asks a question
        ↓
AI classifies intent → selects blockId + calculationPlan
        ↓
Deterministic math service computes result (spatial.ts, irrigation.ts, etc.)
        ↓
AI explains result in plain English  ← AI is only here
        ↓
App shows map layer, formula, simulation, recommendation
```

---

## What the AI Layer May Do

| Role | Description |
|---|---|
| **Tutor** | Explains formulas, concepts, map layers, and spatial-reasoning ideas |
| **Router** | Classifies user intent and selects the correct learning block |
| **Interpreter** | Explains deterministic calculation results in plain English |
| **Scenario assistant** | Helps compare what-if cases (but does not compute them) |
| **Content generator** | Creates quizzes, summaries, analogies, and course modules |

## What the AI Layer Must NOT Do

- Report precise acres, hectares, slope %, or perimeter values from its own reasoning
- Make regulatory or compliance decisions
- Generate chemical application recommendations
- Make safety-critical agronomic decisions
- Claim scientific accuracy without deterministic calculation or cited retrieval

---

## Structured Action Schema

The orchestration layer produces a structured `OrchestrationAction` before calling
any deterministic service. This keeps the separation explicit and testable.

```json
{
  "intent": "explain_waterlogging",
  "blockId": "terrain-flow",
  "requiredLayers": ["field-boundary", "terrain", "soil", "weather"],
  "calculationPlan": ["calculateSlope", "estimateFlowDirection", "identifyPoolingZones"],
  "explanationLevel": "beginner",
  "extractedContext": {}
}
```

Fields:

| Field | Type | Description |
|---|---|---|
| `intent` | `OrchestrationIntent` | Classified intent from user question |
| `blockId` | `BlockId \| null` | The learning block to activate |
| `requiredLayers` | `string[]` | FieldLayer ids needed for the calculation |
| `calculationPlan` | `CalculationStep[]` | Ordered list of deterministic operations |
| `explanationLevel` | `beginner \| intermediate \| advanced` | Content depth for the explanation |
| `extractedContext` | `Record<string, string>` | Entities extracted from the question |

---

## Example Flow: "Why is this lower corner getting waterlogged?"

**Step 1 — User question:**

> "Why is this lower corner getting waterlogged?"

**Step 2 — Intent classification (deterministic keyword matching):**

```
keyword "waterlogged" → intent = "explain_waterlogging"
```

**Step 3 — OrchestrationAction produced:**

```json
{
  "intent": "explain_waterlogging",
  "blockId": "terrain-flow",
  "requiredLayers": ["field-boundary", "terrain", "soil", "weather"],
  "calculationPlan": ["calculateSlope", "estimateFlowDirection", "identifyPoolingZones"],
  "explanationLevel": "beginner"
}
```

**Step 4 — Deterministic calculation:**

App routes to the `terrain-flow` block and calls `calculateTerrainFlow()` from
`netlify/lib/spatial.ts` with the field's elevation grid. The math engine identifies
pooling zones, slope percentages, and flow directions.

**Step 5 — AI explains:**

> "Water collects in low-lying areas where all surrounding terrain is higher — these are
> pooling zones. Your field has 2 pooling zone(s) with an average slope of 0.4%. This is
> a structural drainage issue. Consider a French drain, raised bed, or contour berm in
> this area. The deterministic spatial engine — not AI — located these zones from your
> elevation data."

**Step 6 — App renders:**

Map layer with pooling zones highlighted, formula view, and drainage recommendation.

---

## Implementation Files

| File | Purpose |
|---|---|
| `netlify/lib/ai-orchestration.ts` | Intent classification, action schema, orchestrate() |
| `netlify/functions/ai-orchestration-api.ts` | HTTP wrapper (`POST /api/orchestrate`) |
| `Services/AiOrchestrationService.cs` | C# Blazor client calling the orchestration API |
| `netlify/lib/spatial.ts` | Deterministic math engine (owns all numbers) |
| `netlify/lib/learning.ts` | Domain types for blocks and layers |

---

## LLM Stub

`callLlmStub()` in `ai-orchestration.ts` is intentionally a no-op. When a real
OpenAI or Gemini key is available:

1. Replace the stub with a structured-output API call.
2. Pass the `OrchestrationAction` and the deterministic result as context.
3. Ask the model to produce an explanation only — not a number.
4. Add a pre-flight check that rejects any response containing numeric field measurements
   that were not produced by the deterministic service.

The system must be auditable: a human engineer should always be able to hold the full
data flow in their head and verify where each number came from.
