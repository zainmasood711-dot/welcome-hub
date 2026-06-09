import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccessContext } from "@/hooks/use-access-context";
import { requireRole } from "@/lib/auth-client";
import { getOperationsReport } from "@/lib/phase2.functions";

export const Route = createFileRoute("/_authenticated/reports/open-ticket-status")({
  beforeLoad: async () => {
    await requireRole(["support_engineer", "manager"]);
  },
  component: OpenTicketStatusReportPage,
});

function OpenTicketStatusReportPage() {
  const reportFn = useServerFn(getOperationsReport);
  const { data: accessData } = useAccessContext();
  const roles = accessData?.roles ?? [];
  const { data, isLoading, error } = useQuery({ queryKey: ["report-open-ticket-status"], queryFn: () => reportFn() });

  const chartData = [
    { name: "جديدة", value: data?.ticketSummary?.open ?? 0, color: "var(--color-primary)" },
    { name: "قيد التنفيذ", value: data?.ticketSummary?.in_progress ?? 0, color: "var(--color-secondary)" },
    { name: "مُسندة ميدانيًا", value: data?.ticketSummary?.assigned ?? 0, color: "var(--color-accent)" },
  ];

  if (isLoading) {
    return (
      <AppShell roles={roles} title="تقرير حالات التذاكر المفتوحة">
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">جاري تحميل التقرير...</div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell roles={roles} title="تقرير حالات التذاكر المفتوحة">
        <div className="rounded-lg border border-destructive/40 bg-card p-6 text-sm text-destructive">تعذر تحميل التقرير.</div>
      </AppShell>
    );
  }

  return (
    <AppShell roles={roles} title="تقرير حالات التذاكر المفتوحة">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">توزيع التذاكر المفتوحة</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={120}>
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">ملخص الحالات</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded border p-3">جديدة: <span className="font-semibold">{data.ticketSummary.open}</span></div>
            <div className="rounded border p-3">قيد التنفيذ: <span className="font-semibold">{data.ticketSummary.in_progress}</span></div>
            <div className="rounded border p-3">مُسندة ميدانيًا: <span className="font-semibold">{data.ticketSummary.assigned}</span></div>
            <div className="rounded border p-3">إجمالي غير محلول: <span className="font-semibold">{data.unresolved}</span></div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}