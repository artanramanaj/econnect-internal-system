import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateTesting } from '../../core/i18n/translate.testing';
import { CodeLabelPipe } from './code-label.pipe';

@Component({
  imports: [CodeLabelPipe],
  template: `<span>{{ code() | codeLabel: namespace() : name() }}</span>`,
})
class HostComponent {
  // Signals, not plain fields: the app is zoneless.
  readonly code = signal<string | null>('pcs');
  readonly namespace = signal('units');
  readonly name = signal<string | null>('Pieces (server)');
}

describe('CodeLabelPipe', () => {
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

  const text = () => (fixture.nativeElement as HTMLElement).textContent?.trim();

  it('should prefer the translation over the name the server stored', () => {
    expect(text()).toBe('Pieces');
  });

  it('should translate a VAT code from its own namespace', async () => {
    host.namespace.set('vat');
    host.code.set('REDUCED');
    await fixture.whenStable();

    expect(text()).toBe('Reduced');
  });

  it('should fall back to the stored name for a code the files do not know', async () => {
    host.code.set('roll');
    host.name.set('Roll (305 m)');
    await fixture.whenStable();

    expect(text()).toBe('Roll (305 m)');
  });

  it('should fall back to the code itself when there is no name either', async () => {
    host.code.set('roll');
    host.name.set(null);
    await fixture.whenStable();

    expect(text()).toBe('roll');
  });

  it('should render a dash for no code', async () => {
    host.code.set(null);
    await fixture.whenStable();

    expect(text()).toBe('—');
  });
});
