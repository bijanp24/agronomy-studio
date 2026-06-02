// Shared domain models for the California Agronomy Microservices Platform.
// These types are the normalized contract the gateway and the Blazor frontend
// agree on, independent of each upstream provider's raw response shape.

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export type WaterUnit = 'in' | 'mm';
export type DepthUnit = 'in' | 'cm';

// --- irrigation-cimis-service / forecast-et-service ---------------------------

export interface EvapotranspirationReading {
  date: string; // ISO date (yyyy-mm-dd)
  stationId?: string;
  stationName?: string;
  location?: GeoPoint;
  /** Reference evapotranspiration (ETo) in inches/day. */
  eto: number;
  /** Average air temperature in degrees F, when available. */
  airTempF?: number;
  /** Solar radiation (Ly/day), when available. */
  solarRadiation?: number;
  /** Precipitation in inches, when available. */
  precipitation?: number;
  source: string; // e.g. "CIMIS", "Open-Meteo"
}

export interface CimisStation {
  stationId: string;
  name: string;
  county?: string;
  location: GeoPoint;
  elevationFt?: number;
  active: boolean;
}

export interface ForecastEtReading {
  date: string; // ISO date
  /** Forecast reference evapotranspiration (ETo) in inches/day. */
  eto: number;
  /** Forecast precipitation in inches. */
  precipitation?: number;
  maxTempF?: number;
  minTempF?: number;
  source: string;
}

// --- soil-data-service --------------------------------------------------------

export type HydrologicGroup = 'A' | 'B' | 'C' | 'D' | string;

export interface SoilProfile {
  location: GeoPoint;
  mapUnitKey?: string;
  mapUnitName?: string;
  componentName?: string;
  texture?: string;
  drainageClass?: string;
  hydrologicGroup?: HydrologicGroup;
  /** Available water capacity, inches of water per inch of soil. */
  availableWaterCapacity: number;
  /** Effective root-zone depth in inches. */
  rootZoneDepthIn: number;
  source: string; // "NRCS SSURGO"
}

// --- crop-water-coefficient-service ------------------------------------------

export type CropGrowthStage = 'initial' | 'development' | 'mid' | 'late';

export interface CropWaterCoefficient {
  cropId: string;
  cropName: string;
  category?: string;
  /** Single representative Kc, used when stage detail is unavailable. */
  kc: number;
  /** Stage-specific crop coefficients (FAO-56 style). */
  kcByStage?: Partial<Record<CropGrowthStage, number>>;
  /** Management allowable depletion fraction (0-1). */
  allowableDepletion?: number;
  /** Typical root depth in inches. */
  rootDepthIn?: number;
  source: string; // "WUCOLS"
}

// --- cnra-open-data-service ---------------------------------------------------

export interface OpenDataDataset {
  id: string;
  title: string;
  description?: string;
  organization?: string;
  url?: string;
  resourceCount?: number;
  tags?: string[];
  updated?: string;
  source: string; // "CNRA"
}

// --- water-quality-compliance-service ----------------------------------------

export interface WaterQualityRecord {
  wellId?: string;
  location: GeoPoint;
  county?: string;
  /** Nitrate as N, mg/L. */
  nitrateMgL?: number;
  /** Total dissolved solids / salinity proxy, mg/L. */
  salinityMgL?: number;
  sampleDate?: string;
  distanceMiles?: number;
  source: string; // "GAMA"
}

// --- agronomy-gateway-service -------------------------------------------------

export type IrrigationConfidence = 'high' | 'medium' | 'low';

export interface IrrigationRecommendation {
  cropName: string;
  /** Reference ET used (in/day). */
  eto: number;
  /** Crop coefficient used. */
  kc: number;
  /** Crop ET = ETo x Kc (in/day). */
  cropEt: number;
  /** Net irrigation depth recommended for this cycle (inches). */
  netIrrigationIn: number;
  /** Gross applied depth accounting for system efficiency (inches). */
  grossIrrigationIn: number;
  /** Recommended irrigation interval in days. */
  intervalDays: number;
  /** Readily available water in the root zone (inches). */
  readilyAvailableWaterIn: number;
  /** Forecast rainfall offset applied (inches). */
  forecastRainIn: number;
  systemEfficiency: number;
  heatRisk: boolean;
  confidence: IrrigationConfidence;
  notes: string[];
}

export interface IrrigationRequest {
  latitude: number;
  longitude: number;
  cropId?: string;
  cropName?: string;
  /** Overall irrigation system application efficiency (0-1). Defaults vary by system. */
  systemEfficiency?: number;
  /** Optional ETo override (in/day) for what-if analysis. */
  etoOverride?: number;
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
  /** Soft failures from individual upstream services (service => message). */
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
  /** Projected soil-water deficit at horizon (inches). */
  projectedDeficitIn: number;
}

export interface RiskSummary {
  location: GeoPoint;
  heatRisk: boolean;
  droughtStress: boolean;
  waterQualityConcern: boolean;
  notes: string[];
}

// --- ai-agronomy-search-service ----------------------------------------------

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
