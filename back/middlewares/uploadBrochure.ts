import multer from "multer";
import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { customError } from "./errorHandler.js";
import { BROCHURE_MAX_MB } from "../constants/catalog.constants.js";

/**
 * Parses the one-file multipart body of POST /api/items/:id/brochure into
 * req.file. In memory rather than on disk: 25 MB at this app's traffic is
 * nothing, the controller checks the magic bytes on the buffer directly, and
 * a refused upload leaves no temp file behind.
 *
 * Note that req.body stays undefined until multer runs (Express 5), so this
 * route takes no validateBody.
 */
const single = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: BROCHURE_MAX_MB * 1024 * 1024, files: 1 },
  // Browsers send the original filename in UTF-8 without declaring a charset;
  // multer's default of latin1 would turn "broshurë.pdf" into mojibake.
  defParamCharset: "utf8",
}).single("file");

/**
 * Wrapped because a raw MulterError is not a customError and would fall
 * through errorHandler as an untranslated 500. Every Multer code is a client
 * fault; only non-Multer (stream) failures stay on the 500 path.
 */
export function uploadBrochure(req: Request, res: Response, next: NextFunction) {
  single(req, res, (err: unknown) => {
    if (err == null) {
      next();
      return;
    }
    if (err instanceof multer.MulterError) {
      next(
        err.code === "LIMIT_FILE_SIZE"
          ? new customError("items.brochureTooLarge", StatusCodes.BAD_REQUEST, {
              params: { max: BROCHURE_MAX_MB },
            })
          : new customError("items.brochureInvalid", StatusCodes.BAD_REQUEST),
      );
      return;
    }
    next(err as Error);
  });
}
