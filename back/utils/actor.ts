import type { Request } from "express";
import { StatusCodes } from "http-status-codes";
import { customError } from "../middlewares/errorHandler.js";

/** The signed-in user's id. Only meaningful behind `authenticate`. */
export function actorId(req: Request): number {
  const id = req.user?.userId;
  if (!id) throw new customError("common.notSignedIn", StatusCodes.UNAUTHORIZED);
  return id;
}
