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

// ---------------------------------------------------------------------------
// LLM helpers (shared by mock dev server and Netlify function)
// ---------------------------------------------------------------------------

const FIELD_DATA_CONTEXT = JSON.stringify({
  fields,
  soilTests: [
    { id: 'field-001-soil-001', fieldId: 'field-001', sampleDate: '2026-05-11', soilPh: 6.8, organicMatterPercent: 1.9, cationExchangeCapacity: 12.4, nitrateNppm: 18, phosphorusPpm: 24, potassiumPpm: 186, electricalConductivity: 0.8, labName: 'Central Valley Agronomy Lab' },
    { id: 'field-002-soil-001', fieldId: 'field-002', sampleDate: '2026-05-09', soilPh: 6.9, organicMatterPercent: 2.1, cationExchangeCapacity: 13.1, nitrateNppm: 22, phosphorusPpm: 28, potassiumPpm: 195, electricalConductivity: 0.9, labName: 'Central Valley Agronomy Lab' },
    { id: 'field-003-soil-001', fieldId: 'field-003', sampleDate: '2026-05-07', soilPh: 6.5, organicMatterPercent: 1.6, cationExchangeCapacity: 11.8, nitrateNppm: 14, phosphorusPpm: 19, potassiumPpm: 172, electricalConductivity: 0.7, labName: 'Central Valley Agronomy Lab' },
  ],
  operations: [
    { id: 'field-001-op-001', fieldId: 'field-001', operationType: 'Irrigation', timestamp: '2026-05-25T15:00:00Z', notes: 'Adjusted set length after pressure check.' },
    { id: 'field-001-op-002', fieldId: 'field-001', operationType: 'Fertigation', timestamp: '2026-05-20T14:00:00Z', notes: 'Low-rate nitrogen maintenance pass.' },
    { id: 'field-002-op-001', fieldId: 'field-002', operationType: 'Scouting', timestamp: '2026-05-24T09:00:00Z', notes: 'No pest pressure observed.' },
    { id: 'field-003-op-001', fieldId: 'field-003', operationType: 'Irrigation', timestamp: '2026-05-23T07:00:00Z', notes: 'Full set run following heat event.' },
  ],
}, null, 2);

function buildLlmSystemPrompt() {
  return `You are an agricultural data analyst AI for Agronomy Studio, a California field intelligence platform. Given a natural language question about agronomy field data, analyze the provided data and return a JSON object.

Schema:
- fields: id, name, regionCode, areaHectares, soilType, crop, stressScore (0-100), stressLabel (low/moderate/high/critical), predictedYieldKgPerHa, confidence (low/medium/high), topLimitingFactor (water/heat/nutrient/pest)
- soilTests: id, fieldId, sampleDate, soilPh, organicMatterPercent, cationExchangeCapacity, nitrateNppm, phosphorusPpm, potassiumPpm, electricalConductivity, labName
- operations: id, fieldId, operationType (Irrigation/Fertigation/Scouting), timestamp, notes

Current data:
${FIELD_DATA_CONTEXT}

Return ONLY a valid JSON object with this exact shape (no markdown, no explanation outside JSON):
{
  "sql": "SELECT statement that answers the question",
  "summary": "2-3 sentence natural language answer referencing specific field names and values",
  "columns": [{"name": "columnName", "type": "string|number|date|boolean"}],
  "rows": [{"columnName": value}]
}`;
}

async function callOpenAI(question, apiKey) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildLlmSystemPrompt() },
        { role: 'user', content: question },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

