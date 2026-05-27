import http from 'node:http';
import { URL } from 'node:url';

const fields = [
  {
    id: 'field-001',
    name: 'Fresno North 12',
    regionCode: 'CA-SJV',
    areaHectares: 48.6,
    boundaryGeoJson: '',
    soilType: 'Hanford sandy loam',
    notes: 'Early-season almond block with moderate water stress.',
    crop: 'almond',
    stressScore: 72,
    stressLabel: 'high',
    predictedYieldKgPerHa: 4120,
    confidence: 'high',
    topLimitingFactor: 'water',
  },
  {
    id: 'field-002',
    name: 'Madera West 7',
    regionCode: 'CA-SJV',
    areaHectares: 36.2,
    boundaryGeoJson: '',
    soilType: 'San Joaquin loam',
    notes: 'Processing tomato field with strong nutrient profile.',
    crop: 'tomato',
    stressScore: 38,
    stressLabel: 'moderate',
    predictedYieldKgPerHa: 86500,
    confidence: 'medium',
    topLimitingFactor: 'heat',
  },
  {
    id: 'field-003',
    name: 'Kings East 4',
    regionCode: 'CA-SJV',
    areaHectares: 61.8,
    boundaryGeoJson: '',
    soilType: 'Tujunga loamy sand',
    notes: 'Pistachio block trending stable after irrigation adjustment.',
    crop: 'pistachio',
    stressScore: 21,
    stressLabel: 'low',
    predictedYieldKgPerHa: 2980,
    confidence: 'high',
    topLimitingFactor: 'nutrient',
  },
];

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
    vector: [entropy, 1 - entropy, (entropy * 0.73) % 1, (entropy * 1.31) % 1].map(v =>
      Number(v.toFixed(3)),
    ),
    timestamp: new Date(Date.now() - (23 - index) * 60 * 60 * 1000).toISOString(),
    location: 'Fresno, CA 93650',
  };
});

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
  });
  response.end(JSON.stringify(body));
}

function notFound(response, pathname) {
  sendJson(response, 404, { error: `No mock route for ${pathname}` });
}

function fieldById(fieldId) {
  return fields.find(field => field.id === fieldId) ?? fields[0];
}

