import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import {
  CreatePersonRequest,
  PeopleResponse,
  PermissionMatrix,
  Person,
  PersonResponse,
  UpdatePersonRequest,
} from '../models/people.model';
import {
  CreatePositionRequest,
  Position,
  PositionResponse,
  PositionsResponse,
  SelectablePosition,
  SelectablePositionsResponse,
  UpdatePositionRequest,
} from '../models/position.model';
import { EMPTY_PAGE, PageMeta } from '../models/pagination.model';
import { AuthResponse, Role, RolesResponse, User, UserStatus } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserAdminService {
  private http = inject(HttpClient);

  private readonly _people = signal<Person[]>([]);
  private readonly _pending = signal<User[]>([]);
  private readonly _roles = signal<Role[]>([]);
  private readonly _matrix = signal<PermissionMatrix | null>(null);
  private readonly _canViewCost = signal(false);
  private readonly _grantable = signal<string[]>([]);
  private readonly _peopleMeta = signal<PageMeta>(EMPTY_PAGE);
  private readonly _positions = signal<Position[]>([]);
  private readonly _positionsMeta = signal<PageMeta>(EMPTY_PAGE);
  private readonly _positionsActiveCount = signal(0);
  private readonly _selectablePositions = signal<SelectablePosition[]>([]);

  readonly people = this._people.asReadonly();
  readonly pending = this._pending.asReadonly();
  readonly roles = this._roles.asReadonly();
  readonly matrix = this._matrix.asReadonly();
  readonly canViewCost = this._canViewCost.asReadonly();
  readonly grantableRoleCodes = this._grantable.asReadonly();
  /** The page of the roster currently shown; `peopleMeta` says which page. */
  readonly peopleMeta = this._peopleMeta.asReadonly();
  /** One page of the management list — see `selectablePositions` for the dropdowns. */
  readonly positions = this._positions.asReadonly();
  readonly positionsMeta = this._positionsMeta.asReadonly();
  readonly positionsActiveCount = this._positionsActiveCount.asReadonly();
  /** Every active position, unpaged, for the two person forms. */
  readonly selectablePositions = this._selectablePositions.asReadonly();

  // ---------- reads ----------

  loadPeople(q?: string, group?: string, page = 1): Observable<PeopleResponse> {
    let params = new HttpParams().set('page', String(page));
    if (q) params = params.set('q', q);
    if (group) params = params.set('group', group);

    return this.http.get<PeopleResponse>('/api/people', { params }).pipe(
      tap((res) => {
        this._people.set(res.people);
        this._peopleMeta.set(res.meta);
        this._canViewCost.set(res.canViewCost);
        this._grantable.set(res.grantableRoleCodes);
      }),
    );
  }

  loadPending(): Observable<{ users: User[] }> {
    return this.http
      .get<{ users: User[] }>('/api/users/pending')
      .pipe(tap((res) => this._pending.set(res.users)));
  }

  loadRoles(): Observable<RolesResponse> {
    return this.http
      .get<RolesResponse>('/api/roles')
      .pipe(tap((res) => this._roles.set(res.roles)));
  }

  loadMatrix(): Observable<PermissionMatrix> {
    return this.http
      .get<PermissionMatrix>('/api/roles/matrix')
      .pipe(tap((res) => this._matrix.set(res)));
  }

  loadPositions(page = 1): Observable<PositionsResponse> {
    const params = new HttpParams().set('page', String(page));

    return this.http.get<PositionsResponse>('/api/positions', { params }).pipe(
      tap((res) => {
        this._positions.set(res.positions);
        this._positionsMeta.set(res.meta);
        this._positionsActiveCount.set(res.activeCount);
      }),
    );
  }

  /**
   * The same public endpoint the register form uses. Called directly rather
   * than through AuthService so this service's dependencies stay as they are.
   */
  loadSelectablePositions(): Observable<SelectablePositionsResponse> {
    return this.http
      .get<SelectablePositionsResponse>('/api/positions/selectable')
      .pipe(tap((res) => this._selectablePositions.set(res.positions)));
  }

  // ---------- writes ----------

  /**
   * No store patch: the roster is one page sorted by name, so the new row
   * belongs somewhere the client cannot work out. The caller reloads the page.
   */
  createPerson(data: CreatePersonRequest): Observable<PersonResponse> {
    return this.http.post<PersonResponse>('/api/people', data);
  }

  updatePerson(employeeId: number, data: UpdatePersonRequest): Observable<PersonResponse> {
    return this.http
      .patch<PersonResponse>(`/api/people/${employeeId}`, data)
      .pipe(tap((res) => this.replace(res.person)));
  }

  /** Soft delete: suspends the account and takes the row out of active staff. */
  deactivatePerson(employeeId: number): Observable<PersonResponse> {
    return this.http
      .delete<PersonResponse>(`/api/people/${employeeId}`)
      .pipe(tap((res) => this.replace(res.person)));
  }

  setRole(userId: number, roleCode: string): Observable<AuthResponse> {
    return this.http
      .patch<AuthResponse>(`/api/users/${userId}/role`, { roleCode })
      .pipe(tap((res) => this.applyUser(res.user)));
  }

  setStatus(userId: number, status: UserStatus): Observable<AuthResponse> {
    return this.http
      .patch<AuthResponse>(`/api/users/${userId}/status`, { status })
      .pipe(
        tap((res) => {
          this.applyUser(res.user);
          this._pending.update((list) => list.filter((u) => u.id !== userId));
        }),
      );
  }

  // ---------- positions ----------

  /** No store patch — the list is a page. The caller reloads it. */
  createPosition(data: CreatePositionRequest): Observable<PositionResponse> {
    return this.http.post<PositionResponse>('/api/positions', data);
  }

  updatePosition(id: number, data: UpdatePositionRequest): Observable<PositionResponse> {
    return this.http
      .patch<PositionResponse>(`/api/positions/${id}`, data)
      .pipe(tap((res) => this.replacePosition(res.position)));
  }

  /**
   * No store patch: filtering the row out would leave the page one short.
   * The caller reloads it.
   */
  deletePosition(id: number): Observable<{ message: string; id: number }> {
    return this.http.delete<{ message: string; id: number }>(`/api/positions/${id}`);
  }

  // ---------- signal upkeep ----------

  /**
   * Patched in place so the list does not jump while you are editing it. The
   * active count is kept in step here because retire/restore is the only
   * write that changes it without changing the page's rows.
   */
  private replacePosition(position: Position): void {
    const before = this._positions().find((p) => p.id === position.id);
    if (before && before.isActive !== position.isActive) {
      this._positionsActiveCount.update((n) => n + (position.isActive ? 1 : -1));
    }

    this._positions.update((all) =>
      all.map((p) => (p.id === position.id ? position : p)),
    );
  }

  /**
   * Patch the row in place instead of refetching, so the table does not flash
   * and the user's scroll position and filters survive the write.
   */
  private replace(person: Person): void {
    this._people.update((list) =>
      list.map((p) => (p.employeeId === person.employeeId ? person : p)),
    );
  }

  /**
   * Role and status live on /api/users, which returns a User rather than a
   * roster row, so fold the changed fields into the matching Person.
   */
  private applyUser(user: User): void {
    this._people.update((list) =>
      list.map((p) =>
        p.userId === user.id
          ? {
              ...p,
              status: user.status,
              roleCode: user.roles[0] ?? null,
              roleName: this.roleName(user.roles[0]) ?? p.roleName,
              isActive: user.status === 'ACTIVE',
            }
          : p,
      ),
    );
  }

  private roleName(code: string | undefined): string | null {
    if (!code) return null;
    return this._roles().find((r) => r.code === code)?.name ?? null;
  }
}
