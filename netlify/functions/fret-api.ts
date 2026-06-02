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
import { getForecastEt } from '../lib/fret';

const SERVICE = 'forecast-et-service';
const NAME = 'fret-api';

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
      case '/api/fret/forecast':
      case '/api/fret/forecast/daily':
      case '/api/fret/forecast/weekly': {
        if (!isValidLatLon(latitude, longitude)) {
          return errorResponse(400, 'lat and lon query parameters are required');
        }
        const days = path.endsWith('/weekly') ? 7 : getNumberQuery(event, 'days') ?? 7;
        const readings = await getForecastEt({ latitude: latitude!, longitude: longitude! }, { days, logger });
        return jsonResponse(200, { readings });
      }
      case '/api/fret/health':
      case '/':
        return jsonResponse(200, { service: SERVICE, status: 'ok' });
      default:
        return errorResponse(404, `No route for ${path}`);
    }
  } catch (err) {
    return errorResponse(502, err instanceof Error ? err.message : 'Forecast ET request failed');
  }
};
