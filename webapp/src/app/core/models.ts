export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface EvapotranspirationReading {
  date: string;
  stationId?: string;
  stationName?: string;
  location?: GeoPoint;
  eto: number;
  airTempF?: number;
  solarRadiation?: number;
  precipitation?: number;
  source: string;
}

export interface ForecastEtReading {
  date: string;
  eto: number;
  precipitation?: number;
  maxTempF?: number;
  minTempF?: number;
  source: string;
}

export interface SoilProfile {
  location: GeoPoint;
  mapUnitKey?: string;
  mapUnitName?: string;
  componentName?: string;
  texture?: string;
  drainageClass?: string;
  hydrologicGroup?: string;
  availableWaterCapacity: number;
  rootZoneDepthIn: number;
  source: string;
}

export interface OpenDataDataset {
  id: string;
  title: string;
  description?: string;
  organization?: string;
  url?: string;
  resourceCount?: number;
  tags?: string[];
  updated?: string;
  source: string;
}

export interface WaterQualityRecord {
  wellId?: string;
  location: GeoPoint;
  county?: string;
  nitrateMgL?: number;
  salinityMgL?: number;
  sampleDate?: string;
  distanceMiles?: number;
  source: string;
}

export type IrrigationConfidence = 'high' | 'medium' | 'low';

export interface IrrigationRecommendation {
  cropName: string;
  eto: number;
  kc: number;
  cropEt: number;
  netIrrigationIn: number;
  grossIrrigationIn: number;
  intervalDays: number;
  readilyAvailableWaterIn: number;
  forecastRainIn: number;
  systemEfficiency: number;
  heatRisk: boolean;
  confidence: IrrigationConfidence;
  notes: string[];
}

export interface AgronomyLocationSummary {
  location: GeoPoint;
  county?: string;
  resolvedAt: string;
  evapotranspiration?: EvapotranspirationReading;
  forecast?: ForecastEtReading[];
  soil?: SoilProfile;
  waterQuality?: WaterQualityRecord[];
  datasets?: OpenDataDataset[];
  irrigation?: IrrigationRecommendation;
  warnings?: Record<string, string>;
}

export interface SoilWaterBalance {
  location: GeoPoint;
  availableWaterCapacity: number;
  rootZoneDepthIn: number;
  totalAvailableWaterIn: number;
  readilyAvailableWaterIn: number;
  recentEtIn: number;
  forecastEtIn: number;
  forecastRainIn: number;
  projectedDeficitIn: number;
}

export interface RiskSummary {
  location: GeoPoint;
  heatRisk: boolean;
  droughtStress: boolean;
  waterQualityConcern: boolean;
  notes: string[];
}

export type AgronomySearchIntent =
  | 'irrigation_recommendation'
  | 'evapotranspiration'
  | 'soil_profile'
  | 'water_quality'
  | 'dataset_discovery'
  | 'location_summary'
  | 'unknown';

export interface AgronomySearchParams {
  latitude?: number;
  longitude?: number;
  crop?: string;
  county?: string;
  basin?: string;
  startDate?: string;
  endDate?: string;
}

export interface AgronomySearchResult {
  query: string;
  intent: AgronomySearchIntent;
  params: AgronomySearchParams;
  summary: string;
  data?: unknown;
  sources: string[];
  confidence: number;
}

export interface LocationSummaryRequest {
  latitude: number;
  longitude: number;
  crop: string;
}

export interface SearchRequest {
  query: string;
  latitude: number;
  longitude: number;
  cropName: string;
}

export interface ServiceHealth {
  service: string;
  status: 'ok' | 'degraded' | 'down';
  checkedAt?: string;
}
