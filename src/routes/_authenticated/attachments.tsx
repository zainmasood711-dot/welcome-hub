import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { requireRole } from "@/lib/auth-client";
import { getPhase2References, listAttachments, saveAttachmentMeta } from "@/lib/phase2.functions";
import { hasAnyPermission } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/attachments")({
  beforeLoad: async () => {
    await requireRole(["support_engineer", "field_engineer"]);
  },
  component: AttachmentsPage,
});

function AttachmentsPage() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listAttachments);
  const saveFn = useServerFn(saveAttachmentMeta);
  const refsFn = useServerFn(getPhase2References);

  const { data: accessData } = useAccessContext();
  const roles = accessData?.roles ?? [];
  const canManage = hasAnyPermission(roles, ["attachments.manage", "attachments.read_assigned"]);

  const { data: refs } = useQuery({ queryKey: ["phase2-refs"], queryFn: () => refsFn() });
  const { data: attachments = [] } = useQuery({ queryKey: ["attachments"], queryFn: () => listFn() });

  const [open, setOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [form, setForm] = useState({ id: "", attachable_type: "ticket", attachable_id: "", file_type: "document", file_path: "", original_name: "", file_size: "", description: "" });

  const maxImageBytes = 5 * 1024 * 1024;
  const maxFileBytes = 20 * 1024 * 1024;
  const imageExts = new Set(["jpg", "jpeg", "png", "webp"]);
  const documentExts = new Set(["pdf", "csv", "xlsx", "xls", "txt"]);
  const batteryExts = new Set(["log", "csv", "txt"]);

  const getExtension = (name: string) => name.trim().toLowerCase().split(".").pop() ?? "";

  const getAllowedExtsByType = (fileType: string) => {
    if (fileType === "image") return imageExts;
    if (fileType === "battery_file") return batteryExts;
    return documentExts;
  };

  const attachableOptions = useMemo(() => {
    if (form.attachable_type === "ticket") {
      return refs?.tickets.map((t) => ({ id: t.id, label: `تذكرة ${t.id.slice(0, 8)} - ${t.status}` })) ?? [];
    }

    if (form.attachable_type === "assignment") {
      return refs?.assignments.map((a) => ({ id: a.id, label: `مهمة ${a.id.slice(0, 8)} - ${a.status}` })) ?? [];
    }

    return refs?.knowledge.map((k) => ({ id: k.id, label: k.title })) ?? [];
  }, [form.attachable_type, refs?.assignments, refs?.knowledge, refs?.tickets]);

  const onSelectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) {
      setSelectedFiles([]);
      return;
    }

    const allowedExts = getAllowedExtsByType(form.file_type);
    const invalidType = files.find((file) => !allowedExts.has(getExtension(file.name)));
    if (invalidType) {
      toast.error("امتداد الملف غير مسموح لنوع المرفق المختار");
      event.target.value = "";
      setSelectedFiles([]);
      return;
    }

    const invalidSize = files.find((file) => {
      if (form.file_type === "image") return file.size > maxImageBytes;
      return file.size > maxFileBytes;
    });
    if (invalidSize) {
      toast.error(form.file_type === "image" ? "حجم الصورة يتجاوز 5MB" : "حجم الملف يتجاوز 20MB");
      event.target.value = "";
      setSelectedFiles([]);
      return;
    }

    setSelectedFiles(files);
    if (files.length === 1) {
      setForm((prev) => ({
        ...prev,
        original_name: files[0].name,
        file_size: String(files[0].size),
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        original_name: "",
        file_size: "",
      }));
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      if (!form.attachable_id) {
        throw new Error("اختر العنصر المرتبط أولاً");
      }

      const filesToUpload = selectedFiles;
      if (filesToUpload.length > 1 && form.id) {
        throw new Error("لا يمكن رفع عدة ملفات أثناء تعديل سجل موجود");
      }

      if (filesToUpload.length > 0) {
        for (const file of filesToUpload) {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const generatedPath = `${form.attachable_type}/${form.attachable_id}/${Date.now()}-${safeName}`;
          const { error: uploadError } = await supabase.storage.from("field-attachments").upload(generatedPath, file, {
            upsert: false,
            contentType: file.type || undefined,
          });
          if (uploadError) throw new Error(uploadError.message);

          await saveFn({
            data: {
              attachable_type: form.attachable_type as "ticket" | "assignment" | "knowledge_base",
              attachable_id: form.attachable_id,
              file_type: form.file_type as "image" | "battery_file" | "document",
              file_path: generatedPath,
              original_name: file.name,
              file_size: file.size,
              description: form.description || null,
            },
          });
        }
      } else {
        await saveFn({
          data: {
            id: form.id || undefined,
            attachable_type: form.attachable_type as "ticket" | "assignment" | "knowledge_base",
            attachable_id: form.attachable_id,
            file_type: form.file_type as "image" | "battery_file" | "document",
            file_path: form.file_path,
            original_name: form.original_name || null,
            file_size: form.file_size ? Number(form.file_size) : null,
            description: form.description || null,
          },
        });
      }
      toast.success("تم حفظ بيانات المرفق");
      setOpen(false);
      setSelectedFiles([]);
      setForm({ id: "", attachable_type: "ticket", attachable_id: "", file_type: "document", file_path: "", original_name: "", file_size: "", description: "" });
      queryClient.invalidateQueries({ queryKey: ["attachments"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ المرفق");
    }
  };

  return (
    <AppShell roles={roles} title="المرفقات والملفات">
      <div className="space-y-4">
        {canManage && <Button onClick={() => setOpen(true)}>إضافة مرفق</Button>}
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>النوع المرتبط</TableHead><TableHead>نوع الملف</TableHead><TableHead>المسار</TableHead><TableHead>الاسم الأصلي</TableHead>{canManage && <TableHead className="text-left">إجراء</TableHead>}</TableRow></TableHeader>
            <TableBody>
              {attachments.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.attachable_type}</TableCell>
                  <TableCell>{item.file_type}</TableCell>
                  <TableCell className="max-w-[360px] truncate">{item.file_path}</TableCell>
                  <TableCell>{item.original_name ?? "—"}</TableCell>
                  {canManage && <TableCell className="text-left"><Button variant="outline" size="sm" onClick={() => { setForm({ id: item.id, attachable_type: item.attachable_type, attachable_id: item.attachable_id, file_type: item.file_type, file_path: item.file_path, original_name: item.original_name ?? "", file_size: item.file_size ? String(item.file_size) : "", description: item.description ?? "" }); setOpen(true); }}>تعديل</Button></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{form.id ? "تعديل مرفق" : "إضافة مرفق"}</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={submit}>
            <div className="space-y-2"><Label>نوع الارتباط</Label><Select value={form.attachable_type} onValueChange={(v) => setForm((p) => ({ ...p, attachable_type: v, attachable_id: "" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ticket">تذكرة</SelectItem><SelectItem value="assignment">مهمة</SelectItem><SelectItem value="knowledge_base">قاعدة معرفة</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>العنصر المرتبط</Label><Select value={form.attachable_id} onValueChange={(v) => setForm((p) => ({ ...p, attachable_id: v }))}><SelectTrigger><SelectValue placeholder="اختر عنصر" /></SelectTrigger><SelectContent>{attachableOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>نوع الملف</Label><Select value={form.file_type} onValueChange={(v) => setForm((p) => ({ ...p, file_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="document">مستند</SelectItem><SelectItem value="image">صورة</SelectItem><SelectItem value="battery_file">ملف بطارية</SelectItem></SelectContent></Select></div>
            <div className="space-y-2">
              <Label>رفع ملف</Label>
              <Input
                type="file"
                onChange={onSelectFile}
                multiple={form.file_type === "image"}
                accept={
                  form.file_type === "image"
                    ? ".jpg,.jpeg,.png,.webp"
                    : form.file_type === "battery_file"
                      ? ".log,.csv,.txt"
                      : ".pdf,.csv,.xlsx,.xls,.txt"
                }
              />
              <p className="text-xs text-muted-foreground">الصور حتى 5MB لكل ملف، وباقي الملفات حتى 20MB. الرفع المتعدد متاح للصور فقط.</p>
            </div>
            <div className="space-y-2"><Label>المسار داخل التخزين</Label><Input value={form.file_path} onChange={(e) => setForm((p) => ({ ...p, file_path: e.target.value }))} placeholder="assignment/<id>/file.pdf" /></div>
            <div className="space-y-2"><Label>الاسم الأصلي</Label><Input value={form.original_name} onChange={(e) => setForm((p) => ({ ...p, original_name: e.target.value }))} /></div>
            <div className="space-y-2"><Label>الحجم بالبايت</Label><Input type="number" min={0} value={form.file_size} onChange={(e) => setForm((p) => ({ ...p, file_size: e.target.value }))} /></div>
            <div className="space-y-2"><Label>وصف</Label><Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
            <div className="flex justify-start gap-2"><Button type="submit">حفظ</Button><Button type="button" variant="outline" onClick={() => setOpen(false)}>إلغاء</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}