import {
  createLogger,
  errorResponse,
  functionPath,
  getNumberQuery,
  getQuery,
  jsonResponse,
  preflight,
  requestIdFrom,
  type NetlifyEvent,
  type NetlifyResponse,
} from '../lib/http';
import { isValidLatLon } from '../lib/geo';
import { findCoefficient, getCropById, listCrops, searchCrops } from '../lib/crop';
import { buildIrrigationRecommendation } from '../lib/gateway';

const SERVICE = 'crop-water-coefficient-service';
const NAME = 'crop-api';

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  const requestId = requestIdFrom(event);
  const path = functionPath(event, NAME);
  const logger = createLogger(SERVICE, requestId).child({ route: path });
  logger.info('request received');

  try {
    if (path === '/api/crops/search') {
      return jsonResponse(200, { crops: searchCrops(getQuery(event, 'q') ?? '') });
    }

    if (path === '/api/crops/recommend') {
      const latitude = getNumberQuery(event, 'lat') ?? getNumberQuery(event, 'latitude');
      const longitude = getNumberQuery(event, 'lon') ?? getNumberQuery(event, 'longitude');
      if (!isValidLatLon(latitude, longitude)) {
        return errorResponse(400, 'lat and lon query parameters are required');
      }
      const recommendation = await buildIrrigationRecommendation(
        {
          latitude: latitude!,
          longitude: longitude!,
          cropId: getQuery(event, 'cropId'),
          cropName: getQuery(event, 'crop'),
          systemEfficiency: getNumberQuery(event, 'efficiency'),
        },
        logger,
      );
      return jsonResponse(200, recommendation);
    }

    // /api/crops/:id/water-coefficients  or  /api/crops/:id
    const match = path.match(/^\/api\/crops\/([^/]+)(\/water-coefficients)?$/);
    if (match) {
      const crop = getCropById(match[1]) ?? findCoefficient(undefined, match[1]);
      if (!crop) return errorResponse(404, `Unknown crop "${match[1]}"`);
      return jsonResponse(200, crop);
    }

    if (path === '/api/crops' || path === '/') {
      return jsonResponse(200, { crops: listCrops() });
    }

    if (path === '/api/crops/health') {
      return jsonResponse(200, { service: SERVICE, status: 'ok', count: listCrops().length });
    }

    return errorResponse(404, `No route for ${path}`);
  } catch (err) {
    return errorResponse(502, err instanceof Error ? err.message : 'Crop request failed');
  }
};
