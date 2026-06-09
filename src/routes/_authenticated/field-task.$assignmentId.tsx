import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAccessContext } from "@/hooks/use-access-context";
import { supabase } from "@/integrations/supabase/client";
import { requireRole } from "@/lib/auth-client";
import { getAssignmentDetailsBundle, submitAssignmentFieldReportWorkflow } from "@/lib/phase2.functions";

export const Route = createFileRoute("/_authenticated/field-task/$assignmentId")({
  beforeLoad: async () => {
    await requireRole(["support_engineer", "field_engineer"]);
  },
  component: FieldTaskPage,
});

type FieldReportPayload = {
  assignment_id: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  work_done: string | null;
  difficulties: string | null;
  recommendations: string | null;
  knowledge_base_id: string | null;
  knowledge_feedback_rating: "success" | "failure" | "partial" | null;
  knowledge_feedback_notes: string | null;
  photos: Array<{ file_path: string; original_name: string | null; file_size: number | null }>;
  battery_log_file:
    | {
        file_path: string;
        original_name: string | null;
        file_size: number | null;
      }
    | null;
};

type QueuedFieldReport = {
  queue_id: string;
  assignment_id: string;
  created_at: string;
  payload: FieldReportPayload;
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function compressImageForMobile(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= 1.2 * 1024 * 1024) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const maxWidth = 1600;
  const scale = Math.min(1, maxWidth / bitmap.width);
  const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
  const targetHeight = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.8);
  });

  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

