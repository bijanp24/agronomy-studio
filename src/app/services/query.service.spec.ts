import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { QueryService } from './query.service';
import { QueryResponse, CacheStatus } from '../models/query.models';

describe('QueryService', () => {
  let service: QueryService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(QueryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should send a POST request to /query-api/api/query', () => {
    const mockResponse: QueryResponse = {
      question: 'Which fields have high stress?',
      sql: 'SELECT * FROM fields WHERE stressLabel = \'high\';',
      summary: 'Found 1 field with high stress.',
      columns: [{ name: 'name', type: 'string' }],
      rows: [{ name: 'Fresno North 12' }],
      rowCount: 1,
      executionMs: 85,
      cached: true,
    };

    service.query('Which fields have high stress?').subscribe(res => {
      expect(res.rowCount).toBe(1);
      expect(res.summary).toContain('high stress');
    });

    const req = httpMock.expectOne('/query-api/api/query');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      question: 'Which fields have high stress?',
      provider: 'mock',
    });
    req.flush(mockResponse);
  });

  it('should fetch cache status', () => {
    const mockStatus: CacheStatus = {
      tables: [
        { table: 'fields', rowCount: 3, lastSync: '2026-05-27T10:00:00Z', stale: false },
      ],
      lastFullSync: '2026-05-27T10:00:00Z',
      healthy: true,
    };

    service.getCacheStatus().subscribe(status => {
      expect(status.healthy).toBe(true);
      expect(status.tables.length).toBe(1);
    });

    const req = httpMock.expectOne('/query-api/api/cache/status');
    expect(req.request.method).toBe('GET');
    req.flush(mockStatus);
  });
});
