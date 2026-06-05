import {
  createLogger,
  errorResponse,
  functionPath,
  jsonResponse,
  parseBody,
  preflight,
  requestIdFrom,
  type NetlifyEvent,
  type NetlifyResponse,
} from '../lib/http';
import { orchestrate, type AiOrchestrationOptions } from '../lib/ai-orchestration';

const SERVICE = 'ai-orchestration';
const NAME = 'ai-orchestration-api';

interface OrchestrationRequest {
  query: string;
  explanationLevel?: 'beginner' | 'intermediate' | 'advanced';
}

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  const requestId = requestIdFrom(event);
  const path = functionPath(event, NAME);
  const logger = createLogger(SERVICE, requestId).child({ route: path, method: event.httpMethod });
  logger.info('request received');

  try {
    switch (path) {
      case '/api/orchestrate': {
        if (event.httpMethod !== 'POST') return errorResponse(405, 'POST required');
        const body = parseBody<OrchestrationRequest>(event);
        if (!body?.query || typeof body.query !== 'string') {
          return errorResponse(400, 'query string is required in the request body');
        }
        const opts: AiOrchestrationOptions = { explanationLevel: body.explanationLevel };
        const result = await orchestrate(body.query.trim(), opts);
        return jsonResponse(200, result);
      }
      case '/api/orchestrate/health':
      case '/':
        return jsonResponse(200, { service: SERVICE, status: 'ok', requestId });
      default:
        return errorResponse(404, `No route for ${path}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected orchestration error';
    logger.error('request failed', { message });
    return errorResponse(502, message);
  }
};
