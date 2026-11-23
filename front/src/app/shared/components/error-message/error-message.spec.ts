import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ErrorMessage, ErrorMessageVariant } from './error-message';

@Component({
  imports: [ErrorMessage],
  template: `
    <app-error-message [message]="message()" [variant]="variant()" [details]="details()" />
  `,
})
class HostComponent {
  // Signals, not plain fields: the app is zoneless, so a plain mutation would
  // never mark the view dirty and the rerender assertions would read stale DOM.
  readonly message = signal('Username is required');
  readonly variant = signal<ErrorMessageVariant>('inline');
  readonly details = signal<string[]>([]);
}

describe('ErrorMessage', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  const el = () => fixture.nativeElement as HTMLElement;

  it('should render the message inline by default', () => {
    const small = el().querySelector('small');
    expect(small?.textContent?.trim()).toBe('Username is required');
    expect(small?.classList).toContain('text-danger');
    expect(el().querySelector('p')).toBeNull();
  });

  it('should update when the message changes', async () => {
    host.message.set('Enter a valid email');
    await fixture.whenStable();

    expect(el().textContent?.trim()).toBe('Enter a valid email');
  });

  it('should render the banner variant without a list when there are no details', async () => {
    host.variant.set('banner');
    host.message.set('Sign in failed.');
    await fixture.whenStable();

    expect(el().querySelector('p')?.textContent?.trim()).toBe('Sign in failed.');
    expect(el().querySelector('ul')).toBeNull();
  });

  it('should list the details under a banner', async () => {
    host.variant.set('banner');
    host.message.set('Registration failed.');
    host.details.set(['Username already taken', 'Email already taken']);
    await fixture.whenStable();

    const items = Array.from(el().querySelectorAll('li')).map((li) => li.textContent?.trim());
    expect(items).toEqual(['Username already taken', 'Email already taken']);
  });

  it('should ignore details in the inline variant', async () => {
    host.details.set(['Username already taken']);
    await fixture.whenStable();

    expect(el().querySelector('li')).toBeNull();
  });
});
