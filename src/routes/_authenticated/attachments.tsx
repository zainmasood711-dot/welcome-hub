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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [form, setForm] = useState({ id: "", attachable_type: "ticket", attachable_id: "", file_type: "document", file_path: "", original_name: "", file_size: "", description: "" });

  const maxBytes = 20 * 1024 * 1024;

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
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (file.size > maxBytes) {
      toast.error("حجم الملف يتجاوز 20MB");
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
    setForm((prev) => ({
      ...prev,
      original_name: file.name,
      file_size: String(file.size),
    }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      let filePath = form.file_path;

      if (selectedFile) {
        const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const generatedPath = `${form.attachable_type}/${form.attachable_id}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from("field-attachments").upload(generatedPath, selectedFile, {
          upsert: false,
          contentType: selectedFile.type || undefined,
        });
        if (uploadError) throw new Error(uploadError.message);
        filePath = generatedPath;
      }

      await saveFn({
        data: {
          id: form.id || undefined,
          attachable_type: form.attachable_type as "ticket" | "assignment" | "knowledge_base",
          attachable_id: form.attachable_id,
          file_type: form.file_type as "image" | "battery_file" | "document",
          file_path: filePath,
          original_name: form.original_name || null,
          file_size: form.file_size ? Number(form.file_size) : null,
          description: form.description || null,
        },
      });
      toast.success("تم حفظ بيانات المرفق");
      setOpen(false);
      setSelectedFile(null);
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
              <Input type="file" onChange={onSelectFile} accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.bin" />
              <p className="text-xs text-muted-foreground">الحد الأقصى 20MB. يمكنك أيضًا إدخال مسار ملف موجود مسبقًا.</p>
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