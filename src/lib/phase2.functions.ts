import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const customerSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(6).max(25),
  governorate: z.string().trim().max(80).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  location_coordinates: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

const customerSystemSchema = z.object({
  id: z.string().uuid().optional(),
  customer_id: z.string().uuid(),
  system_name: z.string().trim().min(2).max(180),
  installation_date: z.string().optional().nullable(),
  status: z.enum(["active", "inactive"]),
  notes: z.string().trim().max(2000).optional().nullable(),
});

const systemAssetSchema = z.object({
  id: z.string().uuid().optional(),
  customer_system_id: z.string().uuid(),
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(999),
  serial_number: z.string().trim().max(150).optional().nullable(),
  warranty_status: z.enum(["valid", "expired", "unknown"]),
  notes: z.string().trim().max(2000).optional().nullable(),
});

const ticketSchema = z.object({
  id: z.string().uuid().optional(),
  customer_id: z.string().uuid(),
  customer_system_id: z.string().uuid().optional().nullable(),
  ticket_type: z.enum(["fault", "inquiry", "preventive_maintenance", "new_installation"]),
  status: z.enum(["new", "in_progress", "resolved_remote", "assigned_field", "closed"]),
  priority: z.enum(["low", "medium", "high", "critical"]),
  description: z.string().trim().min(5).max(2500),
  affected_product_id: z.string().uuid().optional().nullable(),
  error_code_text: z.string().trim().max(80).optional().nullable(),
  solution_type: z.enum(["remote", "field", "bring_to_center", "no_fix_needed"]).optional().nullable(),
  remote_solution_notes: z.string().trim().max(4000).optional().nullable(),
  knowledge_base_id: z.string().uuid().optional().nullable(),
  knowledge_feedback_rating: z.enum(["success", "failure", "partial"]).optional().nullable(),
  knowledge_feedback_notes: z.string().trim().max(1500).optional().nullable(),
  resolved_by: z.string().uuid().optional().nullable(),
  resolved_at: z.string().optional().nullable(),
});

const assignmentSchema = z.object({
  id: z.string().uuid().optional(),
  ticket_id: z.string().uuid().optional().nullable(),
  customer_system_id: z.string().uuid().optional().nullable(),
  engineer_id: z.string().uuid(),
  assignment_type: z.enum(["repair_visit", "new_installation"]),
  scheduled_date: z.string().optional().nullable(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
  work_done: z.string().trim().max(4000).optional().nullable(),
  difficulties: z.string().trim().max(4000).optional().nullable(),
  recommendations: z.string().trim().max(4000).optional().nullable(),
});

const assignmentFieldUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
  work_done: z.string().trim().max(4000).optional().nullable(),
  difficulties: z.string().trim().max(4000).optional().nullable(),
  recommendations: z.string().trim().max(4000).optional().nullable(),
});

const attachmentSchema = z.object({
  id: z.string().uuid().optional(),
  attachable_type: z.enum(["ticket", "assignment", "knowledge_base"]),
  attachable_id: z.string().uuid(),
  file_type: z.enum(["image", "battery_file", "document"]),
  file_path: z
    .string()
    .trim()
    .min(3)
    .max(500)
    .regex(/^.+\.[a-zA-Z0-9]+$/, "file_path يجب أن يحتوي امتداد ملف صالح"),
  original_name: z.string().trim().max(255).optional().nullable(),
  file_size: z.number().int().min(0).max(20_971_520).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
});

const knowledgeSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(3).max(200),
  issue_description: z.string().trim().min(3).max(5000),
  solution_steps: z.string().trim().min(3).max(8000),
  product_id: z.string().uuid().optional().nullable(),
  error_code_text: z.string().trim().max(80).optional().nullable(),
  search_keywords: z.string().trim().max(500).optional().nullable(),
  source: z.enum(["manual", "auto_from_ticket"]),
  linked_ticket_ids: z.array(z.string().uuid()).default([]),
  success_count: z.number().int().min(0).max(999999).default(0),
  fail_count: z.number().int().min(0).max(999999).default(0),
  effectiveness_rate: z.number().min(0).max(100).default(0),
});

const knowledgeFeedbackSchema = z.object({
  knowledge_base_id: z.string().uuid(),
  ticket_id: z.string().uuid().optional().nullable(),
  engineer_id: z.string().uuid(),
  rating: z.enum(["success", "failure", "partial"]),
  notes: z.string().trim().max(1500).optional().nullable(),
});

