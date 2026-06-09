import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type AppPermission =
  | "dashboard.read"
  | "reports.operational.read"
  | "reports.management.read"
  | "customers.read"
  | "customers.manage"
  | "customer_systems.read"
  | "customer_systems.manage"
  | "products.read"
  | "products.manage"
  | "error_codes.read"
  | "error_codes.manage"
  | "tickets.read_all"
  | "tickets.manage"
  | "remote_solutions.manage"
  | "field_assignments.read_assigned"
  | "field_assignments.read_all"
  | "field_assignments.manage"
  | "install_assignments.read_assigned"
  | "install_assignments.read_all"
  | "install_assignments.manage"
  | "attachments.read_assigned"
  | "attachments.manage"
  | "knowledge_base.read"
  | "knowledge_base.manage"
  | "notifications.read"
  | "notifications.manage"
  | "engineers.read_assigned"
  | "engineers.read_all"
  | "engineers.manage"
  | "statuses.manage";

export const roleLabels: Record<AppRole, string> = {
  support_engineer: "مهندس دعم",
  field_engineer: "مهندس ميداني",
  manager: "مدير",
};

export const roleHomePath: Record<AppRole, string> = {
  support_engineer: "/dashboard",
  field_engineer: "/dashboard",
  manager: "/dashboard",
};

export const rolePermissions: Record<AppRole, AppPermission[]> = {
  support_engineer: [
    "dashboard.read",
    "reports.operational.read",
    "customers.read",
    "customers.manage",
    "customer_systems.read",
    "customer_systems.manage",
    "products.read",
    "products.manage",
    "error_codes.read",
    "error_codes.manage",
    "tickets.read_all",
    "tickets.manage",
    "remote_solutions.manage",
    "field_assignments.read_all",
    "field_assignments.manage",
    "install_assignments.read_all",
    "install_assignments.manage",
    "attachments.manage",
    "knowledge_base.read",
    "knowledge_base.manage",
    "notifications.read",
    "notifications.manage",
    "engineers.read_all",
    "engineers.manage",
    "statuses.manage",
  ],
  field_engineer: [
    "dashboard.read",
    "products.read",
    "error_codes.read",
    "customers.read",
    "customer_systems.read",
    "tickets.read_all",
    "field_assignments.read_assigned",
    "install_assignments.read_assigned",
    "attachments.read_assigned",
    "notifications.read",
    "engineers.read_assigned",
  ],
  manager: [
    "dashboard.read",
    "reports.management.read"
  ],
};

export function hasAnyRole(roles: AppRole[], required: AppRole[]) {
  return required.some((role) => roles.includes(role));
}

export function getPermissionsForRoles(roles: AppRole[]) {
  return Array.from(new Set(roles.flatMap((role) => rolePermissions[role] ?? [])));
}

export function hasPermission(roles: AppRole[], permission: AppPermission) {
  return getPermissionsForRoles(roles).includes(permission);
}

export function hasAnyPermission(roles: AppRole[], permissions: AppPermission[]) {
  const userPermissions = getPermissionsForRoles(roles);
  return permissions.some((permission) => userPermissions.includes(permission));
}