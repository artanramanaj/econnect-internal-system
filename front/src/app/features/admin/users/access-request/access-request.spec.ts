import { ComponentFixture, TestBed } from '@angular/core/testing';
import { User } from '../../../../core/models/user.model';
import { provideTranslateTesting } from '../../../../core/i18n/translate.testing';
import { AccessRequest } from './access-request';

const ROLES = [
  { id: 1, code: 'technician', name: 'Technician' },
  { id: 2, code: 'project_manager', name: 'Project Manager' },
];

function user(overrides: Partial<User> = {}): User {
  return {
    id: 7,
    username: 'valon.shala',
    email: 'valon@econnect-ks.com',
    roles: ['technician'],
    ...overrides,
  } as User;
}

describe('AccessRequest', () => {
  let component: AccessRequest;
  let fixture: ComponentFixture<AccessRequest>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccessRequest],
      providers: [provideTranslateTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AccessRequest);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const cards = () => el().querySelectorAll('.grid > div');

  it('should show the empty state with no requests', () => {
    expect(cards()).toHaveLength(0);
    expect(el().textContent).toContain('No open requests.');
  });

  it('should render a card per request with the count in the heading', async () => {
    fixture.componentRef.setInput('requests', [user(), user({ id: 8, username: 'ardit.k' })]);
    await fixture.whenStable();

    expect(cards()).toHaveLength(2);
    expect(el().querySelector('#req-heading')?.textContent).toContain('2');
  });

  it('should resolve the role code to its display name', async () => {
    fixture.componentRef.setInput('requests', [user()]);
    fixture.componentRef.setInput('roles', ROLES);
    await fixture.whenStable();

    expect(el().textContent).toContain('Technician');
    expect(el().textContent).toContain('valon@econnect-ks.com');
  });

  it('should fall back to a dash for a request with no group', () => {
    expect(component.roleName(null)).toBe('—');
  });

  it('should preselect the group held in selectedRoles', async () => {
    fixture.componentRef.setInput('requests', [user()]);
    fixture.componentRef.setInput('grantableRoles', ROLES);
    fixture.componentRef.setInput('selectedRoles', { 7: 'project_manager' });
    await fixture.whenStable();

    const options = el().querySelectorAll<HTMLOptionElement>('option');
    expect(options[1].selected).toBe(true);
  });

  it('should emit the user id with the newly chosen group', async () => {
    const seen: { userId: number; roleCode: string }[] = [];
    component.roleChange.subscribe((change) => seen.push(change));

    fixture.componentRef.setInput('requests', [user()]);
    fixture.componentRef.setInput('grantableRoles', ROLES);
    await fixture.whenStable();

    const select = el().querySelector<HTMLSelectElement>('select')!;
    select.value = 'project_manager';
    select.dispatchEvent(new Event('change'));

    expect(seen).toEqual([{ userId: 7, roleCode: 'project_manager' }]);
  });

  it('should emit the user on approve and on reject', async () => {
    const target = user();
    const approved: User[] = [];
    const rejected: User[] = [];
    component.approve.subscribe((u) => approved.push(u));
    component.reject.subscribe((u) => rejected.push(u));

    fixture.componentRef.setInput('requests', [target]);
    await fixture.whenStable();

    const buttons = el().querySelectorAll<HTMLButtonElement>('button');
    buttons[0].click();
    buttons[1].click();

    expect(approved).toEqual([target]);
    expect(rejected).toEqual([target]);
  });

  it('should disable both actions while a write is in flight', async () => {
    fixture.componentRef.setInput('requests', [user()]);
    fixture.componentRef.setInput('saving', true);
    await fixture.whenStable();

    const buttons = el().querySelectorAll<HTMLButtonElement>('button');
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(true);
  });
});