const notificationSchema = z.object({
  title: z.string().trim().min(2).max(180),
  body: z.string().trim().min(2).max(3000),
  type: z.string().trim().max(40).default("info"),
  target_role: z.enum(["support_engineer", "field_engineer", "manager"]).optional().nullable(),
  target_user_id: z.string().uuid().optional().nullable(),
  related_type: z.string().trim().max(60).optional().nullable(),
  related_id: z.string().uuid().optional().nullable(),
});

const readNotificationSchema = z.object({
  notification_id: z.string().uuid(),
});

const knowledgeSearchSchema = z.object({
  affected_product_id: z.string().uuid().optional().nullable(),
  error_code_text: z.string().trim().max(80).optional().nullable(),
  issue_description: z.string().trim().max(2500).optional().nullable(),
  limit: z.number().int().min(1).max(10).default(5),
});

const createKnowledgeFromTicketSchema = z.object({
  ticket_id: z.string().uuid(),
  title: z.string().trim().min(3).max(200).optional().nullable(),
});

const imageExtensions = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const documentExtensions = new Set(["pdf", "doc", "docx", "xls", "xlsx", "csv", "txt"]);
const batteryExtensions = new Set(["csv", "xlsx", "txt", "bin"]);
const keywordStopWords = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "على",
  "من",
  "في",
  "الى",
  "إلى",
  "عن",
  "تم",
  "كان",
  "وجود",
  "عند",
  "عدم",
  "بعد",
  "قبل",
]);

function getFileExtension(path: string) {
  const clean = path.trim().toLowerCase();
  const ext = clean.split(".").pop() ?? "";
  return ext;
}

function validateAttachmentInput(data: z.infer<typeof attachmentSchema>) {
  const ext = getFileExtension(data.file_path);
  if (!ext) {
    throw new Error("امتداد الملف غير صالح");
  }

  if (data.file_type === "image" && !imageExtensions.has(ext)) {
    throw new Error("نوع الملف لا يتوافق مع مرفق الصورة");
  }

  if (data.file_type === "document" && !documentExtensions.has(ext)) {
    throw new Error("نوع الملف لا يتوافق مع مرفق المستند");
  }

  if (data.file_type === "battery_file" && !batteryExtensions.has(ext)) {
    throw new Error("نوع الملف لا يتوافق مع مرفق البطارية");
  }

  if (data.file_size != null && data.file_size > 20_971_520) {
    throw new Error("حجم الملف يتجاوز الحد المسموح 20MB");
  }
}

function normalizeText(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function calculateEffectivenessRate(successCount: number, failCount: number) {
  const total = successCount + failCount;
  if (total === 0) return 0;
  return Number(((successCount / total) * 100).toFixed(2));
}

function extractImportantWords(text?: string | null) {
  return Array.from(
    new Set(
      normalizeText(text)
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((word) => word.length >= 3 && !keywordStopWords.has(word)),
    ),
  ).slice(0, 12);
}

async function getUserRoles(supabase: SupabaseClient<Database>, userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(`تعذر جلب الأدوار: ${error.message}`);
  return (data ?? []).map((row) => row.role);
}

async function assertSupportRole(supabase: SupabaseClient<Database>, userId: string) {
  const roles = await getUserRoles(supabase, userId);
  if (!roles.includes("support_engineer")) {
    throw new Error("ليس لديك صلاحية لتنفيذ هذا الإجراء");
  }
}

export const getPhase2References = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [customers, systems, products, engineers, kb, tickets, assignments] = await Promise.all([
      supabase.from("customers").select("id, name, phone").order("created_at", { ascending: false }),
      supabase.from("customer_systems").select("id, customer_id, system_name, status").order("created_at", { ascending: false }),
      supabase.from("products").select("id, model").eq("is_active", true).order("model"),
      supabase.from("engineers").select("id, name, availability_status").order("name"),
      supabase.from("knowledge_base").select("id, title, error_code_text").order("created_at", { ascending: false }),
      supabase.from("tickets").select("id, customer_id, status").order("created_at", { ascending: false }),
      supabase.from("assignments").select("id, ticket_id, status, engineer_id").order("created_at", { ascending: false }),
    ]);

    const errors = [customers.error, systems.error, products.error, engineers.error, kb.error, tickets.error, assignments.error].filter(Boolean);
    if (errors.length > 0) throw new Error(errors[0]?.message ?? "تعذر تحميل بيانات الربط");

    return {
      customers: customers.data ?? [],
      customerSystems: systems.data ?? [],
      products: products.data ?? [],
      engineers: engineers.data ?? [],
      knowledge: kb.data ?? [],
      tickets: tickets.data ?? [],
      assignments: assignments.data ?? [],
    };
  });

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(`تعذر تحميل العملاء: ${error.message}`);
    return data ?? [];
  });

