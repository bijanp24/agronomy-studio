import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EntropyReading, EntropyHistory } from '../models/weather.models';

const BASE = '/weather-api';

@Injectable({ providedIn: 'root' })
export class WeatherService {
  private http = inject(HttpClient);

  getEntropyCurrent(postalCode = '93650', countryCode = 'US'): Observable<EntropyReading> {
    const params = new HttpParams()
      .set('postalCode', postalCode)
      .set('countryCode', countryCode);
    return this.http.get<EntropyReading>(`${BASE}/api/entropy/current`, { params });
  }

  getEntropyHistory(): Observable<EntropyHistory> {
    return this.http.get<EntropyHistory>(`${BASE}/api/entropy/history`);
  }
}
