import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideTranslateTesting } from '../../../core/i18n/translate.testing';
import { ItemDetail, ItemOptions, UpdateItemRequest } from '../../../core/models/item.model';
import { ItemDrawer } from './item-drawer';

const OPTIONS: ItemOptions = {
  units: [
    { code: 'box', name: 'Boxes' },
    { code: 'm', name: 'Metres' },
    { code: 'pcs', name: 'Pieces' },
  ],
  // The server sorts by rate, highest first.
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
        id: 2,
        oldCost: '80.0000',
        newCost: '84.5000',
        source: 'PRODATA',
        changedAt: '2026-11-24T21:00:00.000Z',
        changedBy: null,
      },
      {
        id: 1,
        oldCost: null,
        newCost: '80.0000',
        source: 'LOCAL',
        changedAt: '2026-11-20T09:00:00.000Z',
        changedBy: 'artan',
      },
    ],
    ...overrides,
  };
}

/** A stand-in the picker checks only name and size of. */
function fakeFile(name: string, size: number): File {
  return { name, size } as File;
}

function pickEvent(file: File): Event {
  return { target: { files: [file], value: 'C:\\fake\\' + file.name } } as unknown as Event;
}

describe('ItemDrawer', () => {
  let component: ItemDrawer;
  let fixture: ComponentFixture<ItemDrawer>;
  let updated: UpdateItemRequest[];

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ItemDrawer],
      // Dates and money read LanguageService, which injects AuthService, which
      // injects HttpClient at construction.
      providers: [provideHttpClient(), provideHttpClientTesting(), provideTranslateTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ItemDrawer);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('item', item());
    fixture.componentRef.setInput('options', OPTIONS);
    fixture.componentRef.setInput('canViewCost', true);
    fixture.componentRef.setInput('canManage', true);
    updated = [];
    component.update.subscribe((payload) => updated.push(payload));
    await fixture.whenStable();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  // Albanian money uses narrow no-break spaces; compare with plain ones.
  const text = () => (el().textContent ?? '').replace(/\s+/g, ' ');
  const button = (label: string) =>
    Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.trim() === label);
  const open = async (value: ItemDetail) => {
    fixture.componentRef.setInput('item', value);
    await fixture.whenStable();
  };

  describe('an existing item', () => {
    it('should fill the form as the values would be typed', () => {
      const f = component.form.controls;
      expect(f.sku.value).toBe('CAM-2041');
      expect(f.categoryId.value).toBe('1');
      expect(f.brandId.value).toBe('5');
      expect(f.costPrice.value).toBe('84.5');
      expect(component.units.length).toBe(1);
      expect(component.units.at(0).value).toEqual({ unitCode: 'box', factor: '10' });
      expect(button('Save changes')).toBeTruthy();
    });

    it('should emit every editable field, with null for a cleared one', () => {
      component.form.controls.brandId.setValue('');

      component.onSubmit();

      expect(updated).toEqual([
        {
          sku: 'CAM-2041',
          type: 'PRODUCT',
          description: 'IP camera 4MP dome',
          categoryId: 1,
          brandId: null,
          manufacturer: 'Hikvision',
          barcode: null,
          baseUnitCode: 'pcs',
          vatCode: 'STANDARD',
          costPrice: 84.5,
          units: [{ unitCode: 'box', factor: 10 }],
        },
      ]);
    });

    it('should keep the base unit and units already picked out of a row', () => {
      component.addUnit();

      const codes = (index: number) => component.unitChoices(index).map((u) => u.code);
      // Base unit is pcs; row 0 holds box.
      expect(codes(1)).toEqual(['m']);
      expect(codes(0)).toEqual(['box', 'm']);
    });

    it('should list the cost history, newest first', () => {
      expect(text()).toContain('Cost history');
      expect(text()).toContain('80,00 €');
      expect(text()).toContain('84,50 €');
      expect(text()).toContain('First cost');
      expect(text()).toContain('by artan');
      expect(text()).toContain('by the ProData sync');
    });

    it('should ask before deleting a local item', async () => {
      const removed: unknown[] = [];
      component.remove.subscribe(() => removed.push(true));

      button('Delete this item')?.click();
      await fixture.whenStable();
      expect(text()).toContain('Delete CAM-2041 for good?');
      expect(removed).toEqual([]);

      button('Yes, delete')?.click();
      expect(removed).toEqual([true]);
    });

    it('should archive an active item and restore an archived one', async () => {
      const archived: boolean[] = [];
      component.archive.subscribe((value) => archived.push(value));

      button('Archive')?.click();
      await open(item({ isArchived: true }));
      button('Restore')?.click();

      expect(archived).toEqual([true, false]);
    });

    it('should show a failed save inside the drawer', async () => {
      fixture.componentRef.setInput('error', 'The code "CAM-2041" is already used by another item.');
      fixture.componentRef.setInput('issues', ['Taken']);
      await fixture.whenStable();

      expect(text()).toContain('The code "CAM-2041" is already used by another item.');
      expect(text()).toContain('Taken');
    });
  });

  describe('the documents section', () => {
    it('should offer only an upload zone while there is no PDF', () => {
      expect(text()).toContain('Choose a PDF…');
      expect(button('Open')).toBeUndefined();
    });

    it('should emit the picked PDF, and refuse a wrong pick with a message', async () => {
      const uploads: File[] = [];
      component.uploadBrochure.subscribe((file) => uploads.push(file));

      component.onBrochurePicked(pickEvent(fakeFile('notes.txt', 100)));
      await fixture.whenStable();
      expect(uploads).toEqual([]);
      expect(text()).toContain('Only PDF files can be attached');

      component.onBrochurePicked(pickEvent(fakeFile('too-big.pdf', 26 * 1024 * 1024)));
      await fixture.whenStable();
      expect(text()).toContain('The PDF must be 25 MB or smaller');

      const fine = fakeFile('datasheet.pdf', 1024);
      component.onBrochurePicked(pickEvent(fine));
      expect(uploads).toEqual([fine]);
    });

    it('should show the PDF with Open, Replace and Remove once there is one', async () => {
      await open(item({ brochure: { name: 'CAM-2041_datasheet.pdf', size: 1258291 } }));

      const opened: unknown[] = [];
      const removed: unknown[] = [];
      component.openPdf.subscribe(() => opened.push(true));
      component.removeBrochure.subscribe(() => removed.push(true));

      expect(text()).toContain('CAM-2041_datasheet.pdf');
      expect(text()).toContain('1.2 MB');
      expect(text()).toContain('Replace PDF');

      button('Open')?.click();
      expect(opened).toEqual([true]);

      el()
        .querySelector<HTMLButtonElement>('button[aria-label="Remove the PDF"]')
        ?.click();
      expect(removed).toEqual([true]);
    });
  });

  describe('a ProData item', () => {
    beforeEach(async () => {
      await open(item({ source: 'PRODATA', sourceId: 1204 }));
    });

    it('should lock what the sync owns and leave the rest editable', () => {
      const f = component.form.controls;
      for (const field of OPTIONS.syncOwnedFields) {
        expect(f[field as keyof typeof f].disabled, field).toBe(true);
      }
      expect(f.type.enabled).toBe(true);
      expect(component.units.enabled).toBe(true);
      expect(text()).toContain('This item comes from ProData');
      expect(text()).toContain('ProData ID 1204');
    });

    it('should send only the fields it may change', () => {
      component.form.controls.type.setValue('SERVICE');

      component.onSubmit();

      expect(updated).toEqual([{ type: 'SERVICE', units: [{ unitCode: 'box', factor: 10 }] }]);
    });

    it('should offer archiving and the PDF, but not deleting', () => {
      expect(button('Archive')).toBeTruthy();
      expect(button('Delete this item')).toBeUndefined();
      // The PDF is not sync-owned: it can be attached to a ProData item too.
      expect(text()).toContain('Choose a PDF…');
    });
  });

  describe('without catalog.manage', () => {
    beforeEach(async () => {
      fixture.componentRef.setInput('canManage', false);
      await open(item());
    });

    it('should show the item read-only, with no actions', () => {
      expect(component.form.disabled).toBe(true);
      expect(text()).toContain('You can view the catalogue but not change it.');
      expect(text()).toContain('No brochure attached.');
      expect(button('Save changes')).toBeUndefined();
      expect(button('Archive')).toBeUndefined();
      expect(button('Delete this item')).toBeUndefined();
    });

    it('should never emit a save', () => {
      component.onSubmit();
      expect(updated).toEqual([]);
    });
  });
});
