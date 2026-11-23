export const USER_ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  PROJECT_MANAGER: "project_manager",
  TEAM_LEADER: "team_leader",
  TECHNICIAN: "technician",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const USER_STATUSES = {
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;

export type UserStatus = (typeof USER_STATUSES)[keyof typeof USER_STATUSES];