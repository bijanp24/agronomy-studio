const entropyRecords = Array.from({ length: 24 }, (_, index) => {
  const entropy = Number((0.32 + Math.abs(Math.sin(index * 0.57)) * 0.56).toFixed(3));
  return {
    atmospheric: {
      precip1Hour: Number((index % 5 === 0 ? 0.04 : 0).toFixed(2)),
      precipRate: 0,
      pressureAltimeter: Number((29.86 + Math.sin(index / 3) * 0.12).toFixed(2)),
      relativeHumidity: Math.round(48 + Math.cos(index / 2) * 16),
      windSpeed: Math.round(6 + Math.sin(index / 4) * 4),
      temperature: Math.round(74 + Math.sin(index / 5) * 9),
      uvIndex: Math.max(0, Math.round(7 + Math.sin(index / 4) * 3)),
      cloudCoverPhrase: index % 4 === 0 ? 'Partly cloudy' : 'Clear',
    },
    entropy,
    vector: [entropy, 1 - entropy, (entropy * 0.73) % 1, (entropy * 1.31) % 1].map(value =>
      Number(value.toFixed(3)),
    ),
    timestamp: new Date(Date.now() - (23 - index) * 60 * 60 * 1000).toISOString(),
    location: 'Fresno, CA 93650',
  };
});

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
  // (/.netlify/functions/weather-api/...) or the public redirect path (/weather-api/...).
  const markers = ['/.netlify/functions/weather-api', '/weather-api'];
  for (const marker of markers) {
    const index = path.indexOf(marker);
    if (index >= 0) {
      return path.slice(index + marker.length) || '/';
    }
  }
  return path;
}

export async function handler(event) {
  const pathname = functionPath(event);

  if (pathname === '/api/entropy/current') {
    const postalCode = event.queryStringParameters?.postalCode ?? '93650';
    const current = {
      ...entropyRecords.at(-1),
      timestamp: new Date().toISOString(),
      location: `Fresno, CA ${postalCode}`,
    };
    return sendJson(200, current);
  }

  if (pathname === '/api/entropy/history') {
    const meanEntropy =
      entropyRecords.reduce((sum, record) => sum + record.entropy, 0) / entropyRecords.length;
    const varianceEntropy =
      entropyRecords.reduce((sum, record) => sum + (record.entropy - meanEntropy) ** 2, 0) /
      entropyRecords.length;

    return sendJson(200, {
      records: entropyRecords,
      stats: {
        count: entropyRecords.length,
        meanEntropy: Number(meanEntropy.toFixed(3)),
        varianceEntropy: Number(varianceEntropy.toFixed(4)),
      },
    });
  }

  return sendJson(404, { error: `No mock route for ${pathname}` });
}
