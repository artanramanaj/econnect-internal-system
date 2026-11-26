import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTranslateTesting } from '../../../core/i18n/translate.testing';
import { CatalogueHit, QuoteDetail, QuoteOptions, RevisionHead } from '../../../core/models/quote.model';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { QuoteEditor } from './quote-editor';

const OPTIONS: QuoteOptions = {
  authors: [],
  units: [
    { code: 'hr', name: 'Hours' },
    { code: 'm', name: 'Metres' },
    { code: 'pcs', name: 'Pieces' },
  ],
  vatRates: [
    { code: 'STANDARD', name: 'Standard rate', rate: '18.00' },
    { code: 'REDUCED', name: 'Reduced rate', rate: '8.00' },
  ],
  minMarkupPct: '10.00',
  editableStatuses: ['DRAFT', 'PENDING_APPROVAL', 'READY_TO_SEND'],
  canViewCost: true,
  canApprove: true,
};

const PARTNER = {
  id: 1,
  partnerNumber: 'P-0001',
  legalName: 'Northgate Logistics Sh.p.k.',
  tradeName: 'Northgate Logistics',
  fiscalNumber: '600112233',
  city: 'Prishtinë',
  email: null,
  phone: null,
  paymentTerms: '50% advance, 50% on completion',
  isCustomer: true,
  isSupplier: false,
};

const CAMERA: CatalogueHit = {
  id: 11,
  sku: 'CAM-IPD4-28',
  description: 'IP dome camera 4 MP',
  type: 'PRODUCT',
  baseUnitCode: 'pcs',
  vatCode: 'STANDARD',
  vatRate: '18.00',
  category: 'IP Camera System',
  hasBrochure: false,
  costPrice: '72.0000',
};

/** Me: user 1. The quote below was saved by user 5 unless a test says otherwise. */
const USER = {
  id: 1,
  username: 'artan',
  email: 'artan@econnect-ks.com',
  status: 'ACTIVE',
  // The same as nothing-stored's default, so signing in never PATCHes a locale.
  locale: 'sq',
  createdAt: '',
  lastLoginAt: null,
  roles: ['super_admin'],
  employee: null,
};

function revisionHead(overrides: Partial<RevisionHead> = {}): RevisionHead {
  return {
    id: 70,
    version: '1.0',
    kind: 'NORMAL',
    isCurrent: true,
    isLocked: false,
    subtotal: '1080.00',
    vatTotal: '194.40',
    grandTotal: '1274.40',
    approvalStatus: 'NOT_REQUIRED',
    approvedBy: null,
    approvedAt: null,
    rejectionNote: null,
    createdBy: { id: 5, name: 'Driton Morina' },
    createdAt: '2026-11-25T09:00:00.000Z',
    totalCost: '864.00',
    overallMarkupPct: '25.0000',
    ...overrides,
  };
}

function quote(overrides: Partial<QuoteDetail> = {}, revision: Partial<RevisionHead> = {}): QuoteDetail {
  return {
    id: 7,
    quoteNumber: 'EC-2026-0007',
    title: 'Warehouse CCTV',
    label: null,
    status: 'DRAFT',
    validUntil: '2026-12-31',
    paymentTerms: '30 days after invoice',
    notes: 'Delivery in 14 days.',
    version: 3,
    createdAt: '2026-11-25T09:00:00.000Z',
    updatedAt: '2026-11-25T09:00:00.000Z',
    partner: { id: 1, partnerNumber: 'P-0001', legalName: PARTNER.legalName, tradeName: PARTNER.tradeName, city: PARTNER.city },
    site: { id: 9, name: 'Main warehouse' },
    createdBy: { id: 5, name: 'Driton Morina' },
    revisionCount: 1,
    revision: {
      ...revisionHead(revision),
      vatBreakdown: [{ rate: '18.00', base: '1080.00', vat: '194.40' }],
      lines: [
        {
          id: 501,
          sortOrder: 1,
          section: 'CCTV',
          kind: 'PRODUCT',
          itemId: 11,
          sku: 'CAM-IPD4-28',
          description: 'IP dome camera 4 MP',
          unitCode: 'pcs',
          quantity: '12.0000',
          unitCost: '72.0000',
          markupPct: '25.0000',
          unitPrice: '90.0000',
          lineCost: '864.00',
          lineTotal: '1080.00',
          vatCode: 'STANDARD',
          vatRate: '18.00',
        },
      ],
    },
    ...overrides,
  };
}

