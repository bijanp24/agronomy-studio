import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { QueryRequest, QueryResponse, CacheStatus } from '../models/query.models';

const BASE = '/query-api';

@Injectable({ providedIn: 'root' })
export class QueryService {
  private http = inject(HttpClient);

  query(question: string): Observable<QueryResponse> {
    const body: QueryRequest = { question };
    return this.http.post<QueryResponse>(`${BASE}/api/query`, body);
  }

  getCacheStatus(): Observable<CacheStatus> {
    return this.http.get<CacheStatus>(`${BASE}/api/cache/status`);
  }
}
