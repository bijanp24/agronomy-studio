import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { FieldSummary } from '../../models/field-intelligence.models';

const makeField = (overrides: Partial<FieldSummary> = {}): FieldSummary => ({
  fieldId: 'f1',
  fieldName: 'Test Field',
  crop: 'almond',
  stressScore: 30,
  stressLabel: 'moderate',
  predictedYieldKgPerHa: 5000,
  confidence: 'high',
  ...overrides,
});

describe('DashboardComponent', () => {
  let component: DashboardComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  });

  describe('yieldTonnes', () => {
    it('converts kg/ha to t/ha with 2 decimal places', () => {
      expect(component.yieldTonnes(5000)).toBe('5.00');
      expect(component.yieldTonnes(1234)).toBe('1.23');
      expect(component.yieldTonnes(0)).toBe('0.00');
    });
  });

  describe('criticalCount', () => {
    it('returns 0 when no fields', () => {
      component.fields.set([]);
      expect(component.criticalCount()).toBe(0);
    });

    it('counts high and critical stress fields', () => {
      component.fields.set([
        makeField({ stressLabel: 'low' }),
        makeField({ stressLabel: 'high' }),
        makeField({ stressLabel: 'critical' }),
        makeField({ stressLabel: 'moderate' }),
      ]);
      expect(component.criticalCount()).toBe(2);
    });

    it('returns 0 when all fields are low/moderate', () => {
      component.fields.set([
        makeField({ stressLabel: 'low' }),
        makeField({ stressLabel: 'moderate' }),
      ]);
      expect(component.criticalCount()).toBe(0);
    });
  });

  describe('avgYield', () => {
    it('returns em-dash when no fields', () => {
      component.fields.set([]);
      expect(component.avgYield()).toBe('—');
    });

    it('averages predicted yield across fields in t/ha', () => {
      component.fields.set([
        makeField({ predictedYieldKgPerHa: 4000 }),
        makeField({ predictedYieldKgPerHa: 6000 }),
      ]);
      expect(component.avgYield()).toBe('5.00');
    });

    it('handles a single field', () => {
      component.fields.set([makeField({ predictedYieldKgPerHa: 3500 })]);
      expect(component.avgYield()).toBe('3.50');
    });
  });
});
