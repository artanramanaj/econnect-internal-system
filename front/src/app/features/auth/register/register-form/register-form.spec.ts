import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RegisterRequest } from '../../../../core/models/user.model';
import { provideTranslateTesting } from '../../../../core/i18n/translate.testing';
import { RegisterForm } from './register-form';

// Not annotated as RegisterRequest: `phone` and `positionId` are optional there,
// while the form's setValue needs every field present.
const VALID = {
  firstName: 'Valon',
  lastName: 'Shala',
  username: 'valon.shala',
  email: 'valon.shala@econnect.com',
  phone: '',
  positionId: '1',
  requestedRoleCode: 'engineer',
  password: 'Hunter2Hunter2',
  confirmPassword: 'Hunter2Hunter2',
};

describe('RegisterForm', () => {
  let component: RegisterForm;
  let fixture: ComponentFixture<RegisterForm>;
  let emitted: RegisterRequest[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterForm],
      // The template links to /login.
      providers: [provideRouter([]), provideTranslateTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterForm);
    component = fixture.componentInstance;

    emitted = [];
    component.submitted.subscribe((details) => emitted.push(details));

    await fixture.whenStable();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const submitButton = () => el().querySelector<HTMLButtonElement>('button[type="submit"]')!;

  it('should not emit while the form is empty, and should mark the fields touched', async () => {
    component.onSubmit();
    await fixture.whenStable();

    expect(emitted).toHaveLength(0);
    expect(component.form.controls.email.touched).toBe(true);
    expect(el().textContent).toContain('First name is required');
    expect(el().textContent).toContain('Enter a valid email');
  });

  it('should emit the details once the form is valid', () => {
    component.form.setValue(VALID);
    component.onSubmit();

    // The control holds the select's string value; onSubmit coerces it.
    expect(emitted).toEqual([{ ...VALID, positionId: 1 }]);
  });

  it('should not emit when the passwords differ', () => {
    component.form.setValue({ ...VALID, confirmPassword: 'SomethingElse9' });
    component.onSubmit();

    expect(emitted).toHaveLength(0);
    expect(component.form.hasError('passwordMismatch')).toBe(true);
  });

  it('should preselect the first role once the parent supplies them', async () => {
    expect(component.form.controls.requestedRoleCode.value).toBe('');

    fixture.componentRef.setInput('roles', [
      { id: 1, code: 'engineer', name: 'Engineer' },
      { id: 2, code: 'pm', name: 'Project Manager' },
    ]);
    await fixture.whenStable();

    expect(component.form.controls.requestedRoleCode.value).toBe('engineer');
    expect(el().querySelectorAll('#grp option')).toHaveLength(2);
  });

  it('should light up each password rule as it is satisfied', async () => {
    const satisfied = () => el().querySelectorAll('[aria-label="Password rules"] .text-success');
    expect(satisfied()).toHaveLength(0);

    component.form.patchValue({ password: 'Hunter2Hunter2', confirmPassword: 'Hunter2Hunter2' });
    await fixture.whenStable();

    // 8+ characters, and the two fields match.
    expect(satisfied()).toHaveLength(2);
  });

  it('should render the error banner with its field issues', async () => {
    fixture.componentRef.setInput('errorMessage', 'Registration failed.');
    fixture.componentRef.setInput('fieldIssues', [
      { field: 'username', message: 'Username already taken' },
    ]);
    await fixture.whenStable();

    expect(el().textContent).toContain('Registration failed.');
    expect(el().textContent).toContain('Username already taken');
  });

  it('should disable the submit button while loading', async () => {
    expect(submitButton().disabled).toBe(false);
    expect(submitButton().textContent?.trim()).toBe('Send request');

    fixture.componentRef.setInput('loading', true);
    await fixture.whenStable();

    expect(submitButton().disabled).toBe(true);
    expect(submitButton().textContent?.trim()).toBe('Sending request…');
  });

  it('should clear the form on reset, re-seeding the position', async () => {
    fixture.componentRef.setInput('positions', [{ id: 1, name: 'Technician' }]);
    await fixture.whenStable();
    component.form.setValue(VALID);

    component.reset();

    expect(component.form.controls.username.value).toBe('');
    expect(component.form.controls.password.value).toBe('');
    expect(component.form.controls.positionId.value).toBe('1');
  });
});
