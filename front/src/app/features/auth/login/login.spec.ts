import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { provideTranslateTesting } from '../../../core/i18n/translate.testing';
import { ToastService } from '../../../core/services/toast.service';
import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let httpMock: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      // The form links to /register, and AuthService injects HttpClient at construction.
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateTesting(),
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    // No routes are registered, so a real navigation would reject.
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
  });

  const toast = () => TestBed.inject(ToastService).current();

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toast the server greeting and go to the dashboard after signing in', async () => {
    component.onSubmit({ username: 'valon.shala', password: 'Hunter2Hunter2' });

    const request = httpMock.expectOne('/api/auth/login');
    expect(request.request.method).toBe('POST');
    request.flush({
      message: 'Welcome back, Valon.',
      user: { id: 1, username: 'valon.shala', roles: ['technician'], employee: null },
      permissions: [],
    });
    await fixture.whenStable();

    expect(toast()).toEqual({ text: 'Welcome back, Valon.', type: 'success' });
    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(component.loading()).toBe(false);
  });

  it('should surface the server message, without a toast, when sign-in fails', async () => {
    component.onSubmit({ username: 'valon.shala', password: 'wrong-password' });

    httpMock
      .expectOne('/api/auth/login')
      .flush({ message: 'Wrong username or password.' }, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();

    expect(component.errorMessage()).toBe('Wrong username or password.');
    expect(toast()).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });
});
