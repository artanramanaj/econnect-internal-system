import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  EMPTY,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  merge,
  switchMap,
} from 'rxjs';
import { Partner } from '../../core/models/partner.model';
import { QuoteQuery } from '../../core/models/quote.model';
import { ApiError } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { PartnerService } from '../../core/services/partner.service';
import { QuoteService } from '../../core/services/quote.service';
import { ErrorMessage } from '../../shared/components/error-message/error-message';
import {
  DEFAULT_QUOTE_FILTERS,
  DEFAULT_QUOTE_SORT,
  QuoteFilters,
  QuoteSort,
  QuoteTable,
} from './quote-table/quote-table';

@Component({
  selector: 'app-quotes',
  imports: [QuoteTable, ErrorMessage, RouterLink, TranslatePipe],
  templateUrl: './quotes.html',
  styleUrls: ['./quotes.css', '../../shared/styles/type-scale.css'],
})
export class Quotes {
  private quoteService = inject(QuoteService);
  private partnerService = inject(PartnerService);
  private auth = inject(AuthService);
  private translate = inject(TranslateService);

  readonly quotes = this.quoteService.quotes;
  readonly meta = this.quoteService.meta;
  readonly statusCounts = this.quoteService.statusCounts;
  readonly options = this.quoteService.options;
  /** From the server: whether it sent markups at all. */
  readonly canViewCost = this.quoteService.canViewCost;

  /** The clients offered by the client filter. */
  readonly partners = signal<Partner[]>([]);

  /** Shows "New quote" only to people the server would let create one. */
  readonly canManage = computed(
    () => this.auth.hasPermission('quote.manage') && this.auth.hasPermission('quote.view_cost'),
  );

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly searchTerm = signal('');
  readonly filters = signal<QuoteFilters>(DEFAULT_QUOTE_FILTERS);
  readonly sort = signal<QuoteSort>(DEFAULT_QUOTE_SORT);

  private readonly searchInput = new Subject<string>();

  /** Every other list load: filters, sorting, page changes. */
  private readonly listLoads = new Subject<QuoteQuery>();

  constructor() {
    // One stream for every list load, so switchMap can drop the response of
    // an earlier request when a later one starts: a slow search must not
    // overwrite the page you have since moved to. A new search term always
    // goes back to page 1 — the old page number means nothing in a new set.
    merge(
      this.searchInput.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        map(() => this.query({ page: 1 })),
      ),
      this.listLoads,
    )
      .pipe(
        switchMap((query) => {
          // Set here, not before switchMap: cancelling the previous request
          // runs its finalize first, which would otherwise clear this again.
          this.loading.set(true);
          this.error.set(null);
          return this.quoteService.loadQuotes(query).pipe(
            finalize(() => this.loading.set(false)),
            // Caught inside, so one failed request does not end the stream
            // and leave the search box dead for the rest of the visit.
            catchError((err: HttpErrorResponse) => {
              this.showError(err);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    this.listLoads.next(this.query({ page: 1 }));
    this.quoteService.loadOptions().subscribe({ error: () => undefined });
    this.partnerService.search().subscribe({
      next: (partners) => this.partners.set(partners),
      error: () => undefined,
    });
  }

  onSearch(term: string): void {
    this.searchTerm.set(term);
    this.searchInput.next(term);
  }

  onFilter(change: Partial<QuoteFilters>): void {
    this.filters.update((current) => ({ ...current, ...change }));
    // query() carries the search term too, so a filter change does not
    // silently discard what is still sitting in the search box.
    this.listLoads.next(this.query({ page: 1 }));
  }

  onSort(sort: QuoteSort): void {
    this.sort.set(sort);
    this.listLoads.next(this.query({ page: 1 }));
  }

  onPage(page: number): void {
    this.listLoads.next(this.query({ page }));
  }

  /** The current search, filters, sort and page, with whatever the caller overrides. */
  private query(override: Partial<QuoteQuery> = {}): QuoteQuery {
    return {
      q: this.searchTerm() || undefined,
      ...this.filters(),
      ...this.sort(),
      page: this.meta().page,
      ...override,
    };
  }

  private showError(err: HttpErrorResponse): void {
    const body = err.error as ApiError | undefined;
    this.error.set(body?.message ?? this.translate.instant('common.somethingWentWrong'));
  }
}
