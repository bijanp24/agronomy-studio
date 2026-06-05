# Spatial Learning-Block Architecture

## Overview

Agronomy Studio converts agronomic concepts, map data, environmental models, and field
calculations into modular **learning blocks**. Each block teaches one concept, runs one
calculation or simulation, and visualises the result through a map layer or field layer.

Learning blocks are the composable building material of the education layer. They are
provider-neutral by design: data sources and map vendors are injected via adapters so
the core domain never names a specific vendor.

---

## Learning-Block Pattern

Every block supports five sections in sequence:

| Section | Purpose |
|---|---|
| **Concept** | Plain-English explanation of what the block calculates and why it matters |
| **Formula** | The mathematical expression, with variable definitions |
| **Map Layer** | A visualisation hook: boundary polygon, vector arrows, heat overlay, etc. |
| **Simulation** | What-if parameter sweep or step-by-step walkthrough |
| **Recommendation / Check** | Actionable output or a practice quiz question |

---

## Domain Interfaces

### `LearningBlock`

The top-level descriptor for a single learning block. Each block owns its inputs,
outputs, and layer references. Calculations are always performed by deterministic
services — the block definition describes *what* to compute, not *how*.

```ts
interface LearningBlock {
  id: string;
  title: string;
  concept: string;
  formula?: string;
  inputs: LearningBlockInput[];
  outputs: LearningBlockOutput[];
  mapLayers: string[];           // FieldLayer.id references
  simulationSteps?: string[];
  recommendationRules?: RecommendationRule[];
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  tags?: string[];
}
```

### `FieldLayer`

A provider-neutral representation of any field or map layer. External providers
(Google Maps, ESRI, USDA APIs, local GeoJSON) are adapted *into* this model so the
domain never references a specific vendor.

```ts
interface FieldLayer {
  id: string;
  name: string;
  type: 'boundary' | 'terrain' | 'soil' | 'weather' | 'crop' | 'operations' | 'yield' | 'custom';
  geometry?: unknown;            // GeoJSON geometry or provider-specific shape
  attributes: Record<string, unknown>;
  source?: string;               // Human-readable provider name, e.g. "local-demo"
  timestamp?: string;            // ISO 8601
}
```

### `LearningModeContent`

Rich educational content attached to each block — plain-English text, formula
markdown, simulation steps, and quiz questions.

```ts
interface LearningModeContent {
  blockId: string;
  beginnerExplanation: string;
  formulaView: string;           // Markdown with LaTeX-style formula notation
  mapView?: string;              // Short description of what the map layer shows
  simulationView?: string;
  quizQuestion?: string;
  quizAnswer?: string;
  recommendationExplanation?: string;
}
```

---

## Example Blocks

| Block ID | Concept | Key Formula | Difficulty |
|---|---|---|---|
| `boundary-area` | Field boundary defines the analysable spatial region | Shoelace + haversine area | Beginner |
| `terrain-flow` | Elevation and slope determine water movement | slope = Δelev / Δdist | Beginner |
| `weather-stress` | Temperature and ET create crop water demand | ETc = ETo × Kc | Intermediate |
| `irrigation-need` | Soil-water balance drives irrigation scheduling | net depth = RAW − rain | Intermediate |
| `management-zones` | Variable soil attributes define prescription zones | k-means on AWC, OM, pH | Advanced |
| `yield-estimate` | Limiting-factor model predicts season yield | yield = baseline × ∏ factors | Advanced |
| `carrying-capacity` | Population dynamics bound by resource limits | logistic growth / Lotka-Volterra | Advanced |

---

## Adapting External Providers

External data sources (NRCS SSURGO, CIMIS, Google Maps, local GeoJSON) return
heterogeneous shapes. Each provider is wrapped in a thin **adapter** that normalises
its output to `FieldLayer` before the learning block ever sees it.

```
External API / file
      ↓
Provider adapter (netlify/lib or local data file)
      ↓
FieldLayer (canonical)
      ↓
Learning block (calculation + content rendering)
```

No vendor name appears in `Models/Learning.cs`, `netlify/lib/learning.ts`, or any
block definition. Provider names live only in adapter files and documentation.

---

## Calculation Ownership

The AI layer (see `docs/ai-orchestration.md`) interprets user questions and selects
the correct block. **Deterministic services always own the numbers.** The AI is not
permitted to invent field measurements, acreage, slope values, or chemical
recommendations.

```
User asks a question
        ↓
AI interprets intent → picks blockId + calculationPlan
        ↓
Deterministic math service computes result
        ↓
AI explains result in plain English
        ↓
App shows map layer, formula, simulation, recommendation
```

---

## MVP Blocks

The initial MVP (local/mock data only, no live APIs, no map provider, no auth) delivers:

- **Boundary and Area** (`/learn/boundary-area`, issue #41) — area + perimeter from a
  demo field boundary polygon, implemented in `Services/SpatialCalculations.cs` (C#)
  and `netlify/lib/spatial.ts` (TypeScript).
- **Terrain Flow** (`/learn/terrain-flow`, issue #42) — slope + flow direction over a
  small demo elevation grid using the D8 steepest-descent algorithm.
- **Carrying Capacity** (`/learn`, issue #48) — logistic growth and Lotka-Volterra
  predator-prey simulation for environmental science.

Demo data lives in `Services/DemoFieldData.cs` (C# in-memory) and
`data/demo-field.json` (used by the TypeScript/Netlify spatial API).
