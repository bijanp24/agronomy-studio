import { describe, it, expect } from 'vitest';
import { functionPath, getNumberQuery, jsonResponse, createLogger } from '../http';
import { mmToInches, celsiusToFahrenheit, round } from '../units';
import { haversineMiles, isWithinCalifornia } from '../geo';

describe('functionPath', () => {
  it('strips the direct netlify functions prefix', () => {
    expect(functionPath({ path: '/.netlify/functions/agronomy-api/api/agronomy/location-summary' }, 'agronomy-api')).toBe(
      '/api/agronomy/location-summary',
    );
  });

  it('strips the public redirect prefix', () => {
    expect(functionPath({ path: '/agronomy-api/api/agronomy/risk-summary' }, 'agronomy-api')).toBe(
      '/api/agronomy/risk-summary',
    );
  });

  it('returns / when nothing follows the prefix', () => {
    expect(functionPath({ path: '/agronomy-api' }, 'agronomy-api')).toBe('/');
  });
});

describe('query helpers', () => {
  it('parses numeric query params', () => {
    expect(getNumberQuery({ queryStringParameters: { lat: '36.5' } }, 'lat')).toBe(36.5);
    expect(getNumberQuery({ queryStringParameters: { lat: 'nope' } }, 'lat')).toBeUndefined();
  });
});

describe('jsonResponse', () => {
  it('serializes body and sets CORS headers', () => {
    const res = jsonResponse(200, { ok: true });
    expect(res.statusCode).toBe(200);
    expect(res.headers?.['Access-Control-Allow-Origin']).toBe('*');
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });
});

describe('logger', () => {
  it('produces a child logger sharing the correlation id', () => {
    const log = createLogger('test-svc', 'abc123');
    expect(log.child({ route: '/x' }).requestId).toBe('abc123');
  });
});

describe('units', () => {
  it('converts mm to inches', () => {
    expect(round(mmToInches(25.4))).toBe(1);
  });
  it('converts celsius to fahrenheit', () => {
    expect(celsiusToFahrenheit(0)).toBe(32);
    expect(celsiusToFahrenheit(100)).toBe(212);
  });
});

describe('geo', () => {
  it('computes haversine distance', () => {
    const d = haversineMiles({ latitude: 36.0, longitude: -119.0 }, { latitude: 36.0, longitude: -119.0 });
    expect(d).toBe(0);
  });
  it('detects california bounds', () => {
    expect(isWithinCalifornia({ latitude: 36.7, longitude: -119.7 })).toBe(true);
    expect(isWithinCalifornia({ latitude: 40.7, longitude: -74.0 })).toBe(false);
  });
});
