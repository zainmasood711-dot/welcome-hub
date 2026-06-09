import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DEMO_TAG = "[DEMO-ENERGIE]";

type SeedSummary = {
  categories: number;
  brands: number;
  products: number;
  errorCodes: number;
  engineers: number;
  customers: number;
  systems: number;
  assets: number;
  knowledgeArticles: number;
  tickets: number;
  assignments: number;
  notifications: number;
};

const zeroSummary = (): SeedSummary => ({
  categories: 0,
  brands: 0,
  products: 0,
  errorCodes: 0,
  engineers: 0,
  customers: 0,
  systems: 0,
  assets: 0,
  knowledgeArticles: 0,
  tickets: 0,
  assignments: 0,
  notifications: 0,
});

export async function getDbStatus() {
  const tableNames = [
    "engineers",
    "product_categories",
    "brands",
    "products",
    "error_codes",
    "customers",
    "customer_systems",
    "system_assets",
    "knowledge_base",
    "tickets",
    "assignments",
    "notifications",
  ] as const;

  const counters = await Promise.all(
    tableNames.map(async (name) => {
      const { count, error } = await supabaseAdmin.from(name).select("id", { count: "exact", head: true });
      if (error) throw new Error(`تعذر قراءة ${name}: ${error.message}`);
      return [name, count ?? 0] as const;
    }),
  );

  return Object.fromEntries(counters);
}

