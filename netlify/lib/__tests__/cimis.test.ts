import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCurrentEto, getEtoHistory, getStations } from '../cimis';

function jsonOk(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response);
}

const dataResponse = {
  Data: {
    Providers: [
      {
        Name: 'cimis',
        Type: 'station',
        Records: [
          {
            Date: '2026-05-30',
            Station: '80',
            DayAsceEto: { Value: '0.21', Unit: '(in)' },
            DayPrecip: { Value: '0', Unit: '(in)' },
            DayAirTmpAvg: { Value: '72.4', Unit: '(F)' },
            DaySolRadAvg: { Value: '620', Unit: '(Ly/day)' },
          },
          {
            Date: '2026-05-31',
            Station: '80',
            DayAsceEto: { Value: '0.26', Unit: '(in)' },
            DayPrecip: { Value: '0.04', Unit: '(in)' },
            DayAirTmpAvg: { Value: '78.1', Unit: '(F)' },
          },
          {
            Date: '2026-06-01',
            Station: '80',
            DayAsceEto: { Value: '', Unit: '(in)' },
          },
        ],
      },
    ],
  },
};

describe('cimis normalization', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => jsonOk(dataResponse)));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps records to readings sorted oldest-first and skips blank ETo', async () => {
    const readings = await getEtoHistory({ latitude: 36.8, longitude: -119.7 }, { appKey: 'test' });
    expect(readings).toHaveLength(2);
    expect(readings[0].date).toBe('2026-05-30');
    expect(readings[0].eto).toBe(0.21);
    expect(readings[0].airTempF).toBe(72.4);
    expect(readings[1].precipitation).toBe(0.04);
  });

  it('returns the latest reading for current ETo', async () => {
    const reading = await getCurrentEto({ latitude: 36.8, longitude: -119.7 }, { appKey: 'test' });
    expect(reading?.date).toBe('2026-05-31');
    expect(reading?.eto).toBe(0.26);
  });

  it('returns empty array when no app key is configured', async () => {
    delete process.env.CIMIS_APP_KEY;
    delete process.env.CIMIS_APPKEY;
    const result = await getEtoHistory({ latitude: 36, longitude: -119 });
    expect(result).toEqual([]);
  });
});

describe('cimis stations', () => {
  it('parses decimal coordinates from HMS strings', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        jsonOk({
          Stations: [
            {
              StationNbr: '2',
              Name: 'FivePoints',
              County: null,
              IsActive: 'True',
              Elevation: '285',
              HmsLatitude: "36\u00ba20'10N / 36.3360",
              HmsLongitude: "-120\u00ba6'47W / -120.1130",
            },
          ],
        }),
      ),
    );
    const stations = await getStations({ appKey: 'test' });
    expect(stations[0].location.latitude).toBe(36.336);
    expect(stations[0].location.longitude).toBe(-120.113);
    expect(stations[0].active).toBe(true);
    vi.unstubAllGlobals();
  });
});
