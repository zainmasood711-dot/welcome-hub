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

const imageExtensions = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const documentExtensions = new Set(["pdf", "doc", "docx", "xls", "xlsx", "csv", "txt"]);
const batteryExtensions = new Set(["csv", "xlsx", "txt", "bin"]);

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
      const [ticketsRes, assignmentsRes, engineersRes] = await Promise.all([
        supabaseAdmin.from("tickets").select("id, status, priority, error_code_text, created_at"),
        supabaseAdmin.from("assignments").select("id, engineer_id, status, assignment_type, created_at, submitted_at"),
        supabaseAdmin.from("engineers").select("id, name"),
      ]);

      const errors = [ticketsRes.error, assignmentsRes.error, engineersRes.error].filter(Boolean);
      if (errors.length > 0) throw new Error(errors[0]?.message ?? "تعذر تحميل التقرير التشغيلي");

      const tickets = ticketsRes.data ?? [];
      const assignments = assignmentsRes.data ?? [];
      const engineers = engineersRes.data ?? [];

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

      return {
        unresolved,
        delayed,
        totalTickets: tickets.length,
        totalAssignments: assignments.length,
        recurringProblems,
        engineerPerformance,
      };
    }

    const [ticketsRes, assignmentsRes, engineersRes] = await Promise.all([
      supabase.from("tickets").select("id, status, priority, error_code_text, created_at"),
      supabase.from("assignments").select("id, engineer_id, status, assignment_type, created_at, submitted_at"),
      supabase.from("engineers").select("id, name"),
    ]);

    const errors = [ticketsRes.error, assignmentsRes.error, engineersRes.error].filter(Boolean);
    if (errors.length > 0) throw new Error(errors[0]?.message ?? "تعذر تحميل التقرير التشغيلي");

    const tickets = ticketsRes.data ?? [];
    const assignments = assignmentsRes.data ?? [];
    const engineers = engineersRes.data ?? [];

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

    return {
      unresolved,
      delayed,
      totalTickets: tickets.length,
      totalAssignments: assignments.length,
      recurringProblems,
      engineerPerformance,
    };
  });