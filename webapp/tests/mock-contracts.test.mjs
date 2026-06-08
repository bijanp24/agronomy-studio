import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildLocationSummary,
  buildRiskSummary,
  buildSearchResult,
  buildSoilWaterBalance
} from '../server/mock-contracts.mjs';

test('builds a location summary that matches the frontend contract', () => {
  const summary = buildLocationSummary({ lat: '36.7', lon: '-119.8', crop: 'tomato' });

  assert.deepEqual(summary.location, { latitude: 36.7, longitude: -119.8 });
  assert.equal(summary.irrigation.cropName, 'tomato');
  assert.ok(summary.soil.rootZoneDepthIn > 0);
  assert.match(summary.datasets[0].source, /CNRA/);
});

test('builds search results with source attribution', () => {
  const result = buildSearchResult({ query: 'How much should I irrigate?', cropName: 'almond' });

  assert.equal(result.intent, 'irrigation_recommendation');
  assert.ok(result.sources.length > 1);
  assert.ok(result.confidence > 0.5);
});

test('builds risk and water balance contracts', () => {
  assert.ok(buildRiskSummary().notes.length > 0);
  assert.ok(buildSoilWaterBalance().projectedDeficitIn > 0);
});