export const saveCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => customerSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertSupportRole(supabase, userId);

    if (data.id) {
      const { error } = await supabase
        .from("customers")
        .update({
          name: data.name,
          phone: data.phone,
          governorate: data.governorate ?? null,
          city: data.city ?? null,
          address: data.address ?? null,
          location_coordinates: data.location_coordinates ?? null,
          notes: data.notes ?? null,
        })
        .eq("id", data.id);
      if (error) throw new Error(`تعذر تعديل العميل: ${error.message}`);
      return { ok: true };
    }

    const { error } = await supabase.from("customers").insert({
      name: data.name,
      phone: data.phone,
      governorate: data.governorate ?? null,
      city: data.city ?? null,
      address: data.address ?? null,
      location_coordinates: data.location_coordinates ?? null,
      notes: data.notes ?? null,
      created_by: userId,
    });
    if (error) throw new Error(`تعذر إنشاء العميل: ${error.message}`);
    return { ok: true };
  });

export const listCustomerSystems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase.from("customer_systems").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(`تعذر تحميل أنظمة العملاء: ${error.message}`);
    return data ?? [];
  });

export const saveCustomerSystem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => customerSystemSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertSupportRole(supabase, userId);

    if (data.id) {
      const { data: updated, error } = await supabase
        .from("customer_systems")
        .update({
          customer_id: data.customer_id,
          system_name: data.system_name,
          installation_date: data.installation_date || null,
          status: data.status,
          notes: data.notes ?? null,
        })
        .eq("id", data.id)
        .select("id")
        .single();
      if (error) throw new Error(`تعذر تعديل نظام العميل: ${error.message}`);
      return { ok: true, id: updated.id };
    }

    const { data: created, error } = await supabase
      .from("customer_systems")
      .insert({
        customer_id: data.customer_id,
        system_name: data.system_name,
        installation_date: data.installation_date || null,
        status: data.status,
        notes: data.notes ?? null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(`تعذر إنشاء نظام العميل: ${error.message}`);
    return { ok: true, id: created.id };
  });

export const listSystemAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase.from("system_assets").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(`تعذر تحميل مكونات الأنظمة: ${error.message}`);
    return data ?? [];
  });

export const saveSystemAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => systemAssetSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertSupportRole(supabase, userId);

    if (data.id) {
      const { error } = await supabase
        .from("system_assets")
        .update({
          customer_system_id: data.customer_system_id,
          product_id: data.product_id,
          quantity: data.quantity,
          serial_number: data.serial_number ?? null,
          warranty_status: data.warranty_status,
          notes: data.notes ?? null,
        })
        .eq("id", data.id);
      if (error) throw new Error(`تعذر تعديل مكون النظام: ${error.message}`);
      return { ok: true };
    }

    const { error } = await supabase.from("system_assets").insert({
      customer_system_id: data.customer_system_id,
      product_id: data.product_id,
      quantity: data.quantity,
      serial_number: data.serial_number ?? null,
      warranty_status: data.warranty_status,
      notes: data.notes ?? null,
    });
    if (error) throw new Error(`تعذر إضافة مكون النظام: ${error.message}`);
    return { ok: true };
  });

export const listTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase.from("tickets").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(`تعذر تحميل التذاكر: ${error.message}`);
    return data ?? [];
  });

