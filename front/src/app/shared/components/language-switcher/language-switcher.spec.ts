import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideTranslateTesting } from '../../../core/i18n/translate.testing';
import { LanguageService } from '../../../core/services/language.service';
import { LanguageSwitcher } from './language-switcher';

describe('LanguageSwitcher', () => {
  let fixture: ComponentFixture<LanguageSwitcher>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LanguageSwitcher],
      // LanguageService's AuthService injects HttpClient at construction.
      providers: [provideHttpClient(), provideHttpClientTesting(), provideTranslateTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(LanguageSwitcher);
    await fixture.whenStable();
  });

  const buttons = () =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
  const pressed = () =>
    buttons()
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
      .map((b) => b.textContent?.trim());

  it('should offer both languages and mark the current one', () => {
    expect(buttons().map((b) => b.textContent?.trim())).toEqual(['sq', 'en']);
    expect(pressed()).toEqual(['sq']);
  });

  it('should switch the language on click', async () => {
    buttons()[1].click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();

    expect(TestBed.inject(LanguageService).current()).toBe('en');
    expect(pressed()).toEqual(['en']);
  });
});
