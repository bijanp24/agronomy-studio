// ---------------------------------------------------------------------------
// Spatial calculation engine — deterministic, unit-tested.
// This module owns ALL numerical results for learning blocks.
// The AI layer may explain these results but must never compute them.
// See docs/learning-blocks.md and docs/ai-orchestration.md.
// ---------------------------------------------------------------------------

import type { FieldLayer, LearningBlockResult } from './learning';

// ---------------------------------------------------------------------------
// Shared geometry primitives
// ---------------------------------------------------------------------------

/** A latitude/longitude coordinate pair. */
export interface LatLon {
  lat: number;
  lon: number;
}

const EARTH_RADIUS_METERS = 6_371_000;
const METERS_PER_ACRE = 4046.856422;
const METERS_PER_MILE = 1609.344;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two points in metres (haversine). */
export function haversineMeters(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

// ---------------------------------------------------------------------------
// Boundary & Area block
// ---------------------------------------------------------------------------

export interface BoundaryAreaInputs {
  /** Closed polygon ring — last point need not repeat the first. */
  ring: LatLon[];
  unit?: 'acre' | 'hectare';
}

export interface BoundaryAreaResult {
  areaAcres: number;
  areaHectares: number;
  perimeterMiles: number;
  perimeterKm: number;
  vertexCount: number;
}

/**
 * Calculate field area (shoelace on projected coordinates) and perimeter
 * (sum of haversine edge lengths).
 *
 * Area uses an equirectangular projection centred on the polygon centroid —
 * accurate to within ~0.1% for typical agricultural field sizes (<100 km²).
 */
export function calculateBoundaryArea(inputs: BoundaryAreaInputs): BoundaryAreaResult {
  const ring = inputs.ring;
  if (ring.length < 3) {
    return { areaAcres: 0, areaHectares: 0, perimeterMiles: 0, perimeterKm: 0, vertexCount: ring.length };
  }

  // Centroid latitude for equirectangular projection scale factor.
  const centroidLat = ring.reduce((s, p) => s + p.lat, 0) / ring.length;
  const cosLat = Math.cos(toRad(centroidLat));

  // Project to approximate Cartesian (metres).
  const pts = ring.map((p) => ({
    x: toRad(p.lon) * EARTH_RADIUS_METERS * cosLat,
    y: toRad(p.lat) * EARTH_RADIUS_METERS,
  }));

  // Shoelace formula for signed area.
  let shoelace = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    shoelace += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  const areaM2 = Math.abs(shoelace) / 2;

  // Perimeter: sum haversine distances between consecutive vertices.
  let perimeterM = 0;
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    perimeterM += haversineMeters(ring[i], ring[j]);
  }

  return {
    areaAcres: round4(areaM2 / METERS_PER_ACRE),
    areaHectares: round4(areaM2 / 10_000),
    perimeterMiles: round4(perimeterM / METERS_PER_MILE),
    perimeterKm: round4(perimeterM / 1000),
    vertexCount: ring.length,
  };
}

/** Build a `LearningBlockResult` from boundary area inputs + demo layer. */
export function runBoundaryAreaBlock(
  ring: LatLon[],
  unit: 'acre' | 'hectare' = 'acre',
): LearningBlockResult {
  const calc = calculateBoundaryArea({ ring, unit });

  const outputLayer: FieldLayer = {
    id: 'output-boundary-area',
    name: 'Field Boundary',
    type: 'boundary',
    geometry: {
      type: 'Polygon',
      coordinates: [[...ring.map((p) => [p.lon, p.lat]), [ring[0].lon, ring[0].lat]]],
    },
    attributes: {
      areaAcres: calc.areaAcres,
      areaHectares: calc.areaHectares,
      perimeterMiles: calc.perimeterMiles,
      perimeterKm: calc.perimeterKm,
    },
    source: 'spatial-engine',
  };

  const primary = unit === 'acre' ? calc.areaAcres : calc.areaHectares;
  const unitLabel = unit === 'acre' ? 'acres' : 'hectares';

  return {
    blockId: 'boundary-area',
    computed: {
      areaAcres: calc.areaAcres,
      areaHectares: calc.areaHectares,
      perimeterMiles: calc.perimeterMiles,
      perimeterKm: calc.perimeterKm,
      vertexCount: calc.vertexCount,
    },
    outputLayers: [outputLayer],
    explanation: `This field covers ${primary.toFixed(2)} ${unitLabel} with a perimeter of ${calc.perimeterMiles.toFixed(2)} miles.`,
  };
}