export const saveTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ticketSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertSupportRole(supabase, userId);

    if (data.id) {
      const { data: existingTicket, error: existingTicketError } = await supabase
        .from("tickets")
        .select("id, status, knowledge_base_id")
        .eq("id", data.id)
        .single();
      if (existingTicketError) throw new Error(`تعذر التحقق من حالة التذكرة: ${existingTicketError.message}`);

      const { error } = await supabase
        .from("tickets")
        .update({
          customer_id: data.customer_id,
          customer_system_id: data.customer_system_id ?? null,
          ticket_type: data.ticket_type,
          status: data.status,
          priority: data.priority,
          description: data.description,
          affected_product_id: data.affected_product_id ?? null,
          error_code_text: data.error_code_text ?? null,
          solution_type: data.solution_type ?? null,
          remote_solution_notes: data.remote_solution_notes ?? null,
          knowledge_base_id: data.knowledge_base_id ?? null,
          resolved_by: data.resolved_by ?? null,
          resolved_at: data.resolved_at ?? null,
        })
        .eq("id", data.id);
      if (error) throw new Error(`تعذر تعديل التذكرة: ${error.message}`);

      const rating = data.knowledge_feedback_rating;
      const shouldApplyKnowledgeOutcome =
        existingTicket.status !== "closed" &&
        data.status === "closed" &&
        !!data.knowledge_base_id &&
        (rating === "success" || rating === "failure");

      if (shouldApplyKnowledgeOutcome) {
        const { data: kbRow, error: kbReadError } = await supabase
          .from("knowledge_base")
          .select("id, success_count, fail_count")
          .eq("id", data.knowledge_base_id as string)
          .single();
        if (kbReadError) throw new Error(`تعذر تحديث إحصائيات المادة المعرفية: ${kbReadError.message}`);

        const nextSuccess = kbRow.success_count + (rating === "success" ? 1 : 0);
        const nextFail = kbRow.fail_count + (rating === "failure" ? 1 : 0);
        const nextEffectiveness = calculateEffectivenessRate(nextSuccess, nextFail);

        const { error: kbUpdateError } = await supabase
          .from("knowledge_base")
          .update({
            success_count: nextSuccess,
            fail_count: nextFail,
            effectiveness_rate: nextEffectiveness,
          })
          .eq("id", kbRow.id);
        if (kbUpdateError) throw new Error(`تعذر حفظ تقييم نجاح الحل: ${kbUpdateError.message}`);

        const { data: currentProfile } = await supabase.from("profiles").select("engineer_id").eq("id", userId).maybeSingle();
        if (currentProfile?.engineer_id) {
          const { error: feedbackError } = await supabase.from("knowledge_feedback").insert({
            knowledge_base_id: data.knowledge_base_id,
            ticket_id: data.id,
            engineer_id: currentProfile.engineer_id,
            rating,
            notes: data.knowledge_feedback_notes ?? null,
          });
          if (feedbackError) throw new Error(`تعذر تسجيل تقييم الحل: ${feedbackError.message}`);
        }
      }

      return { ok: true };
    }

    const { data: created, error } = await supabase
      .from("tickets")
      .insert({
      customer_id: data.customer_id,
      customer_system_id: data.customer_system_id ?? null,
      ticket_type: data.ticket_type,
      status: data.status,
      priority: data.priority,
      description: data.description,
      affected_product_id: data.affected_product_id ?? null,
      error_code_text: data.error_code_text ?? null,
      solution_type: data.solution_type ?? null,
      remote_solution_notes: data.remote_solution_notes ?? null,
      knowledge_base_id: data.knowledge_base_id ?? null,
      created_by: userId,
      resolved_by: data.resolved_by ?? null,
      resolved_at: data.resolved_at ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(`تعذر إنشاء التذكرة: ${error.message}`);
    return { ok: true, id: created.id };
  });

export const getKnowledgeSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => knowledgeSearchSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const normalizedErrorCode = normalizeText(data.error_code_text);
    const descriptionKeywords = extractImportantWords(data.issue_description);

    const { data: rows, error } = await supabase
      .from("knowledge_base")
      .select("id, title, issue_description, solution_steps, product_id, error_code_text, search_keywords, effectiveness_rate, success_count, fail_count")
      .order("effectiveness_rate", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(120);
    if (error) throw new Error(`تعذر البحث في قاعدة المعرفة: ${error.message}`);

    const ranked = (rows ?? [])
      .map((item) => {
        const sameProduct = !!data.affected_product_id && item.product_id === data.affected_product_id;
        const sameError = !!normalizedErrorCode && normalizeText(item.error_code_text) === normalizedErrorCode;

        let priorityTier: 1 | 2 | 3 | 4 | null = null;
        if (sameError && sameProduct) {
          priorityTier = 1;
        } else if (sameError) {
          priorityTier = 2;
        } else if (sameProduct) {
          priorityTier = 3;
        }

        const searchable = `${item.title} ${item.issue_description} ${item.search_keywords ?? ""}`.toLowerCase();
        const keywordHits = descriptionKeywords.filter((word) => searchable.includes(word)).length;
        if (priorityTier === null && keywordHits > 0) {
          priorityTier = 4;
        }

        if (priorityTier === null) return null;
        return { ...item, priority_tier: priorityTier, keyword_hits: keywordHits };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => {
        if (a.priority_tier !== b.priority_tier) return a.priority_tier - b.priority_tier;
        if (a.keyword_hits !== b.keyword_hits) return b.keyword_hits - a.keyword_hits;
        if (a.effectiveness_rate !== b.effectiveness_rate) return b.effectiveness_rate - a.effectiveness_rate;
        return (b.success_count + b.fail_count) - (a.success_count + a.fail_count);
      })
      .slice(0, data.limit);

    return ranked;
  });

export const createKnowledgeArticleFromTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createKnowledgeFromTicketSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertSupportRole(supabase, userId);

    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("id, description, affected_product_id, error_code_text, remote_solution_notes, knowledge_base_id")
      .eq("id", data.ticket_id)
      .single();
    if (ticketError) throw new Error(`تعذر تحميل التذكرة: ${ticketError.message}`);

    const solutionNotes = ticket.remote_solution_notes?.trim() ?? "";
    if (solutionNotes.length < 10) {
      throw new Error("أضف ملاحظات حل واضحة في التذكرة قبل تحويلها لمادة معرفية");
    }

    const { data: existingArticles, error: existingError } = await supabase
      .from("knowledge_base")
      .select("id")
      .or(
        `and(product_id.eq.${ticket.affected_product_id ?? "00000000-0000-0000-0000-000000000000"},error_code_text.eq.${(ticket.error_code_text ?? "").replace(/,/g, "")}),solution_steps.eq.${solutionNotes.replace(/,/g, " ")}`,
      )
      .limit(1);
    if (existingError) throw new Error(`تعذر التحقق من تكرار المادة: ${existingError.message}`);

    if ((existingArticles ?? []).length > 0) {
      return { created: false, existingArticleId: existingArticles?.[0]?.id ?? null };
    }

    const keywordSet = new Set<string>(extractImportantWords(ticket.description));
    const normalizedError = normalizeText(ticket.error_code_text);
    if (normalizedError) keywordSet.add(normalizedError);

    if (ticket.affected_product_id) {
      const { data: product } = await supabase
        .from("products")
        .select("id, model, brand_id")
        .eq("id", ticket.affected_product_id)
        .maybeSingle();

      if (product?.model) {
        extractImportantWords(product.model).forEach((word) => keywordSet.add(word));
      }

      if (product?.brand_id) {
        const { data: brand } = await supabase.from("brands").select("name_ar").eq("id", product.brand_id).maybeSingle();
        if (brand?.name_ar) {
          extractImportantWords(brand.name_ar).forEach((word) => keywordSet.add(word));
        }
      }
    }

    const title =
      data.title?.trim() ||
      `حل ${ticket.error_code_text?.trim() || "عطل متكرر"}${ticket.affected_product_id ? " للمنتج المحدد" : ""}`;

    const { data: createdArticle, error: createError } = await supabase
      .from("knowledge_base")
      .insert({
        title,
        issue_description: ticket.description,
        solution_steps: solutionNotes,
        product_id: ticket.affected_product_id ?? null,
        error_code_text: ticket.error_code_text ?? null,
        search_keywords: Array.from(keywordSet).join(", "),
        source: "auto_from_ticket",
        linked_ticket_ids: [ticket.id],
        success_count: 0,
        fail_count: 0,
        effectiveness_rate: 0,
        created_by: userId,
      })
      .select("id")
      .single();
    if (createError) throw new Error(`تعذر إنشاء المادة المعرفية من التذكرة: ${createError.message}`);

    const { error: linkError } = await supabase
      .from("tickets")
      .update({ knowledge_base_id: createdArticle.id })
      .eq("id", ticket.id);
    if (linkError) throw new Error(`تم إنشاء المادة لكن تعذر ربطها بالتذكرة: ${linkError.message}`);

    return { created: true, articleId: createdArticle.id };
  });

export const listAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase.from("assignments").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(`تعذر تحميل المهام: ${error.message}`);
    return data ?? [];
  });

export const saveAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => assignmentSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertSupportRole(supabase, userId);

    if (data.id) {
      const { error } = await supabase
        .from("assignments")
        .update({
          ticket_id: data.ticket_id ?? null,
          customer_system_id: data.customer_system_id ?? null,
          engineer_id: data.engineer_id,
          assignment_type: data.assignment_type,
          scheduled_date: data.scheduled_date ?? null,
          status: data.status,
          work_done: data.work_done ?? null,
          difficulties: data.difficulties ?? null,
          recommendations: data.recommendations ?? null,
        })
        .eq("id", data.id);
      if (error) throw new Error(`تعذر تعديل المهمة: ${error.message}`);
      return { ok: true };
    }

    const { error } = await supabase.from("assignments").insert({
      ticket_id: data.ticket_id ?? null,
      customer_system_id: data.customer_system_id ?? null,
      engineer_id: data.engineer_id,
      assigned_by: userId,
      assignment_type: data.assignment_type,
      scheduled_date: data.scheduled_date ?? null,
      status: data.status,
      work_done: data.work_done ?? null,
      difficulties: data.difficulties ?? null,
      recommendations: data.recommendations ?? null,
    });
    if (error) throw new Error(`تعذر إنشاء المهمة: ${error.message}`);
    return { ok: true };
  });

