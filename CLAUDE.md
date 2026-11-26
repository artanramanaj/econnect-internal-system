# eConnectSystem

Two apps, each with its own `CLAUDE.md`:

- `back/` — Express API on port 3000.
- `front/` — Angular app on port 4200; `/api` is proxied to the backend.

The product is bilingual: Albanian (`sq`, the default) and English (`en`), switchable at
runtime. Every user-facing string — UI text in the frontend, response messages in the
backend — must be added to **both** language files of the side it belongs to. See the
i18n section of `front/CLAUDE.md` and `back/CLAUDE.md` before adding any text.

## Business flow — catalogue → quote → project

EMS (eConnect Management System) is an internal tool on a private server. **Clients never
log in.** A quote reaches them as a PDF outside EMS, and their answer comes back by email,
phone or a signed order, which a person records.

1. **Catalogue.** Products and services (`items`) come from the nightly ProData sync or are
   added locally. A ProData item's synced fields are read-only in EMS.
2. **Quote.** A project manager builds the quote from catalogue items and free lines, priced
   per line (Algorithm 6.1): type a markup and the price follows, or type a price and the
   markup follows.
3. **Approval** (Algorithm 6.3). The threshold is 10%, stored in `app_settings` and never
   hardcoded. What happens below it depends on who saves the revision:
   - **Someone without `quote.approve`** (a project manager, a sales user): the quote becomes
     `PENDING_APPROVAL` and cannot be sent until an admin approves or rejects it.
   - **An approver** (admin, super admin): the save is not held. They get a warning, and the
     revision is recorded as approved by them at save time.

   The rule follows the person saving that revision, not the quote's author. Any edit after
   approval clears it and re-runs the check.
4. **PDF.** The PDF is generated, stored with its SHA-256, and the revision is locked.
5. **Outside EMS.** The PDF goes to the client by email or on paper; the client replies
   however clients reply.
6. **Acceptance.** A person marks the revision accepted, types the client's order reference
   and attaches whatever the client sent.
7. **Project.** EMS creates the project automatically, in that same transaction.

Steps 1–3 are built. Steps 4–7 are not yet.

### Rules that hold everywhere in quoting

- **Partners, not clients.** One `partners` table with `is_customer` / `is_supplier` flags:
  a client can also be a supplier. The UI says "client" where it means a customer.
- **Lines belong to a revision, never to a quote.** A quote always has at least revision 1.0,
  created in the same transaction as the quote.
- **A save creates the next revision** (1.0 → 1.1 → 1.2). Earlier revisions are never
  modified; exactly one has `is_current = true`.
- **Lines copy, they do not reference.** `sku`, `description`, `unit_cost` and `vat_rate` are
  copied onto the line when it is created, so later catalogue or VAT changes cannot alter a
  saved quote. `item_id` is nullable: free lines have no catalogue item.
- **Money is Decimal, never a float.** `decimal.js` end to end, strings at the API boundary.
  Unit prices keep 4 decimals, totals 2, rounded half-up. VAT is summed per rate and rounded
  once per rate.
- **The server is authoritative.** The client recalculates for instant feedback
  (`front/.../quotes/quote-pricing.ts` mirrors `back/services/quotePricing.ts` — change both
  together), but every save is recalculated on the server.
- **Quote numbers are gap-free** (`EC-YYYY-NNNN`, a legal requirement): reserved from
  `document_sequences` with `SELECT … FOR UPDATE` inside the creating transaction. Never a
  Postgres sequence — those skip numbers on rollback.
- **Status changes go through `back/services/quoteStatus.ts`**, the one transition map. No
  controller compares statuses on its own.
