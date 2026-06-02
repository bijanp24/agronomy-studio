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
import { getSoilProfile } from '../lib/soil';
import type { SoilProfile } from '../lib/models';

const SERVICE = 'soil-data-service';
const NAME = 'soil-api';

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
      case '/api/soil/lookup':
      case '/api/soil/water-capacity':
      case '/api/soil/drainage':
      case '/api/soil/texture': {
        if (!isValidLatLon(latitude, longitude)) {
          return errorResponse(400, 'lat and lon query parameters are required');
        }
        const profile = await getSoilProfile({ latitude: latitude!, longitude: longitude! }, { logger });
        if (!profile) return jsonResponse(404, { error: 'No SSURGO map unit found for this location' });
        return jsonResponse(200, projectFor(path, profile));
      }
      case '/api/soil/health':
      case '/':
        return jsonResponse(200, { service: SERVICE, status: 'ok' });
      default:
        return errorResponse(404, `No route for ${path}`);
    }
  } catch (err) {
    return errorResponse(502, err instanceof Error ? err.message : 'SDA request failed');
  }
};

function projectFor(path: string, profile: SoilProfile): unknown {
  switch (path) {
    case '/api/soil/water-capacity':
      return {
        location: profile.location,
        availableWaterCapacity: profile.availableWaterCapacity,
        rootZoneDepthIn: profile.rootZoneDepthIn,
        source: profile.source,
      };
    case '/api/soil/drainage':
      return {
        location: profile.location,
        drainageClass: profile.drainageClass,
        hydrologicGroup: profile.hydrologicGroup,
        source: profile.source,
      };
    case '/api/soil/texture':
      return {
        location: profile.location,
        texture: profile.texture,
        componentName: profile.componentName,
        mapUnitName: profile.mapUnitName,
        source: profile.source,
      };
    default:
      return profile;
  }
}
