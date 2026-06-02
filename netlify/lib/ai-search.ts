import { listCrops } from './crop';
import {
  buildIrrigationRecommendation,
  buildLocationSummary,
  buildSoilWaterBalance,
  getProviders,
  type GatewayProviders,
} from './gateway';
import { createLogger, type Logger } from './http';
import type { AgronomySearchIntent, AgronomySearchParams, AgronomySearchResult, GeoPoint } from './models';
import { round } from './units';

// Mock NLU: deterministic keyword intent-classification + parameter extraction,
// then routes to the real gateway endpoints. LLM calls (OpenAI/Gemini) are
// intentionally stubbed and swappable later — see callLlmStub below.

interface IntentRule {
  intent: AgronomySearchIntent;
  keywords: string[];
}

const INTENT_RULES: IntentRule[] = [
  { intent: 'irrigation_recommendation', keywords: ['irrigat', 'how much water', 'watering', 'water schedule', 'apply water', 'inches of water'] },
  { intent: 'water_quality', keywords: ['nitrate', 'water quality', 'salinity', 'groundwater', 'contamination', 'tds', 'well water'] },
  { intent: 'soil_profile', keywords: ['soil', 'texture', 'drainage', 'water holding', 'water capacity', 'hydrologic'] },
  { intent: 'evapotranspiration', keywords: ['evapotranspiration', 'eto', 'reference et', ' et ', 'cimis'] },
  { intent: 'dataset_discovery', keywords: ['dataset', 'data set', 'find data', 'open data', 'report on', 'statistics'] },
  { intent: 'location_summary', keywords: ['summary', 'overview', 'conditions', 'tell me about', 'what is happening', 'snapshot'] },
];

interface GazetteerEntry extends GeoPoint {
  county: string;
}

const GAZETTEER: Record<string, GazetteerEntry> = {
  fresno: { latitude: 36.7378, longitude: -119.7871, county: 'Fresno' },
  bakersfield: { latitude: 35.3733, longitude: -119.0187, county: 'Kern' },
  kern: { latitude: 35.3733, longitude: -119.0187, county: 'Kern' },
  salinas: { latitude: 36.6777, longitude: -121.6555, county: 'Monterey' },
  monterey: { latitude: 36.6777, longitude: -121.6555, county: 'Monterey' },
  sacramento: { latitude: 38.5816, longitude: -121.4944, county: 'Sacramento' },
  modesto: { latitude: 37.6391, longitude: -120.9969, county: 'Stanislaus' },
  stanislaus: { latitude: 37.6391, longitude: -120.9969, county: 'Stanislaus' },
  visalia: { latitude: 36.3302, longitude: -119.2921, county: 'Tulare' },
  tulare: { latitude: 36.2077, longitude: -119.3473, county: 'Tulare' },
  merced: { latitude: 37.3022, longitude: -120.483, county: 'Merced' },
  stockton: { latitude: 37.9577, longitude: -121.2908, county: 'San Joaquin' },
  davis: { latitude: 38.5449, longitude: -121.7405, county: 'Yolo' },
  napa: { latitude: 38.2975, longitude: -122.2869, county: 'Napa' },
  riverside: { latitude: 33.9806, longitude: -117.3755, county: 'Riverside' },
  'el centro': { latitude: 32.792, longitude: -115.5631, county: 'Imperial' },
  imperial: { latitude: 32.792, longitude: -115.5631, county: 'Imperial' },
  'santa maria': { latitude: 34.953, longitude: -120.4357, county: 'Santa Barbara' },
};

export function classifyIntent(query: string): AgronomySearchIntent {
  const q = ` ${query.toLowerCase()} `;
  for (const rule of INTENT_RULES) {
    if (rule.keywords.some((k) => q.includes(k))) return rule.intent;
  }
  // Default: if a place is named, treat as a location summary; otherwise unknown.
  return findPlace(query) ? 'location_summary' : 'unknown';
}

function findPlace(query: string): GazetteerEntry | undefined {
  const q = query.toLowerCase();
  // Prefer multi-word names first (e.g. "santa maria" before "maria").
  const names = Object.keys(GAZETTEER).sort((a, b) => b.length - a.length);
  for (const name of names) {
    if (q.includes(name)) return GAZETTEER[name];
  }
  return undefined;
}

