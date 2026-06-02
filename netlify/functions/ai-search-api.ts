import {
  createLogger,
  errorResponse,
  functionPath,
  getQuery,
  jsonResponse,
  parseBody,
  preflight,
  requestIdFrom,
  type NetlifyEvent,
  type NetlifyResponse,
} from '../lib/http';
import { runSearch } from '../lib/ai-search';

const SERVICE = 'ai-agronomy-search-service';
const NAME = 'ai-search-api';

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  const requestId = requestIdFrom(event);
  const path = functionPath(event, NAME);
  const logger = createLogger(SERVICE, requestId).child({ route: path, method: event.httpMethod });
  logger.info('request received');

  if (path === '/api/ai/health') {
    return jsonResponse(200, { service: SERVICE, status: 'ok' });
  }

  if (path !== '/api/search' && path !== '/') {
    return errorResponse(404, `No route for ${path}`);
  }

  const body = event.httpMethod === 'POST' ? parseBody<{ query?: string; q?: string }>(event) : undefined;
  const query = body?.query ?? body?.q ?? getQuery(event, 'q') ?? getQuery(event, 'query');

  if (!query || !query.trim()) {
    return errorResponse(400, 'A "query" is required (POST body { query } or ?q=).');
  }

  try {
    const result = await runSearch(query.trim(), { logger });
    return jsonResponse(200, result);
  } catch (err) {
    logger.error('search failed', { message: err instanceof Error ? err.message : String(err) });
    return errorResponse(502, err instanceof Error ? err.message : 'AI search failed');
  }
};
