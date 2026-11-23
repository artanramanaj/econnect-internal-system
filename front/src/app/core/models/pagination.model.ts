/**
 * Mirrors the server's PageMeta. `page` is the page actually served: the
 * server clamps an out-of-range request to the last page, so this — not
 * whatever the client asked for — is the current page.
 */
export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  /** Never 0: an empty list is one empty page. */
  totalPages: number;
}

/** What a store holds before its first response lands. */
export const EMPTY_PAGE: PageMeta = { page: 1, pageSize: 10, total: 0, totalPages: 1 };
