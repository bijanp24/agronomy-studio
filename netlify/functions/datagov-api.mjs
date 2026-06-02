const CATALOG_BASE = 'https://catalog.data.gov';

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
  // (/.netlify/functions/datagov-api/...) or the public redirect path (/datagov-api/...).
  const markers = ['/.netlify/functions/datagov-api', '/datagov-api'];
  for (const marker of markers) {
    const index = path.indexOf(marker);
    if (index >= 0) {
      return path.slice(index + marker.length) || '/';
    }
  }
  return path;
}

function reshape(result) {
  const dcat = result.dcat ?? {};
  return {
    title: result.title ?? dcat.title ?? 'Untitled dataset',
    description: result.description ?? dcat.description ?? '',
    publisher: result.publisher ?? dcat.publisher?.name ?? '',
    organization: result.organization?.name ?? '',
    keywords: (result.keyword ?? []).slice(0, 8),
    lastHarvested: result.last_harvested_date ?? '',
    landingPage:
      dcat.landingPage ?? (result.slug ? `${CATALOG_BASE}/dataset/${result.slug}` : CATALOG_BASE),
    identifier: result.identifier ?? '',
    distributionTitles: result.distribution_titles ?? [],
  };
}

export async function handler(event) {
  const pathname = functionPath(event);

  if (pathname === '/api/search') {
    const q = event.queryStringParameters?.q ?? 'agriculture';
    const perPage = event.queryStringParameters?.perPage ?? '12';
    const url = `${CATALOG_BASE}/search?q=${encodeURIComponent(q)}&per_page=${encodeURIComponent(perPage)}`;

    try {
      const res = await fetch(url);
      if (!res.ok) return sendJson(502, { error: `Data.gov returned ${res.status}` });
      const data = await res.json();
      return sendJson(200, {
        query: q,
        results: (data.results ?? []).map(reshape),
        after: data.after ?? null,
      });
    } catch (err) {
      return sendJson(502, { error: err?.message ?? 'Data.gov request failed.' });
    }
  }

  return sendJson(404, { error: `No route for ${pathname}` });
}
