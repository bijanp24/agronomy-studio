import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const service = serviceLabel(req.url);
      const msg = err.status === 0
        ? `Cannot reach ${service} — is the server running?`
        : `${service} returned ${err.status}`;
      snackBar.open(msg, 'Dismiss', { duration: 6000, panelClass: 'error-snack' });
      return throwError(() => err);
    })
  );
};

function serviceLabel(url: string): string {
  if (url.includes('/field-api'))   return 'field-intelligence (:4302)';
  if (url.includes('/weather-api')) return 'weather-intelligence (:4300)';
  return url;
}
