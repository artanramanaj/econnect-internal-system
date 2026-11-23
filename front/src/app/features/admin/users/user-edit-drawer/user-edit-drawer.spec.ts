import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Person, UpdatePersonRequest } from '../../../../core/models/people.model';
import { UserStatus } from '../../../../core/models/user.model';
import { provideTranslateTesting } from '../../../../core/i18n/translate.testing';
import { UserEditDrawer } from './user-edit-drawer';

const ROLES = [
  { id: 1, code: 'technician', name: 'Technician' },
  { id: 2, code: 'project_manager', name: 'Project Manager' },
];

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
    phone: '+38344123456',
    isFieldStaff: true,
    isActive: true,
    roleCode: 'technician',
    roleName: 'Technician',
    status: 'ACTIVE',
    lastLoginAt: null,
    ...overrides,
  };
}

describe('UserEditDrawer', () => {
  let component: UserEditDrawer;
  let fixture: ComponentFixture<UserEditDrawer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserEditDrawer],
      // The drawer reads LanguageService, whose AuthService injects HttpClient at construction.
      providers: [provideHttpClient(), provideHttpClientTesting(), provideTranslateTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(UserEditDrawer);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('person', person());
    await fixture.whenStable();
  });

  const el = () => fixture.nativeElement as HTMLElement;

  it('should fill the form from the person it was opened on', () => {
    expect(component.form.getRawValue()).toEqual({
      firstName: 'Mentor',
      lastName: 'Rama',
      positionId: '12',
      phone: '+38344123456',
      hourlyCost: '',
      isFieldStaff: true,
    });
    expect(el().querySelector('#drawer-heading')?.textContent?.trim()).toBe('Mentor Rama');
  });

  it('should refill when the parent swaps in another person', async () => {
    component.confirmingDelete.set(true);

    fixture.componentRef.setInput('person', person({ employeeId: 2, firstName: 'Valon' }));
    await fixture.whenStable();

    expect(component.form.controls.firstName.value).toBe('Valon');
    // A pending confirmation must not carry over to a different row.
    expect(component.confirmingDelete()).toBe(false);
  });

  it('should emit the changed details, nulling the emptied fields', () => {
    const saved: UpdatePersonRequest[] = [];
    component.save.subscribe((changes) => saved.push(changes));

    // '' is the drawer's "—" option, which clears the position.
    component.form.patchValue({ firstName: 'Mentori', positionId: '', hourlyCost: '15' });
    component.onSubmit();

    expect(saved).toEqual([
      {
        firstName: 'Mentori',
        lastName: 'Rama',
        positionId: null,
        phone: '+38344123456',
        isFieldStaff: true,
        hourlyCost: 15,
      },
    ]);
  });

  it('should not emit an invalid form', () => {
    const saved: UpdatePersonRequest[] = [];
    component.save.subscribe((changes) => saved.push(changes));

    component.form.controls.firstName.setValue('');
    component.onSubmit();

    expect(saved).toHaveLength(0);
  });

  it('should emit close from both the backdrop and the ✕ button', () => {
    let closed = 0;
    component.close.subscribe(() => closed++);

    el()
      .querySelectorAll<HTMLButtonElement>('button[aria-label="Close"]')
      .forEach((b) => b.click());

    expect(closed).toBe(2);
  });

  it('should emit a group change only when it differs from the current one', async () => {
    const seen: string[] = [];
    component.roleChange.subscribe((code) => seen.push(code));

    fixture.componentRef.setInput('roleOptions', ROLES);
    await fixture.whenStable();

    const select = el().querySelector<HTMLSelectElement>('#egrp')!;
    select.value = 'technician'; // unchanged
    select.dispatchEvent(new Event('change'));
    expect(seen).toHaveLength(0);

    select.value = 'project_manager';
    select.dispatchEvent(new Event('change'));
    expect(seen).toEqual(['project_manager']);
  });

  it('should emit a status change', () => {
    const seen: UserStatus[] = [];
    component.statusChange.subscribe((status) => seen.push(status));

    const select = el().querySelector<HTMLSelectElement>('#est')!;
    select.value = 'SUSPENDED';
    select.dispatchEvent(new Event('change'));

    expect(seen).toEqual(['SUSPENDED']);
  });

  it('should hide the group and status controls on your own account', async () => {
    fixture.componentRef.setInput('isSelf', true);
    await fixture.whenStable();

    expect(el().querySelector('#egrp')).toBeNull();
    expect(el().querySelector('#est')).toBeNull();
    expect(el().textContent).toContain('This is your own account.');
  });

  it('should hide the account block for a person with no login', async () => {
    fixture.componentRef.setInput('person', person({ userId: null, status: null }));
    await fixture.whenStable();

    expect(el().textContent).not.toContain('Account');
    expect(el().querySelector('#egrp')).toBeNull();
  });

  it('should require confirmation before emitting deactivate', async () => {
    let deactivated = 0;
    component.deactivate.subscribe(() => deactivated++);

    const trigger = Array.from(el().querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes('Deactivate this person'),
    )!;
    trigger.click();
    await fixture.whenStable();

    expect(deactivated).toBe(0);
    expect(el().textContent).toContain('They are signed out immediately');

    const confirm = Array.from(el().querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes('Yes, deactivate'),
    )!;
    confirm.click();

    expect(deactivated).toBe(1);
  });

  it('should hide the danger zone for an already inactive person', async () => {
    fixture.componentRef.setInput('person', person({ isActive: false }));
    await fixture.whenStable();

    expect(el().textContent).not.toContain('Deactivate this person');
  });

  it('should show the cost field only to those allowed to see it', async () => {
    expect(el().querySelector('#ehc')).toBeNull();

    fixture.componentRef.setInput('canViewCost', true);
    await fixture.whenStable();

    expect(el().querySelector('#ehc')).toBeTruthy();
  });

  const positionLabels = () =>
    Array.from(el().querySelectorAll('#epos option')).map((o) => o.textContent?.trim());

  it("should offer the person's own retired position first, flagged", async () => {
    // Installer (id 12) is what the person holds, but it is not selectable any more.
    fixture.componentRef.setInput('positions', [{ id: 1, name: 'Technician' }]);
    await fixture.whenStable();

    expect(positionLabels()).toEqual(['—', 'Installer (retired)', 'Technician']);
    expect(component.form.controls.positionId.value).toBe('12');
  });

  it('should not flag the position when it is still selectable', async () => {
    fixture.componentRef.setInput('positions', [
      { id: 1, name: 'Technician' },
      { id: 12, name: 'Installer' },
    ]);
    await fixture.whenStable();

    expect(positionLabels()).toEqual(['—', 'Technician', 'Installer']);
  });
});
