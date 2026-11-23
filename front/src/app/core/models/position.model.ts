import { PageMeta } from './pagination.model';

/**
 * A job title. Separate from the group/role: the role decides what you may do,
 * the position is what you are called.
 */
export interface Position {
  id: number;
  name: string;
  /** Retired positions stay on the people who hold them but leave the dropdowns. */
  isActive: boolean;
  /** How many people hold it — lets the UI explain a refused delete up front. */
  employeeCount: number;
}

/** `GET /api/positions/selectable` — public, active only, for the register form. */
export interface SelectablePosition {
  id: number;
  name: string;
}

/** `GET /api/positions` — one page of the management list. */
export interface PositionsResponse {
  positions: Position[];
  /** Across every page, not just this one: feeds the "N of M in use" header. */
  activeCount: number;
  meta: PageMeta;
}

export interface SelectablePositionsResponse {
  positions: SelectablePosition[];
}

export interface PositionResponse {
  message: string;
  position: Position;
}

export interface CreatePositionRequest {
  name: string;
}

export interface UpdatePositionRequest {
  name?: string;
  isActive?: boolean;
}
