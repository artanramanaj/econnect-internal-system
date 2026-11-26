import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import type { ZodType, z } from "zod";
import { customError, type FieldIssue } from "./errorHandler.js";
import { isMessageKey, type MessageKey, type MessageParams } from "../i18n/index.js";

/**
 * Validates req.body against a zod schema and replaces it with the parsed data.
 * Field-level issues are kept and returned to the client, translated.
 */
export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    // reportInput so a missing field can be told apart from a wrongly-typed one.
    const parsed = schema.safeParse(req.body, { reportInput: true });

    if (!parsed.success) {
      throw new customError("validation.correctFields", StatusCodes.BAD_REQUEST, {
        issues: parsed.error.issues.map(toFieldIssue),
      });
    }

    req.body = parsed.data;
    next();
  };
}

/**
 * Schemas name their messages as i18n keys ("validation.passwordMin"). A rule
 * with no custom message (`.max(50)`) would otherwise surface zod's own
 * English, so those are mapped to a generic key by issue code instead.
 */
export function toFieldIssue(issue: z.core.$ZodIssue): FieldIssue {
  const field = issue.path.join(".");

  if (isMessageKey(issue.message)) {
    return { field, key: issue.message };
  }

  const { key, params } = genericIssue(issue);
  return { field, key, params };
}

function genericIssue(issue: z.core.$ZodIssue): { key: MessageKey; params?: MessageParams } {
  switch (issue.code) {
    case "invalid_type":
      return issue.input === undefined
        ? { key: "validation.required" }
        : { key: "validation.invalid" };
    case "too_small":
      return issue.origin === "string"
        ? { key: "validation.tooShort", params: { min: Number(issue.minimum) } }
        : { key: "validation.tooSmall", params: { min: Number(issue.minimum) } };
    case "too_big":
      return issue.origin === "string"
        ? { key: "validation.tooLong", params: { max: Number(issue.maximum) } }
        : { key: "validation.tooBig", params: { max: Number(issue.maximum) } };
    // A strict schema met a key it does not know. Named, so a typo in a
    // field name is found at once instead of being silently dropped.
    case "unrecognized_keys":
      return { key: "validation.unknownField", params: { fields: issue.keys.join(", ") } };
    default:
      return { key: "validation.invalid" };
  }
}