async function callGemini(question, apiKey) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${buildLlmSystemPrompt()}\n\nQuestion: ${question}` }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.candidates[0].content.parts[0].text);
}

// ---------------------------------------------------------------------------
// Canned mock responses (fallback / mock provider)
// ---------------------------------------------------------------------------

const cannedResponses = {
  stress: {
    summary: 'Found 1 field with high stress. Fresno North 12 has a stress score of 72 (high), primarily limited by water availability.',
    sql: "SELECT name, stressScore, stressLabel, topLimitingFactor FROM fields WHERE stressLabel IN ('high', 'critical') ORDER BY stressScore DESC;",
    columns: [
      { name: 'name', type: 'string' },
      { name: 'stressScore', type: 'number' },
      { name: 'stressLabel', type: 'string' },
      { name: 'topLimitingFactor', type: 'string' },
    ],
    rows: [
      { name: 'Fresno North 12', stressScore: 72, stressLabel: 'high', topLimitingFactor: 'water' },
    ],
  },
  yield: {
    summary: 'Madera West 7 (tomato) has the highest predicted yield at 86,500 kg/ha. Fresno North 12 (almond) predicts 4,120 kg/ha and Kings East 4 (pistachio) predicts 2,980 kg/ha.',
    sql: 'SELECT name, crop, predictedYieldKgPerHa, confidence FROM fields ORDER BY predictedYieldKgPerHa DESC;',
    columns: [
      { name: 'name', type: 'string' },
      { name: 'crop', type: 'string' },
      { name: 'predictedYieldKgPerHa', type: 'number' },
      { name: 'confidence', type: 'string' },
    ],
    rows: [
      { name: 'Madera West 7', crop: 'tomato', predictedYieldKgPerHa: 86500, confidence: 'medium' },
      { name: 'Fresno North 12', crop: 'almond', predictedYieldKgPerHa: 4120, confidence: 'high' },
      { name: 'Kings East 4', crop: 'pistachio', predictedYieldKgPerHa: 2980, confidence: 'high' },
    ],
  },
  soil: {
    summary: 'All fields have soil pH between 6.5–7.0 with organic matter around 1.9%. Potassium levels are adequate (186 ppm) while nitrate-N is moderate (18 ppm).',
    sql: 'SELECT f.name, s.soilPh, s.organicMatterPercent, s.nitrateNppm, s.phosphorusPpm, s.potassiumPpm FROM soil_tests s JOIN fields f ON s.fieldId = f.id ORDER BY s.sampleDate DESC;',
    columns: [
      { name: 'name', type: 'string' },
      { name: 'soilPh', type: 'number' },
      { name: 'organicMatterPercent', type: 'number' },
      { name: 'nitrateNppm', type: 'number' },
      { name: 'phosphorusPpm', type: 'number' },
      { name: 'potassiumPpm', type: 'number' },
    ],
    rows: [
      { name: 'Fresno North 12', soilPh: 6.8, organicMatterPercent: 1.9, nitrateNppm: 18, phosphorusPpm: 24, potassiumPpm: 186 },
      { name: 'Madera West 7', soilPh: 6.9, organicMatterPercent: 2.1, nitrateNppm: 22, phosphorusPpm: 28, potassiumPpm: 195 },
      { name: 'Kings East 4', soilPh: 6.5, organicMatterPercent: 1.6, nitrateNppm: 14, phosphorusPpm: 19, potassiumPpm: 172 },
    ],
  },
  default: {
    summary: 'There are 3 active fields in the San Joaquin Valley region: Fresno North 12 (almond, 48.6 ha), Madera West 7 (tomato, 36.2 ha), and Kings East 4 (pistachio, 61.8 ha).',
    sql: 'SELECT name, crop, areaHectares, regionCode, soilType FROM fields ORDER BY name;',
    columns: [
      { name: 'name', type: 'string' },
      { name: 'crop', type: 'string' },
      { name: 'areaHectares', type: 'number' },
      { name: 'regionCode', type: 'string' },
      { name: 'soilType', type: 'string' },
    ],
    rows: [
      { name: 'Fresno North 12', crop: 'almond', areaHectares: 48.6, regionCode: 'CA-SJV', soilType: 'Hanford sandy loam' },
      { name: 'Kings East 4', crop: 'pistachio', areaHectares: 61.8, regionCode: 'CA-SJV', soilType: 'Tujunga loamy sand' },
      { name: 'Madera West 7', crop: 'tomato', areaHectares: 36.2, regionCode: 'CA-SJV', soilType: 'San Joaquin loam' },
    ],
  },
};

function matchMockResponse(question) {
  const q = question.toLowerCase();
  if (q.includes('stress') || q.includes('critical') || q.includes('risk')) return cannedResponses.stress;
  if (q.includes('yield') || q.includes('production') || q.includes('harvest')) return cannedResponses.yield;
  if (q.includes('soil') || q.includes('ph') || q.includes('nutrient') || q.includes('nitrogen')) return cannedResponses.soil;
  return cannedResponses.default;
}

// ---------------------------------------------------------------------------
// Query API server
// ---------------------------------------------------------------------------

function createQueryApi() {
  return http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost:4304');

    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
      });
      response.end();
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/query') {
      let body = '';
      request.on('data', chunk => { body += chunk; });
      request.on('end', async () => {
        try {
          const { question, provider } = JSON.parse(body);
          if (!question || typeof question !== 'string' || !question.trim()) {
            sendJson(response, 400, { error: 'A question is required.' });
            return;
          }

          const start = Date.now();
          let llmResult;

          if (provider === 'openai') {
            if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set. Start the server with OPENAI_API_KEY=sk-... npm run start:apis');
            llmResult = await callOpenAI(question, process.env.OPENAI_API_KEY);
          } else if (provider === 'gemini') {
            if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set. Start the server with GEMINI_API_KEY=AIza... npm run start:apis');
            llmResult = await callGemini(question, process.env.GEMINI_API_KEY);
          } else {
            await new Promise(resolve => setTimeout(resolve, 150));
            llmResult = matchMockResponse(question);
          }

          sendJson(response, 200, {
            question,
            sql: llmResult.sql ?? '',
            summary: llmResult.summary ?? '',
            columns: llmResult.columns ?? [],
            rows: llmResult.rows ?? [],
            rowCount: (llmResult.rows ?? []).length,
            executionMs: Date.now() - start,
            cached: provider === 'mock',
          });
        } catch (err) {
          sendJson(response, 500, { error: err?.message ?? 'LLM query failed.' });
        }
      });
      return;
    }

    if (url.pathname === '/api/cache/status') {
      sendJson(response, 200, {
        tables: [
          { table: 'fields', rowCount: 3, lastSync: new Date(Date.now() - 300000).toISOString(), stale: false },
          { table: 'soil_tests', rowCount: 3, lastSync: new Date(Date.now() - 300000).toISOString(), stale: false },
          { table: 'operations', rowCount: 6, lastSync: new Date(Date.now() - 300000).toISOString(), stale: false },
          { table: 'yield_predictions', rowCount: 3, lastSync: new Date(Date.now() - 600000).toISOString(), stale: false },
          { table: 'nutrient_balances', rowCount: 3, lastSync: new Date(Date.now() - 600000).toISOString(), stale: false },
          { table: 'entropy_readings', rowCount: 24, lastSync: new Date(Date.now() - 60000).toISOString(), stale: false },
        ],
        lastFullSync: new Date(Date.now() - 300000).toISOString(),
        healthy: true,
      });
      return;
    }

    notFound(response, url.pathname);
  });
}

// ---------------------------------------------------------------------------
// FRED (economic data) mock — mirrors the Netlify fred-api proxy shape
// ---------------------------------------------------------------------------

function buildSeries(base, step, points) {
  const observations = Array.from({ length: points }, (_, index) => {
    const date = new Date(Date.UTC(2024, 5, 1));
    date.setUTCMonth(date.getUTCMonth() + index);
    const value = Number((base + Math.sin(index / 3) * step).toFixed(2));
    return { date: date.toISOString().slice(0, 10), value };
  });
  const latest = observations.at(-1);
  const previous = observations.at(-2);
  return { observations, latest, previous, change: Number((latest.value - previous.value).toFixed(2)) };
}

function createFredApi() {
  return http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost:4306');

    if (url.pathname === '/api/indicators') {
      const unrate = buildSeries(3.9, 0.4, 24);
      const cpi = buildSeries(312, 6, 24);
      const fedfunds = buildSeries(4.8, 0.5, 24);
      const usrec = buildSeries(0, 0, 24);
      sendJson(response, 200, {
        indicators: [
          { id: 'UNRATE', title: 'Unemployment Rate (mock)', units: '%', frequency: 'M', ...unrate },
          { id: 'CPIAUCSL', title: 'Consumer Price Index (mock)', units: 'Index', frequency: 'M', ...cpi },
          { id: 'FEDFUNDS', title: 'Federal Funds Rate (mock)', units: '%', frequency: 'M', ...fedfunds },
          { id: 'USREC', title: 'NBER Recession Indicator (mock)', units: '0/1', frequency: 'M', ...usrec },
        ],
      });
      return;
    }

    notFound(response, url.pathname);
  });
}

// ---------------------------------------------------------------------------
// Data.gov catalog mock — mirrors the Netlify datagov-api proxy shape
// ---------------------------------------------------------------------------

function createDatagovApi() {
  return http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost:4308');

    if (url.pathname === '/api/search') {
      const q = url.searchParams.get('q') ?? 'agriculture';
      sendJson(response, 200, {
        query: q,
        after: null,
        results: [
          {
            title: `USDA Cropland Data Layer (mock match for "${q}")`,
            description: 'Annual raster, geo-referenced, crop-specific land cover produced using satellite imagery and extensive agricultural ground truth.',
            publisher: 'U.S. Department of Agriculture',
            organization: 'Department of Agriculture',
            keywords: ['agriculture', 'cropland', 'remote-sensing', 'land-cover'],
            lastHarvested: '2026-04-18T11:02:00.000Z',
            landingPage: 'https://catalog.data.gov/dataset/cropland-data-layer',
            identifier: 'mock-cdl-001',
            distributionTitles: ['CDL GeoTIFF', 'CDL Metadata'],
          },
          {
            title: 'California Irrigated Lands Regulatory Program (mock)',
            description: 'Monitoring data for irrigated agricultural lands across the Central Valley, including nutrient and groundwater indicators.',
            publisher: 'California Water Boards',
            organization: 'State of California',
            keywords: ['irrigation', 'groundwater', 'nutrients', 'california'],
            lastHarvested: '2026-03-30T09:15:00.000Z',
            landingPage: 'https://catalog.data.gov/dataset',
            identifier: 'mock-ilrp-002',
            distributionTitles: ['CSV', 'API'],
          },
          {
            title: 'Quick Stats Agricultural Database (mock)',
            description: 'USDA NASS survey and census data covering crops, yields, prices, and economics at national, state, and county levels.',
            publisher: 'National Agricultural Statistics Service',
            organization: 'Department of Agriculture',
            keywords: ['yield', 'prices', 'census', 'economics'],
            lastHarvested: '2026-05-02T16:40:00.000Z',
            landingPage: 'https://catalog.data.gov/dataset/quick-stats-agricultural-database',
            identifier: 'mock-quickstats-003',
            distributionTitles: ['Query Tool', 'Bulk Download'],
          },
        ],
      });
      return;
    }

    notFound(response, url.pathname);
  });
}

// ---------------------------------------------------------------------------
// Agronomy gateway mock — mirrors the TypeScript agronomy-api function shape.
// Canned, deterministic data so the Blazor Agronomy/Ask pages work under the
// `dotnet run` + node-mock workflow without the Netlify CLI. Production uses the
// real TypeScript functions (real CIMIS/NRCS/WUCOLS/etc.) via netlify redirects.
// ---------------------------------------------------------------------------

function readLatLon(url) {
  const lat = Number(url.searchParams.get('lat') ?? url.searchParams.get('latitude'));
  const lon = Number(url.searchParams.get('lon') ?? url.searchParams.get('longitude'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { latitude: lat, longitude: lon };
}

function cannedEto(point) {
  const eto = Number((0.18 + Math.abs(Math.sin(point.latitude)) * 0.12).toFixed(3));
  return {
    date: new Date().toISOString().slice(0, 10),
    stationId: '80',
    stationName: 'Fresno State (mock)',
    location: point,
    eto,
    airTempF: 88,
    solarRadiation: 612,
    precipitation: 0,
    source: 'CIMIS (mock)',
  };
}

function cannedSoil(point) {
  return {
    location: point,
    mapUnitName: 'Hanford sandy loam (mock)',
    componentName: 'Hanford',
    texture: 'sandy loam',
    drainageClass: 'well drained',
    hydrologicGroup: 'B',
    availableWaterCapacity: 0.14,
    rootZoneDepthIn: 36,
    source: 'NRCS SSURGO (mock)',
  };
}

function cannedForecast() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.now() + index * 86400000);
    return {
      date: date.toISOString().slice(0, 10),
      eto: Number((0.2 + Math.sin(index / 2) * 0.05).toFixed(3)),
      precipitation: index === 4 ? 0.12 : 0,
      maxTempF: 92 + index,
      minTempF: 60 + index,
      source: 'Open-Meteo (mock)',
    };
  });
}

function cannedIrrigation(crop) {
  const eto = 0.26;
  const kc = 0.95;
  const cropEt = Number((eto * kc).toFixed(3));
  const raw = Number((0.14 * 36 * 0.5).toFixed(2));
  return {
    cropName: crop ?? 'Almond (mock)',
    eto,
    kc,
    cropEt,
    netIrrigationIn: raw,
    grossIrrigationIn: Number((raw / 0.85).toFixed(2)),
    intervalDays: Math.max(1, Math.round(raw / cropEt)),
    readilyAvailableWaterIn: raw,
    forecastRainIn: 0.12,
    systemEfficiency: 0.85,
    heatRisk: false,
    confidence: 'medium',
    notes: ['Mock recommendation from the local dev gateway.'],
  };
}

function createAgronomyApi() {
  return http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost:4310');
    const point = readLatLon(url);

    if (url.pathname === '/api/agronomy/location-summary') {
      if (!point) return sendJson(response, 400, { error: 'lat and lon are required' });
      const crop = url.searchParams.get('crop') ?? undefined;
      sendJson(response, 200, {
        location: point,
        county: 'Fresno',
        resolvedAt: new Date().toISOString(),
        evapotranspiration: cannedEto(point),
        forecast: cannedForecast(),
        soil: cannedSoil(point),
        waterQuality: [],
        datasets: [],
        irrigation: cannedIrrigation(crop),
      });
      return;
    }

    if (url.pathname === '/api/agronomy/irrigation-recommendation') {
      if (!point) return sendJson(response, 400, { error: 'lat and lon are required' });
      sendJson(response, 200, cannedIrrigation(url.searchParams.get('crop') ?? undefined));
      return;
    }

    if (url.pathname === '/api/agronomy/soil-water-balance') {
      if (!point) return sendJson(response, 400, { error: 'lat and lon are required' });
      sendJson(response, 200, {
        location: point,
        availableWaterCapacity: 0.14,
        rootZoneDepthIn: 36,
        totalAvailableWaterIn: 5.04,
        readilyAvailableWaterIn: 2.52,
        recentEtIn: 0.26,
        forecastEtIn: 1.4,
        forecastRainIn: 0.12,
        projectedDeficitIn: 1.54,
      });
      return;
    }

    if (url.pathname === '/api/agronomy/risk-summary') {
      if (!point) return sendJson(response, 400, { error: 'lat and lon are required' });
      sendJson(response, 200, {
        location: point,
        heatRisk: true,
        droughtStress: true,
        waterQualityConcern: false,
        notes: ['High temperatures forecast; elevated crop water demand.'],
      });
      return;
    }

    if (url.pathname === '/api/agronomy/health' || url.pathname === '/') {
      sendJson(response, 200, { service: 'agronomy-gateway', status: 'ok' });
      return;
    }

    notFound(response, url.pathname);
  });
}

// ---------------------------------------------------------------------------
// AI agronomy search mock — mirrors the TypeScript ai-search-api function shape.
// Deterministic keyword classification + canned routed summary for local dev.
// ---------------------------------------------------------------------------

function classifyIntentMock(q) {
  const text = ` ${q.toLowerCase()} `;
  if (/irrigat|how much water|watering/.test(text)) return 'irrigation_recommendation';
  if (/nitrate|water quality|salinity|groundwater/.test(text)) return 'water_quality';
  if (/soil|texture|drainage/.test(text)) return 'soil_profile';
  if (/evapotranspiration|eto| et /.test(text)) return 'evapotranspiration';
  if (/dataset|open data|report/.test(text)) return 'dataset_discovery';
  if (/fresno|bakersfield|salinas|summary|overview|conditions/.test(text)) return 'location_summary';
  return 'unknown';
}

function createAiSearchApi() {
  return http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost:4312');

    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
      });
      response.end();
      return;
    }

    if (url.pathname === '/api/search') {
      const handle = (query) => {
        if (!query || !query.trim()) {
          sendJson(response, 400, { error: 'A "query" is required.' });
          return;
        }
        const intent = classifyIntentMock(query);
        sendJson(response, 200, {
          query,
          intent,
          params: { crop: /almond/i.test(query) ? 'Almond' : undefined, county: /fresno/i.test(query) ? 'Fresno' : undefined },
          summary:
            intent === 'unknown'
              ? "I couldn't tell what you're asking. Try \"irrigation for almonds near Fresno\" (mock)."
              : `Mock ${intent.replace(/_/g, ' ')} answer for "${query}". Run netlify dev for real routed data.`,
          sources: intent === 'unknown' ? [] : ['CIMIS', 'NRCS SSURGO', 'WUCOLS', 'Open-Meteo'],
          confidence: intent === 'unknown' ? 0.2 : 0.7,
        });
      };

      if (request.method === 'POST') {
        let body = '';
        request.on('data', (chunk) => { body += chunk; });
        request.on('end', () => {
          try {
            handle(JSON.parse(body || '{}').query);
          } catch {
            sendJson(response, 400, { error: 'Invalid JSON body.' });
          }
        });
        return;
      }
      handle(url.searchParams.get('q') ?? url.searchParams.get('query'));
      return;
    }

    if (url.pathname === '/api/ai/health' || url.pathname === '/') {
      sendJson(response, 200, { service: 'ai-agronomy-search', status: 'ok' });
      return;
    }

    notFound(response, url.pathname);
  });
}

listen(createWeatherApi(), 4300, 'weather-intelligence');
listen(createFieldApi(), 4302, 'field-intelligence');
listen(createQueryApi(), 4304, 'query-intelligence');
listen(createFredApi(), 4306, 'fred-economic');
listen(createDatagovApi(), 4308, 'datagov-catalog');
listen(createAgronomyApi(), 4310, 'agronomy-gateway');
listen(createAiSearchApi(), 4312, 'ai-agronomy-search');
