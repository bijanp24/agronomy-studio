import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let snackBar: MatSnackBar;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    snackBar = TestBed.inject(MatSnackBar);
  });

  it('shows snackbar and re-throws on network error (status 0)', () => {
    const openSpy = vi.spyOn(snackBar, 'open');
    let errorCaught = false;

    http.get('/field-api/test').subscribe({ error: () => { errorCaught = true; } });
    httpMock.expectOne('/field-api/test').error(new ProgressEvent('error'));

    expect(openSpy).toHaveBeenCalledOnce();
    const [msg] = openSpy.mock.calls[0] as [string, ...unknown[]];
    expect(msg).toContain('field-intelligence (:4302)');
    expect(msg).toContain('Cannot reach');
    expect(errorCaught).toBe(true);
  });

  it('shows snackbar with status code on server error', () => {
    const openSpy = vi.spyOn(snackBar, 'open');

    http.get('/weather-api/test').subscribe({ error: () => {} });
    httpMock.expectOne('/weather-api/test').flush('Server Error', { status: 503, statusText: 'Service Unavailable' });

    const [msg] = openSpy.mock.calls[0] as [string, ...unknown[]];
    expect(msg).toContain('weather-intelligence (:4300)');
    expect(msg).toContain('503');
  });

  it('labels unknown URLs with the raw url', () => {
    const openSpy = vi.spyOn(snackBar, 'open');

    http.get('/other-api/test').subscribe({ error: () => {} });
    httpMock.expectOne('/other-api/test').flush('Error', { status: 500, statusText: 'Error' });

    const [msg] = openSpy.mock.calls[0] as [string, ...unknown[]];
    expect(msg).toContain('/other-api/test');
  });
});
