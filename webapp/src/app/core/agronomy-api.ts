import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { locationSummaryParams } from './api-params';
import {
  AgronomyLocationSummary,
  AgronomySearchResult,
  LocationSummaryRequest,
  SearchRequest,
  ServiceHealth
} from './models';

@Injectable({ providedIn: 'root' })
export class AgronomyApi {
  private readonly http = inject(HttpClient);

  locationSummary(request: LocationSummaryRequest): Observable<AgronomyLocationSummary> {
    return this.http.get<AgronomyLocationSummary>('/api/agronomy/location-summary', {
      params: locationSummaryParams(request)
    });
  }

  search(request: SearchRequest): Observable<AgronomySearchResult> {
    return this.http.post<AgronomySearchResult>('/api/agronomy/search', request);
  }

  agronomyHealth(): Observable<ServiceHealth> {
    return this.http.get<ServiceHealth>('/api/agronomy/health');
  }

  aiHealth(): Observable<ServiceHealth> {
    return this.http.get<ServiceHealth>('/api/ai/health');
  }
}
