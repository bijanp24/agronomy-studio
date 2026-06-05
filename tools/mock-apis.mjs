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

// ---------------------------------------------------------------------------
// NASA open-data mock — mirrors the api.nasa.gov shape for APOD, Mars, NEO.
// Canned static data so the Space page works without a real NASA API key.
// ---------------------------------------------------------------------------

const TODAY = new Date().toISOString().slice(0, 10);

function createNasaApi() {
  return http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost:4314');

    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, OPTIONS',
        'access-control-allow-headers': 'content-type',
      });
      response.end();
      return;
    }

    if (url.pathname === '/planetary/apod') {
      sendJson(response, 200, {
        title: 'Central Valley from Space',
        date: TODAY,
        explanation:
          'The San Joaquin Valley stretches across central California in this composite image. ' +
          'Agricultural fields and irrigation canals form a patchwork of greens and tans, ' +
          'reflecting the intensive cultivation that makes this region one of the most productive on Earth.',
        url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/240px-PNG_transparency_demonstration_1.png',
        media_type: 'image',
        copyright: 'Mock Data',
      });
      return;
    }

    if (url.pathname.startsWith('/mars-photos/api/v1/rovers/') && url.pathname.endsWith('/latest_photos')) {
      sendJson(response, 200, {
        latest_photos: [
          {
            id: 1001,
            img_src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/240px-PNG_transparency_demonstration_1.png',
            earth_date: TODAY,
            camera: { name: 'NAVCAM', full_name: 'Navigation Camera' },
            rover: { name: 'Curiosity', status: 'active' },
          },
          {
            id: 1002,
            img_src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/240px-PNG_transparency_demonstration_1.png',
            earth_date: TODAY,
            camera: { name: 'FHAZ', full_name: 'Front Hazard Avoidance Camera' },
            rover: { name: 'Curiosity', status: 'active' },
          },
        ],
      });
      return;
    }

    if (url.pathname === '/neo/rest/v1/feed') {
      sendJson(response, 200, {
        element_count: 2,
        near_earth_objects: {
          [TODAY]: [
            {
              name: '2026 AB1 (Mock)',
              nasa_jpl_url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html',
              is_potentially_hazardous_asteroid: false,
              close_approach_data: [
                {
                  close_approach_date: TODAY,
                  miss_distance: { kilometers: '4823190.5' },
                  relative_velocity: { kilometers_per_hour: '38420.7' },
                },
              ],
            },
            {
              name: '2026 CD5 (Mock)',
              nasa_jpl_url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html',
              is_potentially_hazardous_asteroid: false,
              close_approach_data: [
                {
                  close_approach_date: TODAY,
                  miss_distance: { kilometers: '7251830.2' },
                  relative_velocity: { kilometers_per_hour: '51003.4' },
                },
              ],
            },
          ],
        },
      });
      return;
    }

    notFound(response, url.pathname);
  });
}

// ---------------------------------------------------------------------------
// Spatial engine mock (port 4316)
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function shoelaceAcres(ring) {
  if (ring.length < 3) return 0;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const centLat = ring.reduce((s, p) => s + p.lat, 0) / ring.length;
  const cosLat = Math.cos(toRad(centLat));
  const pts = ring.map((p) => ({ x: toRad(p.lon) * R * cosLat, y: toRad(p.lat) * R }));
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2 / 4046.856422;
}

function haversineMiles(a, b) {
  const R = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data)); } catch { resolve({}); }
    });
  });
}

