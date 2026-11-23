import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrandPanel } from './brand-panel';

@Component({
  imports: [BrandPanel],
  template: `
    <app-brand-panel
      [eyebrow]="eyebrow()"
      [heading]="heading()"
      [description]="description()"
      [chipsLabel]="chipsLabel()"
      [chips]="chips()"
      [footnote]="footnote()"
      [showGraphic]="showGraphic()"
    />
  `,
})
class HostComponent {
  // Signals, not plain fields: the app is zoneless, so a plain mutation would
  // never mark the view dirty and the rerender assertions would read stale DOM.
  readonly eyebrow = signal('');
  readonly heading = signal('From the first quote');
  readonly description = signal('');
  readonly chipsLabel = signal('');
  readonly chips = signal<string[]>([]);
  readonly footnote = signal('');
  readonly showGraphic = signal(false);
}

describe('BrandPanel', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  const el = () => fixture.nativeElement as HTMLElement;

  it('should render the heading and the logo', () => {
    expect(el().querySelector('h1')?.textContent?.trim()).toBe('From the first quote');
    expect(el().querySelector('img')?.getAttribute('src')).toBe('/images/eConnect.webp');
  });

  it('should render one chip per entry', async () => {
    host.chips.set(['Access control', 'Fire alarm', 'IT & networking']);
    await fixture.whenStable();

    const chips = Array.from(el().querySelectorAll('li')).map((li) => li.textContent?.trim());
    expect(chips).toEqual(['Access control', 'Fire alarm', 'IT & networking']);
  });

  it('should omit the optional blocks by default', () => {
    // eyebrow, description, footnote and the graphic are all unset.
    expect(el().querySelectorAll('p')).toHaveLength(0);
    expect(el().querySelector('svg')).toBeNull();
    expect(el().querySelectorAll('li')).toHaveLength(0);
  });

  it('should render the optional blocks once supplied', async () => {
    host.eyebrow.set('Quote & project management');
    host.description.set('Price security and IT systems.');
    host.footnote.set('eConnect · System integrator');
    host.showGraphic.set(true);
    await fixture.whenStable();

    const text = el().textContent ?? '';
    expect(text).toContain('Quote & project management');
    expect(text).toContain('Price security and IT systems.');
    expect(text).toContain('eConnect · System integrator');
    expect(el().querySelector('svg')).toBeTruthy();
  });
});
