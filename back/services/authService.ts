import bcrypt from "bcryptjs";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../lib/prisma.js";
import { customError } from "../middlewares/errorHandler.js";
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
  type TokenPayload,
} from "../utils/tokenUtils.js";
import { isUniqueViolation } from "../utils/prismaErrors.js";
import type { RegisterInput } from "../validators/auth.schema.js";
import type { Language } from "../i18n/languages.js";

const SALT_ROUNDS = 10;

/** Shape returned to the client. Never includes password or mfaSecret. */
export interface PublicUser {
  id: number;
  username: string;
  email: string;
  status: string;
  locale: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  roles: string[];
  employee: {
    id: number;
    firstName: string;
    lastName: string;
    /** The position's name, flattened — callers display it, they do not join on it. */
    position: string | null;
    positionId: number | null;
    phone: string | null;
  } | null;
}

const userWithRelations = {
  include: {
    employee: { include: { position: true } },
    roles: { include: { role: true } },
  },
} as const;

type UserRow = {
  id: number;
  username: string;
  email: string;
  status: string;
  locale: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  employee: {
    id: number;
    firstName: string;
    lastName: string;
    positionId: number | null;
    position: { name: string } | null;
    phone: string | null;
  } | null;
  roles: { role: { code: string } }[];
};

export function toPublicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    status: user.status,
    locale: user.locale,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    roles: user.roles.map((r) => r.role.code),
    employee: user.employee
      ? {
          id: user.employee.id,
          firstName: user.employee.firstName,
          lastName: user.employee.lastName,
          position: user.employee.position?.name ?? null,
          positionId: user.employee.positionId,
          phone: user.employee.phone,
        }
      : null,
  };
}

/**
 * Create an Employee + a PENDING User + the requested UserRole in one
 * transaction. The user cannot sign in until an administrator sets the
 * status to ACTIVE.
 */
export async function registerUser(input: RegisterInput): Promise<PublicUser> {
  const role = await prisma.role.findUnique({ where: { code: input.requestedRoleCode } });
  if (!role) {
    throw new customError("auth.groupNotSeeded", StatusCodes.BAD_REQUEST);
  }

  const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          positionId: input.positionId ?? null,
          phone: input.phone || null,
        },
      });

      return tx.user.create({
        data: {
          username: input.username,
          email: input.email,
          password: hashedPassword,
          status: "PENDING",
          employeeId: employee.id,
          roles: { create: { roleId: role.id } },
        },
        ...userWithRelations,
      });
    });

    return toPublicUser(created);
  } catch (err) {
    // Rely on the unique constraints rather than pre-flight reads, which race.
    if (isUniqueViolation(err, "username")) {
      throw new customError("auth.usernameTaken", StatusCodes.CONFLICT);
    }
    if (isUniqueViolation(err, "email")) {
      throw new customError("auth.emailTaken", StatusCodes.CONFLICT);
    }
    throw err;
  }
}

export interface LoginResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

export async function loginUser(username: string, password: string): Promise<LoginResult> {
  const user = await prisma.user.findUnique({
    where: { username },
    ...userWithRelations,
  });

  // Same message for unknown user and bad password, so the endpoint does not
  // reveal which usernames exist.
  if (!user) {
    throw new customError("auth.invalidCredentials", StatusCodes.UNAUTHORIZED);
  }

  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches) {
    throw new customError("auth.invalidCredentials", StatusCodes.UNAUTHORIZED);
  }

  if (user.status === "PENDING") {
    throw new customError("auth.pendingActivation", StatusCodes.FORBIDDEN);
  }
  if (user.status !== "ACTIVE") {
    throw new customError("auth.suspended", StatusCodes.FORBIDDEN);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
    ...userWithRelations,
  });

  const publicUser = toPublicUser(updated);
  const accessToken = signAccessToken(toTokenPayload(publicUser));
  const refreshToken = await issueRefreshToken(user.id);

  return { user: publicUser, accessToken, refreshToken };
}

function toTokenPayload(user: PublicUser): TokenPayload {
  return { userId: user.id, username: user.username, roles: user.roles };
}

/**
 * Drop this user's dead refresh tokens.
 *
 * Only expired rows go: a revoked-but-unexpired row must stay, because that is
 * what makes a replayed token distinguishable from an unknown one. Those rows
 * are collected here later, once they pass their own expiry.
 *
 * Without this the table grows by one row per rotation forever (~2.7k rows per
 * active user per month at a 15 minute access token).
 */
async function pruneExpiredRefreshTokens(userId: number): Promise<void> {
  try {
    await prisma.refreshToken.deleteMany({
      where: { userId, expiresAt: { lt: new Date() } },
    });
  } catch (err) {
    // Housekeeping must never break a sign-in.
    console.error("Failed to prune refresh tokens", err);
  }
}

async function issueRefreshToken(userId: number): Promise<string> {
  await pruneExpiredRefreshTokens(userId);

  const { raw, hash } = generateRefreshToken();
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hash, expiresAt: refreshTokenExpiry() },
  });
  return raw;
}

/**
 * Validate a refresh token, revoke it, and issue a fresh pair (rotation).
 */
export async function rotateRefreshToken(raw: string): Promise<LoginResult> {
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(raw) },
    include: { user: userWithRelations },
  });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw new customError("auth.sessionExpired", StatusCodes.UNAUTHORIZED);
  }

  if (stored.user.status !== "ACTIVE") {
    throw new customError("auth.noLongerActive", StatusCodes.FORBIDDEN);
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const publicUser = toPublicUser(stored.user);
  const accessToken = signAccessToken(toTokenPayload(publicUser));
  const refreshToken = await issueRefreshToken(stored.userId);

  return { user: publicUser, accessToken, refreshToken };
}

export async function revokeRefreshToken(raw: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(raw), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getUserById(id: number): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({ where: { id }, ...userWithRelations });
  return user ? toPublicUser(user) : null;
}

/**
 * The language the person reads the app in. Stored so it follows them to
 * another browser; the client applies it after login and /me.
 */
export async function updateUserLocale(id: number, locale: Language): Promise<PublicUser> {
  const user = await prisma.user.update({
    where: { id },
    data: { locale },
    ...userWithRelations,
  });
  return toPublicUser(user);
}
