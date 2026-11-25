import path from "node:path";
import fs from "node:fs";

/**
 * Product brochures live on disk; the items table keeps only the generated
 * file name. cwd is back/ under npm in both dev and prod (import.meta.url
 * would point at back/ under tsx but at back/dist/ once compiled), and
 * UPLOADS_DIR can move the whole tree somewhere else, e.g. a mounted share.
 */
export const BROCHURES_DIR = path.resolve(
  process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads"),
  "brochures",
);

// Idempotent, once per boot. server.ts imports this module, so an unwritable
// disk fails at startup rather than at the first upload.
fs.mkdirSync(BROCHURES_DIR, { recursive: true });

/**
 * Timestamped so a replace writes a new file instead of overwriting in place:
 * a crash mid-write can orphan a file but never corrupt the one a row points
 * at. No request value is ever part of the name.
 */
export function brochureFileName(itemId: number): string {
  return `item-${itemId}-${Date.now()}.pdf`;
}

export function brochurePath(storedName: string): string {
  return path.join(BROCHURES_DIR, storedName);
}

/**
 * Fire-and-forget unlink for a replaced or orphaned brochure. Never fails the
 * request: the row is already correct, a leftover file only wastes disk.
 */
export function discardBrochure(storedName: string | null): void {
  if (!storedName) return;
  void fs.promises.unlink(brochurePath(storedName)).catch((err) => {
    console.error(`[brochures] could not delete ${storedName}:`, err);
  });
}
