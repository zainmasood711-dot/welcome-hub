import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

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

export function hasAnyRole(roles: AppRole[], required: AppRole[]) {
  return required.some((role) => roles.includes(role));
}