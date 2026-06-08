import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAccessContext } from "@/hooks/use-access-context";
import { requireRole } from "@/lib/auth-client";
import { createTicketWorkflow, getKnowledgeSuggestions, getPhase2References, listTickets } from "@/lib/phase2.functions";
import { hasAnyPermission } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/tickets")({
  beforeLoad: async () => {
    await requireRole(["support_engineer", "field_engineer"]);
  },
  component: TicketsPage,
});

function TicketsPage() {
  const queryClient = useQueryClient();
  const refsFn = useServerFn(getPhase2References);
  const listFn = useServerFn(listTickets);
  const createWorkflowFn = useServerFn(createTicketWorkflow);
  const suggestKnowledgeFn = useServerFn(getKnowledgeSuggestions);
  const { data: accessData } = useAccessContext();
  const roles = accessData?.roles ?? [];
  const canManage = hasAnyPermission(roles, ["tickets.manage"]);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "new" | "in_progress" | "resolved_remote" | "assigned_field" | "closed">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "fault" | "inquiry" | "preventive_maintenance" | "new_installation">("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "low" | "medium" | "high" | "critical">("all");
  const [engineerNeededFilter, setEngineerNeededFilter] = useState<"all" | "yes" | "no">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");

  const [quickCustomerEnabled, setQuickCustomerEnabled] = useState(false);
  const [quickCustomer, setQuickCustomer] = useState({ name: "", phone: "", governorate: "", city: "", address: "" });

  const [attachmentDraft, setAttachmentDraft] = useState<{ file_type: "image" | "battery_file" | "document"; file_path: string; original_name: string; file_size: string }>({ file_type: "document", file_path: "", original_name: "", file_size: "" });
  const [attachments, setAttachments] = useState<Array<{ file_type: "image" | "battery_file" | "document"; file_path: string; original_name: string | null; file_size: number | null }>>([]);

  const [form, setForm] = useState({
    customer_id: "",
    customer_system_id: "",
    ticket_type: "fault",
    priority: "medium",
    title: "",
    description: "",
    affected_product_id: "",
    error_code_id: "",
    error_code_text: "",
    solution_type: "",
    remote_solution_notes: "",
    knowledge_base_id: "",
    create_knowledge_entry: false,
    field_visit_needed: false,
    assignment_engineer_id: "",
    assignment_type: "repair_visit",
    assignment_date: "",
    assignment_notes: "",
  });

  const { data: refs } = useQuery({ queryKey: ["phase2-refs"], queryFn: () => refsFn() });

  const { data: tickets = [] } = useQuery({
    queryKey: ["tickets", search, statusFilter, typeFilter, priorityFilter, engineerNeededFilter, fromDate, toDate],
    queryFn: () =>
      listFn({
        data: {
          status: statusFilter === "all" ? null : statusFilter,
          ticket_type: typeFilter === "all" ? null : typeFilter,
          priority: priorityFilter === "all" ? null : priorityFilter,
          engineer_needed: engineerNeededFilter === "all" ? null : engineerNeededFilter === "yes",
          from_date: fromDate ? new Date(fromDate).toISOString() : null,
          to_date: toDate ? `${toDate}T23:59:59.000Z` : null,
          search: search || null,
        },
      }),
  });

  const { data: suggestedKnowledge = [] } = useQuery({
    queryKey: ["ticket-knowledge", form.affected_product_id, form.error_code_id, form.error_code_text, form.description],
    queryFn: () =>
      suggestKnowledgeFn({
        data: {
          affected_product_id: form.affected_product_id || null,
          error_code_id: form.error_code_id || null,
          error_code_text: form.error_code_text || null,
          issue_description: `${form.title} ${form.description}`,
          category_id: null,
          limit: 5,
        },
      }),
    enabled: Boolean(form.affected_product_id || form.error_code_id || form.error_code_text || form.description.trim().length >= 5),
  });

  const filteredCustomers = useMemo(() => {
    const query = customerSearch.toLowerCase().trim();
    return (refs?.customers ?? []).filter((customer) => `${customer.name} ${customer.phone}`.toLowerCase().includes(query));
  }, [refs?.customers, customerSearch]);

  const availableSystems = useMemo(() => {
    if (quickCustomerEnabled) return [];
    return (refs?.customerSystems ?? []).filter((system) => !form.customer_id || system.customer_id === form.customer_id);
  }, [refs?.customerSystems, form.customer_id, quickCustomerEnabled]);

  const addAttachmentRow = () => {
    if (!attachmentDraft.file_path.trim() || !attachmentDraft.file_path.includes(".")) {
      toast.error("أدخل مسار ملف صحيح مع الامتداد");
      return;
    }
    const parsedSize = attachmentDraft.file_size ? Number(attachmentDraft.file_size) : null;
    if (parsedSize != null && (!Number.isFinite(parsedSize) || parsedSize < 0)) {
      toast.error("حجم الملف يجب أن يكون رقمًا صحيحًا");
      return;
    }

    setAttachments((prev) => [
      ...prev,
      {
        file_type: attachmentDraft.file_type as "image" | "battery_file" | "document",
        file_path: attachmentDraft.file_path.trim(),
        original_name: attachmentDraft.original_name.trim() || null,
        file_size: parsedSize,
      },
    ]);
    setAttachmentDraft({ file_type: "document", file_path: "", original_name: "", file_size: "" });
  };

  const statusBadge = (status: string) => {
    if (status === "closed") return <Badge>مغلقة</Badge>;
    if (status === "assigned_field") return <Badge variant="destructive">زيارة ميدانية</Badge>;
    if (status === "resolved_remote") return <Badge variant="secondary">تم حلها عن بُعد</Badge>;
    if (status === "in_progress") return <Badge variant="outline">قيد المعالجة</Badge>;
    return <Badge variant="outline">جديدة</Badge>;
  };

  const priorityBadge = (priority: string) => {
    if (priority === "critical") return <Badge variant="destructive">حرجة</Badge>;
    if (priority === "high") return <Badge variant="secondary">عالية</Badge>;
    if (priority === "medium") return <Badge variant="outline">متوسطة</Badge>;
    return <Badge variant="outline">منخفضة</Badge>;
  };

  const tierLabel: Record<number, string> = {
    1: "تطابق تام: منتج + كود",
    2: "تطابق كود العطل",
    3: "تطابق المنتج",
    4: "تشابه نصي",
  };

  const resetForm = () => {
    setQuickCustomerEnabled(false);
    setQuickCustomer({ name: "", phone: "", governorate: "", city: "", address: "" });
    setAttachments([]);
    setAttachmentDraft({ file_type: "document", file_path: "", original_name: "", file_size: "" });
    setForm({
      customer_id: "",
      customer_system_id: "",
      ticket_type: "fault",
      priority: "medium",
      title: "",
      description: "",
      affected_product_id: "",
      error_code_id: "",
      error_code_text: "",
      solution_type: "",
      remote_solution_notes: "",
      knowledge_base_id: "",
      create_knowledge_entry: false,
      field_visit_needed: false,
      assignment_engineer_id: "",
      assignment_type: "repair_visit",
      assignment_date: "",
      assignment_notes: "",
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!quickCustomerEnabled && !form.customer_id) {
      toast.error("اختر عميلًا أو فعّل إنشاء عميل سريع");
      return;
    }
    if (quickCustomerEnabled && (!quickCustomer.name.trim() || quickCustomer.phone.trim().length < 8)) {
      toast.error("بيانات العميل السريع غير مكتملة");
      return;
    }
    if (form.title.trim().length < 3 || form.description.trim().length < 8) {
      toast.error("أدخل عنوانًا ووصفًا واضحين للتذكرة");
      return;
    }
    if (form.create_knowledge_entry && form.remote_solution_notes.trim().length < 10) {
      toast.error("لإنشاء مادة معرفية جديدة، اكتب ملاحظات حل مفصلة (10 أحرف على الأقل)");
      return;
    }
    if (form.field_visit_needed && !form.assignment_engineer_id) {
      toast.error("حدد مهندسًا لإنشاء التكليف الميداني");
      return;
    }

    try {
      const result = await createWorkflowFn({
        data: {
          customer_id: quickCustomerEnabled ? null : form.customer_id,
          quick_customer: quickCustomerEnabled
            ? {
                name: quickCustomer.name,
                phone: quickCustomer.phone,
                governorate: quickCustomer.governorate || null,
                city: quickCustomer.city || null,
                address: quickCustomer.address || null,
              }
            : null,
          customer_system_id: form.customer_system_id || null,
          ticket_type: form.ticket_type as "fault" | "inquiry" | "preventive_maintenance" | "new_installation",
          priority: form.priority as "low" | "medium" | "high" | "critical",
          title: form.title,
          description: form.description,
          affected_product_id: form.affected_product_id || null,
          error_code_id: form.error_code_id || null,
          error_code_text: form.error_code_text || null,
          attachment_files: attachments,
          solution_type: (form.solution_type || null) as "remote" | "field" | "bring_to_center" | "no_fix_needed" | null,
          remote_solution_notes: form.remote_solution_notes || null,
          knowledge_base_id: form.knowledge_base_id || null,
          create_knowledge_entry: form.create_knowledge_entry,
          field_visit_needed: form.field_visit_needed,
          assignment: form.field_visit_needed
            ? {
                engineer_id: form.assignment_engineer_id,
                assignment_type: form.assignment_type as "repair_visit" | "new_installation",
                scheduled_date: form.assignment_date ? new Date(form.assignment_date).toISOString() : null,
                notes: form.assignment_notes || null,
              }
            : null,
        },
      });

      toast.success(
        result.assignment_id
          ? "تم إنشاء التذكرة والتكليف الميداني بنجاح"
          : result.knowledge_id
            ? "تم إنشاء التذكرة ومادة المعرفة"
            : "تم إنشاء التذكرة بنجاح",
      );
      setOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["phase2-refs"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إنشاء التذكرة");
    }
  };

  return (
    <AppShell roles={roles} title="إدارة التذاكر">
      <div className="space-y-4" dir="rtl">
        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-base">قائمة التذاكر</CardTitle>
            {canManage && <Button onClick={() => setOpen(true)}>تذكرة جديدة</Button>}
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-7">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث نصي" className="md:col-span-2" />
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | "new" | "in_progress" | "resolved_remote" | "assigned_field" | "closed")}><SelectTrigger><SelectValue placeholder="الحالة" /></SelectTrigger><SelectContent><SelectItem value="all">كل الحالات</SelectItem><SelectItem value="new">جديدة</SelectItem><SelectItem value="in_progress">قيد المعالجة</SelectItem><SelectItem value="resolved_remote">محلولة عن بعد</SelectItem><SelectItem value="assigned_field">ميداني</SelectItem><SelectItem value="closed">مغلقة</SelectItem></SelectContent></Select>
            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as "all" | "fault" | "inquiry" | "preventive_maintenance" | "new_installation")}><SelectTrigger><SelectValue placeholder="النوع" /></SelectTrigger><SelectContent><SelectItem value="all">كل الأنواع</SelectItem><SelectItem value="fault">عطل</SelectItem><SelectItem value="inquiry">استفسار</SelectItem><SelectItem value="preventive_maintenance">صيانة دورية</SelectItem><SelectItem value="new_installation">تركيب جديد</SelectItem></SelectContent></Select>
            <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as "all" | "low" | "medium" | "high" | "critical")}><SelectTrigger><SelectValue placeholder="الأولوية" /></SelectTrigger><SelectContent><SelectItem value="all">كل الأولويات</SelectItem><SelectItem value="low">منخفضة</SelectItem><SelectItem value="medium">متوسطة</SelectItem><SelectItem value="high">عالية</SelectItem><SelectItem value="critical">حرجة</SelectItem></SelectContent></Select>
            <Select value={engineerNeededFilter} onValueChange={(value) => setEngineerNeededFilter(value as "all" | "yes" | "no")}><SelectTrigger><SelectValue placeholder="حاجة ميدانية" /></SelectTrigger><SelectContent><SelectItem value="all">الكل</SelectItem><SelectItem value="yes">تحتاج مهندس</SelectItem><SelectItem value="no">بدون مهندس</SelectItem></SelectContent></Select>
            <div className="grid grid-cols-2 gap-2 md:col-span-2">
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>العميل</TableHead>
                <TableHead>العنوان</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>الأولوية</TableHead>
                <TableHead>المنتج/الكود</TableHead>
                <TableHead>التاريخ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">لا توجد نتائج مطابقة.</TableCell></TableRow>
              ) : (
                tickets.map((ticket) => {
                  const customer = refs?.customers.find((item) => item.id === ticket.customer_id)?.name ?? "—";
                  const product = refs?.products.find((item) => item.id === ticket.affected_product_id)?.model ?? "—";
                  const title = ticket.description.split("\n")[0]?.trim() || "بدون عنوان";
                  return (
                    <TableRow key={ticket.id}>
                      <TableCell>{customer}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{title}</TableCell>
                      <TableCell>{ticket.ticket_type}</TableCell>
                      <TableCell>{statusBadge(ticket.status)}</TableCell>
                      <TableCell>{priorityBadge(ticket.priority)}</TableCell>
                      <TableCell>{product} / {ticket.error_code_text ?? "—"}</TableCell>
                      <TableCell>{new Date(ticket.created_at).toLocaleDateString("ar-EG")}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl" dir="rtl">
          <DialogHeader><DialogTitle>إنشاء تذكرة جديدة</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={submit}>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">بيانات العميل</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded border p-2">
                  <Label>إنشاء عميل سريع أثناء المكالمة</Label>
                  <Switch checked={quickCustomerEnabled} onCheckedChange={setQuickCustomerEnabled} />
                </div>

                {quickCustomerEnabled ? (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <Input placeholder="اسم العميل" value={quickCustomer.name} onChange={(e) => setQuickCustomer((p) => ({ ...p, name: e.target.value }))} />
                    <Input placeholder="رقم الهاتف" value={quickCustomer.phone} onChange={(e) => setQuickCustomer((p) => ({ ...p, phone: e.target.value }))} />
                    <Input placeholder="المحافظة" value={quickCustomer.governorate} onChange={(e) => setQuickCustomer((p) => ({ ...p, governorate: e.target.value }))} />
                    <Input placeholder="المدينة" value={quickCustomer.city} onChange={(e) => setQuickCustomer((p) => ({ ...p, city: e.target.value }))} />
                    <Input className="md:col-span-2" placeholder="العنوان" value={quickCustomer.address} onChange={(e) => setQuickCustomer((p) => ({ ...p, address: e.target.value }))} />
                  </div>
                ) : (
                  <>
                    <Input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="ابحث بالاسم أو الهاتف" />
                    <Select value={form.customer_id} onValueChange={(value) => setForm((prev) => ({ ...prev, customer_id: value, customer_system_id: "" }))}>
                      <SelectTrigger><SelectValue placeholder="اختر العميل" /></SelectTrigger>
                      <SelectContent>
                        {filteredCustomers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>{customer.name} - {customer.phone}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}

                <Select value={form.customer_system_id || "none"} onValueChange={(value) => setForm((prev) => ({ ...prev, customer_system_id: value === "none" ? "" : value }))}>
                  <SelectTrigger><SelectValue placeholder="نظام العميل (اختياري)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون نظام محدد</SelectItem>
                    {availableSystems.map((system) => <SelectItem key={system.id} value={system.id}>{system.system_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">بيانات التذكرة</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                  <Select value={form.ticket_type} onValueChange={(value) => setForm((prev) => ({ ...prev, ticket_type: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fault">عطل</SelectItem><SelectItem value="inquiry">استفسار</SelectItem><SelectItem value="preventive_maintenance">صيانة دورية</SelectItem><SelectItem value="new_installation">تركيب جديد</SelectItem></SelectContent></Select>
                  <Select value={form.priority} onValueChange={(value) => setForm((prev) => ({ ...prev, priority: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">منخفضة</SelectItem><SelectItem value="medium">متوسطة</SelectItem><SelectItem value="high">عالية</SelectItem><SelectItem value="critical">حرجة</SelectItem></SelectContent></Select>
                  <Select value={form.affected_product_id || "none"} onValueChange={(value) => setForm((prev) => ({ ...prev, affected_product_id: value === "none" ? "" : value }))}><SelectTrigger><SelectValue placeholder="المنتج المتأثر" /></SelectTrigger><SelectContent><SelectItem value="none">غير محدد</SelectItem>{(refs?.products ?? []).map((product) => <SelectItem key={product.id} value={product.id}>{product.model}</SelectItem>)}</SelectContent></Select>
                  <Select value={form.error_code_id || "none"} onValueChange={(value) => {
                    if (value === "none") {
                      setForm((prev) => ({ ...prev, error_code_id: "" }));
                      return;
                    }
                    const selected = (refs?.errorCodes ?? []).find((code) => code.id === value);
                    setForm((prev) => ({ ...prev, error_code_id: value, error_code_text: selected?.code ?? prev.error_code_text }));
                  }}><SelectTrigger><SelectValue placeholder="كود العطل" /></SelectTrigger><SelectContent><SelectItem value="none">بدون كود</SelectItem>{(refs?.errorCodes ?? []).map((code) => <SelectItem key={code.id} value={code.id}>{code.code}</SelectItem>)}</SelectContent></Select>
                </div>
                <Input placeholder="عنوان التذكرة" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
                <Textarea placeholder="وصف المشكلة" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
                <Input placeholder="كود الخطأ النصي (اختياري)" value={form.error_code_text} onChange={(e) => setForm((prev) => ({ ...prev, error_code_text: e.target.value }))} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">المرفقات</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
                  <Select value={attachmentDraft.file_type} onValueChange={(value) => setAttachmentDraft((prev) => ({ ...prev, file_type: value as "image" | "battery_file" | "document" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="document">مستند</SelectItem><SelectItem value="image">صورة</SelectItem><SelectItem value="battery_file">ملف بطارية</SelectItem></SelectContent></Select>
                  <Input className="md:col-span-2" placeholder="مسار الملف (مثال: uploads/t1.pdf)" value={attachmentDraft.file_path} onChange={(e) => setAttachmentDraft((prev) => ({ ...prev, file_path: e.target.value }))} />
                  <Input placeholder="اسم الملف" value={attachmentDraft.original_name} onChange={(e) => setAttachmentDraft((prev) => ({ ...prev, original_name: e.target.value }))} />
                  <Input placeholder="الحجم بايت" value={attachmentDraft.file_size} onChange={(e) => setAttachmentDraft((prev) => ({ ...prev, file_size: e.target.value }))} />
                </div>
                <Button type="button" variant="outline" onClick={addAttachmentRow}>إضافة مرفق</Button>
                {attachments.length > 0 && (
                  <div className="rounded border">
                    <Table>
                      <TableHeader><TableRow><TableHead>النوع</TableHead><TableHead>المسار</TableHead><TableHead>الاسم</TableHead><TableHead>إجراء</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {attachments.map((item, index) => (
                          <TableRow key={`${item.file_path}-${index}`}>
                            <TableCell>{item.file_type}</TableCell>
                            <TableCell className="max-w-[320px] truncate">{item.file_path}</TableCell>
                            <TableCell>{item.original_name ?? "—"}</TableCell>
                            <TableCell><Button type="button" size="sm" variant="outline" onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== index))}>حذف</Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">اقتراحات المعرفة (ديناميكية)</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {suggestedKnowledge.length === 0 ? (
                  <p className="text-sm text-muted-foreground">ستظهر الاقتراحات تلقائيًا عند اختيار المنتج/كود العطل أو كتابة وصف كافٍ.</p>
                ) : (
                  suggestedKnowledge.map((item) => (
                    <div key={item.id} className="rounded border p-3">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <p className="font-medium text-sm">{item.title}</p>
                        <Badge>{tierLabel[item.priority_tier] ?? "مطابقة"}</Badge>
                        <Badge variant="secondary">{item.effectiveness_rate}%</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{item.match_reason}</p>
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{item.solution_steps}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            knowledge_base_id: item.id,
                            remote_solution_notes: prev.remote_solution_notes || item.solution_steps,
                            solution_type: prev.solution_type || "remote",
                          }))
                        }
                      >
                        تطبيق هذا الاقتراح
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">المعالجة عن بُعد</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <Select value={form.solution_type || "none"} onValueChange={(value) => setForm((prev) => ({ ...prev, solution_type: value === "none" ? "" : value }))}><SelectTrigger><SelectValue placeholder="نوع الحل" /></SelectTrigger><SelectContent><SelectItem value="none">غير محدد</SelectItem><SelectItem value="remote">حل عن بُعد</SelectItem><SelectItem value="field">حل ميداني</SelectItem><SelectItem value="bring_to_center">إحضار للمركز</SelectItem><SelectItem value="no_fix_needed">لا يحتاج إصلاح</SelectItem></SelectContent></Select>
                  <Select value={form.knowledge_base_id || "none"} onValueChange={(value) => setForm((prev) => ({ ...prev, knowledge_base_id: value === "none" ? "" : value }))}><SelectTrigger><SelectValue placeholder="ربط مقال معرفة" /></SelectTrigger><SelectContent><SelectItem value="none">بدون ربط</SelectItem>{(refs?.knowledge ?? []).map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}</SelectContent></Select>
                </div>
                <Textarea placeholder="ملاحظات الحل عن بُعد" value={form.remote_solution_notes} onChange={(e) => setForm((prev) => ({ ...prev, remote_solution_notes: e.target.value }))} />
                <div className="flex items-center justify-between rounded border p-2">
                  <Label>إنشاء مادة معرفة جديدة من هذه التذكرة</Label>
                  <Switch checked={form.create_knowledge_entry} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, create_knowledge_entry: checked }))} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">الزيارة الميدانية والتكليف</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded border p-2">
                  <Label>تحتاج زيارة ميدانية</Label>
                  <Switch checked={form.field_visit_needed} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, field_visit_needed: checked }))} />
                </div>
                {form.field_visit_needed && (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    <Select value={form.assignment_engineer_id} onValueChange={(value) => setForm((prev) => ({ ...prev, assignment_engineer_id: value }))}><SelectTrigger><SelectValue placeholder="المهندس" /></SelectTrigger><SelectContent>{(refs?.engineers ?? []).map((engineer) => <SelectItem key={engineer.id} value={engineer.id}>{engineer.name}</SelectItem>)}</SelectContent></Select>
                    <Select value={form.assignment_type} onValueChange={(value) => setForm((prev) => ({ ...prev, assignment_type: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="repair_visit">زيارة إصلاح</SelectItem><SelectItem value="new_installation">تركيب جديد</SelectItem></SelectContent></Select>
                    <Input type="datetime-local" value={form.assignment_date} onChange={(e) => setForm((prev) => ({ ...prev, assignment_date: e.target.value }))} />
                    <Textarea className="md:col-span-3" placeholder="ملاحظات التكليف" value={form.assignment_notes} onChange={(e) => setForm((prev) => ({ ...prev, assignment_notes: e.target.value }))} />
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-start gap-2">
              <Button type="submit">حفظ التذكرة</Button>
              <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm(); }}>إلغاء</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}