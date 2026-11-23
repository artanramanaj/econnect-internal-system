export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';
export type PermissionScope = 'ALL' | 'OWN';

export interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  /** Flattened from the positions table for display. */
  position: string | null;
  positionId: number | null;
  phone: string | null;
}

export interface User {
  id: number;
  username: string;
  email: string;
  status: UserStatus;
  locale: string;
  createdAt: string;
  lastLoginAt: string | null;
  roles: string[];
  employee: Employee | null;
}

export interface Permission {
  code: string;
  scope: PermissionScope;
}

export interface Role {
  id: number;
  code: string;
  name: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  positionId?: number;
  phone?: string;
  requestedRoleCode: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterResponse {
  message: string;
  user: User;
}

/**
 * login and refresh share this envelope.
 *
 * `permissions` is optional because the role/status endpoints reuse this shape
 * and return only the changed user.
 */
export interface AuthResponse {
  message: string;
  user: User;
  permissions?: Permission[];
}

export interface MeResponse {
  user: User;
  permissions: Permission[];
}

export interface RolesResponse {
  roles: Role[];
}

export interface FieldIssue {
  field: string;
  message: string;
}

/** Body returned by the backend error handler. */
export interface ApiError {
  message: string;
  issues?: FieldIssue[];
}
