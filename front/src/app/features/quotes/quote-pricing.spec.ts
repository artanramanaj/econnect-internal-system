import { Decimal } from 'decimal.js';
import { isLowMarkup, needsApproval, priceLine, totalise } from './quote-pricing';

/*
 * The same vectors as back/services/quotePricing.test.ts: the two copies of
 * the module must agree to the cent.
 */

/** Compare as fixed strings: a Decimal has no meaningful deep equality. */
const s = (value: Decimal | null, dp: number) => (value === null ? null : value.toFixed(dp));

describe('quote pricing', () => {
  describe('priceLine', () => {
    it('should derive the price from a typed markup', () => {
      const line = priceLine({ quantity: '12', unitCost: '72', basis: 'MARKUP', markupPct: '25', vatRate: '18' });

      expect(s(line.unitPrice, 4)).toBe('90.0000');
      expect(s(line.lineTotal, 2)).toBe('1080.00');
      expect(s(line.lineCost, 2)).toBe('864.00');
    });

    it('should derive the markup from a typed price', () => {
      const line = priceLine({ quantity: '600', unitCost: '0.42', basis: 'PRICE', unitPrice: '0.62', vatRate: '18' });

      expect(s(line.markupPct, 4)).toBe('47.6190');
      expect(s(line.lineTotal, 2)).toBe('372.00');
    });

    it('should keep unit prices to 4 decimals and totals to 2, half-up', () => {
      const unit = priceLine({ quantity: '1', unitCost: '1.005', basis: 'MARKUP', markupPct: '10', vatRate: '18' });
      expect(s(unit.unitPrice, 4)).toBe('1.1055');
      expect(s(unit.lineTotal, 2)).toBe('1.11');

      const half = priceLine({ quantity: '1', unitCost: '0.1', basis: 'PRICE', unitPrice: '0.125', vatRate: '18' });
      expect(s(half.lineTotal, 2)).toBe('0.13');
    });

    it('should not suffer float drift', () => {
      const a = priceLine({ quantity: '3', unitCost: '0.05', basis: 'PRICE', unitPrice: '0.1', vatRate: '18' });
      expect(s(a.lineTotal, 2)).toBe('0.30');
      const b = priceLine({ quantity: '100', unitCost: '1', basis: 'PRICE', unitPrice: '1.15', vatRate: '18' });
      expect(s(b.lineTotal, 2)).toBe('115.00');
    });

    it('should report the markup as n/a when the unit cost is 0', () => {
      const line = priceLine({ quantity: '2', unitCost: '0', basis: 'MARKUP', markupPct: '30', unitPrice: '45', vatRate: '18' });

      expect(line.markupPct).toBeNull();
      expect(s(line.lineTotal, 2)).toBe('90.00');
    });

    it('should show the gross margin on the line total, for display', () => {
      const line = priceLine({ quantity: '12', unitCost: '72', basis: 'MARKUP', markupPct: '25', vatRate: '18' });
      expect(s(line.marginPct, 2)).toBe('20.00');
    });
  });

  describe('totalise', () => {
    const lines = [
      priceLine({ quantity: '12', unitCost: '72', basis: 'MARKUP', markupPct: '25', vatRate: '18' }),
      priceLine({ quantity: '1', unitCost: '920', basis: 'MARKUP', markupPct: '25', vatRate: '8' }),
      priceLine({ quantity: '600', unitCost: '0.42', basis: 'PRICE', unitPrice: '0.62', vatRate: '18.00' }),
    ];

    it('should sum totals and group VAT by rate, highest first', () => {
      const totals = totalise(lines);

      expect(s(totals.subtotal, 2)).toBe('2602.00');
      expect(s(totals.totalCost, 2)).toBe('2036.00');
      expect(totals.vatBreakdown.map((b) => [s(b.rate, 2), s(b.base, 2), s(b.vat, 2)])).toEqual([
        ['18.00', '1452.00', '261.36'],
        ['8.00', '1150.00', '92.00'],
      ]);
      expect(s(totals.vatTotal, 2)).toBe('353.36');
      expect(s(totals.grandTotal, 2)).toBe('2955.36');
      expect(s(totals.overallMarkupPct, 4)).toBe('27.7996');
    });

    it('should round VAT once per rate, not per line', () => {
      const tiny = [1, 2, 3].map(() =>
        priceLine({ quantity: '1', unitCost: '0.01', basis: 'PRICE', unitPrice: '0.03', vatRate: '18' }),
      );
      expect(s(totalise(tiny).vatTotal, 2)).toBe('0.02');
    });

    it('should have no overall markup without cost or without lines', () => {
      const free = [priceLine({ quantity: '1', unitCost: '0', basis: 'PRICE', unitPrice: '50', vatRate: '18' })];
      expect(totalise(free).overallMarkupPct).toBeNull();
      expect(totalise([]).overallMarkupPct).toBeNull();
      expect(s(totalise([]).grandTotal, 2)).toBe('0.00');
    });
  });

  describe('approval threshold', () => {
    it('should need approval strictly below the threshold it is given', () => {
      expect(needsApproval(new Decimal('9.9999'), '10')).toBe(true);
      expect(needsApproval(new Decimal('10'), '10')).toBe(false);
      expect(needsApproval(new Decimal('12'), '15')).toBe(true);
      expect(needsApproval(null, '10')).toBe(false);
    });

    it('should flag a single low line without blocking', () => {
      expect(isLowMarkup(new Decimal('5'), '10')).toBe(true);
      expect(isLowMarkup(new Decimal('10'), '10')).toBe(false);
      expect(isLowMarkup(null, '10')).toBe(false);
    });
  });
});
