import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideTranslateTesting } from '../../../core/i18n/translate.testing';
import { Person } from '../../../core/models/people.model';
import { ToastService } from '../../../core/services/toast.service';
import { Users } from './users';

const POSITIONS = [
  { id: 1, name: 'Technician', isActive: true, employeeCount: 2 },
  { id: 12, name: 'Installer', isActive: false, employeeCount: 1 },
];

const SELECTABLE = [{ id: 1, name: 'Technician' }];

const ROLES = [
  { id: 1, code: 'technician', name: 'Technician' },
  { id: 2, code: 'project_manager', name: 'Project Manager' },
];

const META = { page: 1, pageSize: 10, total: 1, totalPages: 1 };

const PEOPLE_PAGE = {
  people: [] as Person[],
  canViewCost: true,
  grantableRoleCodes: [] as string[],
  meta: META,
};

function person(overrides: Partial<Person> = {}): Person {
  return {
    employeeId: 1,
    userId: 10,
    firstName: 'Mentor',
    lastName: 'Rama',
    initials: 'MR',
    username: 'mentor.rama',
    email: 'mentor@econnect-ks.com',
    position: 'Installer',
    positionId: 12,
    phone: null,
    isFieldStaff: true,
    isActive: true,
    roleCode: 'technician',
    roleName: 'Technician',
    status: 'ACTIVE',
    lastLoginAt: null,
    ...overrides,
  };
}

