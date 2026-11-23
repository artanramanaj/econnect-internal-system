import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NavLink } from './nav-link';

@Component({
  imports: [NavLink],
  template: `
    <app-nav-link [link]="link()" [extraClasses]="extraClasses()">Projects</app-nav-link>
  `,
})
class HostComponent {
  // Signals, not plain fields: the app is zoneless, so a plain mutation would
  // never mark the view dirty and the rerender assertions would read stale DOM.
  readonly link = signal<string | unknown[]>('/projects');
  readonly extraClasses = signal('');
}

describe('NavLink', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
  });

  const anchor = () => (fixture.nativeElement as HTMLElement).querySelector('a')!;

  it('should render the projected label', () => {
    expect(anchor().textContent?.trim()).toBe('Projects');
  });

  it('should resolve a string link to an href', () => {
    expect(anchor().getAttribute('href')).toBe('/projects');
  });

  it('should resolve a commands array to an href', async () => {
    fixture.componentInstance.link.set(['/projects', 42]);
    await fixture.whenStable();
    expect(anchor().getAttribute('href')).toBe('/projects/42');
  });

  it('should apply the base classes', () => {
    expect(anchor().className).toContain('px-4');
    expect(anchor().className).toContain('hover:bg-white/10');
  });

  it('should append extra classes without dropping the base ones', async () => {
    fixture.componentInstance.extraClasses.set('uppercase');
    await fixture.whenStable();
    expect(anchor().className).toContain('uppercase');
    expect(anchor().className).toContain('rounded-lg');
  });
});
