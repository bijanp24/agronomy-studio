import { describe, it, expect, vi, afterEach } from 'vitest';
import { getForecastEt, openMeteoAdapter, type ForecastEtAdapter } from '../fret';

function jsonOk(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
}

const openMeteoResponse = {
  daily: {
    time: ['2026-06-02', '2026-06-03'],
    et0_fao_evapotranspiration: [6.35, 7.62], // mm -> 0.25 in, 0.30 in
    precipitation_sum: [0, 25.4], // mm -> 0 in, 1.0 in
    temperature_2m_max: [95, 101],
    temperature_2m_min: [60, 64],
  },
};

describe('open-meteo forecast adapter', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('converts mm to inches and keeps fahrenheit temps', async () => {
    vi.stubGlobal('fetch', vi.fn(() => jsonOk(openMeteoResponse)));
    const readings = await getForecastEt({ latitude: 36.8, longitude: -119.7 }, { days: 2 });
    expect(readings).toHaveLength(2);
    expect(readings[0].eto).toBeCloseTo(0.25, 2);
    expect(readings[1].eto).toBeCloseTo(0.3, 2);
    expect(readings[1].precipitation).toBeCloseTo(1.0, 2);
    expect(readings[1].maxTempF).toBe(101);
    expect(readings[0].source).toBe('Open-Meteo');
  });

  it('returns empty when daily data is missing', async () => {
    vi.stubGlobal('fetch', vi.fn(() => jsonOk({})));
    expect(await openMeteoAdapter.getForecast({ latitude: 0, longitude: 0 }, 7)).toEqual([]);
  });
});

describe('swappable adapter', () => {
  it('uses an injected adapter without hitting the network', async () => {
    const stub: ForecastEtAdapter = {
      name: 'stub',
      getForecast: async () => [{ date: '2026-06-02', eto: 0.2, source: 'stub' }],
    };
    const readings = await getForecastEt({ latitude: 1, longitude: 2 }, { adapter: stub });
    expect(readings[0].source).toBe('stub');
  });
});
