// ---------------------------------------------------------------------------
// ML API proxy — forwards requests to the Python ML service when configured.
//
// When ML_SERVICE_URL is not set (local dev, CI, Netlify preview), returns
// realistic mock responses so the UI works without a live ML service.
// ---------------------------------------------------------------------------

import {
  createLogger,
  errorResponse,
  fetchJson,
  functionPath,
  jsonResponse,
  parseBody,
  preflight,
  requestIdFrom,
  type NetlifyEvent,
  type NetlifyResponse,
} from '../lib/http';
import { MOCK_YIELD, MOCK_RISK_SUMMARY, MOCK_OPTIMIZE, MOCK_BENCHMARK, MOCK_CLUSTERS } from '../lib/ml';

const SERVICE = 'ml-api';
const NAME = 'ml-api';
const ML_SERVICE_URL = process.env['ML_SERVICE_URL'];

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  const requestId = requestIdFrom(event);
  const path = functionPath(event, NAME);
  const logger = createLogger(SERVICE, requestId).child({ route: path, method: event.httpMethod });
  logger.info('ml-api request');

  try {
    if (ML_SERVICE_URL) {
      return await proxyToMlService(event, path, logger);
    }
    return handleMock(event, path, logger);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'ML service error';
    logger.error('ml-api failed', { message });
    return errorResponse(502, message);
  }
};

// ---------------------------------------------------------------------------
// Proxy to real Python service
// ---------------------------------------------------------------------------

async function proxyToMlService(
  event: NetlifyEvent,
  path: string,
  logger: ReturnType<typeof createLogger>,
): Promise<NetlifyResponse> {
  const url = `${ML_SERVICE_URL}${path}`;
  const method = event.httpMethod ?? 'GET';
  const body = event.body ?? undefined;

  const result = await fetchJson<unknown>(url, {
    label: 'ml-service',
    logger,
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body } : {}),
  });

  return jsonResponse(200, result);
}

// ---------------------------------------------------------------------------
// Mock responses — used when ML_SERVICE_URL is not configured
// ---------------------------------------------------------------------------

function handleMock(
  event: NetlifyEvent,
  path: string,
  logger: ReturnType<typeof createLogger>,
): NetlifyResponse {
  const body = parseBody<Record<string, unknown>>(event);

  if (path === '/api/ml/health') {
    return jsonResponse(200, {
      status: 'ok',
      demo_mode: true,
      active_models: { yield: 'demo-v1', risk: 'demo-v1', cluster: 'demo-v1' },
    });
  }

  if (path === '/api/ml/yield/predict') {
    const fieldId = (body?.['field_id'] as string) ?? 'field-001';
    const cropName = (body?.['crop_name'] as string) ?? 'almond';
    return jsonResponse(200, MOCK_YIELD(fieldId, cropName));
  }

  if (path.startsWith('/api/ml/yield/history/')) {
    const fieldId = path.split('/').pop() ?? 'field-001';
    return jsonResponse(200, { field_id: fieldId, history: [] });
  }

  if (path === '/api/ml/optimize/inputs') {
    const fieldId = (body?.['field_id'] as string) ?? 'field-001';
    return jsonResponse(200, MOCK_OPTIMIZE(fieldId));
  }

  if (path === '/api/ml/risk/assess') {
    return jsonResponse(200, MOCK_RISK_SUMMARY()[0] ?? {});
  }

  if (path === '/api/ml/risk/summary') {
    return jsonResponse(200, { crop_year: 2026, fields: MOCK_RISK_SUMMARY() });
  }

  if (path === '/api/ml/benchmark/compare') {
    const fieldId = (body?.['field_id'] as string) ?? 'field-001';
    return jsonResponse(200, MOCK_BENCHMARK(fieldId));
  }

  if (path === '/api/ml/benchmark/clusters') {
    return jsonResponse(200, { clusters: MOCK_CLUSTERS });
  }

  if (path.startsWith('/api/ml/train/')) {
    const mtype = path.split('/').pop();
    return jsonResponse(200, { status: 'ok', results: { [mtype ?? 'yield']: { training_rows: 300 } } });
  }

  logger.warn('no mock for path', { path });
  return errorResponse(404, `No ML route for ${path}`);
}
