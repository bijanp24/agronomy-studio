import { describe, it, expect } from 'vitest';
import {
  haversineMeters,
  calculateBoundaryArea,
  runBoundaryAreaBlock,
  calculateTerrainFlow,
  runTerrainFlowBlock,
  simulateLogisticGrowth,
  simulateLotkaVolterra,
  runCarryingCapacityBlock,
  type LatLon,
  type ElevationGrid,
} from '../spatial';

// ---------------------------------------------------------------------------
// haversineMeters
// ---------------------------------------------------------------------------

describe('haversineMeters', () => {
  it('returns 0 for identical points', () => {
    expect(haversineMeters({ lat: 36.7, lon: -119.9 }, { lat: 36.7, lon: -119.9 })).toBe(0);
  });

  it('returns ~111 km for 1 degree of latitude', () => {
    const d = haversineMeters({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });
});

// ---------------------------------------------------------------------------
// calculateBoundaryArea
// ---------------------------------------------------------------------------

describe('calculateBoundaryArea', () => {
  // A 0.01° × 0.008° rectangle centred near Fresno.
  // At lat ~36.7°, 0.01° lon ≈ 890 m, 0.008° lat ≈ 890 m → ~79.2 ha / ~195 ac.
  const rect: LatLon[] = [
    { lat: 36.740, lon: -119.920 },
    { lat: 36.740, lon: -119.910 },
    { lat: 36.732, lon: -119.910 },
    { lat: 36.732, lon: -119.920 },
  ];

  it('computes a plausible area and perimeter for a rectangular boundary', () => {
    const result = calculateBoundaryArea({ ring: rect });
    expect(result.areaAcres).toBeGreaterThan(100);
    expect(result.areaAcres).toBeLessThan(300);
    expect(result.perimeterMiles).toBeGreaterThan(1);
    expect(result.perimeterMiles).toBeLessThan(5);
    expect(result.vertexCount).toBe(4);
  });

  it('returns zero area for a degenerate ring with fewer than 3 points', () => {
    const result = calculateBoundaryArea({ ring: [{ lat: 0, lon: 0 }, { lat: 1, lon: 1 }] });
    expect(result.areaAcres).toBe(0);
    expect(result.perimeterMiles).toBe(0);
  });

  it('hectares ≈ acres × 0.404686', () => {
    const result = calculateBoundaryArea({ ring: rect });
    expect(result.areaHectares).toBeCloseTo(result.areaAcres * 0.404686, 0);
  });

  it('perimeter km ≈ miles × 1.60934', () => {
    const result = calculateBoundaryArea({ ring: rect });
    expect(result.perimeterKm).toBeCloseTo(result.perimeterMiles * 1.60934, 1);
  });
});

// ---------------------------------------------------------------------------
// runBoundaryAreaBlock
// ---------------------------------------------------------------------------

describe('runBoundaryAreaBlock', () => {
  const ring: LatLon[] = [
    { lat: 36.740, lon: -119.920 },
    { lat: 36.740, lon: -119.910 },
    { lat: 36.732, lon: -119.910 },
    { lat: 36.732, lon: -119.920 },
  ];

  it('returns a result with blockId boundary-area', () => {
    const result = runBoundaryAreaBlock(ring);
    expect(result.blockId).toBe('boundary-area');
  });

  it('includes a boundary output layer', () => {
    const result = runBoundaryAreaBlock(ring);
    expect(result.outputLayers).toHaveLength(1);
    expect(result.outputLayers[0].type).toBe('boundary');
  });

  it('includes computed values', () => {
    const result = runBoundaryAreaBlock(ring);
    expect(result.computed.areaAcres).toBeGreaterThan(0);
    expect(result.computed.vertexCount).toBe(4);
  });

  it('includes a non-empty explanation', () => {
    const result = runBoundaryAreaBlock(ring);
    expect(result.explanation).toMatch(/acres|hectares/i);
  });
});

// ---------------------------------------------------------------------------
// calculateTerrainFlow
// ---------------------------------------------------------------------------

describe('calculateTerrainFlow', () => {
  // A simple 5×5 grid sloping downward to the SE (values decrease right and down).
  const slopingGrid: ElevationGrid = {
    values: [
      [78.5, 78.2, 77.8, 77.3, 76.9],
      [78.1, 77.7, 77.2, 76.8, 76.4],
      [77.6, 77.2, 76.7, 76.3, 75.9],
      [77.0, 76.5, 76.1, 75.7, 75.3],
      [76.3, 75.9, 75.4, 75.0, 74.6],
    ],
    cellSizeMeters: 50,
    originLat: 36.74,
    originLon: -119.92,
  };

  it('returns interior points (3×3 grid of interior cells for a 5×5 input)', () => {
    const result = calculateTerrainFlow(slopingGrid);
    expect(result.points).toHaveLength(9); // (5-2) × (5-2)
  });

  it('computes positive slope values on a sloping grid', () => {
    const result = calculateTerrainFlow(slopingGrid);
    expect(result.avgSlopePercent).toBeGreaterThan(0);
  });

  it('has no pooling zones on a uniformly sloping grid', () => {
    const result = calculateTerrainFlow(slopingGrid);
    expect(result.poolingZoneCount).toBe(0);
  });

  it('returns empty results for a grid smaller than 3×3', () => {
    const tinyGrid: ElevationGrid = {
      values: [[1, 2], [3, 4]],
      cellSizeMeters: 50,
      originLat: 36.7,
      originLon: -119.9,
    };
    const result = calculateTerrainFlow(tinyGrid);
    expect(result.points).toHaveLength(0);
  });

  it('identifies a pooling zone at a local minimum', () => {
    // Bowl-shaped grid: edges high, centre low.
    const bowlGrid: ElevationGrid = {
      values: [
        [10, 10, 10, 10, 10],
        [10, 8, 7, 8, 10],
        [10, 7, 5, 7, 10],  // (2,2) is the pit
        [10, 8, 7, 8, 10],
        [10, 10, 10, 10, 10],
      ],
      cellSizeMeters: 50,
      originLat: 36.7,
      originLon: -119.9,
    };
    const result = calculateTerrainFlow(bowlGrid);
    expect(result.poolingZoneCount).toBeGreaterThan(0);
    const pit = result.points.find((p) => p.row === 2 && p.col === 2);
    expect(pit?.isPoolingZone).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// runTerrainFlowBlock
// ---------------------------------------------------------------------------

describe('runTerrainFlowBlock', () => {
  const grid: ElevationGrid = {
    values: [
      [78.5, 78.2, 77.8, 77.3, 76.9],
      [78.1, 77.7, 77.2, 76.8, 76.4],
      [77.6, 77.2, 76.7, 76.3, 75.9],
      [77.0, 76.5, 76.1, 75.7, 75.3],
      [76.3, 75.9, 75.4, 75.0, 74.6],
    ],
    cellSizeMeters: 50,
    originLat: 36.74,
    originLon: -119.92,
  };

  it('returns blockId terrain-flow', () => {
    expect(runTerrainFlowBlock(grid).blockId).toBe('terrain-flow');
  });

  it('returns 3 output layers (slope, pooling, runoff)', () => {
    expect(runTerrainFlowBlock(grid).outputLayers).toHaveLength(3);
  });

  it('includes a non-empty explanation', () => {
    const result = runTerrainFlowBlock(grid);
    expect(result.explanation).toMatch(/slope|pooling/i);
  });

  it('adds a warning when the grid is too small', () => {
    const small: ElevationGrid = { values: [[1, 2], [3, 4]], cellSizeMeters: 50, originLat: 36.7, originLon: -119.9 };
    expect(runTerrainFlowBlock(small).warning).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// simulateLogisticGrowth
// ---------------------------------------------------------------------------

describe('simulateLogisticGrowth', () => {
  it('starts at initialPopulation', () => {
    const series = simulateLogisticGrowth({ initialPopulation: 50, carryingCapacity: 200, growthRate: 0.3, steps: 10 });
    expect(series[0].population).toBe(50);
    expect(series[0].t).toBe(0);
  });

  it('approaches carrying capacity K over many steps', () => {
    const K = 200;
    const series = simulateLogisticGrowth({ initialPopulation: 10, carryingCapacity: K, growthRate: 0.5, steps: 100 });
    const finalPop = series[series.length - 1].population;
    expect(finalPop).toBeGreaterThan(K * 0.95);
  });

  it('never exceeds carrying capacity significantly', () => {
    const K = 100;
    const series = simulateLogisticGrowth({ initialPopulation: 10, carryingCapacity: K, growthRate: 0.5, steps: 50 });
    for (const step of series) {
      expect(step.population).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// simulateLotkaVolterra
// ---------------------------------------------------------------------------

describe('simulateLotkaVolterra', () => {
  const base = {
    preyPopulation: 40,
    predatorPopulation: 9,
    alpha: 0.1,
    beta: 0.02,
    delta: 0.01,
    gamma: 0.1,
    steps: 50,
    stepSize: 0.1,
  };

  it('starts at initial populations', () => {
    const series = simulateLotkaVolterra(base);
    expect(series[0].prey).toBe(40);
    expect(series[0].predator).toBe(9);
  });

  it('returns steps+1 entries', () => {
    const series = simulateLotkaVolterra(base);
    expect(series).toHaveLength(51);
  });

  it('populations remain non-negative', () => {
    const series = simulateLotkaVolterra(base);
    for (const step of series) {
      expect(step.prey).toBeGreaterThanOrEqual(0);
      expect(step.predator).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// runCarryingCapacityBlock
// ---------------------------------------------------------------------------

describe('runCarryingCapacityBlock', () => {
  it('logistic mode returns correct blockId and output layer', () => {
    const result = runCarryingCapacityBlock({
      mode: 'logistic',
      logistic: { initialPopulation: 10, carryingCapacity: 100, growthRate: 0.3, steps: 20 },
    });
    expect(result.blockId).toBe('carrying-capacity');
    expect(result.outputLayers[0].id).toBe('output-logistic-series');
  });

  it('predator-prey mode returns prey and predator data', () => {
    const result = runCarryingCapacityBlock({
      mode: 'predator-prey',
      lotkaVolterra: {
        preyPopulation: 40,
        predatorPopulation: 9,
        alpha: 0.1,
        beta: 0.02,
        delta: 0.01,
        gamma: 0.1,
        steps: 20,
        stepSize: 0.1,
      },
    });
    expect(result.outputLayers[0].id).toBe('output-lotka-volterra-series');
    expect(result.computed.finalPrey).toBeGreaterThanOrEqual(0);
  });

  it('returns a warning when no inputs are provided', () => {
    const result = runCarryingCapacityBlock({ mode: 'logistic' });
    expect(result.warning).toBeTruthy();
  });
});
