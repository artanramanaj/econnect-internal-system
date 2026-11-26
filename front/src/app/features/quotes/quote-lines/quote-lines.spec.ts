import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { FormArray, FormBuilder } from '@angular/forms';
import { provideTranslateTesting } from '../../../core/i18n/translate.testing';
import { CatalogueHit, QuoteLine } from '../../../core/models/quote.model';
import {
  LineGroup,
  freeLine,
  lineFromHit,
  lineFromSaved,
  previewTotals,
  toLineInput,
} from '../quote-form';
import { QuoteLines } from './quote-lines';

const VAT_RATES = [
  { code: 'STANDARD', name: 'Standard rate', rate: '18.00' },
  { code: 'REDUCED', name: 'Reduced rate', rate: '8.00' },
];
const UNITS = [
  { code: 'hr', name: 'Hours' },
  { code: 'm', name: 'Metres' },
  { code: 'pcs', name: 'Pieces' },
];

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

const SAVED: QuoteLine = {
  id: 501,
  sortOrder: 1,
  section: 'Cabling',
  kind: 'PRODUCT',
  itemId: 19,
  sku: 'CAB-UTP6',
  description: 'UTP cable Cat6',
  unitCode: 'm',
  quantity: '600.0000',
  unitCost: '0.4200',
  markupPct: '47.6190',
  unitPrice: '0.6200',
  lineCost: '252.00',
  lineTotal: '372.00',
  vatCode: 'STANDARD',
  vatRate: '18.00',
};

