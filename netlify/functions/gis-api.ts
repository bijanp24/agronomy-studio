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
  vegetationIndex,
  gddAccumulation,
  microclimateSummary,
  soilMoistureProbe,
  seasonSnapshot,
  buildVraPrescription,
  type BlockInput,
  type VegetationIndexType,
  type VraBlockZone,
} from '../lib/gis';

const SERVICE = 'gis-overlay-engine';
const NAME = 'gis-api';

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  const requestId = requestIdFrom(event);
  const path = functionPath(event, NAME);
  const logger = createLogger(SERVICE, requestId).child({ route: path, method: event.httpMethod });
  logger.info('request received');

  try {
    if (path === '/api/gis/vegetation') return handleVegetation(event);
    if (path === '/api/gis/microclimate') return handleMicroclimate(event);
    if (path === '/api/gis/gdd') return handleGdd(event);
    if (path === '/api/gis/soil-moisture') return handleSoilMoisture(event);
    if (path === '/api/gis/timeline') return handleTimeline(event);
    if (path === '/api/gis/vra/export') return handleVraExport(event);
    if (path === '/api/gis/health' || path === '/') {
      return jsonResponse(200, { service: SERVICE, status: 'ok', requestId });
    }
    return errorResponse(404, `No route for ${path}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected GIS overlay error';
    logger.error('request failed', { message });
    return errorResponse(502, message);
  }
};

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

interface VegetationBody {
  blocks: BlockInput[];
  indexType?: VegetationIndexType;
}

function handleVegetation(event: NetlifyEvent): NetlifyResponse {
  const body = parseBody<VegetationBody>(event);
  if (!body?.blocks || !Array.isArray(body.blocks) || body.blocks.length === 0) {
    return errorResponse(400, 'blocks array is required');
  }
  const indexType: VegetationIndexType = body.indexType === 'evi' ? 'evi' : 'ndvi';
  const results = body.blocks.map(b => vegetationIndex(b, indexType));
  return jsonResponse(200, { indexType, results });
}

interface MicroclimateBody {
  blocks: BlockInput[];
}

function handleMicroclimate(event: NetlifyEvent): NetlifyResponse {
  const body = parseBody<MicroclimateBody>(event);
  if (!body?.blocks || !Array.isArray(body.blocks) || body.blocks.length === 0) {
    return errorResponse(400, 'blocks array is required');
  }
  const results = body.blocks.map(b => microclimateSummary(b));
  return jsonResponse(200, { results });
}

function handleGdd(event: NetlifyEvent): NetlifyResponse {
  const body = parseBody<MicroclimateBody>(event);
  if (!body?.blocks || !Array.isArray(body.blocks) || body.blocks.length === 0) {
    return errorResponse(400, 'blocks array is required');
  }
  const results = body.blocks.map(b => gddAccumulation(b));
  return jsonResponse(200, { results });
}

function handleSoilMoisture(event: NetlifyEvent): NetlifyResponse {
  const body = parseBody<MicroclimateBody>(event);
  if (!body?.blocks || !Array.isArray(body.blocks) || body.blocks.length === 0) {
    return errorResponse(400, 'blocks array is required');
  }
  const results = body.blocks.map(b => soilMoistureProbe(b));
  return jsonResponse(200, { results });
}

interface TimelineBody {
  blocks: BlockInput[];
  seasons: string[];
}

function handleTimeline(event: NetlifyEvent): NetlifyResponse {
  const body = parseBody<TimelineBody>(event);
  if (!body?.blocks || !Array.isArray(body.blocks) || body.blocks.length === 0) {
    return errorResponse(400, 'blocks array is required');
  }
  const seasons = body.seasons ?? ['2021', '2022', '2023', '2024', '2025'];
  const snapshots = seasons.flatMap(season =>
    body.blocks.map(b => seasonSnapshot({ ...b, season }))
  );
  return jsonResponse(200, { seasons, snapshots });
}

interface VraExportBody {
  zones: VraBlockZone[];
}

function handleVraExport(event: NetlifyEvent): NetlifyResponse {
  const body = parseBody<VraExportBody>(event);
  if (!body?.zones || !Array.isArray(body.zones) || body.zones.length === 0) {
    return errorResponse(400, 'zones array with at least one zone is required');
  }
  const result = buildVraPrescription(body.zones);
  return jsonResponse(200, result);
}
