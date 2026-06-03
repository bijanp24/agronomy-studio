import { getCurrentEto as getCimisEto } from './cimis';
import { searchPackages } from './cnra';
import { findCoefficient } from './crop';
import { getForecastEt } from './fret';
import type { Logger } from './http';
import { computeIrrigation } from './irrigation';
import { getSoilProfile } from './soil';
import { getWaterQuality } from './waterquality';
import type {
  AgronomyLocationSummary,
  CropWaterCoefficient,
  EvapotranspirationReading,
  ForecastEtReading,
  GeoPoint,
  IrrigationRecommendation,
  IrrigationRequest,
  OpenDataDataset,
  RiskSummary,
  SoilProfile,
  SoilWaterBalance,
  WaterQualityRecord,
} from './models';
import { round } from './units';

/**
 * Pluggable upstream data providers. M1 ships deterministic placeholders so the
 * gateway is callable end-to-end; later milestones replace each provider with
 * the corresponding real domain module (CIMIS, NRCS soil, WUCOLS crops, etc.).
 * Tests inject mock providers to exercise routing, aggregation, and math.
 */
export interface GatewayProviders {
  getEvapotranspiration(point: GeoPoint, logger: Logger): Promise<EvapotranspirationReading | null>;
  getForecast(point: GeoPoint, logger: Logger): Promise<ForecastEtReading[]>;
  getSoil(point: GeoPoint, logger: Logger): Promise<SoilProfile | null>;
  getCropCoefficient(
    cropId: string | undefined,
    cropName: string | undefined,
    logger: Logger,
  ): Promise<CropWaterCoefficient | null>;
  getWaterQuality(point: GeoPoint, logger: Logger): Promise<WaterQualityRecord[]>;
  getDatasets(query: string, logger: Logger): Promise<OpenDataDataset[]>;
}

const DEFAULT_SYSTEM_EFFICIENCY = 0.85;
const HEAT_RISK_TEMP_F = 100;

// --- M1 placeholder providers (replaced in later milestones) ------------------

const placeholderProviders: GatewayProviders = {
  async getEvapotranspiration(point) {
    return {
      date: new Date().toISOString().slice(0, 10),
      location: point,
      eto: 0.22,
      airTempF: 82,
      source: 'placeholder',
    };
  },
  async getForecast() {
    return [];
  },
  async getSoil(point) {
    return {
      location: point,
      mapUnitName: 'Placeholder loam',
      texture: 'loam',
      drainageClass: 'well drained',
      hydrologicGroup: 'B',
      availableWaterCapacity: 0.15,
      rootZoneDepthIn: 24,
      source: 'placeholder',
    };
  },
  async getCropCoefficient(_cropId, cropName) {
    return {
      cropId: 'generic',
      cropName: cropName ?? 'Generic crop',
      kc: 0.9,
      allowableDepletion: 0.5,
      rootDepthIn: 24,
      source: 'placeholder',
    };
  },
  async getWaterQuality() {
    return [];
  },
  async getDatasets() {
    return [];
  },
};

// Real providers wired as milestones land; unimplemented ones fall back to
// placeholders so the gateway always returns a usable (if partial) response.
const defaultProviders: GatewayProviders = {
  ...placeholderProviders,
  getEvapotranspiration: (point, logger) => getCimisEto(point, { logger }),
  getForecast: (point, logger) => getForecastEt(point, { logger }),
  getSoil: (point, logger) => getSoilProfile(point, { logger }),
  getCropCoefficient: async (cropId, cropName) => findCoefficient(cropId, cropName),
  getWaterQuality: (point, logger) => getWaterQuality(point, { radiusMiles: 5, limit: 10, logger }),
  getDatasets: (query, logger) => searchPackages(query, { rows: 5, logger }),
};

let activeProviders: GatewayProviders = defaultProviders;

/** Override one or more providers (used as later milestones land real modules, and by tests). */
export function configureProviders(overrides: Partial<GatewayProviders>): void {
  activeProviders = { ...activeProviders, ...overrides };
}

export function getProviders(): GatewayProviders {
  return activeProviders;
}

// --- orchestration ------------------------------------------------------------

export interface LocationSummaryOptions {
  cropId?: string;
  cropName?: string;
  systemEfficiency?: number;
  includeDatasets?: boolean;
  includeWaterQuality?: boolean;
}

