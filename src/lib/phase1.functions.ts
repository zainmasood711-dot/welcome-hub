import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const rolePriority: AppRole[] = ["support_engineer", "manager", "field_engineer"];

const engineerSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(25).optional().nullable(),
  whatsapp: z.string().trim().max(25).optional().nullable(),
  email: z.string().email().optional().nullable(),
  governorate: z.string().trim().max(80).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  specialization: z.string().trim().max(120).optional().nullable(),
  type: z.enum(["internal", "external"]),
  availability_status: z.enum(["available", "busy", "inactive"]),
  notes: z.string().trim().max(1500).optional().nullable(),
});

const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name_ar: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/),
});

const brandSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  category_id: z.string().uuid(),
});

const productSchema = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid(),
  brand_id: z.string().uuid(),
  model: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  is_active: z.boolean(),
});

const errorCodeSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid().optional().nullable(),
  code: z.string().trim().min(1).max(60),
  category: z.enum(["software", "technical"]),
  description: z.string().trim().max(2000).optional().nullable(),
  common_causes: z.string().trim().max(4000).optional().nullable(),
  recommended_solution: z.string().trim().max(4000).optional().nullable(),
  occurrences_count: z.number().int().min(0).max(999999).default(0),
});

const linkEngineerSchema = z.object({
  engineerId: z.string().uuid(),
  profileId: z.string().uuid(),
});

async function getUserRoles(supabase: SupabaseClient<Database>, userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(`تعذر جلب الأدوار: ${error.message}`);
  return (data ?? []).map((row) => row.role);
}

function getPrimaryRole(roles: AppRole[]): AppRole | null {
  for (const role of rolePriority) {
    if (roles.includes(role)) return role;
  }
  return roles[0] ?? null;
}

async function assertSupportRole(supabase: SupabaseClient<Database>, userId: string) {
  const roles = await getUserRoles(supabase, userId);
  if (!roles.includes("support_engineer")) {
    throw new Error("ليس لديك صلاحية لتنفيذ هذا الإجراء");
  }
}

export const getAccessContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, phone, email, engineer_id, is_active")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) throw new Error(`تعذر جلب الملف الشخصي: ${profileError.message}`);

    if (!profile) {
      const { error: createProfileError } = await supabase.from("profiles").insert({
        id: userId,
        full_name: "مستخدم جديد",
      });
      if (createProfileError) {
        throw new Error(`تعذر إنشاء الملف الشخصي: ${createProfileError.message}`);
      }
    }

    const roles = await getUserRoles(supabase, userId);
    return {
      userId,
      profile:
        profile ??
        ({
          id: userId,
          full_name: "مستخدم جديد",
          phone: null,
          email: null,
          engineer_id: null,
          is_active: true,
        } as const),
      roles,
      primaryRole: getPrimaryRole(roles),
    };
  });

export const getDashboardOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const roles = await getUserRoles(supabase, userId);

    const [engineersRes, categoriesRes, brandsRes, productsRes, errorCodesRes] = await Promise.all([
      supabase.from("engineers").select("id, availability_status"),
      supabase.from("product_categories").select("id"),
      supabase.from("brands").select("id"),
      supabase.from("products").select("id, is_active"),
      supabase.from("error_codes").select("id, code, occurrences_count, category"),
    ]);

    const allErrors = [engineersRes, categoriesRes, brandsRes, productsRes, errorCodesRes]
      .map((res) => res.error)
      .filter(Boolean);

    if (allErrors.length > 0) {
      throw new Error(allErrors[0]?.message ?? "تعذر تحميل بيانات لوحة التحكم");
    }

    const engineers = engineersRes.data ?? [];
    const products = productsRes.data ?? [];
    const codes = errorCodesRes.data ?? [];

    const byAvailability = {
      available: engineers.filter((item) => item.availability_status === "available").length,
      busy: engineers.filter((item) => item.availability_status === "busy").length,
      inactive: engineers.filter((item) => item.availability_status === "inactive").length,
    };

    const topCodes = [...codes]
      .sort((a, b) => b.occurrences_count - a.occurrences_count)
      .slice(0, 6)
      .map((item) => ({ code: item.code, count: item.occurrences_count }));

    return {
      roles,
      summary: {
        engineers: engineers.length,
        categories: (categoriesRes.data ?? []).length,
        brands: (brandsRes.data ?? []).length,
        products: products.length,
        activeProducts: products.filter((item) => item.is_active).length,
        errorCodes: codes.length,
      },
      engineersByAvailability: byAvailability,
      topErrorCodes: topCodes,
      errorCodeByCategory: {
        software: codes.filter((item) => item.category === "software").length,
        technical: codes.filter((item) => item.category === "technical").length,
      },
    };
  });

export const listEngineers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("engineers")
      .select("id, name, phone, whatsapp, email, governorate, city, specialization, type, availability_status, notes, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`تعذر جلب المهندسين: ${error.message}`);
    return data ?? [];
  });

