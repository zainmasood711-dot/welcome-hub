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
import { createNotification, listNotifications, markNotificationRead } from "@/lib/phase2.functions";
import { hasAnyPermission } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/notifications")({
  beforeLoad: async () => {
    await requireRole(["support_engineer", "field_engineer"]);
  },
  component: NotificationsPage,
});

function NotificationsPage() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listNotifications);
  const createFn = useServerFn(createNotification);
  const readFn = useServerFn(markNotificationRead);
  const { data: accessData } = useAccessContext();
  const roles = accessData?.roles ?? [];
  const canManage = hasAnyPermission(roles, ["notifications.manage"]);

  const { data: notifications = [] } = useQuery({ queryKey: ["notifications"], queryFn: () => listFn() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", type: "info", target_role: "" });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await createFn({
        data: {
          title: form.title,
          body: form.body,
          type: form.type,
          target_role: (form.target_role || null) as "support_engineer" | "field_engineer" | "manager" | null,
          target_user_id: null,
          related_type: null,
          related_id: null,
        },
      });
      toast.success("تم إنشاء إشعار داخلي");
      setOpen(false);
      setForm({ title: "", body: "", type: "info", target_role: "" });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إنشاء الإشعار");
    }
  };

  return (
    <AppShell roles={roles} title="مركز الإشعارات الداخلي">
      <div className="space-y-4">
        {canManage && <Button onClick={() => setOpen(true)}>إرسال إشعار</Button>}
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>العنوان</TableHead><TableHead>الرسالة</TableHead><TableHead>النوع</TableHead><TableHead>الحالة</TableHead><TableHead className="text-left">إجراء</TableHead></TableRow></TableHeader>
            <TableBody>
              {notifications.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.title}</TableCell>
                  <TableCell className="max-w-[460px] truncate">{item.body}</TableCell>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>{item.is_read ? "مقروء" : "غير مقروء"}</TableCell>
                  <TableCell className="text-left">
                    {!item.is_read && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            await readFn({ data: { notification_id: item.id } });
                            queryClient.invalidateQueries({ queryKey: ["notifications"] });
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "تعذر تحديث الحالة");
                          }
                        }}
                      >
                        تعليم كمقروء
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>إشعار داخلي جديد</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={submit}>
            <div className="space-y-2"><Label>العنوان</Label><Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required /></div>
            <div className="space-y-2"><Label>المحتوى</Label><Textarea value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} required /></div>
            <div className="space-y-2"><Label>النوع</Label><Input value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} placeholder="info/warning/urgent" /></div>
            <div className="space-y-2"><Label>الدور المستهدف (اختياري)</Label><Select value={form.target_role || "all"} onValueChange={(v) => setForm((p) => ({ ...p, target_role: v === "all" ? "" : v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">الكل</SelectItem><SelectItem value="support_engineer">مهندس دعم</SelectItem><SelectItem value="field_engineer">مهندس ميداني</SelectItem><SelectItem value="manager">مدير</SelectItem></SelectContent></Select></div>
            <div className="flex justify-start gap-2"><Button type="submit">إرسال</Button><Button type="button" variant="outline" onClick={() => setOpen(false)}>إلغاء</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}