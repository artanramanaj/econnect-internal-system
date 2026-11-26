import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AbstractControl, FormArray, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Decimal } from 'decimal.js';
import { UnitOption, VatRateOption } from '../../../core/models/item.model';
import { ErrorMessage } from '../../../shared/components/error-message/error-message';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import {
  LineGroup,
  priceOf,
  syncAfterCost,
  syncMarkupFromPrice,
  syncPriceFromMarkup,
} from '../quote-form';
import { isLowMarkup } from '../quote-pricing';

/**
 * The line-items table of the quote editor. It edits the parent's FormArray in
 * place — the parent owns the form and reads the totals from it — and holds
 * only the two-way pricing: typing a markup fills the price, typing a price
 * fills the markup.
 *
 * Lines are shown in array order; a section header appears wherever a line's
 * section differs from the one before it.
 */
@Component({
  selector: 'app-quote-lines',
  imports: [ReactiveFormsModule, TranslatePipe, ErrorMessage, MoneyPipe],
  templateUrl: './quote-lines.html',
  styleUrls: ['../../../shared/styles/type-scale.css'],
  host: { class: 'contents' },
  // Eager, not the default OnPush: the rows live in a FormArray the parent
  // mutates in place (loading a quote, adding a line from the search), and a
  // FormArray's contents are not a signal — the `lines` input stays the same
  // object, so OnPush would never re-render the table.
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class QuoteLines {
  readonly lines = input.required<FormArray<LineGroup>>();
  readonly units = input<UnitOption[]>([]);
  /** The rates in force today. */
  readonly vatRates = input<VatRateOption[]>([]);
  /** Lines marked up less than this (percent) are highlighted. */
  readonly minMarkupPct = input('10');
  /** Cost and markup columns; the server sends them only with quote.view_cost. */
  readonly canViewCost = input(false);
  /** False when the quote can no longer be edited or the user may not edit. */
  readonly editable = input(true);

  /** True for the first line of each run of lines sharing a section. */
  startsSection(index: number): boolean {
    const controls = this.lines().controls;
    if (index === 0) return true;
    return controls[index]!.controls.section.value !== controls[index - 1]!.controls.section.value;
  }

  /** Renames the whole run this line starts, so a section is renamed once. */
  renameSection(index: number, event: Event): void {
    const name = (event.target as HTMLInputElement).value.trim();
    const controls = this.lines().controls;
    const old = controls[index]!.controls.section.value;
    for (let i = index; i < controls.length; i++) {
      if (controls[i]!.controls.section.value !== old) break;
      controls[i]!.controls.section.setValue(name);
    }
  }

  onMarkup(line: LineGroup): void {
    syncPriceFromMarkup(line);
  }

  onPrice(line: LineGroup): void {
    syncMarkupFromPrice(line);
  }

  onCost(line: LineGroup): void {
    syncAfterCost(line);
  }

  /** A picked VAT code brings today's rate with it. */
  onVat(line: LineGroup): void {
    const rate = this.vatRates().find((v) => v.code === line.controls.vatCode.value);
    if (rate) line.controls.vatRate.setValue(rate.rate);
  }

  /**
   * The rate choices for one line: today's rates, plus the line's own when it
   * holds a code or rate that is no longer in force — a saved line keeps the
   * rate of its day, and the select must be able to show it.
   */
  vatChoices(line: LineGroup): { code: string; label: string }[] {
    const choices = this.vatRates().map((v) => ({ code: v.code, label: `${Number(v.rate)}%` }));
    const { vatCode, vatRate } = line.controls;
    const current = this.vatRates().find((v) => v.code === vatCode.value);
    if (vatCode.value && (!current || current.rate !== vatRate.value)) {
      return [
        { code: vatCode.value, label: `${Number(vatRate.value)}%` },
        ...choices.filter((c) => c.code !== vatCode.value),
      ];
    }
    return choices;
  }

  remove(index: number): void {
    this.lines().removeAt(index);
  }

  /** "1080.00", or null while the line does not parse yet. */
  lineTotal(line: LineGroup): string | null {
    return priceOf(line.getRawValue())?.lineTotal.toFixed(2) ?? null;
  }

  costIsZero(line: LineGroup): boolean {
    const cost = line.controls.unitCost.value.trim().replace(',', '.');
    return /^0*(\.0*)?$/.test(cost) && cost !== '';
  }

  /** Below the approval threshold: a warning, never a blocker. */
  isLow(line: LineGroup): boolean {
    const markup = priceOf(line.getRawValue())?.markupPct ?? null;
    return isLowMarkup(markup, new Decimal(this.minMarkupPct() || '0'));
  }

  /** Touched and wrong: when a field shows as invalid. */
  invalid(control: AbstractControl): boolean {
    return control.touched && control.invalid;
  }

  /** Any field of the line touched and wrong: when the row shows its message. */
  lineInvalid(line: LineGroup): boolean {
    return Object.values(line.controls).some((control) => this.invalid(control));
  }

  columns(): number {
    return this.canViewCost() ? 10 : 8;
  }
}
