import { PageMeta } from './pagination.model';
import { Role, UserStatus } from './user.model';

/**
 * A row of the staff roster.
 *
 * Employee-centric, not user-centric: the roster lists everyone who works on
 * projects, including people who have no login at all. Those rows carry a
 * null `userId`, `status` and `roleCode` — a user group is only meaningful
 * for someone who can actually sign in.
 */
export interface Person {
  employeeId: number;
  userId: number | null;
  firstName: string;
  lastName: string;
  initials: string;
  username: string | null;
  email: string | null;
  /** The position's name for display; the id is what the edit drawer preselects. */
  position: string | null;
  positionId: number | null;
  phone: string | null;
  isFieldStaff: boolean;
  isActive: boolean;
  roleCode: string | null;
  roleName: string | null;
  status: UserStatus | null;
  lastLoginAt: string | null;
  /**
   * Absent — not null — unless the signed-in user holds project.view_cost.
   * The server omits the key entirely, so there is nothing to leak in the
   * response body.
   */
  hourlyCost?: string;
}

export interface PeopleResponse {
  people: Person[];
  canViewCost: boolean;
  /** Groups this actor may hand out. Mirrors the server's own check. */
  grantableRoleCodes: string[];
  meta: PageMeta;
}

export interface PersonResponse {
  message: string;
  person: Person;
}

export interface NewLogin {
  username: string;
  email: string;
  password: string;
  roleCode: string;
}

export interface CreatePersonRequest {
  firstName: string;
  lastName: string;
  positionId?: number;
  phone?: string;
  hourlyCost?: number;
  /**
   * Required: the Add-employee form always creates an account. The API still
   * accepts a person without one — the roster holds staff who never sign in —
   * but nothing in this app creates one that way.
   */
  login: NewLogin;
}

export interface UpdatePersonRequest {
  firstName?: string;
  lastName?: string;
  /** null clears it — the drawer's "—" option. */
  positionId?: number | null;
  phone?: string | null;
  isFieldStaff?: boolean;
  hourlyCost?: number;
}

/**
 * One cell of the Groups & permissions table.
 *
 * `text`, like `MatrixRow.label` and `area`, is a translation key (under
 * "matrix" in public/i18n/*.json), not display text: the server sends keys so
 * the table re-renders in the new language on a switch, without a refetch.
 */
export interface MatrixCell {
  kind: 'yes' | 'text' | 'no';
  text?: string;
}

export interface MatrixRow {
  /** Translation key, e.g. "matrix.rows.quoteManage". */
  label: string;
  /** Translation key, e.g. "matrix.areas.quotes". */
  area: string;
  cells: MatrixCell[];
}

export interface PermissionMatrix {
  groups: Role[];
  rows: MatrixRow[];
}
