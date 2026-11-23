import "dotenv/config";
import { prisma } from "../lib/prisma.js";

/**
 * Prints the refresh_tokens table so you can watch rotation happen.
 *   npm run tokens
 *   npm run tokens -- superadmin      (filter by username)
 */
const username = process.argv[2];

const rows = await prisma.refreshToken.findMany({
  where: username ? { user: { username } } : undefined,
  include: { user: { select: { username: true } } },
  orderBy: { id: "asc" },
});

const now = new Date();

if (rows.length === 0) {
  console.log("No refresh tokens stored.");
} else {
  const human = (ms: number) => {
    const abs = Math.abs(ms);
    if (abs >= 86_400_000) return `${(ms / 86_400_000).toFixed(1)}d`;
    if (abs >= 3_600_000) return `${(ms / 3_600_000).toFixed(1)}h`;
    if (abs >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
    return `${Math.round(ms / 1000)}s`;
  };

  console.table(
    rows.map((r) => ({
      id: r.id,
      user: r.user.username,
      tokenHash: `${r.tokenHash.slice(0, 12)}…`,
      state: r.revokedAt ? "REVOKED" : r.expiresAt < now ? "EXPIRED" : "ACTIVE",
      createdAt: r.createdAt.toLocaleTimeString(),
      // How long this token was minted to live, and how long is left.
      ttl: human(r.expiresAt.getTime() - r.createdAt.getTime()),
      expiresIn: r.expiresAt < now ? "expired" : human(r.expiresAt.getTime() - now.getTime()),
      revokedAt: r.revokedAt ? r.revokedAt.toLocaleTimeString() : "-",
    }))
  );

  const active = rows.filter((r) => !r.revokedAt && r.expiresAt > now).length;
  console.log(`${rows.length} row(s) | ${active} currently usable`);
}

process.exit(0);
