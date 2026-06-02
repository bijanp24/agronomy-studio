import { fetchJson, type Logger } from './http';
import { haversineMiles } from './geo';
import type { GeoPoint, WaterQualityRecord } from './models';
import { round } from './units';

// GAMA (Groundwater Ambient Monitoring & Assessment) publishes well-level
// results through California ArcGIS REST services. The exact layer URL changes
// over time, so it is configurable; the default targets a public GAMA-style
// FeatureServer layer and the parser tolerates field-name variation.
const DEFAULT_GAMA_LAYER =
  'https://gispublic.waterboards.ca.gov/portalserver/rest/services/GAMA/GAMA_Results/MapServer/0';

export function getGamaLayerUrl(): string {
  return process.env.GAMA_ARCGIS_URL ?? DEFAULT_GAMA_LAYER;
}

interface ArcGisFeature {
  attributes?: Record<string, unknown>;
  geometry?: { x?: number; y?: number; latitude?: number; longitude?: number };
}

interface ArcGisQueryResponse {
  features?: ArcGisFeature[];
  error?: { message?: string };
}

// Candidate attribute names across GAMA/GeoTracker variants.
const WELL_ID_KEYS = ['WELL_ID', 'WELLID', 'GM_WELL_ID', 'WELL_NUMBER', 'SITE_CODE', 'GM_WELL_CATEGORY'];
const NITRATE_KEYS = ['NITRATE', 'NO3', 'NITRATE_N', 'RESULT_NITRATE', 'GM_RESULT'];
const TDS_KEYS = ['TDS', 'SALINITY', 'GM_TDS', 'SPECIFIC_CONDUCTANCE', 'EC'];
const COUNTY_KEYS = ['COUNTY', 'GM_COUNTY', 'COUNTY_NAME'];
const DATE_KEYS = ['SAMPLE_DATE', 'GM_SAMP_COLLECTION_DATE', 'DATE', 'SAMPDATE'];
const LAT_KEYS = ['LATITUDE', 'LAT', 'GM_LATITUDE', 'Y'];
const LON_KEYS = ['LONGITUDE', 'LONG', 'LON', 'GM_LONGITUDE', 'X'];

function pick(attrs: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in attrs && attrs[key] !== null && attrs[key] !== '') return attrs[key];
    const found = Object.keys(attrs).find((k) => k.toUpperCase() === key);
    if (found && attrs[found] !== null && attrs[found] !== '') return attrs[found];
  }
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function asString(value: unknown): string | undefined {
  return value === undefined || value === null ? undefined : String(value);
}

function featureLocation(feature: ArcGisFeature, attrs: Record<string, unknown>): GeoPoint | undefined {
  const lat = asNumber(feature.geometry?.latitude ?? feature.geometry?.y ?? pick(attrs, LAT_KEYS));
  const lon = asNumber(feature.geometry?.longitude ?? feature.geometry?.x ?? pick(attrs, LON_KEYS));
  if (lat === undefined || lon === undefined) return undefined;
  return { latitude: lat, longitude: lon };
}

export function mapFeature(feature: ArcGisFeature, origin: GeoPoint): WaterQualityRecord {
  const attrs = feature.attributes ?? {};
  const location = featureLocation(feature, attrs) ?? origin;
  return {
    wellId: asString(pick(attrs, WELL_ID_KEYS)),
    location,
    county: asString(pick(attrs, COUNTY_KEYS)),
    nitrateMgL: asNumber(pick(attrs, NITRATE_KEYS)),
    salinityMgL: asNumber(pick(attrs, TDS_KEYS)),
    sampleDate: asString(pick(attrs, DATE_KEYS)),
    distanceMiles: round(haversineMiles(origin, location), 2),
    source: 'GAMA',
  };
}

/** Convert a radius (miles) to a rough WGS84 degree delta for an envelope query. */
function milesToDegrees(miles: number): number {
  return miles / 69;
}

export interface WaterQualityOptions {
  radiusMiles?: number;
  limit?: number;
  layerUrl?: string;
  logger?: Logger;
}

/** Query GAMA wells within a radius of a point and normalize to WaterQualityRecord. */
export async function getWaterQuality(point: GeoPoint, options: WaterQualityOptions = {}): Promise<WaterQualityRecord[]> {
  const radius = options.radiusMiles ?? 5;
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 200);
  const delta = milesToDegrees(radius);
  const geometry = {
    xmin: point.longitude - delta,
    ymin: point.latitude - delta,
    xmax: point.longitude + delta,
    ymax: point.latitude + delta,
    spatialReference: { wkid: 4326 },
  };

  const params = new URLSearchParams({
    where: '1=1',
    geometry: JSON.stringify(geometry),
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    outSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'true',
    resultRecordCount: String(limit),
    f: 'json',
  });

  const url = `${options.layerUrl ?? getGamaLayerUrl()}/query?${params.toString()}`;
  const json = await fetchJson<ArcGisQueryResponse>(url, { label: 'GAMA ArcGIS', logger: options.logger });
  if (json.error) throw new Error(json.error.message ?? 'GAMA query failed');

  return (json.features ?? [])
    .map((f) => mapFeature(f, point))
    .sort((a, b) => (a.distanceMiles ?? 0) - (b.distanceMiles ?? 0));
}
