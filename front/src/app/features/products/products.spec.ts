import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { provideTranslateTesting } from '../../core/i18n/translate.testing';
import { CatalogRef, ItemDetail, ItemOptions } from '../../core/models/item.model';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { Products } from './products';

const OPTIONS: ItemOptions = {
  units: [
    { code: 'box', name: 'Boxes' },
    { code: 'm', name: 'Metres' },
    { code: 'pcs', name: 'Pieces' },
  ],
  vatRates: [
    { code: 'STANDARD', name: 'Standard rate', rate: '18.00' },
    { code: 'REDUCED', name: 'Reduced rate', rate: '8.00' },
  ],
  categories: [
    { id: 1, name: 'Cameras' },
    { id: 2, name: 'Cables' },
  ],
  brands: [{ id: 5, name: 'Hikvision' }],
  manufacturers: ['Hikvision'],
  syncOwnedFields: [
    'sku',
    'description',
    'categoryId',
    'brandId',
    'manufacturer',
    'barcode',
    'baseUnitCode',
    'vatCode',
    'costPrice',
  ],
};

const META = { page: 1, pageSize: 10, total: 1, totalPages: 1 };
const REF_META = { page: 1, pageSize: 10, total: 2, totalPages: 1 };

const CATEGORIES: CatalogRef[] = [
  { id: 1, name: 'Cameras', itemCount: 1 },
  { id: 2, name: 'Cables', itemCount: 0 },
];
const BRANDS: CatalogRef[] = [{ id: 5, name: 'Hikvision', itemCount: 1 }];

function item(overrides: Partial<ItemDetail> = {}): ItemDetail {
  return {
    id: 7,
    sku: 'CAM-2041',
    description: 'IP camera 4MP dome',
    type: 'PRODUCT',
    source: 'LOCAL',
    category: { id: 1, name: 'Cameras' },
    brand: { id: 5, name: 'Hikvision' },
    manufacturer: 'Hikvision',
    barcode: null,
    baseUnitCode: 'pcs',
    vatCode: 'STANDARD',
    isArchived: false,
    sourceId: null,
    brochure: null,
    lastSyncedAt: null,
    updatedAt: '2026-11-24T09:00:00.000Z',
    costPrice: '84.5000',
    units: [{ unitCode: 'box', factor: '10.0000' }],
    costHistory: [
      {
        id: 1,
        oldCost: null,
        newCost: '84.5000',
        source: 'LOCAL',
        changedAt: '2026-11-24T09:00:00.000Z',
        changedBy: 'artan',
      },
    ],
    ...overrides,
  };
}

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

