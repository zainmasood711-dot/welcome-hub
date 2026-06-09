import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccessContext } from "@/hooks/use-access-context";
import { requireRole } from "@/lib/auth-client";
import { getOperationsReport } from "@/lib/phase2.functions";

export const Route = createFileRoute("/_authenticated/reports/average-resolution-time")({
  beforeLoad: async () => {
    await requireRole(["support_engineer", "manager"]);
  },
  component: AverageResolutionTimeReportPage,
});

function AverageResolutionTimeReportPage() {
  const reportFn = useServerFn(getOperationsReport);
  const { data: accessData } = useAccessContext();
  const roles = accessData?.roles ?? [];
  const { data, isLoading, error } = useQuery({ queryKey: ["report-average-resolution-time"], queryFn: () => reportFn() });

  if (isLoading) {
    return (
      <AppShell roles={roles} title="تقرير متوسط زمن الحل">
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">جاري تحميل التقرير...</div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell roles={roles} title="تقرير متوسط زمن الحل">
        <div className="rounded-lg border border-destructive/40 bg-card p-6 text-sm text-destructive">تعذر تحميل التقرير.</div>
      </AppShell>
    );
  }

  return (
    <AppShell roles={roles} title="تقرير متوسط زمن الحل">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">متوسط زمن الحل الكلي</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{data.averageResolutionHours} ساعة</p>
            <p className="mt-2 text-sm text-muted-foreground">محسوب من التذاكر المغلقة أو المحلولة عن بُعد.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">اتجاه الإغلاق الشهري</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.monthlyTrend ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="closedTickets" stroke="var(--color-primary)" name="تذاكر مغلقة" />
                <Line type="monotone" dataKey="newTickets" stroke="var(--color-secondary)" name="تذاكر جديدة" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}