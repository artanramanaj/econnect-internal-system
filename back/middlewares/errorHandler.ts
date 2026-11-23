import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { i18n, FALLBACK_LANGUAGE, type MessageKey, type MessageParams } from "../i18n/index.js";

/** A field-level problem. `key` is translated by the error handler. */
export interface FieldIssue {
  field: string;
  key: MessageKey;
  params?: MessageParams;
}

export interface CustomErrorOptions {
  issues?: FieldIssue[];
  /** Values for the message's {{placeholders}}. */
  params?: MessageParams;
}

/**
 * An operational error the client is meant to see.
 *
 * Carries an i18n key rather than text: the error handler picks the language
 * from the request, so services (which never see the request) stay
 * language-neutral. The key doubles as `message`, which is what the log shows.
 */
export class customError extends Error {
  readonly key: MessageKey;
  readonly statusCode: number;
  readonly params?: MessageParams;
  readonly issues?: FieldIssue[];

  constructor(key: MessageKey, statusCode: number, options: CustomErrorOptions = {}) {
    super(key);
    this.key = key;
    this.statusCode = statusCode;
    this.params = options.params;
    this.issues = options.issues;
    Object.setPrototypeOf(this, customError.prototype);
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const isOperational = err instanceof customError;
  const statusCode = isOperational ? err.statusCode : StatusCodes.INTERNAL_SERVER_ERROR;

  // An error raised before the i18n middleware ran (a malformed JSON body,
  // say) has no req.t; fall back rather than crash inside the handler.
  const t = req.t ?? i18n.getFixedT(FALLBACK_LANGUAGE);

  console.error(err);

  // Never echo internal error text (Prisma, JWT, driver messages) to the client.
  const message = isOperational
    ? t(err.key, err.params ?? {})
    : process.env.NODE_ENV === "production"
      ? t("common.somethingWentWrong")
      : err.message || t("common.somethingWentWrong");

  const body: { message: string; issues?: { field: string; message: string }[] } = { message };
  if (isOperational && err.issues?.length) {
    body.issues = err.issues.map((issue) => ({
      field: issue.field,
      message: t(issue.key, issue.params ?? {}),
    }));
  }

  res.status(statusCode).json(body);
}