function FieldTaskPage() {
  const { assignmentId } = Route.useParams();
  const queryClient = useQueryClient();
  const detailsFn = useServerFn(getAssignmentDetailsBundle);
  const submitFn = useServerFn(submitAssignmentFieldReportWorkflow);
  const { data: accessData } = useAccessContext();
  const roles = accessData?.roles ?? [];

  const draftKey = `field-task-draft:${assignmentId}`;
  const taskCacheKey = `field-task-cache:${assignmentId}`;
  const queueKey = "field-report-queue:v1";
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const [cachedBundle, setCachedBundle] = useState<any | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState<string | null>(null);
  const [selectedImageFiles, setSelectedImageFiles] = useState<File[]>([]);
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

  const detailsQuery = useQuery({
    queryKey: ["field-task", assignmentId],
    queryFn: () => detailsFn({ data: { assignment_id: assignmentId } }),
    retry: 1,
  });

  const data = detailsQuery.data ?? cachedBundle;
  const isLoading = detailsQuery.isLoading && !cachedBundle;

  const readQueue = () => {
    try {
      const raw = localStorage.getItem(queueKey);
      const parsed = raw ? (JSON.parse(raw) as QueuedFieldReport[]) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writeQueue = (items: QueuedFieldReport[]) => {
    localStorage.setItem(queueKey, JSON.stringify(items));
    setPendingQueueCount(items.length);
  };

  const enqueueReport = (payload: FieldReportPayload) => {
    const current = readQueue();
    const next = [
      ...current,
      {
        queue_id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        assignment_id: assignmentId,
        created_at: new Date().toISOString(),
        payload,
      },
    ];
    writeQueue(next);
    localStorage.removeItem(draftKey);
    setSubmitError(null);
    toast.success("تم حفظ التقرير في طابور الإرسال وسيتم مزامنته تلقائيًا عند عودة الاتصال");
  };

  const syncQueuedReports = async () => {
    if (!navigator.onLine) return;
    const queue = readQueue();
    if (queue.length === 0) return;

    setIsSyncingQueue(true);
    const remaining: QueuedFieldReport[] = [];

    for (const item of queue) {
      try {
        await submitFn({ data: item.payload });
      } catch {
        remaining.push(item);
      }
    }

    writeQueue(remaining);
    setIsSyncingQueue(false);
    if (remaining.length === 0) {
      toast.success("تمت مزامنة جميع التقارير المؤجلة");
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["field-task", assignmentId] });
    }
  };

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
    setPendingQueueCount(readQueue().length);
    const cachedRaw = localStorage.getItem(taskCacheKey);
    if (cachedRaw) {
      try {
        setCachedBundle(JSON.parse(cachedRaw));
      } catch {
      }
    }
  }, [taskCacheKey]);

  useEffect(() => {
    if (detailsQuery.data) {
      localStorage.setItem(taskCacheKey, JSON.stringify(detailsQuery.data));
      setCachedBundle(detailsQuery.data);
    }
  }, [detailsQuery.data, taskCacheKey]);

  useEffect(() => {
    if (isOnline) {
      void syncQueuedReports();
    }
  }, [isOnline]);

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
    setLastSavedAt(new Date().toISOString());
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

  const onPickPhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) {
      setSelectedImageFiles([]);
      return;
    }

    const invalidExt = files.find((file) => !/\.(jpg|jpeg|png|webp)$/i.test(file.name));
    if (invalidExt) {
      toast.error("صيغة الصورة غير مدعومة. استخدم jpg أو png أو webp");
      event.target.value = "";
      return;
    }

    const invalidSize = files.find((file) => file.size > 15 * 1024 * 1024);
    if (invalidSize) {
      toast.error("حجم الصورة كبير جدًا. الحد الأقصى 15MB قبل الضغط");
      event.target.value = "";
      return;
    }

    setSelectedImageFiles(files);
  };

  const uploadSelectedPhotos = async () => {
    if (selectedImageFiles.length === 0) return [] as Array<{ file_path: string; original_name: string | null; file_size: number | null }>;

    const uploaded: Array<{ file_path: string; original_name: string | null; file_size: number | null }> = [];
    setIsUploadingPhotos(true);
    setUploadProgress(3);
    setUploadStatusText("جاري تجهيز الصور للرفع...");

    for (let index = 0; index < selectedImageFiles.length; index += 1) {
      const originalFile = selectedImageFiles[index];
      const compressedFile = await compressImageForMobile(originalFile);
      if (compressedFile.size > MAX_IMAGE_BYTES) {
        throw new Error(`الصورة ${originalFile.name} ما زالت كبيرة بعد الضغط (الحد 5MB)`);
      }

      const safeName = compressedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const targetPath = `assignment/${assignmentId}/photos/${Date.now()}-${index + 1}-${safeName}`;

      let uploadedOk = false;
      let attempts = 0;
      while (!uploadedOk && attempts < 3) {
        attempts += 1;
        const { error } = await supabase.storage.from("field-attachments").upload(targetPath, compressedFile, {
          upsert: false,
          contentType: compressedFile.type || undefined,
        });

        if (!error) {
          uploadedOk = true;
          uploaded.push({
            file_path: targetPath,
            original_name: originalFile.name,
            file_size: compressedFile.size,
          });
          const completedRatio = (index + 1) / selectedImageFiles.length;
          setUploadProgress(Math.round(5 + completedRatio * 95));
          setUploadStatusText(`تم رفع ${index + 1} من ${selectedImageFiles.length} صورة`);
        } else if (attempts < 3) {
          setUploadStatusText(`تعثر رفع ${originalFile.name}، إعادة المحاولة (${attempts}/2)...`);
          await wait(700 * attempts);
        } else {
          throw new Error(`فشل رفع ${originalFile.name} بعد 3 محاولات`);
        }
      }
    }

    setUploadProgress(100);
    setUploadStatusText("اكتمل رفع الصور");
    return uploaded;
  };

  const canSubmit = useMemo(() => {
    if (form.status === "completed") return form.work_done.trim().length >= 10;
    if (form.knowledge_feedback_rating && !form.knowledge_base_id) return false;
    return true;
  }, [form.status, form.work_done, form.knowledge_feedback_rating, form.knowledge_base_id]);

  const buildPayload = (): FieldReportPayload => ({
    assignment_id: assignmentId,
    status: form.status as "pending" | "in_progress" | "completed" | "cancelled",
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
  });

  const submit = async () => {
    setSubmitError(null);
    if (!canSubmit) {
      if (form.status === "completed" && form.work_done.trim().length < 10) {
        toast.error("يجب كتابة تفاصيل الإنجاز (10 أحرف على الأقل) قبل الإكمال");
      } else {
        toast.error("عند اختيار تقييم المعرفة يجب اختيار المقالة المرتبطة أيضًا");
      }
      return;
    }
    let payload = buildPayload();

    if (!isOnline) {
      if (selectedImageFiles.length > 0) {
        toast.error("رفع الصور يحتاج اتصالاً بالإنترنت، ثم أعد المحاولة");
        return;
      }
      enqueueReport(payload);
      return;
    }

    try {
      if (selectedImageFiles.length > 0) {
        const uploadedPhotos = await uploadSelectedPhotos();
        payload = {
          ...payload,
          photos: [...photos, ...uploadedPhotos],
        };
      }

      await submitFn({ data: payload });
      toast.success("تم إرسال التقرير الميداني بنجاح");
      localStorage.removeItem(draftKey);
      setPhotos(payload.photos);
      setSelectedImageFiles([]);
      setUploadProgress(0);
      setUploadStatusText(null);
      queryClient.invalidateQueries({ queryKey: ["field-task", assignmentId] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر إرسال التقرير";
      setSubmitError(message);
      if (!navigator.onLine || /network|failed|timeout/i.test(message)) {
        enqueueReport(payload);
      } else {
        toast.error(message);
      }
    } finally {
      setIsUploadingPhotos(false);
    }
  };

  return (
    <AppShell roles={roles} title="مهمة ميدانية - الجوال">
      <div className="space-y-3 px-1 pb-4" dir="rtl">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">حالة الاتصال</CardTitle></CardHeader>
          <CardContent>
            {isOnline ? <Badge>متصل - يمكنك الإرسال الآن</Badge> : <Badge variant="secondary">غير متصل - سيتم حفظ التقرير محلياً</Badge>}
            <p className="mt-2 text-xs text-muted-foreground">يتم حفظ المدخلات تلقائيًا على هذا الجهاز حتى لا تفقد التقرير عند ضعف الشبكة.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {lastSavedAt && <span>آخر حفظ: {new Date(lastSavedAt).toLocaleTimeString("ar-EG")}</span>}
              <span>تقارير بانتظار المزامنة: {pendingQueueCount}</span>
              {isSyncingQueue && <span>جاري المزامنة...</span>}
            </div>
            {submitError && <p className="mt-2 text-xs text-destructive">{submitError}</p>}
          </CardContent>
        </Card>

        {detailsQuery.error && !data && (
          <Card>
            <CardContent className="pt-6 text-sm text-destructive">تعذر تحميل المهمة. تأكد من الاتصال أو افتح المهمة لاحقًا بعد التحديث.</CardContent>
          </Card>
        )}

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
            {(data?.installed_components ?? []).map((item: any) => <p key={item.id}>• {item.product_model} × {item.quantity}</p>)}
            {(data?.installed_components ?? []).length === 0 && <p className="text-muted-foreground">لا توجد مكونات مسجلة لهذا النظام.</p>}
            <hr className="my-2" />
            {(data?.previous_tickets ?? []).slice(0, 3).map((item: any) => <p key={item.id}>تذكرة #{item.id.slice(0, 8)} - {item.status}</p>)}
            {(data?.previous_tickets ?? []).length === 0 && <p className="text-muted-foreground">لا توجد تذاكر سابقة.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">إجراءات المهمة</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button type="button" variant="secondary" onClick={() => setForm((p) => ({ ...p, status: "in_progress" }))}>بدء المهمة الآن</Button>
              <Select value={form.status} onValueChange={(value) => setForm((p) => ({ ...p, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">قيد الانتظار</SelectItem><SelectItem value="in_progress">قيد التنفيذ</SelectItem><SelectItem value="completed">مكتملة</SelectItem><SelectItem value="cancelled">ملغاة</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>ما تم إنجازه</Label><Textarea value={form.work_done} onChange={(e) => setForm((p) => ({ ...p, work_done: e.target.value }))} placeholder="اكتب خطوات العمل المنفذة بوضوح" /></div>
            {form.status === "completed" && form.work_done.trim().length < 10 && <p className="text-xs text-destructive">عند الإكمال يجب كتابة تفاصيل لا تقل عن 10 أحرف.</p>}
            <div className="space-y-2"><Label>الصعوبات</Label><Textarea value={form.difficulties} onChange={(e) => setForm((p) => ({ ...p, difficulties: e.target.value }))} /></div>
            <div className="space-y-2"><Label>التوصيات</Label><Textarea value={form.recommendations} onChange={(e) => setForm((p) => ({ ...p, recommendations: e.target.value }))} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">رفع الصور وملف البطارية</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-2">
              <Label htmlFor="field-photos-upload">صور من الجهاز (يتم ضغطها تلقائيًا للموبايل)</Label>
              <Input id="field-photos-upload" type="file" accept=".jpg,.jpeg,.png,.webp" multiple onChange={onPickPhotos} />
              {selectedImageFiles.length > 0 && (
                <p className="text-xs text-muted-foreground">تم اختيار {selectedImageFiles.length} صورة، وسيتم رفعها قبل إرسال التقرير.</p>
              )}
              {isUploadingPhotos && (
                <div className="space-y-2 rounded border p-2">
                  <div className="flex items-center justify-between text-xs">
                    <span>{uploadStatusText ?? "جاري رفع الصور..."}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} />
                </div>
              )}
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
            {form.battery_path && !/\.(csv|log|txt)$/i.test(form.battery_path) && <p className="text-xs text-destructive">ملف البطارية يجب أن يكون csv أو log أو txt.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">تقييم المعرفة</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Select value={form.knowledge_base_id || "none"} onValueChange={(value) => setForm((p) => ({ ...p, knowledge_base_id: value === "none" ? "" : value }))}><SelectTrigger><SelectValue placeholder="مقال المعرفة" /></SelectTrigger><SelectContent><SelectItem value="none">بدون</SelectItem>{(data?.knowledge_articles ?? []).map((item: any) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}</SelectContent></Select>
            <Select value={form.knowledge_feedback_rating || "none"} onValueChange={(value) => setForm((p) => ({ ...p, knowledge_feedback_rating: value === "none" ? "" : value }))}><SelectTrigger><SelectValue placeholder="نتيجة الحل" /></SelectTrigger><SelectContent><SelectItem value="none">بدون تقييم</SelectItem><SelectItem value="success">ناجح</SelectItem><SelectItem value="partial">جزئي</SelectItem><SelectItem value="failure">فاشل</SelectItem></SelectContent></Select>
            <Textarea placeholder="ملاحظات تقييم المعرفة" value={form.knowledge_feedback_notes} onChange={(e) => setForm((p) => ({ ...p, knowledge_feedback_notes: e.target.value }))} />
          </CardContent>
        </Card>

        <div className="sticky bottom-2 z-10 rounded-lg border bg-card/95 p-2 backdrop-blur">
          <Button className="w-full" onClick={submit} disabled={!canSubmit || isSyncingQueue || isUploadingPhotos}>{isUploadingPhotos ? "جاري رفع الصور..." : "إرسال التقرير النهائي"}</Button>
          {!isOnline && <p className="mt-2 text-center text-xs text-muted-foreground">في وضع عدم الاتصال: سيتم حفظ الطلب وإرساله تلقائيًا لاحقًا.</p>}
        </div>
      </div>
    </AppShell>
  );
}