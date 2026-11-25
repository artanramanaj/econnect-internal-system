import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/*
 * Form plumbing the item drawer and the add-product card share. Screen-local
 * on purpose: nothing outside features/products speaks "item".
 */

/**
 * "12", "12.5" or "12,5": up to 8 integer digits and 4 decimals, which is what
 * a Decimal(12, 4) column holds. The comma is how amounts are typed in Albanian.
 */
export const DECIMAL = /^\d{1,8}([.,]\d{1,4})?$/;

/** What was typed ("12,50") as what the API takes (12.5). */
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

/** "12.5000" from the API as someone would type it: "12.5". */
export function asTyped(value: string): string {
  return String(Number(value));
}

/** Mirrors the server's limit (constants/catalog.constants.ts). */
export const BROCHURE_MAX_MB = 25;

export type BrochureProblem = 'notPdf' | 'tooLarge';

/**
 * The client-side half of the PDF check, so an obviously wrong pick is
 * refused before 25 MB travel to the server. The server stays the judge.
 */
export function brochureProblem(file: File): BrochureProblem | null {
  if (!file.name.toLowerCase().endsWith('.pdf')) return 'notPdf';
  if (file.size > BROCHURE_MAX_MB * 1024 * 1024) return 'tooLarge';
  return null;
}

/** "1.2 MB" or "640 KB" for a brochure chip; '' when the size is unknown. */
export function sizeLabel(size: number | null): string {
  if (!size) return '';
  const mb = size / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;
}
