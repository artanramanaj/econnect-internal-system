import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Person } from '../../../../core/models/people.model';
import { provideTranslateTesting } from '../../../../core/i18n/translate.testing';
import { UserTable } from './user-table';

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

describe('UserTable', () => {
  let component: UserTable;
  let fixture: ComponentFixture<UserTable>;

  beforeEach(async () => {
    // The parent resolves permissions and passes them in; the table itself only
    // needs translations and LanguageService (whose AuthService injects HttpClient).
    await TestBed.configureTestingModule({
      imports: [UserTable],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideTranslateTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(UserTable);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const rows = () => el().querySelectorAll('tbody tr');

  it('should show the empty state with nobody to list', () => {
    expect(rows()).toHaveLength(1);
    expect(el().textContent).toContain('Nobody matches that search.');
  });

  it('should say it is loading rather than empty while the request is in flight', async () => {
    fixture.componentRef.setInput('loading', true);
    await fixture.whenStable();

    expect(el().textContent).toContain('Loading…');
  });

  it('should render a row per person with the overall count in the heading', async () => {
    fixture.componentRef.setInput('people', [
      person(),
      person({ employeeId: 2, firstName: 'Valon', lastName: 'Shala' }),
    ]);
    // The heading counts the whole roster, not the page.
    fixture.componentRef.setInput('meta', { page: 1, pageSize: 10, total: 23, totalPages: 3 });
    await fixture.whenStable();

    expect(rows()).toHaveLength(2);
    expect(el().querySelector('#people-heading')?.textContent).toContain('23');
    expect(el().textContent).toContain('Mentor Rama');
    expect(el().textContent).toContain('Valon Shala');
  });

  it('should hide the cost column unless canViewCost is set', async () => {
    fixture.componentRef.setInput('people', [person({ hourlyCost: '12.50' })]);
    await fixture.whenStable();
    expect(el().textContent).not.toContain('Cost / hour');

    fixture.componentRef.setInput('canViewCost', true);
    await fixture.whenStable();
    expect(el().textContent).toContain('Cost / hour');
    expect(el().textContent).toContain('€ 12.50');
  });

  it('should only offer Edit for manageable rows', async () => {
    fixture.componentRef.setInput('people', [person(), person({ employeeId: 2 })]);
    fixture.componentRef.setInput('manageableIds', new Set([2]));
    await fixture.whenStable();

    const buttons = el().querySelectorAll('tbody button');
    expect(buttons).toHaveLength(1);
  });

  it('should emit the person behind the Edit button', async () => {
    const target = person();
    const seen: Person[] = [];
    component.edit.subscribe((p) => seen.push(p));

    fixture.componentRef.setInput('people', [target]);
    fixture.componentRef.setInput('manageableIds', new Set([1]));
    await fixture.whenStable();

    el().querySelector<HTMLButtonElement>('tbody button')!.click();
    expect(seen).toEqual([target]);
  });

  it('should emit a trimmed search term', () => {
    const seen: string[] = [];
    component.search.subscribe((term) => seen.push(term));

    const input = el().querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = '  rama  ';
    input.dispatchEvent(new Event('input'));

    expect(seen).toEqual(['rama']);
  });

  it('should emit the chosen group filter', async () => {
    const seen: string[] = [];
    component.groupFilterChange.subscribe((code) => seen.push(code));

    fixture.componentRef.setInput('roles', [{ id: 1, code: 'technician', name: 'Technician' }]);
    await fixture.whenStable();

    const select = el().querySelector<HTMLSelectElement>('select')!;
    select.value = 'technician';
    select.dispatchEvent(new Event('change'));

    expect(seen).toEqual(['technician']);
  });

  it('should describe account state in the Login column', () => {
    expect(component.loginLabel(person({ userId: null }))).toBe('No login');
    expect(component.loginLabel(person({ status: 'PENDING' }))).toBe('Awaiting approval');
    expect(component.loginLabel(person({ status: 'SUSPENDED' }))).toBe('Deactivated');
    expect(component.loginLabel(person({ lastLoginAt: null }))).toBe('Never signed in');
    expect(component.loginLabel(person({ lastLoginAt: new Date().toISOString() }))).toContain(
      'Today',
    );

    expect(component.loginMuted(person())).toBe(false);
    expect(component.loginMuted(person({ status: 'PENDING' }))).toBe(true);
  });

  it('should show the pager only when there is more than one page, and bubble its clicks', async () => {
    const pages: number[] = [];
    component.pageChange.subscribe((p) => pages.push(p));

    expect(el().querySelector('app-pagination nav')).toBeNull();

    fixture.componentRef.setInput('meta', { page: 1, pageSize: 10, total: 23, totalPages: 3 });
    await fixture.whenStable();

    el().querySelector<HTMLButtonElement>('button[aria-label="Next page"]')!.click();
    expect(pages).toEqual([2]);
  });
});
