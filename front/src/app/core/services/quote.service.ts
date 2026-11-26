import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import {
  CatalogueHit,
  CreateQuoteRequest,
  EMPTY_QUOTE_OPTIONS,
  QuoteDetailResponse,
  QuoteOptions,
  QuoteQuery,
  QuoteRow,
  QuoteSaveResponse,
  QuotesResponse,
  RevisionHead,
  UpdateQuoteRequest,
} from '../models/quote.model';
import { EMPTY_PAGE, PageMeta } from '../models/pagination.model';

export const QUOTE_PAGE_SIZE = 10;

@Injectable({ providedIn: 'root' })
export class QuoteService {
  private http = inject(HttpClient);

  private readonly _quotes = signal<QuoteRow[]>([]);
  private readonly _meta = signal<PageMeta>(EMPTY_PAGE);
  private readonly _statusCounts = signal<Record<string, number>>({});
  private readonly _canViewCost = signal(false);
  private readonly _options = signal<QuoteOptions>(EMPTY_QUOTE_OPTIONS);

  /** The page of the list currently shown; `meta` says which page. */
  readonly quotes = this._quotes.asReadonly();
  readonly meta = this._meta.asReadonly();
  readonly statusCounts = this._statusCounts.asReadonly();
  /** Decided by the server (quote.view_cost); without it no markup is ever sent. */
  readonly canViewCost = this._canViewCost.asReadonly();
  readonly options = this._options.asReadonly();

  // ---------- reads ----------

  loadQuotes(query: QuoteQuery): Observable<QuotesResponse> {
    let params = new HttpParams()
      .set('page', String(query.page))
      .set('pageSize', String(QUOTE_PAGE_SIZE))
      .set('sortBy', query.sortBy)
      .set('sortDir', query.sortDir);
    if (query.q) params = params.set('q', query.q);
    if (query.partnerId) params = params.set('partnerId', query.partnerId);
    if (query.createdById) params = params.set('createdById', query.createdById);
    if (query.dateFrom) params = params.set('dateFrom', query.dateFrom);
    if (query.dateTo) params = params.set('dateTo', query.dateTo);
    if (query.status) params = params.set('status', query.status);

    return this.http.get<QuotesResponse>('/api/quotes', { params }).pipe(
      tap((res) => {
        this._quotes.set(res.quotes);
        this._meta.set(res.meta);
        this._statusCounts.set(res.statusCounts);
        this._canViewCost.set(res.canViewCost);
      }),
    );
  }

  loadOptions(): Observable<QuoteOptions> {
    return this.http
      .get<QuoteOptions>('/api/quotes/options')
      .pipe(tap((res) => this._options.set(res)));
  }

  /** The quote with its current revision and lines. */
  getQuote(id: number): Observable<QuoteDetailResponse> {
    return this.http.get<QuoteDetailResponse>(`/api/quotes/${id}`);
  }

  /** Every revision's header, newest first. */
  getRevisions(id: number): Observable<RevisionHead[]> {
    return this.http
      .get<{ revisions: RevisionHead[] }>(`/api/quotes/${id}/revisions`)
      .pipe(map((res) => res.revisions));
  }

  /** Catalogue matches for the editor's line picker. */
  searchItems(q: string): Observable<CatalogueHit[]> {
    return this.http
      .get<{ items: CatalogueHit[] }>('/api/items/search', { params: new HttpParams().set('q', q) })
      .pipe(map((res) => res.items));
  }

  // ---------- writes ----------

  /** Creates the quote with its revision 1.0. The server assigns the number. */
  createQuote(data: CreateQuoteRequest): Observable<QuoteSaveResponse> {
    return this.http.post<QuoteSaveResponse>('/api/quotes', data);
  }

  /** A save, which creates the next revision (1.0 → 1.1). */
  saveQuote(id: number, data: UpdateQuoteRequest): Observable<QuoteSaveResponse> {
    return this.http.put<QuoteSaveResponse>(`/api/quotes/${id}`, data);
  }

  approve(id: number): Observable<QuoteSaveResponse> {
    return this.http.post<QuoteSaveResponse>(`/api/quotes/${id}/approve`, {});
  }

  reject(id: number, note: string): Observable<QuoteSaveResponse> {
    return this.http.post<QuoteSaveResponse>(`/api/quotes/${id}/reject`, { note });
  }
}
