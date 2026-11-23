import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateTesting } from '../../../../core/i18n/translate.testing';
import { LoginRequest } from '../../../../core/models/user.model';
import { SignInForm } from './sign-in-form';

describe('SignInForm', () => {
  let component: SignInForm;
  let fixture: ComponentFixture<SignInForm>;
  let emitted: LoginRequest[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignInForm],
      // The template links to /register.
      providers: [provideRouter([]), provideTranslateTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(SignInForm);
    component = fixture.componentInstance;

    emitted = [];
    component.submitted.subscribe((credentials) => emitted.push(credentials));

    await fixture.whenStable();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const submitButton = () => el().querySelector<HTMLButtonElement>('button[type="submit"]')!;

  it('should not emit while the form is empty, and should mark the fields touched', async () => {
    component.onSubmit();
    await fixture.whenStable();

    expect(emitted).toHaveLength(0);
    expect(component.form.controls.username.touched).toBe(true);
    expect(el().textContent).toContain('Username is required');
    expect(el().textContent).toContain('Password is required');
  });

  it('should emit the credentials once both fields are filled', () => {
    component.form.setValue({ username: 'valon.shala', password: 'hunter22' });
    component.onSubmit();

    expect(emitted).toEqual([{ username: 'valon.shala', password: 'hunter22' }]);
  });

  it('should not emit when the password is shorter than 8 characters', async () => {
    component.form.setValue({ username: 'valon.shala', password: 'hunter2' });
    component.onSubmit();
    await fixture.whenStable();

    expect(emitted).toHaveLength(0);
    expect(el().textContent).toContain('Password must be at least 8 characters');
  });

  it('should render the error banner from the input', async () => {
    fixture.componentRef.setInput('errorMessage', 'Sign in failed.');
    await fixture.whenStable();

    expect(el().textContent).toContain('Sign in failed.');
  });

  it('should disable the submit button while loading', async () => {
    expect(submitButton().disabled).toBe(false);
    expect(submitButton().textContent?.trim()).toBe('Sign in');

    fixture.componentRef.setInput('loading', true);
    await fixture.whenStable();

    expect(submitButton().disabled).toBe(true);
    expect(submitButton().textContent?.trim()).toBe('Signing in…');
  });

  it('should toggle the password field between hidden and visible', async () => {
    const field = () => el().querySelector<HTMLInputElement>('#pw')!;
    expect(field().type).toBe('password');

    component.togglePassword();
    await fixture.whenStable();
    expect(field().type).toBe('text');

    component.togglePassword();
    await fixture.whenStable();
    expect(field().type).toBe('password');
  });
});
