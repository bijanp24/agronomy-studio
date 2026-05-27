const fields = [
  {
    id: 'field-001',
    name: 'Fresno North 12',
    regionCode: 'CA-SJV',
    areaHectares: 48.6,
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

const cannedResponses = {
  stress: {
    summary: 'Found 1 field with high stress. Fresno North 12 has a stress score of 72 (high), primarily limited by water availability.',
    sql: "SELECT name, stressScore, stressLabel, topLimitingFactor FROM fields WHERE stressLabel IN ('high', 'critical') ORDER BY stressScore DESC;",
    columns: [{ name: 'name', type: 'string' }, { name: 'stressScore', type: 'number' }, { name: 'stressLabel', type: 'string' }, { name: 'topLimitingFactor', type: 'string' }],
    rows: [{ name: 'Fresno North 12', stressScore: 72, stressLabel: 'high', topLimitingFactor: 'water' }],
  },
  yield: {
    summary: 'Madera West 7 (tomato) has the highest predicted yield at 86,500 kg/ha. Fresno North 12 (almond) predicts 4,120 kg/ha and Kings East 4 (pistachio) predicts 2,980 kg/ha.',
    sql: 'SELECT name, crop, predictedYieldKgPerHa, confidence FROM fields ORDER BY predictedYieldKgPerHa DESC;',
    columns: [{ name: 'name', type: 'string' }, { name: 'crop', type: 'string' }, { name: 'predictedYieldKgPerHa', type: 'number' }, { name: 'confidence', type: 'string' }],
    rows: [
      { name: 'Madera West 7', crop: 'tomato', predictedYieldKgPerHa: 86500, confidence: 'medium' },
      { name: 'Fresno North 12', crop: 'almond', predictedYieldKgPerHa: 4120, confidence: 'high' },
      { name: 'Kings East 4', crop: 'pistachio', predictedYieldKgPerHa: 2980, confidence: 'high' },
    ],
  },
  soil: {
    summary: 'All fields have soil pH between 6.5–7.0 with organic matter around 1.9%. Potassium levels are adequate (186 ppm) while nitrate-N is moderate (18 ppm).',
    sql: 'SELECT f.name, s.soilPh, s.organicMatterPercent, s.nitrateNppm, s.phosphorusPpm, s.potassiumPpm FROM soil_tests s JOIN fields f ON s.fieldId = f.id ORDER BY s.sampleDate DESC;',
    columns: [{ name: 'name', type: 'string' }, { name: 'soilPh', type: 'number' }, { name: 'organicMatterPercent', type: 'number' }, { name: 'nitrateNppm', type: 'number' }, { name: 'phosphorusPpm', type: 'number' }, { name: 'potassiumPpm', type: 'number' }],
    rows: [
      { name: 'Fresno North 12', soilPh: 6.8, organicMatterPercent: 1.9, nitrateNppm: 18, phosphorusPpm: 24, potassiumPpm: 186 },
      { name: 'Madera West 7', soilPh: 6.9, organicMatterPercent: 2.1, nitrateNppm: 22, phosphorusPpm: 28, potassiumPpm: 195 },
      { name: 'Kings East 4', soilPh: 6.5, organicMatterPercent: 1.6, nitrateNppm: 14, phosphorusPpm: 19, potassiumPpm: 172 },
    ],
  },
  default: {
    summary: 'There are 3 active fields in the San Joaquin Valley region: Fresno North 12 (almond, 48.6 ha), Madera West 7 (tomato, 36.2 ha), and Kings East 4 (pistachio, 61.8 ha).',
    sql: 'SELECT name, crop, areaHectares, regionCode, soilType FROM fields ORDER BY name;',
    columns: [{ name: 'name', type: 'string' }, { name: 'crop', type: 'string' }, { name: 'areaHectares', type: 'number' }, { name: 'regionCode', type: 'string' }, { name: 'soilType', type: 'string' }],
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
  const marker = '/.netlify/functions/query-api';
  const index = path.indexOf(marker);
  return index >= 0 ? path.slice(index + marker.length) || '/' : path;
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
      },
      body: '',
    };
  }

  const pathname = functionPath(event);

  if (event.httpMethod === 'POST' && pathname === '/api/query') {
    let parsed;
    try {
      parsed = JSON.parse(event.body ?? '{}');
    } catch {
      return sendJson(400, { error: 'Invalid JSON body.' });
    }

    const { question, provider } = parsed;
    if (!question || typeof question !== 'string' || !question.trim()) {
      return sendJson(400, { error: 'A question is required.' });
    }

    const start = Date.now();
    try {
      let llmResult;

      if (provider === 'openai') {
        if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY environment variable is not configured.');
        llmResult = await callOpenAI(question, process.env.OPENAI_API_KEY);
      } else if (provider === 'gemini') {
        if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY environment variable is not configured.');
        llmResult = await callGemini(question, process.env.GEMINI_API_KEY);
      } else {
        llmResult = matchMockResponse(question);
      }

      return sendJson(200, {
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
      return sendJson(500, { error: err?.message ?? 'LLM query failed.' });
    }
  }

  if (event.httpMethod === 'GET' && pathname === '/api/cache/status') {
    return sendJson(200, {
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
  }

  return sendJson(404, { error: `No route for ${event.httpMethod} ${pathname}` });
}
