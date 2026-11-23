import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateTesting } from '../../../core/i18n/translate.testing';
import { Pagination } from './pagination';

@Component({
  imports: [Pagination],
  template: `
    <app-pagination
      [page]="page()"
      [pageSize]="pageSize()"
      [total]="total()"
      (pageChange)="changed.push($event)"
    />
  `,
})
class HostComponent {
  // Signals, not plain fields: the app is zoneless, so a plain mutation would
  // never mark the view dirty and the rerender assertions would read stale DOM.
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly total = signal(45);
  readonly changed: number[] = [];
}

describe('Pagination', () => {
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
  const numbers = () =>
    Array.from(el().querySelectorAll<HTMLButtonElement>('button[aria-label^="Page "]'));
  const labels = () => numbers().map((b) => Number(b.textContent?.trim()));
  const button = (label: string) =>
    el().querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;

  it('should render nothing when everything fits on one page', async () => {
    host.total.set(10);
    await fixture.whenStable();

    expect(el().querySelector('nav')).toBeNull();
  });

  it('should render Previous, the page numbers and Next', () => {
    expect(button('Previous page')).toBeTruthy();
    expect(button('Next page')).toBeTruthy();
    expect(labels()).toEqual([1, 2, 3, 4, 5]);
  });

  it('should mark the current page', async () => {
    host.page.set(3);
    await fixture.whenStable();

    const current = numbers().filter((b) => b.getAttribute('aria-current') === 'page');
    expect(current.map((b) => b.textContent?.trim())).toEqual(['3']);
  });

  it('should disable Previous on the first page and Next on the last', async () => {
    expect(button('Previous page').disabled).toBe(true);
    expect(button('Next page').disabled).toBe(false);

    host.page.set(5);
    await fixture.whenStable();

    expect(button('Previous page').disabled).toBe(false);
    expect(button('Next page').disabled).toBe(true);
  });

  it('should slide the window around the current page and clamp at the end', async () => {
    host.total.set(95);
    host.page.set(4);
    await fixture.whenStable();
    expect(labels()).toEqual([2, 3, 4, 5, 6]);

    host.page.set(10);
    await fixture.whenStable();
    expect(labels()).toEqual([6, 7, 8, 9, 10]);
  });

  it('should show only as many numbers as there are pages', async () => {
    host.total.set(25);
    await fixture.whenStable();

    expect(labels()).toEqual([1, 2, 3]);
  });

  it('should emit the target page from Next, a number, and never the current page', () => {
    button('Next page').click();
    button('Page 4').click();
    button('Page 1').click();

    expect(host.changed).toEqual([2, 4]);
  });
});
