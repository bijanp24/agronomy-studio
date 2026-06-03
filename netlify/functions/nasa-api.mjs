const NASA_BASE = 'https://api.nasa.gov';

function functionPath(event) {
  const path = event.path ?? '/';
  for (const prefix of ['/.netlify/functions/nasa-api', '/nasa-api']) {
    const i = path.indexOf(prefix);
    if (i >= 0) return path.slice(i + prefix.length) || '/';
  }
  return path;
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET, OPTIONS',
  };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  const apiPath = functionPath(event);
  // Use server-side key if available; otherwise pass through whatever the client sent.
  const params = { ...(event.queryStringParameters ?? {}) };
  if (process.env.NASA_API_KEY) params.api_key = process.env.NASA_API_KEY;

  const qs = new URLSearchParams(params).toString();
  const upstream = `${NASA_BASE}${apiPath}${qs ? '?' + qs : ''}`;

  try {
    const res = await fetch(upstream);
    const body = await res.text();
    const ct = res.headers.get('content-type') ?? 'application/json; charset=utf-8';
    return {
      statusCode: res.status,
      headers: { 'content-type': ct, ...corsHeaders() },
      body,
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders() },
      body: JSON.stringify({ error: err?.message ?? 'NASA proxy request failed' }),
    };
  }
}
