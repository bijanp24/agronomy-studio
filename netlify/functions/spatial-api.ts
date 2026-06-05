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
import {
  runBoundaryAreaBlock,
  runTerrainFlowBlock,
  runCarryingCapacityBlock,
  type LatLon,
  type ElevationGrid,
  type CarryingCapacityInputs,
} from '../lib/spatial';

const SERVICE = 'spatial-engine';
const NAME = 'spatial-api';

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  const requestId = requestIdFrom(event);
  const path = functionPath(event, NAME);
  const logger = createLogger(SERVICE, requestId).child({ route: path, method: event.httpMethod });
  logger.info('request received');

  try {
    switch (path) {
      case '/api/spatial/boundary-area':
        return handleBoundaryArea(event);
      case '/api/spatial/terrain-flow':
        return handleTerrainFlow(event);
      case '/api/spatial/carrying-capacity':
        return handleCarryingCapacity(event);
      case '/api/spatial/demo': {
        const demoField = await loadDemoField();
        return jsonResponse(200, demoField);
      }
      case '/api/spatial/health':
      case '/':
        return jsonResponse(200, { service: SERVICE, status: 'ok', requestId });
      default:
        return errorResponse(404, `No route for ${path}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected spatial engine error';
    logger.error('request failed', { message });
    return errorResponse(502, message);
  }
};

interface BoundaryAreaBody {
  ring: LatLon[];
  unit?: 'acre' | 'hectare';
}

function handleBoundaryArea(event: NetlifyEvent): NetlifyResponse {
  const body = parseBody<BoundaryAreaBody>(event);
  if (!body?.ring || !Array.isArray(body.ring) || body.ring.length < 3) {
    return errorResponse(400, 'ring array with at least 3 LatLon points is required');
  }
  const result = runBoundaryAreaBlock(body.ring, body.unit ?? 'acre');
  return jsonResponse(200, result);
}

function handleTerrainFlow(event: NetlifyEvent): NetlifyResponse {
  const body = parseBody<ElevationGrid>(event);
  if (!body?.values || !Array.isArray(body.values)) {
    return errorResponse(400, 'values (2D elevation array) and cellSizeMeters are required');
  }
  const result = runTerrainFlowBlock(body);
  return jsonResponse(200, result);
}

function handleCarryingCapacity(event: NetlifyEvent): NetlifyResponse {
  const body = parseBody<CarryingCapacityInputs>(event);
  if (!body?.mode) {
    return errorResponse(400, 'mode (logistic | predator-prey) is required');
  }
  const result = runCarryingCapacityBlock(body);
  return jsonResponse(200, result);
}

async function loadDemoField(): Promise<unknown> {
  // In the Netlify serverless environment the function can read bundled JSON.
  // This import resolves at bundle time via the TypeScript/esbuild pipeline.
  const { readFileSync } = await import('fs');
  const { resolve } = await import('path');
  try {
    const filePath = resolve(process.cwd(), 'data', 'demo-field.json');
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return { error: 'demo-field.json not found in the deployment bundle' };
  }
}
