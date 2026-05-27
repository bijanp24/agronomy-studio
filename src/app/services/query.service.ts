import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { QueryRequest, QueryResponse, CacheStatus, LlmProvider } from '../models/query.models';

const BASE = '/query-api';

@Injectable({ providedIn: 'root' })
export class QueryService {
  private http = inject(HttpClient);

  query(question: string, provider: LlmProvider = 'mock'): Observable<QueryResponse> {
    const body: QueryRequest = { question, provider };
    return this.http.post<QueryResponse>(`${BASE}/api/query`, body);
  }

  getCacheStatus(): Observable<CacheStatus> {
    return this.http.get<CacheStatus>(`${BASE}/api/cache/status`);
  }
}
