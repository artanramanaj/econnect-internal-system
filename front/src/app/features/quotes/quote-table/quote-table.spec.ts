import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateTesting } from '../../../core/i18n/translate.testing';
import { QuoteRow } from '../../../core/models/quote.model';
import { QuoteFilters, QuoteSort, QuoteTable } from './quote-table';

const ROWS: QuoteRow[] = [
  {
    id: 3,
    quoteNumber: 'EC-2026-0003',
    title: 'Warehouse CCTV',
    label: null,
    status: 'PENDING_APPROVAL',
    createdAt: '2026-11-25T09:00:00.000Z',
    partner: { id: 1, partnerNumber: 'P-0001', legalName: 'Northgate Logistics Sh.p.k.', tradeName: 'Northgate Logistics', city: 'Prishtinë' },
    createdBy: { id: 1, name: 'Artan Ramanaj' },
    version: '1.2',
    revisionCount: 3,
    subtotal: '12276.00',
    grandTotal: '14485.68',
    approvalStatus: 'PENDING',
    overallMarkupPct: '7.5000',
  },
  {
    id: 2,
    quoteNumber: 'EC-2026-0002',
    title: 'Fire alarm — east wing',
    label: null,
    status: 'DRAFT',
    createdAt: '2026-11-24T09:00:00.000Z',
    partner: { id: 2, partnerNumber: 'P-0002', legalName: 'Blue River Hotel Sh.p.k.', tradeName: null, city: 'Prizren' },
    createdBy: { id: 5, name: 'Driton Morina' },
    version: '1.0',
    revisionCount: 1,
    subtotal: '21480.50',
    grandTotal: '25346.99',
    approvalStatus: 'NOT_REQUIRED',
    overallMarkupPct: '19.4000',
  },
];

describe('QuoteTable', () => {
  let component: QuoteTable;
  let fixture: ComponentFixture<QuoteTable>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [QuoteTable],
      // Rows link to the editor; dates and money read LanguageService, which
      // injects AuthService, which injects HttpClient at construction.
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(QuoteTable);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('quotes', ROWS);
    fixture.componentRef.setInput('meta', { page: 1, pageSize: 10, total: 2, totalPages: 1 });
    fixture.componentRef.setInput('statusCounts', { ALL: 2, DRAFT: 1, PENDING_APPROVAL: 1 });
    fixture.componentRef.setInput('canViewCost', true);
    fixture.componentRef.setInput('minMarkupPct', '10.00');
    await fixture.whenStable();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const rows = () => Array.from(el().querySelectorAll('tbody tr'));
  const text = (node: Element) => (node.textContent ?? '').replace(/\s+/g, ' ');
  const headers = () => Array.from(el().querySelectorAll('th')).map((th) => text(th).trim());

  it('should render one row per quote, with its version indicator and link', () => {
    expect(rows()).toHaveLength(2);

    const first = text(rows()[0]);
    expect(first).toContain('EC-2026-0003');
    expect(first).toContain('Version 1.2 · 3 versions');
    expect(first).toContain('Northgate Logistics');
    expect(first).toContain('Warehouse CCTV');
    expect(first).toContain('Pending approval');
    expect(rows()[0].querySelector('a')?.getAttribute('href')).toBe('/quotes/3');

    // One version is singular; no trade name falls back to the legal name.
    const second = text(rows()[1]);
    expect(second).toContain('Version 1.0 · 1 version');
    expect(second).not.toContain('1 versions');
    expect(second).toContain('Blue River Hotel Sh.p.k.');
  });

  it('should show the markup only with cost access, and flag one below the minimum', async () => {
    expect(headers()).toContain('Markup');
    const low = Array.from(rows()[0].querySelectorAll('td')).find((td) => text(td).includes('7.5%'));
    expect(low?.classList.contains('text-danger')).toBe(true);
    const fine = Array.from(rows()[1].querySelectorAll('td')).find((td) => text(td).includes('19.4%'));
    expect(fine?.classList.contains('text-danger')).toBe(false);

    fixture.componentRef.setInput('canViewCost', false);
    await fixture.whenStable();
    expect(headers()).not.toContain('Markup');
  });

  it('should offer the status views with their counts and emit the picked one', () => {
    const changes: Partial<QuoteFilters>[] = [];
    component.filterChange.subscribe((change) => changes.push(change));

    const views = Array.from(el().querySelectorAll('aside button'));
    expect(text(views[0]).trim()).toMatch(/^All quotes\s*2$/);
    const pending = views.find((b) => text(b).includes('Pending approval')) as HTMLButtonElement;
    expect(text(pending)).toContain('1');
    // A status nobody has shows zero rather than nothing.
    expect(text(views.find((b) => text(b).includes('Accepted'))!)).toContain('0');

    pending.click();
    (views[0] as HTMLButtonElement).click();
    expect(changes).toEqual([{ status: 'PENDING_APPROVAL' }, { status: '' }]);
  });

  it('should emit a trimmed search term and each filter by its field', () => {
    const terms: string[] = [];
    const changes: Partial<QuoteFilters>[] = [];
    component.search.subscribe((term) => terms.push(term));
    component.filterChange.subscribe((change) => changes.push(change));

    const search = el().querySelector('input[type="search"]') as HTMLInputElement;
    search.value = '  cctv ';
    search.dispatchEvent(new Event('input'));

    const from = el().querySelector('input[type="date"]') as HTMLInputElement;
    from.value = '2026-11-01';
    from.dispatchEvent(new Event('change'));

    expect(terms).toEqual(['cctv']);
    expect(changes).toEqual([{ dateFrom: '2026-11-01' }]);
  });

  it('should sort by a clicked header and flip on a second click', async () => {
    const sorts: QuoteSort[] = [];
    component.sortChange.subscribe((sort) => sorts.push(sort));
    const header = (label: string) =>
      Array.from(el().querySelectorAll('th button')).find((b) => text(b).includes(label)) as HTMLButtonElement;

    header('Quote no.').click();
    expect(sorts).toEqual([{ sortBy: 'quoteNumber', sortDir: 'asc' }]);

    // The parent echoes the sort back; the same header then reverses it.
    fixture.componentRef.setInput('sort', { sortBy: 'quoteNumber', sortDir: 'asc' });
    await fixture.whenStable();
    header('Quote no.').click();
    expect(sorts[1]).toEqual({ sortBy: 'quoteNumber', sortDir: 'desc' });

    // The date starts newest first.
    header('Date').click();
    expect(sorts[2]).toEqual({ sortBy: 'createdAt', sortDir: 'desc' });
  });

  it('should page only when there is more than one page', async () => {
    expect(el().querySelector('app-pagination nav')).toBeNull();

    fixture.componentRef.setInput('meta', { page: 1, pageSize: 10, total: 25, totalPages: 3 });
    await fixture.whenStable();

    const pages: number[] = [];
    component.pageChange.subscribe((page) => pages.push(page));
    (Array.from(el().querySelectorAll('app-pagination button')).find((b) => text(b).trim() === '2') as HTMLButtonElement).click();
    expect(pages).toEqual([2]);
  });

  it('should say when nothing matches', async () => {
    fixture.componentRef.setInput('quotes', []);
    await fixture.whenStable();
    expect(text(el().querySelector('tbody')!)).toContain('No quotes match these filters.');
  });
});