// ---------------------------------------------------------------------------
// Terrain Flow block
// ---------------------------------------------------------------------------

export interface ElevationGrid {
  /** Row-major elevation values in metres. Row 0 = northernmost row. */
  values: number[][];
  /** Size of each grid cell in metres (assumed square). */
  cellSizeMeters: number;
  /** Lat/lon of the top-left (NW) corner. */
  originLat: number;
  originLon: number;
}

export interface SlopePoint {
  row: number;
  col: number;
  lat: number;
  lon: number;
  elevationM: number;
  /** Slope in percent (rise / run × 100). */
  slopePercent: number;
  /** Compass bearing of steepest descent in degrees (0 = north, 90 = east). */
  flowBearing: number;
  isPoolingZone: boolean;
  isRunoffZone: boolean;
}

export interface TerrainFlowResult {
  points: SlopePoint[];
  minSlopePercent: number;
  maxSlopePercent: number;
  avgSlopePercent: number;
  poolingZoneCount: number;
  runoffZoneCount: number;
}

const RUNOFF_SLOPE_THRESHOLD = 3; // % slope above which runoff risk is flagged

/**
 * Compute slope, flow direction, pooling zones, and runoff zones from a
 * regular elevation grid. Uses a simple D8 (8-direction) flow algorithm.
 *
 * Returns one `SlopePoint` per interior grid cell (edge cells are skipped
 * because they lack full 3×3 neighbourhoods).
 */
export function calculateTerrainFlow(grid: ElevationGrid): TerrainFlowResult {
  const rows = grid.values.length;
  const cols = grid.values[0]?.length ?? 0;

  if (rows < 3 || cols < 3) {
    return {
      points: [],
      minSlopePercent: 0,
      maxSlopePercent: 0,
      avgSlopePercent: 0,
      poolingZoneCount: 0,
      runoffZoneCount: 0,
    };
  }

  // 8 neighbour offsets: [dr, dc, bearing, distanceFactor]
  // Cardinal = 1×cellSize; diagonal = √2×cellSize
  const NEIGHBOURS: [number, number, number, number][] = [
    [-1, 0, 0, 1],      // N
    [-1, 1, 45, Math.SQRT2],  // NE
    [0, 1, 90, 1],      // E
    [1, 1, 135, Math.SQRT2], // SE
    [1, 0, 180, 1],     // S
    [1, -1, 225, Math.SQRT2], // SW
    [0, -1, 270, 1],    // W
    [-1, -1, 315, Math.SQRT2], // NW
  ];

  const points: SlopePoint[] = [];

  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      const elev = grid.values[r][c];

      let maxDrop = -Infinity;
      let flowBearing = 0;
      let isPooling = true;

      let slopeSumPercent = 0;
      let slopeCount = 0;

      for (const [dr, dc, bearing, distFactor] of NEIGHBOURS) {
        const neighbourElev = grid.values[r + dr][c + dc];
        const drop = elev - neighbourElev; // positive = downhill
        const distM = grid.cellSizeMeters * distFactor;
        const slopePercent = (drop / distM) * 100;

        slopeSumPercent += Math.abs(slopePercent);
        slopeCount++;

        if (neighbourElev < elev) isPooling = false; // at least one neighbour is lower
        if (drop > maxDrop) {
          maxDrop = drop;
          flowBearing = bearing;
        }
      }

      const avgNeighbourSlopePercent = slopeCount > 0 ? slopeSumPercent / slopeCount : 0;

      const lat = grid.originLat - (r * grid.cellSizeMeters) / 111_320;
      const lon =
        grid.originLon +
        (c * grid.cellSizeMeters) / (111_320 * Math.cos(toRad(lat)));

      points.push({
        row: r,
        col: c,
        lat: round4(lat),
        lon: round4(lon),
        elevationM: elev,
        slopePercent: round4(avgNeighbourSlopePercent),
        flowBearing,
        isPoolingZone: isPooling,
        isRunoffZone: avgNeighbourSlopePercent > RUNOFF_SLOPE_THRESHOLD,
      });
    }
  }

  const slopes = points.map((p) => p.slopePercent);
  const poolingCount = points.filter((p) => p.isPoolingZone).length;
  const runoffCount = points.filter((p) => p.isRunoffZone).length;

  return {
    points,
    minSlopePercent: round4(Math.min(...slopes)),
    maxSlopePercent: round4(Math.max(...slopes)),
    avgSlopePercent: round4(slopes.reduce((s, v) => s + v, 0) / (slopes.length || 1)),
    poolingZoneCount: poolingCount,
    runoffZoneCount: runoffCount,
  };
}