describe('QuoteLines', () => {
  let component: QuoteLines;
  let fixture: ComponentFixture<QuoteLines>;
  let fb: FormBuilder;
  let lines: FormArray<LineGroup>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [QuoteLines],
      // The money pipe reads LanguageService, which injects AuthService, which
      // injects HttpClient at construction.
      providers: [provideHttpClient(), provideHttpClientTesting(), provideTranslateTesting()],
    }).compileComponents();

    fb = TestBed.inject(FormBuilder);
    lines = fb.nonNullable.array<LineGroup>([
      lineFromHit(fb, CAMERA, 'CCTV', { code: 'STANDARD', rate: '18.00' }),
      lineFromSaved(fb, SAVED),
    ]);

    fixture = TestBed.createComponent(QuoteLines);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('lines', lines);
    fixture.componentRef.setInput('units', UNITS);
    fixture.componentRef.setInput('vatRates', VAT_RATES);
    fixture.componentRef.setInput('minMarkupPct', '10.00');
    fixture.componentRef.setInput('canViewCost', true);
    await fixture.whenStable();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => (el().textContent ?? '').replace(/\s+/g, ' ');
  // Real typing: the DOM input event goes through the form control first and
  // the line's own (input) handler second, and schedules the re-render.
  const typeInto = async (label: string, value: string) => {
    const input = el().querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };

  it('should copy a catalogue item onto a new line at a 20% markup', () => {
    const camera = lines.at(0).getRawValue();

    expect(camera.sku).toBe('CAM-IPD4-28');
    expect(camera.unitCost).toBe('72.00');
    expect(camera.markupPct).toBe('20');
    expect(camera.unitPrice).toBe('86.40');
    expect(camera.vatRate).toBe('18.00');
    expect(component.lineTotal(lines.at(0))).toBe('86.40');
  });

  it('should fill the price when a markup is typed', async () => {
    const line = lines.at(0);
    await typeInto('Markup percent, line 1', '25');

    expect(line.controls.unitPrice.value).toBe('90.00');
    expect(line.controls.basis.value).toBe('MARKUP');
  });

  it('should fill the markup when a price is typed, comma or dot', async () => {
    const line = lines.at(0);
    await typeInto('Unit price, line 1', '79,20');

    // (79.20 − 72) / 72 = 10%
    expect(line.controls.markupPct.value).toBe('10.00');
    expect(line.controls.basis.value).toBe('PRICE');
  });

  it('should follow a changed cost with whichever of markup and price was typed', async () => {
    const line = lines.at(0);
    await typeInto('Markup percent, line 1', '25');
    await typeInto('Cost, line 1', '80');
    // The markup was typed, so the price moves.
    expect(line.controls.unitPrice.value).toBe('100.00');

    await typeInto('Unit price, line 1', '120');
    await typeInto('Cost, line 1', '100');
    // The price was typed, so the markup moves.
    expect(line.controls.unitPrice.value).toBe('120');
    expect(line.controls.markupPct.value).toBe('20.00');
  });

  it('should show the markup as n/a when the cost is 0', async () => {
    const line = lines.at(0);
    await typeInto('Cost, line 1', '0');

    expect(component.costIsZero(line)).toBe(true);
    expect(line.controls.markupPct.value).toBe('');
    expect(text()).toContain('n/a');
    // The price is what gets sent; no markup.
    const sent = toLineInput(line.getRawValue());
    expect(sent.basis).toBe('PRICE');
    expect(sent.markupPct).toBeNull();
  });

  it('should highlight a line below the minimum markup without blocking it', async () => {
    const line = lines.at(0);
    expect(component.isLow(line)).toBe(false);

    await typeInto('Markup percent, line 1', '5');

    expect(component.isLow(line)).toBe(true);
    expect(text()).toContain('Markup below 10.00%');
    expect(line.valid).toBe(true);
  });

  it('should keep a saved line exactly as stored when it is not touched', () => {
    const sent = toLineInput(lines.at(1).getRawValue());

    expect(sent).toEqual({
      section: 'Cabling',
      kind: 'PRODUCT',
      itemId: 19,
      sku: 'CAB-UTP6',
      description: 'UTP cable Cat6',
      unitCode: 'm',
      quantity: '600',
      unitCost: '0.42',
      // Basis PRICE: the stored price is sent, so the total cannot drift.
      basis: 'PRICE',
      markupPct: null,
      unitPrice: '0.62',
      vatCode: 'STANDARD',
      vatRate: '18.00',
    });
  });

  it('should bring today’s rate with a picked VAT code, and keep an old rate selectable', async () => {
    const line = lines.at(0);
    line.controls.vatCode.setValue('REDUCED');
    component.onVat(line);
    expect(line.controls.vatRate.value).toBe('8.00');

    // A line saved when STANDARD was 16% still offers its own 16%.
    const old = lineFromSaved(fb, { ...SAVED, vatRate: '16.00' });
    expect(component.vatChoices(old).map((c) => c.label)).toEqual(['16%', '8%']);
  });

  it('should head each run of lines with its section and rename the whole run', async () => {
    lines.push(lineFromSaved(fb, { ...SAVED, id: 502, description: 'Patch cord' }));
    await fixture.whenStable();

    expect(component.startsSection(0)).toBe(true);
    expect(component.startsSection(1)).toBe(true);
    expect(component.startsSection(2)).toBe(false);

    component.renameSection(1, { target: { value: ' Network ' } } as unknown as Event);
    expect(lines.controls.map((l) => l.controls.section.value)).toEqual(['CCTV', 'Network', 'Network']);
  });

  it('should refuse a quantity of zero and too many decimals', () => {
    const quantity = lines.at(0).controls.quantity;
    quantity.setValue('0');
    expect(quantity.invalid).toBe(true);
    quantity.setValue('1.23456');
    expect(quantity.invalid).toBe(true);
    quantity.setValue('2,5');
    expect(quantity.valid).toBe(true);
  });

  it('should remove a line', async () => {
    const remove = el().querySelector<HTMLButtonElement>('button[aria-label="Remove line 1"]');
    remove?.click();
    await fixture.whenStable();

    expect(lines.length).toBe(1);
    expect(lines.at(0).controls.sku.value).toBe('CAB-UTP6');
  });

  it('should hide cost and markup without cost access', async () => {
    fixture.componentRef.setInput('canViewCost', false);
    await fixture.whenStable();

    const headers = Array.from(el().querySelectorAll('th')).map((th) => th.textContent?.trim());
    expect(headers).not.toContain('Cost €');
    expect(headers).not.toContain('Markup %');
  });

  it('should total the lines that parse, for the live preview', () => {
    const free = freeLine(fb, 'Labour', { unitCode: 'hr', vat: { code: 'STANDARD', rate: '18.00' } });
    lines.push(free);
    // An unfinished free line (no price yet) is left out rather than counted as 0 cost.
    const before = previewTotals(lines.getRawValue());
    expect(before.subtotal.toFixed(2)).toBe('458.40');

    free.controls.unitPrice.setValue('30');
    free.controls.quantity.setValue('8');
    const after = previewTotals(lines.getRawValue());
    expect(after.subtotal.toFixed(2)).toBe('698.40');
    expect(after.vatTotal.toFixed(2)).toBe('125.71');
  });
});
