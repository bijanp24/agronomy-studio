import { describe, it, expect } from 'vitest';
import {
  MOCK_YIELD,
  MOCK_OPTIMIZE,
  MOCK_RISK_SUMMARY,
  MOCK_BENCHMARK,
  MOCK_CLUSTERS,
  type YieldPrediction,
  type OptimizationResult,
  type RiskAssessment,
  type BenchmarkResult,
} from '../ml';

// ---------------------------------------------------------------------------
// ML mock data validation — ensures all deterministic mock values satisfy
// invariants that the UI depends on. These are NOT AI-generated numbers.
// ---------------------------------------------------------------------------

describe('MOCK_YIELD', () => {
  it('returns a valid yield prediction for almond', () => {
    const pred = MOCK_YIELD('field-001', 'almond');
    expect(pred.field_id).toBe('field-001');
    expect(pred.crop_name).toBe('almond');
    expect(pred.predicted_yield_kg_ha).toBeGreaterThan(0);
    expect(pred.yield_lower_kg_ha).toBeLessThanOrEqual(pred.predicted_yield_kg_ha);
    expect(pred.yield_upper_kg_ha).toBeGreaterThanOrEqual(pred.predicted_yield_kg_ha);
    expect(pred.baseline_yield_kg_ha).toBeGreaterThan(0);
    expect(['low', 'medium', 'high']).toContain(pred.confidence);
  });

  it('returns different predictions for different fields', () => {
    const a = MOCK_YIELD('field-001', 'almond');
    const b = MOCK_YIELD('field-002', 'almond');
    // Hash-based so must differ
    expect(a.predicted_yield_kg_ha).not.toBe(b.predicted_yield_kg_ha);
  });

  it('tomato baseline is orders of magnitude larger than almond', () => {
    const almond = MOCK_YIELD('field-001', 'almond');
    const tomato = MOCK_YIELD('field-001', 'tomato');
    expect(tomato.baseline_yield_kg_ha).toBeGreaterThan(almond.baseline_yield_kg_ha * 10);
  });

  it('factor weights sum to approximately 1', () => {
    const pred = MOCK_YIELD('field-001', 'almond');
    const sum = pred.factor_water + pred.factor_nutrient + pred.factor_heat +
                pred.factor_uv + pred.factor_seed + pred.factor_planting;
    expect(sum).toBeCloseTo(1.0, 1);
  });

  it('always carries a non-empty disclaimer', () => {
    const pred = MOCK_YIELD('field-001', 'almond');
    expect(pred.disclaimer.length).toBeGreaterThan(20);
    expect(pred.disclaimer).toContain('deterministic');
  });

  it('limiting_factors is an array of strings', () => {
    const pred = MOCK_YIELD('field-001', 'almond');
    expect(Array.isArray(pred.limiting_factors)).toBe(true);
    pred.limiting_factors.forEach((f) => expect(typeof f).toBe('string'));
  });
});

describe('MOCK_OPTIMIZE', () => {
  it('returns optimization result for a field', () => {
    const opt = MOCK_OPTIMIZE('field-001');
    expect(opt.field_id).toBe('field-001');
    expect(opt.rec_irrigation_in).toBeGreaterThan(0);
    expect(opt.rec_nitrogen_lb_ac).toBeGreaterThan(0);
    expect(opt.expected_yield_gain_pct).toBeGreaterThanOrEqual(0);
    expect(opt.expected_yield_kg_ha).toBeGreaterThan(opt.baseline_yield_kg_ha);
  });

  it('irrigation delta matches rec minus current', () => {
    const opt = MOCK_OPTIMIZE('field-001');
    expect(opt.irrigation_delta_in).toBeCloseTo(opt.rec_irrigation_in - opt.current_irrigation_in, 5);
  });

  it('carries disclaimer', () => {
    expect(MOCK_OPTIMIZE('field-001').disclaimer).toContain('deterministic');
  });
});

describe('MOCK_RISK_SUMMARY', () => {
  it('returns three risk assessments for demo fields', () => {
    const summary = MOCK_RISK_SUMMARY();
    expect(summary.length).toBe(3);
  });

  it('all anomaly scores are in [0, 1]', () => {
    MOCK_RISK_SUMMARY().forEach((r) => {
      expect(r.anomaly_score).toBeGreaterThanOrEqual(0);
      expect(r.anomaly_score).toBeLessThanOrEqual(1);
    });
  });

  it('risk_label matches anomaly_score bands', () => {
    MOCK_RISK_SUMMARY().forEach((r) => {
      if (r.anomaly_score > 0.75) expect(r.risk_label).toBe('critical');
      else if (r.anomaly_score > 0.55) expect(r.risk_label).toBe('high');
      else if (r.anomaly_score > 0.35) expect(r.risk_label).toBe('moderate');
      else expect(r.risk_label).toBe('low');
    });
  });
});

describe('MOCK_BENCHMARK', () => {
  it('returns benchmark result with percentile in [0, 100]', () => {
    const bench = MOCK_BENCHMARK('field-001');
    expect(bench.percentile_rank).toBeGreaterThanOrEqual(0);
    expect(bench.percentile_rank).toBeLessThanOrEqual(100);
  });

  it('cohort_size is a positive integer', () => {
    const bench = MOCK_BENCHMARK('field-001');
    expect(bench.cohort_size).toBeGreaterThan(0);
    expect(Number.isInteger(bench.cohort_size)).toBe(true);
  });
});

describe('MOCK_CLUSTERS', () => {
  it('returns 6 clusters', () => {
    expect(MOCK_CLUSTERS.length).toBe(6);
  });

  it('cluster labels are sequential', () => {
    MOCK_CLUSTERS.forEach((c, i) => {
      expect(c.cluster_label).toBe(i);
    });
  });
});
