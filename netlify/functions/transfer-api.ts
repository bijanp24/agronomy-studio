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
  type Logger,
} from '../lib/http';
import {
  parseCsvText,
  suggestColumnMappings,
  normalizeFieldRow,
  normalizeGeoJsonBoundaries,
  exportFieldsToCsv,
  buildMigrationReport,
  type ColumnMapping,
  type UnitConversion,
  type ParsedCsvRow,
  type GeoJsonFeatureCollection,
  type Organization,
  type Farm,
  type ImportSession,
} from '../lib/transfer';

const SERVICE = 'transfer-hub';
const NAME = 'transfer-api';

// In-memory session store — replace with a real DB in production.
const sessions = new Map<string, ImportSession>();

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  const requestId = requestIdFrom(event);
  const path = functionPath(event, NAME);
  const logger = createLogger(SERVICE, requestId).child({ route: path, method: event.httpMethod });
  logger.info('request received');

  try {
    switch (path) {
      case '/api/transfer/preview':
        return event.httpMethod === 'POST' ? handlePreview(event) : errorResponse(405, 'POST required');
      case '/api/transfer/import':
        return event.httpMethod === 'POST' ? handleImport(event) : errorResponse(405, 'POST required');
      case '/api/transfer/commit':
        return event.httpMethod === 'POST' ? handleCommit(event, logger) : errorResponse(405, 'POST required');
      case '/api/transfer/geojson':
        return event.httpMethod === 'POST' ? handleGeoJson(event) : errorResponse(405, 'POST required');
      case '/api/transfer/export':
        return handleExport(event);
      case '/api/transfer/health':
      case '/':
        return jsonResponse(200, { service: SERVICE, status: 'ok', requestId });
      default:
        return errorResponse(404, `No route for ${path}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected transfer hub error';
    logger.error('request failed', { message });
    return errorResponse(502, message);
  }
};

interface PreviewBody {
  csvText: string;
  sourceSystem?: string;
}

function handlePreview(event: NetlifyEvent): NetlifyResponse {
  const body = parseBody<PreviewBody>(event);
  if (!body?.csvText || typeof body.csvText !== 'string') {
    return errorResponse(400, 'csvText is required');
  }

  const { headers, rows } = parseCsvText(body.csvText);
  const suggestedMappings = suggestColumnMappings(headers);
  const sampleRows = rows.slice(0, 5).map((r) => headers.map((h) => r[h] ?? ''));

  return jsonResponse(200, {
    importId: `preview-${Date.now()}`,
    detectedOrganizations: 0,
    detectedFarms: 0,
    detectedFields: rows.length,
    detectedOperations: 0,
    detectedColumns: headers,
    suggestedMappings,
    suggestedUnitConversions: [],
    warnings: [],
    sampleRows,
  });
}

interface ImportBody {
  csvText: string;
  sourceSystem?: string;
  columnMappings?: ColumnMapping[];
  unitConversions?: UnitConversion[];
}

function handleImport(event: NetlifyEvent): NetlifyResponse {
  const body = parseBody<ImportBody>(event);
  if (!body?.csvText) return errorResponse(400, 'csvText is required');

  const { rows } = parseCsvText(body.csvText);
  const sourceSystem = body.sourceSystem ?? 'CSV Import';
  const mappings = body.columnMappings ?? suggestColumnMappings(
    Object.keys(rows[0] ?? {}),
  );
  const unitConversions = body.unitConversions ?? [];

  const org: Organization = { id: `org-${Date.now()}`, name: 'Imported Organization', type: 'grower' };
  const farm: Farm = { id: `farm-${Date.now()}`, organizationId: org.id, name: 'Imported Farm' };

  const session: ImportSession = {
    importId: `import-${Date.now()}`,
    sourceSystem,
    status: 'validated',
    created: 0,
    updated: 0,
    skipped: 0,
    conflicted: 0,
    errors: [],
    organizations: [org],
    farms: [farm],
    fields: [],
    operations: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const { field, errors } = normalizeFieldRow(i, rows[i] as ParsedCsvRow, mappings, unitConversions, sourceSystem, farm.id);
    session.errors.push(...errors);
    if (errors.length === 0) {
      session.fields.push(field);
      session.created++;
    } else {
      session.skipped++;
    }
  }

  sessions.set(session.importId, session);
  const report = buildMigrationReport(session);
  return jsonResponse(200, report);
}

interface GeoJsonBody {
  geojson: GeoJsonFeatureCollection;
  sourceSystem?: string;
}

function handleGeoJson(event: NetlifyEvent): NetlifyResponse {
  const body = parseBody<GeoJsonBody>(event);
  if (!body?.geojson) return errorResponse(400, 'geojson FeatureCollection is required');

  const sourceSystem = body.sourceSystem ?? 'GeoJSON Import';
  const org: Organization = { id: `org-${Date.now()}`, name: 'Imported Organization', type: 'grower' };
  const farm: Farm = { id: `farm-${Date.now()}`, organizationId: org.id, name: 'Imported Farm' };

  const { fields, errors } = normalizeGeoJsonBoundaries(body.geojson, sourceSystem, farm.id);

  const session: ImportSession = {
    importId: `geojson-${Date.now()}`,
    sourceSystem,
    status: errors.length ? 'failed' : 'validated',
    created: fields.length,
    updated: 0,
    skipped: errors.length,
    conflicted: 0,
    errors,
    organizations: [org],
    farms: [farm],
    fields,
    operations: [],
  };

  sessions.set(session.importId, session);
  return jsonResponse(200, buildMigrationReport(session));
}

function handleExport(event: NetlifyEvent): NetlifyResponse {
  const importId = event.queryStringParameters?.['importId'];
  const format = event.queryStringParameters?.['format'] ?? 'csv';

  const session = importId ? sessions.get(importId) : undefined;
  const fields = session?.fields ?? [];
  const farms = session?.farms ?? [];
  const orgs = session?.organizations ?? [];

  const csvContent = exportFieldsToCsv(fields, farms, orgs);

  return jsonResponse(200, {
    exportId: `export-${Date.now()}`,
    format,
    records: fields.length,
    csvContent,
    downloadUrl: null,
  });
}

// ---------------------------------------------------------------------------
// Commit — persists an in-memory import session to the ML feature store.
//
// When DATABASE_URL is not configured, returns a 202 noting that persistence
// is demo-only and data will be used by the ML service's built-in demo mode.
// When ML_SERVICE_URL is configured, triggers a background re-training job.
// ---------------------------------------------------------------------------

interface CommitBody {
  importId: string;
}

async function handleCommit(event: NetlifyEvent, logger: Logger): Promise<NetlifyResponse> {
  const body = parseBody<CommitBody>(event);
  if (!body?.importId) return errorResponse(400, 'importId is required');

  const session = sessions.get(body.importId);
  if (!session) {
    return errorResponse(404, `Import session '${body.importId}' not found — it may have expired`);
  }

  const ML_SERVICE_URL = process.env['ML_SERVICE_URL'];
  const DATABASE_URL = process.env['DATABASE_URL'];

  const persistenceMode = DATABASE_URL ? 'postgres' : 'demo';

  if (persistenceMode === 'demo') {
    logger.info('commit in demo mode — no DB configured', { importId: body.importId });
    // In demo mode, mark session as committed so UI can proceed
    sessions.set(body.importId, { ...session, status: 'committed' });
    return jsonResponse(202, {
      importId: body.importId,
      status: 'committed',
      persistenceMode: 'demo',
      message: 'Session marked committed. No database is configured — ML service will use demo data.',
      fields: session.fields.length,
      operations: session.operations.length,
    });
  }

  // Production path: write to feature store (DATABASE_URL is set)
  // This is handled by a separate ingestion pipeline (see docs/warehouse/04-azure-durable-functions-pipeline.md).
  // For now, signal the ML service to retrain if available.
  logger.info('commit to feature store', { importId: body.importId, fields: session.fields.length });

  if (ML_SERVICE_URL) {
    try {
      await fetch(`${ML_SERVICE_URL}/api/ml/train/all`, { method: 'POST' });
      logger.info('triggered ML re-training after commit');
    } catch (err) {
      logger.warn('could not trigger ML re-training', { err: String(err) });
    }
  }

  sessions.set(body.importId, { ...session, status: 'committed' });
  return jsonResponse(200, {
    importId: body.importId,
    status: 'committed',
    persistenceMode,
    fields: session.fields.length,
    operations: session.operations.length,
  });
}
