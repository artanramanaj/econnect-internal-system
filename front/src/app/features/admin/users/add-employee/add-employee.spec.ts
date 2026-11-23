import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CreatePersonRequest } from '../../../../core/models/people.model';
import { provideTranslateTesting } from '../../../../core/i18n/translate.testing';
import { AddEmployee } from './add-employee';

const POSITIONS = [
  { id: 1, name: 'Technician' },
  { id: 4, name: 'Sales' },
];

const ROLES = [
  { id: 1, code: 'technician', name: 'Technician' },
  { id: 2, code: 'project_manager', name: 'Project Manager' },
];

const LOGIN = {
  username: 'mentor.rama',
  email: 'mentor@econnect-ks.com',
  password: 'initialpw1',
  roleCode: 'technician',
};

describe('AddEmployee', () => {
  let component: AddEmployee;
  let fixture: ComponentFixture<AddEmployee>;
  let emitted: CreatePersonRequest[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddEmployee],
      providers: [provideTranslateTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AddEmployee);
    component = fixture.componentInstance;

    emitted = [];
    component.submitted.subscribe((payload) => emitted.push(payload));

    await fixture.whenStable();
  });

  const el = () => fixture.nativeElement as HTMLElement;

  /** Every control the backend requires, so a test can vary just one of them. */
  const fillRequired = () =>
    component.form.patchValue({
      firstName: 'Mentor',
      lastName: 'Rama',
      username: LOGIN.username,
      email: LOGIN.email,
      password: LOGIN.password,
      roleCode: LOGIN.roleCode,
      positionId: '1',
    });

  it('should render every field needed to register a user', async () => {
    fixture.componentRef.setInput('grantableRoles', ROLES);
    fixture.componentRef.setInput('positions', POSITIONS);
    await fixture.whenStable();

    // No checkbox gate any more: the account fields are always on screen.
    expect(el().querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(el().querySelector('#un')).toBeTruthy();
    expect(el().querySelector('#em')).toBeTruthy();
    expect(el().querySelector('#pw')).toBeTruthy();
    expect(el().querySelectorAll('#pos option')).toHaveLength(POSITIONS.length);
    expect(el().querySelector('#pos')?.textContent).toContain('Technician');
    expect(el().querySelectorAll('#grp option')).toHaveLength(ROLES.length);
  });

  it('should not emit while the required fields are missing', () => {
    component.onSubmit();

    expect(emitted).toHaveLength(0);
    expect(component.form.controls.firstName.touched).toBe(true);
    expect(component.form.controls.username.touched).toBe(true);
  });

  it('should nest the account fields into a login block', () => {
    fillRequired();
    component.onSubmit();

    expect(emitted).toEqual([
      {
        firstName: 'Mentor',
        lastName: 'Rama',
        positionId: 1,
        login: LOGIN,
      },
    ]);
  });

  it('should include the optional fields once they have values', () => {
    fillRequired();
    component.form.patchValue({
      positionId: '4',
      phone: '+38344123456',
      hourlyCost: '12.5',
    });
    component.onSubmit();

    expect(emitted[0]).toEqual({
      firstName: 'Mentor',
      lastName: 'Rama',
      positionId: 4,
      phone: '+38344123456',
      hourlyCost: 12.5,
      login: LOGIN,
    });
  });

  it('should preselect the first group and position so neither select is blank', async () => {
    expect(component.form.controls.roleCode.value).toBe('');
    expect(component.form.controls.positionId.value).toBe('');

    fixture.componentRef.setInput('grantableRoles', ROLES);
    fixture.componentRef.setInput('positions', POSITIONS);
    await fixture.whenStable();

    expect(component.form.controls.roleCode.value).toBe('technician');
    expect(component.form.controls.positionId.value).toBe('1');
  });

  it('should block submit on a password shorter than 8 characters', () => {
    fillRequired();
    component.form.controls.password.setValue('short');
    component.onSubmit();

    expect(emitted).toHaveLength(0);
  });

  it('should block submit on an invalid email', () => {
    fillRequired();
    component.form.controls.email.setValue('not-an-email');
    component.onSubmit();

    expect(emitted).toHaveLength(0);
  });

  it('should derive the daily cost from the hourly rate', async () => {
    expect(component.dailyPreview()).toBe('0.00');

    component.form.controls.hourlyCost.setValue('12.5');
    await fixture.whenStable();

    expect(component.dailyPreview()).toBe('100.00');
    expect(el().textContent).toContain('€ 100.00');
  });

  it('should clear the form on reset, re-seeding position and group', async () => {
    fixture.componentRef.setInput('grantableRoles', ROLES);
    fixture.componentRef.setInput('positions', POSITIONS);
    await fixture.whenStable();

    fillRequired();
    component.form.controls.hourlyCost.setValue('12.5');
    await fixture.whenStable();

    component.reset();
    await fixture.whenStable();

    expect(component.form.controls.firstName.value).toBe('');
    expect(component.form.controls.username.value).toBe('');
    expect(component.form.controls.password.value).toBe('');
    expect(component.form.controls.positionId.value).toBe('1');
    expect(component.form.controls.roleCode.value).toBe('technician');
    expect(component.dailyPreview()).toBe('0.00');
  });

  it('should disable the submit button while saving', async () => {
    const button = () => el().querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(button().disabled).toBe(false);
    expect(button().textContent?.trim()).toBe('Save employee');

    fixture.componentRef.setInput('saving', true);
    await fixture.whenStable();

    expect(button().disabled).toBe(true);
    expect(button().textContent?.trim()).toBe('Saving…');
  });
});
