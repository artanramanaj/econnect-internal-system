import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { StatusCodes } from "http-status-codes";
import { customError } from "../middlewares/errorHandler.js";

export interface TokenPayload {
  // Deliberately not `sub`: that is a registered JWT claim typed as a string.
  userId: number;
  username: string;
  roles: string[];
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return secret;
}

export const ACCESS_COOKIE = "at";
export const REFRESH_COOKIE = "rt";

/**
 * Parse a duration like "30s", "5m", "2h", "7d" (or a bare number of seconds)
 * into milliseconds. One parser keeps the JWT lifetime and the cookie maxAge
 * derived from the same value, so they cannot drift apart.
 */
export function parseDuration(value: string | undefined, fallbackMs: number): number {
  if (!value) return fallbackMs;

  const match = /^(\d+)\s*(s|m|h|d)?$/i.exec(value.trim());
  if (!match) {
    console.warn(`Unrecognised duration "${value}" — falling back to ${fallbackMs}ms`);
    return fallbackMs;
  }

  const amount = Number(match[1]);
  const unit = (match[2] ?? "s").toLowerCase();
  const multiplier =
    unit === "d" ? 86_400_000 : unit === "h" ? 3_600_000 : unit === "m" ? 60_000 : 1000;

  return amount * multiplier;
}

export const ACCESS_TOKEN_TTL_MS = parseDuration(process.env.JWT_ACCESS_EXPIRES_IN, 15 * 60 * 1000);

export const REFRESH_TOKEN_TTL_MS = parseDuration(
  process.env.JWT_REFRESH_EXPIRES_IN,
  7 * 24 * 60 * 60 * 1000
);

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, getSecret(), {
    expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
  } as jwt.SignOptions);
}

/**
 * Verify an access token. jsonwebtoken throws TokenExpiredError /
 * JsonWebTokenError, which are not operational errors — without this wrapper
 * they surface to the client as a 500 instead of a 401.
 */
export function verifyAccessToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, getSecret()) as unknown as TokenPayload;
  } catch {
    throw new customError("auth.sessionInvalid", StatusCodes.UNAUTHORIZED);
  }
}

/** Opaque refresh token: the raw value goes in the cookie, only its hash is stored. */
export function generateRefreshToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(48).toString("hex");
  return { raw, hash: hashRefreshToken(raw) };
}

export function hashRefreshToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
}
