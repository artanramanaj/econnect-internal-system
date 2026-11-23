import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { ToastService } from './core/services/toast.service';
import { toastStub } from './shared/components/toast/toast.testing';

describe('App', () => {
  let stub: ReturnType<typeof toastStub>;

  beforeEach(async () => {
    stub = toastStub();
    await TestBed.configureTestingModule({
      imports: [App],
      // The template needs the router for <router-outlet />, and <app-toast>
      // injects HotToastService - stubbed so jsdom never mounts the overlay.
      providers: [provideRouter([]), stub.provider],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the router outlet and the toast host', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
    expect(compiled.querySelector('app-toast')).toBeTruthy();
  });

  it('should show a toast when ToastService is given a message', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    TestBed.inject(ToastService).success('Welcome back, Valon.');
    await fixture.whenStable();

    expect(stub.calls).toEqual([['success', 'Welcome back, Valon.']]);
  });
});
