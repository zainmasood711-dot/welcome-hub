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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAccessContext } from "@/hooks/use-access-context";
import { requireRole } from "@/lib/auth-client";
import {
  createKnowledgeArticleFromTicket,
  getKnowledgeSuggestions,
  getPhase2References,
  listKnowledgeBase,
  listTickets,
  saveCustomer,
  saveTicket,
} from "@/lib/phase2.functions";
import { hasAnyPermission } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/tickets")({
  beforeLoad: async () => {
    await requireRole(["support_engineer", "field_engineer"]);
  },
  component: TicketsPage,
});

function TicketsPage() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listTickets);
  const saveFn = useServerFn(saveTicket);
  const saveCustomerFn = useServerFn(saveCustomer);
  const suggestKnowledgeFn = useServerFn(getKnowledgeSuggestions);
  const createFromTicketFn = useServerFn(createKnowledgeArticleFromTicket);
  const refsFn = useServerFn(getPhase2References);
  const kbFn = useServerFn(listKnowledgeBase);
  const { data: accessData } = useAccessContext();
  const roles = accessData?.roles ?? [];
  const canManage = hasAnyPermission(roles, ["tickets.manage"]);

  const { data: refs } = useQuery({ queryKey: ["phase2-refs"], queryFn: () => refsFn() });
  const { data: knowledgeBase = [] } = useQuery({ queryKey: ["knowledge-base-all"], queryFn: () => kbFn() });
  const { data: tickets = [] } = useQuery({ queryKey: ["tickets"], queryFn: () => listFn() });

  const [open, setOpen] = useState(false);
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [quickCustomer, setQuickCustomer] = useState({ name: "", phone: "", governorate: "", city: "", address: "" });
  const [closeFeedback, setCloseFeedback] = useState({ rating: "success", notes: "" });
  const [form, setForm] = useState({
    id: "",
    customer_id: "",
    customer_system_id: "",
    ticket_type: "fault",
    status: "new",
    priority: "medium",
    description: "",
    affected_product_id: "",
    error_code_text: "",
    solution_type: "",
    remote_solution_notes: "",
    knowledge_base_id: "",
  });

  const { data: suggestedKnowledge = [] } = useQuery({
    queryKey: ["knowledge-suggestions", form.affected_product_id, form.error_code_text, form.description],
    queryFn: () =>
      suggestKnowledgeFn({
        data: {
          affected_product_id: form.affected_product_id || null,
          error_code_text: form.error_code_text || null,
          issue_description: form.description || null,
          limit: 4,
        },
      }),
    enabled: Boolean(form.affected_product_id || form.error_code_text || form.description.trim().length >= 3),
  });

  const tierLabel: Record<1 | 2 | 3 | 4, string> = {
    1: "أولوية 1: نفس كود الخطأ + نفس المنتج",
    2: "أولوية 2: نفس كود الخطأ",
    3: "أولوية 3: نفس المنتج/الموديل",
    4: "أولوية 4: كلمات مفتاحية",
  };

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase();
    return (refs?.customers ?? []).filter((item) => `${item.name} ${item.phone}`.toLowerCase().includes(q));
  }, [refs?.customers, customerSearch]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await saveFn({
        data: {
          id: form.id || undefined,
          customer_id: form.customer_id,
          customer_system_id: form.customer_system_id || null,
          ticket_type: form.ticket_type as "fault" | "inquiry" | "preventive_maintenance" | "new_installation",
          status: form.status as "new" | "in_progress" | "resolved_remote" | "assigned_field" | "closed",
          priority: form.priority as "low" | "medium" | "high" | "critical",
          description: form.description,
          affected_product_id: form.affected_product_id || null,
          error_code_text: form.error_code_text || null,
          solution_type: (form.solution_type || null) as "remote" | "field" | "bring_to_center" | "no_fix_needed" | null,
          remote_solution_notes: form.remote_solution_notes || null,
          knowledge_base_id: form.knowledge_base_id || null,
          knowledge_feedback_rating: form.status === "closed" ? (closeFeedback.rating as "success" | "failure" | "partial") : null,
          knowledge_feedback_notes: form.status === "closed" ? closeFeedback.notes || null : null,
          resolved_by: null,
          resolved_at: null,
        },
      });
      toast.success("تم حفظ التذكرة");
      setOpen(false);
      setForm({ id: "", customer_id: "", customer_system_id: "", ticket_type: "fault", status: "new", priority: "medium", description: "", affected_product_id: "", error_code_text: "", solution_type: "", remote_solution_notes: "", knowledge_base_id: "" });
      setCloseFeedback({ rating: "success", notes: "" });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-all"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ التذكرة");
    }
  };

  const submitQuickCustomer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await saveCustomerFn({
        data: {
          name: quickCustomer.name,
          phone: quickCustomer.phone,
          governorate: quickCustomer.governorate || null,
          city: quickCustomer.city || null,
          address: quickCustomer.address || null,
          location_coordinates: null,
          notes: null,
        },
      });
      toast.success("تمت إضافة العميل ويمكن اختياره الآن");
      setQuickCustomerOpen(false);
      setQuickCustomer({ name: "", phone: "", governorate: "", city: "", address: "" });
      queryClient.invalidateQueries({ queryKey: ["phase2-refs"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إضافة العميل");
    }
  };

  const applyKnowledgeSuggestion = async (knowledgeId: string) => {
    const selected = knowledgeBase.find((item) => item.id === knowledgeId);
    if (!selected || !form.id) {
      setForm((prev) => ({
        ...prev,
        knowledge_base_id: knowledgeId,
        remote_solution_notes: prev.remote_solution_notes || selected?.solution_steps || "",
      }));
      return;
    }

    try {
      await saveFn({
        data: {
          id: form.id,
          customer_id: form.customer_id,
          customer_system_id: form.customer_system_id || null,
          ticket_type: form.ticket_type as "fault" | "inquiry" | "preventive_maintenance" | "new_installation",
          status: form.status as "new" | "in_progress" | "resolved_remote" | "assigned_field" | "closed",
          priority: form.priority as "low" | "medium" | "high" | "critical",
          description: form.description,
          affected_product_id: form.affected_product_id || null,
          error_code_text: form.error_code_text || null,
          solution_type: "remote",
          remote_solution_notes: selected.solution_steps,
          knowledge_base_id: selected.id,
          resolved_by: null,
          resolved_at: null,
        },
      });

      toast.success("تم ربط التذكرة بالحل المقترح");
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-all"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تطبيق الحل المقترح");
    }
  };

  const createKnowledgeFromTicket = async () => {
    if (!form.id) {
      toast.error("احفظ التذكرة أولاً قبل إنشاء مادة معرفية منها");
      return;
    }
    try {
      const result = await createFromTicketFn({ data: { ticket_id: form.id, title: null } });
      if (result.created) {
        toast.success("تم إنشاء مادة معرفية وربطها بالتذكرة");
        setForm((prev) => ({ ...prev, knowledge_base_id: result.articleId }));
      } else {
        toast.info("يوجد مادة مشابهة بالفعل وتم منع التكرار");
      }
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-all"] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إنشاء مادة المعرفة من التذكرة");
    }
  };

  return (
    <AppShell roles={roles} title="التذاكر وحالات الدعم">
      <div className="space-y-4">
        {canManage && <Button onClick={() => setOpen(true)}>إضافة تذكرة</Button>}
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>العميل</TableHead><TableHead>النوع</TableHead><TableHead>الحالة</TableHead><TableHead>الأولوية</TableHead><TableHead>الوصف</TableHead>{canManage && <TableHead className="text-left">إجراء</TableHead>}</TableRow></TableHeader>
            <TableBody>
              {tickets.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{refs?.customers.find((c) => c.id === t.customer_id)?.name ?? "—"}</TableCell>
                  <TableCell>{t.ticket_type}</TableCell><TableCell>{t.status}</TableCell><TableCell>{t.priority}</TableCell>
                  <TableCell className="max-w-[420px] truncate">{t.description}</TableCell>
                  {canManage && <TableCell className="text-left"><Button variant="outline" size="sm" onClick={() => { setForm({ id: t.id, customer_id: t.customer_id, customer_system_id: t.customer_system_id ?? "", ticket_type: t.ticket_type, status: t.status, priority: t.priority, description: t.description, affected_product_id: t.affected_product_id ?? "", error_code_text: t.error_code_text ?? "", solution_type: t.solution_type ?? "", remote_solution_notes: t.remote_solution_notes ?? "", knowledge_base_id: t.knowledge_base_id ?? "" }); setCloseFeedback({ rating: "success", notes: "" }); setOpen(true); }}>تعديل</Button></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{form.id ? "تعديل تذكرة" : "إضافة تذكرة"}</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={submit}>
            <div className="space-y-2">
              <Label>بحث عميل بالاسم أو الهاتف</Label>
              <Input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="اكتب الاسم أو الهاتف" />
              <div className="flex gap-2">
                <Select value={form.customer_id} onValueChange={(v) => setForm((p) => ({ ...p, customer_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="اختر عميل" /></SelectTrigger>
                  <SelectContent>
                    {filteredCustomers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} - {c.phone}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={() => setQuickCustomerOpen(true)}>إضافة عميل سريع</Button>
              </div>
            </div>
            <div className="space-y-2"><Label>نظام العميل</Label><Select value={form.customer_system_id || "none"} onValueChange={(v) => setForm((p) => ({ ...p, customer_system_id: v === "none" ? "" : v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">بدون</SelectItem>{(refs?.customerSystems ?? []).filter((s) => !form.customer_id || s.customer_id === form.customer_id).map((s) => <SelectItem key={s.id} value={s.id}>{s.system_name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-2"><Label>النوع</Label><Select value={form.ticket_type} onValueChange={(v) => setForm((p) => ({ ...p, ticket_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fault">عطل</SelectItem><SelectItem value="inquiry">استفسار</SelectItem><SelectItem value="preventive_maintenance">صيانة دورية</SelectItem><SelectItem value="new_installation">تركيب جديد</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>الحالة</Label><Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="new">جديدة</SelectItem><SelectItem value="in_progress">قيد التنفيذ</SelectItem><SelectItem value="resolved_remote">حُلّت عن بُعد</SelectItem><SelectItem value="assigned_field">مُحالة للميدان</SelectItem><SelectItem value="closed">مغلقة</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>الأولوية</Label><Select value={form.priority} onValueChange={(v) => setForm((p) => ({ ...p, priority: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">منخفضة</SelectItem><SelectItem value="medium">متوسطة</SelectItem><SelectItem value="high">عالية</SelectItem><SelectItem value="critical">حرجة</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>الوصف</Label><Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} required /></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label>المنتج المتأثر</Label><Select value={form.affected_product_id || "none"} onValueChange={(v) => setForm((p) => ({ ...p, affected_product_id: v === "none" ? "" : v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">غير محدد</SelectItem>{(refs?.products ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.model}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>مرجع مادة معرفية</Label><Select value={form.knowledge_base_id || "none"} onValueChange={(v) => setForm((p) => ({ ...p, knowledge_base_id: v === "none" ? "" : v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">بدون</SelectItem>{(refs?.knowledge ?? []).map((k) => <SelectItem key={k.id} value={k.id}>{k.title}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>رمز الخطأ النصي</Label><Input value={form.error_code_text} onChange={(e) => setForm((p) => ({ ...p, error_code_text: e.target.value }))} /></div>
            <div className="space-y-2"><Label>نوع الحل</Label><Select value={form.solution_type || "none"} onValueChange={(v) => setForm((p) => ({ ...p, solution_type: v === "none" ? "" : v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">بدون</SelectItem><SelectItem value="remote">عن بُعد</SelectItem><SelectItem value="field">ميداني</SelectItem><SelectItem value="bring_to_center">إحضار للمركز</SelectItem><SelectItem value="no_fix_needed">لا يتطلب إصلاح</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>ملاحظات الحل عن بُعد</Label><Textarea value={form.remote_solution_notes} onChange={(e) => setForm((p) => ({ ...p, remote_solution_notes: e.target.value }))} /></div>

            {canManage && form.id && form.remote_solution_notes.trim().length >= 10 && (
              <div className="rounded border p-3">
                <p className="text-sm mb-2">لو الحل الجديد مفيد وغير موجود بقاعدة المعرفة، يمكنك إنشاؤه مباشرة من هذه التذكرة.</p>
                <Button type="button" variant="outline" onClick={createKnowledgeFromTicket}>
                  إنشاء مادة معرفة من التذكرة
                </Button>
              </div>
            )}

            {form.status === "closed" && form.knowledge_base_id && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">تقييم نتيجة استخدام الحل عند إغلاق التذكرة</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>التقييم</Label>
                      <Select value={closeFeedback.rating} onValueChange={(v) => setCloseFeedback((prev) => ({ ...prev, rating: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="success">ناجح</SelectItem>
                          <SelectItem value="failure">فاشل</SelectItem>
                          <SelectItem value="partial">جزئي</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>ملاحظات التقييم (اختياري)</Label>
                      <Input value={closeFeedback.notes} onChange={(e) => setCloseFeedback((prev) => ({ ...prev, notes: e.target.value }))} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">الحلول المقترحة من قاعدة المعرفة</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {suggestedKnowledge.length === 0 ? (
                  <p className="text-sm text-muted-foreground">لا توجد نتائج مطابقة حتى الآن.</p>
                ) : (
                  suggestedKnowledge.map((item) => (
                    <div key={item.id} className="rounded border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm">{item.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{item.issue_description}</p>
                           <div className="mt-1 flex flex-wrap gap-2">
                             <Badge>{tierLabel[item.priority_tier as 1 | 2 | 3 | 4]}</Badge>
                            <Badge variant="secondary">فاعلية {item.effectiveness_rate}%</Badge>
                            <Badge variant="outline">استخدام {item.success_count + item.fail_count}</Badge>
                          </div>
                        </div>
                        <Button type="button" size="sm" onClick={() => applyKnowledgeSuggestion(item.id)}>
                          استخدم هذا الحل
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <div className="flex justify-start gap-2"><Button type="submit">حفظ</Button><Button type="button" variant="outline" onClick={() => setOpen(false)}>إلغاء</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={quickCustomerOpen} onOpenChange={setQuickCustomerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة عميل سريع</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={submitQuickCustomer}>
            <div className="space-y-2"><Label>الاسم</Label><Input value={quickCustomer.name} onChange={(e) => setQuickCustomer((p) => ({ ...p, name: e.target.value }))} required /></div>
            <div className="space-y-2"><Label>الهاتف</Label><Input value={quickCustomer.phone} onChange={(e) => setQuickCustomer((p) => ({ ...p, phone: e.target.value }))} required /></div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-2"><Label>المحافظة</Label><Input value={quickCustomer.governorate} onChange={(e) => setQuickCustomer((p) => ({ ...p, governorate: e.target.value }))} /></div>
              <div className="space-y-2"><Label>المدينة</Label><Input value={quickCustomer.city} onChange={(e) => setQuickCustomer((p) => ({ ...p, city: e.target.value }))} /></div>
            </div>
            <div className="space-y-2"><Label>العنوان</Label><Input value={quickCustomer.address} onChange={(e) => setQuickCustomer((p) => ({ ...p, address: e.target.value }))} /></div>
            <div className="flex gap-2"><Button type="submit">حفظ</Button><Button type="button" variant="outline" onClick={() => setQuickCustomerOpen(false)}>إلغاء</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}