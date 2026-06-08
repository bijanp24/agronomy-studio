import { HttpParams } from '@angular/common/http';
import { LocationSummaryRequest } from './models';

export function locationSummaryParams(request: LocationSummaryRequest): HttpParams {
  return new HttpParams()
    .set('lat', String(request.latitude))
    .set('lon', String(request.longitude))
    .set('crop', request.crop.trim());
}

export function isValidCoordinate(latitude: number, longitude: number): boolean {
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}