function createSpatialApi() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost:4316');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' });
      res.end(); return;
    }
    const path = url.pathname;
    if (path === '/api/spatial/demo') {
      try {
        const data = JSON.parse(readFileSync(resolve(__dirname, '../data/demo-field.json'), 'utf-8'));
        sendJson(res, 200, data);
      } catch { sendJson(res, 500, { error: 'demo-field.json not found' }); }
      return;
    }
    if (path === '/api/spatial/boundary-area' && req.method === 'POST') {
      const body = await readBody(req);
      const ring = body.ring ?? [];
      const areaAcres = shoelaceAcres(ring);
      let perimMiles = 0;
      for (let i = 0; i < ring.length; i++) perimMiles += haversineMiles(ring[i], ring[(i + 1) % ring.length]);
      sendJson(res, 200, {
        blockId: 'boundary-area',
        computed: { areaAcres: +areaAcres.toFixed(4), areaHectares: +(areaAcres * 0.404686).toFixed(4), perimeterMiles: +perimMiles.toFixed(4), perimeterKm: +(perimMiles * 1.60934).toFixed(4), vertexCount: ring.length },
        outputLayers: [{ id: 'output-boundary-area', name: 'Field Boundary', type: 'boundary', geometry: { type: 'Polygon', coordinates: [ring.map(p => [p.lon, p.lat])] }, attributes: { areaAcres }, source: 'spatial-engine' }],
        explanation: `This field covers ${areaAcres.toFixed(2)} acres with a perimeter of ${perimMiles.toFixed(2)} miles.`,
      }); return;
    }
    if (path === '/api/spatial/terrain-flow' && req.method === 'POST') {
      const body = await readBody(req);
      const grid = body.values ?? [];
      sendJson(res, 200, {
        blockId: 'terrain-flow',
        computed: { minSlopePercent: 0.5, maxSlopePercent: 2.1, avgSlopePercent: 1.2, poolingZoneCount: 0, runoffZoneCount: 1, analyzedPoints: 9 },
        outputLayers: [
          { id: 'output-terrain-slope', name: 'Terrain Slope', type: 'terrain', attributes: { points: [], minSlopePercent: 0.5, maxSlopePercent: 2.1, avgSlopePercent: 1.2 }, source: 'spatial-engine' },
          { id: 'output-terrain-pooling', name: 'Pooling Zones', type: 'terrain', attributes: { zones: [], count: 0 }, source: 'spatial-engine' },
          { id: 'output-terrain-runoff', name: 'Runoff Risk Zones', type: 'terrain', attributes: { zones: [], count: 1 }, source: 'spatial-engine' },
        ],
        explanation: `Average slope is 1.2% (range 0.5%–2.1%). 0 pooling zone(s) and 1 runoff-risk zone(s) identified.`,
      }); return;
    }
    if (path === '/api/spatial/carrying-capacity' && req.method === 'POST') {
      const body = await readBody(req);
      const mode = body.mode ?? 'logistic';
      sendJson(res, 200, {
        blockId: 'carrying-capacity',
        computed: mode === 'logistic'
          ? { finalPopulation: 195.2, carryingCapacity: body.logistic?.carryingCapacity ?? 200, percentOfCarryingCapacity: 97.6, steps: body.logistic?.steps ?? 50 }
          : { finalPrey: 38.4, finalPredator: 10.2, steps: body.lotkaVolterra?.steps ?? 50 },
        outputLayers: [{ id: mode === 'logistic' ? 'output-logistic-series' : 'output-lotka-volterra-series', name: mode === 'logistic' ? 'Logistic Growth Series' : 'Predator-Prey Series', type: 'custom', attributes: { series: [] }, source: 'spatial-engine' }],
        explanation: mode === 'logistic' ? 'Population reached 195.2, which is 97.6% of carrying capacity.' : 'After simulation: prey = 38, predators = 10.',
      }); return;
    }
    if (path === '/api/spatial/health' || path === '/') { sendJson(res, 200, { service: 'spatial-engine', status: 'ok' }); return; }
    notFound(res, path);
  });
}

// ---------------------------------------------------------------------------
// Transfer hub mock (port 4318)
// ---------------------------------------------------------------------------

function createTransferApi() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost:4318');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' });
      res.end(); return;
    }
    const path = url.pathname;
    if (path === '/api/transfer/health' || path === '/') { sendJson(res, 200, { service: 'transfer-hub', status: 'ok' }); return; }
    if (path === '/api/transfer/import' && req.method === 'POST') {
      const body = await readBody(req);
      sendJson(res, 200, {
        importId: `import-${Date.now()}`,
        status: 'validated',
        summary: { detected: { growers: 1, farms: 1, fields: body.rows?.length ?? 0 }, created: body.rows?.length ?? 0, updated: 0, skipped: 0, conflicted: 0 },
        errors: [],
      }); return;
    }
    if (path === '/api/transfer/export') {
      sendJson(res, 200, { exportId: `export-${Date.now()}`, format: 'csv', records: 0, downloadUrl: null }); return;
    }
    notFound(res, path);
  });
}

