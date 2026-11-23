import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

/**
 * Blocks a route unless the signed-in user holds at least one of these
 * permission codes — the same any-of shape as the backend's
 * `requirePermission(["a", "b"])`.
 *
 * Redirects to /dashboard rather than /login: the user *is* signed in, they
 * just may not be here. Sending them to /login would look like a session
 * failure and they would bounce straight back.
 *
 * This is convenience, not security. Every endpoint behind it checks for
 * itself, because a guard only hides a route from an honest browser.
 */
export function permissionGuard(...codes: string[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    return auth.ensureSession().pipe(
      map((signedIn) => {
        if (!signedIn) return router.createUrlTree(['/login']);
        return codes.some((code) => auth.hasPermission(code))
          ? true
          : router.createUrlTree(['/dashboard']);
      }),
    );
  };
}
