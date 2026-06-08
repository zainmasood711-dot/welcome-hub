import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAccessContext } from "@/hooks/use-access-context";
import { requireRole } from "@/lib/auth-client";
import { createAssignmentFromSource, getPhase2References, listAssignments, saveAssignment, submitAssignmentReport } from "@/lib/phase2.functions";
import { hasAnyPermission } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/assignments")({
  beforeLoad: async () => {
    await requireRole(["support_engineer", "field_engineer"]);
  },
  component: AssignmentsPage,
});

function AssignmentsPage() {
  const queryClient = useQueryClient();
  const refsFn = useServerFn(getPhase2References);
  const listFn = useServerFn(listAssignments);
  const createFromSourceFn = useServerFn(createAssignmentFromSource);
  const saveFn = useServerFn(saveAssignment);
  const submitFn = useServerFn(submitAssignmentReport);
  const { data: accessData } = useAccessContext();
  const roles = accessData?.roles ?? [];

  const canManage = hasAnyPermission(roles, ["field_assignments.manage", "install_assignments.manage"]);
  const canSubmit = hasAnyPermission(roles, ["field_assignments.read_assigned", "install_assignments.read_assigned"]);

  const { data: refs } = useQuery({ queryKey: ["phase2-refs"], queryFn: () => refsFn() });
  const { data: assignments = [] } = useQuery({ queryKey: ["assignments"], queryFn: () => listFn() });

  const [open, setOpen] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [engineerFilter, setEngineerFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const pageSize = 10;
  const [sourceType, setSourceType] = useState<"ticket" | "system">("ticket");
  const [form, setForm] = useState({ id: "", ticket_id: "", customer_system_id: "", engineer_id: "", assignment_type: "repair_visit", scheduled_date: "", status: "pending", work_done: "", difficulties: "", recommendations: "" });

  const filteredAssignments = useMemo(() => {
    return assignments.filter((assignment) => {
      if (statusFilter !== "all" && assignment.status !== statusFilter) return false;
      if (typeFilter !== "all" && assignment.assignment_type !== typeFilter) return false;
      if (engineerFilter !== "all" && assignment.engineer_id !== engineerFilter) return false;
      if (fromDate && (!assignment.scheduled_date || new Date(assignment.scheduled_date) < new Date(fromDate))) return false;
      if (toDate && (!assignment.scheduled_date || new Date(assignment.scheduled_date) > new Date(`${toDate}T23:59:59`))) return false;
      const searchBucket = `${assignment.id} ${assignment.status} ${assignment.assignment_type}`.toLowerCase();
      return searchBucket.includes(search.toLowerCase());
    });
  }, [assignments, statusFilter, typeFilter, engineerFilter, search, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filteredAssignments.length / pageSize));
  const paginatedAssignments = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAssignments.slice(start, start + pageSize);
  }, [filteredAssignments, page]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, typeFilter, engineerFilter, fromDate, toDate]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const selectedAssignment = assignments.find((item) => item.id === selectedAssignmentId) ?? filteredAssignments[0] ?? null;
  const relatedTicket = refs?.tickets.find((item) => item.id === selectedAssignment?.ticket_id);
  const relatedSystem = refs?.customerSystems.find((item) => item.id === selectedAssignment?.customer_system_id);
  const relatedCustomer = refs?.customers.find((item) => item.id === relatedSystem?.customer_id || item.id === relatedTicket?.customer_id);

  const submitAssignment = async () => {
    try {
      if (canManage) {
        if (!form.id) {
          await createFromSourceFn({
            data: {
              ticket_id: sourceType === "ticket" ? form.ticket_id || null : null,
              customer_system_id: sourceType === "system" ? form.customer_system_id || null : null,
              engineer_id: form.engineer_id,
              assignment_type: form.assignment_type as "repair_visit" | "new_installation",
              scheduled_date: form.scheduled_date || null,
              notes: form.recommendations || null,
            },
          });
        } else {
          await saveFn({
            data: {
              id: form.id || undefined,
              ticket_id: form.ticket_id || null,
              customer_system_id: form.customer_system_id || null,
              engineer_id: form.engineer_id,
              assignment_type: form.assignment_type as "repair_visit" | "new_installation",
              scheduled_date: form.scheduled_date || null,
              status: form.status as "pending" | "in_progress" | "completed" | "cancelled",
              work_done: form.work_done || null,
              difficulties: form.difficulties || null,
              recommendations: form.recommendations || null,
            },
          });
        }
      } else {
        await submitFn({
          data: {
            id: form.id,
            status: form.status as "pending" | "in_progress" | "completed" | "cancelled",
            work_done: form.work_done || null,
            difficulties: form.difficulties || null,
            recommendations: form.recommendations || null,
          },
        });
      }
      toast.success("تم حفظ المهمة");
      setOpen(false);
      setConfirmCancelOpen(false);
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ المهمة");
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (form.status === "cancelled") {
      setConfirmCancelOpen(true);
      return;
    }
    await submitAssignment();
  };

  const statusBadge = (status: string) => {
    if (status === "completed") return <Badge>مكتملة</Badge>;
    if (status === "in_progress") return <Badge variant="secondary">قيد التنفيذ</Badge>;
    if (status === "cancelled") return <Badge variant="destructive">ملغاة</Badge>;
    return <Badge variant="outline">قيد الانتظار</Badge>;
  };

  return (
    <AppShell roles={roles} title="المهام الميدانية والتركيبات">
      <div className="space-y-4">
        {(canManage || canSubmit) && <Button onClick={() => setOpen(true)}>{canManage ? "إضافة مهمة" : "تحديث مهمة"}</Button>}

        <div className="grid grid-cols-1 gap-2 rounded-lg border bg-card p-3 md:grid-cols-4">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث سريع" />
          <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue placeholder="الحالة" /></SelectTrigger><SelectContent><SelectItem value="all">كل الحالات</SelectItem><SelectItem value="pending">قيد الانتظار</SelectItem><SelectItem value="in_progress">قيد التنفيذ</SelectItem><SelectItem value="completed">مكتملة</SelectItem><SelectItem value="cancelled">ملغاة</SelectItem></SelectContent></Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger><SelectValue placeholder="النوع" /></SelectTrigger><SelectContent><SelectItem value="all">كل الأنواع</SelectItem><SelectItem value="repair_visit">زيارة إصلاح</SelectItem><SelectItem value="new_installation">تركيب جديد</SelectItem></SelectContent></Select>
          <Select value={engineerFilter} onValueChange={setEngineerFilter}><SelectTrigger><SelectValue placeholder="المهندس" /></SelectTrigger><SelectContent><SelectItem value="all">كل المهندسين</SelectItem>{(refs?.engineers ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>

         <div className="rounded-lg border bg-card md:hidden">
          {paginatedAssignments.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">لا توجد مهام مطابقة للبحث الحالي.</div>
          ) : (
            <div className="space-y-2 p-3">
              {paginatedAssignments.map((a) => (
                <button key={a.id} type="button" className="w-full rounded-md border p-3 text-right" onClick={() => setSelectedAssignmentId(a.id)}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{a.assignment_type === "repair_visit" ? "زيارة إصلاح" : "تركيب جديد"}</p>
                    {statusBadge(a.status)}
                  </div>
                  <p className="text-xs text-muted-foreground">{refs?.engineers.find((e) => e.id === a.engineer_id)?.name ?? "—"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{a.scheduled_date ? new Date(a.scheduled_date).toLocaleString("ar-EG") : "بدون موعد"}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="hidden rounded-lg border bg-card md:block">
          <Table>
            <TableHeader><TableRow><TableHead>النوع</TableHead><TableHead>المهندس</TableHead><TableHead>الحالة</TableHead><TableHead>موعد التنفيذ</TableHead>{(canManage || canSubmit) && <TableHead className="text-left">إجراء</TableHead>}</TableRow></TableHeader>
            <TableBody>
              {paginatedAssignments.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">لا توجد مهام مطابقة للبحث الحالي.</TableCell></TableRow>
              ) : paginatedAssignments.map((a) => (
                <TableRow key={a.id} onClick={() => setSelectedAssignmentId(a.id)} className="cursor-pointer">
                  <TableCell>{a.assignment_type === "repair_visit" ? "زيارة إصلاح" : "تركيب جديد"}</TableCell>
                  <TableCell>{refs?.engineers.find((e) => e.id === a.engineer_id)?.name ?? "—"}</TableCell>
                  <TableCell>{statusBadge(a.status)}</TableCell>
                  <TableCell>{a.scheduled_date ? new Date(a.scheduled_date).toLocaleString("ar-EG") : "—"}</TableCell>
                   {(canManage || canSubmit) && <TableCell className="text-left"><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => { setSourceType(a.ticket_id ? "ticket" : "system"); setForm({ id: a.id, ticket_id: a.ticket_id ?? "", customer_system_id: a.customer_system_id ?? "", engineer_id: a.engineer_id, assignment_type: a.assignment_type, scheduled_date: a.scheduled_date ? a.scheduled_date.slice(0, 16) : "", status: a.status, work_done: a.work_done ?? "", difficulties: a.difficulties ?? "", recommendations: a.recommendations ?? "" }); setOpen(true); }}>تحديث</Button><Button asChild size="sm" variant="secondary"><Link to="/_authenticated/assignments/$assignmentId" params={{ assignmentId: a.id }}>تفاصيل</Link></Button></div></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">صفحة {page} من {totalPages}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>السابق</Button>
            <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>التالي</Button>
          </div>
        </div>

        {selectedAssignment && (
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">تفاصيل المهمة المختارة</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded border p-3 text-sm">
                <p className="font-medium">بيانات العميل</p>
                <p className="text-muted-foreground">{relatedCustomer?.name ?? "—"}</p>
                <p className="text-muted-foreground">{relatedCustomer?.phone ?? "—"}</p>
              </div>
              <div className="rounded border p-3 text-sm">
                <p className="font-medium">بيانات النظام</p>
                <p className="text-muted-foreground">{relatedSystem?.system_name ?? "—"}</p>
                <p className="text-muted-foreground">الحالة: {relatedSystem?.status ?? "—"}</p>
              </div>
              <div className="rounded border p-3 text-sm">
                <p className="font-medium">بيانات التذكرة المرتبطة</p>
                <p className="text-muted-foreground">الحالة: {relatedTicket?.status ?? "—"}</p>
              </div>
              <div className="rounded border p-3 text-sm">
                <p className="font-medium">تاريخ الخدمة</p>
                <p className="text-muted-foreground">آخر تحديث: {selectedAssignment.updated_at ? new Date(selectedAssignment.updated_at).toLocaleString("ar-EG") : "—"}</p>
                <p className="text-muted-foreground">موعد التنفيذ: {selectedAssignment.scheduled_date ? new Date(selectedAssignment.scheduled_date).toLocaleString("ar-EG") : "—"}</p>
                <Button asChild size="sm" className="mt-2"><Link to="/_authenticated/field-task/$assignmentId" params={{ assignmentId: selectedAssignment.id }}>صفحة المهمة الميدانية</Link></Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{canManage ? "إدارة مهمة" : "تقرير مهمة"}</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={submit}>
            {canManage && (
              <>
                {!form.id && <div className="space-y-2"><Label>مصدر المهمة</Label><Select value={sourceType} onValueChange={(v) => setSourceType(v as "ticket" | "system")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ticket">من تذكرة</SelectItem><SelectItem value="system">من نظام عميل</SelectItem></SelectContent></Select></div>}
                {sourceType === "ticket" && <div className="space-y-2"><Label>التذكرة</Label><Select value={form.ticket_id || "none"} onValueChange={(v) => setForm((p) => ({ ...p, ticket_id: v === "none" ? "" : v, customer_system_id: "" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">اختر تذكرة</SelectItem>{(refs?.tickets ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.id.slice(0, 8)} - {t.status}</SelectItem>)}</SelectContent></Select></div>}
                {sourceType === "system" && <div className="space-y-2"><Label>نظام العميل</Label><Select value={form.customer_system_id || "none"} onValueChange={(v) => setForm((p) => ({ ...p, customer_system_id: v === "none" ? "" : v, ticket_id: "" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">اختر نظام</SelectItem>{(refs?.customerSystems ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.system_name}</SelectItem>)}</SelectContent></Select></div>}
                <div className="space-y-2"><Label>المهندس</Label><Select value={form.engineer_id} onValueChange={(v) => setForm((p) => ({ ...p, engineer_id: v }))}><SelectTrigger><SelectValue placeholder="اختر مهندس" /></SelectTrigger><SelectContent>{(refs?.engineers ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>نوع المهمة</Label><Select value={form.assignment_type} onValueChange={(v) => setForm((p) => ({ ...p, assignment_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="repair_visit">زيارة إصلاح</SelectItem><SelectItem value="new_installation">تركيب جديد</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>موعد التنفيذ</Label><Input type="datetime-local" value={form.scheduled_date} onChange={(e) => setForm((p) => ({ ...p, scheduled_date: e.target.value }))} /></div>
              </>
            )}
            <div className="space-y-2"><Label>الحالة</Label><Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">قيد الانتظار</SelectItem><SelectItem value="in_progress">قيد التنفيذ</SelectItem><SelectItem value="completed">مكتملة</SelectItem><SelectItem value="cancelled">ملغاة</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>ما تم إنجازه</Label><Textarea value={form.work_done} onChange={(e) => setForm((p) => ({ ...p, work_done: e.target.value }))} /></div>
            <div className="space-y-2"><Label>الصعوبات</Label><Textarea value={form.difficulties} onChange={(e) => setForm((p) => ({ ...p, difficulties: e.target.value }))} /></div>
            <div className="space-y-2"><Label>التوصيات</Label><Textarea value={form.recommendations} onChange={(e) => setForm((p) => ({ ...p, recommendations: e.target.value }))} /></div>
            <div className="flex justify-start gap-2"><Button type="submit">حفظ</Button><Button type="button" variant="outline" onClick={() => setOpen(false)}>إلغاء</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد إلغاء المهمة</AlertDialogTitle>
            <AlertDialogDescription>سيتم تغيير حالة المهمة إلى "ملغاة". هل تريد المتابعة؟</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>رجوع</AlertDialogCancel>
            <AlertDialogAction onClick={submitAssignment}>تأكيد الإلغاء</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}