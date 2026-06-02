import { describe, it, expect } from 'vitest';
import { classifyIntent, extractParams, runSearch } from '../ai-search';
import type { GatewayProviders } from '../gateway';
import type { EvapotranspirationReading, SoilProfile } from '../models';

const eto: EvapotranspirationReading = { date: '2026-06-01', eto: 0.25, airTempF: 90, source: 'CIMIS' };
const soil: SoilProfile = {
  location: { latitude: 36.7, longitude: -119.8 },
  texture: 'sandy loam',
  drainageClass: 'well drained',
  availableWaterCapacity: 0.14,
  rootZoneDepthIn: 36,
  source: 'NRCS SSURGO',
};

const mockProviders: GatewayProviders = {
  getEvapotranspiration: async () => eto,
  getForecast: async () => [{ date: '2026-06-02', eto: 0.26, precipitation: 0.2, maxTempF: 95, source: 'Open-Meteo' }],
  getSoil: async () => soil,
  getCropCoefficient: async (_id, name) => ({ cropId: 'almond', cropName: name ?? 'Almond', kc: 0.9, allowableDepletion: 0.5, rootDepthIn: 36, source: 'WUCOLS' }),
  getWaterQuality: async () => [{ location: { latitude: 36.7, longitude: -119.8 }, nitrateMgL: 12, distanceMiles: 1.2, source: 'GAMA' }],
  getDatasets: async () => [{ id: 'd1', title: 'Ag Water Use', source: 'CNRA' }],
};

describe('classifyIntent', () => {
  it('classifies irrigation questions', () => {
    expect(classifyIntent('how much water for almonds in Fresno?')).toBe('irrigation_recommendation');
  });
  it('classifies water quality questions', () => {
    expect(classifyIntent('nitrate levels near Bakersfield')).toBe('water_quality');
  });
  it('classifies soil questions', () => {
    expect(classifyIntent('what is the soil texture at 36.7, -119.8')).toBe('soil_profile');
  });
  it('falls back to location summary when a place is named', () => {
    expect(classifyIntent('tell me about Salinas')).toBe('location_summary');
  });
  it('returns unknown without keywords or place', () => {
    expect(classifyIntent('hello there')).toBe('unknown');
  });
});

describe('extractParams', () => {
  it('extracts explicit coordinates', () => {
    const p = extractParams('soil at 36.7, -119.8');
    expect(p.latitude).toBeCloseTo(36.7, 1);
    expect(p.longitude).toBeCloseTo(-119.8, 1);
  });
  it('resolves a place name to coordinates and county', () => {
    const p = extractParams('irrigation near Fresno');
    expect(p.county).toBe('Fresno');
    expect(p.latitude).toBeGreaterThan(36);
  });
  it('extracts a crop from the seed list', () => {
    expect(extractParams('water for almonds in Fresno').crop).toBe('Almond');
  });
  it('extracts ISO dates', () => {
    const p = extractParams('eto from 2026-05-01 to 2026-05-07 in Fresno');
    expect(p.startDate).toBe('2026-05-01');
    expect(p.endDate).toBe('2026-05-07');
  });
});

describe('runSearch routing', () => {
  it('routes irrigation queries through the gateway', async () => {
    const res = await runSearch('how much water for almonds in Fresno', { providers: mockProviders });
    expect(res.intent).toBe('irrigation_recommendation');
    expect(res.summary).toMatch(/Almond/);
    expect(res.sources).toContain('CIMIS');
  });

  it('asks for a location when none is given', async () => {
    const res = await runSearch('how much water should I apply', { providers: mockProviders });
    expect(res.confidence).toBeLessThan(0.5);
    expect(res.summary).toMatch(/location/i);
  });

  it('routes water-quality queries', async () => {
    const res = await runSearch('nitrate near Fresno', { providers: mockProviders });
    expect(res.intent).toBe('water_quality');
    expect(res.summary).toMatch(/nitrate/i);
  });

  it('routes dataset discovery without a location', async () => {
    const res = await runSearch('find datasets about almonds', { providers: mockProviders });
    expect(res.intent).toBe('dataset_discovery');
    expect(res.summary).toMatch(/dataset/i);
  });
});
