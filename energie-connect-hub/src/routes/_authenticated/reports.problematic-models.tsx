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

export const Route = createFileRoute("/_authenticated/reports/problematic-models")({
  beforeLoad: async () => {
    await requireRole(["support_engineer", "manager"]);
  },
  component: ProblematicModelsReportPage,
});

function ProblematicModelsReportPage() {
  const reportFn = useServerFn(getOperationsReport);
  const { data: accessData } = useAccessContext();
  const roles = accessData?.roles ?? [];
  const { data, isLoading, error } = useQuery({ queryKey: ["report-problematic-models"], queryFn: () => reportFn() });

  if (isLoading) {
    return (
      <AppShell roles={roles} title="تقرير المنتجات/الموديلات الإشكالية">
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">جاري تحميل التقرير...</div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell roles={roles} title="تقرير المنتجات/الموديلات الإشكالية">
        <div className="rounded-lg border border-destructive/40 bg-card p-6 text-sm text-destructive">تعذر تحميل التقرير.</div>
      </AppShell>
    );
  }

  return (
    <AppShell roles={roles} title="تقرير المنتجات/الموديلات الإشكالية">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">الموديلات الأكثر مشاكل</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.topProblematicModels ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="model" hide />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="totalIssues" fill="var(--color-primary)" radius={6} name="إجمالي الأعطال" />
                <Bar dataKey="unresolvedCount" fill="var(--color-destructive)" radius={6} name="غير المحلول" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">تفاصيل الموديلات</CardTitle>
          </CardHeader>
          <CardContent className="rounded-lg border p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الموديل</TableHead>
                  <TableHead>إجمالي الأعطال</TableHead>
                  <TableHead>غير المحلول</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.topProblematicModels ?? []).map((item) => (
                  <TableRow key={item.product_id}>
                    <TableCell>{item.model}</TableCell>
                    <TableCell>{item.totalIssues}</TableCell>
                    <TableCell>{item.unresolvedCount}</TableCell>
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