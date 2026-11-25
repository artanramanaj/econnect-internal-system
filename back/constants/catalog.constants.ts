/**
 * Catalogue reference data and the ProData ownership rule.
 *
 * Unit and VAT names are stored in English, like role names: the client
 * renders them from its own `units.<code>` / `vat.<code>` keys and only falls
 * back to these for a code it has no translation for.
 */

/** The units a fresh database starts with. The ProData sync may add more. */
export const DEFAULT_UNITS: ReadonlyArray<{ code: string; name: string }> = [
  { code: "pcs", name: "Pieces" },
  { code: "m", name: "Metres" },
  { code: "box", name: "Boxes" },
  { code: "hr", name: "Hours" },
];

/**
 * The product categories a fresh database starts with. Managed in the app
 * afterwards (Products screen), and the ProData sync may add more.
 */
export const DEFAULT_CATEGORIES: readonly string[] = [
  "Access Control",
  "Theft Alarm",
  "Fire Alarm",
  "Anti-Shoplifting",
  "Asset",
  "Desktop",
  "Drive-Thru Headset System",
  "Electrical",
  "Electronics",
  "Automatic Fire Suppression",
  "Hard Drive",
  "Intercom",
  "Cabling",
  "LAN",
  "Laptop",
  "Licenses",
  "AVIGILON Licenses",
  "Vehicles",
  "Monitor",
  "People Counter System",
  "Projector",
  "Restaurant System",
  "Server",
  "Services",
  "Expense",
  "Lock System",
  "Analog Camera System",
  "IP Camera System",
  "Telephone",
  "Throne L.L.C",
  "Throne Sport",
  "Other",
  "TV",
  "UPS",
  "Video Intercom",
  "Sound System",
];

/**
 * Kosovo VAT rates in force since 1 September 2015. A future change of rate is
 * a new row with a later validFrom (and validTo set on the old one), never an
 * edit of these, so older documents keep the rate of their date.
 */
export const DEFAULT_VAT_RATES: ReadonlyArray<{
  code: string;
  name: string;
  rate: string;
  validFrom: string;
}> = [
  { code: "STANDARD", name: "Standard rate", rate: "18.00", validFrom: "2015-09-01" },
  { code: "REDUCED", name: "Reduced rate", rate: "8.00", validFrom: "2015-09-01" },
  { code: "ZERO", name: "Zero rate", rate: "0.00", validFrom: "2015-09-01" },
];

/**
 * Item fields the nightly ProData sync owns. On a PRODATA item the API refuses
 * to change them (`items.syncManaged`) and the drawer shows them read-only, so
 * no edit is silently overwritten at 22:00. Type, alternative units and the
 * archive flag stay editable. Sent to the client by GET /api/items/options.
 */
export const SYNC_OWNED_FIELDS = [
  "sku",
  "description",
  "categoryId",
  "brandId",
  "manufacturer",
  "barcode",
  "baseUnitCode",
  "vatCode",
  "costPrice",
] as const;

export type SyncOwnedField = (typeof SYNC_OWNED_FIELDS)[number];

/**
 * The one PDF a product may carry (brochure / datasheet). The limit is shared
 * by the multer middleware and the client-side pre-check.
 */
export const BROCHURE_MAX_MB = 25;