listen(createWeatherApi(), 4300, 'weather-intelligence');
listen(createFieldApi(), 4302, 'field-intelligence');
listen(createQueryApi(), 4304, 'query-intelligence');
listen(createFredApi(), 4306, 'fred-economic');
listen(createDatagovApi(), 4308, 'datagov-catalog');
listen(createAgronomyApi(), 4310, 'agronomy-gateway');
listen(createAiSearchApi(), 4312, 'ai-agronomy-search');
listen(createNasaApi(), 4314, 'NASA open APIs (mock)');
listen(createSpatialApi(), 4316, 'spatial-engine');
listen(createTransferApi(), 4318, 'transfer-hub');
listen(createMlApi(), 4320, 'ml-service');
listen(createGisApi(), 4322, 'gis-overlay-engine');

// ---------------------------------------------------------------------------
// GIS overlay API mock (port 4322)
// ---------------------------------------------------------------------------

function createGisApi() {
  // Deterministic hash identical to netlify/lib/gis.ts
  function h(s) {
    let v = 5381;
    for (let i = 0; i < s.length; i++) v = ((v * 33) ^ s.charCodeAt(i)) >>> 0;
    return v;
  }
  function seed(...parts) { return h(parts.join('|')); }
  function norm01(s) { return (s % 10_000) / 10_000; }

  const CROP_CLASS = { almond: 'permanent', pistachio: 'permanent', walnut: 'permanent', citrus: 'permanent', grape: 'permanent', olive: 'permanent' };
  const GDD_BASE = { almond: 10, pistachio: 10, walnut: 10, citrus: 13, grape: 10, tomato: 10, corn: 10, cotton: 15.6, wheat: 0, alfalfa: 5 };
  const GDD_THRESH = { almond: 1400, pistachio: 1600, walnut: 1800, citrus: 2000, grape: 1500, tomato: 1100, corn: 2700, cotton: 2200, wheat: 1200, alfalfa: 800 };
  const SOIL_AWC = { 'hanford sandy loam': 0.11, 'san joaquin loam': 0.16, 'tujunga loamy sand': 0.09, 'yolo silt loam': 0.18, 'merced clay loam': 0.20 };
  const YIELD_BASELINE = { almond: 4100, pistachio: 2950, walnut: 3800, citrus: 32000, grape: 14000, tomato: 85000, corn: 12000, cotton: 1200, wheat: 5500, alfalfa: 18000 };
  const SEASON_NOTES = {
    '2021': 'Drought year — reduced irrigation allocation across SJV.',
    '2022': 'Moderate year — above-average spring rain offset ET demand.',
    '2023': 'Wet year — atmospheric river events; delayed planting for annuals.',
    '2024': 'Near-normal year — good early-season moisture.',
    '2025': 'Current season — data through end of growing season.',
  };

  function vegetationIndex(b, indexType) {
    const cloudSeed = seed(b.blockId, b.season, 'cloud');
    const cloudFree = (cloudSeed % 10) !== 0;
    const cls = CROP_CLASS[b.cropType?.toLowerCase()] ?? 'annual';
    const valueSeed = seed(b.blockId, b.season, indexType);
    let base = cls === 'permanent' ? 0.62 : 0.45;
    let range = cls === 'permanent' ? 0.23 : 0.35;
    if (b.cropType?.toLowerCase() === 'wheat') { base = 0.18; range = 0.30; }
    if (indexType === 'evi' && cls === 'permanent') { base -= 0.07; range *= 0.85; }
    const raw = cloudFree ? base + norm01(valueSeed) * range : 0;
    const value = parseFloat(Math.min(1, Math.max(0, raw)).toFixed(3));
    const stressLevel = value > 0.65 ? 'low' : value > 0.45 ? 'moderate' : 'high';
    return { blockId: b.blockId, indexType, value, cloudFree, stressLevel, source: 'mock' };
  }

  function gddAccumulation(b) {
    const s = seed(b.blockId, b.season, 'gdd');
    const base = GDD_BASE[b.cropType?.toLowerCase()] ?? 10;
    const threshold = GDD_THRESH[b.cropType?.toLowerCase()] ?? 1200;
    const meanTempC = 22 + norm01(s) * 6 - (b.elevationM ?? 85) * 0.006;
    const effectiveDegDay = Math.max(0, meanTempC - base);
    const daysSeed = seed(b.blockId, b.season, 'days');
    const daysInSeason = 160 + Math.round(norm01(daysSeed) * 30);
    const gddAccumulated = parseFloat((effectiveDegDay * daysInSeason).toFixed(0));
    const percentComplete = parseFloat(Math.min(100, (gddAccumulated / threshold) * 100).toFixed(1));
    return { blockId: b.blockId, gddAccumulated, gddBase: base, cropThreshold: threshold, percentComplete, daysInSeason, source: 'mock' };
  }

  function microclimateSummary(b) {
    const s = seed(b.blockId, b.season, 'mc');
    const etS = seed(b.blockId, b.season, 'et');
    const windS = seed(b.blockId, b.season, 'wind');
    const elevationM = b.elevationM ?? 85;
    const referenceEtMmDay = parseFloat((3 + norm01(etS) * 5).toFixed(2));
    const elevFactor = Math.min(1, elevationM / 300);
    const frostRiskScore = parseFloat(Math.min(1, norm01(s) * 0.4 + elevFactor * 0.6).toFixed(3));
    const frostRiskLevel = frostRiskScore > 0.7 ? 'high' : frostRiskScore > 0.4 ? 'moderate' : frostRiskScore > 0.15 ? 'low' : 'none';
    const windSpeedMph = parseFloat((2 + norm01(windS) * 18).toFixed(1));
    const windDirectionDeg = Math.round(norm01(seed(b.blockId, b.season, 'wdir')) * 360);
    return { blockId: b.blockId, referenceEtMmDay, frostRiskScore, frostRiskLevel, windSpeedMph, windDirectionDeg, source: 'mock' };
  }

  function soilMoistureProbe(b) {
    const awc = SOIL_AWC[b.soilType?.toLowerCase()] ?? 0.14;
    const fcPct = (awc + 0.05) * 100;
    const v12 = parseFloat((fcPct * 0.4 + norm01(seed(b.blockId, b.season, 'vwc12')) * fcPct * 0.4).toFixed(1));
    const v24 = parseFloat((fcPct * 0.5 + norm01(seed(b.blockId, b.season, 'vwc24')) * fcPct * 0.3).toFixed(1));
    const v36 = parseFloat((fcPct * 0.6 + norm01(seed(b.blockId, b.season, 'vwc36')) * fcPct * 0.3).toFixed(1));
    const avgVwc = (v12 + v24 + v36) / 3;
    const deficitPct = parseFloat(Math.max(0, 100 - (avgVwc / fcPct) * 100).toFixed(1));
    const irrigationNeedIn = parseFloat((deficitPct * awc * 24 / 100).toFixed(2));
    const ageSeed = seed(b.blockId, b.season, 'age');
    const lastReadingAgeHours = 2 + (ageSeed % 47);
    return {
      blockId: b.blockId, probeId: `probe-${b.blockId}`,
      readings: [{ depthIn: 12, vwcPct: v12 }, { depthIn: 24, vwcPct: v24 }, { depthIn: 36, vwcPct: v36 }],
      deficitPct, irrigationNeedIn, lastReadingAgeHours, stale: lastReadingAgeHours > 24, source: 'mock',
    };
  }

  function seasonSnapshot(b) {
    const year = parseInt(b.season, 10);
    const yearMod = (year % 2 === 0) ? 1.05 : 0.97;
    const ys = seed(b.blockId, b.season, 'yield');
    const baseline = YIELD_BASELINE[b.cropType?.toLowerCase()] ?? 4000;
    const yieldEstimateKgHa = Math.round(baseline * yearMod * (0.88 + norm01(ys) * 0.24));
    const veg = vegetationIndex(b, 'ndvi');
    const gdd = gddAccumulation(b);
    const mc = microclimateSummary(b);
    return {
      blockId: b.blockId, season: b.season, cropType: b.cropType,
      irrigationZone: b.irrigationZone ?? '', ndvi: veg.value,
      gddAccumulated: gdd.gddAccumulated, referenceEtMmDay: mc.referenceEtMmDay,
      yieldEstimateKgHa, note: SEASON_NOTES[b.season] ?? `Season ${b.season}`, source: 'mock',
    };
  }

  function buildVraPrescription(zones) {
    const features = zones.map(z => ({
      type: 'Feature', id: z.blockId,
      properties: { blockId: z.blockId, cropType: z.cropType, nitrogen_lb_ac: z.rates?.nitrogenLbAc ?? 0, phosphorus_lb_ac: z.rates?.phosphorusLbAc ?? 0, potassium_lb_ac: z.rates?.potassiumLbAc ?? 0, seed_lb_ac: z.rates?.seedLbAc ?? 0, prescription_source: 'agronomy-studio-mock' },
      geometry: { type: 'Polygon', coordinates: [z.coordinates] },
    }));
    const header = 'blockId,cropType,nitrogen_lb_ac,phosphorus_lb_ac,potassium_lb_ac,seed_lb_ac';
    const rows = zones.map(z => [z.blockId, z.cropType, z.rates?.nitrogenLbAc ?? 0, z.rates?.phosphorusLbAc ?? 0, z.rates?.potassiumLbAc ?? 0, z.rates?.seedLbAc ?? 0].join(','));
    return { exportId: `vra-${Date.now()}`, format: 'geojson+csv', blockCount: zones.length, geojson: { type: 'FeatureCollection', features }, csv: [header, ...rows].join('\n'), isoXmlNote: 'ISO-XML (ISOBUS TaskData) export is planned. See docs/gis-overlays.md for the format compatibility matrix.', generatedAt: new Date().toISOString() };
  }

  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost:4322');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' });
      res.end(); return;
    }
    const path = url.pathname;
    const body = req.method === 'POST' ? await readBody(req) : {};

    if (path === '/api/gis/health' || path === '/') { sendJson(res, 200, { status: 'ok', demo_mode: true }); return; }

    if (path === '/api/gis/vegetation') {
      const blocks = body.blocks ?? [];
      const indexType = body.indexType ?? 'ndvi';
      sendJson(res, 200, { indexType, results: blocks.map(b => vegetationIndex(b, indexType)) }); return;
    }
    if (path === '/api/gis/gdd') {
      const blocks = body.blocks ?? [];
      sendJson(res, 200, { results: blocks.map(b => gddAccumulation(b)) }); return;
    }
    if (path === '/api/gis/microclimate') {
      const blocks = body.blocks ?? [];
      sendJson(res, 200, { results: blocks.map(b => microclimateSummary(b)) }); return;
    }
    if (path === '/api/gis/soil-moisture') {
      const blocks = body.blocks ?? [];
      sendJson(res, 200, { results: blocks.map(b => soilMoistureProbe(b)) }); return;
    }
    if (path === '/api/gis/timeline') {
      const blocks = body.blocks ?? [];
      const seasons = body.seasons ?? ['2021', '2022', '2023', '2024', '2025'];
      const snapshots = seasons.flatMap(season => blocks.map(b => seasonSnapshot({ ...b, season })));
      sendJson(res, 200, { seasons, snapshots }); return;
    }
    if (path === '/api/gis/vra/export') {
      const zones = body.zones ?? [];
      sendJson(res, 200, buildVraPrescription(zones)); return;
    }
    notFound(res, path);
  });
}

