import { describe, it, expect } from 'vitest';
import {
  buildIrrigationRecommendation,
  buildLocationSummary,
  buildRiskSummary,
  buildSoilWaterBalance,
  type GatewayProviders,
} from '../gateway';
import { createLogger } from '../http';

const logger = createLogger('test', 'test-corr');
const point = { latitude: 36.75, longitude: -119.77 };

function providers(overrides: Partial<GatewayProviders> = {}): GatewayProviders {
  return {
    getEvapotranspiration: async () => ({ date: '2026-06-01', eto: 0.25, airTempF: 85, source: 'CIMIS' }),
    getForecast: async () => [
      { date: '2026-06-02', eto: 0.26, precipitation: 0.3, maxTempF: 95, source: 'Open-Meteo' },
      { date: '2026-06-03', eto: 0.27, precipitation: 0.0, maxTempF: 102, source: 'Open-Meteo' },
    ],
    getSoil: async () => ({
      location: point,
      texture: 'sandy loam',
      availableWaterCapacity: 0.15,
      rootZoneDepthIn: 30,
      drainageClass: 'well drained',
      hydrologicGroup: 'B',
      source: 'NRCS SSURGO',
    }),
    getCropCoefficient: async (_id, name) => ({
      cropId: 'almond',
      cropName: name ?? 'Almond',
      kc: 0.9,
      allowableDepletion: 0.5,
      rootDepthIn: 24,
      source: 'WUCOLS',
    }),
    getWaterQuality: async () => [
      { location: point, nitrateMgL: 14, distanceMiles: 1.1, source: 'GAMA' },
    ],
    getDatasets: async () => [{ id: 'd1', title: 'Ag Water Use', source: 'CNRA' }],
    ...overrides,
  };
}

describe('buildLocationSummary', () => {
  it('aggregates all services and computes irrigation', async () => {
    const summary = await buildLocationSummary(point, { cropName: 'almond' }, logger, providers());
    expect(summary.evapotranspiration?.eto).toBe(0.25);
    expect(summary.soil?.texture).toBe('sandy loam');
    expect(summary.datasets).toHaveLength(1);
    expect(summary.irrigation).toBeDefined();
    // forecast rain summed = 0.3; heat risk because 102F >= 100
    expect(summary.irrigation!.forecastRainIn).toBeCloseTo(0.3, 2);
    expect(summary.irrigation!.heatRisk).toBe(true);
    expect(summary.warnings).toBeUndefined();
  });

  it('records a warning and degrades when a provider fails', async () => {
    const summary = await buildLocationSummary(
      point,
      {},
      logger,
      providers({
        getSoil: async () => {
          throw new Error('SDA down');
        },
      }),
    );
    expect(summary.soil).toBeUndefined();
    expect(summary.warnings?.soil).toMatch(/SDA down/);
    // No soil -> no irrigation recommendation
    expect(summary.warnings?.irrigation).toBeDefined();
  });

  it('respects include flags', async () => {
    const summary = await buildLocationSummary(
      point,
      { includeDatasets: false, includeWaterQuality: false },
      logger,
      providers(),
    );
    expect(summary.datasets).toEqual([]);
    expect(summary.waterQuality).toEqual([]);
  });
});

describe('buildIrrigationRecommendation', () => {
  it('uses real-source confidence and crop coefficient', async () => {
    const rec = await buildIrrigationRecommendation({ latitude: point.latitude, longitude: point.longitude, cropName: 'almond' }, logger, providers());
    expect(rec.cropName).toBe('almond');
    expect(rec.cropEt).toBeCloseTo(0.225, 3);
    expect(rec.confidence).toBe('high');
  });

  it('honors an ETo override', async () => {
    const rec = await buildIrrigationRecommendation(
      { latitude: point.latitude, longitude: point.longitude, etoOverride: 0.4 },
      logger,
      providers(),
    );
    expect(rec.eto).toBe(0.4);
  });
});

describe('buildSoilWaterBalance', () => {
  it('projects a deficit from ET and forecast', async () => {
    const balance = await buildSoilWaterBalance(point, logger, providers());
    expect(balance.totalAvailableWaterIn).toBeCloseTo(0.15 * 30, 2);
    expect(balance.projectedDeficitIn).toBeGreaterThanOrEqual(0);
  });
});

describe('buildRiskSummary', () => {
  it('flags heat and water-quality concerns', async () => {
    const risk = await buildRiskSummary(point, logger, providers());
    expect(risk.heatRisk).toBe(true);
    expect(risk.waterQualityConcern).toBe(true);
    expect(risk.notes.length).toBeGreaterThan(0);
  });
});
