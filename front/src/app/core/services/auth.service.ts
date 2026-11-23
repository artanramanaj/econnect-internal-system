import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { SelectablePositionsResponse } from '../models/position.model';
import {
  AuthResponse,
  LoginRequest,
  MeResponse,
  Permission,
  RegisterRequest,
  RegisterResponse,
  RolesResponse,
  User,
} from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private readonly authUrl = '/api/auth';

  private readonly _user = signal<User | null>(null);
  private readonly _permissions = signal<Permission[]>([]);

  /** Prevents re-asking the backend on every guarded navigation. */
  private sessionChecked = false;

  readonly currentUser = this._user.asReadonly();
  readonly permissions = this._permissions.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  readonly displayName = computed(() => {
    const user = this._user();
    if (!user) return '';
    return user.employee
      ? `${user.employee.firstName} ${user.employee.lastName}`
      : user.username;
  });

  register(data: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.authUrl}/register`, data);
  }

  login(data: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.authUrl}/login`, data).pipe(
      tap((res) => {
        this._user.set(res.user);
        // Sent by the backend alongside the user, so permission-gated UI is
        // correct on the very first render instead of after a reload.
        this._permissions.set(res.permissions ?? []);
        this.sessionChecked = true;
      }),
    );
  }

  logout(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.authUrl}/logout`, {}).pipe(
      tap(() => this.clear()),
    );
  }

  /** Fresh read of the signed-in user plus their effective permissions. */
  me(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${this.authUrl}/me`).pipe(
      tap((res) => {
        this._user.set(res.user);
        this._permissions.set(res.permissions);
        this.sessionChecked = true;
      }),
    );
  }

  /** Rotates the token pair. Called by the interceptor on a 401. */
  refresh(): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.authUrl}/refresh`, {}).pipe(
      tap((res) => {
        this._user.set(res.user);
        if (res.permissions) this._permissions.set(res.permissions);
      }),
    );
  }

  /** Resolves auth state once on cold load, so a reload does not log you out. */
  ensureSession(): Observable<boolean> {
    if (this.sessionChecked) {
      return of(this.isAuthenticated());
    }

    return this.me().pipe(
      map(() => true),
      catchError(() => {
        this.clear();
        return of(false);
      }),
    );
  }

  /** Saves the UI language on the account, so it follows the person to another browser. */
  updateLocale(locale: string): Observable<AuthResponse> {
    return this.http
      .patch<AuthResponse>(`${this.authUrl}/me/locale`, { locale })
      .pipe(tap((res) => this._user.set(res.user)));
  }

  getRequestableRoles(): Observable<RolesResponse> {
    return this.http.get<RolesResponse>('/api/roles/requestable');
  }

  /** Public, like the roles above: the register form needs it before sign-in. */
  getSelectablePositions(): Observable<SelectablePositionsResponse> {
    return this.http.get<SelectablePositionsResponse>('/api/positions/selectable');
  }

  hasPermission(code: string): boolean {
    return this._permissions().some((p) => p.code === code);
  }

  clear(): void {
    this._user.set(null);
    this._permissions.set([]);
    this.sessionChecked = true;
  }
}
