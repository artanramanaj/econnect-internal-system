import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Decimal } from 'decimal.js';
import {
  CatalogueHit,
  PriceBasis,
  QuoteLine,
  QuoteLineInput,
  QuoteLineKind,
} from '../../core/models/quote.model';
import { DecimalShape, decimalShape, decimalText, notBlank } from '../../shared/forms/decimal';
import { PricedLine, QuoteTotals, percent, priceLine, totalise, unitAmount } from './quote-pricing';

/*
 * The quote editor's line form. Every amount is held as the text the user
 * typed and converted with decimalText → Decimal; nothing here ever turns
 * money into a JS number.
 */

/** Column shapes, matching the server's validators. */
export const QUANTITY: DecimalShape = { integers: 10, decimals: 4 };
export const UNIT_AMOUNT: DecimalShape = { integers: 8, decimals: 4 };
export const MARKUP: DecimalShape = { integers: 5, decimals: 4, signed: true };

export type LineGroup = FormGroup<{
  section: FormControl<string>;
  kind: FormControl<QuoteLineKind>;
  /** null on a free line with no catalogue item behind it. */
  itemId: FormControl<number | null>;
  sku: FormControl<string>;
  description: FormControl<string>;
  unitCode: FormControl<string>;
  quantity: FormControl<string>;
  unitCost: FormControl<string>;
  markupPct: FormControl<string>;
  unitPrice: FormControl<string>;
  /** Which of markup and price was typed last; the server derives the other. */
  basis: FormControl<PriceBasis>;
  vatCode: FormControl<string>;
  /** Copied with the code, and kept: a saved line holds the rate of its day. */
  vatRate: FormControl<string>;
}>;

export type LineValue = ReturnType<LineGroup['getRawValue']>;

/** A Decimal as someone would type it: at least `min` decimals, at most `max`. */
export function tidy(value: Decimal, min: number, max: number): string {
  let text = value.toDecimalPlaces(max, Decimal.ROUND_HALF_UP).toFixed(max);
  while (text.includes('.') && text.endsWith('0') && text.length - text.indexOf('.') - 1 > min) {
    text = text.slice(0, -1);
  }
  return text.endsWith('.') ? text.slice(0, -1) : text;
}

/** "12.5000" from the API as someone would type it: "12.5" (or "12.50" for money). */
export function asTyped(value: string | null | undefined, min = 0, max = 4): string {
  if (value === null || value === undefined || value === '') return '';
  return tidy(new Decimal(value), min, max);
}

function group(fb: FormBuilder, value: LineValue): LineGroup {
  return fb.nonNullable.group({
    section: [value.section, Validators.maxLength(60)],
    kind: fb.nonNullable.control<QuoteLineKind>(value.kind),
    // nonNullable like every other control here: a form reset (the editor
    // resets the whole form when it shows a saved quote) must return the line
    // to the item it was loaded with, not to null — that silently unlinked
    // every catalogue line on the next save.
    itemId: fb.nonNullable.control<number | null>(value.itemId),
    sku: [value.sku, Validators.maxLength(60)],
    description: [value.description, [notBlank, Validators.maxLength(255)]],
    unitCode: [value.unitCode, Validators.required],
    quantity: [value.quantity, [Validators.required, decimalShape(QUANTITY, { positive: true })]],
    unitCost: [value.unitCost, [Validators.required, decimalShape(UNIT_AMOUNT)]],
    // Not required: with a unit cost of 0 there is no markup ("n/a").
    markupPct: [value.markupPct, decimalShape(MARKUP)],
    unitPrice: [value.unitPrice, [Validators.required, decimalShape(UNIT_AMOUNT)]],
    basis: fb.nonNullable.control<PriceBasis>(value.basis),
    vatCode: [value.vatCode, Validators.required],
    vatRate: [value.vatRate],
  }) as LineGroup;
}

/**
 * A line of a saved revision. Basis PRICE: the stored unit price is kept
 * exactly, so re-saving an untouched line can never move its total by a cent.
 */
export function lineFromSaved(fb: FormBuilder, line: QuoteLine): LineGroup {
  return group(fb, {
    section: line.section ?? '',
    kind: line.kind,
    itemId: line.itemId,
    sku: line.sku ?? '',
    description: line.description,
    unitCode: line.unitCode,
    quantity: asTyped(line.quantity),
    unitCost: asTyped(line.unitCost ?? '0', 2),
    markupPct: asTyped(line.markupPct, 2, 2),
    unitPrice: asTyped(line.unitPrice, 2),
    basis: 'PRICE',
    vatCode: line.vatCode,
    vatRate: line.vatRate,
  });
}

/** How much a fresh catalogue line is marked up until someone says otherwise. */
export const DEFAULT_MARKUP = '20';

/**
 * A new line from a catalogue match: code, description, unit, cost and VAT are
 * copied now and from then on belong to the line, not the catalogue.
 */
