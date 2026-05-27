import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  DashboardSummary,
  Field,
  FieldsResponse,
  NutrientBalance,
  YieldPrediction,
  OperationsResponse,
  SoilTestsResponse,
  GeoJsonFeatureCollection,
} from '../models/field-intelligence.models';

const BASE = '/field-api';

@Injectable({ providedIn: 'root' })
export class FieldIntelligenceService {
  private http = inject(HttpClient);

  getDashboardSummary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${BASE}/api/dashboard/summary`);
  }

  getFields(): Observable<FieldsResponse> {
    return this.http.get<FieldsResponse>(`${BASE}/api/fields`);
  }

  getField(fieldId: string): Observable<{ field: Field }> {
    return this.http.get<{ field: Field }>(`${BASE}/api/fields/${fieldId}`);
  }

  getNutrientBalance(fieldId: string): Observable<NutrientBalance> {
    return this.http.get<NutrientBalance>(`${BASE}/api/fields/${fieldId}/nutrient-balance`);
  }

  getYieldPrediction(fieldId: string): Observable<YieldPrediction> {
    return this.http.get<YieldPrediction>(`${BASE}/api/fields/${fieldId}/yield-prediction`);
  }

  getOperations(fieldId: string): Observable<OperationsResponse> {
    return this.http.get<OperationsResponse>(`${BASE}/api/fields/${fieldId}/operations`);
  }

  getSoilTests(fieldId: string): Observable<SoilTestsResponse> {
    return this.http.get<SoilTestsResponse>(`${BASE}/api/fields/${fieldId}/soil-tests`);
  }

  getGisBlocks(): Observable<GeoJsonFeatureCollection> {
    return this.http.get<GeoJsonFeatureCollection>(`${BASE}/api/gis/blocks`);
  }
}
