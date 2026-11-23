import { z } from "zod";

export const PAGE_SIZE_DEFAULT = 10;
export const PAGE_SIZE_MAX = 100;

/**
 * `?page=&pageSize=` on list endpoints. Coerced because query-string values
 * arrive as strings. Both default when absent, so a bare GET still works.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(PAGE_SIZE_DEFAULT),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
