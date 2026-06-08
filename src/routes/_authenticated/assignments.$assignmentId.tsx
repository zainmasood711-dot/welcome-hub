import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAccessContext } from "@/hooks/use-access-context";
import { requireRole } from "@/lib/auth-client";
import { getAssignmentDetailsBundle } from "@/lib/phase2.functions";

export const Route = createFileRoute("/_authenticated/assignments/$assignmentId")({
  beforeLoad: async () => {
    await requireRole(["support_engineer", "field_engineer"]);
  },
  component: AssignmentDetailsPage,
});

function AssignmentDetailsPage() {
  const { assignmentId } = Route.useParams();
  const detailsFn = useServerFn(getAssignmentDetailsBundle);
  const { data: accessData } = useAccessContext();
  const roles = accessData?.roles ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ["assignment-details", assignmentId],
    queryFn: () => detailsFn({ data: { assignment_id: assignmentId } }),
  });

  const assignment = data?.assignment;
  const customer = data?.customer;
  const system = data?.system;
  const ticket = data?.ticket;

  return (
    <AppShell roles={roles} title="تفاصيل المهمة الميدانية">
      <div className="space-y-4" dir="rtl">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{isLoading ? "جاري التحميل..." : `مهمة #${assignment?.id.slice(0, 8) ?? "—"}`}</CardTitle>
            {assignment && (
              <Button asChild size="sm">
                <Link to="/_authenticated/field-task/$assignmentId" params={{ assignmentId: assignment.id }}>
                  فتح صفحة التنفيذ الميداني
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded border p-3 text-sm">
              <p className="font-medium">العميل</p>
              <p>{customer?.name ?? "—"}</p>
              <p className="text-muted-foreground">{customer?.phone ?? "—"}</p>
              <p className="text-muted-foreground">{customer?.governorate ?? "—"} / {customer?.city ?? "—"}</p>
            </div>
            <div className="rounded border p-3 text-sm">
              <p className="font-medium">الموقع</p>
              <p className="text-muted-foreground">{customer?.address ?? "غير متوفر"}</p>
              <p className="text-muted-foreground">الإحداثيات: {customer?.location_coordinates ?? "غير متوفر"}</p>
            </div>
            <div className="rounded border p-3 text-sm">
              <p className="font-medium">الحالة</p>
              <Badge>{assignment?.status ?? "—"}</Badge>
              <p className="text-muted-foreground mt-2">المهندس: {data?.engineer?.name ?? "—"}</p>
              <p className="text-muted-foreground">الموعد: {assignment?.scheduled_date ? new Date(assignment.scheduled_date).toLocaleString("ar-EG") : "—"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">النظام والمكونات المركبة</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">{system?.system_name ?? "لا يوجد نظام مرتبط"}</p>
            {system && <p className="text-muted-foreground">الحالة: {system.status}</p>}
            <div className="rounded border">
              <Table>
                <TableHeader><TableRow><TableHead>المكوّن</TableHead><TableHead>الكمية</TableHead><TableHead>الرقم التسلسلي</TableHead><TableHead>الضمان</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(data?.installed_components ?? []).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.product_model}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.serial_number ?? "—"}</TableCell>
                      <TableCell>{item.warranty_status}</TableCell>
                    </TableRow>
                  ))}
                  {(data?.installed_components ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">لا توجد مكونات مرتبطة.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-sm">التذاكر السابقة</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(data?.previous_tickets ?? []).map((item) => (
                <div key={item.id} className="rounded border p-3 text-sm">
                  <p className="font-medium">#{item.id.slice(0, 8)} · {item.priority}</p>
                  <p className="text-muted-foreground line-clamp-2">{item.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(item.created_at).toLocaleDateString("ar-EG")}</p>
                </div>
              ))}
              {(data?.previous_tickets ?? []).length === 0 && <p className="text-sm text-muted-foreground">لا توجد تذاكر سابقة.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">الحلول السابقة</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(data?.previous_solutions ?? []).map((item) => (
                <div key={item.ticket_id} className="rounded border p-3 text-sm">
                  <p className="font-medium">تذكرة #{item.ticket_id.slice(0, 8)}</p>
                  <p className="text-muted-foreground">التقييم: {item.feedback?.rating ?? "لا يوجد"}</p>
                  <p className="text-muted-foreground">ملاحظات: {item.feedback?.notes ?? "—"}</p>
                </div>
              ))}
              {(data?.previous_solutions ?? []).length === 0 && <p className="text-sm text-muted-foreground">لا توجد حلول موثقة.</p>}
            </CardContent>
          </Card>
        </div>

        {ticket && (
          <Card>
            <CardHeader><CardTitle className="text-sm">التذكرة المرتبطة</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <p><span className="font-medium">الحالة:</span> {ticket.status}</p>
              <p><span className="font-medium">الأولوية:</span> {ticket.priority}</p>
              <p><span className="font-medium">الوصف:</span> {ticket.description}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}