export const submitAssignmentReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => assignmentFieldUpdateSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("assignments")
      .update({
        status: data.status,
        work_done: data.work_done ?? null,
        difficulties: data.difficulties ?? null,
        recommendations: data.recommendations ?? null,
        submitted_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    if (error) throw new Error(`تعذر إرسال تقرير المهمة: ${error.message}`);
    return { ok: true };
  });

export const listAttachments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase.from("attachments").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(`تعذر تحميل المرفقات: ${error.message}`);
    return data ?? [];
  });

export const saveAttachmentMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => attachmentSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    validateAttachmentInput(data);

    if (data.id) {
      const { error } = await supabase
        .from("attachments")
        .update({
          attachable_type: data.attachable_type,
          attachable_id: data.attachable_id,
          file_type: data.file_type,
          file_path: data.file_path,
          original_name: data.original_name ?? null,
          file_size: data.file_size ?? null,
          description: data.description ?? null,
        })
        .eq("id", data.id);
      if (error) throw new Error(`تعذر تعديل بيانات المرفق: ${error.message}`);
      return { ok: true };
    }

    const { error } = await supabase.from("attachments").insert({
      attachable_type: data.attachable_type,
      attachable_id: data.attachable_id,
      file_type: data.file_type,
      file_path: data.file_path,
      original_name: data.original_name ?? null,
      file_size: data.file_size ?? null,
      description: data.description ?? null,
      uploaded_by: userId,
    });
    if (error) throw new Error(`تعذر حفظ بيانات المرفق: ${error.message}`);
    return { ok: true };
  });

export const listKnowledgeBase = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase.from("knowledge_base").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(`تعذر تحميل قاعدة المعرفة: ${error.message}`);
    return data ?? [];
  });

export const saveKnowledgeBase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => knowledgeSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertSupportRole(supabase, userId);

    if (data.id) {
      const { error } = await supabase
        .from("knowledge_base")
        .update({
          title: data.title,
          issue_description: data.issue_description,
          solution_steps: data.solution_steps,
          product_id: data.product_id ?? null,
          error_code_text: data.error_code_text ?? null,
          search_keywords: data.search_keywords ?? null,
          source: data.source,
          linked_ticket_ids: data.linked_ticket_ids,
          success_count: data.success_count,
          fail_count: data.fail_count,
          effectiveness_rate: data.effectiveness_rate,
        })
        .eq("id", data.id);
      if (error) throw new Error(`تعذر تعديل قاعدة المعرفة: ${error.message}`);
      return { ok: true };
    }

    const { error } = await supabase.from("knowledge_base").insert({
      title: data.title,
      issue_description: data.issue_description,
      solution_steps: data.solution_steps,
      product_id: data.product_id ?? null,
      error_code_text: data.error_code_text ?? null,
      search_keywords: data.search_keywords ?? null,
      source: data.source,
      linked_ticket_ids: data.linked_ticket_ids,
      success_count: data.success_count,
      fail_count: data.fail_count,
      effectiveness_rate: data.effectiveness_rate,
      created_by: userId,
    });
    if (error) throw new Error(`تعذر إنشاء مادة معرفية: ${error.message}`);
    return { ok: true };
  });

export const saveKnowledgeFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => knowledgeFeedbackSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase.from("knowledge_feedback").insert({
      knowledge_base_id: data.knowledge_base_id,
      ticket_id: data.ticket_id ?? null,
      engineer_id: data.engineer_id,
      rating: data.rating,
      notes: data.notes ?? null,
    });
    if (error) throw new Error(`تعذر حفظ تقييم المعرفة: ${error.message}`);

    const { data: feedbackRows, error: feedbackError } = await supabase
      .from("knowledge_feedback")
      .select("rating")
      .eq("knowledge_base_id", data.knowledge_base_id);
    if (feedbackError) throw new Error(`تعذر تحديث إحصائيات تقييم المعرفة: ${feedbackError.message}`);

    const successCount = (feedbackRows ?? []).filter((row) => row.rating === "success").length;
    const failCount = (feedbackRows ?? []).filter((row) => row.rating === "failure").length;
    const partialCount = (feedbackRows ?? []).filter((row) => row.rating === "partial").length;
    const total = successCount + failCount + partialCount;
    const effectivenessRate = total === 0 ? 0 : Number((((successCount + partialCount * 0.5) / total) * 100).toFixed(2));

    const { error: updateError } = await supabase
      .from("knowledge_base")
      .update({
        success_count: successCount,
        fail_count: failCount,
        effectiveness_rate: effectivenessRate,
      })
      .eq("id", data.knowledge_base_id);
    if (updateError) throw new Error(`تعذر حفظ معدل فعالية المادة: ${updateError.message}`);

    return { ok: true };
  });

