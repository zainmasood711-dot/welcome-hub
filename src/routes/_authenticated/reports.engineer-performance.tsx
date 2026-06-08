import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAccessContext } from "@/hooks/use-access-context";
import { requireRole } from "@/lib/auth-client";
import { getOperationsReport } from "@/lib/phase2.functions";

export const Route = createFileRoute("/_authenticated/reports/engineer-performance")({
  beforeLoad: async () => {
    await requireRole(["support_engineer", "manager"]);
  },
  component: EngineerPerformanceReportPage,
});

function EngineerPerformanceReportPage() {
  const reportFn = useServerFn(getOperationsReport);
  const { data: accessData } = useAccessContext();
  const roles = accessData?.roles ?? [];
  const { data, isLoading, error } = useQuery({ queryKey: ["report-engineer-performance"], queryFn: () => reportFn() });

  if (isLoading) {
    return (
      <AppShell roles={roles} title="تقرير أداء المهندسين">
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">جاري تحميل التقرير...</div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell roles={roles} title="تقرير أداء المهندسين">
        <div className="rounded-lg border border-destructive/40 bg-card p-6 text-sm text-destructive">تعذر تحميل التقرير.</div>
      </AppShell>
    );
  }

  return (
    <AppShell roles={roles} title="تقرير أداء المهندسين">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">نسبة الإنجاز لكل مهندس</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.engineerPerformance ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="engineer_name" hide />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="completion_rate" fill="var(--color-primary)" name="معدل الإنجاز %" radius={6} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">تفاصيل الأداء</CardTitle>
          </CardHeader>
          <CardContent className="rounded-lg border p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المهندس</TableHead>
                  <TableHead>إجمالي المهام</TableHead>
                  <TableHead>مكتملة</TableHead>
                  <TableHead>متأخرة</TableHead>
                  <TableHead>الإنجاز</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.engineerPerformance ?? []).map((item) => (
                  <TableRow key={item.engineer_id}>
                    <TableCell>{item.engineer_name}</TableCell>
                    <TableCell>{item.total}</TableCell>
                    <TableCell>{item.completed}</TableCell>
                    <TableCell>{item.delayed ?? 0}</TableCell>
                    <TableCell>{item.completion_rate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}