/** Build a `LearningBlockResult` from a terrain flow calculation. */
export function runTerrainFlowBlock(grid: ElevationGrid): LearningBlockResult {
  const result = calculateTerrainFlow(grid);

  const slopeLayer: FieldLayer = {
    id: 'output-terrain-slope',
    name: 'Terrain Slope',
    type: 'terrain',
    geometry: null as unknown as FieldLayer['geometry'],
    attributes: {
      points: result.points,
      minSlopePercent: result.minSlopePercent,
      maxSlopePercent: result.maxSlopePercent,
      avgSlopePercent: result.avgSlopePercent,
    },
    source: 'spatial-engine',
  };

  const poolingLayer: FieldLayer = {
    id: 'output-terrain-pooling',
    name: 'Pooling Zones',
    type: 'terrain',
    geometry: null as unknown as FieldLayer['geometry'],
    attributes: {
      zones: result.points.filter((p) => p.isPoolingZone),
      count: result.poolingZoneCount,
    },
    source: 'spatial-engine',
  };

  const runoffLayer: FieldLayer = {
    id: 'output-terrain-runoff',
    name: 'Runoff Risk Zones',
    type: 'terrain',
    geometry: null as unknown as FieldLayer['geometry'],
    attributes: {
      zones: result.points.filter((p) => p.isRunoffZone),
      count: result.runoffZoneCount,
    },
    source: 'spatial-engine',
  };

  const warning =
    result.points.length === 0
      ? 'Elevation grid too small — need at least 3×3 cells for terrain flow analysis.'
      : undefined;

  return {
    blockId: 'terrain-flow',
    computed: {
      minSlopePercent: result.minSlopePercent,
      maxSlopePercent: result.maxSlopePercent,
      avgSlopePercent: result.avgSlopePercent,
      poolingZoneCount: result.poolingZoneCount,
      runoffZoneCount: result.runoffZoneCount,
      analyzedPoints: result.points.length,
    },
    outputLayers: [slopeLayer, poolingLayer, runoffLayer],
    explanation:
      result.points.length === 0
        ? 'Insufficient elevation data for terrain analysis.'
        : `Average slope is ${result.avgSlopePercent.toFixed(1)}% ` +
          `(range ${result.minSlopePercent.toFixed(1)}%–${result.maxSlopePercent.toFixed(1)}%). ` +
          `${result.poolingZoneCount} pooling zone(s) and ` +
          `${result.runoffZoneCount} runoff-risk zone(s) identified.`,
    warning,
  };
}

// ---------------------------------------------------------------------------
// Environmental science block — carrying capacity + predator-prey
// ---------------------------------------------------------------------------

export interface LogisticGrowthInputs {
  initialPopulation: number;
  carryingCapacity: number;
  growthRate: number;
  steps: number;
  stepSize?: number; // time units per step, default 1
}

export interface PopulationStep {
  t: number;
  population: number;
}

/** Simulate logistic population growth using Euler integration. */
export function simulateLogisticGrowth(inputs: LogisticGrowthInputs): PopulationStep[] {
  const { initialPopulation: n0, carryingCapacity: K, growthRate: r, steps } = inputs;
  const dt = inputs.stepSize ?? 1;
  const results: PopulationStep[] = [{ t: 0, population: round4(n0) }];
  let N = n0;
  for (let i = 1; i <= steps; i++) {
    const dN = r * N * (1 - N / K) * dt;
    N = Math.max(0, N + dN);
    results.push({ t: i * dt, population: round4(N) });
  }
  return results;
}