export const listKnowledgeFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("knowledge_feedback")
      .select("id, knowledge_base_id, ticket_id, engineer_id, rating, notes, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`تعذر تحميل تقييمات قاعدة المعرفة: ${error.message}`);
    return data ?? [];
  });

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [notificationsRes, readsRes] = await Promise.all([
      supabase.from("notifications").select("*").order("created_at", { ascending: false }),
      supabase.from("notification_reads").select("notification_id").eq("user_id", userId),
    ]);

    if (notificationsRes.error) throw new Error(`تعذر تحميل الإشعارات: ${notificationsRes.error.message}`);
    if (readsRes.error) throw new Error(`تعذر تحميل حالة الإشعارات: ${readsRes.error.message}`);

    const readMap = new Set((readsRes.data ?? []).map((x) => x.notification_id));
    return (notificationsRes.data ?? []).map((item) => ({
      ...item,
      is_read: readMap.has(item.id),
    }));
  });

export const createNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => notificationSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertSupportRole(supabase, userId);

    const { error } = await supabase.from("notifications").insert({
      title: data.title,
      body: data.body,
      type: data.type,
      target_role: data.target_role ?? null,
      target_user_id: data.target_user_id ?? null,
      related_type: data.related_type ?? null,
      related_id: data.related_id ?? null,
      created_by: userId,
    });
    if (error) throw new Error(`تعذر إنشاء الإشعار: ${error.message}`);
    return { ok: true };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => readNotificationSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("notification_reads").insert({
      notification_id: data.notification_id,
      user_id: userId,
    });
    if (error && !error.message.includes("duplicate key value")) {
      throw new Error(`تعذر تحديث حالة الإشعار: ${error.message}`);
    }
    return { ok: true };
  });

