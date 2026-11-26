# eConnect — backend

Express 5 + TypeScript (ESM: imports end in `.js`), Prisma 7 on PostgreSQL, zod 4.
`npm run dev` serves on port 3000 (tsx watch). Run `npm run typecheck` before calling a
change done. `npm test` runs the only unit tests there are — the quote pricing, VAT,
approval-threshold and status-transition rules (`services/quotePricing.test.ts`, Node's
built-in runner); keep them passing when touching `services/quotePricing.ts` or
`services/quoteStatus.ts`.

## i18n — Albanian (`sq`) and English (`en`)

Every message a response carries is translated by i18next from `i18n/locales/en.json`
and `i18n/locales/sq.json` (same key set; **add every new key to both**). The language
comes from the request's `Accept-Language` header (`?lang=sq` for curl), picked up by
`i18nMiddleware` in `server.ts`. **Never put English text in a response.**

- Errors: `throw new customError("auth.invalidCredentials", StatusCodes.UNAUTHORIZED)`.
  The first argument is a `MessageKey`, typed from `en.json`, so a typo fails
  `typecheck`. Placeholders go in options:
  `new customError("positions.nameTaken", StatusCodes.CONFLICT, { params: { name } })`.
  `errorHandler` translates the key, which is why services never need `req`.
- Success messages in controllers: `message: t(req, "auth.signedOut")` or
  `t(req, "people.added", { firstName, lastName })`, from `i18n/index.ts`.
- zod schemas use keys as messages: `.min(8, "validation.passwordMin")`. A rule with no
  custom message falls back to a generic key by issue code (`validation.tooLong` with
  `{{max}}`) in `middlewares/validate.ts`, so zod's own English never reaches a client.
- Plurals: `stillHeld_one` / `stillHeld_other` in the JSON, addressed as
  `positions.stillHeld` with a `count` param.
- Labels the UI shows as data — permission-matrix rows, group names — are **not**
  translated here. Send keys (`matrix.rows.quoteManage`) or codes (`technician`) and let
  the client translate, so a runtime language switch re-renders without a refetch.
- Prefer one key per message; reuse it (`auth.usernameTaken` is thrown from two places)
  rather than minting near-duplicates.
