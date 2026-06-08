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
import { getPhase2References, listAttachments, listKnowledgeBase, listKnowledgeFeedback, listTickets, saveKnowledgeBase, saveKnowledgeFeedback } from "@/lib/phase2.functions";
import { hasAnyPermission } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/knowledge-base")({
  beforeLoad: async () => {
    await requireRole(["support_engineer", "field_engineer"]);
  },
  component: KnowledgeBasePage,
});

function KnowledgeBasePage() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listKnowledgeBase);
  const listFeedbackFn = useServerFn(listKnowledgeFeedback);
  const saveFeedbackFn = useServerFn(saveKnowledgeFeedback);
  const saveFn = useServerFn(saveKnowledgeBase);
  const refsFn = useServerFn(getPhase2References);
  const ticketsFn = useServerFn(listTickets);
  const attachmentsFn = useServerFn(listAttachments);
  const { data: accessData } = useAccessContext();
  const roles = accessData?.roles ?? [];
  const canManage = hasAnyPermission(roles, ["knowledge_base.manage"]);

  const { data: refs } = useQuery({ queryKey: ["phase2-refs"], queryFn: () => refsFn() });
  const { data: articles = [] } = useQuery({ queryKey: ["knowledge-base"], queryFn: () => listFn() });
  const { data: feedback = [] } = useQuery({ queryKey: ["knowledge-feedback"], queryFn: () => listFeedbackFn() });
  const { data: tickets = [] } = useQuery({ queryKey: ["knowledge-tickets"], queryFn: () => ticketsFn() });
  const { data: attachments = [] } = useQuery({ queryKey: ["knowledge-attachments"], queryFn: () => attachmentsFn() });

  const [open, setOpen] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState<string>("");
  const [searchText, setSearchText] = useState("");
  const [filterProductId, setFilterProductId] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [filterEffectiveness, setFilterEffectiveness] = useState("all");
  const [feedbackDraft, setFeedbackDraft] = useState({ rating: "success", notes: "" });
  const [form, setForm] = useState({ id: "", title: "", issue_description: "", solution_steps: "", product_id: "", error_code_text: "", search_keywords: "", source: "manual", success_count: 0, fail_count: 0, effectiveness_rate: 0 });

  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      if (filterProductId !== "all" && article.product_id !== filterProductId) return false;
      if (filterSource !== "all" && article.source !== filterSource) return false;
      if (filterEffectiveness !== "all") {
        const threshold = Number(filterEffectiveness);
        if (Number(article.effectiveness_rate) < threshold) return false;
      }

      const hay = `${article.title} ${article.issue_description} ${article.error_code_text ?? ""} ${article.search_keywords ?? ""}`.toLowerCase();
      return hay.includes(searchText.toLowerCase());
    });
  }, [articles, filterProductId, filterSource, filterEffectiveness, searchText]);

  const selectedArticle = articles.find((item) => item.id === selectedArticleId) ?? filteredArticles[0] ?? null;
  const linkedTicketIds = Array.isArray(selectedArticle?.linked_ticket_ids)
    ? (selectedArticle?.linked_ticket_ids.filter((value): value is string => typeof value === "string") ?? [])
    : [];
  const selectedTickets = tickets.filter((ticket) => linkedTicketIds.includes(ticket.id));
  const selectedFeedback = feedback.filter((item) => item.knowledge_base_id === selectedArticle?.id);
  const selectedAttachments = attachments.filter((item) => item.attachable_type === "knowledge_base" && item.attachable_id === selectedArticle?.id);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await saveFn({
        data: {
          id: form.id || undefined,
          title: form.title,
          issue_description: form.issue_description,
          solution_steps: form.solution_steps,
          product_id: form.product_id || null,
          error_code_text: form.error_code_text || null,
          search_keywords: form.search_keywords || null,
          source: form.source as "manual" | "auto_from_ticket",
          linked_ticket_ids: [],
          success_count: Number(form.success_count) || 0,
          fail_count: Number(form.fail_count) || 0,
          effectiveness_rate: Number(form.effectiveness_rate) || 0,
        },
      });
      toast.success("تم حفظ مادة المعرفة");
      setOpen(false);
      setForm({ id: "", title: "", issue_description: "", solution_steps: "", product_id: "", error_code_text: "", search_keywords: "", source: "manual", success_count: 0, fail_count: 0, effectiveness_rate: 0 });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ المادة");
    }
  };

  const submitFeedback = async () => {
    if (!selectedArticle || !accessData?.profile.engineer_id) {
      toast.error("لا يمكن إضافة تقييم بدون اختيار مادة ووجود مهندس مرتبط");
      return;
    }

    try {
      await saveFeedbackFn({
        data: {
          knowledge_base_id: selectedArticle.id,
          ticket_id: null,
          engineer_id: accessData.profile.engineer_id,
          rating: feedbackDraft.rating as "success" | "failure" | "partial",
          notes: feedbackDraft.notes || null,
        },
      });
      toast.success("تم حفظ التقييم");
      setFeedbackDraft({ rating: "success", notes: "" });
      queryClient.invalidateQueries({ queryKey: ["knowledge-feedback"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ التقييم");
    }
  };

  return (
    <AppShell roles={roles} title="قاعدة المعرفة">
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">بحث وتصفية قاعدة المعرفة</CardTitle>
            {canManage && <Button onClick={() => setOpen(true)}>إضافة مادة معرفية</Button>}
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <Input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="بحث بالنص أو الكود أو الموديل" />
            <Select value={filterProductId} onValueChange={setFilterProductId}><SelectTrigger><SelectValue placeholder="المنتج" /></SelectTrigger><SelectContent><SelectItem value="all">كل المنتجات</SelectItem>{(refs?.products ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.model}</SelectItem>)}</SelectContent></Select>
            <Select value={filterSource} onValueChange={setFilterSource}><SelectTrigger><SelectValue placeholder="المصدر" /></SelectTrigger><SelectContent><SelectItem value="all">كل المصادر</SelectItem><SelectItem value="manual">يدوي</SelectItem><SelectItem value="auto_from_ticket">آلي</SelectItem></SelectContent></Select>
            <Select value={filterEffectiveness} onValueChange={setFilterEffectiveness}><SelectTrigger><SelectValue placeholder="الفاعلية" /></SelectTrigger><SelectContent><SelectItem value="all">كل النسب</SelectItem><SelectItem value="80">80% فأكثر</SelectItem><SelectItem value="60">60% فأكثر</SelectItem><SelectItem value="40">40% فأكثر</SelectItem></SelectContent></Select>
          </CardContent>
        </Card>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>العنوان</TableHead><TableHead>المنتج</TableHead><TableHead>رمز الخطأ</TableHead><TableHead>المصدر</TableHead><TableHead>نسبة الفاعلية</TableHead>{canManage && <TableHead className="text-left">إجراء</TableHead>}</TableRow></TableHeader>
            <TableBody>
              {filteredArticles.map((a) => (
                <TableRow key={a.id} onClick={() => setSelectedArticleId(a.id)} className="cursor-pointer">
                  <TableCell className="font-medium">{a.title}</TableCell>
                  <TableCell>{refs?.products.find((p) => p.id === a.product_id)?.model ?? "—"}</TableCell>
                  <TableCell>{a.error_code_text ?? "—"}</TableCell>
                  <TableCell>{a.source === "manual" ? "يدوي" : "آلي"}</TableCell>
                  <TableCell>{a.effectiveness_rate}%</TableCell>
                  {canManage && <TableCell className="text-left"><Button variant="outline" size="sm" onClick={() => { setForm({ id: a.id, title: a.title, issue_description: a.issue_description, solution_steps: a.solution_steps, product_id: a.product_id ?? "", error_code_text: a.error_code_text ?? "", search_keywords: a.search_keywords ?? "", source: a.source, success_count: a.success_count, fail_count: a.fail_count, effectiveness_rate: Number(a.effectiveness_rate) }); setOpen(true); }}>تعديل</Button></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {selectedArticle && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">تفاصيل المادة: {selectedArticle.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded border p-3 text-sm">
                <p className="font-medium">الوصف الكامل</p>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{selectedArticle.issue_description}</p>
              </div>
              <div className="rounded border p-3 text-sm">
                <p className="font-medium">خطوات الحل</p>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{selectedArticle.solution_steps}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">كود: {selectedArticle.error_code_text ?? "—"}</Badge>
                <Badge variant="outline">فاعلية: {selectedArticle.effectiveness_rate}%</Badge>
                <Badge variant="outline">مرات الاستخدام: {selectedArticle.success_count + selectedArticle.fail_count}</Badge>
              </div>

              <div className="rounded-lg border">
                <div className="border-b p-3 text-sm font-medium">التذاكر المرتبطة</div>
                <Table>
                  <TableHeader><TableRow><TableHead>رقم التذكرة</TableHead><TableHead>الحالة</TableHead><TableHead>الأولوية</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {selectedTickets.map((ticket) => <TableRow key={ticket.id}><TableCell>{ticket.id.slice(0, 8)}</TableCell><TableCell>{ticket.status}</TableCell><TableCell>{ticket.priority}</TableCell></TableRow>)}
                    {selectedTickets.length === 0 && <TableRow><TableCell colSpan={3} className="py-4 text-center text-muted-foreground">لا توجد تذاكر مرتبطة.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>

              <div className="rounded-lg border">
                <div className="border-b p-3 text-sm font-medium">المرفقات</div>
                <Table>
                  <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>النوع</TableHead><TableHead>الوصف</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {selectedAttachments.map((attachment) => <TableRow key={attachment.id}><TableCell>{attachment.original_name ?? attachment.file_path}</TableCell><TableCell>{attachment.file_type}</TableCell><TableCell>{attachment.description ?? "—"}</TableCell></TableRow>)}
                    {selectedAttachments.length === 0 && <TableRow><TableCell colSpan={3} className="py-4 text-center text-muted-foreground">لا توجد مرفقات.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-sm font-medium">تقييم الحل المستخدم</p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <Select value={feedbackDraft.rating} onValueChange={(v) => setFeedbackDraft((prev) => ({ ...prev, rating: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="success">ناجح</SelectItem><SelectItem value="partial">جزئي</SelectItem><SelectItem value="failure">فاشل</SelectItem></SelectContent></Select>
                  <Input value={feedbackDraft.notes} onChange={(e) => setFeedbackDraft((prev) => ({ ...prev, notes: e.target.value }))} placeholder="ملاحظات اختيارية" className="md:col-span-2" />
                </div>
                <div className="flex gap-2">
                  <Button type="button" onClick={submitFeedback}>حفظ التقييم</Button>
                  <p className="text-sm text-muted-foreground self-center">إجمالي التقييمات: {selectedFeedback.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{form.id ? "تعديل مادة معرفية" : "إضافة مادة معرفية"}</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={submit}>
            <div className="space-y-2"><Label>العنوان</Label><Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required /></div>
            <div className="space-y-2"><Label>وصف المشكلة</Label><Textarea value={form.issue_description} onChange={(e) => setForm((p) => ({ ...p, issue_description: e.target.value }))} required /></div>
            <div className="space-y-2"><Label>خطوات الحل</Label><Textarea value={form.solution_steps} onChange={(e) => setForm((p) => ({ ...p, solution_steps: e.target.value }))} required /></div>
            <div className="space-y-2"><Label>المنتج</Label><Select value={form.product_id || "none"} onValueChange={(v) => setForm((p) => ({ ...p, product_id: v === "none" ? "" : v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">غير محدد</SelectItem>{(refs?.products ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.model}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>رمز الخطأ</Label><Input value={form.error_code_text} onChange={(e) => setForm((p) => ({ ...p, error_code_text: e.target.value }))} /></div>
            <div className="space-y-2"><Label>كلمات البحث</Label><Input value={form.search_keywords} onChange={(e) => setForm((p) => ({ ...p, search_keywords: e.target.value }))} /></div>
            <div className="space-y-2"><Label>المصدر</Label><Select value={form.source} onValueChange={(v) => setForm((p) => ({ ...p, source: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">يدوي</SelectItem><SelectItem value="auto_from_ticket">آلي من تذكرة</SelectItem></SelectContent></Select></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-2"><Label>نجاحات</Label><Input type="number" min={0} value={String(form.success_count)} onChange={(e) => setForm((p) => ({ ...p, success_count: Number(e.target.value) || 0 }))} /></div>
              <div className="space-y-2"><Label>إخفاقات</Label><Input type="number" min={0} value={String(form.fail_count)} onChange={(e) => setForm((p) => ({ ...p, fail_count: Number(e.target.value) || 0 }))} /></div>
              <div className="space-y-2"><Label>نسبة الفاعلية</Label><Input type="number" min={0} max={100} value={String(form.effectiveness_rate)} onChange={(e) => setForm((p) => ({ ...p, effectiveness_rate: Number(e.target.value) || 0 }))} /></div>
            </div>
            <div className="flex justify-start gap-2"><Button type="submit">حفظ</Button><Button type="button" variant="outline" onClick={() => setOpen(false)}>إلغاء</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}