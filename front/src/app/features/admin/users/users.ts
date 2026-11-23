import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  EMPTY,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  merge,
  switchMap,
} from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { UserAdminService } from '../../../core/services/user-admin.service';
import {
  CreatePersonRequest,
  Person,
  UpdatePersonRequest,
} from '../../../core/models/people.model';
import {
  CreatePositionRequest,
  Position,
} from '../../../core/models/position.model';
import { ApiError, FieldIssue, User, UserStatus } from '../../../core/models/user.model';
import { UserTable } from './user-table/user-table';
import { AddEmployee } from './add-employee/add-employee';
import { AccessRequest } from './access-request/access-request';
import { GroupsPermissions } from './groups-permissions/groups-permissions';
import { UserEditDrawer } from './user-edit-drawer/user-edit-drawer';
import { PositionEdit, Positions } from './positions/positions';
import { ErrorMessage } from '../../../shared/components/error-message/error-message';
import { ToastService } from '../../../core/services/toast.service';

/** Groups only a super admin may manage or grant. Mirrors the server. */
const PROTECTED_ROLE_CODES = ['super_admin', 'admin'];

/** What one load of the roster asks for. */
interface RosterQuery {
  q?: string;
  group?: string;
  page: number;
}

@Component({
  selector: 'app-users',
  imports: [
    UserTable,
    AddEmployee,
    AccessRequest,
    GroupsPermissions,
    UserEditDrawer,
    Positions,
    ErrorMessage,
    TranslatePipe,
  ],
  templateUrl: './users.html',
  styleUrls: ['./users.css', './type-scale.css'],
})
export class Users {
  private admin = inject(UserAdminService);
  private translate = inject(TranslateService);
  private auth = inject(AuthService);
  private toasts = inject(ToastService);

  private addEmployee = viewChild.required(AddEmployee);
  private positionList = viewChild.required(Positions);

  readonly people = this.admin.people;
  readonly peopleMeta = this.admin.peopleMeta;
  readonly pending = this.admin.pending;
  readonly roles = this.admin.roles;
  readonly matrix = this.admin.matrix;
  readonly canViewCost = this.admin.canViewCost;
  readonly positions = this.admin.positions;
  readonly positionsMeta = this.admin.positionsMeta;
  readonly positionsActiveCount = this.admin.positionsActiveCount;

  /**
   * What the two person forms may offer. Unpaged and active only, from the
   * public selectable endpoint — the paged `positions` list is for managing.
   */
  readonly selectablePositions = this.admin.selectablePositions;

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly fieldIssues = signal<FieldIssue[]>([]);

  /** Lines for the error banner's list. */
  protected readonly issueMessages = computed(() => this.fieldIssues().map((i) => i.message));

  readonly groupFilter = signal('');
  readonly searchTerm = signal('');
  readonly editing = signal<Person | null>(null);

  /** Group picked in each access-request card, keyed by user id. */
  readonly requestRole = signal<Record<number, string>>({});

  private readonly searchInput = new Subject<string>();

  /** Every other roster load: group filter, page change, post-write reloads. */
  private readonly rosterLoads = new Subject<RosterQuery>();

  /** Mirrors the server's grantableRoleCodes, resolved to names for display. */
  readonly grantableRoles = computed(() => {
    const allowed = this.admin.grantableRoleCodes();
    return this.roles().filter((r) => allowed.includes(r.code));
  });

  /**
   * Resolved here rather than in the table, so the table stays presentational
   * and needs no AuthService of its own.
   */
  readonly manageableIds = computed(
    () =>
      new Set(
        this.people()
          .filter((p) => this.canManage(p))
          .map((p) => p.employeeId),
      ),
  );

  readonly editRoleOptions = computed(() => {
    const person = this.editing();
    return person ? this.roleOptions(person) : [];
  });

  readonly editIsSelf = computed(() => {
    const person = this.editing();
    return person ? this.isSelf(person) : false;
  });

  constructor() {
    // One stream for every roster load, so switchMap can drop the response
    // of an earlier request when a later one starts: a slow search must not
    // overwrite the page you have since moved to. A new search term always
    // goes back to page 1 — the old page number means nothing in a new set.
    merge(
      this.searchInput.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        map(() => this.rosterQuery({ page: 1 })),
      ),
      this.rosterLoads,
    )
      .pipe(
        switchMap((query) =>
          this.admin.loadPeople(query.q, query.group, query.page).pipe(
            // Caught inside, so one failed request does not end the stream
            // and leave the search box dead for the rest of the visit.
            catchError((err: HttpErrorResponse) => {
              this.showError(err);
              return EMPTY;
            }),
          ),
        ),
      )
      .subscribe();

