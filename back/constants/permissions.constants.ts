import { ROLE_CODES, type RoleCode } from "./user.constants.js";

/**
 * Permission catalogue, transcribed from the "Groups & permissions" matrix
 * in the Users design.
 *
 * `PermissionScope` only has ALL | OWN, so the matrix's "View" and "No admins"
 * cells become their own narrower permission codes rather than a scope.
 */
export const PERMISSIONS: ReadonlyArray<{
  code: string;
  module: string;
  description: string;
}> = [
  // quoting
  { code: "quote.manage", module: "quoting", description: "Create, edit & copy quotes" },
  { code: "quote.view_cost", module: "quoting", description: "See cost price & margin" },
  { code: "quote.accept", module: "quoting", description: "Accept quote & assign project manager" },
  // catalog
  { code: "catalog.manage", module: "catalog", description: "Manage products, services & clients" },
  { code: "catalog.view", module: "catalog", description: "View products, services & clients" },
  // reports
  { code: "report.sales", module: "reports", description: "Sales reports & statistics" },
  { code: "report.project", module: "reports", description: "Project reports" },
  // projects
  { code: "project.manage", module: "projects", description: "Project dashboard, team & planning" },
  { code: "project.view_cost", module: "projects", description: "See salaries & daily costs" },
  // field
  { code: "field.bom", module: "field", description: "Quote as bill of materials (no prices)" },
  { code: "field.daily_report", module: "field", description: "Write daily reports" },
  { code: "field.assignment", module: "field", description: "View own assignments" },
  // administration
  { code: "admin.users", module: "core", description: "Manage users & groups" },
  { code: "admin.users.non_admin", module: "core", description: "Manage non-admin users & groups" },
  { code: "admin.settings", module: "core", description: "Settings & Sales DB sync" },
  { code: "admin.settings.view", module: "core", description: "View settings & Sales DB sync" },
];

export type PermissionCode = (typeof PERMISSIONS)[number]["code"];

type Scope = "ALL" | "OWN";

/** roleCode -> [permissionCode, scope][] */
export const ROLE_PERMISSIONS: Record<RoleCode, ReadonlyArray<[string, Scope]>> = {
  [ROLE_CODES.SUPER_ADMIN]: [
    ["quote.manage", "ALL"],
    ["quote.view_cost", "ALL"],
    ["quote.accept", "ALL"],
    ["catalog.manage", "ALL"],
    ["report.sales", "ALL"],
    ["report.project", "ALL"],
    ["project.manage", "ALL"],
    ["project.view_cost", "ALL"],
    ["field.bom", "ALL"],
    ["field.daily_report", "ALL"],
    ["field.assignment", "ALL"],
    ["admin.users", "ALL"],
    ["admin.settings", "ALL"],
  ],
  [ROLE_CODES.ADMIN]: [
    ["quote.manage", "ALL"],
    ["quote.view_cost", "ALL"],
    ["quote.accept", "ALL"],
    ["catalog.manage", "ALL"],
    ["report.sales", "ALL"],
    ["report.project", "ALL"],
    ["project.manage", "ALL"],
    ["project.view_cost", "ALL"],
    ["field.bom", "ALL"],
    ["field.daily_report", "ALL"],
    ["field.assignment", "ALL"],
    ["admin.users.non_admin", "ALL"],
    ["admin.settings.view", "ALL"],
  ],
  [ROLE_CODES.PROJECT_MANAGER]: [
    ["quote.manage", "ALL"],
    ["quote.view_cost", "ALL"],
    ["catalog.view", "ALL"],
    ["report.sales", "ALL"],
    ["report.project", "ALL"],
    ["project.manage", "OWN"],
    ["project.view_cost", "ALL"],
    ["field.bom", "ALL"],
    ["field.daily_report", "ALL"],
    ["field.assignment", "ALL"],
  ],
  [ROLE_CODES.USER]: [
    ["quote.manage", "ALL"],
    ["quote.view_cost", "ALL"],
    ["catalog.manage", "ALL"],
    ["report.sales", "OWN"],
  ],
  [ROLE_CODES.TEAM_LEADER]: [
    ["field.bom", "OWN"],
    ["field.daily_report", "OWN"],
    ["field.assignment", "ALL"],
  ],
  [ROLE_CODES.TECHNICIAN]: [["field.assignment", "OWN"]],
};

/**
 * Display spec for the "Groups & permissions" table, one entry per row of the
 * design matrix.
 *
 * A design row can cover two codes: the matrix shows a single "Products,
 * services & clients" row where a project manager reads `View`, which is the
 * separate `catalog.view` grant. `narrow` names that weaker code and the label
 * the cell should show for it.
 *
 * Cell resolution, per group:
 *   holds `full` at ALL  -> tick
 *   holds `full` at OWN  -> pill reading matrix.cells.own
 *   holds `narrow`       -> pill reading narrow.text
 *   otherwise            -> dash
 *
 * `label`, `area` and `narrow.text` are translation keys that the client
 * resolves from its own `public/i18n/*.json` (under "matrix"). They are sent
 * as-is: UI text is the client's to translate, so a runtime language switch
 * re-renders the table without another fetch.
 */
export const MATRIX_ROWS: ReadonlyArray<{
  label: string;
  area: string;
  full: string;
  narrow?: { code: string; text: string };
}> = [
  { label: "matrix.rows.quoteManage", area: "matrix.areas.quotes", full: "quote.manage" },
  { label: "matrix.rows.quoteViewCost", area: "matrix.areas.quotes", full: "quote.view_cost" },
  {
    label: "matrix.rows.catalogManage",
    area: "matrix.areas.catalog",
    full: "catalog.manage",
    narrow: { code: "catalog.view", text: "matrix.cells.view" },
  },
  { label: "matrix.rows.reportSales", area: "matrix.areas.reports", full: "report.sales" },
  { label: "matrix.rows.quoteAccept", area: "matrix.areas.quotesToProjects", full: "quote.accept" },
  { label: "matrix.rows.projectManage", area: "matrix.areas.projects", full: "project.manage" },
  { label: "matrix.rows.projectViewCost", area: "matrix.areas.projects", full: "project.view_cost" },
  { label: "matrix.rows.fieldBom", area: "matrix.areas.field", full: "field.bom" },
  { label: "matrix.rows.fieldDailyReport", area: "matrix.areas.field", full: "field.daily_report" },
  { label: "matrix.rows.fieldAssignment", area: "matrix.areas.field", full: "field.assignment" },
  { label: "matrix.rows.reportProject", area: "matrix.areas.reports", full: "report.project" },
  {
    label: "matrix.rows.adminUsers",
    area: "matrix.areas.administration",
    full: "admin.users",
    narrow: { code: "admin.users.non_admin", text: "matrix.cells.noAdmins" },
  },
  {
    label: "matrix.rows.adminSettings",
    area: "matrix.areas.administration",
    full: "admin.settings",
    narrow: { code: "admin.settings.view", text: "matrix.cells.view" },
  },
];
