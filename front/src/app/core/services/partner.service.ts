import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  CreatePartnerRequest,
  Partner,
  PartnerResponse,
  PartnersResponse,
  Site,
} from '../models/partner.model';

/** How many clients one dropdown load shows; the search narrows beyond that. */
export const PARTNER_PICK_SIZE = 100;

/**
 * Partners, as far as the quote screens need them: the client dropdown, a
 * quick-create and a client's sites. Stateless — each screen holds what it
 * loaded, since a dropdown's search results are not shared state.
 */
@Injectable({ providedIn: 'root' })
export class PartnerService {
  private http = inject(HttpClient);

  /** Active customers by name, number, city or fiscal number. */
  search(q = ''): Observable<Partner[]> {
    let params = new HttpParams().set('pageSize', String(PARTNER_PICK_SIZE));
    if (q) params = params.set('q', q);
    return this.http
      .get<PartnersResponse>('/api/partners', { params })
      .pipe(map((res) => res.partners));
  }

  create(data: CreatePartnerRequest): Observable<PartnerResponse> {
    return this.http.post<PartnerResponse>('/api/partners', data);
  }

  sites(partnerId: number): Observable<Site[]> {
    return this.http
      .get<{ sites: Site[] }>(`/api/partners/${partnerId}/sites`)
      .pipe(map((res) => res.sites));
  }
}
