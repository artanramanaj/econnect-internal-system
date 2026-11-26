import { Decimal } from 'decimal.js';

/*
 * Quote arithmetic, for instant feedback while typing. This is the same code
 * as the server's back/services/quotePricing.ts — change both together. The
 * server recalculates on every save and its result is what is stored; this
 * copy only saves a round trip per keystroke.
 *
 * Money is Decimal end to end and never passes through a JS number. Unit
 * prices and unit costs keep 4 decimals, totals 2, both rounded half-up.
 */

const HALF_UP = Decimal.ROUND_HALF_UP;

/** Totals: 2 decimals. */
export function money(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, HALF_UP);
}

/** Unit prices and unit costs: 4 decimals. */
export function unitAmount(value: Decimal): Decimal {
  return value.toDecimalPlaces(4, HALF_UP);
}

/** Percentages: 4 decimals, which is what Decimal(9, 4) stores. */
export function percent(value: Decimal): Decimal {
  return value.toDecimalPlaces(4, HALF_UP);
}

/**
 * Which of the two the user typed; the other is derived.
 *  MARKUP: unit price = unit cost × (1 + markup / 100)
 *  PRICE:  markup     = (unit price − unit cost) / unit cost × 100
 */
export type PriceBasis = 'MARKUP' | 'PRICE';

export interface LineInput {
  quantity: Decimal.Value;
  unitCost: Decimal.Value;
  basis: PriceBasis;
  /** Read when basis is MARKUP. */
  markupPct?: Decimal.Value | null;
  /** Read when basis is PRICE, or when the unit cost is 0. */
  unitPrice?: Decimal.Value | null;
  /** Percent, e.g. 18 for 18%. */
  vatRate: Decimal.Value;
}

export interface PricedLine {
  quantity: Decimal;
  unitCost: Decimal;
  /** null when the unit cost is 0: a markup on nothing is undefined ('n/a'). */
  markupPct: Decimal | null;
  unitPrice: Decimal;
  lineCost: Decimal;
  lineTotal: Decimal;
  vatRate: Decimal;
  /** Gross margin on the line, (total − cost) / total × 100. Display only. */
  marginPct: Decimal | null;
}

export function priceLine(input: LineInput): PricedLine {
  const quantity = new Decimal(input.quantity);
  const unitCost = unitAmount(new Decimal(input.unitCost));
  const vatRate = new Decimal(input.vatRate);

  let unitPrice: Decimal;
  let markupPct: Decimal | null;

  if (unitCost.isZero()) {
    // No cost to mark up: the price is whatever was typed, the markup 'n/a'.
    unitPrice = unitAmount(new Decimal(input.unitPrice ?? 0));
    markupPct = null;
  } else if (input.basis === 'MARKUP') {
    markupPct = percent(new Decimal(input.markupPct ?? 0));
    unitPrice = unitAmount(unitCost.times(markupPct.div(100).plus(1)));
  } else {
    unitPrice = unitAmount(new Decimal(input.unitPrice ?? 0));
    markupPct = percent(unitPrice.minus(unitCost).div(unitCost).times(100));
  }

  const lineTotal = money(unitPrice.times(quantity));
  const lineCost = money(unitCost.times(quantity));
  const marginPct = lineTotal.isZero()
    ? null
    : lineTotal.minus(lineCost).div(lineTotal).times(100).toDecimalPlaces(2, HALF_UP);

  return { quantity, unitCost, markupPct, unitPrice, lineCost, lineTotal, vatRate, marginPct };
}

export interface VatBand {
  /** Percent, e.g. 18. */
  rate: Decimal;
  /** Sum of the line totals taxed at this rate. */
  base: Decimal;
  vat: Decimal;
}

export interface QuoteTotals {
  subtotal: Decimal;
  totalCost: Decimal;
  /** One entry per VAT rate in use, highest rate first. */
  vatBreakdown: VatBand[];
  vatTotal: Decimal;
  grandTotal: Decimal;
  /** (subtotal − total cost) / total cost × 100; null when total cost is 0. */
  overallMarkupPct: Decimal | null;
}

/**
 * VAT is computed per rate on that rate's summed line totals and rounded once
 * per rate — not per line, which would let rounding drift on long quotes.
 */
export function totalise(
  lines: ReadonlyArray<Pick<PricedLine, 'lineTotal' | 'lineCost' | 'vatRate'>>,
): QuoteTotals {
  let subtotal = new Decimal(0);
  let totalCost = new Decimal(0);
  const bases = new Map<string, { rate: Decimal; base: Decimal }>();

  for (const line of lines) {
    subtotal = subtotal.plus(line.lineTotal);
    totalCost = totalCost.plus(line.lineCost);

    // Keyed by the fixed form so 18 and 18.00 land in one band.
    const key = line.vatRate.toFixed(2);
    const band = bases.get(key);
    if (band) band.base = band.base.plus(line.lineTotal);
    else bases.set(key, { rate: line.vatRate, base: new Decimal(line.lineTotal) });
  }

  const vatBreakdown = [...bases.values()]
    .map(({ rate, base }) => ({ rate, base, vat: money(base.times(rate).div(100)) }))
    .sort((a, b) => b.rate.comparedTo(a.rate));

  const vatTotal = vatBreakdown.reduce((sum, band) => sum.plus(band.vat), new Decimal(0));

  return {
    subtotal,
    totalCost,
    vatBreakdown,
    vatTotal,
    grandTotal: subtotal.plus(vatTotal),
    overallMarkupPct: totalCost.isZero()
      ? null
      : percent(subtotal.minus(totalCost).div(totalCost).times(100)),
  };
}

/**
 * The approval rule: a quote whose overall markup is below the threshold needs
 * an admin's approval before it can be sent. Exactly at the threshold passes.
 * With no cost at all there is no markup to judge, so nothing to approve.
 */
export function needsApproval(
  overallMarkupPct: Decimal | null,
  thresholdPct: Decimal.Value,
): boolean {
  return overallMarkupPct !== null && overallMarkupPct.lessThan(thresholdPct);
}

/** A single line under the threshold: highlighted as a warning, never blocking. */
export function isLowMarkup(markupPct: Decimal | null, thresholdPct: Decimal.Value): boolean {
  return markupPct !== null && markupPct.lessThan(thresholdPct);
}
