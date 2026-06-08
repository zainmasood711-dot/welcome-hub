import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Clock3, ListChecks, ShieldCheck, Ticket, Users, Wrench } from "lucide-react";
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
    { title: "تذاكر مفتوحة", value: operations?.ticketSummary.open ?? tickets.filter((t) => t.status === "new").length, icon: Ticket },
    { title: "مغلقة", value: operations?.ticketSummary.closed ?? tickets.filter((t) => t.status === "closed").length, icon: ShieldCheck },
    { title: "قيد التنفيذ", value: tickets.filter((t) => t.status === "in_progress").length, icon: Wrench },
    { title: "إحالات", value: operations?.ticketSummary.assigned ?? tickets.filter((t) => t.status === "assigned_field").length, icon: ListChecks },
    { title: "مهام متأخرة", value: operations?.assignmentSummary.overdue ?? operations?.delayed ?? 0, icon: Clock3 },
    { title: "مهندسون متاحون", value: data.engineersByAvailability.available, icon: Users },
  ];

  const managerCards = [
    { title: "تذاكر مفتوحة", value: operations?.ticketSummary.open ?? 0, icon: AlertTriangle },
    { title: "قيد التنفيذ", value: operations?.ticketSummary.in_progress ?? 0, icon: Wrench },
    { title: "محلولة عن بعد", value: operations?.ticketSummary.resolved_remote ?? 0, icon: ShieldCheck },
    { title: "إسناد ميداني", value: operations?.ticketSummary.assigned ?? 0, icon: ListChecks },
    { title: "مغلقة", value: operations?.ticketSummary.closed ?? 0, icon: Ticket },
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
              <CardTitle className="text-base">ملخص حالات التذاكر</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { label: "مفتوحة", value: operations?.ticketSummary.open ?? 0 },
                  { label: "قيد التنفيذ", value: operations?.ticketSummary.in_progress ?? 0 },
                  { label: "عن بعد", value: operations?.ticketSummary.resolved_remote ?? 0 },
                  { label: "مُسندة", value: operations?.ticketSummary.assigned ?? 0 },
                  { label: "مغلقة", value: operations?.ticketSummary.closed ?? 0 },
                ]}>
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
              <CardTitle className="text-base">ملخص حالات المهام</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Pending", value: operations?.assignmentSummary.pending ?? 0 },
                      { name: "In Progress", value: operations?.assignmentSummary.in_progress ?? 0 },
                      { name: "Completed", value: operations?.assignmentSummary.completed ?? 0 },
                      { name: "Overdue", value: operations?.assignmentSummary.overdue ?? 0 },
                    ]}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={100}
                    fill="var(--color-secondary)"
                  />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">أكثر أكواد الأعطال تكرارًا</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(operations?.commonErrorCodes ?? (primaryRole === "manager" ? operations?.recurringProblems ?? [] : data.topErrorCodes)).length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد بيانات كافية بعد.</p>
              ) : (
                (operations?.commonErrorCodes ?? (primaryRole === "manager" ? operations?.recurringProblems ?? [] : data.topErrorCodes)).map((item) => (
                  <Badge key={item.code} variant="secondary">
                    {item.code} · {item.count}
                  </Badge>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">المنتجات الأكثر تكرارًا بالأعطال</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(operations?.problematicProducts ?? []).slice(0, 6).map((item) => (
                <div key={item.product_id} className="flex items-center justify-between rounded border p-2 text-sm">
                  <span>{item.model}</span>
                  <Badge variant="outline">{item.totalIssues}</Badge>
                </div>
              ))}
              {(operations?.problematicProducts?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">لا توجد بيانات كافية.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">استخدام قاعدة المعرفة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="mb-2 text-sm font-medium">الأكثر استخدامًا</p>
                <div className="space-y-1">
                  {(operations?.knowledgeBaseUsage?.mostUsedArticles ?? []).slice(0, 4).map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded border p-2 text-xs">
                      <span className="truncate">{item.title}</span>
                      <Badge variant="secondary">{item.usage_count}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">الأعلى نجاحًا</p>
                <div className="space-y-1">
                  {(operations?.knowledgeBaseUsage?.highestSuccessArticles ?? []).slice(0, 4).map((item) => (
                    <div key={`${item.id}-success`} className="flex items-center justify-between rounded border p-2 text-xs">
                      <span className="truncate">{item.title}</span>
                      <Badge variant="outline">{item.effectiveness_rate}%</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

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

        {primaryRole !== "field_engineer" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">أداء المهندسين (إنجاز/تأخير)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(operations?.engineerPerformance ?? []).slice(0, 6).map((engineer) => (
                <div key={engineer.engineer_id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 rounded border p-2 text-xs">
                  <span className="truncate">{engineer.engineer_name}</span>
                  <Badge variant="secondary">مكتمل {engineer.completed}</Badge>
                  <Badge variant="outline">متأخر {engineer.delayed ?? 0}</Badge>
                  <Badge>{engineer.completion_rate ?? 0}%</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}