import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { FieldIntelligenceService } from './field-intelligence.service';

describe('FieldIntelligenceService', () => {
  let service: FieldIntelligenceService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FieldIntelligenceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getDashboardSummary hits the correct URL', () => {
    service.getDashboardSummary().subscribe();
    httpMock.expectOne('/field-api/api/dashboard/summary');
  });

  it('getFields hits the correct URL', () => {
    service.getFields().subscribe();
    httpMock.expectOne('/field-api/api/fields');
  });

  it('getNutrientBalance includes the field id', () => {
    service.getNutrientBalance('field-42').subscribe();
    httpMock.expectOne('/field-api/api/fields/field-42/nutrient-balance');
  });

  it('getYieldPrediction includes the field id', () => {
    service.getYieldPrediction('field-42').subscribe();
    httpMock.expectOne('/field-api/api/fields/field-42/yield-prediction');
  });

  it('getOperations includes the field id', () => {
    service.getOperations('field-42').subscribe();
    httpMock.expectOne('/field-api/api/fields/field-42/operations');
  });

  it('getSoilTests includes the field id', () => {
    service.getSoilTests('field-42').subscribe();
    httpMock.expectOne('/field-api/api/fields/field-42/soil-tests');
  });

  it('getGisBlocks hits the correct URL', () => {
    service.getGisBlocks().subscribe();
    httpMock.expectOne('/field-api/api/gis/blocks');
  });
});
