import { QuoteStatus } from '../../core/models/quote.model';

/**
 * Pill colours per status, shared by the list and the editor. Waiting states
 * are amber, sendable/sent blue, won green, lost red, the rest neutral.
 */
export const STATUS_CLASSES: Record<QuoteStatus, string> = {
  DRAFT: 'bg-grp-user-bg text-grp-user-fg',
  PENDING_APPROVAL: 'bg-grp-tl-bg text-grp-tl-fg',
  READY_TO_SEND: 'bg-pill-bg text-pill-fg',
  SENT: 'bg-pill-bg text-pill-fg',
  ACCEPTED: 'bg-yes-bg text-yes-fg',
  DECLINED: 'bg-danger/10 text-danger',
  EXPIRED: 'bg-grp-tech-bg text-grp-tech-fg',
  CANCELLED: 'bg-grp-tech-bg text-grp-tech-fg',
};

/** "27.7996" as "27.8": one decimal is all a markup needs on screen. */
export function shortPercent(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(1) : '';
}
