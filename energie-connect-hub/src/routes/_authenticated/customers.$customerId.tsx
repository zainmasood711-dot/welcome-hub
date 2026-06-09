import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccessContext } from "@/hooks/use-access-context";
import { requireRole } from "@/lib/auth-client";
import { formatDate } from "@/lib/format";
import { getCustomerDetailsBundle } from "@/lib/phase2.functions";

export const Route = createFileRoute("/_authenticated/customers/$customerId")({
  beforeLoad: async () => {
    await requireRole(["support_engineer", "field_engineer"]);
  },
  component: CustomerDetailsPage,
});

function CustomerDetailsPage() {
  const { customerId } = Route.useParams();
  const detailsFn = useServerFn(getCustomerDetailsBundle);
  const { data: accessData } = useAccessContext();
  const roles = accessData?.roles ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ["customer-details", customerId],
    queryFn: () => detailsFn({ data: { customer_id: customerId } }),
  });

  const customer = data?.customer;
  const systems = data?.systems ?? [];
  const tickets = data?.tickets ?? [];
  const attachments = data?.attachments ?? [];

  const statusBadge = (status: string) => {
    if (status === "closed") return <Badge>مغلقة</Badge>;
    if (status === "resolved_remote") return <Badge variant="secondary">حُلّت عن بُعد</Badge>;
    if (status === "in_progress") return <Badge variant="outline">قيد التنفيذ</Badge>;
    if (status === "assigned_field") return <Badge variant="secondary">مُحالة للميدان</Badge>;
    return <Badge variant="destructive">جديدة</Badge>;
  };

  return (
    <AppShell roles={roles} title="تفاصيل العميل">
      <div className="space-y-4" dir="rtl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{isLoading ? "جاري التحميل..." : `ملف العميل: ${customer?.name ?? "—"}`}</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview">
              <TabsList className="grid w-full grid-cols-2 gap-2 md:grid-cols-4">
                <TabsTrigger value="overview">overview</TabsTrigger>
                <TabsTrigger value="systems">systems</TabsTrigger>
                <TabsTrigger value="tickets">tickets</TabsTrigger>
                <TabsTrigger value="attachments">attachments</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4">
                <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                  <div className="rounded-lg border p-3">الاسم: {customer?.name ?? "—"}</div>
                  <div className="rounded-lg border p-3">الهاتف: {customer?.phone ?? "—"}</div>
                  <div className="rounded-lg border p-3">المحافظة: {customer?.governorate ?? "—"}</div>
                  <div className="rounded-lg border p-3">المدينة: {customer?.city ?? "—"}</div>
                  <div className="rounded-lg border p-3 md:col-span-2">العنوان: {customer?.address ?? "—"}</div>
                  <div className="rounded-lg border p-3 md:col-span-2">ملاحظات: {customer?.notes ?? "—"}</div>
                </div>
              </TabsContent>

              <TabsContent value="systems" className="mt-4">
                <div className="space-y-2">
                  {systems.map((item) => (
                    <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                      <div>
                        <p className="font-medium">{item.system_name}</p>
                        <p className="text-muted-foreground">تاريخ التركيب: {item.installation_date ?? "—"}</p>
                      </div>
                      {item.status === "active" ? <Badge>نشط</Badge> : <Badge variant="secondary">غير نشط</Badge>}
                    </div>
                  ))}
                  {systems.length === 0 && <p className="text-sm text-muted-foreground">لا توجد أنظمة مرتبطة.</p>}
                </div>
              </TabsContent>

              <TabsContent value="tickets" className="mt-4">
                <div className="space-y-2">
                  {tickets.map((item) => (
                    <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                      <div>
                        <p className="font-medium">#{item.id.slice(0, 8)} · {item.priority}</p>
                        <p className="text-muted-foreground">{item.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {statusBadge(item.status)}
                        <Badge variant="outline">{formatDate(item.created_at)}</Badge>
                      </div>
                    </div>
                  ))}
                  {tickets.length === 0 && <p className="text-sm text-muted-foreground">لا توجد تذاكر مرتبطة.</p>}
                </div>
              </TabsContent>

              <TabsContent value="attachments" className="mt-4">
                <div className="space-y-2">
                  {attachments.map((item) => (
                    <div key={item.id} className="rounded-lg border p-3 text-sm">
                      <p className="font-medium">{item.original_name ?? item.file_path}</p>
                      <p className="text-muted-foreground">النوع: {item.file_type} · {formatDate(item.created_at)}</p>
                    </div>
                  ))}
                  {attachments.length === 0 && <p className="text-sm text-muted-foreground">لا توجد مرفقات مرتبطة.</p>}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}