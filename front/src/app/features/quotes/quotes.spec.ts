import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateTesting } from '../../core/i18n/translate.testing';
import { QuoteOptions, QuoteRow } from '../../core/models/quote.model';
import { AuthService } from '../../core/services/auth.service';
import { Quotes } from './quotes';

const META = { page: 1, pageSize: 10, total: 1, totalPages: 1 };

const ROW: QuoteRow = {
  id: 3,
  quoteNumber: 'EC-2026-0003',
  title: 'Warehouse CCTV',
  label: null,
  status: 'DRAFT',
  createdAt: '2026-11-25T09:00:00.000Z',
  partner: { id: 1, partnerNumber: 'P-0001', legalName: 'Northgate Logistics Sh.p.k.', tradeName: 'Northgate Logistics', city: 'Prishtinë' },
  createdBy: { id: 1, name: 'Artan Ramanaj' },
  version: '1.0',
  revisionCount: 1,
  subtotal: '1320.00',
  grandTotal: '1557.60',
  approvalStatus: 'NOT_REQUIRED',
  overallMarkupPct: '34.1463',
};

const OPTIONS: QuoteOptions = {
  authors: [{ id: 1, name: 'Artan Ramanaj' }],
  units: [{ code: 'pcs', name: 'Pieces' }],
  vatRates: [{ code: 'STANDARD', name: 'Standard rate', rate: '18.00' }],
  minMarkupPct: '10.00',
  editableStatuses: ['DRAFT', 'PENDING_APPROVAL', 'READY_TO_SEND'],
  canViewCost: true,
  canApprove: false,
};

const USER = {
  id: 1,
  username: 'artan',
  email: 'artan@econnect-ks.com',
  status: 'ACTIVE',
  // The same as nothing-stored's default, so signing in never PATCHes a locale.
  locale: 'sq',
  createdAt: '',
  lastLoginAt: null,
  roles: ['user'],
  employee: null,
};

describe('Quotes', () => {
  let component: Quotes;
  let fixture: ComponentFixture<Quotes>;
  let httpMock: HttpTestingController;

  const list = (body: object = { quotes: [ROW], statusCounts: { ALL: 1, DRAFT: 1 }, canViewCost: true, meta: META }) =>
    httpMock.expectOne((r) => r.url === '/api/quotes').flush(body);

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Quotes],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateTesting(),
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Quotes);
    component = fixture.componentInstance;

    // The constructor loads the first page, the options and the client filter.
    list();
    httpMock.expectOne('/api/quotes/options').flush(OPTIONS);
    httpMock.expectOne((r) => r.url === '/api/partners').flush({ partners: [], meta: META });
    await fixture.whenStable();
  });

  afterEach(() => httpMock.verify());

  const el = () => fixture.nativeElement as HTMLElement;

  it('should load the newest quotes first, ten at a time', () => {
    component.onPage(1);
    const request = httpMock.expectOne((r) => r.url === '/api/quotes');
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('pageSize')).toBe('10');
    expect(request.request.params.get('sortBy')).toBe('createdAt');
    expect(request.request.params.get('sortDir')).toBe('desc');
    expect(request.request.params.has('status')).toBe(false);
    request.flush({ quotes: [], statusCounts: {}, canViewCost: true, meta: META });
  });

  it('should render the loaded rows', () => {
    expect(el().textContent).toContain('EC-2026-0003');
    expect(el().textContent).toContain('Northgate Logistics');
  });

  it('should refetch with a status view, keeping the search and going to page 1', () => {
    component.onSearch('cctv');
    component.onFilter({ status: 'PENDING_APPROVAL' });

    const request = httpMock.expectOne((r) => r.url === '/api/quotes');
    expect(request.request.params.get('q')).toBe('cctv');
    expect(request.request.params.get('status')).toBe('PENDING_APPROVAL');
    expect(request.request.params.get('page')).toBe('1');
    request.flush({ quotes: [], statusCounts: {}, canViewCost: true, meta: META });
  });

  it('should send the client, author, date range and sort it was given', () => {
    component.onFilter({ partnerId: '2', createdById: '5', dateFrom: '2026-11-01', dateTo: '2026-11-30' });
    httpMock.expectOne((r) => r.url === '/api/quotes').flush({ quotes: [], statusCounts: {}, canViewCost: true, meta: META });

    component.onSort({ sortBy: 'title', sortDir: 'asc' });
    const request = httpMock.expectOne((r) => r.url === '/api/quotes');
    expect(request.request.params.get('partnerId')).toBe('2');
    expect(request.request.params.get('createdById')).toBe('5');
    expect(request.request.params.get('dateFrom')).toBe('2026-11-01');
    expect(request.request.params.get('dateTo')).toBe('2026-11-30');
    expect(request.request.params.get('sortBy')).toBe('title');
    expect(request.request.params.get('sortDir')).toBe('asc');
    request.flush({ quotes: [], statusCounts: {}, canViewCost: true, meta: META });
  });

  it('should drop the response of an older load when a newer one starts', () => {
    component.onFilter({ status: 'DRAFT' });
    component.onPage(2);

    const [first, second] = httpMock.match((r) => r.url === '/api/quotes');
    expect(first.cancelled).toBe(true);
    expect(second.request.params.get('page')).toBe('2');
    second.flush({ quotes: [], statusCounts: {}, canViewCost: true, meta: { ...META, page: 2 } });
  });

  it('should show a failed load on the page', async () => {
    component.onPage(1);
    httpMock
      .expectOne((r) => r.url === '/api/quotes')
      .flush({ message: 'Invalid search filters or page.' }, { status: 400, statusText: 'Bad Request' });
    await fixture.whenStable();

    expect(el().textContent).toContain('Invalid search filters or page.');
  });

  it('should offer New quote only to someone who may write quotes', async () => {
    expect(el().querySelector('a[href="/quotes/new"]')).toBeNull();

    TestBed.inject(AuthService).me().subscribe();
    httpMock.expectOne('/api/auth/me').flush({
      user: USER,
      permissions: ['quote.manage', 'quote.view_cost'].map((code) => ({ code, scope: 'ALL' })),
    });
    await fixture.whenStable();

    expect(el().querySelector('a[href="/quotes/new"]')).toBeTruthy();
  });
});