export async function seedDemoData(currentUserId?: string) {
  const summary = zeroSummary();

  const categoriesPayload = [
    { name_ar: "انفرترات", slug: "inverters" },
    { name_ar: "بطاريات", slug: "batteries" },
    { name_ar: "ألواح شمسية", slug: "solar-panels" },
  ];

  const { data: categoryRows, error: categoriesError } = await supabaseAdmin
    .from("product_categories")
    .upsert(categoriesPayload, { onConflict: "slug" })
    .select("id, slug");
  if (categoriesError) throw new Error(`فشل تجهيز الفئات: ${categoriesError.message}`);
  summary.categories = categoryRows?.length ?? 0;

  const categoriesBySlug = Object.fromEntries((categoryRows ?? []).map((item) => [item.slug, item.id]));

  const brandsPayload = [
    { name: "Sungrow", category_id: categoriesBySlug.inverters },
    { name: "Huawei", category_id: categoriesBySlug.inverters },
    { name: "Pylontech", category_id: categoriesBySlug.batteries },
    { name: "Jinko", category_id: categoriesBySlug["solar-panels"] },
  ].filter((item) => Boolean(item.category_id));

  const { data: brandRows, error: brandsError } = await supabaseAdmin
    .from("brands")
    .upsert(brandsPayload, { onConflict: "name,category_id" })
    .select("id, name, category_id");
  if (brandsError) throw new Error(`فشل تجهيز العلامات التجارية: ${brandsError.message}`);
  summary.brands = brandRows?.length ?? 0;

  const findBrandId = (name: string, categorySlug: string) =>
    (brandRows ?? []).find((item) => item.name === name && item.category_id === categoriesBySlug[categorySlug])?.id;

  const productsPayload = [
    {
      category_id: categoriesBySlug.inverters,
      brand_id: findBrandId("Sungrow", "inverters"),
      model: "SG10RT",
      description: `${DEMO_TAG} انفرتر ثلاثي الطور 10KW`,
      is_active: true,
    },
    {
      category_id: categoriesBySlug.inverters,
      brand_id: findBrandId("Huawei", "inverters"),
      model: "SUN2000-8KTL",
      description: `${DEMO_TAG} انفرتر 8KW`,
      is_active: true,
    },
    {
      category_id: categoriesBySlug.batteries,
      brand_id: findBrandId("Pylontech", "batteries"),
      model: "US5000",
      description: `${DEMO_TAG} بطارية ليثيوم`,
      is_active: true,
    },
  ].filter((item): item is { category_id: string; brand_id: string; model: string; description: string; is_active: boolean } =>
    Boolean(item.category_id && item.brand_id),
  );

  const { data: productRows, error: productsError } = await supabaseAdmin
    .from("products")
    .upsert(productsPayload, { onConflict: "brand_id,model" })
    .select("id, model");
  if (productsError) throw new Error(`فشل تجهيز المنتجات: ${productsError.message}`);
  summary.products = productRows?.length ?? 0;

  const productByModel = Object.fromEntries((productRows ?? []).map((item) => [item.model, item.id]));

  const errorCodesPayload = [
    {
      product_id: productByModel.SG10RT ?? null,
      code: "E031",
      category: "software",
      description: `${DEMO_TAG} انقطاع اتصال الشبكة`,
      common_causes: "إعدادات شبكة غير صحيحة أو انقطاع مؤقت",
      recommended_solution: "فحص إعدادات الشبكة وإعادة تشغيل الانفرتر",
      occurrences_count: 14,
    },
    {
      product_id: productByModel["SUN2000-8KTL"] ?? null,
      code: "T112",
      category: "technical",
      description: `${DEMO_TAG} ارتفاع حرارة الوحدة`,
      common_causes: "ضعف التهوية أو حمل زائد",
      recommended_solution: "تنظيف مسارات التهوية وتقليل الحمل",
      occurrences_count: 8,
    },
  ];

  const { data: errorCodeRows, error: errorCodesError } = await supabaseAdmin
    .from("error_codes")
    .upsert(errorCodesPayload, { onConflict: "product_id,code" })
    .select("id, code");
  if (errorCodesError) throw new Error(`فشل تجهيز رموز الأعطال: ${errorCodesError.message}`);
  summary.errorCodes = errorCodeRows?.length ?? 0;

  const engineers: Array<{
    name: string;
    type: "internal" | "external";
    availability_status: "available" | "busy" | "inactive";
    governorate: string;
    city: string;
  }> = [
    { name: "م. أحمد فؤاد", type: "internal", availability_status: "available", governorate: "القاهرة", city: "مدينة نصر" },
    { name: "م. سارة محمود", type: "internal", availability_status: "busy", governorate: "الجيزة", city: "الدقي" },
    { name: "م. كريم علي", type: "external", availability_status: "available", governorate: "الإسكندرية", city: "سيدي جابر" },
  ];

  const engineerIds: string[] = [];
  for (const engineer of engineers) {
    const { data: existing } = await supabaseAdmin.from("engineers").select("id").eq("name", engineer.name).maybeSingle();
    if (existing?.id) {
      engineerIds.push(existing.id);
      continue;
    }
    const { data: created, error } = await supabaseAdmin.from("engineers").insert(engineer).select("id").single();
    if (error) throw new Error(`فشل تجهيز المهندسين: ${error.message}`);
    engineerIds.push(created.id);
    summary.engineers += 1;
  }

  const customersPayload = [
    {
      name: "شركة النور للمقاولات",
      phone: "201000000101",
      governorate: "القاهرة",
      city: "التجمع",
      address: "القاهرة الجديدة - المنطقة الصناعية",
      notes: `${DEMO_TAG} عميل تجريبي B2B`,
      created_by: currentUserId ?? null,
    },
    {
      name: "مصنع الأمل للأغذية",
      phone: "201000000202",
      governorate: "الجيزة",
      city: "6 أكتوبر",
      address: "المنطقة الصناعية الثانية",
      notes: `${DEMO_TAG} عميل تجريبي صناعي`,
      created_by: currentUserId ?? null,
    },
  ];

  const { data: customerRows, error: customersError } = await supabaseAdmin
    .from("customers")
    .upsert(customersPayload, { onConflict: "phone" })
    .select("id, phone, name");
  if (customersError) throw new Error(`فشل تجهيز العملاء: ${customersError.message}`);
  summary.customers = customerRows?.length ?? 0;

  const customerByPhone = Object.fromEntries((customerRows ?? []).map((item) => [item.phone, item.id]));

  const systemsPayload = [
    {
      customer_id: customerByPhone["201000000101"],
      system_name: "PV Roof A",
      installation_date: "2025-01-20",
      status: "active",
      notes: `${DEMO_TAG} نظام سطح 80KW`,
      created_by: currentUserId ?? null,
    },
    {
      customer_id: customerByPhone["201000000202"],
      system_name: "Factory Line 1",
      installation_date: "2024-11-07",
      status: "active",
      notes: `${DEMO_TAG} نظام صناعي 120KW`,
      created_by: currentUserId ?? null,
    },
  ].filter((item) => Boolean(item.customer_id));

  const systemIds: string[] = [];
  for (const system of systemsPayload) {
    const { data: existing } = await supabaseAdmin
      .from("customer_systems")
      .select("id")
      .eq("customer_id", system.customer_id)
      .eq("system_name", system.system_name)
      .maybeSingle();
    if (existing?.id) {
      systemIds.push(existing.id);
      continue;
    }
    const { data: created, error } = await supabaseAdmin.from("customer_systems").insert(system).select("id").single();
    if (error) throw new Error(`فشل تجهيز أنظمة العملاء: ${error.message}`);
    systemIds.push(created.id);
    summary.systems += 1;
  }

  const assetsPayload = [
    {
      customer_system_id: systemIds[0],
      product_id: productByModel.SG10RT,
      quantity: 2,
      serial_number: `${DEMO_TAG}-INV-001`,
      warranty_status: "valid",
      notes: `${DEMO_TAG} أصل تجريبي`,
    },
    {
      customer_system_id: systemIds[1],
      product_id: productByModel.US5000,
      quantity: 6,
      serial_number: `${DEMO_TAG}-BAT-001`,
      warranty_status: "valid",
      notes: `${DEMO_TAG} أصل تجريبي`,
    },
  ].filter((item) => Boolean(item.customer_system_id && item.product_id));

  for (const asset of assetsPayload) {
    const { data: existing } = await supabaseAdmin
      .from("system_assets")
      .select("id")
      .eq("customer_system_id", asset.customer_system_id)
      .eq("serial_number", asset.serial_number)
      .maybeSingle();
    if (existing?.id) continue;
    const { error } = await supabaseAdmin.from("system_assets").insert(asset);
    if (error) throw new Error(`فشل تجهيز مكونات الأنظمة: ${error.message}`);
    summary.assets += 1;
  }

  const { data: existingKb } = await supabaseAdmin
    .from("knowledge_base")
    .select("id")
    .eq("title", `${DEMO_TAG} إعادة مزامنة اتصال الانفرتر`)
    .maybeSingle();

  let knowledgeBaseId: string | null = existingKb?.id ?? null;
  if (!knowledgeBaseId) {
    const { data: kb, error: kbError } = await supabaseAdmin
      .from("knowledge_base")
      .insert({
        title: `${DEMO_TAG} إعادة مزامنة اتصال الانفرتر`,
        issue_description: "رسالة فقد اتصال الشبكة مع تكرار التوقف",
        solution_steps: "1) فحص إعدادات DHCP\n2) إعادة تشغيل Gateway\n3) إعادة تشغيل الانفرتر",
        product_id: productByModel.SG10RT ?? null,
        error_code_text: "E031",
        search_keywords: "network, inverter, e031",
        source: "manual",
        linked_ticket_ids: [],
        success_count: 12,
        fail_count: 2,
        effectiveness_rate: 85.71,
        created_by: currentUserId ?? null,
      })
      .select("id")
      .single();
    if (kbError) throw new Error(`فشل تجهيز قاعدة المعرفة: ${kbError.message}`);
    knowledgeBaseId = kb.id;
    summary.knowledgeArticles += 1;
  }

  const existingDemoTickets = await supabaseAdmin
    .from("tickets")
    .select("id")
    .ilike("description", `%${DEMO_TAG}%`)
    .limit(1);
  if (existingDemoTickets.error) {
    throw new Error(`فشل التحقق من التذاكر التجريبية: ${existingDemoTickets.error.message}`);
  }

  const createdTicketIds: string[] = [];
  if ((existingDemoTickets.data ?? []).length === 0) {
    const ticketPayload: Array<{
      customer_id: string;
      customer_system_id: string | null;
      ticket_type: "fault" | "preventive_maintenance";
      status: "assigned_field" | "in_progress";
      priority: "high" | "medium";
      description: string;
      affected_product_id: string | null;
      error_code_text: string;
      knowledge_base_id: string | null;
      created_by: string | null;
    }> = [
      {
        customer_id: customerByPhone["201000000101"],
        customer_system_id: systemIds[0] ?? null,
        ticket_type: "fault" as const,
        status: "assigned_field" as const,
        priority: "high" as const,
        description: `${DEMO_TAG} توقف مفاجئ للانفرتر في فترة الذروة`,
        affected_product_id: productByModel.SG10RT ?? null,
        error_code_text: "E031",
        knowledge_base_id: knowledgeBaseId,
        created_by: currentUserId ?? null,
      },
      {
        customer_id: customerByPhone["201000000202"],
        customer_system_id: systemIds[1] ?? null,
        ticket_type: "preventive_maintenance" as const,
        status: "in_progress" as const,
        priority: "medium" as const,
        description: `${DEMO_TAG} صيانة دورية ومراجعة البطاريات`,
        affected_product_id: productByModel.US5000 ?? null,
        error_code_text: "PM-01",
        knowledge_base_id: null,
        created_by: currentUserId ?? null,
      },
    ].filter((item) => Boolean(item.customer_id));

    for (const ticket of ticketPayload) {
      const { data: created, error } = await supabaseAdmin.from("tickets").insert(ticket).select("id").single();
      if (error) throw new Error(`فشل إنشاء التذاكر التجريبية: ${error.message}`);
      createdTicketIds.push(created.id);
      summary.tickets += 1;
    }
  }

  if (createdTicketIds.length > 0 && engineerIds.length > 0) {
    const assignmentPayload = createdTicketIds.map((ticketId, index) => ({
      ticket_id: ticketId,
      customer_system_id: systemIds[index % Math.max(systemIds.length, 1)] ?? null,
      engineer_id: engineerIds[index % engineerIds.length],
      assigned_by: currentUserId ?? null,
      assignment_type: "repair_visit",
      scheduled_date: new Date(Date.now() + (index + 1) * 86_400_000).toISOString(),
      status: index === 0 ? "in_progress" : "pending",
      work_done: null,
      difficulties: null,
      recommendations: null,
    }));

    const { error: assignmentsError } = await supabaseAdmin.from("assignments").insert(assignmentPayload);
    if (assignmentsError) throw new Error(`فشل إنشاء التكليفات التجريبية: ${assignmentsError.message}`);
    summary.assignments += assignmentPayload.length;
  }

  const { data: existingNotif } = await supabaseAdmin
    .from("notifications")
    .select("id")
    .eq("title", `${DEMO_TAG} تم تجهيز بيئة تجريبية`) 
    .maybeSingle();

  if (!existingNotif) {
    const { error: notificationError } = await supabaseAdmin.from("notifications").insert({
      title: `${DEMO_TAG} تم تجهيز بيئة تجريبية`,
      body: "تم إدخال بيانات تجريبية لتشغيل اللوحات والمهام مباشرة.",
      type: "system",
      target_role: null,
      target_user_id: null,
      related_type: "seed",
      related_id: null,
      created_by: currentUserId ?? null,
    });
    if (notificationError) throw new Error(`فشل إنشاء الإشعارات التجريبية: ${notificationError.message}`);
    summary.notifications += 1;
  }

  return summary;
}