describe('Products', () => {
  let component: Products;
  let fixture: ComponentFixture<Products>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Products],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideTranslateTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Products);
    component = fixture.componentInstance;

    // The constructor loads the first page, the options and both ref lists.
    httpMock
      .expectOne((r) => r.url === '/api/items')
      .flush({ items: [item()], canViewCost: true, meta: META });
    httpMock.expectOne('/api/items/options').flush(OPTIONS);
    expectRefs();
    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const toast = () => TestBed.inject(ToastService).current();
  const drawer = () => el().querySelector('app-item-drawer');

  function expectRefs(): void {
    httpMock
      .expectOne((r) => r.url === '/api/categories')
      .flush({ categories: CATEGORIES, meta: REF_META });
    httpMock.expectOne((r) => r.url === '/api/brands').flush({ brands: BRANDS, meta: REF_META });
  }

  function expectOptions(): void {
    httpMock.expectOne('/api/items/options').flush(OPTIONS);
  }

  function expectListReload(): void {
    httpMock
      .expectOne((r) => r.url === '/api/items' && r.method === 'GET')
      .flush({ items: [], canViewCost: true, meta: { ...META, total: 0 } });
  }

  /** Resolves a session holding exactly these permission codes. */
  const signIn = async (codes: string[]) => {
    TestBed.inject(AuthService).me().subscribe();
    httpMock
      .expectOne('/api/auth/me')
      .flush({ user: USER, permissions: codes.map((code) => ({ code, scope: 'ALL' })) });
    await fixture.whenStable();
  };

  /** Opens the drawer on item 7, answering the detail read. */
  const openSeven = async (detail = item()) => {
    component.openItem(detail);
    httpMock.expectOne('/api/items/7').flush({ item: detail, canViewCost: true });
    await fixture.whenStable();
  };

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should ask for the first page of active items, 10 at a time', () => {
    component.onPage(1);
    const request = httpMock.expectOne((r) => r.url === '/api/items');
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('pageSize')).toBe('10');
    expect(request.request.params.get('status')).toBe('active');
    expect(request.request.params.has('type')).toBe(false);
    request.flush({ items: [], canViewCost: true, meta: META });
  });

  it('should render the loaded rows and both ref tables', () => {
    expect(component.items()).toHaveLength(1);
    expect(el().textContent).toContain('CAM-2041');
    expect(el().textContent).toContain('IP camera 4MP dome');
    expect(el().textContent).toContain('Categories');
    expect(el().textContent).toContain('Brands');
    expect(component.categories()).toHaveLength(2);
    expect(component.brands()).toHaveLength(1);
  });

  it('should refetch with a filter, keeping the search term and going to page 1', () => {
    component.onSearch('cam');
    component.onFilter({ type: 'SERVICE' });

    const request = httpMock.expectOne((r) => r.url === '/api/items');
    expect(request.request.params.get('q')).toBe('cam');
    expect(request.request.params.get('type')).toBe('SERVICE');
    expect(request.request.params.get('page')).toBe('1');
    request.flush({ items: [], canViewCost: true, meta: META });
    expect(component.filters().type).toBe('SERVICE');
  });

  it('should drop the response of an older load when a newer one starts', () => {
    component.onFilter({ brandId: '5' });
    component.onPage(2);

    const [first, second] = httpMock.match((r) => r.url === '/api/items');
    expect(first.cancelled).toBe(true);
    expect(second.request.params.get('page')).toBe('2');
    expect(second.request.params.get('brandId')).toBe('5');
    second.flush({ items: [], canViewCost: true, meta: { ...META, page: 2 } });
  });

  it('should show a failed list load on the page', async () => {
    component.onFilter({ status: 'archived' });
    httpMock
      .expectOne((r) => r.url === '/api/items')
      .flush({ message: 'Invalid search filters or page.' }, { status: 400, statusText: 'Bad Request' });
    await fixture.whenStable();

    expect(el().textContent).toContain('Invalid search filters or page.');
  });

  it('should hide the cost column when the server withholds cost', async () => {
    component.onPage(1);
    const { costPrice: _hidden, ...withoutCost } = item();
    httpMock
      .expectOne((r) => r.url === '/api/items')
      .flush({ items: [withoutCost], canViewCost: false, meta: META });
    await fixture.whenStable();

    const headers = Array.from(el().querySelectorAll('th')).map((th) => th.textContent?.trim());
    expect(headers).not.toContain('Cost');
  });

  it('should offer only viewing without catalog.manage', () => {
    expect(component.canManage()).toBe(false);
    expect(el().querySelector('app-add-item')).toBeNull();
    expect(el().textContent).toContain('View');
  });

  it('should offer the add card and Edit with catalog.manage', async () => {
    await signIn(['catalog.manage', 'quote.view_cost']);

    expect(component.canManage()).toBe(true);
    expect(el().querySelector('app-add-item')).toBeTruthy();
    expect(el().textContent).toContain('Add a product');
    expect(el().textContent).toContain('Edit');
  });

  it('should open an item on a fresh read', async () => {
    expect(drawer()).toBeNull();

    await openSeven();

    expect(component.editing()?.units).toEqual([{ unitCode: 'box', factor: '10.0000' }]);
    expect(drawer()).toBeTruthy();

    component.closeDrawer();
    await fixture.whenStable();
    expect(drawer()).toBeNull();
  });

  it('should create, toast, reset the card and reload the page, options and refs', async () => {
    await signIn(['catalog.manage', 'quote.view_cost']);
    component.submitAdd({
      item: {
        sku: 'CAB-UTP6',
        type: 'PRODUCT',
        description: 'UTP cable cat6',
        baseUnitCode: 'm',
        vatCode: 'STANDARD',
        costPrice: 0.45,
        units: [{ unitCode: 'box', factor: 305 }],
      },
      brochure: null,
    });

    const post = httpMock.expectOne('/api/items');
    expect(post.request.method).toBe('POST');
    expect(post.request.body.sku).toBe('CAB-UTP6');
    post.flush({ message: '"CAB-UTP6" added.', item: item({ id: 8, sku: 'CAB-UTP6' }) });
    expectListReload();
    expectOptions();
    expectRefs();
    await fixture.whenStable();

    expect(toast()).toEqual({ text: '"CAB-UTP6" added.', type: 'success' });
    expect(component.error()).toBeNull();
  });

  it('should attach the picked PDF right after the create', async () => {
    await signIn(['catalog.manage']);
    // A real File: the service puts it into FormData, which rejects fakes.
    const pdf = new File(['%PDF-'], 'datasheet.pdf', { type: 'application/pdf' });
    component.submitAdd({
      item: { sku: 'CAB-UTP6', type: 'PRODUCT', description: 'UTP cable cat6', baseUnitCode: 'm', vatCode: 'STANDARD' },
      brochure: pdf,
    });

    httpMock
      .expectOne('/api/items')
      .flush({ message: '"CAB-UTP6" added.', item: item({ id: 8, sku: 'CAB-UTP6' }) });

    const upload = httpMock.expectOne('/api/items/8/brochure');
    expect(upload.request.method).toBe('POST');
    expect(upload.request.body).toBeInstanceOf(FormData);
    upload.flush({
      message: 'Brochure attached to "CAB-UTP6".',
      item: item({ id: 8, sku: 'CAB-UTP6', brochure: { name: 'datasheet.pdf', size: 1024 } }),
    });
    expectListReload();
    expectOptions();
    expectRefs();
    await fixture.whenStable();

    expect(toast()).toEqual({ text: '"CAB-UTP6" added.', type: 'success' });
  });

  it('should keep the item and say so when only the PDF upload fails', async () => {
    await signIn(['catalog.manage']);
    component.submitAdd({
      item: { sku: 'CAB-UTP6', type: 'PRODUCT', description: 'UTP cable cat6', baseUnitCode: 'm', vatCode: 'STANDARD' },
      brochure: new File(['%PDF-'], 'datasheet.pdf', { type: 'application/pdf' }),
    });

    httpMock
      .expectOne('/api/items')
      .flush({ message: '"CAB-UTP6" added.', item: item({ id: 8, sku: 'CAB-UTP6' }) });
    httpMock
      .expectOne('/api/items/8/brochure')
      .flush({ message: 'Only PDF files can be attached.' }, { status: 400, statusText: 'Bad Request' });
    expectListReload();
    expectOptions();
    expectRefs();
    await fixture.whenStable();

    expect(toast()).toEqual({ text: '"CAB-UTP6" added.', type: 'success' });
    expect(component.error()).toBe('Only PDF files can be attached.');
  });

  it('should keep the drawer open on the saved copy after an update', async () => {
    await signIn(['catalog.manage', 'quote.view_cost']);
    await openSeven();

    component.update({ costPrice: 90 });
    const patch = httpMock.expectOne('/api/items/7');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ costPrice: 90 });
    patch.flush({ message: '"CAM-2041" updated.', item: item({ costPrice: '90.0000' }) });
    expectOptions();
    expectRefs();
    await fixture.whenStable();

    expect(toast()).toEqual({ text: '"CAM-2041" updated.', type: 'success' });
    expect(component.editing()?.costPrice).toBe('90.0000');
    // Patched into the list in place, without a reload.
    expect(component.items()[0].costPrice).toBe('90.0000');
  });

  it('should show a failed write inside the drawer, not on the page', async () => {
    await signIn(['catalog.manage']);
    await openSeven();

    component.update({ sku: 'CAM-2042' });
    httpMock.expectOne('/api/items/7').flush(
      {
        message: 'The code "CAM-2042" is already used by another item.',
        issues: [{ field: 'sku', message: 'Taken' }],
      },
      { status: 409, statusText: 'Conflict' },
    );
    await fixture.whenStable();

    expect(drawer()?.textContent).toContain('The code "CAM-2042" is already used by another item.');
    expect(drawer()?.textContent).toContain('Taken');
    expect(component.error()).toBeNull();
    expect(toast()).toBeNull();
  });

  it('should archive, close the drawer and reload the page', async () => {
    await signIn(['catalog.manage']);
    await openSeven();

    component.setArchived(true);
    const patch = httpMock.expectOne('/api/items/7');
    expect(patch.request.body).toEqual({ isArchived: true });
    patch.flush({ message: '"CAM-2041" archived.', item: item({ isArchived: true }) });
    expectListReload();
    await fixture.whenStable();

    expect(toast()).toEqual({ text: '"CAM-2041" archived.', type: 'success' });
    expect(drawer()).toBeNull();
  });

  it('should delete, close the drawer and reload the page, options and refs', async () => {
    await signIn(['catalog.manage']);
    await openSeven();

    component.remove();
    const del = httpMock.expectOne('/api/items/7');
    expect(del.request.method).toBe('DELETE');
    del.flush({ message: '"CAM-2041" deleted.', id: 7 });
    expectListReload();
    expectOptions();
    expectRefs();
    await fixture.whenStable();

    expect(toast()).toEqual({ text: '"CAM-2041" deleted.', type: 'success' });
    expect(drawer()).toBeNull();
  });

  it('should attach and remove the PDF from the drawer, keeping it open', async () => {
    await signIn(['catalog.manage']);
    await openSeven();

    component.uploadBrochure(new File(['%PDF-'], 'datasheet.pdf', { type: 'application/pdf' }));
    const upload = httpMock.expectOne('/api/items/7/brochure');
    expect(upload.request.method).toBe('POST');
    upload.flush({
      message: 'Brochure attached to "CAM-2041".',
      item: item({ brochure: { name: 'datasheet.pdf', size: 1024 } }),
    });
    await fixture.whenStable();

    expect(toast()).toEqual({ text: 'Brochure attached to "CAM-2041".', type: 'success' });
    expect(component.editing()?.brochure?.name).toBe('datasheet.pdf');
    // The table row follows without a reload.
    expect(component.items()[0].brochure?.name).toBe('datasheet.pdf');

    component.removeBrochure();
    const del = httpMock.expectOne('/api/items/7/brochure');
    expect(del.request.method).toBe('DELETE');
    del.flush({ message: 'Brochure removed from "CAM-2041".', item: item() });
    await fixture.whenStable();

    expect(component.editing()?.brochure).toBeNull();
    expect(drawer()).toBeTruthy();
  });

  it('should add a category, toast, reset the inline form and reload lookups', async () => {
    await signIn(['catalog.manage']);
    component.addRef('categories', 'CCTV');

    const post = httpMock.expectOne('/api/categories');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ name: 'CCTV' });
    post.flush({ message: 'Category "CCTV" added.', category: { id: 3, name: 'CCTV', itemCount: 0 } });
    expectRefs();
    expectOptions();
    await fixture.whenStable();

    expect(toast()).toEqual({ text: 'Category "CCTV" added.', type: 'success' });
  });

  it('should rename a brand and refresh the rows that show its name', async () => {
    await signIn(['catalog.manage']);
    component.renameRef('brands', { id: 5, name: 'HikVision' });

    const patch = httpMock.expectOne('/api/brands/5');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ name: 'HikVision' });
    patch.flush({ message: 'Brand "HikVision" updated.', brand: { id: 5, name: 'HikVision', itemCount: 1 } });
    expectOptions();
    expectListReload();
    await fixture.whenStable();

    expect(toast()).toEqual({ text: 'Brand "HikVision" updated.', type: 'success' });
    expect(component.brands()[0].name).toBe('HikVision');
  });

  const deleteModal = () => el().querySelector<HTMLElement>('app-delete-modal');
  const modalButton = (label: string) =>
    Array.from(deleteModal()?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === label,
    );

  it('should ask in the delete modal before deleting a category, then reload that list', async () => {
    await signIn(['catalog.manage']);

    component.removeRef('categories', { id: 2, name: 'Cables', itemCount: 0 });
    await fixture.whenStable();
    expect(deleteModal()?.textContent).toContain('Delete category?');
    expect(deleteModal()?.textContent).toContain('The category "Cables" will be deleted permanently.');
    httpMock.expectNone('/api/categories/2');

    // Cancel closes it and sends nothing.
    modalButton('Cancel')!.click();
    await fixture.whenStable();
    expect(deleteModal()).toBeNull();
    httpMock.expectNone('/api/categories/2');

    component.removeRef('categories', { id: 2, name: 'Cables', itemCount: 0 });
    await fixture.whenStable();
    modalButton('Delete')!.click();

    const del = httpMock.expectOne('/api/categories/2');
    expect(del.request.method).toBe('DELETE');
    del.flush({ message: 'Category "Cables" deleted.', id: 2 });
    httpMock
      .expectOne((r) => r.url === '/api/categories')
      .flush({ categories: [CATEGORIES[0]], meta: { ...REF_META, total: 1 } });
    expectOptions();
    await fixture.whenStable();

    expect(deleteModal()).toBeNull();
    expect(toast()).toEqual({ text: 'Category "Cables" deleted.', type: 'success' });
  });

  it('should show a refused ref delete on the page', async () => {
    await signIn(['catalog.manage']);

    component.removeRef('brands', { id: 5, name: 'Hikvision', itemCount: 1 });
    await fixture.whenStable();
    expect(deleteModal()?.textContent).toContain('Delete brand?');
    modalButton('Delete')!.click();
    httpMock
      .expectOne('/api/brands/5')
      .flush(
        { message: '1 item still uses "Hikvision". Move it to another brand first.' },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();

    expect(el().textContent).toContain('1 item still uses "Hikvision".');
    expect(toast()).toBeNull();
  });
});
