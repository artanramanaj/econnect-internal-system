import { PageMeta } from './pagination.model';

export type ItemType = 'PRODUCT' | 'SERVICE';

/** PRODATA items come from the nightly sync; LOCAL ones were created in the app. */
export type ItemSource = 'PRODATA' | 'LOCAL';

/** Which rows the list shows. `active` hides archived items. */
export type ItemStatusFilter = 'active' | 'archived' | 'all';

/** A managed category or brand as the dropdowns use it. */
export interface CatalogRefOption {
  id: number;
  name: string;
}

/** A managed category or brand as the management tables show it. */
export interface CatalogRef extends CatalogRefOption {
  /** Items pointing at it; while above zero it cannot be deleted. */
  itemCount: number;
}

/** The one PDF (brochure/datasheet) an item may carry. */
export interface ItemBrochure {
  /** The name it was uploaded with. */
  name: string;
  /** Bytes. */
  size: number | null;
}

/**
 * A row of the catalogue list. Money and factors arrive as fixed four-place
 * decimal strings ("12.5000"), never as floats.
 */
export interface Item {
  id: number;
  sku: string;
  description: string;
  type: ItemType;
  source: ItemSource;
  category: CatalogRefOption | null;
  brand: CatalogRefOption | null;
  manufacturer: string | null;
  barcode: string | null;
  baseUnitCode: string;
  vatCode: string;
  isArchived: boolean;
  /** ProData tblArtikujt.ID; null on LOCAL items. */
  sourceId: number | null;
  brochure: ItemBrochure | null;
  lastSyncedAt: string | null;
  updatedAt: string;
  /** Absent — not null — unless the signed-in user holds quote.view_cost. */
  costPrice?: string;
}

/** An alternative unit: one of `unitCode` holds `factor` base units. */
export interface ItemUnit {
  unitCode: string;
  factor: string;
}

export interface CostHistoryEntry {
  id: number;
  /** Null on an item's first entry. */
  oldCost: string | null;
  newCost: string;
  source: ItemSource;
  changedAt: string;
  /** Username of whoever changed it; null when the sync did. */
  changedBy: string | null;
}

export interface ItemDetail extends Item {
  units: ItemUnit[];
  /** Newest first, at most 20. Absent unless the user may see cost. */
  costHistory?: CostHistoryEntry[];
}

export interface UnitOption {
  code: string;
  name: string;
}

export interface VatRateOption {
  code: string;
  name: string;
  /** Percent as a decimal string: "18.00". */
  rate: string;
}

/** Everything the item forms and the list filters offer. */
export interface ItemOptions {
  units: UnitOption[];
  /** Only the rates in force today. */
  vatRates: VatRateOption[];
  categories: CatalogRefOption[];
  brands: CatalogRefOption[];
  manufacturers: string[];
  /** Fields the ProData sync owns: read-only on PRODATA items. */
  syncOwnedFields: string[];
}

export const EMPTY_ITEM_OPTIONS: ItemOptions = {
  units: [],
  vatRates: [],
  categories: [],
  brands: [],
  manufacturers: [],
  syncOwnedFields: [],
};

export interface ItemsResponse {
  items: Item[];
  canViewCost: boolean;
  meta: PageMeta;
}

export interface ItemDetailResponse {
  item: ItemDetail;
  canViewCost: boolean;
}

/** Every write returns the fresh item with its units and history. */
export interface ItemResponse {
  message: string;
  item: ItemDetail;
}

/** What one load of the list asks for. Empty strings mean "no filter". */
export interface ItemQuery {
  q?: string;
  type?: ItemType | '';
  /** The select's value: an id as a string, or '' for all. */
  categoryId?: string;
  brandId?: string;
  source?: ItemSource | '';
  status: ItemStatusFilter;
  page: number;
}

export interface ItemUnitInput {
  unitCode: string;
  factor: number;
}

export interface CreateItemRequest {
  sku: string;
  description: string;
  type: ItemType;
  categoryId?: number;
  brandId?: number;
  manufacturer?: string;
  barcode?: string;
  baseUnitCode: string;
  vatCode: string;
  costPrice?: number;
  units?: ItemUnitInput[];
}

/** Any subset. Null clears an optional field; `units` replaces the whole list. */
export interface UpdateItemRequest {
  sku?: string;
  description?: string;
  type?: ItemType;
  categoryId?: number | null;
  brandId?: number | null;
  manufacturer?: string | null;
  barcode?: string | null;
  baseUnitCode?: string;
  vatCode?: string;
  costPrice?: number;
  units?: ItemUnitInput[];
  isArchived?: boolean;
}
