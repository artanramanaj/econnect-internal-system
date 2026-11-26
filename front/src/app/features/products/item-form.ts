/*
 * Form plumbing the item drawer and the add-product card share. Screen-local
 * on purpose: nothing outside features/products speaks "item". The decimal
 * input helpers moved to shared/forms/decimal.ts once quotes needed them too.
 */

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