export const getOperationsReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const roles = await getUserRoles(supabase, userId);

    if (roles.includes("manager")) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const [ticketsRes, assignmentsRes, engineersRes, productsRes] = await Promise.all([
        supabaseAdmin.from("tickets").select("id, status, priority, error_code_text, created_at, affected_product_id"),
        supabaseAdmin.from("assignments").select("id, engineer_id, status, assignment_type, created_at, submitted_at"),
        supabaseAdmin.from("engineers").select("id, name"),
        supabaseAdmin.from("products").select("id, model"),
      ]);

      const errors = [ticketsRes.error, assignmentsRes.error, engineersRes.error, productsRes.error].filter(Boolean);
      if (errors.length > 0) throw new Error(errors[0]?.message ?? "تعذر تحميل التقرير التشغيلي");

      const tickets = ticketsRes.data ?? [];
      const assignments = assignmentsRes.data ?? [];
      const engineers = engineersRes.data ?? [];
      const products = productsRes.data ?? [];

      const unresolved = tickets.filter((t) => t.status !== "closed" && t.status !== "resolved_remote").length;
      const delayed = assignments.filter((a) => a.status !== "completed" && a.created_at < new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString()).length;

      const recurringMap = new Map<string, number>();
      for (const t of tickets) {
        if (!t.error_code_text) continue;
        recurringMap.set(t.error_code_text, (recurringMap.get(t.error_code_text) ?? 0) + 1);
      }
      const recurringProblems = [...recurringMap.entries()]
        .map(([code, count]) => ({ code, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const engineerPerformance = engineers.map((engineer) => {
        const engineerAssignments = assignments.filter((a) => a.engineer_id === engineer.id);
        return {
          engineer_id: engineer.id,
          engineer_name: engineer.name,
          total: engineerAssignments.length,
          completed: engineerAssignments.filter((a) => a.status === "completed").length,
          in_progress: engineerAssignments.filter((a) => a.status === "in_progress").length,
        };
      });

      const monthlyMap = new Map<string, { month: string; newTickets: number; closedTickets: number; completedAssignments: number }>();
      for (const ticket of tickets) {
        const month = new Date(ticket.created_at).toISOString().slice(0, 7);
        const current = monthlyMap.get(month) ?? { month, newTickets: 0, closedTickets: 0, completedAssignments: 0 };
        current.newTickets += 1;
        if (ticket.status === "closed") current.closedTickets += 1;
        monthlyMap.set(month, current);
      }
      for (const assignment of assignments) {
        const month = new Date(assignment.created_at).toISOString().slice(0, 7);
        const current = monthlyMap.get(month) ?? { month, newTickets: 0, closedTickets: 0, completedAssignments: 0 };
        if (assignment.status === "completed") current.completedAssignments += 1;
        monthlyMap.set(month, current);
      }

      const productReliability = products.map((product) => {
        const related = tickets.filter((ticket) => ticket.affected_product_id === product.id);
        const unresolvedCount = related.filter((ticket) => ticket.status !== "closed" && ticket.status !== "resolved_remote").length;
        return { product_id: product.id, model: product.model, totalIssues: related.length, unresolvedCount };
      }).filter((item) => item.totalIssues > 0).sort((a, b) => b.totalIssues - a.totalIssues).slice(0, 10);

      return {
        unresolved,
        delayed,
        totalTickets: tickets.length,
        totalAssignments: assignments.length,
        recurringProblems,
        engineerPerformance,
        monthlyTrend: [...monthlyMap.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-12),
        productReliability,
      };
    }

    const [ticketsRes, assignmentsRes, engineersRes, productsRes] = await Promise.all([
      supabase.from("tickets").select("id, status, priority, error_code_text, created_at, affected_product_id"),
      supabase.from("assignments").select("id, engineer_id, status, assignment_type, created_at, submitted_at"),
      supabase.from("engineers").select("id, name"),
      supabase.from("products").select("id, model"),
    ]);

    const errors = [ticketsRes.error, assignmentsRes.error, engineersRes.error, productsRes.error].filter(Boolean);
    if (errors.length > 0) throw new Error(errors[0]?.message ?? "تعذر تحميل التقرير التشغيلي");

    const tickets = ticketsRes.data ?? [];
    const assignments = assignmentsRes.data ?? [];
    const engineers = engineersRes.data ?? [];
    const products = productsRes.data ?? [];

    const unresolved = tickets.filter((t) => t.status !== "closed" && t.status !== "resolved_remote").length;
    const delayed = assignments.filter((a) => a.status !== "completed" && a.created_at < new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString()).length;

    const recurringMap = new Map<string, number>();
    for (const t of tickets) {
      if (!t.error_code_text) continue;
      recurringMap.set(t.error_code_text, (recurringMap.get(t.error_code_text) ?? 0) + 1);
    }
    const recurringProblems = [...recurringMap.entries()]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const engineerPerformance = engineers.map((engineer) => {
      const engineerAssignments = assignments.filter((a) => a.engineer_id === engineer.id);
      return {
        engineer_id: engineer.id,
        engineer_name: engineer.name,
        total: engineerAssignments.length,
        completed: engineerAssignments.filter((a) => a.status === "completed").length,
        in_progress: engineerAssignments.filter((a) => a.status === "in_progress").length,
      };
    });

    const monthlyMap = new Map<string, { month: string; newTickets: number; closedTickets: number; completedAssignments: number }>();
    for (const ticket of tickets) {
      const month = new Date(ticket.created_at).toISOString().slice(0, 7);
      const current = monthlyMap.get(month) ?? { month, newTickets: 0, closedTickets: 0, completedAssignments: 0 };
      current.newTickets += 1;
      if (ticket.status === "closed") current.closedTickets += 1;
      monthlyMap.set(month, current);
    }
    for (const assignment of assignments) {
      const month = new Date(assignment.created_at).toISOString().slice(0, 7);
      const current = monthlyMap.get(month) ?? { month, newTickets: 0, closedTickets: 0, completedAssignments: 0 };
      if (assignment.status === "completed") current.completedAssignments += 1;
      monthlyMap.set(month, current);
    }

    const productReliability = products.map((product) => {
      const related = tickets.filter((ticket) => ticket.affected_product_id === product.id);
      const unresolvedCount = related.filter((ticket) => ticket.status !== "closed" && ticket.status !== "resolved_remote").length;
      return { product_id: product.id, model: product.model, totalIssues: related.length, unresolvedCount };
    }).filter((item) => item.totalIssues > 0).sort((a, b) => b.totalIssues - a.totalIssues).slice(0, 10);

    return {
      unresolved,
      delayed,
      totalTickets: tickets.length,
      totalAssignments: assignments.length,
      recurringProblems,
      engineerPerformance,
      monthlyTrend: [...monthlyMap.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-12),
      productReliability,
    };
  });