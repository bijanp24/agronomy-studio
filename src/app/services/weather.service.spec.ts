import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { WeatherService } from './weather.service';

describe('WeatherService', () => {
  let service: WeatherService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(WeatherService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getEntropyCurrent uses default postal code and country', () => {
    service.getEntropyCurrent().subscribe();
    const req = httpMock.expectOne(r => r.url === '/weather-api/api/entropy/current');
    expect(req.request.params.get('postalCode')).toBe('93650');
    expect(req.request.params.get('countryCode')).toBe('US');
  });

  it('getEntropyCurrent passes supplied postal code', () => {
    service.getEntropyCurrent('90210').subscribe();
    const req = httpMock.expectOne(r => r.url === '/weather-api/api/entropy/current');
    expect(req.request.params.get('postalCode')).toBe('90210');
  });

  it('getEntropyHistory hits the correct URL', () => {
    service.getEntropyHistory().subscribe();
    httpMock.expectOne('/weather-api/api/entropy/history');
  });
});
