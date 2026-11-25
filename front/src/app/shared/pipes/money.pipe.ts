import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from '../../core/services/language.service';

/**
 * A money amount, as the API sends it ("12.5000"), in the UI's locale:
 * "€12.50" in English, "12,50 €" in Albanian. Keeps up to four decimals when
 * the amount has them (cable by the metre), never shows fewer than two.
 *
 * Impure on purpose: a pure pipe would not re-run on a language switch.
 */
@Pipe({ name: 'money', pure: false })
export class MoneyPipe implements PipeTransform {
  private language = inject(LanguageService);

  /** Building an Intl.NumberFormat is the slow part, and this runs per row. */
  private cached: { key: string; format: Intl.NumberFormat } | null = null;

  transform(value: string | number | null | undefined, currency = 'EUR'): string {
    if (value === null || value === undefined || value === '') return '—';
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '—';
    return this.formatter(currency).format(amount);
  }

  private formatter(currency: string): Intl.NumberFormat {
    const locale = this.language.locale();
    const key = `${locale}|${currency}`;
    if (this.cached?.key !== key) {
      this.cached = {
        key,
        format: new Intl.NumberFormat(locale, {
          style: 'currency',
          currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 4,
        }),
      };
    }
    return this.cached.format;
  }
}