    this.loadAll();
  }

  private loadAll(): void {
    this.loading.set(true);
    this.admin
      .loadPeople()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({ error: (err) => this.showError(err) });

    this.admin.loadRoles().subscribe({ error: () => undefined });
    this.admin.loadPositions().subscribe({ error: () => undefined });
    this.admin.loadSelectablePositions().subscribe({ error: () => undefined });
    this.admin.loadMatrix().subscribe({ error: () => undefined });
    this.admin.loadPending().subscribe({
      next: (res) => {
        const seeded: Record<number, string> = {};
        for (const u of res.users) seeded[u.id] = u.roles[0] ?? '';
        this.requestRole.set(seeded);
      },
      error: () => undefined,
    });
  }

  // ---------- filters ----------

  onSearch(term: string): void {
    this.searchTerm.set(term);
    this.searchInput.next(term);
  }

  onGroupFilter(code: string): void {
    this.groupFilter.set(code);
    // rosterQuery carries the search term too, so changing the group does
    // not silently discard what is still sitting in the search box.
    this.rosterLoads.next(this.rosterQuery({ page: 1 }));
  }

  onPeoplePage(page: number): void {
    this.rosterLoads.next(this.rosterQuery({ page }));
  }

  /** The current filters and page, with whatever the caller overrides. */
  private rosterQuery(override: Partial<RosterQuery>): RosterQuery {
    return {
      q: this.searchTerm() || undefined,
      group: this.groupFilter() || undefined,
      page: this.peopleMeta().page,
      ...override,
    };
  }

  /** Refetch the page being looked at, filters intact. */
  private reloadPeople(): void {
    this.rosterLoads.next(this.rosterQuery({}));
  }

  // ---------- add ----------

  submitAdd(payload: CreatePersonRequest): void {
    this.beginWrite();
    this.admin
      .createPerson(payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (res) => {
          this.toasts.success(res.message);
          this.addEmployee().reset();
          // The new row sorts by name somewhere in the roster; the toast is
          // the confirmation, the reload keeps the page and count honest.
          this.reloadPeople();
        },
        error: (err) => this.showError(err),
      });
  }

  // ---------- edit drawer ----------

  openEdit(person: Person): void {
    this.editing.set(person);
    this.error.set(null);
  }

  closeEdit(): void {
    this.editing.set(null);
  }

  submitEdit(changes: UpdatePersonRequest): void {
    const person = this.editing();
    if (!person) return;

    this.beginWrite();
    this.admin
      .updatePerson(person.employeeId, changes)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (res) => {
          this.editing.set(res.person);
          this.toasts.success(res.message);
        },
        error: (err) => this.showError(err),
      });
  }

  /** Group and status apply immediately — they are one-click decisions. */
  changeRole(roleCode: string): void {
    const person = this.editing();
    if (!person?.userId) return;

    this.beginWrite();
    this.admin
      .setRole(person.userId, roleCode)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (res) => {
          this.toasts.success(res.message);
          this.syncEditing(person.employeeId);
        },
        error: (err) => this.showError(err),
      });
  }

  changeStatus(status: UserStatus): void {
    const person = this.editing();
    if (!person?.userId) return;

    this.beginWrite();
    this.admin
      .setStatus(person.userId, status)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (res) => {
          this.toasts.success(res.message);
          this.syncEditing(person.employeeId);
        },
        error: (err) => this.showError(err),
      });
  }

  deactivate(): void {
    const person = this.editing();
    if (!person) return;

    this.beginWrite();
    this.admin
      .deactivatePerson(person.employeeId)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (res) => {
          this.toasts.success(res.message);
          this.closeEdit();
        },
        error: (err) => this.showError(err),
      });
  }

  private syncEditing(employeeId: number): void {
    const fresh = this.people().find((p) => p.employeeId === employeeId);
    if (fresh) this.editing.set(fresh);
  }

  // ---------- access requests ----------

  onRequestRole(change: { userId: number; roleCode: string }): void {
    this.requestRole.update((map) => ({ ...map, [change.userId]: change.roleCode }));
  }

  approve(user: User): void {
    const chosen = this.requestRole()[user.id];
    this.beginWrite();

    const activate = () =>
      this.admin
        .setStatus(user.id, 'ACTIVE')
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: (res) => {
            this.toasts.success(res.message);
            this.reloadPeople();
          },
          error: (err) => this.showError(err),
        });

    if (chosen && chosen !== user.roles[0]) {
      this.admin.setRole(user.id, chosen).subscribe({
        next: () => activate(),
        error: (err) => {
          this.saving.set(false);
          this.showError(err);
        },
      });
    } else {
      activate();
    }
  }

  reject(user: User): void {
    this.beginWrite();
    this.admin
      .setStatus(user.id, 'SUSPENDED')
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (res) => this.toasts.success(res.message),
        error: (err) => this.showError(err),
      });
  }

  // ---------- permissions ----------

  /**
   * Options for the drawer's group select.
   *
   * `grantableRoles` deliberately omits super_admin, so a super admin's own
   * row would otherwise render a select with no matching option and read as
   * blank. Prepending the current group keeps the select honest and still
   * allows demoting away from it — you just cannot promote anyone *into* a
   * group the server would refuse to grant.
   */
  private roleOptions(person: Person) {
    const options = this.grantableRoles();
    if (!person.roleCode || options.some((r) => r.code === person.roleCode)) {
      return options;
    }
    return [
      { id: -1, code: person.roleCode, name: person.roleName ?? person.roleCode },
      ...options,
    ];
  }

  /**
   * Mirrors the server's assertCanManage so write controls stay hidden from
   * people who would only get a 403. The server still decides.
   */
  private canManage(person: Person): boolean {
    if (this.auth.hasPermission('admin.users')) return true;
    if (!this.auth.hasPermission('admin.users.non_admin')) return false;
    return !PROTECTED_ROLE_CODES.includes(person.roleCode ?? '');
  }

  private isSelf(person: Person): boolean {
    return person.userId !== null && person.userId === this.auth.currentUser()?.id;
  }

  // ---------- positions ----------

  onPositionsPage(page: number): void {
    this.admin.loadPositions(page).subscribe({ error: (err) => this.showError(err) });
  }

  addPosition(payload: CreatePositionRequest): void {
    this.beginWrite();
    this.admin
      .createPosition(payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (res) => {
          this.toasts.success(res.message);
          this.positionList().resetAdd();
          this.refreshPositions(this.positionsMeta().page);
        },
        error: (err) => this.showError(err),
      });
  }

  editPosition({ id, changes }: PositionEdit): void {
    this.beginWrite();
    this.admin
      .updatePosition(id, changes)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (res) => {
          this.toasts.success(res.message);
          // The row was patched in place; a rename or retire must still reach
          // the dropdowns, which come from the other endpoint.
          this.admin.loadSelectablePositions().subscribe({ error: () => undefined });
        },
        error: (err) => this.showError(err),
      });
  }

  removePosition(position: Position): void {
    const question = this.translate.instant('users.positions.confirmDelete', {
      name: position.name,
    });
    if (!confirm(question)) return;

    this.beginWrite();
    this.admin
      .deletePosition(position.id)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (res) => {
          this.toasts.success(res.message);
          // Deleting the only row on the last page would leave an empty page
          // for a moment before the server clamps; step back first.
          const { page } = this.positionsMeta();
          const target = this.positions().length === 1 && page > 1 ? page - 1 : page;
          this.refreshPositions(target);
        },
        error: (err) => this.showError(err),
      });
  }

  /** After a create or delete: the page changed shape, and so may the dropdowns. */
  private refreshPositions(page: number): void {
    this.admin.loadPositions(page).subscribe({ error: (err) => this.showError(err) });
    this.admin.loadSelectablePositions().subscribe({ error: () => undefined });
  }

  // ---------- plumbing ----------

  private beginWrite(): void {
    this.saving.set(true);
    this.error.set(null);
    this.fieldIssues.set([]);
  }

  private showError(err: HttpErrorResponse): void {
    const body = err.error as ApiError | undefined;
    this.error.set(body?.message ?? this.translate.instant('common.somethingWentWrong'));
    this.fieldIssues.set(body?.issues ?? []);
  }
}