describe('Users', () => {
  let component: Users;
  let fixture: ComponentFixture<Users>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Users],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideTranslateTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Users);
    component = fixture.componentInstance;

    // The constructor's loadAll() fires all six of these.
    httpMock
      .expectOne((r) => r.url === '/api/people')
      .flush({
        ...PEOPLE_PAGE,
        people: [person()],
        grantableRoleCodes: ['technician', 'project_manager'],
      });
    httpMock.expectOne('/api/roles').flush({ roles: ROLES });
    httpMock
      .expectOne((r) => r.url === '/api/positions')
      .flush({ positions: POSITIONS, activeCount: 1, meta: { ...META, total: 2 } });
    httpMock.expectOne('/api/positions/selectable').flush({ positions: SELECTABLE });
    httpMock.expectOne('/api/roles/matrix').flush({ groups: ROLES, rows: [] });
    httpMock.expectOne('/api/users/pending').flush({
      users: [{ id: 7, username: 'valon.shala', email: 'v@e.com', roles: ['technician'] }],
    });

    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const toast = () => TestBed.inject(ToastService).current();

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render all four sections plus no drawer', () => {
    expect(el().querySelector('app-user-table')).toBeTruthy();
    expect(el().querySelector('app-add-employee')).toBeTruthy();
    expect(el().querySelector('app-access-request')).toBeTruthy();
    expect(el().querySelector('app-groups-permissions')).toBeTruthy();
    expect(el().querySelector('app-user-edit-drawer')).toBeNull();
  });

  it('should pass the loaded data down to the children', () => {
    expect(component.people()).toHaveLength(1);
    expect(component.pending()).toHaveLength(1);
    // Rendered by user-table and access-request respectively.
    expect(el().textContent).toContain('Mentor Rama');
    expect(el().textContent).toContain('valon.shala');
  });

  it('should seed each request card with the group the user asked for', () => {
    expect(component.requestRole()).toEqual({ 7: 'technician' });
  });

  it('should resolve grantable role codes to roles', () => {
    expect(component.grantableRoles().map((r) => r.code)).toEqual([
      'technician',
      'project_manager',
    ]);
  });

  it('should refetch with the group filter, keeping the search term and going to page 1', () => {
    component.onSearch('rama');
    component.onGroupFilter('technician');

    const request = httpMock.expectOne((r) => r.url === '/api/people');
    expect(request.request.params.get('q')).toBe('rama');
    expect(request.request.params.get('group')).toBe('technician');
    expect(request.request.params.get('page')).toBe('1');
    request.flush(PEOPLE_PAGE);
  });

  it('should load the requested page with the filters intact', () => {
    component.onGroupFilter('technician');
    httpMock.expectOne((r) => r.url === '/api/people').flush(PEOPLE_PAGE);

    component.onPeoplePage(2);

    const request = httpMock.expectOne((r) => r.url === '/api/people');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('group')).toBe('technician');
    request.flush({ ...PEOPLE_PAGE, meta: { ...META, page: 2, total: 15, totalPages: 2 } });

    expect(component.peopleMeta().page).toBe(2);
  });

  it('should keep the current page but drop the last response when loads overlap', () => {
    component.onPeoplePage(2);
    const first = httpMock.expectOne((r) => r.url === '/api/people');

    // A second load starts before the first answers; switchMap discards the first.
    component.onPeoplePage(3);
    const second = httpMock.expectOne((r) => r.url === '/api/people');

    expect(first.cancelled).toBe(true);
    second.flush({ ...PEOPLE_PAGE, meta: { ...META, page: 3, total: 25, totalPages: 3 } });
    expect(component.peopleMeta().page).toBe(3);
  });

  const NEW_PERSON = {
    firstName: 'Valon',
    lastName: 'Shala',
    login: {
      username: 'valon.shala',
      email: 'valon@econnect-ks.com',
      password: 'initialpw1',
      roleCode: 'technician',
    },
  };

  it('should POST a new person and clear the form on success', async () => {
    component.submitAdd(NEW_PERSON);

    const request = httpMock.expectOne('/api/people');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.firstName).toBe('Valon');

    request.flush({
      message: 'Account created for Valon Shala (valon.shala).',
      person: person({ employeeId: 2, firstName: 'Valon' }),
    });
    await fixture.whenStable();

    // The roster is a page sorted by name, so the row is refetched, not patched in.
    const reload = httpMock.expectOne((r) => r.url === '/api/people');
    expect(reload.request.params.get('page')).toBe('1');
    reload.flush({ ...PEOPLE_PAGE, people: [person(), person({ employeeId: 2 })] });

    expect(component.saving()).toBe(false);
    expect(component.people()).toHaveLength(2);
    expect(toast()).toEqual({
      text: 'Account created for Valon Shala (valon.shala).',
      type: 'success',
    });
  });

  it('should surface the backend message and issues on a failed write', async () => {
    component.submitAdd(NEW_PERSON);

    httpMock
      .expectOne('/api/people')
      .flush(
        { message: 'Username already taken', issues: [{ field: 'username', message: 'Taken' }] },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();

    expect(component.error()).toBe('Username already taken');
    expect(component.fieldIssues()).toHaveLength(1);
    expect(el().textContent).toContain('Taken');
  });

  it('should open and close the drawer', async () => {
    component.openEdit(person());
    await fixture.whenStable();
    expect(el().querySelector('app-user-edit-drawer')).toBeTruthy();

    component.closeEdit();
    await fixture.whenStable();
    expect(el().querySelector('app-user-edit-drawer')).toBeNull();
  });

  it('should PATCH the edited details', async () => {
    component.openEdit(person());
    await fixture.whenStable();

    component.submitEdit({ firstName: 'Mentori', lastName: 'Rama', isFieldStaff: true });

    const request = httpMock.expectOne('/api/people/1');
    expect(request.request.body.firstName).toBe('Mentori');
    request.flush({ message: 'Mentori Rama updated.', person: person({ firstName: 'Mentori' }) });
    await fixture.whenStable();

    expect(toast()).toEqual({ text: 'Mentori Rama updated.', type: 'success' });
  });

  it('should toast once, with the final message, when approving also changes the group', async () => {
    const pending = component.pending()[0];
    component.onRequestRole({ userId: pending.id, roleCode: 'project_manager' });
    component.approve(pending);

    httpMock.expectOne('/api/users/7/role').flush({
      message: 'valon.shala moved to Project Manager.',
      user: { ...pending, roles: ['project_manager'] },
    });
    httpMock.expectOne('/api/users/7/status').flush({
      message: 'valon.shala activated.',
      user: { ...pending, roles: ['project_manager'], status: 'ACTIVE' },
    });
    httpMock
      .expectOne((r) => r.url === '/api/people')
      .flush({ ...PEOPLE_PAGE, people: [person()] });
    await fixture.whenStable();

    // The intermediate group change stays silent; only the activation toasts.
    expect(toast()).toEqual({ text: 'valon.shala activated.', type: 'success' });
    expect(component.pending()).toHaveLength(0);
  });

  // ---------- positions ----------

  const positionsPage = (page: number, total: number) => ({
    positions: POSITIONS,
    activeCount: 1,
    meta: { page, pageSize: 10, total, totalPages: Math.ceil(total / 10) },
  });

  it('should reload the current page and the dropdown list after adding a position', async () => {
    component.addPosition({ name: 'Sales' });

    httpMock
      .expectOne('/api/positions')
      .flush({ message: '"Sales" added.', position: { ...POSITIONS[0], id: 3, name: 'Sales' } });
    await fixture.whenStable();

    const reload = httpMock.expectOne((r) => r.url === '/api/positions');
    expect(reload.request.params.get('page')).toBe('1');
    reload.flush(positionsPage(1, 3));
    httpMock.expectOne('/api/positions/selectable').flush({ positions: SELECTABLE });

    expect(toast()).toEqual({ text: '"Sales" added.', type: 'success' });
    expect(component.positionsMeta().total).toBe(3);
  });

  it('should step back a page when deleting the only row on the last page', async () => {
    // Land on page 2 holding a single row.
    component.onPositionsPage(2);
    httpMock
      .expectOne((r) => r.url === '/api/positions')
      .flush({ ...positionsPage(2, 11), positions: [POSITIONS[1]] });

    component.removePosition(POSITIONS[1]);
    await fixture.whenStable();
    httpMock.expectNone('/api/positions/12');

    const modal = (fixture.nativeElement as HTMLElement).querySelector('app-delete-modal')!;
    expect(modal.textContent).toContain('Delete position?');
    expect(modal.textContent).toContain('The position "Installer" will be deleted permanently.');
    Array.from(modal.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Delete')!
      .click();

    httpMock.expectOne('/api/positions/12').flush({ message: '"Installer" deleted.', id: 12 });
    await fixture.whenStable();

    const reload = httpMock.expectOne((r) => r.url === '/api/positions');
    expect(reload.request.params.get('page')).toBe('1');
    reload.flush(positionsPage(1, 10));
    httpMock.expectOne('/api/positions/selectable').flush({ positions: SELECTABLE });
  });

  it('should keep the active count in step when retiring a position in place', async () => {
    expect(component.positionsActiveCount()).toBe(1);

    component.editPosition({ id: 1, changes: { isActive: false } });
    httpMock
      .expectOne('/api/positions/1')
      .flush({ message: '"Technician" updated.', position: { ...POSITIONS[0], isActive: false } });
    await fixture.whenStable();

    // No page reload: only the dropdown source is refreshed.
    httpMock.expectOne('/api/positions/selectable').flush({ positions: [] });

    expect(component.positionsActiveCount()).toBe(0);
    expect(component.positions()[0].isActive).toBe(false);
  });
});
