import { describe, it, expect } from 'vitest';
import { computeIrrigation } from '../irrigation';

const base = {
  cropName: 'Almond',
  eto: 0.25,
  kc: 0.9,
  availableWaterCapacity: 0.15,
  rootZoneDepthIn: 24,
  allowableDepletion: 0.5,
  systemEfficiency: 0.85,
  confidence: 'high' as const,
  heatRisk: false,
};

describe('computeIrrigation', () => {
  it('computes crop ET, RAW, net/gross depth, and interval', () => {
    const rec = computeIrrigation(base);
    // CropET = 0.25 * 0.9 = 0.225
    expect(rec.cropEt).toBeCloseTo(0.225, 3);
    // TAW = 0.15 * 24 = 3.6; RAW = 3.6 * 0.5 = 1.8
    expect(rec.readilyAvailableWaterIn).toBeCloseTo(1.8, 2);
    expect(rec.netIrrigationIn).toBeCloseTo(1.8, 2);
    // gross = 1.8 / 0.85 = 2.12
    expect(rec.grossIrrigationIn).toBeCloseTo(2.12, 2);
    // interval = round(1.8 / 0.225) = 8
    expect(rec.intervalDays).toBe(8);
  });

  it('credits forecast rain against the net requirement', () => {
    const rec = computeIrrigation({ ...base, forecastRainIn: 0.8 });
    expect(rec.netIrrigationIn).toBeCloseTo(1.0, 2);
    expect(rec.notes.join(' ')).toMatch(/rain/i);
  });

  it('defers irrigation when rain exceeds readily available water', () => {
    const rec = computeIrrigation({ ...base, forecastRainIn: 5 });
    expect(rec.netIrrigationIn).toBe(0);
    expect(rec.notes.join(' ')).toMatch(/deferred/i);
  });

  it('flags heat risk and adds a note', () => {
    const rec = computeIrrigation({ ...base, heatRisk: true });
    expect(rec.heatRisk).toBe(true);
    expect(rec.notes.join(' ')).toMatch(/heat/i);
  });

  it('clamps implausible inputs', () => {
    const rec = computeIrrigation({ ...base, availableWaterCapacity: 5, systemEfficiency: 2, allowableDepletion: 9 });
    expect(rec.systemEfficiency).toBeLessThanOrEqual(1);
    expect(rec.readilyAvailableWaterIn).toBeGreaterThan(0);
  });

  it('handles zero crop ET without dividing by zero', () => {
    const rec = computeIrrigation({ ...base, eto: 0 });
    expect(rec.cropEt).toBe(0);
    expect(rec.intervalDays).toBe(30);
    expect(rec.notes.join(' ')).toMatch(/no active water demand/i);
  });
});
