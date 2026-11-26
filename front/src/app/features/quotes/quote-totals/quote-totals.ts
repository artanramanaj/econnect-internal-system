import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Decimal } from 'decimal.js';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { QuoteTotals as Totals, needsApproval } from '../quote-pricing';

const EMPTY: Totals = {
  subtotal: new Decimal(0),
  totalCost: new Decimal(0),
  vatBreakdown: [],
  vatTotal: new Decimal(0),
  grandTotal: new Decimal(0),
  overallMarkupPct: null,
};

/**
 * The totals beside the notes: what the client will see (subtotal, VAT per
 * rate, total), and — for users who may see cost — the internal figures that
 * are never printed. Fed with the live preview while editing.
 */
@Component({
  selector: 'app-quote-totals',
  imports: [TranslatePipe, MoneyPipe],
  templateUrl: './quote-totals.html',
  styleUrls: ['../../../shared/styles/type-scale.css'],
  host: { class: 'contents' },
})
export class QuoteTotals {
  readonly totals = input<Totals>(EMPTY);
  /** The internal card; the server sends costs only with quote.view_cost. */
  readonly canViewCost = input(false);
  /** Overall markup (percent) below which the quote needs approval. */
  readonly minMarkupPct = input('10');
  /**
   * The user holds quote.approve: their own save below the minimum is not
   * held, so the note is a warning rather than "will be sent for approval".
   */
  readonly approver = input(false);

  /** Strings for the money pipe: the Decimals never become numbers here. */
  readonly view = computed(() => {
    const t = this.totals();
    return {
      subtotal: t.subtotal.toFixed(2),
      vatBands: t.vatBreakdown.map((band) => ({
        // "18" rather than "18.00"; "8.5" stays as it is.
        rate: band.rate.toDecimalPlaces(2).toString(),
        vat: band.vat.toFixed(2),
      })),
      grandTotal: t.grandTotal.toFixed(2),
      totalCost: t.totalCost.toFixed(2),
      profit: t.subtotal.minus(t.totalCost).toFixed(2),
      markup: t.overallMarkupPct === null ? null : t.overallMarkupPct.toFixed(1),
      low: needsApproval(t.overallMarkupPct, new Decimal(this.minMarkupPct() || '0')),
    };
  });
}