describe('QuoteEditor', () => {
  let harness: RouterTestingHarness;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'quotes', children: [] },
          { path: 'quotes/new', component: QuoteEditor },
          { path: 'quotes/:id', component: QuoteEditor },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateTesting(),
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);

    // A session that may write quotes and see cost.
    TestBed.inject(AuthService).me().subscribe();
    httpMock.expectOne('/api/auth/me').flush({
      user: USER,
      permissions: ['quote.manage', 'quote.view_cost', 'quote.approve'].map((code) => ({ code, scope: 'ALL' })),
    });

    harness = await RouterTestingHarness.create();
  });

  afterEach(() => httpMock.verify());

  const el = () => harness.routeNativeElement as HTMLElement;
  const text = () => (el().textContent ?? '').replace(/\s+/g, ' ');
  const toast = () => TestBed.inject(ToastService).current();
  const button = (label: string) =>
    Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.trim() === label);
  const stable = () => harness.fixture.whenStable();

  /** Opens /quotes/new and answers what a blank editor loads. */
  const openNew = async (options: QuoteOptions = OPTIONS) => {
    const component = await harness.navigateByUrl('/quotes/new', QuoteEditor);
    httpMock.expectOne('/api/quotes/options').flush(options);
    httpMock.expectOne((r) => r.url === '/api/partners').flush({ partners: [PARTNER], meta: {} });
    await stable();
    return component;
  };

  /** Answers what showing a saved quote loads after the quote itself. */
  const flushAround = (id: number, revisions: RevisionHead[] = [revisionHead()]) => {
    httpMock.expectOne('/api/partners/1/sites').flush({ sites: [{ id: 9, name: 'Main warehouse', address: null, city: 'Prishtinë' }] });
    httpMock.expectOne(`/api/quotes/${id}/revisions`).flush({ revisions });
  };

  /** Opens /quotes/7 on the given quote. */
  const openSaved = async (detail: QuoteDetail = quote(), options: QuoteOptions = OPTIONS) => {
    const component = await harness.navigateByUrl(`/quotes/${detail.id}`, QuoteEditor);
    httpMock.expectOne('/api/quotes/options').flush(options);
    httpMock.expectOne(`/api/quotes/${detail.id}`).flush({ quote: detail, canViewCost: true });
    flushAround(detail.id);
    await stable();
    return component;
  };

  describe('a new quote', () => {
    it('should start blank, with the number promised for the save', async () => {
      const component = await openNew();

      expect(text()).toContain('New quote');
      expect(text()).toContain('The quote number is assigned when you save.');
      expect(component.editable()).toBe(true);
      expect(button('Save quote')).toBeTruthy();
      expect(component.lines.length).toBe(0);
    });

    it('should not save without a client and a project name, and say so', async () => {
      const component = await openNew();

      component.save();
      await stable();

      httpMock.expectNone('/api/quotes');
      expect(text()).toContain('Please correct the highlighted fields.');
      expect(text()).toContain('Choose a client');
      expect(text()).toContain('Project name must be at least 2 characters');
    });

    it('should load the picked client’s sites and adopt its payment terms', async () => {
      const component = await openNew();

      component.form.controls.partnerId.setValue('1');
      component.onPartnerPicked('1');
      httpMock.expectOne('/api/partners/1/sites').flush({ sites: [{ id: 9, name: 'Main warehouse', address: null, city: null }] });

      expect(component.sites()).toHaveLength(1);
      expect(component.form.controls.paymentTerms.value).toBe('50% advance, 50% on completion');
    });

    it('should add a new client from the inline form and pick it', async () => {
      const component = await openNew();

      component.createPartner({ legalName: 'Arena Business Center Sh.p.k.' });
      const post = httpMock.expectOne('/api/partners');
      expect(post.request.method).toBe('POST');
      post.flush({ message: '"Arena Business Center Sh.p.k." added.', partner: { ...PARTNER, id: 6, partnerNumber: 'P-0006', legalName: 'Arena Business Center Sh.p.k.', tradeName: null, paymentTerms: null } });
      httpMock.expectOne('/api/partners/6/sites').flush({ sites: [] });

      expect(component.form.controls.partnerId.value).toBe('6');
      expect(component.partners()[0].partnerNumber).toBe('P-0006');
      expect(toast()).toEqual({ text: '"Arena Business Center Sh.p.k." added.', type: 'success' });
    });

    it('should keep lines of a section together and total them live', async () => {
      const component = await openNew();

      component.addFromCatalogue({ hit: CAMERA, section: 'CCTV' });
      component.addFreeLine('Labour');
      component.addFromCatalogue({ hit: { ...CAMERA, id: 12, sku: 'NVR-32P16', costPrice: '480.0000' }, section: 'CCTV' });
      await stable();

      // The second CCTV line went after the first, before Labour.
      expect(component.lines.controls.map((l) => l.controls.section.value)).toEqual(['CCTV', 'CCTV', 'Labour']);
      expect(component.sectionNames()).toEqual(['CCTV', 'Labour']);

      // 86.40 + 576.00; the unfinished free line is not counted yet.
      expect(component.preview().subtotal.toFixed(2)).toBe('662.40');
      expect(component.willNeedApproval()).toBe(false);

      component.lines.at(0).controls.quantity.setValue('10');
      await stable();
      expect(component.preview().subtotal.toFixed(2)).toBe('1440.00');
    });

    /** One camera at 75 against a cost of 72: (75 − 72) / 72 = 4.2%. */
    const addThinLine = async (component: QuoteEditor) => {
      component.addFromCatalogue({ hit: CAMERA, section: '' });
      const line = component.lines.at(0);
      line.controls.unitPrice.setValue('75');
      line.controls.basis.setValue('PRICE');
      await stable();
    };

    it('should warn someone who may not approve that a thin quote will need approval', async () => {
      const component = await openNew({ ...OPTIONS, canApprove: false });
      await addThinLine(component);

      expect(component.willNeedApproval()).toBe(true);
      expect(text()).toContain('saving will send this quote for approval');
    });

    it('should only warn an approver that a thin quote is below the minimum', async () => {
      const component = await openNew();
      await addThinLine(component);

      // Their own save is not held for a second approver.
      expect(component.willNeedApproval()).toBe(false);
      expect(text()).toContain('Overall markup is below the 10.00% minimum.');
      expect(text()).not.toContain('saving will send this quote for approval');
    });

    it('should show a save below the minimum as a warning', async () => {
      const component = await openNew();
      component.form.controls.partnerId.setValue('1');
      component.form.controls.title.setValue('Warehouse CCTV');
      await addThinLine(component);

      component.save();
      const message = 'Quote EC-2026-0008 saved as version 1.0. Note: its overall markup of 4.17% is below the 10% minimum.';
      httpMock.expectOne('/api/quotes').flush({
        message,
        lowMarkup: true,
        quote: quote({ id: 8, quoteNumber: 'EC-2026-0008' }, { approvalStatus: 'APPROVED', approvedBy: { id: 1, name: 'artan' } }),
      });
      await stable();

      expect(toast()).toEqual({ text: message, type: 'warning' });

      httpMock.expectOne('/api/quotes/options').flush(OPTIONS);
      httpMock.expectOne('/api/quotes/8').flush({ quote: quote({ id: 8, quoteNumber: 'EC-2026-0008' }), canViewCost: true });
      flushAround(8);
    });

    it('should create the quote, then move to its own address', async () => {
      const component = await openNew();
      component.form.controls.partnerId.setValue('1');
      component.form.controls.title.setValue('  Warehouse CCTV ');
      component.form.controls.validUntil.setValue('2026-12-31');
      component.addFromCatalogue({ hit: CAMERA, section: 'CCTV' });

      component.save();

      const post = httpMock.expectOne('/api/quotes');
      expect(post.request.method).toBe('POST');
      expect(post.request.body).toEqual({
        partnerId: 1,
        siteId: null,
        title: 'Warehouse CCTV',
        label: null,
        validUntil: '2026-12-31',
        paymentTerms: null,
        notes: null,
        lines: [
          {
            section: 'CCTV',
            kind: 'PRODUCT',
            itemId: 11,
            sku: 'CAM-IPD4-28',
            description: 'IP dome camera 4 MP',
            unitCode: 'pcs',
            // Amounts travel as text, never as numbers.
            quantity: '1',
            unitCost: '72.00',
            basis: 'MARKUP',
            markupPct: '20',
            unitPrice: '86.40',
            vatCode: 'STANDARD',
            vatRate: '18.00',
          },
        ],
      });

      post.flush({ message: 'Quote EC-2026-0008 created.', quote: quote({ id: 8, quoteNumber: 'EC-2026-0008' }) });
      await stable();

      expect(toast()).toEqual({ text: 'Quote EC-2026-0008 created.', type: 'success' });
      expect(TestBed.inject(Router).url).toBe('/quotes/8');

      // The editor at the new address loads the quote afresh.
      httpMock.expectOne('/api/quotes/options').flush(OPTIONS);
      httpMock.expectOne('/api/quotes/8').flush({ quote: quote({ id: 8, quoteNumber: 'EC-2026-0008' }), canViewCost: true });
      flushAround(8);
    });
  });

  /** What the line table actually renders, not what the form holds. */
  const renderedSkus = () =>
    Array.from(el().querySelectorAll('app-quote-lines tbody tr')).map(
      (row) => (row.textContent ?? '').replace(/\s+/g, ' '),
    );

  describe('rendering the lines (the table re-renders when the editor changes them)', () => {
    it('should show a saved quote’s lines when the options were already loaded', async () => {
      // The order of arrival when coming from the list: the options are in
      // first, then the quote fills the lines in place. Nothing the table
      // takes as input changes after that.
      await openSaved();

      // The code shows as fixed text only while the line is still linked to
      // its catalogue item.
      expect(renderedSkus().some((row) => row.includes('CAM-IPD4-28'))).toBe(true);
      expect(text()).not.toContain('No lines yet');
    });

    it('should show a line added from the catalogue search', async () => {
      const component = await openNew();
      expect(text()).toContain('No lines yet');

      component.addFromCatalogue({ hit: CAMERA, section: 'CCTV' });
      await stable();

      expect(renderedSkus().some((row) => row.includes('CAM-IPD4-28'))).toBe(true);
      expect(text()).not.toContain('No lines yet');
    });

    it('should show the client message when saving without one', async () => {
      const component = await openNew();

      component.save();
      await stable();

      // The picker's own message, not the "Choose a client…" placeholder option.
      expect(el().querySelector('app-partner-picker app-error-message')?.textContent).toContain(
        'Choose a client',
      );
    });
  });

  describe('a saved quote', () => {
    it('should show the quote, its version and its lines, with the client fixed', async () => {
      const component = await openSaved();

      expect(text()).toContain('EC-2026-0007');
      expect(text()).toContain('Version 1.0');
      expect(text()).toContain('Draft');
      expect(component.form.controls.title.value).toBe('Warehouse CCTV');
      expect(component.lines.length).toBe(1);
      expect(component.lines.at(0).controls.unitPrice.value).toBe('90.00');
      // No client dropdown: a quote's client cannot be changed.
      expect(el().querySelector('#quote-partner')).toBeNull();
      expect(text()).toContain('Northgate Logistics');
      expect(button('Save as new version')).toBeTruthy();
    });

    it('should save as the next version, sending the version it loaded', async () => {
      const component = await openSaved();
      component.lines.at(0).controls.quantity.setValue('14');

      component.save();

      const put = httpMock.expectOne('/api/quotes/7');
      expect(put.request.method).toBe('PUT');
      expect(put.request.body.version).toBe(3);
      expect(put.request.body).not.toHaveProperty('partnerId');
      expect(put.request.body.lines[0].quantity).toBe('14');
      // Still linked to its catalogue item after the form was reset on load.
      expect(put.request.body.lines[0].itemId).toBe(11);
      expect(put.request.body.lines[0].sku).toBe('CAM-IPD4-28');
      // An untouched price is sent as stored, so the total cannot drift.
      expect(put.request.body.lines[0].basis).toBe('PRICE');
      expect(put.request.body.lines[0].unitPrice).toBe('90.00');

      const saved = quote({ version: 4, revisionCount: 2 }, { id: 71, version: '1.1', subtotal: '1260.00' });
      put.flush({ message: 'Quote EC-2026-0007 saved as version 1.1.', quote: saved });
      flushAround(7, [revisionHead({ id: 71, version: '1.1' }), revisionHead({ isCurrent: false, isLocked: true })]);
      await stable();

      expect(toast()).toEqual({ text: 'Quote EC-2026-0007 saved as version 1.1.', type: 'success' });
      expect(component.quote()?.version).toBe(4);
      expect(text()).toContain('Version 1.1');
      expect(component.revisions().map((r) => r.version)).toEqual(['1.1', '1.0']);
    });

    it('should show a refused save, such as a stale version, on the page', async () => {
      const component = await openSaved();

      component.save();
      httpMock.expectOne('/api/quotes/7').flush(
        { message: 'Someone else saved this quote in the meantime. Reload it and apply your changes again.' },
        { status: 409, statusText: 'Conflict' },
      );
      await stable();

      expect(text()).toContain('Someone else saved this quote in the meantime.');
      expect(toast()).toBeNull();
      expect(component.saving()).toBe(false);
    });

    it('should be read-only once the quote has gone to the client', async () => {
      const component = await openSaved(quote({ status: 'SENT' }));

      expect(component.editable()).toBe(false);
      expect(component.form.disabled).toBe(true);
      expect(button('Save as new version')).toBeUndefined();
      expect(el().querySelector('app-line-search')).toBeNull();
      expect(text()).toContain('This quote can no longer be edited here.');

      component.save();
      httpMock.expectNone('/api/quotes/7');
    });
  });

  describe('approval', () => {
    const pending = (createdById: number) =>
      quote(
        { status: 'PENDING_APPROVAL' },
        { approvalStatus: 'PENDING', overallMarkupPct: '4.1667', createdBy: { id: createdById, name: 'Someone' } },
      );

    it('should say why the quote is waiting, and offer the decision to another admin', async () => {
      const component = await openSaved(pending(5));

      expect(text()).toContain('the overall markup is 4.2%, below the minimum of 10.00%');
      expect(component.canDecide()).toBe(true);
      expect(button('Approve')).toBeTruthy();
      expect(button('Reject')).toBeTruthy();
    });

    it('should not offer the decision on a revision you saved yourself', async () => {
      const component = await openSaved(pending(1));

      expect(component.canDecide()).toBe(false);
      expect(button('Approve')).toBeUndefined();
      expect(text()).toContain('An administrator must approve or reject it.');
    });

    it('should not offer the decision without quote.approve', async () => {
      const component = await openSaved(pending(5), { ...OPTIONS, canApprove: false });

      expect(component.canDecide()).toBe(false);
      expect(button('Approve')).toBeUndefined();
    });

    it('should approve and show the quote as ready to send', async () => {
      const component = await openSaved(pending(5));

      button('Approve')?.click();
      const post = httpMock.expectOne('/api/quotes/7/approve');
      expect(post.request.method).toBe('POST');
      post.flush({
        message: 'Quote EC-2026-0007 approved.',
        quote: quote({ status: 'READY_TO_SEND', version: 4 }, { approvalStatus: 'APPROVED', approvedBy: { id: 1, name: 'artan' } }),
      });
      flushAround(7);
      await stable();

      expect(toast()).toEqual({ text: 'Quote EC-2026-0007 approved.', type: 'success' });
      expect(component.quote()?.status).toBe('READY_TO_SEND');
      expect(text()).toContain('Ready to send');
      expect(button('Approve')).toBeUndefined();
    });

    it('should ask for a note before rejecting', async () => {
      const component = await openSaved(pending(5));

      button('Reject')?.click();
      await stable();
      button('Reject quote')?.click();
      await stable();
      httpMock.expectNone('/api/quotes/7/reject');
      expect(text()).toContain('Say why the quote is rejected');

      component.rejectNote.setValue(' Margin too thin ');
      button('Reject quote')?.click();
      const post = httpMock.expectOne('/api/quotes/7/reject');
      expect(post.request.body).toEqual({ note: 'Margin too thin' });
      post.flush({
        message: 'Quote EC-2026-0007 sent back to draft.',
        quote: quote({ status: 'DRAFT', version: 4 }, { approvalStatus: 'REJECTED', approvedBy: { id: 1, name: 'artan' }, rejectionNote: 'Margin too thin' }),
      });
      flushAround(7);
      await stable();

      expect(component.quote()?.status).toBe('DRAFT');
      expect(text()).toContain('Rejected by artan');
      expect(text()).toContain('Margin too thin');
    });
  });
});
