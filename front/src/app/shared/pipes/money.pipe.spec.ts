import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideTranslateTesting } from '../../core/i18n/translate.testing';
import { LanguageService } from '../../core/services/language.service';
import { MoneyPipe } from './money.pipe';

@Component({
  imports: [MoneyPipe],
  template: `<span>{{ amount() | money }}</span>`,
})
class HostComponent {
  // A signal, not a plain field: the app is zoneless.
  readonly amount = signal<string | number | null>('12.5000');
}

describe('MoneyPipe', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(async () => {
    // LanguageService starts from the stored choice; start every test in the default, Albanian.
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      // LanguageService injects AuthService, which injects HttpClient at construction.
      providers: [provideHttpClient(), provideHttpClientTesting(), provideTranslateTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  // Albanian groups and separates with no-break spaces; compare with plain ones.
  const text = () =>
    (fixture.nativeElement as HTMLElement).textContent?.trim().replace(/[  ]/g, ' ');

  it('should format in the Albanian locale by default', () => {
    expect(text()).toBe('12,50 €');
  });

  it('should keep up to four decimals when the amount has them', async () => {
    host.amount.set('0.1234');
    await fixture.whenStable();

    expect(text()).toBe('0,1234 €');
  });

  it('should follow a switch to English', async () => {
    await TestBed.inject(LanguageService).use('en');
    host.amount.set(1234.5);
    await fixture.whenStable();

    expect(text()).toBe('€1,234.50');
  });

  it('should render a dash for no amount', async () => {
    host.amount.set(null);
    await fixture.whenStable();

    expect(text()).toBe('—');
  });
});
