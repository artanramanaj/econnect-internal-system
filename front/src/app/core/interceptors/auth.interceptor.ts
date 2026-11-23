import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize, shareReplay, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

/** Endpoints that must never trigger a refresh-and-retry (they would loop). */
const NO_RETRY = /\/api\/auth\/(login|register|refresh|logout)$/;

/** Shared across concurrent 401s so a burst of requests triggers one refresh. */
let refreshInFlight: Observable<unknown> | null = null;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isApi = req.url.startsWith('/api');

  // With withFetch() credentials are per-request, so set it on the clone.
  const request = isApi ? req.clone({ withCredentials: true }) : req;

  return next(request).pipe(
    catchError((err: HttpErrorResponse) => {
      if (!isApi || err.status !== 401 || NO_RETRY.test(req.url)) {
        return throwError(() => err);
      }

      refreshInFlight ??= auth.refresh().pipe(
        shareReplay(1),
        finalize(() => {
          refreshInFlight = null;
        }),
      );

      return refreshInFlight.pipe(
        switchMap(() => next(request)),
        catchError(() => {
          auth.clear();
          // The guards already redirect. Only force it when the user is sitting
          // on a protected page, otherwise this cancels the in-flight
          // navigation that is currently resolving /login or /register.
          const onPublicPage = /^\/(login|register)\b/.test(router.url);
          if (!onPublicPage) {
            void router.navigate(['/login']);
          }
          return throwError(() => err);
        }),
      );
    }),
  );
};