export function extractParams(query: string): AgronomySearchParams {
  const params: AgronomySearchParams = {};

  // Explicit coordinates: "lat=.., lon=.." or "36.7, -119.7".
  const latLon =
    query.match(/lat\s*[=:]\s*(-?\d+(?:\.\d+)?)[,\s]+(?:lon|lng|long)\s*[=:]\s*(-?\d+(?:\.\d+)?)/i) ??
    query.match(/(-?\d{2}(?:\.\d+)?)\s*,\s*(-?1[0-2]\d(?:\.\d+)?)/);
  if (latLon) {
    params.latitude = Number(latLon[1]);
    params.longitude = Number(latLon[2]);
  }

  const place = findPlace(query);
  if (place) {
    params.latitude ??= place.latitude;
    params.longitude ??= place.longitude;
    params.county ??= place.county;
  }

  // Crop: first seed crop name/alias mentioned in the text.
  const q = query.toLowerCase();
  for (const crop of listCrops()) {
    if (q.includes(crop.cropName.toLowerCase()) || q.includes(crop.cropId)) {
      params.crop = crop.cropName;
      break;
    }
  }

  const basin = query.match(/([\w\s]+?)\s+(?:basin|groundwater basin|subbasin)/i);
  if (basin) params.basin = basin[1].trim();

  const dates = query.match(/(\d{4}-\d{2}-\d{2})/g);
  if (dates && dates.length > 0) {
    params.startDate = dates[0];
    if (dates[1]) params.endDate = dates[1];
  }

  return params;
}

export interface AiSearchOptions {
  providers?: GatewayProviders;
  logger?: Logger;
}

/** Stubbed LLM hook. Real OpenAI/Gemini calls can be dropped in here later. */
async function callLlmStub(_query: string): Promise<string | null> {
  return null;
}

export async function runSearch(query: string, options: AiSearchOptions = {}): Promise<AgronomySearchResult> {
  const logger = options.logger ?? createLogger('ai-agronomy-search', undefined);
  const providers = options.providers ?? getProviders();
  const intent = classifyIntent(query);
  const params = extractParams(query);
  await callLlmStub(query); // placeholder for a future generative summary

  const hasPoint = typeof params.latitude === 'number' && typeof params.longitude === 'number';
  const point: GeoPoint | undefined = hasPoint
    ? { latitude: params.latitude!, longitude: params.longitude! }
    : undefined;

  if (!point && intent !== 'unknown' && intent !== 'dataset_discovery') {
    return {
      query,
      intent,
      params,
      summary:
        "I understood what you're asking, but I couldn't find a California location. Try naming a city/county (e.g. \"Fresno\") or coordinates like \"36.7, -119.7\".",
      sources: [],
      confidence: 0.3,
    };
  }

  switch (intent) {
    case 'irrigation_recommendation':
      return irrigationResult(query, params, point!, providers, logger);
    case 'evapotranspiration':
      return etoResult(query, params, point!, providers, logger);
    case 'soil_profile':
      return soilResult(query, params, point!, providers, logger);
    case 'water_quality':
      return waterQualityResult(query, params, point!, providers, logger);
    case 'dataset_discovery':
      return datasetResult(query, params, point, providers, logger);
    case 'location_summary':
      return summaryResult(query, params, point!, providers, logger);
    default:
      return {
        query,
        intent,
        params,
        summary:
          "I couldn't tell what you're asking. Try things like \"irrigation for almonds near Fresno\", \"soil at 36.7,-119.7\", or \"nitrate near Bakersfield\".",
        sources: [],
        confidence: 0.2,
      };
  }
}

async function irrigationResult(query: string, params: AgronomySearchParams, point: GeoPoint, providers: GatewayProviders, logger: Logger): Promise<AgronomySearchResult> {
  const rec = await buildIrrigationRecommendation(
    { latitude: point.latitude, longitude: point.longitude, cropName: params.crop },
    logger,
    providers,
  );
  const where = params.county ?? `${point.latitude}, ${point.longitude}`;
  const summary =
    `For ${rec.cropName} near ${where}, apply about ${rec.grossIrrigationIn} in of water roughly every ${rec.intervalDays} day(s) ` +
    `(crop ET ${rec.cropEt} in/day from ETo ${rec.eto} x Kc ${rec.kc}). ` +
    (rec.forecastRainIn > 0 ? `Forecast rain (${rec.forecastRainIn} in) was credited. ` : '') +
    `Confidence: ${rec.confidence}.`;
  return { query, intent: 'irrigation_recommendation', params, summary, data: rec, sources: ['CIMIS', 'NRCS SSURGO', 'WUCOLS', 'Open-Meteo'], confidence: rec.confidence === 'high' ? 0.85 : 0.65 };
}

