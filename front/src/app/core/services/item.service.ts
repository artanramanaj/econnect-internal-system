import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, tap, throwError } from 'rxjs';
import {
  CreateItemRequest,
  EMPTY_ITEM_OPTIONS,
  Item,
  ItemDetailResponse,
  ItemOptions,
  ItemQuery,
  ItemResponse,
  ItemsResponse,
  UpdateItemRequest,
} from '../models/item.model';
import { EMPTY_PAGE, PageMeta } from '../models/pagination.model';

/** Rows per page of the products table; the same as the users table. */
export const ITEM_PAGE_SIZE = 10;

@Injectable({ providedIn: 'root' })
export class ItemService {
  private http = inject(HttpClient);

  private readonly _items = signal<Item[]>([]);
  private readonly _meta = signal<PageMeta>(EMPTY_PAGE);
  private readonly _canViewCost = signal(false);
  private readonly _options = signal<ItemOptions>(EMPTY_ITEM_OPTIONS);

  /** The page of the catalogue currently shown; `meta` says which page. */
  readonly items = this._items.asReadonly();
  readonly meta = this._meta.asReadonly();
  /** Decided by the server (quote.view_cost); without it no cost is ever sent. */
  readonly canViewCost = this._canViewCost.asReadonly();
  readonly options = this._options.asReadonly();

  // ---------- reads ----------

  loadItems(query: ItemQuery): Observable<ItemsResponse> {
    let params = new HttpParams()
      .set('page', String(query.page))
      .set('pageSize', String(ITEM_PAGE_SIZE))
      .set('status', query.status);
    if (query.q) params = params.set('q', query.q);
    if (query.type) params = params.set('type', query.type);
    if (query.categoryId) params = params.set('categoryId', query.categoryId);
    if (query.brandId) params = params.set('brandId', query.brandId);
    if (query.source) params = params.set('source', query.source);

    return this.http.get<ItemsResponse>('/api/items', { params }).pipe(
      tap((res) => {
        this._items.set(res.items);
        this._meta.set(res.meta);
        this._canViewCost.set(res.canViewCost);
      }),
    );
  }

  loadOptions(): Observable<ItemOptions> {
    return this.http
      .get<ItemOptions>('/api/items/options')
      .pipe(tap((res) => this._options.set(res)));
  }

  /** One item with its alternative units and, if allowed, its cost history. */
  getItem(id: number): Observable<ItemDetailResponse> {
    return this.http
      .get<ItemDetailResponse>(`/api/items/${id}`)
      .pipe(tap((res) => this._canViewCost.set(res.canViewCost)));
  }

  // ---------- writes ----------

  /**
   * No store patch: the list is one page sorted by description, so the new
   * row belongs somewhere the client cannot work out. The caller reloads.
   */
  createItem(data: CreateItemRequest): Observable<ItemResponse> {
    return this.http.post<ItemResponse>('/api/items', data);
  }

  /** Patched in place, so the table does not jump while the drawer is open. */
  updateItem(id: number, data: UpdateItemRequest): Observable<ItemResponse> {
    return this.http.patch<ItemResponse>(`/api/items/${id}`, data).pipe(
      tap((res) =>
        this._items.update((list) => list.map((item) => (item.id === id ? res.item : item))),
      ),
    );
  }

  /** No store patch: filtering the row out would leave the page one short. */
  deleteItem(id: number): Observable<{ message: string; id: number }> {
    return this.http.delete<{ message: string; id: number }>(`/api/items/${id}`);
  }

  // ---------- the item's PDF ----------

  /** Attach or replace the item's brochure. Patched in place like an update. */
  uploadBrochure(id: number, file: File): Observable<ItemResponse> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.http
      .post<ItemResponse>(`/api/items/${id}/brochure`, body)
      .pipe(tap((res) => this.patchRow(id, res.item)));
  }

  removeBrochure(id: number): Observable<ItemResponse> {
    return this.http
      .delete<ItemResponse>(`/api/items/${id}/brochure`)
      .pipe(tap((res) => this.patchRow(id, res.item)));
  }

  /**
   * Opens the brochure in a new tab. The tab is opened synchronously, inside
   * the click, so popup blockers stay quiet; it gets its content when the
   * blob lands. Fetched through HttpClient rather than a bare <a href>: the
   * interceptor adds the cookie-refresh retry, where a link would dump raw
   * 401 JSON into the tab once the access token expires.
   */
  openBrochure(id: number): Observable<void> {
    const tab = window.open('', '_blank');
    return this.http.get(`/api/items/${id}/brochure`, { responseType: 'blob' }).pipe(
      map((blob) => {
        const url = URL.createObjectURL(blob);
        if (tab) tab.location.href = url;
        else window.open(url, '_blank');
        // Long enough for the slowest viewer to have loaded it.
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }),
      catchError((err) => {
        tab?.close();
        return throwError(() => err);
      }),
    );
  }

  private patchRow(id: number, item: Item): void {
    this._items.update((list) => list.map((row) => (row.id === id ? item : row)));
  }
}
