import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { CatalogRef } from '../models/item.model';
import { EMPTY_PAGE, PageMeta } from '../models/pagination.model';

/** The two managed dropdown lists of the catalogue; also the API path piece. */
export type RefKind = 'categories' | 'brands';

interface RefsResponse {
  meta: PageMeta;
  categories?: CatalogRef[];
  brands?: CatalogRef[];
}

/** Writes answer with the row under its own name: { message, category } or { message, brand }. */
export interface RefWriteResponse {
  message: string;
  category?: CatalogRef;
  brand?: CatalogRef;
}

/**
 * Categories and brands for the Products screen: one store per kind, one set
 * of methods, since the two APIs are the same shape (UserAdminService's
 * positions block is the model).
 */
@Injectable({ providedIn: 'root' })
export class CatalogRefsService {
  private http = inject(HttpClient);

  private readonly _categories = signal<CatalogRef[]>([]);
  private readonly _categoriesMeta = signal<PageMeta>(EMPTY_PAGE);
  private readonly _brands = signal<CatalogRef[]>([]);
  private readonly _brandsMeta = signal<PageMeta>(EMPTY_PAGE);

  readonly categories = this._categories.asReadonly();
  readonly categoriesMeta = this._categoriesMeta.asReadonly();
  readonly brands = this._brands.asReadonly();
  readonly brandsMeta = this._brandsMeta.asReadonly();

  private rows(kind: RefKind) {
    return kind === 'categories' ? this._categories : this._brands;
  }

  private meta(kind: RefKind) {
    return kind === 'categories' ? this._categoriesMeta : this._brandsMeta;
  }

  load(kind: RefKind, page = 1): Observable<RefsResponse> {
    const params = new HttpParams().set('page', String(page));
    return this.http.get<RefsResponse>(`/api/${kind}`, { params }).pipe(
      tap((res) => {
        this.rows(kind).set(res[kind] ?? []);
        this.meta(kind).set(res.meta);
      }),
    );
  }

  /** No store patch: the new row sorts by name somewhere in the list. The caller reloads. */
  create(kind: RefKind, name: string): Observable<RefWriteResponse> {
    return this.http.post<RefWriteResponse>(`/api/${kind}`, { name });
  }

  /** Patched in place, so the table does not jump under the rename form. */
  rename(kind: RefKind, id: number, name: string): Observable<RefWriteResponse> {
    return this.http.patch<RefWriteResponse>(`/api/${kind}/${id}`, { name }).pipe(
      tap((res) => {
        const fresh = res.category ?? res.brand;
        if (fresh) {
          this.rows(kind).update((list) => list.map((row) => (row.id === id ? fresh : row)));
        }
      }),
    );
  }

  /** No store patch: filtering the row out would leave the page one short. */
  remove(kind: RefKind, id: number): Observable<{ message: string; id: number }> {
    return this.http.delete<{ message: string; id: number }>(`/api/${kind}/${id}`);
  }
}
