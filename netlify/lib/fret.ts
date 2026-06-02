import { fetchJson, type Logger } from './http';
import type { ForecastEtReading, GeoPoint } from './models';
import { mmToInches, round } from './units';

const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';
const DEFAULT_DAYS = 7;

/**
 * Swappable forecast-ET source. The platform defaults to Open-Meteo's FAO-56
 * reference ET (ETo); an NWS/FRET adapter can be dropped in later without
 * touching the gateway or HTTP wrapper.
 */
export interface ForecastEtAdapter {
  readonly name: string;
  getForecast(point: GeoPoint, days: number, logger?: Logger): Promise<ForecastEtReading[]>;
}

interface OpenMeteoDaily {
  time?: string[];
  et0_fao_evapotranspiration?: Array<number | null>;
  precipitation_sum?: Array<number | null>;
  temperature_2m_max?: Array<number | null>;
  temperature_2m_min?: Array<number | null>;
}

interface OpenMeteoResponse {
  daily?: OpenMeteoDaily;
}

export const openMeteoAdapter: ForecastEtAdapter = {
  name: 'Open-Meteo',
  async getForecast(point, days, logger) {
    const params = new URLSearchParams({
      latitude: String(point.latitude),
      longitude: String(point.longitude),
      daily: 'et0_fao_evapotranspiration,precipitation_sum,temperature_2m_max,temperature_2m_min',
      temperature_unit: 'fahrenheit',
      timezone: 'auto',
      forecast_days: String(days),
    });
    const url = `${OPEN_METEO_BASE}?${params.toString()}`;
    const json = await fetchJson<OpenMeteoResponse>(url, { label: 'Open-Meteo ETo', logger });
    const daily = json.daily;
    if (!daily?.time) return [];

    // Open-Meteo reports ETo and precipitation in millimetres; convert to inches.
    return daily.time.map((date, i) => ({
      date,
      eto: round(mmToInches(daily.et0_fao_evapotranspiration?.[i] ?? 0), 3),
      precipitation: round(mmToInches(daily.precipitation_sum?.[i] ?? 0), 3),
      maxTempF: numberOrUndefined(daily.temperature_2m_max?.[i]),
      minTempF: numberOrUndefined(daily.temperature_2m_min?.[i]),
      source: 'Open-Meteo',
    }));
  },
};

function numberOrUndefined(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

let activeAdapter: ForecastEtAdapter = openMeteoAdapter;

export function setForecastAdapter(adapter: ForecastEtAdapter): void {
  activeAdapter = adapter;
}

export interface ForecastEtOptions {
  days?: number;
  adapter?: ForecastEtAdapter;
  logger?: Logger;
}

export function getForecastEt(point: GeoPoint, options: ForecastEtOptions = {}): Promise<ForecastEtReading[]> {
  const adapter = options.adapter ?? activeAdapter;
  const days = Math.min(Math.max(options.days ?? DEFAULT_DAYS, 1), 16);
  return adapter.getForecast(point, days, options.logger);
}
