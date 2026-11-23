import type { PaginationQuery } from "../validators/pagination.schema.js";

export interface PageMeta {
  /** The page actually served — see `paginate`. */
  page: number;
  pageSize: number;
  total: number;
  /** Never 0: an empty set is one empty page. */
  totalPages: number;
}

/**
 * skip/take for the requested page, clamped so a stale client asking for a
 * page past the end (another admin deleted rows, a filter shrank the set)
 * gets the last page rather than an empty one. The meta reports the page
 * that was really served, and the client treats that as the truth.
 */
export function paginate(
  query: PaginationQuery,
  total: number,
): { skip: number; take: number; meta: PageMeta } {
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, totalPages);

  return {
    skip: (page - 1) * query.pageSize,
    take: query.pageSize,
    meta: { page, pageSize: query.pageSize, total, totalPages },
  };
}
