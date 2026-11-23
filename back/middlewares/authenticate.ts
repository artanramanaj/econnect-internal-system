import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { customError } from "./errorHandler.js";
import { verifyAccessToken, ACCESS_COOKIE } from "../utils/tokenUtils.js";

/** Verifies the access token cookie and attaches the payload to req.user. */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[ACCESS_COOKIE];

  if (!token) {
    throw new customError("common.notSignedIn", StatusCodes.UNAUTHORIZED);
  }

  // verifyAccessToken throws a 401 customError on expiry/tampering.
  req.user = verifyAccessToken(token);
  next();
}
