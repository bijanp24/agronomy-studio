import {
  createLogger,
  errorResponse,
  functionPath,
  getNumberQuery,
  getQuery,
  jsonResponse,
  parseBody,
  preflight,
  requestIdFrom,
  type NetlifyEvent,
  type NetlifyResponse,
} from '../lib/http';
import { isValidLatLon } from '../lib/geo';
import {
  buildIrrigationRecommendation,
  buildLocationSummary,
  buildRiskSummary,
  buildSoilWaterBalance,
} from '../lib/gateway';
import type { IrrigationRequest } from '../lib/models';

const SERVICE = 'agronomy-gateway';
const NAME = 'agronomy-api';

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  const requestId = requestIdFrom(event);
  const path = functionPath(event, NAME);
  const logger = createLogger(SERVICE, requestId).child({ route: path, method: event.httpMethod });
  logger.info('request received');

  try {
    if (event.httpMethod === 'POST' && path === '/api/agronomy/search') {
      return await handleSearch(event, logger);
    }

    switch (path) {
      case '/api/agronomy/location-summary':
        return await handleLocationSummary(event, logger);
      case '/api/agronomy/irrigation-recommendation':
        return await handleIrrigation(event, logger);
      case '/api/agronomy/soil-water-balance':
        return await handleSoilWaterBalance(event, logger);
      case '/api/agronomy/risk-summary':
        return await handleRiskSummary(event, logger);
      case '/api/agronomy/health':
      case '/':
        return jsonResponse(200, { service: SERVICE, status: 'ok', requestId });
      default:
        return errorResponse(404, `No route for ${path}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected gateway error';
    logger.error('request failed', { message });
    return errorResponse(502, message);
  }
};

function readPoint(event: NetlifyEvent): { latitude: number; longitude: number } | null {
  const latitude = getNumberQuery(event, 'lat') ?? getNumberQuery(event, 'latitude');
  const longitude = getNumberQuery(event, 'lon') ?? getNumberQuery(event, 'longitude');
  return isValidLatLon(latitude, longitude) ? { latitude: latitude!, longitude: longitude! } : null;
}

async function handleLocationSummary(event: NetlifyEvent, logger: ReturnType<typeof createLogger>): Promise<NetlifyResponse> {
  const point = readPoint(event);
  if (!point) return errorResponse(400, 'lat and lon query parameters are required');
  const summary = await buildLocationSummary(
    point,
    {
      cropId: getQuery(event, 'cropId'),
      cropName: getQuery(event, 'crop'),
      systemEfficiency: getNumberQuery(event, 'efficiency'),
    },
    logger,
  );
  return jsonResponse(200, summary);
}

async function handleIrrigation(event: NetlifyEvent, logger: ReturnType<typeof createLogger>): Promise<NetlifyResponse> {
  let request: IrrigationRequest | undefined;
  if (event.httpMethod === 'POST') {
    request = parseBody<IrrigationRequest>(event);
  } else {
    const point = readPoint(event);
    if (point) {
      request = {
        latitude: point.latitude,
        longitude: point.longitude,
        cropId: getQuery(event, 'cropId'),
        cropName: getQuery(event, 'crop'),
        systemEfficiency: getNumberQuery(event, 'efficiency'),
        etoOverride: getNumberQuery(event, 'eto'),
      };
    }
  }

  if (!request || !isValidLatLon(request.latitude, request.longitude)) {
    return errorResponse(400, 'latitude and longitude are required');
  }
  const recommendation = await buildIrrigationRecommendation(request, logger);
  return jsonResponse(200, recommendation);
}

async function handleSoilWaterBalance(event: NetlifyEvent, logger: ReturnType<typeof createLogger>): Promise<NetlifyResponse> {
  const point = readPoint(event);
  if (!point) return errorResponse(400, 'lat and lon query parameters are required');
  return jsonResponse(200, await buildSoilWaterBalance(point, logger));
}

async function handleRiskSummary(event: NetlifyEvent, logger: ReturnType<typeof createLogger>): Promise<NetlifyResponse> {
  const point = readPoint(event);
  if (!point) return errorResponse(400, 'lat and lon query parameters are required');
  return jsonResponse(200, await buildRiskSummary(point, logger));
}

async function handleSearch(event: NetlifyEvent, logger: ReturnType<typeof createLogger>): Promise<NetlifyResponse> {
  const body = parseBody<IrrigationRequest>(event);
  if (!body || !isValidLatLon(body.latitude, body.longitude)) {
    return errorResponse(400, 'latitude and longitude are required in the request body');
  }
  const summary = await buildLocationSummary(
    { latitude: body.latitude, longitude: body.longitude },
    { cropId: body.cropId, cropName: body.cropName, systemEfficiency: body.systemEfficiency },
    logger,
  );
  return jsonResponse(200, summary);
}
