import { describe, it, expect, vi, afterEach } from 'vitest';
import { getWaterQuality, mapFeature } from '../waterquality';

function jsonOk(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
}

const origin = { latitude: 36.75, longitude: -119.77 };

const arcgisResponse = {
  features: [
    {
      attributes: {
        WELL_ID: 'WELL-A',
        NITRATE: '12.5',
        TDS: '850',
        COUNTY: 'Fresno',
        SAMPLE_DATE: '2025-08-01',
      },
      geometry: { x: -119.78, y: 36.76 },
    },
    {
      attributes: {
        WELLID: 'WELL-B',
        NO3: 3.1,
        COUNTY: 'Fresno',
      },
      geometry: { x: -119.9, y: 36.9 },
    },
  ],
};

describe('mapFeature', () => {
  it('reads varying field names and computes distance', () => {
    const record = mapFeature(arcgisResponse.features[0], origin);
    expect(record.wellId).toBe('WELL-A');
    expect(record.nitrateMgL).toBe(12.5);
    expect(record.salinityMgL).toBe(850);
    expect(record.county).toBe('Fresno');
    expect(record.distanceMiles).toBeGreaterThan(0);
    expect(record.source).toBe('GAMA');
  });
});

describe('getWaterQuality', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns records sorted by distance', async () => {
    vi.stubGlobal('fetch', vi.fn(() => jsonOk(arcgisResponse)));
    const records = await getWaterQuality(origin, { layerUrl: 'https://example.test/layer' });
    expect(records).toHaveLength(2);
    expect(records[0].wellId).toBe('WELL-A');
    expect(records[0].distanceMiles!).toBeLessThanOrEqual(records[1].distanceMiles!);
  });

  it('throws on an ArcGIS error payload', async () => {
    vi.stubGlobal('fetch', vi.fn(() => jsonOk({ error: { message: 'Invalid layer' } })));
    await expect(getWaterQuality(origin)).rejects.toThrow(/Invalid layer/);
  });
});