export const saveEngineer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => engineerSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertSupportRole(supabase, userId);

    if (data.id) {
      const { data: updated, error } = await supabase
        .from("engineers")
        .update({
          name: data.name,
          phone: data.phone ?? null,
          whatsapp: data.whatsapp ?? null,
          email: data.email ?? null,
          governorate: data.governorate ?? null,
          city: data.city ?? null,
          specialization: data.specialization ?? null,
          type: data.type,
          availability_status: data.availability_status,
          notes: data.notes ?? null,
        })
        .eq("id", data.id)
        .select("id")
        .single();

      if (error) throw new Error(`تعذر تحديث بيانات المهندس: ${error.message}`);
      return { id: updated.id };
    }

    const { data: created, error } = await supabase
      .from("engineers")
      .insert({
        name: data.name,
        phone: data.phone ?? null,
        whatsapp: data.whatsapp ?? null,
        email: data.email ?? null,
        governorate: data.governorate ?? null,
        city: data.city ?? null,
        specialization: data.specialization ?? null,
        type: data.type,
        availability_status: data.availability_status,
        notes: data.notes ?? null,
      })
      .select("id")
      .single();

    if (error) throw new Error(`تعذر إنشاء المهندس: ${error.message}`);
    return { id: created.id };
  });

export const listProfilesForLink = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSupportRole(supabase, userId);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, engineer_id")
      .order("created_at", { ascending: false });

    if (error) throw new Error(`تعذر جلب المستخدمين: ${error.message}`);
    return data ?? [];
  });

export const linkEngineerToProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => linkEngineerSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertSupportRole(supabase, userId);

    const { error } = await supabase
      .from("profiles")
      .update({ engineer_id: data.engineerId })
      .eq("id", data.profileId);

    if (error) throw new Error(`تعذر ربط المهندس بالمستخدم: ${error.message}`);
    return { ok: true };
  });

export const getCatalogData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [categoriesRes, brandsRes, productsRes] = await Promise.all([
      supabase.from("product_categories").select("id, name_ar, slug, created_at").order("name_ar"),
      supabase.from("brands").select("id, name, category_id, created_at").order("name"),
      supabase
        .from("products")
        .select("id, category_id, brand_id, model, description, is_active, created_at")
        .order("created_at", { ascending: false }),
    ]);

    const allErrors = [categoriesRes.error, brandsRes.error, productsRes.error].filter(Boolean);
    if (allErrors.length > 0) {
      throw new Error(allErrors[0]?.message ?? "تعذر تحميل بيانات المنتجات");
    }

    return {
      categories: categoriesRes.data ?? [],
      brands: brandsRes.data ?? [],
      products: productsRes.data ?? [],
    };
  });

export const saveCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => categorySchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertSupportRole(supabase, userId);

    if (data.id) {
      const { error } = await supabase
        .from("product_categories")
        .update({ name_ar: data.name_ar, slug: data.slug })
        .eq("id", data.id);
      if (error) throw new Error(`تعذر تعديل الفئة: ${error.message}`);
      return { ok: true };
    }

    const { error } = await supabase.from("product_categories").insert({
      name_ar: data.name_ar,
      slug: data.slug,
    });
    if (error) throw new Error(`تعذر إنشاء الفئة: ${error.message}`);
    return { ok: true };
  });

export const saveBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => brandSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertSupportRole(supabase, userId);

    if (data.id) {
      const { error } = await supabase
        .from("brands")
        .update({ name: data.name, category_id: data.category_id })
        .eq("id", data.id);
      if (error) throw new Error(`تعذر تعديل العلامة التجارية: ${error.message}`);
      return { ok: true };
    }

    const { error } = await supabase.from("brands").insert({
      name: data.name,
      category_id: data.category_id,
    });
    if (error) throw new Error(`تعذر إنشاء العلامة التجارية: ${error.message}`);
    return { ok: true };
  });

export const saveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => productSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertSupportRole(supabase, userId);

    if (data.id) {
      const { error } = await supabase
        .from("products")
        .update({
          category_id: data.category_id,
          brand_id: data.brand_id,
          model: data.model,
          description: data.description ?? null,
          is_active: data.is_active,
        })
        .eq("id", data.id);
      if (error) throw new Error(`تعذر تعديل المنتج: ${error.message}`);
      return { ok: true };
    }

    const { error } = await supabase.from("products").insert({
      category_id: data.category_id,
      brand_id: data.brand_id,
      model: data.model,
      description: data.description ?? null,
      is_active: data.is_active,
    });
    if (error) throw new Error(`تعذر إنشاء المنتج: ${error.message}`);
    return { ok: true };
  });

export const listErrorCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("error_codes")
      .select("id, code, category, description, common_causes, recommended_solution, occurrences_count, product_id, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`تعذر جلب رموز الأخطاء: ${error.message}`);
    return data ?? [];
  });

export const saveErrorCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => errorCodeSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertSupportRole(supabase, userId);

    if (data.id) {
      const { error } = await supabase
        .from("error_codes")
        .update({
          product_id: data.product_id ?? null,
          code: data.code,
          category: data.category,
          description: data.description ?? null,
          common_causes: data.common_causes ?? null,
          recommended_solution: data.recommended_solution ?? null,
          occurrences_count: data.occurrences_count,
        })
        .eq("id", data.id);
      if (error) throw new Error(`تعذر تعديل رمز الخطأ: ${error.message}`);
      return { ok: true };
    }

    const { error } = await supabase.from("error_codes").insert({
      product_id: data.product_id ?? null,
      code: data.code,
      category: data.category,
      description: data.description ?? null,
      common_causes: data.common_causes ?? null,
      recommended_solution: data.recommended_solution ?? null,
      occurrences_count: data.occurrences_count,
    });
    if (error) throw new Error(`تعذر إنشاء رمز الخطأ: ${error.message}`);
    return { ok: true };
  });