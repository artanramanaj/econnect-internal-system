import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideTranslateTesting } from '../../../core/i18n/translate.testing';
import { Item, ItemOptions } from '../../../core/models/item.model';
import { ItemFilters, ItemTable } from './item-table';

const OPTIONS: ItemOptions = {
  units: [{ code: 'pcs', name: 'Pieces' }],
  vatRates: [
    { code: 'STANDARD', name: 'Standard rate', rate: '18.00' },
    { code: 'REDUCED', name: 'Reduced rate', rate: '8.00' },
  ],
  categories: [
    { id: 1, name: 'Cameras' },
    { id: 2, name: 'Cables' },
  ],
  brands: [{ id: 5, name: 'Hikvision' }],
  manufacturers: [],
  syncOwnedFields: [],
};

const ITEMS: Item[] = [
  {
    id: 7,
    sku: 'CAM-2041',
    description: 'IP camera 4MP dome',
    type: 'PRODUCT',
    source: 'PRODATA',
    category: { id: 1, name: 'Cameras' },
    brand: { id: 5, name: 'Hikvision' },
    manufacturer: 'Hikvision',
    barcode: null,
    baseUnitCode: 'pcs',
    vatCode: 'STANDARD',
    isArchived: false,
    sourceId: 1204,
    brochure: { name: 'CAM-2041_datasheet.pdf', size: 1258291 },
    lastSyncedAt: null,
    updatedAt: '2026-11-24T09:00:00.000Z',
    costPrice: '84.5000',
  },
  {
    id: 8,
    sku: 'SRV-INST',
    description: 'Camera installation',
    type: 'SERVICE',
    source: 'LOCAL',
    category: null,
    brand: null,
    manufacturer: null,
    barcode: null,
    baseUnitCode: 'hr',
    vatCode: 'REDUCED',
    isArchived: true,
    sourceId: null,
    brochure: null,
    lastSyncedAt: null,
    updatedAt: '2026-11-24T09:00:00.000Z',
    costPrice: '25.0000',
  },
];

describe('ItemTable', () => {
  let component: ItemTable;
  let fixture: ComponentFixture<ItemTable>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ItemTable],
      // The money pipe reads LanguageService, which injects AuthService, which
      // injects HttpClient at construction.
      providers: [provideHttpClient(), provideHttpClientTesting(), provideTranslateTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ItemTable);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('items', ITEMS);
    fixture.componentRef.setInput('options', OPTIONS);
    fixture.componentRef.setInput('meta', { page: 1, pageSize: 25, total: 2, totalPages: 1 });
    fixture.componentRef.setInput('canViewCost', true);
    await fixture.whenStable();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const rows = () => Array.from(el().querySelectorAll('tbody tr'));
  const headers = () => Array.from(el().querySelectorAll('th')).map((th) => th.textContent?.trim());
  const rowButton = (row: Element, label: string) =>
    Array.from(row.querySelectorAll('button')).find((b) => b.textContent?.trim() === label);

  it('should render one row per item with its labels resolved', () => {
    expect(rows()).toHaveLength(2);

    const first = rows()[0].textContent ?? '';
    expect(first).toContain('CAM-2041');
    expect(first).toContain('Product');
    expect(first).toContain('Pieces');
    expect(first).toContain('18%');
    expect(first).toContain('Cameras');
    expect(first).toContain('ProData');
    // Brand and manufacturer are the same, so the byline names it once.
    expect(first.match(/Hikvision/g)).toHaveLength(1);

    const second = rows()[1].textContent ?? '';
    expect(second).toContain('Service');
    expect(second).toContain('8%');
    expect(second).toContain('Local');
    expect(second).toContain('Archived');
    expect(second).toContain('Hours');
  });

  it('should show the cost column only when cost may be seen', async () => {
    expect(headers()).toContain('Cost');
    expect(rows()[0].textContent?.replace(/\s+/g, ' ')).toContain('84,50 €');

    fixture.componentRef.setInput('canViewCost', false);
    await fixture.whenStable();
    expect(headers()).not.toContain('Cost');
  });

  it('should label the row action Edit for managers and View for the rest', async () => {
    expect(rowButton(rows()[0], 'View')).toBeTruthy();
    // There is no New item button any more: the add card sits beside the table.
    expect(el().textContent).not.toContain('New item');

    fixture.componentRef.setInput('canManage', true);
    await fixture.whenStable();
    expect(rowButton(rows()[0], 'Edit')).toBeTruthy();
  });

  it('should offer the PDF where there is one, and Upload only to managers', async () => {
    expect(headers()).toContain('Datasheet');

    const opened: Item[] = [];
    component.openPdf.subscribe((item) => opened.push(item));
    rowButton(rows()[0], 'PDF')?.click();
    expect(opened.map((i) => i.id)).toEqual([7]);

    // Without manage, a missing PDF is just a dash.
    expect(rowButton(rows()[1], 'Upload')).toBeUndefined();
    expect(rows()[1].textContent).toContain('—');

    fixture.componentRef.setInput('canManage', true);
    await fixture.whenStable();
    // Upload opens the item, where the Documents section does the upload.
    const openedRows: Item[] = [];
    component.open.subscribe((item) => openedRows.push(item));
    rowButton(rows()[1], 'Upload')?.click();
    expect(openedRows.map((i) => i.id)).toEqual([8]);
  });

  it('should emit the row to open', () => {
    const opened: Item[] = [];
    component.open.subscribe((item) => opened.push(item));

    rowButton(rows()[1], 'View')?.click();

    expect(opened.map((i) => i.id)).toEqual([8]);
  });

  it('should emit a trimmed search term', () => {
    const terms: string[] = [];
    component.search.subscribe((term) => terms.push(term));

    const input = el().querySelector('input[type="search"]') as HTMLInputElement;
    input.value = '  cam ';
    input.dispatchEvent(new Event('input'));

    expect(terms).toEqual(['cam']);
  });

  it('should emit one filter at a time, named by its field and holding the id', () => {
    const changes: Partial<ItemFilters>[] = [];
    component.filterChange.subscribe((change) => changes.push(change));

    // Type, category, brand, source, status — in toolbar order.
    const selects = el().querySelectorAll('select');
    const category = selects[1] as HTMLSelectElement;
    category.value = '2';
    category.dispatchEvent(new Event('change'));
    const status = selects[4] as HTMLSelectElement;
    status.value = 'archived';
    status.dispatchEvent(new Event('change'));

    expect(changes).toEqual([{ categoryId: '2' }, { status: 'archived' }]);
  });

  it('should page only when there is more than one page', async () => {
    // One page: no pager at all.
    expect(el().querySelector('app-pagination nav')).toBeNull();

    fixture.componentRef.setInput('meta', { page: 1, pageSize: 10, total: 15, totalPages: 2 });
    await fixture.whenStable();

    const pages: number[] = [];
    component.pageChange.subscribe((page) => pages.push(page));
    const pageTwo = Array.from(el().querySelectorAll('app-pagination button')).find(
      (b) => b.textContent?.trim() === '2',
    ) as HTMLButtonElement;
    pageTwo.click();

    expect(pages).toEqual([2]);
  });

  it('should say why the table is empty', async () => {
    fixture.componentRef.setInput('items', []);
    fixture.componentRef.setInput('loading', true);
    await fixture.whenStable();
    expect(el().querySelector('tbody')?.textContent).toContain('Loading…');

    fixture.componentRef.setInput('loading', false);
    await fixture.whenStable();
    expect(el().querySelector('tbody')?.textContent).toContain('No items match these filters.');
  });
});
