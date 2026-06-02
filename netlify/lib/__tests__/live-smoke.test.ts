import { describe, it, expect } from 'vitest';
import { getForecastEt } from '../fret';
import { searchPackages } from '../cnra';
import { getSoilProfile } from '../soil';
import { getCurrentEto, getCimisAppKey } from '../cimis';
import { getWaterQuality, getGamaLayerUrl } from '../waterquality';

// Opt-in network smoke tests. Skipped by default; run with:
//   AGRONOMY_LIVE_TESTS=1 npm test   (or `npm run test:live`)
// These hit the real public APIs and validate the live response shape still
// maps to our normalized models. Keyed/spatial services skip when unavailable.
const live = process.env.AGRONOMY_LIVE_TESTS === '1';

const FRESNO = { latitude: 36.7378, longitude: -119.7871 };

describe.skipIf(!live)('live smoke', () => {
  it('Open-Meteo returns daily forecast ET', async () => {
    const readings = await getForecastEt(FRESNO, { days: 3 });
    expect(readings.length).toBeGreaterThan(0);
    expect(typeof readings[0].eto).toBe('number');
  }, 20000);

  it('CNRA CKAN returns datasets for a query', async () => {
    const datasets = await searchPackages('agriculture', { rows: 3 });
    expect(datasets.length).toBeGreaterThan(0);
    expect(datasets[0].source).toBe('CNRA');
  }, 20000);

  it('NRCS SDA returns a soil profile for a Central Valley point', async () => {
    const profile = await getSoilProfile(FRESNO);
    expect(profile).not.toBeNull();
    expect(profile!.availableWaterCapacity).toBeGreaterThan(0);
  }, 30000);

  it.skipIf(!getCimisAppKey())('CIMIS returns a recent ETo reading', async () => {
    const reading = await getCurrentEto(FRESNO);
    expect(reading === null || typeof reading.eto === 'number').toBe(true);
  }, 30000);

  it.skipIf(!process.env.GAMA_ARCGIS_URL)('GAMA layer responds to a spatial query', async () => {
    const records = await getWaterQuality(FRESNO, { layerUrl: getGamaLayerUrl(), radiusMiles: 3 });
    expect(Array.isArray(records)).toBe(true);
  }, 30000);
});
