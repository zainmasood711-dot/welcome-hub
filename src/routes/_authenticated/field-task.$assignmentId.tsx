import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAccessContext } from "@/hooks/use-access-context";
import { requireRole } from "@/lib/auth-client";
import { getAssignmentDetailsBundle, submitAssignmentFieldReportWorkflow } from "@/lib/phase2.functions";

export const Route = createFileRoute("/_authenticated/field-task/$assignmentId")({
  beforeLoad: async () => {
    await requireRole(["support_engineer", "field_engineer"]);
  },
  component: FieldTaskPage,
});

function FieldTaskPage() {
  const { assignmentId } = Route.useParams();
  const queryClient = useQueryClient();
  const detailsFn = useServerFn(getAssignmentDetailsBundle);
  const submitFn = useServerFn(submitAssignmentFieldReportWorkflow);
  const { data: accessData } = useAccessContext();
  const roles = accessData?.roles ?? [];

  const draftKey = `field-task-draft:${assignmentId}`;
  const [isOnline, setIsOnline] = useState(true);
  const [form, setForm] = useState({
    status: "pending",
    work_done: "",
    difficulties: "",
    recommendations: "",
    knowledge_base_id: "",
    knowledge_feedback_rating: "",
    knowledge_feedback_notes: "",
    photo_path: "",
    photo_name: "",
    photo_size: "",
    battery_path: "",
    battery_name: "",
    battery_size: "",
  });
  const [photos, setPhotos] = useState<Array<{ file_path: string; original_name: string | null; file_size: number | null }>>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["field-task", assignmentId],
    queryFn: () => detailsFn({ data: { assignment_id: assignmentId } }),
  });

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    setIsOnline(navigator.onLine);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(draftKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as typeof form & { photos?: typeof photos };
        setForm((prev) => ({ ...prev, ...parsed }));
        setPhotos(parsed.photos ?? []);
      } catch {
      }
    }
  }, [draftKey]);

  useEffect(() => {
    localStorage.setItem(draftKey, JSON.stringify({ ...form, photos }));
  }, [draftKey, form, photos]);

  useEffect(() => {
    if (!data?.assignment) return;
    setForm((prev) => ({
      ...prev,
      status: data.assignment.status,
      work_done: data.assignment.work_done ?? prev.work_done,
      difficulties: data.assignment.difficulties ?? prev.difficulties,
      recommendations: data.assignment.recommendations ?? prev.recommendations,
    }));
  }, [data?.assignment]);

  const addPhoto = () => {
    if (!form.photo_path.trim()) return;
    if (!/\.(jpg|jpeg|png|webp)$/i.test(form.photo_path.trim())) {
      toast.error("امتداد الصور يجب أن يكون jpg/png/webp");
      return;
    }
    setPhotos((prev) => [
      ...prev,
      {
        file_path: form.photo_path.trim(),
        original_name: form.photo_name.trim() || null,
        file_size: form.photo_size ? Number(form.photo_size) : null,
      },
    ]);
    setForm((prev) => ({ ...prev, photo_path: "", photo_name: "", photo_size: "" }));
  };

  const canSubmit = useMemo(() => {
    if (form.status === "completed") return form.work_done.trim().length >= 5;
    return true;
  }, [form.status, form.work_done]);

  const submit = async () => {
    if (!canSubmit) {
      toast.error("يرجى كتابة ما تم إنجازه قبل الإكمال");
      return;
    }
    try {
      await submitFn({
        data: {
          assignment_id: assignmentId,
          status: form.status as "in_progress" | "completed" | "cancelled",
          work_done: form.work_done || null,
          difficulties: form.difficulties || null,
          recommendations: form.recommendations || null,
          knowledge_base_id: form.knowledge_base_id || null,
          knowledge_feedback_rating: (form.knowledge_feedback_rating || null) as "success" | "failure" | "partial" | null,
          knowledge_feedback_notes: form.knowledge_feedback_notes || null,
          photos,
          battery_log_file: form.battery_path
            ? {
                file_path: form.battery_path,
                original_name: form.battery_name || null,
                file_size: form.battery_size ? Number(form.battery_size) : null,
              }
            : null,
        },
      });
      toast.success("تم إرسال التقرير الميداني بنجاح");
      localStorage.removeItem(draftKey);
      queryClient.invalidateQueries({ queryKey: ["field-task", assignmentId] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إرسال التقرير");
    }
  };

  return (
    <AppShell roles={roles} title="مهمة ميدانية - الجوال">
      <div className="space-y-3 px-1 pb-4" dir="rtl">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">حالة الاتصال</CardTitle></CardHeader>
          <CardContent>
            {isOnline ? <Badge>متصل - يمكنك الإرسال الآن</Badge> : <Badge variant="secondary">غير متصل - سيتم حفظ المسودة محلياً</Badge>}
            <p className="mt-2 text-xs text-muted-foreground">يتم حفظ المدخلات تلقائيًا على هذا الجهاز حتى لا تفقد التقرير عند ضعف الشبكة.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">بيانات الزيارة</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>العميل: {isLoading ? "..." : data?.customer?.name ?? "—"}</p>
            <p>الهاتف: {data?.customer?.phone ?? "—"}</p>
            <p>الموقع: {data?.customer?.address ?? "—"}</p>
            <p>النظام: {data?.system?.system_name ?? "—"}</p>
            <p>إحداثيات: {data?.customer?.location_coordinates ?? "—"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">مكوّنات النظام + السجل السابق</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(data?.installed_components ?? []).map((item) => <p key={item.id}>• {item.product_model} × {item.quantity}</p>)}
            {(data?.installed_components ?? []).length === 0 && <p className="text-muted-foreground">لا توجد مكونات.</p>}
            <hr className="my-2" />
            {(data?.previous_tickets ?? []).slice(0, 3).map((item) => <p key={item.id}>تذكرة #{item.id.slice(0, 8)} - {item.status}</p>)}
            {(data?.previous_tickets ?? []).length === 0 && <p className="text-muted-foreground">لا توجد تذاكر سابقة.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">إجراءات المهمة</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="secondary" onClick={() => setForm((p) => ({ ...p, status: "in_progress" }))}>بدء المهمة</Button>
              <Select value={form.status} onValueChange={(value) => setForm((p) => ({ ...p, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="in_progress">قيد التنفيذ</SelectItem><SelectItem value="completed">مكتملة</SelectItem><SelectItem value="cancelled">ملغاة</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>ما تم إنجازه</Label><Textarea value={form.work_done} onChange={(e) => setForm((p) => ({ ...p, work_done: e.target.value }))} /></div>
            <div className="space-y-2"><Label>الصعوبات</Label><Textarea value={form.difficulties} onChange={(e) => setForm((p) => ({ ...p, difficulties: e.target.value }))} /></div>
            <div className="space-y-2"><Label>التوصيات</Label><Textarea value={form.recommendations} onChange={(e) => setForm((p) => ({ ...p, recommendations: e.target.value }))} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">رفع الصور وملف البطارية</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-2">
              <Input placeholder="مسار الصورة (example: mobile/photo-1.jpg)" value={form.photo_path} onChange={(e) => setForm((p) => ({ ...p, photo_path: e.target.value }))} />
              <Input placeholder="اسم الصورة" value={form.photo_name} onChange={(e) => setForm((p) => ({ ...p, photo_name: e.target.value }))} />
              <Input placeholder="حجم الصورة بالبايت" value={form.photo_size} onChange={(e) => setForm((p) => ({ ...p, photo_size: e.target.value }))} />
              <Button type="button" variant="outline" onClick={addPhoto}>إضافة صورة</Button>
            </div>
            {photos.map((photo, idx) => (
              <div key={`${photo.file_path}-${idx}`} className="rounded border p-2 text-xs flex items-center justify-between">
                <span>{photo.original_name ?? photo.file_path}</span>
                <Button size="sm" variant="outline" type="button" onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}>حذف</Button>
              </div>
            ))}
            <hr />
            <Input placeholder="ملف البطارية (example: logs/battery-1.csv)" value={form.battery_path} onChange={(e) => setForm((p) => ({ ...p, battery_path: e.target.value }))} />
            <Input placeholder="اسم ملف البطارية" value={form.battery_name} onChange={(e) => setForm((p) => ({ ...p, battery_name: e.target.value }))} />
            <Input placeholder="حجم ملف البطارية" value={form.battery_size} onChange={(e) => setForm((p) => ({ ...p, battery_size: e.target.value }))} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">تقييم المعرفة</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Select value={form.knowledge_base_id || "none"} onValueChange={(value) => setForm((p) => ({ ...p, knowledge_base_id: value === "none" ? "" : value }))}><SelectTrigger><SelectValue placeholder="مقال المعرفة" /></SelectTrigger><SelectContent><SelectItem value="none">بدون</SelectItem>{(data?.knowledge_articles ?? []).map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}</SelectContent></Select>
            <Select value={form.knowledge_feedback_rating || "none"} onValueChange={(value) => setForm((p) => ({ ...p, knowledge_feedback_rating: value === "none" ? "" : value }))}><SelectTrigger><SelectValue placeholder="نتيجة الحل" /></SelectTrigger><SelectContent><SelectItem value="none">بدون تقييم</SelectItem><SelectItem value="success">ناجح</SelectItem><SelectItem value="partial">جزئي</SelectItem><SelectItem value="failure">فاشل</SelectItem></SelectContent></Select>
            <Textarea placeholder="ملاحظات تقييم المعرفة" value={form.knowledge_feedback_notes} onChange={(e) => setForm((p) => ({ ...p, knowledge_feedback_notes: e.target.value }))} />
          </CardContent>
        </Card>

        <Button className="w-full" onClick={submit} disabled={!canSubmit}>إرسال التقرير النهائي</Button>
      </div>
    </AppShell>
  );
}