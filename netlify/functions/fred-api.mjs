const FRED_BASE = 'https://api.stlouisfed.org/fred';

// Curated macro indicators relevant to agricultural planning.
const INDICATORS = [
  { id: 'UNRATE', label: 'Unemployment Rate' },
  { id: 'CPIAUCSL', label: 'Consumer Price Index (CPI)' },
  { id: 'FEDFUNDS', label: 'Federal Funds Rate' },
  { id: 'USREC', label: 'NBER Recession Indicator' },
];

function sendJson(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
    },
    body: JSON.stringify(body),
  };
}

function functionPath(event) {
  const path = event.path ?? '/';
  // Strip whichever prefix is present: the direct function URL
  // (/.netlify/functions/fred-api/...) or the public redirect path (/fred-api/...).
  const markers = ['/.netlify/functions/fred-api', '/fred-api'];
  for (const marker of markers) {
    const index = path.indexOf(marker);
    if (index >= 0) {
      return path.slice(index + marker.length) || '/';
    }
  }
  return path;
}

async function fetchSeries(id, apiKey) {
  const metaUrl = `${FRED_BASE}/series?series_id=${id}&api_key=${apiKey}&file_type=json`;
  const obsUrl = `${FRED_BASE}/series/observations?series_id=${id}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=24`;

  const [metaRes, obsRes] = await Promise.all([fetch(metaUrl), fetch(obsUrl)]);
  if (!metaRes.ok) throw new Error(`FRED series ${id} returned ${metaRes.status}`);
  if (!obsRes.ok) throw new Error(`FRED observations ${id} returned ${obsRes.status}`);

  const meta = await metaRes.json();
  const series = meta.seriess?.[0] ?? {};
  const obsJson = await obsRes.json();

  const observations = (obsJson.observations ?? [])
    .filter(o => o.value !== '.')
    .map(o => ({ date: o.date, value: Number(o.value) }))
    .reverse();

  const latest = observations.at(-1) ?? null;
  const previous = observations.at(-2) ?? null;

  return {
    id,
    title: series.title ?? id,
    units: series.units_short ?? series.units ?? '',
    frequency: series.frequency_short ?? series.frequency ?? '',
    latest,
    previous,
    change: latest && previous ? Number((latest.value - previous.value).toFixed(3)) : null,
    observations,
  };
}

export async function handler(event) {
  const pathname = functionPath(event);

  if (pathname === '/api/indicators') {
    const apiKey = process.env.FRED_API_KEY;
    if (!apiKey) {
      return sendJson(500, {
        error: 'FRED_API_KEY is not configured. Add it under Site settings -> Environment variables.',
      });
    }

    try {
      const indicators = await Promise.all(INDICATORS.map(i => fetchSeries(i.id, apiKey)));
      return sendJson(200, { indicators });
    } catch (err) {
      return sendJson(502, { error: err?.message ?? 'FRED request failed.' });
    }
  }

  return sendJson(404, { error: `No route for ${pathname}` });
}
