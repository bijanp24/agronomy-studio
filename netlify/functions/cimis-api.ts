import {
  createLogger,
  errorResponse,
  functionPath,
  getNumberQuery,
  getQuery,
  jsonResponse,
  preflight,
  requestIdFrom,
  UpstreamError,
  type NetlifyEvent,
  type NetlifyResponse,
} from '../lib/http';
import { isValidLatLon } from '../lib/geo';
import { getCurrentEto, getEtoHistory, getStations } from '../lib/cimis';

const SERVICE = 'irrigation-cimis-service';
const NAME = 'cimis-api';

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  const requestId = requestIdFrom(event);
  const path = functionPath(event, NAME);
  const logger = createLogger(SERVICE, requestId).child({ route: path });
  logger.info('request received');

  try {
    switch (path) {
      case '/api/cimis/stations':
        return jsonResponse(200, { stations: await getStations({ logger }) });
      case '/api/cimis/eto/current':
      case '/api/cimis/weather':
      case '/api/cimis/spatial':
        return await currentEto(event, logger);
      case '/api/cimis/eto/history':
        return await history(event, logger);
      case '/api/cimis/health':
      case '/':
        return jsonResponse(200, { service: SERVICE, status: 'ok' });
      default:
        return errorResponse(404, `No route for ${path}`);
    }
  } catch (err) {
    return handleError(err);
  }
};

function readPoint(event: NetlifyEvent) {
  const latitude = getNumberQuery(event, 'lat') ?? getNumberQuery(event, 'latitude');
  const longitude = getNumberQuery(event, 'lon') ?? getNumberQuery(event, 'longitude');
  return isValidLatLon(latitude, longitude) ? { latitude: latitude!, longitude: longitude! } : null;
}

async function currentEto(event: NetlifyEvent, logger: ReturnType<typeof createLogger>): Promise<NetlifyResponse> {
  const point = readPoint(event);
  if (!point) return errorResponse(400, 'lat and lon query parameters are required');
  const reading = await getCurrentEto(point, { logger });
  if (!reading) return jsonResponse(404, { error: 'No recent CIMIS reading for this location' });
  return jsonResponse(200, reading);
}

async function history(event: NetlifyEvent, logger: ReturnType<typeof createLogger>): Promise<NetlifyResponse> {
  const point = readPoint(event);
  if (!point) return errorResponse(400, 'lat and lon query parameters are required');
  const readings = await getEtoHistory(point, {
    logger,
    startDate: getQuery(event, 'start'),
    endDate: getQuery(event, 'end'),
  });
  return jsonResponse(200, { readings });
}

function handleError(err: unknown): NetlifyResponse {
  if (err instanceof UpstreamError) {
    return errorResponse(err.status === 500 ? 500 : 502, err.message);
  }
  return errorResponse(502, err instanceof Error ? err.message : 'CIMIS request failed');
}
