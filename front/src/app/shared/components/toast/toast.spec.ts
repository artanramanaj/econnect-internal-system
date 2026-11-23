import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Toast, ToastMessage } from './toast';
import { toastStub } from './toast.testing';

@Component({
  imports: [Toast],
  template: `<app-toast [message]="message()" />`,
})
class HostComponent {
  // Signals, not plain fields: the app is zoneless, so a plain mutation would
  // never mark the view dirty and the rerender assertions would read stale DOM.
  readonly message = signal<ToastMessage | null>(null);
}

describe('Toast', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let stub: ReturnType<typeof toastStub>;

  beforeEach(async () => {
    stub = toastStub();
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [stub.provider],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should not fire while the message is null', () => {
    expect(stub.calls).toEqual([]);
  });

  it('should fire a toast of the given type', async () => {
    host.message.set({ text: 'Details saved.', type: 'success' });
    await fixture.whenStable();
    host.message.set({ text: 'Check the dates.', type: 'warning' });
    await fixture.whenStable();

    expect(stub.calls).toEqual([
      ['success', 'Details saved.'],
      ['warning', 'Check the dates.'],
    ]);
  });

  it('should fire again for a new object with the same text', async () => {
    host.message.set({ text: 'Details saved.', type: 'success' });
    await fixture.whenStable();
    host.message.set({ text: 'Details saved.', type: 'success' });
    await fixture.whenStable();

    expect(stub.calls).toHaveLength(2);
  });

  it('should ignore an empty text', async () => {
    host.message.set({ text: '', type: 'success' });
    await fixture.whenStable();

    expect(stub.calls).toEqual([]);
  });

  it('should render nothing in place', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-toast')?.childNodes).toHaveLength(0);
  });
});
