import { UnitOption, VatRateOption } from './item.model';
import { PageMeta } from './pagination.model';

export type QuoteStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'READY_TO_SEND'
  | 'SENT'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'CANCELLED';

/** In lifecycle order; the list's status views follow it. */
export const QUOTE_STATUSES: QuoteStatus[] = [
  'DRAFT',
  'PENDING_APPROVAL',
  'READY_TO_SEND',
  'SENT',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED',
  'CANCELLED',
];

export type ApprovalStatus = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';
export type QuoteLineKind = 'PRODUCT' | 'SERVICE';

/** Which of markup and price the user typed; the server derives the other. */
export type PriceBasis = 'MARKUP' | 'PRICE';

export interface Person {
  id: number;
  name: string;
}

export interface QuotePartner {
  id: number;
  partnerNumber: string;
  legalName: string;
  tradeName: string | null;
  city: string | null;
}

/**
 * A row of the quotes list. Money arrives as fixed decimal strings
 * ("1080.00"), never as floats.
 */
export interface QuoteRow {
  id: number;
  quoteNumber: string;
  title: string;
  label: string | null;
  status: QuoteStatus;
  createdAt: string;
  partner: QuotePartner;
  createdBy: Person;
  /** The current revision: "1.2". */
  version: string | null;
  revisionCount: number;
  subtotal: string | null;
  grandTotal: string | null;
  approvalStatus: ApprovalStatus | null;
  /** Absent — not null — unless the user holds quote.view_cost. */
  overallMarkupPct?: string | null;
}

export interface QuotesResponse {
  quotes: QuoteRow[];
  /** Per status plus "ALL", under the current filters except the status itself. */
  statusCounts: Record<string, number>;
  canViewCost: boolean;
  meta: PageMeta;
}

export interface QuoteLine {
  id: number;
  sortOrder: number;
  section: string | null;
  kind: QuoteLineKind;
  /** null on a free line with no catalogue item behind it. */
  itemId: number | null;
  sku: string | null;
  description: string;
  unitCode: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  vatCode: string;
  vatRate: string;
  /** The three below are absent unless the user holds quote.view_cost. */
  unitCost?: string;
  /** null when the unit cost is 0. */
  markupPct?: string | null;
  lineCost?: string;
}

export interface VatBand {
  rate: string;
  base: string;
  vat: string;
}

/** One revision without its lines, as the versions list shows it. */
export interface RevisionHead {
  id: number;
  /** "1.2" */
  version: string;
  kind: 'NORMAL' | 'CHANGE_ORDER';
  isCurrent: boolean;
  isLocked: boolean;
  subtotal: string;
  vatTotal: string;
  grandTotal: string;
  approvalStatus: ApprovalStatus;
  /** Whoever approved or rejected. */
  approvedBy: Person | null;
  approvedAt: string | null;
  rejectionNote: string | null;
  createdBy: Person;
  createdAt: string;
  totalCost?: string;
  overallMarkupPct?: string | null;
}

export interface QuoteRevision extends RevisionHead {
  vatBreakdown: VatBand[];
  lines: QuoteLine[];
}

/** A quote with its current revision and that revision's lines. */
export interface QuoteDetail {
  id: number;
  quoteNumber: string;
  title: string;
  label: string | null;
  status: QuoteStatus;
  /** "2026-12-31" */
  validUntil: string | null;
  paymentTerms: string | null;
  notes: string | null;
  /** Optimistic lock: sent back with a save, which is refused when stale. */
  version: number;
  createdAt: string;
  updatedAt: string;
  partner: QuotePartner;
  site: { id: number; name: string } | null;
  createdBy: Person;
  revisionCount: number;
  revision: QuoteRevision;
}

export interface QuoteDetailResponse {
  quote: QuoteDetail;
  canViewCost: boolean;
}

/** Every write answers with the fresh quote. */
export interface QuoteSaveResponse {
  message: string;
  quote: QuoteDetail;
  /**
   * Create and save only: the overall markup is below the minimum — held for
   * approval, or (for an approver's own save) a warning only.
   */
  lowMarkup?: boolean;
}

/** What the list filters and the editor offer. */
export interface QuoteOptions {
  authors: Person[];
  units: UnitOption[];
  /** Only the rates in force today. */
  vatRates: VatRateOption[];
  /** Overall markup (percent) below which a quote needs approval: "10.00". */
  minMarkupPct: string;
  editableStatuses: QuoteStatus[];
  canViewCost: boolean;
  canApprove: boolean;
}

export const EMPTY_QUOTE_OPTIONS: QuoteOptions = {
  authors: [],
  units: [],
  vatRates: [],
  minMarkupPct: '10.00',
  editableStatuses: [],
  canViewCost: false,
  canApprove: false,
};

/** A catalogue match in the editor's line picker. */
export interface CatalogueHit {
  id: number;
  sku: string;
  description: string;
  type: QuoteLineKind;
  baseUnitCode: string;
  vatCode: string;
  /** The rate in force today; null when the item's code has none. */
  vatRate: string | null;
  category: string | null;
  hasBrochure: boolean;
  costPrice?: string;
}

/** One line as it is saved. Amounts are decimal text, never numbers. */
export interface QuoteLineInput {
  section: string | null;
  kind: QuoteLineKind;
  itemId: number | null;
  sku: string | null;
  description: string;
  unitCode: string;
  quantity: string;
  unitCost: string;
  basis: PriceBasis;
  markupPct: string | null;
  unitPrice: string | null;
  vatCode: string;
  vatRate: string;
}

interface QuoteHeaderInput {
  siteId: number | null;
  title: string;
  label: string | null;
  validUntil: string | null;
  paymentTerms: string | null;
  notes: string | null;
  lines: QuoteLineInput[];
}

export interface CreateQuoteRequest extends QuoteHeaderInput {
  partnerId: number;
}

/** A save of an existing quote, which creates the next revision. */
export interface UpdateQuoteRequest extends QuoteHeaderInput {
  version: number;
}

export type QuoteSortField = 'createdAt' | 'quoteNumber' | 'title' | 'status';

/** What one load of the list asks for. Empty strings mean "no filter". */
export interface QuoteQuery {
  q?: string;
  partnerId?: string;
  createdById?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: QuoteStatus | '';
  sortBy: QuoteSortField;
  sortDir: 'asc' | 'desc';
  page: number;
}
