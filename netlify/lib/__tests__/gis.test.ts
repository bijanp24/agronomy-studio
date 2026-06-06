import { describe, it, expect } from 'vitest';
import {
  vegetationIndex,
  gddAccumulation,
  microclimateSummary,
  soilMoistureProbe,
  seasonSnapshot,
  buildVraPrescription,
  type BlockInput,
  type VraBlockZone,
} from '../gis';

const ALMOND_BLOCK: BlockInput = {
  blockId: 'block-1',
  cropType: 'almond',
  soilType: 'Hanford sandy loam',
  elevationM: 85,
  season: '2025',
  irrigationZone: 'North Canal',
};

const TOMATO_BLOCK: BlockInput = {
  blockId: 'block-2',
  cropType: 'tomato',
  soilType: 'San Joaquin loam',
  elevationM: 67,
  season: '2025',
  irrigationZone: 'West Lift',
};

const HIGH_ELEV_BLOCK: BlockInput = {
  blockId: 'block-3',
  cropType: 'pistachio',
  soilType: 'Tujunga loamy sand',
  elevationM: 280,
  season: '2025',
  irrigationZone: 'North Canal',
};

// ---------------------------------------------------------------------------
// vegetationIndex
// ---------------------------------------------------------------------------

describe('vegetationIndex', () => {
  it('returns value in [0, 1] for NDVI', () => {
    const r = vegetationIndex(ALMOND_BLOCK, 'ndvi');
    expect(r.value).toBeGreaterThanOrEqual(0);
    expect(r.value).toBeLessThanOrEqual(1);
    expect(r.indexType).toBe('ndvi');
    expect(r.source).toBe('mock');
  });

  it('returns value in [0, 1] for EVI', () => {
    const r = vegetationIndex(ALMOND_BLOCK, 'evi');
    expect(r.value).toBeGreaterThanOrEqual(0);
    expect(r.value).toBeLessThanOrEqual(1);
    expect(r.indexType).toBe('evi');
  });

  it('is deterministic for the same inputs', () => {
    const r1 = vegetationIndex(ALMOND_BLOCK, 'ndvi');
    const r2 = vegetationIndex(ALMOND_BLOCK, 'ndvi');
    expect(r1.value).toBe(r2.value);
    expect(r1.cloudFree).toBe(r2.cloudFree);
  });

  it('produces different values for different blocks', () => {
    const r1 = vegetationIndex(ALMOND_BLOCK, 'ndvi');
    const r2 = vegetationIndex(TOMATO_BLOCK, 'ndvi');
    expect(r1.value).not.toBe(r2.value);
  });

  it('permanent crops have higher NDVI bias than annual crops on average', () => {
    const almondResults = Array.from({ length: 20 }, (_, i) =>
      vegetationIndex({ ...ALMOND_BLOCK, blockId: `block-${i}`, season: '2025' }, 'ndvi')
    );
    const tomatoResults = Array.from({ length: 20 }, (_, i) =>
      vegetationIndex({ ...TOMATO_BLOCK, blockId: `block-${i}`, season: '2025' }, 'ndvi')
    );
    const almondMean = almondResults.filter(r => r.cloudFree).reduce((s, r) => s + r.value, 0) / almondResults.filter(r => r.cloudFree).length;
    const tomatoMean = tomatoResults.filter(r => r.cloudFree).reduce((s, r) => s + r.value, 0) / tomatoResults.filter(r => r.cloudFree).length;
    expect(almondMean).toBeGreaterThan(tomatoMean);
  });

  it('cloud-masked result has value = 0', () => {
    let found = false;
    for (let i = 0; i < 100; i++) {
      const r = vegetationIndex({ ...ALMOND_BLOCK, blockId: `scan-${i}`, season: '2025' }, 'ndvi');
      if (!r.cloudFree) {
        expect(r.value).toBe(0);
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('assigns correct stressLevel for high-value result', () => {
    let highFound = false;
    for (let i = 0; i < 50; i++) {
      const r = vegetationIndex({ ...ALMOND_BLOCK, blockId: `stress-${i}` }, 'ndvi');
      if (r.value > 0.65) { expect(r.stressLevel).toBe('low'); highFound = true; break; }
    }
    expect(highFound).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// gddAccumulation
// ---------------------------------------------------------------------------

describe('gddAccumulation', () => {
  it('returns positive GDD for a warm-season almond block', () => {
    const r = gddAccumulation(ALMOND_BLOCK);
    expect(r.gddAccumulated).toBeGreaterThan(0);
    expect(r.gddBase).toBe(10);
    expect(r.cropThreshold).toBe(1400);
    expect(r.percentComplete).toBeGreaterThan(0);
    expect(r.percentComplete).toBeLessThanOrEqual(100);
    expect(r.source).toBe('mock');
  });

  it('is deterministic', () => {
    expect(gddAccumulation(ALMOND_BLOCK).gddAccumulated).toBe(gddAccumulation(ALMOND_BLOCK).gddAccumulated);
  });

  it('higher elevation blocks accumulate less GDD', () => {
    const low = gddAccumulation({ ...ALMOND_BLOCK, elevationM: 50 });
    const high = gddAccumulation({ ...ALMOND_BLOCK, elevationM: 400 });
    expect(low.gddAccumulated).toBeGreaterThan(high.gddAccumulated);
  });

  it('wheat has base temp 0', () => {
    const r = gddAccumulation({ ...ALMOND_BLOCK, cropType: 'wheat' });
    expect(r.gddBase).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// microclimateSummary
// ---------------------------------------------------------------------------

describe('microclimateSummary', () => {
  it('returns plausible ET in mm/day', () => {
    const r = microclimateSummary(ALMOND_BLOCK);
    expect(r.referenceEtMmDay).toBeGreaterThan(0);
    expect(r.referenceEtMmDay).toBeLessThan(15);
    expect(r.source).toBe('mock');
  });

  it('frost risk score is in [0, 1]', () => {
    const r = microclimateSummary(ALMOND_BLOCK);
    expect(r.frostRiskScore).toBeGreaterThanOrEqual(0);
    expect(r.frostRiskScore).toBeLessThanOrEqual(1);
  });

  it('high elevation blocks have higher frost risk than low elevation', () => {
    const lowElev = microclimateSummary({ ...ALMOND_BLOCK, blockId: 'low', elevationM: 10 });
    const highElev = microclimateSummary({ ...HIGH_ELEV_BLOCK, blockId: 'high', elevationM: 400 });
    expect(highElev.frostRiskScore).toBeGreaterThan(lowElev.frostRiskScore);
  });

  it('wind speed is in a reasonable range', () => {
    const r = microclimateSummary(ALMOND_BLOCK);
    expect(r.windSpeedMph).toBeGreaterThan(0);
    expect(r.windSpeedMph).toBeLessThan(25);
  });

  it('is deterministic', () => {
    const r1 = microclimateSummary(ALMOND_BLOCK);
    const r2 = microclimateSummary(ALMOND_BLOCK);
    expect(r1.referenceEtMmDay).toBe(r2.referenceEtMmDay);
    expect(r1.frostRiskScore).toBe(r2.frostRiskScore);
  });
});

// ---------------------------------------------------------------------------
// soilMoistureProbe
// ---------------------------------------------------------------------------

describe('soilMoistureProbe', () => {
  it('returns three probe depths (12, 24, 36 in)', () => {
    const r = soilMoistureProbe(ALMOND_BLOCK);
    expect(r.readings).toHaveLength(3);
    expect(r.readings[0].depthIn).toBe(12);
    expect(r.readings[1].depthIn).toBe(24);
    expect(r.readings[2].depthIn).toBe(36);
    expect(r.source).toBe('mock');
  });

  it('deficit is in [0, 100]', () => {
    const r = soilMoistureProbe(ALMOND_BLOCK);
    expect(r.deficitPct).toBeGreaterThanOrEqual(0);
    expect(r.deficitPct).toBeLessThanOrEqual(100);
  });

  it('stale is true when age > 24 h', () => {
    let staleFound = false;
    for (let i = 0; i < 100; i++) {
      const r = soilMoistureProbe({ ...ALMOND_BLOCK, blockId: `s-${i}` });
      if (r.stale) { expect(r.lastReadingAgeHours).toBeGreaterThan(24); staleFound = true; break; }
    }
    expect(staleFound).toBe(true);
  });

  it('sandy soils show lower VWC than loamy soils at same deficit', () => {
    const sandy = soilMoistureProbe({ ...ALMOND_BLOCK, soilType: 'Tujunga loamy sand', blockId: 'sandy' });
    const loamy = soilMoistureProbe({ ...ALMOND_BLOCK, soilType: 'Merced clay loam', blockId: 'loamy' });
    expect(loamy.readings[0].vwcPct).toBeGreaterThan(sandy.readings[0].vwcPct);
  });

  it('is deterministic', () => {
    expect(soilMoistureProbe(ALMOND_BLOCK).deficitPct).toBe(soilMoistureProbe(ALMOND_BLOCK).deficitPct);
  });
});

// ---------------------------------------------------------------------------
// seasonSnapshot
// ---------------------------------------------------------------------------

describe('seasonSnapshot', () => {
  it('returns a complete snapshot', () => {
    const r = seasonSnapshot(ALMOND_BLOCK);
    expect(r.blockId).toBe('block-1');
    expect(r.season).toBe('2025');
    expect(r.ndvi).toBeGreaterThanOrEqual(0);
    expect(r.gddAccumulated).toBeGreaterThan(0);
    expect(r.yieldEstimateKgHa).toBeGreaterThan(0);
    expect(r.source).toBe('mock');
  });

  it('different seasons produce different yield estimates', () => {
    const r2021 = seasonSnapshot({ ...ALMOND_BLOCK, season: '2021' });
    const r2025 = seasonSnapshot({ ...ALMOND_BLOCK, season: '2025' });
    expect(r2021.yieldEstimateKgHa).not.toBe(r2025.yieldEstimateKgHa);
  });

  it('includes season-specific note for known years', () => {
    const r = seasonSnapshot({ ...ALMOND_BLOCK, season: '2023' });
    expect(r.note).toContain('atmospheric river');
  });
});

// ---------------------------------------------------------------------------
// buildVraPrescription
// ---------------------------------------------------------------------------

describe('buildVraPrescription', () => {
  const zones: VraBlockZone[] = [
    {
      blockId: 'block-1',
      cropType: 'almond',
      coordinates: [[-119.94, 36.71], [-119.89, 36.71], [-119.89, 36.69], [-119.94, 36.69], [-119.94, 36.71]],
      rates: { nitrogenLbAc: 180, phosphorusLbAc: 40 },
    },
    {
      blockId: 'block-2',
      cropType: 'tomato',
      coordinates: [[-119.83, 36.80], [-119.78, 36.80], [-119.78, 36.78], [-119.83, 36.78], [-119.83, 36.80]],
      rates: { nitrogenLbAc: 150, potassiumLbAc: 80, seedLbAc: 2.5 },
    },
  ];

  it('returns a GeoJSON FeatureCollection with correct feature count', () => {
    const r = buildVraPrescription(zones);
    expect(r.blockCount).toBe(2);
    expect((r.geojson as { features: unknown[] }).features).toHaveLength(2);
    expect(r.format).toBe('geojson+csv');
  });

  it('CSV has header + one row per zone', () => {
    const r = buildVraPrescription(zones);
    const lines = r.csv.split('\n');
    expect(lines).toHaveLength(3); // header + 2 rows
    expect(lines[0]).toContain('nitrogen_lb_ac');
  });

  it('ISO-XML note is present', () => {
    const r = buildVraPrescription(zones);
    expect(r.isoXmlNote.length).toBeGreaterThan(10);
  });

  it('handles empty zone list', () => {
    const r = buildVraPrescription([]);
    expect(r.blockCount).toBe(0);
    expect((r.geojson as { features: unknown[] }).features).toHaveLength(0);
  });
});
