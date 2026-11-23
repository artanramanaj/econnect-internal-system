import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideTranslateTesting } from '../i18n/translate.testing';
import { LanguageService } from '../services/language.service';
import { languageInterceptor } from './language.interceptor';

describe('languageInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([languageInterceptor])),
        provideHttpClientTesting(),
        provideTranslateTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should send the UI language as Accept-Language on API calls', () => {
    http.get('/api/roles').subscribe();

    const request = httpMock.expectOne('/api/roles');
    expect(request.request.headers.get('Accept-Language')).toBe('sq');
    request.flush({});
  });

  it('should follow a language switch', async () => {
    await TestBed.inject(LanguageService).use('en');
    http.get('/api/roles').subscribe();

    const request = httpMock.expectOne('/api/roles');
    expect(request.request.headers.get('Accept-Language')).toBe('en');
    request.flush({});
  });

  it('should leave non-API requests alone', () => {
    http.get('/i18n/en.json').subscribe();

    const request = httpMock.expectOne('/i18n/en.json');
    expect(request.request.headers.has('Accept-Language')).toBe(false);
    request.flush({});
  });
});
