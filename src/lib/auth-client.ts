import { redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/roles";

export async function requireAuthenticatedUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw redirect({ to: "/auth" });
  }
  return data.user;
}

export async function getClientRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error("تعذر تحميل صلاحيات المستخدم");
  return (data ?? []).map((row) => row.role);
}

export async function requireRole(allowed: AppRole[]) {
  const user = await requireAuthenticatedUser();
  const roles = await getClientRoles(user.id);
  const isAllowed = roles.some((role) => allowed.includes(role));
  if (!isAllowed) {
    throw redirect({ to: "/dashboard" });
  }
  return { user, roles };
}