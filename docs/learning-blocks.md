# Spatial Learning Blocks

Agronomy Studio uses a modular spatial learning-block system. A learning block
teaches one concept, runs one deterministic calculation or simulation, and
visualizes the result over a field layer. The AI layer (later, issue #46) only
explains and routes — it never produces the numbers. Deterministic C# computes the
numbers.

## The block pattern

Every block follows the same five-part shape:

1. **Concept** — a plain-English idea (e.g. "water moves downhill").
2. **Formula** — the math behind it (e.g. `slope = rise / run`).
3. **Map Layer** — the field layer(s) the block reads and colors.
4. **Simulation** — an interactive or stepped visualization of the result.
5. **Recommendation / Learning Check** — a takeaway plus one quiz question.

## Core types

These live in `Models/LearningBlocks.cs` and `Models/MapLayers.cs`.

### `LearningBlock`
- `Id`, `Title`, `Concept`, `Formula`
- `DifficultyLevel` (`Beginner` | `Intermediate` | `Advanced`)
- `RequiredLayers` — which `FieldLayerType`s the block reads
- `Modes` — the `LearningModeContent` (beginner explanation, formula view, map view,
  simulation steps, quiz)

### `FieldLayer` (provider-neutral)
- `Id`, `Name`, `Type` (`FieldLayerType`)
- `GeometryGeoJson` — geometry as a GeoJSON string (no map-vendor binding)
- `Attributes` — open key/value bag for layer-specific values
- `Source`, `Timestamp`

### `SpatialCalculation` (deterministic engine)
Implemented in `Services/SpatialCalculations.cs`. Pure functions over plain inputs,
formatted with `CultureInfo.InvariantCulture`:
- `CalculateAreaHectares(polygon)` / `CalculatePerimeterMeters(polygon)`
- `CalculateSlopePercent(grid)` / `EstimateFlowDirection(grid)` (steepest descent)

## Data flow

```text
DemoFieldData (local/mock)  ->  FieldLayer(s)
        |
        v
SpatialCalculations (deterministic)  ->  result values
        |
        v
LearningBlock page  ->  Concept / Formula / Map / Simulation / Quiz
```

## MVP blocks

- **Boundary and Area** (`/learn/boundary-area`, issue #41) — area + perimeter from a
  demo field boundary polygon.
- **Terrain Flow** (`/learn/terrain-flow`, issue #42) — slope + flow direction over a
  small demo elevation grid.

## Scope guardrails

Per the Scope Explosion note: local/mock data only, no live APIs, no map provider, no
auth. The goal is the smallest real artifact that proves the architecture.
