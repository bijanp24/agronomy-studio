import {
  createLogger,
  errorResponse,
  functionPath,
  getNumberQuery,
  jsonResponse,
  preflight,
  requestIdFrom,
  type NetlifyEvent,
  type NetlifyResponse,
} from '../lib/http';
import { isValidLatLon } from '../lib/geo';
import { getWaterQuality } from '../lib/waterquality';
import { searchPackages } from '../lib/cnra';
import type { WaterQualityRecord } from '../lib/models';

const SERVICE = 'water-quality-compliance-service';
const NAME = 'waterquality-api';

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  const requestId = requestIdFrom(event);
  const path = functionPath(event, NAME);
  const logger = createLogger(SERVICE, requestId).child({ route: path });
  logger.info('request received');

  const latitude = getNumberQuery(event, 'lat') ?? getNumberQuery(event, 'latitude');
  const longitude = getNumberQuery(event, 'lon') ?? getNumberQuery(event, 'longitude');

  try {
    switch (path) {
      case '/api/water-quality/nearby':
      case '/api/water-quality/nitrate':
      case '/api/water-quality/salinity':
      case '/': {
        if (!isValidLatLon(latitude, longitude)) {
          return errorResponse(400, 'lat and lon query parameters are required');
        }
        const records = await getWaterQuality(
          { latitude: latitude!, longitude: longitude! },
          { radiusMiles: getNumberQuery(event, 'radius'), limit: getNumberQuery(event, 'limit'), logger },
        );
        return jsonResponse(200, { records: filterFor(path, records) });
      }
      case '/api/water-quality/datasets': {
        const datasets = await searchPackages('groundwater water quality', { rows: 8, logger });
        return jsonResponse(200, { datasets });
      }
      case '/api/water-quality/health':
        return jsonResponse(200, { service: SERVICE, status: 'ok' });
      default:
        return errorResponse(404, `No route for ${path}`);
    }
  } catch (err) {
    return errorResponse(502, err instanceof Error ? err.message : 'Water quality request failed');
  }
};

function filterFor(path: string, records: WaterQualityRecord[]): WaterQualityRecord[] {
  if (path === '/api/water-quality/nitrate') return records.filter((r) => r.nitrateMgL !== undefined);
  if (path === '/api/water-quality/salinity') return records.filter((r) => r.salinityMgL !== undefined);
  return records;
}
