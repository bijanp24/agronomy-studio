import { fetchJson, type Logger } from './http';
import type { CimisStation, EvapotranspirationReading, GeoPoint } from './models';

const CIMIS_BASE = 'https://et.water.ca.gov/api';
const DATA_ITEMS = 'day-asce-eto,day-precip,day-sol-rad-avg,day-air-tmp-avg,day-air-tmp-max,day-air-tmp-min';

export function getCimisAppKey(): string | undefined {
  return process.env.CIMIS_APP_KEY ?? process.env.CIMIS_APPKEY;
}

// --- raw CIMIS response shapes ------------------------------------------------

interface CimisDataItem {
  Value: string | null;
  Qc?: string;
  Unit?: string;
}

interface CimisRecord {
  Date: string;
  Julian?: string;
  Station?: string;
  Standard?: string;
  Scope?: string;
  DayAsceEto?: CimisDataItem;
  DayPrecip?: CimisDataItem;
  DaySolRadAvg?: CimisDataItem;
  DayAirTmpAvg?: CimisDataItem;
  DayAirTmpMax?: CimisDataItem;
  DayAirTmpMin?: CimisDataItem;
}

interface CimisProvider {
  Name?: string;
  Type?: string;
  Records?: CimisRecord[];
}

interface CimisDataResponse {
  Data?: { Providers?: CimisProvider[] };
}

interface CimisRawStation {
  StationNbr: string;
  Name: string;
  City?: string;
  County?: string | null;
  IsActive?: string;
  IsEtoStation?: string;
  Elevation?: string;
  HmsLatitude?: string;
  HmsLongitude?: string;
}

interface CimisStationResponse {
  Stations?: CimisRawStation[];
}

// --- helpers ------------------------------------------------------------------

function num(item?: CimisDataItem): number | undefined {
  if (!item || item.Value === null || item.Value === undefined || item.Value === '') return undefined;
  const n = Number(item.Value);
  return Number.isFinite(n) ? n : undefined;
}

/** Parse the decimal degrees from CIMIS HMS coordinate strings ("36º20'10N / 36.3360"). */
function parseHms(value?: string): number | undefined {
  if (!value) return undefined;
  const parts = value.split('/');
  const decimal = Number((parts.at(-1) ?? '').trim());
  return Number.isFinite(decimal) ? decimal : undefined;
}

function isoDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 86400000);
  return d.toISOString().slice(0, 10);
}

function targetFor(point: GeoPoint): string {
  return `lat=${point.latitude},lng=${point.longitude}`;
}

function recordToReading(record: CimisRecord, point: GeoPoint | undefined): EvapotranspirationReading | null {
  const eto = num(record.DayAsceEto);
  if (eto === undefined) return null;
  return {
    date: record.Date,
    stationId: record.Station,
    location: point,
    eto,
    airTempF: num(record.DayAirTmpAvg),
    solarRadiation: num(record.DaySolRadAvg),
    precipitation: num(record.DayPrecip),
    source: record.Station ? 'CIMIS' : 'CIMIS (spatial)',
  };
}

// --- public API ---------------------------------------------------------------

export interface CimisDataOptions {
  startDate?: string;
  endDate?: string;
  appKey?: string;
  logger?: Logger;
}

/** Query daily ETo + weather for a coordinate window, normalized to readings (newest last). */
export async function getEtoHistory(point: GeoPoint, options: CimisDataOptions = {}): Promise<EvapotranspirationReading[]> {
  const appKey = options.appKey ?? getCimisAppKey();
  if (!appKey) {
    options.logger?.warn('CIMIS_APP_KEY not configured; skipping ETo history fetch');
    return [];
  }

  const startDate = options.startDate ?? isoDaysAgo(7);
  const endDate = options.endDate ?? isoDaysAgo(1);
  const params = new URLSearchParams({
    appKey,
    targets: targetFor(point),
    startDate,
    endDate,
    dataItems: DATA_ITEMS,
    unitOfMeasure: 'E',
  });
  const url = `${CIMIS_BASE}/data?${params.toString()}`;

  const json = await fetchJson<CimisDataResponse>(url, {
    label: 'CIMIS data',
    logger: options.logger,
    headers: { Accept: 'application/json' },
  });

  const readings: EvapotranspirationReading[] = [];
  for (const provider of json.Data?.Providers ?? []) {
    for (const record of provider.Records ?? []) {
      const reading = recordToReading(record, point);
      if (reading) readings.push(reading);
    }
  }
  readings.sort((a, b) => a.date.localeCompare(b.date));
  return readings;
}

/** Latest available daily ETo reading for a coordinate (CIMIS lags ~1-2 days). */
export async function getCurrentEto(point: GeoPoint, options: CimisDataOptions = {}): Promise<EvapotranspirationReading | null> {
  const readings = await getEtoHistory(point, options);
  return readings.at(-1) ?? null;
}

/** List CIMIS weather stations, normalized. */
export async function getStations(options: CimisDataOptions = {}): Promise<CimisStation[]> {
  const appKey = options.appKey ?? getCimisAppKey();
  if (!appKey) {
    options.logger?.warn('CIMIS_APP_KEY not configured; skipping station list fetch');
    return [];
  }

  const url = `${CIMIS_BASE}/station?appKey=${encodeURIComponent(appKey)}`;
  const json = await fetchJson<CimisStationResponse>(url, {
    label: 'CIMIS station',
    logger: options.logger,
    headers: { Accept: 'application/json' },
  });

  return (json.Stations ?? []).map((s) => ({
    stationId: s.StationNbr,
    name: s.Name,
    county: s.County ?? undefined,
    location: {
      latitude: parseHms(s.HmsLatitude) ?? 0,
      longitude: parseHms(s.HmsLongitude) ?? 0,
    },
    elevationFt: s.Elevation ? Number(s.Elevation) : undefined,
    active: s.IsActive === 'True',
  }));
}
