import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/*
 * Decimal inputs. Amounts are typed into text inputs (never type="number":
 * its wheel and locale behaviour corrupt money), with a comma or a dot — the
 * comma is how amounts are typed in Albanian.
 */

/**
 * "12", "12.5" or "12,5": up to 8 integer digits and 4 decimals, which is what
 * a Decimal(12, 4) column holds.
 */
export const DECIMAL = /^\d{1,8}([.,]\d{1,4})?$/;

/** What was typed ("12,50") as a number (12.5). For values that are not money. */
export function parseDecimal(text: string): number {
  return Number(text.trim().replace(',', '.'));
}

/** Empty passes, since that is `required`'s job; anything else must be a decimal. */
export function decimal(options: { positive?: boolean } = {}): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const text = String(control.value ?? '').trim();
    if (text === '') return null;
    if (!DECIMAL.test(text)) return { decimal: true };
    if (options.positive && parseDecimal(text) <= 0) return { decimal: true };
    return null;
  };
}

/** `required`, but whitespace does not count: the server trims before it checks. */
export const notBlank: ValidatorFn = (control) =>
  String(control.value ?? '').trim() === '' ? { required: true } : null;

export interface DecimalShape {
  /** Digits allowed before the separator. */
  integers: number;
  /** Digits allowed after it. */
  decimals: number;
  /** Whether a leading minus is accepted. */
  signed?: boolean;
}

/**
 * What was typed ("12,50") as the canonical text the API takes ("12.50"), or
 * null when it is not a decimal of the given shape. Text in, text out: money
 * must reach Decimal without ever becoming a JS number.
 */
export function decimalText(text: string, shape: DecimalShape): string | null {
  const value = String(text ?? '').trim().replace(',', '.');
  const pattern = new RegExp(
    `^${shape.signed ? '-?' : ''}\\d{1,${shape.integers}}(\\.\\d{1,${shape.decimals}})?$`,
  );
  return pattern.test(value) ? value : null;
}

/** Validator form of decimalText. Empty passes: that is `required`'s job. */
export function decimalShape(shape: DecimalShape, options: { positive?: boolean } = {}): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const text = String(control.value ?? '').trim();
    if (text === '') return null;
    const value = decimalText(text, shape);
    if (value === null) return { decimal: true };
    // Sign test on the text, not on a number: "0.0000" is zero, "-1" negative.
    if (options.positive && /^-?0*(\.0*)?$/.test(value)) return { decimal: true };
    return null;
  };
}
