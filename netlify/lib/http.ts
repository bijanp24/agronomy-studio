// Shared HTTP + structured-logging helpers for the Netlify functions.
// Every function uses these so request parsing, CORS, JSON responses, and
// upstream-fetch logging behave consistently across the platform.

export interface NetlifyEvent {
  path?: string;
  rawUrl?: string;
  httpMethod?: string;
  headers?: Record<string, string | undefined> | null;
  queryStringParameters?: Record<string, string | undefined> | null;
  body?: string | null;
}

export interface NetlifyResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

const BASE_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

/**
 * Resolve the application-relative path for a function, stripping both the
 * direct `/.netlify/functions/<name>` invocation prefix and the public
 * `/<name>` redirect prefix (the dual-prefix fix from PR #18).
 */
export function functionPath(event: NetlifyEvent, names: string | string[]): string {
  const path = event.path ?? '/';
  const list = Array.isArray(names) ? names : [names];
  const markers: string[] = [];
  for (const name of list) {
    markers.push(`/.netlify/functions/${name}`, `/${name}`);
  }
  for (const marker of markers) {
    const index = path.indexOf(marker);
    if (index >= 0) {
      return path.slice(index + marker.length) || '/';
    }
  }
  return path;
}

export function getQuery(event: NetlifyEvent, key: string): string | undefined {
  const value = event.queryStringParameters?.[key];
  return value === undefined || value === null || value === '' ? undefined : value;
}

export function getNumberQuery(event: NetlifyEvent, key: string): number | undefined {
  const raw = getQuery(event, key);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function parseBody<T = unknown>(event: NetlifyEvent): T | undefined {
  if (!event.body) return undefined;
  try {
    return JSON.parse(event.body) as T;
  } catch {
    return undefined;
  }
}

export function jsonResponse(
  statusCode: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): NetlifyResponse {
  return {
    statusCode,
    headers: { ...BASE_HEADERS, ...extraHeaders },
    body: JSON.stringify(body),
  };
}

export function errorResponse(statusCode: number, message: string, extra: Record<string, unknown> = {}): NetlifyResponse {
  return jsonResponse(statusCode, { error: message, ...extra });
}

/** Standard CORS preflight response. */
export function preflight(): NetlifyResponse {
  return { statusCode: 204, headers: BASE_HEADERS, body: '' };
}

// --- structured logging -------------------------------------------------------

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  requestId: string;
  service: string;
  child(fields: Record<string, unknown>): Logger;
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

function emit(
  level: LogLevel,
  service: string,
  requestId: string,
  base: Record<string, unknown>,
  message: string,
  fields?: Record<string, unknown>,
): void {
  const line = {
    ts: new Date().toISOString(),
    level,
    service,
    correlationId: requestId,
    msg: message,
    ...base,
    ...fields,
  };
  const serialized = JSON.stringify(line);
  if (level === 'error') console.error(serialized);
  else if (level === 'warn') console.warn(serialized);
  else console.log(serialized);
}

export function createLogger(
  service: string,
  requestId: string = randomId(),
  base: Record<string, unknown> = {},
): Logger {
  return {
    requestId,
    service,
    child(fields: Record<string, unknown>): Logger {
      return createLogger(service, requestId, { ...base, ...fields });
    },
    debug: (m, f) => emit('debug', service, requestId, base, m, f),
    info: (m, f) => emit('info', service, requestId, base, m, f),
    warn: (m, f) => emit('warn', service, requestId, base, m, f),
    error: (m, f) => emit('error', service, requestId, base, m, f),
  };
}

export function requestIdFrom(event: NetlifyEvent): string {
  return (
    event.headers?.['x-correlation-id'] ??
    event.headers?.['x-nf-request-id'] ??
    randomId()
  );
}

export function randomId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

// --- upstream fetch with timing + logging ------------------------------------

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly label: string,
    readonly url: string,
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}

export interface FetchOptions extends RequestInit {
  label: string;
  logger?: Logger;
  timeoutMs?: number;
}

/** Fetch JSON from an upstream provider, timing and logging the round trip. */
export async function fetchJson<T = unknown>(url: string, options: FetchOptions): Promise<T> {
  const { label, logger, timeoutMs = 12000, ...init } = options;
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const durationMs = Date.now() - started;
    if (!response.ok) {
      logger?.warn('upstream request failed', { label, url, status: response.status, durationMs });
      throw new UpstreamError(`${label} responded ${response.status}`, response.status, label, url);
    }
    logger?.info('upstream request ok', { label, url, status: response.status, durationMs });
    return (await response.json()) as T;
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    const durationMs = Date.now() - started;
    const message = err instanceof Error ? err.message : String(err);
    logger?.error('upstream request error', { label, url, durationMs, message });
    throw new UpstreamError(`${label} request failed: ${message}`, 502, label, url);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchText(url: string, options: FetchOptions): Promise<string> {
  const { label, logger, timeoutMs = 12000, ...init } = options;
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const durationMs = Date.now() - started;
    if (!response.ok) {
      logger?.warn('upstream request failed', { label, url, status: response.status, durationMs });
      throw new UpstreamError(`${label} responded ${response.status}`, response.status, label, url);
    }
    logger?.info('upstream request ok', { label, url, status: response.status, durationMs });
    return await response.text();
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    const durationMs = Date.now() - started;
    const message = err instanceof Error ? err.message : String(err);
    logger?.error('upstream request error', { label, url, durationMs, message });
    throw new UpstreamError(`${label} request failed: ${message}`, 502, label, url);
  } finally {
    clearTimeout(timer);
  }
}