export function lineFromHit(
  fb: FormBuilder,
  hit: CatalogueHit,
  section: string,
  fallbackVat: { code: string; rate: string } | null,
): LineGroup {
  const cost = new Decimal(hit.costPrice ?? '0');
  const hasCost = !cost.isZero();
  const price = hasCost ? unitAmount(cost.times(new Decimal(DEFAULT_MARKUP).div(100).plus(1))) : cost;

  // An item whose VAT code has no rate in force falls back to the default
  // rate rather than being unaddable; the user can still change it.
  const vat = hit.vatRate !== null ? { code: hit.vatCode, rate: hit.vatRate } : fallbackVat;

  return group(fb, {
    section,
    kind: hit.type,
    itemId: hit.id,
    sku: hit.sku,
    description: hit.description,
    unitCode: hit.baseUnitCode,
    quantity: '1',
    unitCost: tidy(cost, 2, 4),
    markupPct: hasCost ? DEFAULT_MARKUP : '',
    unitPrice: hasCost ? tidy(price, 2, 4) : '',
    basis: hasCost ? 'MARKUP' : 'PRICE',
    vatCode: vat?.code ?? '',
    vatRate: vat?.rate ?? '',
  });
}

/** A free line: no catalogue item, everything typed. A service unless changed. */
export function freeLine(
  fb: FormBuilder,
  section: string,
  defaults: { unitCode: string; vat: { code: string; rate: string } | null },
): LineGroup {
  return group(fb, {
    section,
    kind: 'SERVICE',
    itemId: null,
    sku: '',
    description: '',
    unitCode: defaults.unitCode,
    quantity: '1',
    unitCost: '0',
    markupPct: '',
    unitPrice: '',
    basis: 'PRICE',
    vatCode: defaults.vat?.code ?? '',
    vatRate: defaults.vat?.rate ?? '',
  });
}

/** The line's figures, or null while something in it is not yet a number. */
export function priceOf(value: LineValue): PricedLine | null {
  const quantity = decimalText(value.quantity, QUANTITY);
  const unitCost = decimalText(value.unitCost, UNIT_AMOUNT);
  const markupPct = decimalText(value.markupPct, MARKUP);
  const unitPrice = decimalText(value.unitPrice, UNIT_AMOUNT);
  const vatRate = decimalText(value.vatRate || '0', { integers: 3, decimals: 2 });
  if (quantity === null || unitCost === null || vatRate === null) return null;

  const costIsZero = new Decimal(unitCost).isZero();
  if (value.basis === 'MARKUP' && !costIsZero ? markupPct === null : unitPrice === null) return null;

  return priceLine({ quantity, unitCost, basis: value.basis, markupPct, unitPrice, vatRate });
}

/** The markup typed → the price shown. No-op until both sides are numbers. */
export function syncPriceFromMarkup(line: LineGroup): void {
  const c = line.controls;
  c.basis.setValue('MARKUP');
  const cost = decimalText(c.unitCost.value, UNIT_AMOUNT);
  const markup = decimalText(c.markupPct.value, MARKUP);
  if (cost === null || markup === null || new Decimal(cost).isZero()) return;
  const price = unitAmount(new Decimal(cost).times(new Decimal(markup).div(100).plus(1)));
  c.unitPrice.setValue(tidy(price, 2, 4));
}

/** The price typed → the markup shown ("" when the cost is 0: n/a). */
export function syncMarkupFromPrice(line: LineGroup): void {
  const c = line.controls;
  c.basis.setValue('PRICE');
  const cost = decimalText(c.unitCost.value, UNIT_AMOUNT);
  const price = decimalText(c.unitPrice.value, UNIT_AMOUNT);
  if (cost === null || price === null) return;
  if (new Decimal(cost).isZero()) {
    c.markupPct.setValue('');
    return;
  }
  const markup = percent(new Decimal(price).minus(cost).div(cost).times(100));
  c.markupPct.setValue(tidy(markup, 2, 2));
}

/** The cost changed: whichever of markup/price was typed stays, the other follows. */
export function syncAfterCost(line: LineGroup): void {
  const c = line.controls;
  const cost = decimalText(c.unitCost.value, UNIT_AMOUNT);
  if (cost !== null && new Decimal(cost).isZero()) {
    c.markupPct.setValue('');
    c.basis.setValue('PRICE');
    return;
  }
  if (c.basis.value === 'MARKUP' && c.markupPct.value.trim() !== '') syncPriceFromMarkup(line);
  else syncMarkupFromPrice(line);
}

/** What is sent for one line. Assumes the form is valid. */
export function toLineInput(value: LineValue): QuoteLineInput {
  const unitCost = decimalText(value.unitCost, UNIT_AMOUNT) ?? '0';
  const costIsZero = new Decimal(unitCost).isZero();
  // A zero cost cannot carry a markup, so the price is what counts.
  const basis: PriceBasis = costIsZero ? 'PRICE' : value.basis;

  return {
    section: value.section.trim() || null,
    kind: value.kind,
    itemId: value.itemId,
    sku: value.sku.trim() || null,
    description: value.description.trim(),
    unitCode: value.unitCode,
    quantity: decimalText(value.quantity, QUANTITY) ?? '0',
    unitCost,
    basis,
    markupPct: basis === 'MARKUP' ? decimalText(value.markupPct, MARKUP) : null,
    unitPrice: decimalText(value.unitPrice, UNIT_AMOUNT),
    vatCode: value.vatCode,
    vatRate: value.vatRate,
  };
}

/** Live totals over whatever lines currently parse; the server's replace them on save. */
export function previewTotals(values: readonly LineValue[]): QuoteTotals {
  return totalise(values.map(priceOf).filter((line): line is PricedLine => line !== null));
}
