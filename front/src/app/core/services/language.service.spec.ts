import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslateService } from '@ngx-translate/core';
import { provideTranslateTesting } from '../i18n/translate.testing';
import { AuthService } from './auth.service';
import { LanguageService } from './language.service';

const user = (locale: string) => ({
  id: 1,
  username: 'valon.shala',
  email: 'valon@econnect-ks.com',
  status: 'ACTIVE',
  locale,
  createdAt: '',
  lastLoginAt: null,
  roles: [],
  employee: null,
});

/** Lets the async language switch inside the effect settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('LanguageService', () => {
  let service: LanguageService;
  let translate: TranslateService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideTranslateTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    translate = TestBed.inject(TranslateService);
    service = TestBed.inject(LanguageService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  const signIn = (locale: string) => {
    TestBed.inject(AuthService).me().subscribe();
    httpMock.expectOne('/api/auth/me').flush({ user: user(locale), permissions: [] });
    TestBed.tick();
  };

  it('should start in Albanian when nothing is stored', () => {
    expect(service.current()).toBe('sq');
    expect(service.locale()).toBe('sq-AL');
  });

  it('should switch the translations, <html lang> and the stored choice', async () => {
    await service.use('en');

    expect(service.current()).toBe('en');
    expect(service.locale()).toBe('en-GB');
    expect(translate.getCurrentLang()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('econnect.language')).toBe('en');
  });

  it('should adopt the account language on sign-in when this device has no choice yet', async () => {
    signIn('en');
    await settle();

    expect(service.current()).toBe('en');
    expect(localStorage.getItem('econnect.language')).toBe('en');
  });

  it('should save the device choice to the account when the two differ', async () => {
    // Not signed in yet, so nothing is saved to the account.
    await service.use('en');

    signIn('sq');

    const patch = httpMock.expectOne('/api/auth/me/locale');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ locale: 'en' });
    patch.flush({ message: 'Language updated.', user: user('en') });
    TestBed.tick();

    expect(service.current()).toBe('en');
  });

  it('should save a switch to the account while signed in', async () => {
    signIn('sq');
    await settle();

    await service.use('en');

    const patch = httpMock.expectOne('/api/auth/me/locale');
    expect(patch.request.body).toEqual({ locale: 'en' });
    patch.flush({ message: 'Language updated.', user: user('en') });
    TestBed.tick();
  });
});
