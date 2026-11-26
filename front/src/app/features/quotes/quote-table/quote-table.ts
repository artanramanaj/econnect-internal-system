import { Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { EMPTY_PAGE, PageMeta } from '../../../core/models/pagination.model';
import { Partner } from '../../../core/models/partner.model';
import {
  Person,
  QUOTE_STATUSES,
  QuoteRow,
  QuoteSortField,
  QuoteStatus,
} from '../../../core/models/quote.model';
import { LanguageService } from '../../../core/services/language.service';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { STATUS_CLASSES, shortPercent } from '../quote-status';

/** The list's exact-match filters. The search box travels separately: it is debounced. */
export interface QuoteFilters {
  /** Ids as the selects hold them: strings, '' for all. */
  partnerId: string;
  createdById: string;
  /** "2026-11-25", '' for open-ended. */
  dateFrom: string;
  dateTo: string;
  status: QuoteStatus | '';
}

export const DEFAULT_QUOTE_FILTERS: QuoteFilters = {
  partnerId: '',
  createdById: '',
  dateFrom: '',
  dateTo: '',
  status: '',
};

export interface QuoteSort {
  sortBy: QuoteSortField;
  sortDir: 'asc' | 'desc';
}

export const DEFAULT_QUOTE_SORT: QuoteSort = { sortBy: 'createdAt', sortDir: 'desc' };

@Component({
  selector: 'app-quote-table',
  imports: [RouterLink, Pagination, TranslatePipe, MoneyPipe],
  templateUrl: './quote-table.html',
  styleUrls: ['../../../shared/styles/type-scale.css'],
  // `contents` keeps the host out of the layout box model, so the views
  // column and the table card are direct children of the page's row.
  host: { class: 'contents' },
})
export class QuoteTable {
  /** One page of the list; `meta` says which and how many there are. */
  readonly quotes = input<QuoteRow[]>([]);
  readonly meta = input<PageMeta>(EMPTY_PAGE);

  /** Per status plus "ALL", under the other filters. */
  readonly statusCounts = input<Record<string, number>>({});

  readonly partners = input<Partner[]>([]);
  readonly authors = input<Person[]>([]);

  /** The parent's current filters and sort, for the pressed states and arrows. */
  readonly filters = input<QuoteFilters>(DEFAULT_QUOTE_FILTERS);
  readonly sort = input<QuoteSort>(DEFAULT_QUOTE_SORT);

  /** Shows the Markup column; the server sends the figure only with quote.view_cost. */
  readonly canViewCost = input(false);
  /** Markup below this percentage is shown as a warning. */
  readonly minMarkupPct = input('10');

  readonly loading = input(false);

  readonly search = output<string>();
  readonly filterChange = output<Partial<QuoteFilters>>();
  readonly sortChange = output<QuoteSort>();
  readonly pageChange = output<number>();

  private language = inject(LanguageService);

  readonly statuses = QUOTE_STATUSES;
  readonly statusClasses = STATUS_CLASSES;

  onSearch(event: Event): void {
    this.search.emit((event.target as HTMLInputElement).value.trim());
  }

  onFilter(field: keyof QuoteFilters, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.filterChange.emit({ [field]: value } as Partial<QuoteFilters>);
  }

  pickStatus(status: QuoteStatus | ''): void {
    this.filterChange.emit({ status });
  }

  /** First click sorts ascending — except the date, where newest first is the useful order. */
  onSort(field: QuoteSortField): void {
    const current = this.sort();
    const sortDir =
      current.sortBy === field
        ? current.sortDir === 'asc'
          ? 'desc'
          : 'asc'
        : field === 'createdAt'
          ? 'desc'
          : 'asc';
    this.sortChange.emit({ sortBy: field, sortDir });
  }

  /** For aria-sort on the column headers. */
  ariaSort(field: QuoteSortField): 'ascending' | 'descending' | 'none' {
    const current = this.sort();
    if (current.sortBy !== field) return 'none';
    return current.sortDir === 'asc' ? 'ascending' : 'descending';
  }

  arrow(field: QuoteSortField): string {
    const current = this.sort();
    if (current.sortBy !== field) return '';
    return current.sortDir === 'asc' ? '↑' : '↓';
  }

  count(status: QuoteStatus | ''): number {
    return this.statusCounts()[status || 'ALL'] ?? 0;
  }

  clientName(row: QuoteRow): string {
    return row.partner.tradeName || row.partner.legalName;
  }

  /** Called from the template, so it re-renders in the new language on a switch. */
  day(iso: string): string {
    return new Date(iso).toLocaleDateString(this.language.locale(), {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  markup(row: QuoteRow): string {
    return shortPercent(row.overallMarkupPct);
  }

  isLow(row: QuoteRow): boolean {
    return (
      row.overallMarkupPct !== null &&
      row.overallMarkupPct !== undefined &&
      Number(row.overallMarkupPct) < Number(this.minMarkupPct())
    );
  }
}