export async function buildLocationSummary(
  point: GeoPoint,
  options: LocationSummaryOptions,
  logger: Logger,
  providers: GatewayProviders = activeProviders,
): Promise<AgronomyLocationSummary> {
  const warnings: Record<string, string> = {};

  const [eto, forecast, soil, crop, waterQuality, datasets] = await Promise.all([
    safe('evapotranspiration', warnings, logger, () => providers.getEvapotranspiration(point, logger)),
    safe('forecast', warnings, logger, () => providers.getForecast(point, logger)),
    safe('soil', warnings, logger, () => providers.getSoil(point, logger)),
    safe('crop', warnings, logger, () => providers.getCropCoefficient(options.cropId, options.cropName, logger)),
    options.includeWaterQuality === false
      ? Promise.resolve<WaterQualityRecord[] | null>([])
      : safe('waterQuality', warnings, logger, () => providers.getWaterQuality(point, logger)),
    options.includeDatasets === false
      ? Promise.resolve<OpenDataDataset[] | null>([])
      : safe('datasets', warnings, logger, () =>
          providers.getDatasets(options.cropName ?? 'agriculture', logger),
        ),
  ]);

  const forecastRainIn = sumForecastRain(forecast ?? []);
  const heatRisk = hasHeatRisk(forecast ?? [], eto ?? undefined);

  let irrigation: IrrigationRecommendation | undefined;
  if (eto && soil && crop) {
    irrigation = computeIrrigation({
      cropName: crop.cropName,
      eto: eto.eto,
      kc: crop.kc,
      availableWaterCapacity: soil.availableWaterCapacity,
      rootZoneDepthIn: crop.rootDepthIn ?? soil.rootZoneDepthIn,
      allowableDepletion: crop.allowableDepletion ?? 0.5,
      systemEfficiency: options.systemEfficiency ?? DEFAULT_SYSTEM_EFFICIENCY,
      forecastRainIn,
      heatRisk,
      confidence: confidenceFrom(eto.source, soil.source, crop.source),
    });
  } else {
    warnings['irrigation'] = 'Insufficient inputs (ETo, soil, or crop coefficient) to compute a recommendation.';
  }

  return {
    location: point,
    resolvedAt: new Date().toISOString(),
    evapotranspiration: eto ?? undefined,
    forecast: forecast ?? undefined,
    soil: soil ?? undefined,
    waterQuality: waterQuality ?? undefined,
    datasets: datasets ?? undefined,
    irrigation,
    warnings: Object.keys(warnings).length ? warnings : undefined,
  };
}

export async function buildIrrigationRecommendation(
  request: IrrigationRequest,
  logger: Logger,
  providers: GatewayProviders = activeProviders,
): Promise<IrrigationRecommendation> {
  const point: GeoPoint = { latitude: request.latitude, longitude: request.longitude };
  const [etoReading, soil, crop, forecastResult] = await Promise.all([
    settle(logger, 'evapotranspiration', () => providers.getEvapotranspiration(point, logger)),
    settle(logger, 'soil', () => providers.getSoil(point, logger)),
    settle(logger, 'crop', () => providers.getCropCoefficient(request.cropId, request.cropName, logger)),
    settle(logger, 'forecast', () => providers.getForecast(point, logger)),
  ]);

  const forecast = forecastResult ?? [];
  const eto = request.etoOverride ?? etoReading?.eto ?? 0.2;
  const forecastRainIn = sumForecastRain(forecast);
  const heatRisk = hasHeatRisk(forecast, etoReading ?? undefined);

  return computeIrrigation({
    cropName: crop?.cropName ?? request.cropName ?? 'Generic crop',
    eto,
    kc: crop?.kc ?? 0.9,
    availableWaterCapacity: soil?.availableWaterCapacity ?? 0.15,
    rootZoneDepthIn: crop?.rootDepthIn ?? soil?.rootZoneDepthIn ?? 24,
    allowableDepletion: crop?.allowableDepletion ?? 0.5,
    systemEfficiency: request.systemEfficiency ?? DEFAULT_SYSTEM_EFFICIENCY,
    forecastRainIn,
    heatRisk,
    confidence: confidenceFrom(etoReading?.source ?? 'estimate', soil?.source ?? 'estimate', crop?.source ?? 'estimate'),
  });
}

