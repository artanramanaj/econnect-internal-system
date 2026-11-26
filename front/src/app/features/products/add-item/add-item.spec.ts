import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideTranslateTesting } from '../../../core/i18n/translate.testing';
import { ItemOptions } from '../../../core/models/item.model';
import { AddItem, AddItemSubmit } from './add-item';

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
  syncOwnedFields: [],
};

/** A stand-in the picker checks only name and size of. */
function fakeFile(name: string, size: number): File {
  return { name, size } as File;
}

function pickEvent(file: File): Event {
  return { target: { files: [file], value: 'C:\\fake\\' + file.name } } as unknown as Event;
}

describe('AddItem', () => {
  let component: AddItem;
  let fixture: ComponentFixture<AddItem>;
  let submitted: AddItemSubmit[];

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AddItem],
      // The codeLabel pipe reads LanguageService, which injects AuthService,
      // which injects HttpClient at construction.
      providers: [provideHttpClient(), provideHttpClientTesting(), provideTranslateTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AddItem);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('options', OPTIONS);
    fixture.componentRef.setInput('canViewCost', true);
    submitted = [];
    component.submitted.subscribe((payload) => submitted.push(payload));
    await fixture.whenStable();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';

  it('should start on the first VAT rate in force', () => {
    expect(text()).toContain('Add a product');
    expect(component.form.controls.vatCode.value).toBe('STANDARD');
  });

  describe('the base unit', () => {
    const withHours: ItemOptions = { ...OPTIONS, units: [{ code: 'hr', name: 'Hours' }, ...OPTIONS.units] };
    /** The codes the base-unit select actually renders. */
    const baseChoices = () =>
      Array.from(el().querySelectorAll<HTMLOptionElement>('#add-item-unit option'))
        .map((option) => option.value)
        .filter(Boolean);
    const pickType = async (type: string) => {
      const select = el().querySelector<HTMLSelectElement>('#add-item-type')!;
      select.value = type;
      select.dispatchEvent(new Event('change'));
      await fixture.whenStable();
    };

    beforeEach(async () => {
      fixture.componentRef.setInput('options', withHours);
      await fixture.whenStable();
    });

    it('should not offer Hours for a product', () => {
      expect(baseChoices()).toEqual(['box', 'm', 'pcs']);
    });

    it('should offer Hours for a service', async () => {
      await pickType('SERVICE');
      expect(baseChoices()).toEqual(['hr', 'box', 'm', 'pcs']);
    });

    it('should drop Hours when a service is switched back to a product', async () => {
      await pickType('SERVICE');
      component.form.controls.baseUnitCode.setValue('hr');

      await pickType('PRODUCT');

      expect(component.form.controls.baseUnitCode.value).toBe('');
      expect(baseChoices()).not.toContain('hr');
    });

    it('should keep any other unit when the type changes', async () => {
      component.form.controls.baseUnitCode.setValue('m');
      await pickType('SERVICE');
      await pickType('PRODUCT');
      expect(component.form.controls.baseUnitCode.value).toBe('m');
    });
  });

  it('should not emit while required fields are missing, and say which', async () => {
    component.onSubmit();
    await fixture.whenStable();

    expect(submitted).toEqual([]);
    expect(text()).toContain('Code is required');
    expect(text()).toContain('Description must be at least 2 characters');
    expect(text()).toContain('Choose a unit');
  });

  it('should emit trimmed text, numeric ids and decimals, and no blank optionals', () => {
    const f = component.form.controls;
    f.sku.setValue('  CAB-UTP6 ');
    f.description.setValue('UTP cable cat6');
    f.categoryId.setValue('2');
    f.brandId.setValue('5');
    f.baseUnitCode.setValue('m');
    // Typed the Albanian way.
    f.costPrice.setValue('0,45');
    component.addUnit();
    component.units.at(0).setValue({ unitCode: 'box', factor: '305' });

    component.onSubmit();

    expect(submitted).toEqual([
      {
        item: {
          sku: 'CAB-UTP6',
          type: 'PRODUCT',
          description: 'UTP cable cat6',
          categoryId: 2,
          brandId: 5,
          baseUnitCode: 'm',
          vatCode: 'STANDARD',
          costPrice: 0.45,
          units: [{ unitCode: 'box', factor: 305 }],
        },
        brochure: null,
      },
    ]);
    expect(submitted[0].item).not.toHaveProperty('manufacturer', '');
  });

  it('should refuse a cost with more than four decimals', async () => {
    component.form.controls.costPrice.setValue('1.23456');
    component.form.controls.costPrice.markAsTouched();
    await fixture.whenStable();

    expect(component.form.controls.costPrice.invalid).toBe(true);
    expect(text()).toContain('Enter an amount of 0 or more, with at most 4 decimals');
  });

  it('should refuse an alternative unit holding nothing', () => {
    component.addUnit();
    component.units.at(0).setValue({ unitCode: 'box', factor: '0' });

    expect(component.units.at(0).controls.factor.invalid).toBe(true);
  });

  it('should keep a picked PDF for the submit, and refuse a wrong pick', async () => {
    component.onBrochurePicked(pickEvent(fakeFile('notes.txt', 100)));
    await fixture.whenStable();
    expect(component.brochure()).toBeNull();
    expect(text()).toContain('Only PDF files can be attached');

    component.onBrochurePicked(pickEvent(fakeFile('too-big.pdf', 26 * 1024 * 1024)));
    await fixture.whenStable();
    expect(text()).toContain('The PDF must be 25 MB or smaller');

    const fine = fakeFile('datasheet.pdf', 1258291);
    component.onBrochurePicked(pickEvent(fine));
    await fixture.whenStable();
    expect(text()).toContain('datasheet.pdf');
    expect(text()).toContain('1.2 MB');

    const f = component.form.controls;
    f.sku.setValue('CAB-UTP6');
    f.description.setValue('UTP cable cat6');
    f.baseUnitCode.setValue('m');
    component.onSubmit();

    expect(submitted[0].brochure).toBe(fine);
  });

  it('should clear everything on reset, back to the default VAT', async () => {
    const f = component.form.controls;
    f.sku.setValue('CAB-UTP6');
    f.vatCode.setValue('REDUCED');
    component.addUnit();
    component.onBrochurePicked(pickEvent(fakeFile('datasheet.pdf', 1024)));

    component.reset();
    await fixture.whenStable();

    expect(f.sku.value).toBe('');
    expect(f.vatCode.value).toBe('STANDARD');
    expect(component.units.length).toBe(0);
    expect(component.brochure()).toBeNull();
  });
});
