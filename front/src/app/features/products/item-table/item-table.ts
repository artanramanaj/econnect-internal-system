import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { EMPTY_PAGE, PageMeta } from '../../../core/models/pagination.model';
import {
  EMPTY_ITEM_OPTIONS,
  Item,
  ItemOptions,
  ItemSource,
  ItemStatusFilter,
  ItemType,
} from '../../../core/models/item.model';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { CodeLabelPipe } from '../../../shared/pipes/code-label.pipe';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';

/** The list's exact-match filters. The search box travels separately: it is debounced. */
export interface ItemFilters {
  type: ItemType | '';
  /** The picked id as the select holds it: a string, '' for all. */
  categoryId: string;
  brandId: string;
  source: ItemSource | '';
  status: ItemStatusFilter;
}

export const DEFAULT_ITEM_FILTERS: ItemFilters = {
  type: '',
  categoryId: '',
  brandId: '',
  source: '',
  status: 'active',
};

@Component({
  selector: 'app-item-table',
  imports: [Pagination, TranslatePipe, CodeLabelPipe, MoneyPipe],
  templateUrl: './item-table.html',
  styleUrls: ['../../../shared/styles/type-scale.css'],
  // `contents` keeps the host out of the layout box model, so the inner
  // <section> stays a direct child of the page's column.
  host: { class: 'contents' },
})
export class ItemTable {
  /** One page of the catalogue; `meta` says which and how many there are. */
  readonly items = input<Item[]>([]);

  readonly meta = input<PageMeta>(EMPTY_PAGE);

  /** Category and brand filters, and the VAT rates the VAT column reads. */
  readonly options = input<ItemOptions>(EMPTY_ITEM_OPTIONS);

  readonly canViewCost = input(false);

  /** Labels the row button Edit rather than View, and offers row-level upload. */
  readonly canManage = input(false);

  readonly loading = input(false);

  readonly search = output<string>();
  readonly filterChange = output<Partial<ItemFilters>>();
  readonly open = output<Item>();
  /** The row whose PDF to open in a new tab. */
  readonly openPdf = output<Item>();
  readonly pageChange = output<number>();

  readonly types: ItemType[] = ['PRODUCT', 'SERVICE'];
  readonly sources: ItemSource[] = ['PRODATA', 'LOCAL'];
  /** `active` first: it is the default, and an uncontrolled select starts on its first option. */
  readonly statuses: ItemStatusFilter[] = ['active', 'archived', 'all'];

  onSearch(event: Event): void {
    this.search.emit((event.target as HTMLInputElement).value.trim());
  }

  onFilter(field: keyof ItemFilters, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filterChange.emit({ [field]: value } as Partial<ItemFilters>);
  }

  /** Brand and manufacturer under the description; once when they are the same. */
  maker(item: Item): string {
    return [
      ...new Set([item.brand?.name, item.manufacturer].filter((v): v is string => !!v)),
    ].join(' · ');
  }

  /** "18%" from the rates in force; a code with no current rate shows as itself. */
  vatLabel(code: string): string {
    const rate = this.options().vatRates.find((v) => v.code === code);
    return rate ? `${Number(rate.rate)}%` : code;
  }
}
