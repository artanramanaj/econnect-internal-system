import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { provideTranslateTesting } from '../../core/i18n/translate.testing';
import { ToastService } from '../../core/services/toast.service';
import { Sidebar } from './sidebar';

describe('Sidebar', () => {
  let component: Sidebar;
  let fixture: ComponentFixture<Sidebar>;
  let httpMock: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Sidebar],
      // Nav links need the router; AuthService injects HttpClient at construction.
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
    fixture = TestBed.createComponent(Sidebar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
  });

  const hrefs = () =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a')).map((a) =>
      a.getAttribute('href'),
    );

  const toast = () => TestBed.inject(ToastService).current();

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render a link for every route in the nav', () => {
    expect(hrefs()).toEqual([
      '/dashboard',
      '/projects',
      '/products',
      '/team-allocations',
      '/daily-cost-engine',
      '/bom',
      '/quote-reconciler',
      '/settings',
    ]);
  });

  it('should hide the users link without the admin permission', () => {
    // No session resolved, so permissions are empty and canManageUsers() is false.
    expect(component.canManageUsers()).toBe(false);
    expect(hrefs()).not.toContain('/users');
  });

  it('should toast the server message and go to login after signing out', async () => {
    component.logout();
    httpMock.expectOne('/api/auth/logout').flush({ message: 'Signed out successfully' });
    await fixture.whenStable();

    expect(toast()).toEqual({ text: 'Signed out successfully', type: 'success' });
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should still go to login, without a toast, when sign-out fails', async () => {
    component.logout();
    httpMock
      .expectOne('/api/auth/logout')
      .flush({ message: 'nope' }, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(toast()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
