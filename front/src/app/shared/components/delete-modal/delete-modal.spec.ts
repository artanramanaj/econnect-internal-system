import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateTesting } from '../../../core/i18n/translate.testing';
import { DeleteModal } from './delete-modal';

@Component({
  imports: [DeleteModal],
  template: `
    <button id="opener" type="button">Open</button>
    @if (open()) {
      <app-delete-modal
        [heading]="heading()"
        [message]="message()"
        (cancel)="events.push('cancel'); open.set(false)"
        (confirm)="events.push('confirm'); open.set(false)"
      />
    }
  `,
})
class HostComponent {
  // Signals, not plain fields: the app is zoneless, so a plain mutation would
  // never mark the view dirty and the assertions would read stale DOM.
  readonly open = signal(false);
  readonly heading = signal('Delete position?');
  readonly message = signal('"Installer" will be permanently deleted.');
  readonly events: string[] = [];
}

describe('DeleteModal', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideTranslateTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const dialog = () => el().querySelector<HTMLElement>('[role="alertdialog"]');
  const button = (label: string) =>
    Array.from(el().querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === label || b.getAttribute('aria-label') === label,
    );

  const show = async () => {
    host.open.set(true);
    await fixture.whenStable();
  };

  it('should show the heading and message it is given, wired up for screen readers', async () => {
    await show();

    const box = dialog()!;
    expect(box.getAttribute('aria-modal')).toBe('true');
    expect(el().querySelector(`#${box.getAttribute('aria-labelledby')}`)?.textContent).toBe(
      'Delete position?',
    );
    expect(el().querySelector(`#${box.getAttribute('aria-describedby')}`)?.textContent).toBe(
      '"Installer" will be permanently deleted.',
    );
  });

  it('should follow its inputs when the parent changes them', async () => {
    await show();
    host.heading.set('Delete brand?');
    await fixture.whenStable();

    expect(dialog()?.textContent).toContain('Delete brand?');
  });

  it('should emit confirm from the Delete button only', async () => {
    await show();
    button('Delete')!.click();
    await fixture.whenStable();

    expect(host.events).toEqual(['confirm']);
    expect(dialog()).toBeNull();
  });

  it('should emit cancel from Cancel, the ✕, the backdrop and Escape', async () => {
    await show();
    button('Cancel')!.click();
    await fixture.whenStable();

    await show();
    button('Close')!.click();
    await fixture.whenStable();

    await show();
    el().querySelector<HTMLElement>('[aria-hidden="true"].absolute')!.click();
    await fixture.whenStable();

    await show();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();

    expect(host.events).toEqual(['cancel', 'cancel', 'cancel', 'cancel']);
  });

  it('should not react to Escape once it is closed', async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(host.events).toEqual([]);
  });

  it('should start on Cancel and hand focus back to the opener on close', async () => {
    const opener = el().querySelector<HTMLButtonElement>('#opener')!;
    opener.focus();

    await show();
    expect(document.activeElement).toBe(button('Cancel'));

    button('Cancel')!.click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(opener);
  });
});
