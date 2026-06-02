import type { IrrigationConfidence, IrrigationRecommendation } from './models';
import { clamp, round } from './units';

export interface IrrigationModelInput {
  cropName: string;
  /** Reference ET in inches/day. */
  eto: number;
  /** Crop coefficient (dimensionless). */
  kc: number;
  /** Available water capacity, inches of water per inch of soil. */
  availableWaterCapacity: number;
  /** Effective root-zone depth in inches. */
  rootZoneDepthIn: number;
  /** Management allowable depletion fraction (0-1). */
  allowableDepletion: number;
  /** Irrigation system application efficiency (0-1). */
  systemEfficiency: number;
  /** Effective rainfall expected before the next irrigation (inches). */
  forecastRainIn?: number;
  /** Forecast reference ET over the planning horizon (inches), if known. */
  forecastEtIn?: number;
  /** Whether upcoming temperatures pose heat stress. */
  heatRisk?: boolean;
  /** Confidence reported by the caller, downgraded when inputs are estimated. */
  confidence?: IrrigationConfidence;
}

const MIN_INTERVAL_DAYS = 1;
const MAX_INTERVAL_DAYS = 30;

/**
 * Compute a soil-water-balance irrigation recommendation.
 *
 * CropET = ETo x Kc. Total available water (TAW) is the product of the soil's
 * available water capacity and the root-zone depth. Readily available water
 * (RAW) is the portion that can be depleted before stress (TAW x MAD). The net
 * irrigation depth refills RAW (less effective rainfall); the gross depth grosses
 * that up by system efficiency; the interval is how long CropET takes to deplete RAW.
 */
export function computeIrrigation(input: IrrigationModelInput): IrrigationRecommendation {
  const notes: string[] = [];
  const eto = Math.max(0, input.eto);
  const kc = Math.max(0, input.kc);
  const cropEt = eto * kc;

  const awc = clamp(input.availableWaterCapacity, 0.02, 0.4);
  const rootZone = clamp(input.rootZoneDepthIn, 3, 120);
  const mad = clamp(input.allowableDepletion, 0.1, 0.8);
  const efficiency = clamp(input.systemEfficiency, 0.4, 1);

  const totalAvailableWater = awc * rootZone;
  const readilyAvailableWater = totalAvailableWater * mad;

  const forecastRain = Math.max(0, input.forecastRainIn ?? 0);
  const netIrrigation = Math.max(0, readilyAvailableWater - forecastRain);
  const grossIrrigation = efficiency > 0 ? netIrrigation / efficiency : netIrrigation;

  const intervalDays = cropEt > 0
    ? clamp(Math.round(readilyAvailableWater / cropEt), MIN_INTERVAL_DAYS, MAX_INTERVAL_DAYS)
    : MAX_INTERVAL_DAYS;

  if (cropEt <= 0) {
    notes.push('Crop ET is zero; no active water demand detected.');
  }
  if (forecastRain > 0) {
    notes.push(
      forecastRain >= readilyAvailableWater
        ? `Forecast rain (${round(forecastRain, 2)} in) meets or exceeds the readily available water; irrigation may be deferred.`
        : `Forecast rain (${round(forecastRain, 2)} in) offsets part of the irrigation requirement.`,
    );
  }
  if (input.heatRisk) {
    notes.push('Heat stress likely; shorten the interval and verify soil moisture.');
  }

  const confidence = downgrade(input.confidence ?? 'medium', input.heatRisk === undefined);

  return {
    cropName: input.cropName,
    eto: round(eto, 3),
    kc: round(kc, 3),
    cropEt: round(cropEt, 3),
    netIrrigationIn: round(netIrrigation, 2),
    grossIrrigationIn: round(grossIrrigation, 2),
    intervalDays,
    readilyAvailableWaterIn: round(readilyAvailableWater, 2),
    forecastRainIn: round(forecastRain, 2),
    systemEfficiency: round(efficiency, 2),
    heatRisk: Boolean(input.heatRisk),
    confidence,
    notes,
  };
}

function downgrade(level: IrrigationConfidence, hasEstimates: boolean): IrrigationConfidence {
  if (!hasEstimates) return level;
  if (level === 'high') return 'medium';
  if (level === 'medium') return 'low';
  return 'low';
}