export async function buildSoilWaterBalance(
  point: GeoPoint,
  logger: Logger,
  providers: GatewayProviders = activeProviders,
): Promise<SoilWaterBalance> {
  const [soil, eto, forecastResult] = await Promise.all([
    settle(logger, 'soil', () => providers.getSoil(point, logger)),
    settle(logger, 'evapotranspiration', () => providers.getEvapotranspiration(point, logger)),
    settle(logger, 'forecast', () => providers.getForecast(point, logger)),
  ]);

  const forecast = forecastResult ?? [];
  const awc = soil?.availableWaterCapacity ?? 0.15;
  const rootZone = soil?.rootZoneDepthIn ?? 24;
  const totalAvailableWater = awc * rootZone;
  const readilyAvailableWater = totalAvailableWater * 0.5;
  const recentEt = (eto?.eto ?? 0.2) * 1;
  const forecastEt = forecast.reduce((sum, f) => sum + (f.eto ?? 0), 0);
  const forecastRain = sumForecastRain(forecast);
  const projectedDeficit = Math.max(0, recentEt + forecastEt - forecastRain);

  return {
    location: point,
    availableWaterCapacity: round(awc, 3),
    rootZoneDepthIn: round(rootZone, 1),
    totalAvailableWaterIn: round(totalAvailableWater, 2),
    readilyAvailableWaterIn: round(readilyAvailableWater, 2),
    recentEtIn: round(recentEt, 2),
    forecastEtIn: round(forecastEt, 2),
    forecastRainIn: round(forecastRain, 2),
    projectedDeficitIn: round(projectedDeficit, 2),
  };
}

export async function buildRiskSummary(
  point: GeoPoint,
  logger: Logger,
  providers: GatewayProviders = activeProviders,
): Promise<RiskSummary> {
  const [eto, forecastResult, soil, waterQualityResult] = await Promise.all([
    settle(logger, 'evapotranspiration', () => providers.getEvapotranspiration(point, logger)),
    settle(logger, 'forecast', () => providers.getForecast(point, logger)),
    settle(logger, 'soil', () => providers.getSoil(point, logger)),
    settle(logger, 'waterQuality', () => providers.getWaterQuality(point, logger)),
  ]);

  const forecast = forecastResult ?? [];
  const waterQuality = waterQualityResult ?? [];
  const heatRisk = hasHeatRisk(forecast, eto ?? undefined);
  const forecastRain = sumForecastRain(forecast);
  const droughtStress = (eto?.eto ?? 0) > 0.3 && forecastRain < 0.1;
  const waterQualityConcern = (waterQuality ?? []).some(
    (r) => (r.nitrateMgL ?? 0) > 10 || (r.salinityMgL ?? 0) > 1000,
  );

  const notes: string[] = [];
  if (heatRisk) notes.push('High temperatures forecast; elevated crop water demand.');
  if (droughtStress) notes.push('High ET with little forecast rain; monitor soil moisture closely.');
  if (waterQualityConcern) notes.push('Nearby groundwater exceeds nitrate or salinity thresholds.');
  if (!notes.length) notes.push('No elevated agronomic risks detected.');
  if (!soil) notes.push('Soil profile unavailable; risk estimate uses defaults.');

  return { location: point, heatRisk, droughtStress, waterQualityConcern, notes };
}

// --- helpers ------------------------------------------------------------------

/** Run a provider call, returning null (and logging a warning) on failure. */
async function settle<T>(logger: Logger, provider: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    logger.warn('gateway provider failed', {
      provider,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function safe<T>(
  key: string,
  warnings: Record<string, string>,
  logger: Logger,
  fn: () => Promise<T>,
): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    warnings[key] = message;
    logger.warn('gateway provider failed', { provider: key, message });
    return null;
  }
}

function sumForecastRain(forecast: ForecastEtReading[]): number {
  return forecast.reduce((sum, f) => sum + (f.precipitation ?? 0), 0);
}

function hasHeatRisk(forecast: ForecastEtReading[], eto?: EvapotranspirationReading): boolean {
  if (forecast.some((f) => (f.maxTempF ?? 0) >= HEAT_RISK_TEMP_F)) return true;
  return (eto?.airTempF ?? 0) >= HEAT_RISK_TEMP_F;
}

function confidenceFrom(...sources: string[]): 'high' | 'medium' | 'low' {
  if (sources.some((s) => s === 'placeholder' || s === 'estimate')) return 'low';
  return 'high';
}
