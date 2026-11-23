import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideTranslateTesting } from '../../../core/i18n/translate.testing';
import { ToastService } from '../../../core/services/toast.service';
import { Register } from './register';

describe('Register', () => {
  let component: Register;
  let fixture: ComponentFixture<Register>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Register],
      // The child components link to /login, and the constructor loads the
      // requestable roles over HTTP.
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateTesting(),
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Register);
    component = fixture.componentInstance;

    httpMock
      .expectOne('/api/roles/requestable')
      .flush({ roles: [{ id: 1, code: 'engineer', name: 'Engineer' }] });
    httpMock
      .expectOne('/api/positions/selectable')
      .flush({ positions: [{ id: 1, name: 'Technician' }] });

    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
  });

  const el = () => fixture.nativeElement as HTMLElement;

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the brand panel beside the form', () => {
    expect(el().querySelector('app-brand-panel')).toBeTruthy();
    expect(el().querySelector('app-register-form')).toBeTruthy();
    expect(el().querySelector('h1')?.textContent?.trim()).toBe('Request access');
  });

  it('should render the three steps in the brand panel', () => {
    const steps = Array.from(el().querySelectorAll('ol li p')).map((p) => p.textContent?.trim());
    expect(steps).toEqual(['Send the request', 'Admin review', 'Activation email']);
  });

  it('should pass the loaded roles down to the form', () => {
    expect(component.roles()).toHaveLength(1);
    expect(el().querySelectorAll('#grp option')).toHaveLength(1);
  });

  it('should surface a message when the roles request fails', async () => {
    // Rebuild with a failing roles call.
    httpMock.verify();
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateTesting(),
      ],
    }).compileComponents();

    const mock = TestBed.inject(HttpTestingController);
    const failed = TestBed.createComponent(Register);

    mock
      .expectOne('/api/roles/requestable')
      .flush({ message: 'nope' }, { status: 500, statusText: 'Server Error' });
    mock
      .expectOne('/api/positions/selectable')
      .flush({ positions: [{ id: 1, name: 'Technician' }] });
    await failed.whenStable();

    expect(failed.componentInstance.errorMessage()).toContain('Could not load the user groups');
    mock.verify();
  });

  it('should post the details and reset the form on success', async () => {
    component.onSubmit({
      firstName: 'Valon',
      lastName: 'Shala',
      username: 'valon.shala',
      email: 'valon.shala@econnect.com',
      phone: '',
      positionId: 1,
      requestedRoleCode: 'engineer',
      password: 'Hunter2Hunter2',
      confirmPassword: 'Hunter2Hunter2',
    });

    const request = httpMock.expectOne('/api/auth/register');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.username).toBe('valon.shala');

    request.flush({ message: 'Request received.', user: { id: 1, username: 'valon.shala' } });
    await fixture.whenStable();

    expect(component.loading()).toBe(false);
    // Shown as a toast now, not as a banner in the page.
    expect(TestBed.inject(ToastService).current()).toEqual({
      text: 'Request received.',
      type: 'success',
    });
    expect(el().textContent).not.toContain('Request received.');
  });

  it('should surface the field issues the backend returns', async () => {
    component.onSubmit({
      firstName: 'Valon',
      lastName: 'Shala',
      username: 'taken',
      email: 'valon.shala@econnect.com',
      phone: '',
      positionId: 1,
      requestedRoleCode: 'engineer',
      password: 'Hunter2Hunter2',
      confirmPassword: 'Hunter2Hunter2',
    });

    httpMock.expectOne('/api/auth/register').flush(
      {
        message: 'Registration failed.',
        issues: [{ field: 'username', message: 'Already taken' }],
      },
      { status: 409, statusText: 'Conflict' },
    );
    await fixture.whenStable();

    expect(component.errorMessage()).toBe('Registration failed.');
    expect(component.fieldIssues()).toHaveLength(1);
    expect(el().textContent).toContain('Already taken');
  });
});
