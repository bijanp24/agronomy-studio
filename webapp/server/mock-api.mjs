import express from 'express';
import { pathToFileURL } from 'node:url';

import {
  buildIrrigationRecommendation,
  buildLocationSummary,
  buildRiskSummary,
  buildSearchResult,
  buildSoilWaterBalance
} from './mock-contracts.mjs';

export function createMockApi() {
  const app = express();

  app.use(express.json());

  app.get('/api/agronomy/health', (_request, response) => {
    response.json({ service: 'agronomy-gateway-mock', status: 'ok', checkedAt: new Date().toISOString() });
  });

  app.get('/api/ai/health', (_request, response) => {
    response.json({ service: 'ai-search-mock', status: 'ok', checkedAt: new Date().toISOString() });
  });

  app.get('/api/agronomy/location-summary', (request, response) => {
    response.json(buildLocationSummary(request.query));
  });

  app.get('/api/agronomy/irrigation-recommendation', (request, response) => {
    response.json(buildIrrigationRecommendation(String(request.query.crop ?? 'almond')));
  });

  app.get('/api/agronomy/soil-water-balance', (request, response) => {
    response.json(buildSoilWaterBalance(request.query));
  });

  app.get('/api/agronomy/risk-summary', (request, response) => {
    response.json(buildRiskSummary(request.query));
  });

  app.post('/api/agronomy/search', (request, response) => {
    response.json(buildSearchResult(request.body));
  });

  app.post('/api/search', (request, response) => {
    response.json(buildSearchResult(request.body));
  });

  return app;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 4310);
  createMockApi().listen(port, '127.0.0.1', () => {
    console.log(`Agronomy Studio mock API listening on http://127.0.0.1:${port}`);
  });
}