async function etoResult(query: string, params: AgronomySearchParams, point: GeoPoint, providers: GatewayProviders, logger: Logger): Promise<AgronomySearchResult> {
  const eto = await providers.getEvapotranspiration(point, logger);
  const summary = eto
    ? `Reference ET (ETo) near ${params.county ?? `${point.latitude}, ${point.longitude}`} is about ${eto.eto} in/day (source: ${eto.source}${eto.date ? `, ${eto.date}` : ''}).`
    : 'No recent reference ET reading was available for that location.';
  return { query, intent: 'evapotranspiration', params, summary, data: eto, sources: eto ? [eto.source] : [], confidence: eto ? 0.8 : 0.4 };
}

async function soilResult(query: string, params: AgronomySearchParams, point: GeoPoint, providers: GatewayProviders, logger: Logger): Promise<AgronomySearchResult> {
  const [soil, balance] = await Promise.all([
    providers.getSoil(point, logger),
    buildSoilWaterBalance(point, logger, providers),
  ]);
  const summary = soil
    ? `Soil near ${params.county ?? `${point.latitude}, ${point.longitude}`}: ${soil.mapUnitName ?? 'unnamed map unit'}` +
      `${soil.texture ? `, ${soil.texture}` : ''}, available water capacity ${soil.availableWaterCapacity} in/in, ` +
      `root-zone depth ${soil.rootZoneDepthIn} in, drainage ${soil.drainageClass ?? 'n/a'}. ` +
      `Total available water ~${round(balance.totalAvailableWaterIn, 2)} in.`
    : 'No SSURGO soil map unit was found for that location.';
  return { query, intent: 'soil_profile', params, summary, data: { soil, balance }, sources: ['NRCS SSURGO'], confidence: soil ? 0.8 : 0.4 };
}

async function waterQualityResult(query: string, params: AgronomySearchParams, point: GeoPoint, providers: GatewayProviders, logger: Logger): Promise<AgronomySearchResult> {
  const records = await providers.getWaterQuality(point, logger);
  const exceed = records.filter((r) => (r.nitrateMgL ?? 0) > 10);
  const summary = records.length
    ? `Found ${records.length} nearby groundwater sample(s). ${exceed.length} exceed the 10 mg/L nitrate-N MCL. ` +
      `Nearest well is ${records[0].distanceMiles ?? '?'} mi away.`
    : 'No nearby groundwater quality records were returned for that location.';
  return { query, intent: 'water_quality', params, summary, data: records, sources: ['GAMA'], confidence: records.length ? 0.75 : 0.4 };
}

async function datasetResult(query: string, params: AgronomySearchParams, point: GeoPoint | undefined, providers: GatewayProviders, logger: Logger): Promise<AgronomySearchResult> {
  const topic = params.crop ?? params.basin ?? 'agriculture';
  const datasets = await providers.getDatasets(topic, logger);
  const summary = datasets.length
    ? `Found ${datasets.length} CNRA dataset(s) related to "${topic}". Top result: ${datasets[0].title}.`
    : `No CNRA datasets matched "${topic}".`;
  return { query, intent: 'dataset_discovery', params: { ...params, latitude: point?.latitude, longitude: point?.longitude }, summary, data: datasets, sources: ['CNRA'], confidence: datasets.length ? 0.7 : 0.4 };
}

async function summaryResult(query: string, params: AgronomySearchParams, point: GeoPoint, providers: GatewayProviders, logger: Logger): Promise<AgronomySearchResult> {
  const summary = await buildLocationSummary(
    point,
    { cropName: params.crop },
    logger,
    providers,
  );
  const parts: string[] = [];
  if (summary.evapotranspiration) parts.push(`ETo ${summary.evapotranspiration.eto} in/day`);
  if (summary.soil) parts.push(`soil ${summary.soil.texture ?? summary.soil.mapUnitName ?? 'profile'} (AWC ${summary.soil.availableWaterCapacity} in/in)`);
  if (summary.irrigation) parts.push(`irrigation ~${summary.irrigation.grossIrrigationIn} in every ${summary.irrigation.intervalDays} day(s)`);
  const text = `Conditions near ${params.county ?? `${point.latitude}, ${point.longitude}`}: ${parts.join('; ') || 'limited data available'}.`;
  return { query, intent: 'location_summary', params, summary: text, data: summary, sources: ['CIMIS', 'NRCS SSURGO', 'WUCOLS', 'Open-Meteo', 'CNRA', 'GAMA'], confidence: 0.7 };
}