export interface LotkaVolterraInputs {
  preyPopulation: number;
  predatorPopulation: number;
  /** Prey intrinsic growth rate. */
  alpha: number;
  /** Predation rate (per predator-prey encounter). */
  beta: number;
  /** Predator reproduction rate per predator-prey encounter. */
  delta: number;
  /** Predator death rate. */
  gamma: number;
  steps: number;
  stepSize?: number;
}

export interface PredatorPreyStep {
  t: number;
  prey: number;
  predator: number;
}

/** Simulate Lotka-Volterra predator-prey dynamics using Euler integration. */
export function simulateLotkaVolterra(inputs: LotkaVolterraInputs): PredatorPreyStep[] {
  const { preyPopulation: x0, predatorPopulation: y0, alpha, beta, delta, gamma, steps } = inputs;
  const dt = inputs.stepSize ?? 1;
  const results: PredatorPreyStep[] = [{ t: 0, prey: round4(x0), predator: round4(y0) }];
  let X = x0;
  let Y = y0;
  for (let i = 1; i <= steps; i++) {
    const dX = (alpha * X - beta * X * Y) * dt;
    const dY = (delta * X * Y - gamma * Y) * dt;
    X = Math.max(0, X + dX);
    Y = Math.max(0, Y + dY);
    results.push({ t: i * dt, prey: round4(X), predator: round4(Y) });
  }
  return results;
}

export interface CarryingCapacityInputs {
  mode: 'logistic' | 'predator-prey';
  logistic?: LogisticGrowthInputs;
  lotkaVolterra?: LotkaVolterraInputs;
}

/** Build a `LearningBlockResult` for the carrying-capacity / env-science block. */
export function runCarryingCapacityBlock(inputs: CarryingCapacityInputs): LearningBlockResult {
  if (inputs.mode === 'logistic' && inputs.logistic) {
    const series = simulateLogisticGrowth(inputs.logistic);
    const finalPop = series[series.length - 1]?.population ?? 0;
    const K = inputs.logistic.carryingCapacity;
    const pctK = K > 0 ? round4((finalPop / K) * 100) : 0;

    return {
      blockId: 'carrying-capacity',
      computed: {
        finalPopulation: finalPop,
        carryingCapacity: K,
        percentOfCarryingCapacity: pctK,
        steps: series.length - 1,
      },
      outputLayers: [
        {
          id: 'output-logistic-series',
          name: 'Logistic Growth Series',
          type: 'custom',
          geometry: null as unknown as FieldLayer['geometry'],
          attributes: { series },
          source: 'spatial-engine',
        },
      ],
      explanation:
        `After ${inputs.logistic.steps} time steps the population reached ${finalPop.toFixed(0)}, ` +
        `which is ${pctK.toFixed(1)}% of carrying capacity (K = ${K}).`,
    };
  }

  if (inputs.mode === 'predator-prey' && inputs.lotkaVolterra) {
    const series = simulateLotkaVolterra(inputs.lotkaVolterra);
    const last = series[series.length - 1];

    return {
      blockId: 'carrying-capacity',
      computed: {
        finalPrey: last?.prey ?? 0,
        finalPredator: last?.predator ?? 0,
        steps: series.length - 1,
      },
      outputLayers: [
        {
          id: 'output-lotka-volterra-series',
          name: 'Predator-Prey Series',
          type: 'custom',
          geometry: null as unknown as FieldLayer['geometry'],
          attributes: { series },
          source: 'spatial-engine',
        },
      ],
      explanation:
        `After ${inputs.lotkaVolterra.steps} time steps: prey = ${last?.prey.toFixed(0)}, predators = ${last?.predator.toFixed(0)}.`,
    };
  }

  return {
    blockId: 'carrying-capacity',
    computed: {},
    outputLayers: [],
    warning: 'No valid inputs provided for carrying-capacity block.',
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
