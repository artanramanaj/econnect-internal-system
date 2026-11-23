import type { Request, Response } from "express";
import type { CookieOptions } from "express";
import { StatusCodes } from "http-status-codes";
import {
  registerUser,
  loginUser,
  rotateRefreshToken,
  revokeRefreshToken,
  getUserById,
  updateUserLocale,
} from "../services/authService.js";
import { getEffectivePermissions } from "../services/permissionService.js";
import { customError } from "../middlewares/errorHandler.js";
import { t } from "../i18n/index.js";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
} from "../utils/tokenUtils.js";
import type {
  RegisterInput,
  LoginInput,
  UpdateLocaleInput,
} from "../validators/auth.schema.js";

// Derived from the token lifetimes so the cookie never outlives its token.
const ACCESS_COOKIE_MAX_AGE = ACCESS_TOKEN_TTL_MS;
const REFRESH_COOKIE_MAX_AGE = REFRESH_TOKEN_TTL_MS;

function cookieOptions(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie(ACCESS_COOKIE, accessToken, cookieOptions(ACCESS_COOKIE_MAX_AGE));
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions(REFRESH_COOKIE_MAX_AGE));
}

function clearAuthCookies(res: Response) {
  const opts = { httpOnly: true, sameSite: "lax" as const, path: "/" };
  res.clearCookie(ACCESS_COOKIE, opts);
  res.clearCookie(REFRESH_COOKIE, opts);
}

export async function register(req: Request, res: Response) {
  const user = await registerUser(req.body as RegisterInput);

  res.status(StatusCodes.CREATED).json({
    message: t(req, "auth.accountCreated", { username: user.username }),
    user,
  });
}

export async function login(req: Request, res: Response) {
  const { username, password } = req.body as LoginInput;
  const { user, accessToken, refreshToken } = await loginUser(username, password);

  setAuthCookies(res, accessToken, refreshToken);

  // Permissions ride along so the client is fully configured after one call.
  // Without them the UI has a window where it knows who you are but not what
  // you may do, and permission-gated navigation renders empty.
  const permissions = await getEffectivePermissions(user.id);

  res.status(StatusCodes.OK).json({
    message: t(req, "auth.welcomeBack", { name: user.employee?.firstName ?? user.username }),
    user,
    permissions,
  });
}

export async function refresh(req: Request, res: Response) {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (!raw) {
    throw new customError("auth.sessionExpired", StatusCodes.UNAUTHORIZED);
  }

  const { user, accessToken, refreshToken } = await rotateRefreshToken(raw);
  setAuthCookies(res, accessToken, refreshToken);

  // Same as login: a refresh that dropped permissions would leave a
  // long-running tab with a user but no rights after its access token rolled.
  const permissions = await getEffectivePermissions(user.id);

  res.status(StatusCodes.OK).json({ message: t(req, "auth.sessionRefreshed"), user, permissions });
}

export async function logout(req: Request, res: Response) {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (raw) {
    await revokeRefreshToken(raw);
  }

  clearAuthCookies(res);
  res.status(StatusCodes.OK).json({ message: t(req, "auth.signedOut") });
}

/** Always reads from the database so revoked roles/status take effect immediately. */
export async function getMe(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) {
    throw new customError("common.notSignedIn", StatusCodes.UNAUTHORIZED);
  }

  const user = await getUserById(userId);
  if (!user) {
    throw new customError("auth.accountGone", StatusCodes.UNAUTHORIZED);
  }

  const permissions = await getEffectivePermissions(userId);

  res.status(StatusCodes.OK).json({ user, permissions });
}

/** Persist the language picked in the UI, so it follows the person to another browser. */
export async function updateLocale(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) {
    throw new customError("common.notSignedIn", StatusCodes.UNAUTHORIZED);
  }

  const { locale } = req.body as UpdateLocaleInput;
  const user = await updateUserLocale(userId, locale);

  res.status(StatusCodes.OK).json({ message: t(req, "auth.localeUpdated"), user });
}
