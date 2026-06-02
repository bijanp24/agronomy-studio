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
import { datastoreSearch, searchPackages } from '../lib/cnra';

const SERVICE = 'cnra-open-data-service';
const NAME = 'cnra-api';

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  const requestId = requestIdFrom(event);
  const path = functionPath(event, NAME);
  const logger = createLogger(SERVICE, requestId).child({ route: path });
  logger.info('request received');

  try {
    switch (path) {
      case '/api/cnra/search':
      case '/api/cnra/datasets':
      case '/': {
        const datasets = await searchPackages(getQuery(event, 'q') ?? 'agriculture', {
          rows: getNumberQuery(event, 'rows'),
          logger,
        });
        return jsonResponse(200, { datasets });
      }
      case '/api/cnra/datastore': {
        const resourceId = getQuery(event, 'resourceId') ?? getQuery(event, 'resource_id');
        if (!resourceId) return errorResponse(400, 'resourceId query parameter is required');
        const result = await datastoreSearch(resourceId, {
          q: getQuery(event, 'q'),
          limit: getNumberQuery(event, 'limit'),
          logger,
        });
        return jsonResponse(200, result);
      }
      case '/api/cnra/health':
        return jsonResponse(200, { service: SERVICE, status: 'ok' });
      default:
        return errorResponse(404, `No route for ${path}`);
    }
  } catch (err) {
    return errorResponse(502, err instanceof Error ? err.message : 'CNRA request failed');
  }
};