// ---------------------------------------------------------------------------
// ML API mock (port 4320)
// ---------------------------------------------------------------------------

function createMlApi() {
  const DISCLAIMER =
    'This explanation is generated by the AI layer. ' +
    'All numeric values are computed by deterministic ML models trained on historical data — ' +
    'not estimated or invented by AI.';

  const CROP_BASELINES = { almond: 4100, tomato: 84000, pistachio: 2950, grape: 14000, alfalfa: 18000 };

  function hashCode(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) >>> 0;
    return h;
  }

  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost:4320');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' });
      res.end(); return;
    }
    const path = url.pathname;
    const body = req.method === 'POST' ? await readBody(req) : {};

    if (path === '/api/ml/health' || path === '/') {
      sendJson(res, 200, { status: 'ok', demo_mode: true, active_models: { yield: 'demo-v1', risk: 'demo-v1', cluster: 'demo-v1' } });
      return;
    }

    if (path === '/api/ml/yield/predict') {
      const fieldId = body.field_id ?? 'field-001';
      const cropName = body.crop_name ?? 'almond';
      const baseline = CROP_BASELINES[cropName.toLowerCase()] ?? 4100;
      const predicted = Math.round(baseline * (0.92 + (hashCode(fieldId) % 100) / 500));
      const interval = Math.round(predicted * 0.12);
      sendJson(res, 200, {
        field_id: fieldId, crop_name: cropName, crop_year: body.crop_year ?? 2026,
        predicted_yield_kg_ha: predicted,
        yield_lower_kg_ha: predicted - interval,
        yield_upper_kg_ha: predicted + interval,
        baseline_yield_kg_ha: baseline,
        confidence: 'high',
        factor_water: 0.38, factor_nutrient: 0.29, factor_heat: 0.15,
        factor_uv: 0.08, factor_seed: 0.06, factor_planting: 0.04,
        limiting_factors: ['water', 'nutrient'],
        explanation: `The model predicts ${predicted.toLocaleString()} kg/ha for ${cropName}. Top limiting factors: water and nutrient. Confidence: high.`,
        disclaimer: DISCLAIMER,
      }); return;
    }

    if (path.startsWith('/api/ml/yield/history/')) {
      const fieldId = path.split('/').pop();
      sendJson(res, 200, { field_id: fieldId, history: [] }); return;
    }

    if (path === '/api/ml/optimize/inputs') {
      const fieldId = body.field_id ?? 'field-001';
      sendJson(res, 200, {
        field_id: fieldId, crop_year: body.crop_year ?? 2026,
        current_irrigation_in: 42.0, rec_irrigation_in: 46.5, irrigation_delta_in: 4.5,
        current_nitrogen_lb_ac: 180.0, rec_nitrogen_lb_ac: 210.0, nitrogen_delta_lb_ac: 30.0,
        expected_yield_kg_ha: 4380, expected_yield_gain_pct: 6.3, baseline_yield_kg_ha: 4120,
        confidence: 'medium',
        explanation: 'Increase irrigation by 4.5 in and apply 30 lb/ac more nitrogen to achieve a projected 6.3% yield gain.',
        disclaimer: DISCLAIMER,
      }); return;
    }

    if (path === '/api/ml/risk/assess' || path === '/api/ml/risk/summary') {
      const riskFields = [
        { field_id: 'field-001', crop_year: 2026, anomaly_score: 0.68, risk_label: 'high', residual_zscore: 2.1, top_risk_factors: ['season_irrigation_in', 'soil_ph'], cohort_id: 0, cohort_name: 'High-input intensive', explanation: 'High anomaly score. Irrigation and pH deviate from cohort median.', disclaimer: DISCLAIMER },
        { field_id: 'field-002', crop_year: 2026, anomaly_score: 0.31, risk_label: 'low', residual_zscore: 0.8, top_risk_factors: ['nitrate_n_ppm'], cohort_id: 1, cohort_name: 'Mixed cohort 1', explanation: 'Low anomaly score. Field is within normal range.', disclaimer: DISCLAIMER },
        { field_id: 'field-003', crop_year: 2026, anomaly_score: 0.44, risk_label: 'moderate', residual_zscore: 1.3, top_risk_factors: ['potassium_ppm', 'season_n_applied'], cohort_id: 2, cohort_name: 'Low-input conservative', explanation: 'Moderate anomaly. Nutrient levels deviate from cohort median.', disclaimer: DISCLAIMER },
      ];
      if (path === '/api/ml/risk/summary') {
        sendJson(res, 200, { crop_year: 2026, fields: riskFields });
      } else {
        sendJson(res, 200, riskFields[0]);
      }
      return;
    }

    if (path === '/api/ml/benchmark/compare') {
      const fieldId = body.field_id ?? 'field-001';
      const pct = 55 + (hashCode(fieldId) % 30);
      sendJson(res, 200, {
        field_id: fieldId, crop_year: body.crop_year ?? 2026,
        cluster_label: 0, cluster_name: 'High-input intensive',
        yield_kg_ha: 4380, percentile_rank: pct, cohort_size: 47,
        explanation: `This field ranks at the ${pct}th percentile within its peer group of 47 comparable fields.`,
        disclaimer: DISCLAIMER,
      }); return;
    }

    if (path === '/api/ml/benchmark/clusters') {
      sendJson(res, 200, { clusters: [
        { cluster_label: 0, cluster_name: 'High-input intensive' },
        { cluster_label: 1, cluster_name: 'Mixed cohort 1' },
        { cluster_label: 2, cluster_name: 'Low-input conservative' },
        { cluster_label: 3, cluster_name: 'Irrigation-intensive' },
        { cluster_label: 4, cluster_name: 'Nutrient-intensive' },
        { cluster_label: 5, cluster_name: 'Mixed cohort 5' },
      ]}); return;
    }

    if (path.startsWith('/api/ml/train/')) {
      const mtype = path.split('/').pop();
      sendJson(res, 200, { status: 'ok', results: { [mtype]: { training_rows: 300 } } }); return;
    }

    notFound(res, path);
  });
}
