import { describe, it, expect } from 'vitest';
import { findCoefficient, getCropById, listCrops, searchCrops, coefficientForStage } from '../crop';

describe('crop seed', () => {
  it('loads a non-trivial seed of crops', () => {
    expect(listCrops().length).toBeGreaterThanOrEqual(25);
  });

  it('looks up by id', () => {
    const almond = getCropById('almond');
    expect(almond?.cropName).toBe('Almond');
    expect(almond?.kc).toBe(0.9);
    expect(almond?.source).toBe('WUCOLS');
  });

  it('searches by alias', () => {
    const matches = searchCrops('corn');
    expect(matches.some((c) => c.cropId === 'field-corn')).toBe(true);
  });

  it('resolves free-text crop names to a coefficient', () => {
    expect(findCoefficient(undefined, 'tomatoes')?.cropId).toBe('processing-tomato');
    expect(findCoefficient(undefined, 'grapes')?.category).toBe('vine');
    expect(findCoefficient('walnut', undefined)?.cropName).toBe('Walnut');
  });

  it('returns null for unknown crops', () => {
    expect(findCoefficient(undefined, 'zzzdoesnotexist')).toBeNull();
  });

  it('selects a stage-specific Kc with fallback', () => {
    const almond = getCropById('almond')!;
    expect(coefficientForStage(almond, 'initial')).toBe(0.4);
    expect(coefficientForStage(almond, 'development')).toBe(almond.kc);
  });
});
