import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { FieldsComponent } from './fields.component';

describe('FieldsComponent', () => {
  let component: FieldsComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FieldsComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(FieldsComponent);
    component = fixture.componentInstance;
  });

  describe('balanceClass', () => {
    it('returns danger for negative balance', () => {
      expect(component.balanceClass(-1)).toBe('danger');
      expect(component.balanceClass(-100)).toBe('danger');
    });

    it('returns warn for balance below 20', () => {
      expect(component.balanceClass(0)).toBe('warn');
      expect(component.balanceClass(19)).toBe('warn');
    });

    it('returns ok for balance 20 and above', () => {
      expect(component.balanceClass(20)).toBe('ok');
      expect(component.balanceClass(100)).toBe('ok');
    });
  });

  describe('yieldTonnes', () => {
    it('converts kg/ha to t/ha', () => {
      expect(component.yieldTonnes(7500)).toBe('7.50');
      expect(component.yieldTonnes(1000)).toBe('1.00');
    });
  });

  describe('factorPct', () => {
    it('converts 0–1 factor to 0–100 integer', () => {
      expect(component.factorPct(0.75)).toBe(75);
      expect(component.factorPct(1)).toBe(100);
      expect(component.factorPct(0)).toBe(0);
      expect(component.factorPct(0.856)).toBe(86);
    });
  });
});
