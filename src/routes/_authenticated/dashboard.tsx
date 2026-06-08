import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Boxes, Clock3, ListChecks, ShieldCheck, Ticket, Users, Wrench } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccessContext } from "@/hooks/use-access-context";
import { requireAuthenticatedUser } from "@/lib/auth-client";
import { getDashboardOverview } from "@/lib/phase1.functions";
import { getOperationsReport, listAssignments, listTickets } from "@/lib/phase2.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  beforeLoad: async () => {
    await requireAuthenticatedUser();
  },
  component: DashboardPage,
});

function DashboardPage() {
  const overviewFn = useServerFn(getDashboardOverview);
  const reportFn = useServerFn(getOperationsReport);
  const listAssignmentsFn = useServerFn(listAssignments);
  const listTicketsFn = useServerFn(listTickets);
  const { data: accessData } = useAccessContext();
  const primaryRole = accessData?.primaryRole;
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: () => overviewFn(),
  });

  const { data: operations } = useQuery({
    queryKey: ["dashboard-operations"],
    queryFn: () => reportFn(),
    enabled: primaryRole === "support_engineer" || primaryRole === "manager",
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["dashboard-assignment-list"],
    queryFn: () => listAssignmentsFn(),
    enabled: primaryRole === "field_engineer" || primaryRole === "support_engineer",
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ["dashboard-ticket-list"],
    queryFn: () => listTicketsFn(),
    enabled: primaryRole === "support_engineer",
  });

  const roles = accessData?.roles ?? [];

  if (isLoading) {
    return (
      <AppShell roles={roles} title="لوحة التحكم">
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">جاري تحميل لوحة التحكم...</div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell roles={roles} title="لوحة التحكم">
        <div className="rounded-lg border border-destructive/40 bg-card p-6 text-sm text-destructive">
          تعذر تحميل بيانات لوحة التحكم.
        </div>
      </AppShell>
    );
  }

  const supportCards = [
    { title: "تذاكر جديدة", value: tickets.filter((t) => t.status === "new").length, icon: Ticket },
    { title: "تذاكر مغلقة", value: tickets.filter((t) => t.status === "closed").length, icon: ShieldCheck },
    { title: "قيد التنفيذ", value: tickets.filter((t) => t.status === "in_progress").length, icon: Wrench },
    { title: "مهام متأخرة", value: operations?.delayed ?? 0, icon: Clock3 },
    { title: "مهندسون متاحون", value: data.engineersByAvailability.available, icon: Users },
  ];

  const managerCards = [
    { title: "حالات غير محلولة", value: operations?.unresolved ?? 0, icon: AlertTriangle },
    { title: "مهام متأخرة", value: operations?.delayed ?? 0, icon: Clock3 },
    { title: "إجمالي التذاكر", value: operations?.totalTickets ?? 0, icon: Ticket },
    { title: "إجمالي المهام", value: operations?.totalAssignments ?? 0, icon: ListChecks },
  ];

  const myAssignments = assignments;
  const fieldCards = [
    {
      title: "مهامي اليوم",
      value: myAssignments.filter((item) => {
        if (!item.scheduled_date) return false;
        return new Date(item.scheduled_date).toDateString() === new Date().toDateString();
      }).length,
      icon: Clock3,
    },
    { title: "مهام معلّقة", value: myAssignments.filter((item) => item.status === "pending").length, icon: ListChecks },
    { title: "مهام مكتملة", value: myAssignments.filter((item) => item.status === "completed").length, icon: ShieldCheck },
    { title: "زيارات إصلاح", value: myAssignments.filter((item) => item.assignment_type === "repair_visit").length, icon: Wrench },
  ];

  const engineersState = [
    { label: "متاح", value: data.engineersByAvailability.available },
    { label: "مشغول", value: data.engineersByAvailability.busy },
    { label: "غير نشط", value: data.engineersByAvailability.inactive },
  ];

  const codeCategories = [
    { name: "تقني", value: data.errorCodeByCategory.technical },
    { name: "برمجي", value: data.errorCodeByCategory.software },
  ];

  return (
    <AppShell roles={roles} title="لوحة التحكم">
      <div className="space-y-4">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {(primaryRole === "field_engineer" ? fieldCards : primaryRole === "manager" ? managerCards : supportCards).map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.title}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm font-medium">
                    {card.title}
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-foreground">{card.value}</p>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">توزيع حالة المهندسين</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={engineersState}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="var(--color-primary)" radius={6} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">أنواع رموز الأعطال</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={codeCategories} dataKey="value" nameKey="name" outerRadius={100} fill="var(--color-secondary)" />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {primaryRole === "manager" ? "ملخص المشاكل المتكررة" : "أكثر رموز الأعطال تكرارًا"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(primaryRole === "manager" ? operations?.recurringProblems ?? [] : data.topErrorCodes).length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد بيانات كافية بعد.</p>
              ) : (
                (primaryRole === "manager" ? operations?.recurringProblems ?? [] : data.topErrorCodes).map((item) => (
                  <Badge key={item.code} variant="secondary">
                    {item.code} · {item.count}
                  </Badge>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {primaryRole === "field_engineer" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">وصول سريع للمهام المسندة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {myAssignments.slice(0, 6).map((assignment) => (
                <div key={assignment.id} className="rounded border p-3 text-sm">
                  <p className="font-medium">{assignment.assignment_type === "repair_visit" ? "زيارة إصلاح" : "تركيب جديد"}</p>
                  <p className="text-muted-foreground">الحالة: {assignment.status}</p>
                </div>
              ))}
              {myAssignments.length === 0 && <p className="text-sm text-muted-foreground">لا توجد مهام مسندة حاليًا.</p>}
            </CardContent>
          </Card>
        )}

        {primaryRole === "support_engineer" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">أكثر المنتجات تسببًا بالمشاكل</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {[...data.topErrorCodes].slice(0, 5).map((row) => (
                  <Badge key={row.code} variant="outline">
                    {row.code}
                  </Badge>
                ))}
                {data.topErrorCodes.length === 0 && <p className="text-sm text-muted-foreground">لا توجد بيانات كافية.</p>}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}