function createFieldApi() {
  return http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost:4302');
    const parts = url.pathname.split('/').filter(Boolean);

    if (url.pathname === '/api/dashboard/summary') {
      sendJson(response, 200, {
        fields: fields.map(field => ({
          fieldId: field.id,
          fieldName: field.name,
          crop: field.crop,
          stressScore: field.stressScore,
          stressLabel: field.stressLabel,
          predictedYieldKgPerHa: field.predictedYieldKgPerHa,
          confidence: field.confidence,
          topLimitingFactor: field.topLimitingFactor,
        })),
      });
      return;
    }

    if (url.pathname === '/api/fields') {
      sendJson(response, 200, {
        fields: fields.map(({ crop, stressScore, stressLabel, predictedYieldKgPerHa, confidence, topLimitingFactor, ...field }) => field),
      });
      return;
    }

    if (parts[0] === 'api' && parts[1] === 'fields' && parts[2]) {
      const field = fieldById(parts[2]);
      if (parts.length === 3) {
        const { crop, stressScore, stressLabel, predictedYieldKgPerHa, confidence, topLimitingFactor, ...fieldDetails } = field;
        sendJson(response, 200, { field: fieldDetails });
        return;
      }

      if (parts[3] === 'nutrient-balance') {
        sendJson(response, 200, {
          n: { soil: 38, applied: 112, uptake: 121, balance: 29 },
          p: { soil: 22, applied: 36, uptake: 41, balance: 17 },
          k: { soil: 185, applied: 74, uptake: 92, balance: 167 },
          warnings: [
            { nutrient: 'N', message: `${field.name} is close to the lower nitrogen buffer.` },
          ],
        });
        return;
      }

      if (parts[3] === 'yield-prediction') {
        sendJson(response, 200, {
          predictedYieldKgPerHa: field.predictedYieldKgPerHa,
          baseline: Math.round(field.predictedYieldKgPerHa * 0.93),
          factors: {
            seed: 0.89,
            planting: 0.94,
            population: 0.91,
            water: field.topLimitingFactor === 'water' ? 0.62 : 0.84,
            nutrient: field.topLimitingFactor === 'nutrient' ? 0.68 : 0.88,
            heat: field.topLimitingFactor === 'heat' ? 0.66 : 0.81,
            uv: 0.77,
          },
          limitingFactors: [field.topLimitingFactor ?? 'water'],
          confidence: field.confidence,
          explanation: `${field.name} is modeled against current soil, operation, heat, and water signals.`,
        });
        return;
      }

      if (parts[3] === 'operations') {
        sendJson(response, 200, {
          operations: [
            {
              id: `${field.id}-op-001`,
              fieldId: field.id,
              operationType: 'Irrigation',
              timestamp: '2026-05-25T15:00:00.000Z',
              inputs: { hours: 8, method: 'drip' },
              notes: 'Adjusted set length after pressure check.',
            },
            {
              id: `${field.id}-op-002`,
              fieldId: field.id,
              operationType: 'Fertigation',
              timestamp: '2026-05-20T14:00:00.000Z',
              inputs: { nKgHa: 18 },
              notes: 'Low-rate nitrogen maintenance pass.',
            },
          ],
        });
        return;
      }

      if (parts[3] === 'soil-tests') {
        sendJson(response, 200, {
          soilTests: [
            {
              id: `${field.id}-soil-001`,
              fieldId: field.id,
              sampleDate: '2026-05-11',
              soilPh: 6.8,
              organicMatterPercent: 1.9,
              cationExchangeCapacity: 12.4,
              nitrateNppm: 18,
              phosphorusPpm: 24,
              potassiumPpm: 186,
              electricalConductivity: 0.8,
              labName: 'Central Valley Agronomy Lab',
              notes: 'Representative composite sample.',
            },
          ],
        });
        return;
      }
    }

    if (url.pathname === '/api/gis/blocks') {
      sendJson(response, 200, {
        type: 'FeatureCollection',
        features: fields.map((field, index) => {
          const centerLat = 36.64 + index * 0.09;
          const centerLon = -119.88 + index * 0.11;
          const offset = 0.025;
          return {
            type: 'Feature',
            id: `block-${index + 1}`,
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [centerLon - offset, centerLat - offset],
                [centerLon + offset, centerLat - offset],
                [centerLon + offset, centerLat + offset],
                [centerLon - offset, centerLat + offset],
                [centerLon - offset, centerLat - offset],
              ]],
            },
            properties: {
              blockId: `SJV-${index + 1}`,
              soilType: field.soilType,
              elevationM: 85 + index * 18,
              irrigationZone: index % 2 === 0 ? 'North Canal' : 'West Lift',
              cropType: field.crop,
              centerLat,
              centerLon,
            },
          };
        }),
      });
      return;
    }

    notFound(response, url.pathname);
  });
}

function createWeatherApi() {
  return http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost:4300');

    if (url.pathname === '/api/entropy/current') {
      const postalCode = url.searchParams.get('postalCode') ?? '93650';
      const current = {
        ...entropyRecords.at(-1),
        timestamp: new Date().toISOString(),
        location: `Fresno, CA ${postalCode}`,
      };
      sendJson(response, 200, current);
      return;
    }

    if (url.pathname === '/api/entropy/history') {
      const meanEntropy =
        entropyRecords.reduce((sum, record) => sum + record.entropy, 0) / entropyRecords.length;
      const varianceEntropy =
        entropyRecords.reduce((sum, record) => sum + (record.entropy - meanEntropy) ** 2, 0) /
        entropyRecords.length;

      sendJson(response, 200, {
        records: entropyRecords,
        stats: {
          count: entropyRecords.length,
          meanEntropy: Number(meanEntropy.toFixed(3)),
          varianceEntropy: Number(varianceEntropy.toFixed(4)),
        },
      });
      return;
    }

    notFound(response, url.pathname);
  });
}

function listen(server, port, name) {
  server.listen(port, () => {
    console.log(`${name} mock API listening on http://localhost:${port}`);
  });
}

listen(createWeatherApi(), 4300, 'weather-intelligence');
listen(createFieldApi(), 4302, 'field-intelligence');
