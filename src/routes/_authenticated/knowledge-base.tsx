import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAccessContext } from "@/hooks/use-access-context";
import { requireRole } from "@/lib/auth-client";
import { getPhase2References, listKnowledgeBase, saveKnowledgeBase } from "@/lib/phase2.functions";
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
  const saveFn = useServerFn(saveKnowledgeBase);
  const refsFn = useServerFn(getPhase2References);
  const { data: accessData } = useAccessContext();
  const roles = accessData?.roles ?? [];
  const canManage = hasAnyPermission(roles, ["knowledge_base.manage"]);

  const { data: refs } = useQuery({ queryKey: ["phase2-refs"], queryFn: () => refsFn() });
  const { data: articles = [] } = useQuery({ queryKey: ["knowledge-base"], queryFn: () => listFn() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: "", title: "", issue_description: "", solution_steps: "", product_id: "", error_code_text: "", search_keywords: "", source: "manual", success_count: 0, fail_count: 0, effectiveness_rate: 0 });

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

  return (
    <AppShell roles={roles} title="قاعدة المعرفة">
      <div className="space-y-4">
        {canManage && <Button onClick={() => setOpen(true)}>إضافة مادة معرفية</Button>}
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>العنوان</TableHead><TableHead>المنتج</TableHead><TableHead>رمز الخطأ</TableHead><TableHead>المصدر</TableHead><TableHead>نسبة الفاعلية</TableHead>{canManage && <TableHead className="text-left">إجراء</TableHead>}</TableRow></TableHeader>
            <TableBody>
              {articles.map((a) => (
                <TableRow key={a.id}>
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