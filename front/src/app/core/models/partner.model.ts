import { PageMeta } from './pagination.model';

/**
 * A company EMS does business with — "client" in the UI when it is a customer.
 * One table with two flags on the server, since a client can also be a supplier.
 */
export interface Partner {
  id: number;
  /** Assigned by the server: "P-0001". */
  partnerNumber: string;
  legalName: string;
  tradeName: string | null;
  fiscalNumber: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  paymentTerms: string | null;
  isCustomer: boolean;
  isSupplier: boolean;
}

/** Where the work happens: a partner's branch, warehouse or building. */
export interface Site {
  id: number;
  name: string;
  address: string | null;
  city: string | null;
}

export interface PartnersResponse {
  partners: Partner[];
  meta: PageMeta;
}

export interface PartnerResponse {
  message: string;
  partner: Partner;
}

/** Quick-create from the quote editor. Only the legal name is required. */
export interface CreatePartnerRequest {
  legalName: string;
  tradeName?: string;
  fiscalNumber?: string;
  city?: string;
  email?: string;
  phone?: string;
  paymentTerms?: string;
}
